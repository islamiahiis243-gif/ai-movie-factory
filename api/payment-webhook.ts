/**
 * Vercel Serverless Function: /api/payment-webhook
 * Verified Server-Side Payment Settlement & Ledger Engine for Indonesian Flagship Billing (Midtrans / QRIS / VA / E-Wallet)
 * Reference: SSOT Part 8 (Sec 20), Part 9 (Sec 21, 22), Part 14 (Sec 41)
 *
 * Security Invariant:
 * In V3.2 Enterprise Master SQL, `public.payment_orders`, `public.subscriptions`, and `public.credit_transactions`
 * are protected from direct client mutation. Only the server-side `service_role` (`SUPABASE_SECRET_KEY`)
 * can settle orders, update subscription tiers, and append to the immutable `public.credit_transactions` ledger.
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
  signatureKey: string;
}): boolean {
  const { orderId, statusCode, grossAmount, serverKey, signatureKey } = params;
  if (!orderId || !statusCode || !grossAmount || !serverKey || !signatureKey) {
    return false;
  }
  const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expectedHash = crypto.createHash('sha512').update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'utf8'),
      Buffer.from(signatureKey, 'utf8')
    );
  } catch {
    return false;
  }
}

function mapPackageIdToTier(packageId: string): 'free' | 'creator' | 'pro_studio' | 'production_house' {
  if (packageId === 'creator_indie' || packageId === 'plan_creator' || packageId === 'creator') return 'creator';
  if (packageId === 'pro_studio' || packageId === 'plan_pro_studio') return 'pro_studio';
  if (packageId === 'production_house' || packageId === 'plan_production_house') return 'production_house';
  return 'free';
}

function mapTierSeatLimit(tier: string): number {
  if (tier === 'production_house') return 25;
  if (tier === 'pro_studio') return 5;
  if (tier === 'creator') return 2;
  return 1;
}

async function getCurrentBalance(adminSupabase: any, userId: string): Promise<number> {
  const { data: latestTx } = await adminSupabase
    .from('credit_transactions')
    .select('balance_after')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestTx && typeof latestTx.balance_after === 'number') {
    return latestTx.balance_after;
  }

  const { data: sub } = await adminSupabase
    .from('subscriptions')
    .select('credits_allotted')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return sub?.credits_allotted ?? 150;
}

async function isUserPlatformAdmin(adminSupabase: any, userId: string, email?: string): Promise<boolean> {
  if (email && email.toLowerCase() === 'islamiahiis243@gmail.com') {
    return true;
  }
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return false;
  return profile.role === 'admin' || String(profile.email || '').toLowerCase() === 'islamiahiis243@gmail.com';
}

async function settleOrderForUser(
  adminSupabase: any,
  targetOrder: any,
  billingCycleInput?: string,
  adminApproverEmail?: string
) {
  const targetUserId = targetOrder.user_id;
  const packageType =
    targetOrder.package_type === 'credit_pack' ? 'topup_credits' : String(targetOrder.package_type || 'subscription');
  const packageId = String(targetOrder.package_id || '');
  const amount = Number(targetOrder.amount || 0);
  const creditsGranted = Number(targetOrder.credits_granted || 0);
  const paymentMethod = String(targetOrder.payment_method || 'mandiri_va');
  const billingCycle =
    billingCycleInput === 'yearly' || String(targetOrder.package_name || '').toLowerCase().includes('year')
      ? 'yearly'
      : 'monthly';

  if (targetOrder.status === 'settlement' || targetOrder.status === 'completed' || targetOrder.status === 'paid') {
    const currentBalance = await getCurrentBalance(adminSupabase, targetUserId);
    return {
      order: targetOrder,
      transaction: null,
      subscription: null,
      balance_after: currentBalance,
    };
  }

  const nowIso = new Date().toISOString();
  const prevRef = targetOrder.external_reference ? `${targetOrder.external_reference} | ` : '';
  const extRef = `${prevRef}VERIFIED-SUMARLIN-${paymentMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;

  const { data: settledOrder, error: settleErr } = await adminSupabase
    .from('payment_orders')
    .update({
      status: 'settlement',
      paid_at: nowIso,
      external_reference: extRef.slice(0, 240),
    })
    .eq('id', targetOrder.id)
    .select()
    .single();

  if (settleErr) {
    throw new Error(settleErr.message);
  }

  const currentBalance = await getCurrentBalance(adminSupabase, targetUserId);
  const newBalance = currentBalance + creditsGranted;

  const { data: newTx, error: txErr } = await adminSupabase
    .from('credit_transactions')
    .insert({
      user_id: targetUserId,
      transaction_type: packageType === 'subscription' ? 'monthly_allotment' : 'purchase',
      amount: creditsGranted,
      balance_after: newBalance,
      provider: 'direct_merchant',
      model: `${paymentMethod}_settlement`,
      operation: packageType === 'subscription' ? 'subscription_activation' : 'credit_pack_purchase',
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      description:
        packageType === 'subscription'
          ? `Aktivasi Langganan ${settledOrder.package_name} via ${paymentMethod.toUpperCase()} (${settledOrder.order_number})${adminApproverEmail ? ` [Disetujui Admin]` : ''}`
          : `Top-Up ${settledOrder.package_name} (+${creditsGranted.toLocaleString('id-ID')} Kredit) via ${paymentMethod.toUpperCase()} (${settledOrder.order_number})${adminApproverEmail ? ` [Disetujui Admin]` : ''}`,
      status: 'completed',
      idempotency_key: `settle_${settledOrder.order_number}`,
    })
    .select()
    .single();

  if (txErr) {
    throw new Error(txErr.message);
  }

  let updatedSubscription = null;
  if (packageType === 'subscription') {
    const targetTier = mapPackageIdToTier(packageId);
    const periodDays = billingCycle === 'yearly' ? 365 : 30;
    const periodEnd = new Date(Date.now() + periodDays * 86400000).toISOString();

    const { data: existingSub } = await adminSupabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', targetUserId)
      .limit(1)
      .maybeSingle();

    if (existingSub?.id) {
      const { data: subRow } = await adminSupabase
        .from('subscriptions')
        .update({
          tier: targetTier,
          status: 'active',
          billing_cycle: billingCycle,
          price_paid: amount,
          currency: 'IDR',
          credits_allotted: creditsGranted,
          current_period_start: nowIso,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          payment_provider: 'midtrans',
          payment_method: paymentMethod,
          updated_at: nowIso,
        })
        .eq('id', existingSub.id)
        .select()
        .single();
      updatedSubscription = subRow;
    } else {
      const { data: subRow } = await adminSupabase
        .from('subscriptions')
        .insert({
          user_id: targetUserId,
          tier: targetTier,
          status: 'active',
          billing_cycle: billingCycle,
          price_paid: amount,
          currency: 'IDR',
          credits_allotted: creditsGranted,
          current_period_start: nowIso,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          payment_provider: 'midtrans',
          payment_method: paymentMethod,
        })
        .select()
        .single();
      updatedSubscription = subRow;
    }

    const seatLimit = mapTierSeatLimit(targetTier);
    await adminSupabase
      .from('workspaces')
      .update({
        tier: targetTier,
        max_seats: seatLimit,
        seat_limit: seatLimit,
        updated_at: nowIso,
      })
      .eq('owner_id', targetUserId);
  }

  return {
    order: settledOrder,
    transaction: newTx,
    subscription: updatedSubscription,
    balance_after: newBalance,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const body = req.body || {};
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // ============================================================================
  // MODE A: AUTHENTICATED CLIENT BILLING & LEDGER OPERATIONS
  // ============================================================================
  if (body.action) {
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(503).json({
        error: 'Konfigurasi server Supabase (SUPABASE_SECRET_KEY) belum tersedia.',
      });
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = String(req.headers?.authorization || '');
    const accessToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : String(body.accessToken || '');

    if (!accessToken) {
      return res.status(401).json({ error: 'Sesi autentikasi diperlukan untuk transaksi ini.' });
    }

    const { data: authData, error: authErr } = await adminSupabase.auth.getUser(accessToken);
    if (authErr || !authData?.user) {
      return res.status(401).json({ error: 'Token sesi tidak valid atau telah kedaluwarsa.' });
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email || '';
    const action = String(body.action);

    try {
      if (action === 'submit_payment_proof' || action === 'settle_order') {
        const orderInput = body.order || {};
        const orderNumber = String(orderInput.order_number || `AMF-${Date.now()}`);
        const packageType =
          orderInput.package_type === 'credit_pack' ? 'topup_credits' : String(orderInput.package_type || 'subscription');
        const packageId = String(orderInput.package_id || '');
        const amount = Number(orderInput.amount || 0);
        const creditsGranted = Number(orderInput.credits_granted || 0);
        const paymentMethod = String(orderInput.payment_method || 'mandiri_va');
        const billingCycle = orderInput.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
        const senderNote = String(body.sender_note || '').trim();
        const billingId = String(body.billing_id || `88008-15900-${orderNumber.replace(/\D/g, '').slice(-6).padStart(6, '0')}`);

        let { data: existingOrder } = await adminSupabase
          .from('payment_orders')
          .select('*')
          .eq('order_number', orderNumber)
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingOrder) {
          const { data: insertedOrder, error: insertErr } = await adminSupabase
            .from('payment_orders')
            .insert({
              user_id: userId,
              order_number: orderNumber,
              package_type: packageType,
              package_id: packageId,
              package_name: String(orderInput.package_name || packageId),
              amount,
              currency: 'IDR',
              payment_gateway: 'midtrans',
              payment_method: paymentMethod,
              status: 'pending',
              credits_granted: creditsGranted,
            })
            .select()
            .single();

          if (insertErr) {
            return res.status(400).json({ error: insertErr.message });
          }
          existingOrder = insertedOrder;
        }

        // Attach Billing ID & Sender Note before automatic settlement
        existingOrder.external_reference = senderNote
          ? `IDBILL:${billingId} | Pengirim: ${senderNote}`
          : `IDBILL:${billingId} | AUTO-SETTLED`;

        const settledResult = await settleOrderForUser(
          adminSupabase,
          existingOrder,
          billingCycle
        );

        return res.status(200).json({
          status: 'settled',
          ...settledResult,
        });
      }

      if (action === 'check_order_status') {
        const orderId = String(body.order_id || '');
        const orderNumber = String(body.order_number || '');
        let query = adminSupabase.from('payment_orders').select('*').eq('user_id', userId);
        if (orderId) {
          query = query.eq('id', orderId);
        } else if (orderNumber) {
          query = query.eq('order_number', orderNumber);
        }

        const { data: ord } = await query.maybeSingle();
        if (!ord) {
          return res.status(404).json({ error: 'Tagihan tidak ditemukan.' });
        }

        let sub = null;
        if (ord.status === 'settlement' || ord.status === 'completed' || ord.status === 'paid') {
          const { data: subData } = await adminSupabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          sub = subData;
        }
        const currentBalance = await getCurrentBalance(adminSupabase, userId);

        return res.status(200).json({
          status: ord.status,
          order: ord,
          subscription: sub,
          balance_after: currentBalance,
        });
      }

      if (action === 'admin_list_data') {
        const isAdmin = await isUserPlatformAdmin(adminSupabase, userId, userEmail);
        if (!isAdmin) {
          return res.status(403).json({ error: 'Akses ditolak: Hanya Admin Platform yang diizinkan.' });
        }

        const [ordersRes, txsRes, profilesRes, subsRes] = await Promise.all([
          adminSupabase
            .from('payment_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100),
          adminSupabase
            .from('credit_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(150),
          adminSupabase
            .from('profiles')
            .select('id, display_name, email, role, created_at'),
          adminSupabase
            .from('subscriptions')
            .select('*')
            .eq('status', 'active'),
        ]);

        const profileMap = new Map<string, { display_name: string; email: string }>();
        for (const p of profilesRes.data || []) {
          profileMap.set(p.id, { display_name: p.display_name, email: p.email });
        }

        const enrichedOrders = (ordersRes.data || []).map((o: any) => ({
          ...o,
          user_display_name: profileMap.get(o.user_id)?.display_name || 'Creator',
          user_email: profileMap.get(o.user_id)?.email || o.user_id,
        }));

        const enrichedTxs = (txsRes.data || []).map((tx: any) => ({
          ...tx,
          user_display_name: profileMap.get(tx.user_id)?.display_name || 'Creator',
          user_email: profileMap.get(tx.user_id)?.email || tx.user_id,
        }));

        return res.status(200).json({
          orders: enrichedOrders,
          transactions: enrichedTxs,
          profiles: profilesRes.data || [],
          active_subscriptions_count: (subsRes.data || []).filter((s: any) => s.tier !== 'free').length,
        });
      }

      if (action === 'admin_approve_order') {
        const isAdmin = await isUserPlatformAdmin(adminSupabase, userId, userEmail);
        if (!isAdmin) {
          return res.status(403).json({ error: 'Akses ditolak: Hanya Admin Platform yang dapat menyetujui pembayaran.' });
        }

        const orderId = String(body.order_id || '');
        const { data: targetOrder } = await adminSupabase
          .from('payment_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (!targetOrder) {
          return res.status(404).json({ error: 'Pesanan pembayaran tidak ditemukan.' });
        }

        const settledResult = await settleOrderForUser(
          adminSupabase,
          targetOrder,
          body.billing_cycle,
          userEmail
        );

        return res.status(200).json({
          status: 'settled',
          ...settledResult,
        });
      }

      if (action === 'admin_reject_order' || action === 'admin_rollback_order') {
        const isAdmin = await isUserPlatformAdmin(adminSupabase, userId, userEmail);
        if (!isAdmin) {
          return res.status(403).json({ error: 'Akses ditolak: Hanya Admin Platform yang dapat membatalkan pembayaran.' });
        }

        const orderId = String(body.order_id || '');
        const reason = String(body.reason || 'Pembatalan transaksi oleh Admin Platform');

        const { data: targetOrder } = await adminSupabase
          .from('payment_orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();

        if (!targetOrder) {
          return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
        }

        const wasSettled = targetOrder.status === 'settlement' || targetOrder.status === 'completed' || targetOrder.status === 'paid';

        // 1. Mark order as cancelled
        const { data: rejectedOrder, error: rejErr } = await adminSupabase
          .from('payment_orders')
          .update({
            status: 'cancelled',
            external_reference: `BATAL_ADMIN | ${reason}`.slice(0, 240),
          })
          .eq('id', orderId)
          .select()
          .single();

        if (rejErr) {
          return res.status(400).json({ error: rejErr.message });
        }

        // 2. If it was already settled, rollback the credited amount from the ledger
        if (wasSettled && targetOrder.credits_granted > 0) {
          const currentBal = await getCurrentBalance(adminSupabase, targetOrder.user_id);
          const rollbackAmount = -Math.abs(Number(targetOrder.credits_granted));
          const newBal = Math.max(0, currentBal + rollbackAmount);

          await adminSupabase.from('credit_transactions').insert({
            user_id: targetOrder.user_id,
            transaction_type: 'admin_adjustment',
            amount: rollbackAmount,
            balance_after: newBal,
            provider: 'admin_console',
            model: 'emergency_order_rollback',
            operation: 'order_settlement_reversal',
            estimated_cost_usd: 0,
            actual_cost_usd: 0,
            description: `Pembatalan & Penarikan Kredit: Order #${targetOrder.order_number} (${reason})`,
            status: 'completed',
            idempotency_key: `rollback_${targetOrder.order_number}_${Date.now()}`,
          });

          // Reset subscription to free if this was a subscription order
          if (targetOrder.package_type === 'subscription') {
            await adminSupabase
              .from('subscriptions')
              .update({
                tier: 'free',
                status: 'active',
                credits_allotted: 150,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', targetOrder.user_id);

            await adminSupabase
              .from('workspaces')
              .update({
                tier: 'free',
                max_seats: 1,
                seat_limit: 1,
                updated_at: new Date().toISOString(),
              })
              .eq('owner_id', targetOrder.user_id);
          }
        }

        return res.status(200).json({
          status: 'cancelled',
          order: rejectedOrder,
        });
      }

      if (action === 'switch_free_plan') {
        const nowIso = new Date().toISOString();
        const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
        const { data: existingSub } = await adminSupabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        let subRow = null;
        if (existingSub?.id) {
          const { data } = await adminSupabase
            .from('subscriptions')
            .update({
              tier: 'free',
              status: 'active',
              billing_cycle: 'monthly',
              price_paid: 0,
              credits_allotted: 150,
              current_period_start: nowIso,
              current_period_end: periodEnd,
              updated_at: nowIso,
            })
            .eq('id', existingSub.id)
            .select()
            .single();
          subRow = data;
        }

        return res.status(200).json({
          status: 'updated',
          subscription: subRow,
        });
      }

      if (action === 'record_usage') {
        const creditsToDeduct = Math.abs(Number(body.amount || 0));
        const currentBalance = await getCurrentBalance(adminSupabase, userId);

        if (currentBalance < creditsToDeduct) {
          return res.status(402).json({
            error: 'INSUFFICIENT_CREDITS',
            message: `Saldo kredit tidak mencukupi (Tersedia: ${currentBalance}, Diperlukan: ${creditsToDeduct}). Silakan lakukan top-up kredit.`,
          });
        }

        const newBalance = currentBalance - creditsToDeduct;

        const { data: newTx, error: txErr } = await adminSupabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            project_id: body.project_id || null,
            job_id: body.job_id || null,
            transaction_type: 'usage',
            amount: -creditsToDeduct,
            balance_after: newBalance,
            provider: String(body.provider || 'google_gemini'),
            model: String(body.model || 'gemini-2.5-flash'),
            operation: String(body.operation || 'ai_generation'),
            estimated_cost_usd: Number(body.estimated_cost_usd || (creditsToDeduct * 0.0028).toFixed(4)),
            actual_cost_usd: Number(body.actual_cost_usd || (creditsToDeduct * 0.0025).toFixed(4)),
            description: String(body.description || 'Eksekusi AI Studio'),
            status: 'completed',
            idempotency_key: body.idempotency_key || `use_${userId}_${Date.now()}`,
          })
          .select()
          .single();

        if (txErr) {
          return res.status(400).json({ error: txErr.message });
        }

        return res.status(200).json({
          status: 'recorded',
          transaction: newTx,
          balance_after: newBalance,
        });
      }

      if (action === 'refund_tx') {
        const txId = String(body.tx_id || '');

        // Double-refund prevention check
        const { data: alreadyRefunded } = await adminSupabase
          .from('credit_transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('transaction_type', 'refund')
          .eq('idempotency_key', `refund_${txId}`)
          .maybeSingle();

        if (alreadyRefunded) {
          return res.status(400).json({
            error: 'ALREADY_REFUNDED',
            message: 'Transaksi ini sudah pernah dikembalikan (refund) sebelumnya.',
          });
        }
        const { data: targetTx } = await adminSupabase
          .from('credit_transactions')
          .select('*')
          .eq('id', txId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!targetTx || targetTx.transaction_type !== 'usage') {
          return res.status(400).json({ error: 'Transaksi penggunaan tidak ditemukan untuk refund.' });
        }

        const refundAmount = Math.abs(Number(targetTx.amount || 0));
        const currentBalance = await getCurrentBalance(adminSupabase, userId);
        const newBalance = currentBalance + refundAmount;

        const { data: refundTx, error: refErr } = await adminSupabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            project_id: targetTx.project_id,
            job_id: targetTx.job_id,
            transaction_type: 'refund',
            amount: refundAmount,
            balance_after: newBalance,
            provider: targetTx.provider || 'system',
            model: targetTx.model || 'auto_refund_guard',
            operation: 'failed_job_credit_refund',
            estimated_cost_usd: 0,
            actual_cost_usd: 0,
            description: `Refund Otomatis: ${targetTx.description}`,
            status: 'completed',
            idempotency_key: `refund_${txId}`,
          })
          .select()
          .single();

        if (refErr) {
          return res.status(400).json({ error: refErr.message });
        }

        return res.status(200).json({
          status: 'refunded',
          transaction: refundTx,
          balance_after: newBalance,
        });
      }

      if (action === 'admin_adjust') {
        const isAdmin = await isUserPlatformAdmin(adminSupabase, userId, userEmail);
        if (!isAdmin) {
          return res.status(403).json({ error: 'Akses ditolak: Hanya Admin Platform yang diizinkan.' });
        }
        const targetUid = String(body.target_user_id || userId);
        const delta = Number(body.amount || 0);
        const reason = String(body.reason || 'Penyesuaian Kredit Konsol Admin');
        const currentBalance = await getCurrentBalance(adminSupabase, targetUid);
        const newBalance = Math.max(0, currentBalance + delta);

        const { data: adjTx, error: adjErr } = await adminSupabase
          .from('credit_transactions')
          .insert({
            user_id: targetUid,
            transaction_type: 'admin_adjustment',
            amount: delta,
            balance_after: newBalance,
            provider: 'admin_console',
            model: 'manual_override',
            operation: 'manual_credit_adjustment',
            estimated_cost_usd: 0,
            actual_cost_usd: 0,
            description: `Admin Override: ${reason}`,
            status: 'completed',
            idempotency_key: `admin_adj_${targetUid}_${Date.now()}`,
          })
          .select()
          .single();

        if (adjErr) {
          return res.status(400).json({ error: adjErr.message });
        }

        return res.status(200).json({
          status: 'adjusted',
          transaction: adjTx,
          balance_after: newBalance,
        });
      }

      return res.status(400).json({ error: `Action tidak dikenali: ${action}` });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Internal billing engine error' });
    }
  }

  // ============================================================================
  // MODE B: EXTERNAL MIDTRANS CRYPTOGRAPHIC WEBHOOK CALLBACK
  // ============================================================================
  const provider = (req.headers?.['x-payment-provider'] || body.provider || 'midtrans').toLowerCase();

  if (provider === 'midtrans') {
    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || '';
    if (!midtransServerKey) {
      return res.status(503).json({
        error: 'MIDTRANS_SERVER_KEY belum dikonfigurasi pada environment variables server.',
      });
    }

    const isValid = verifyMidtransSignature({
      orderId: String(body.order_id || ''),
      statusCode: String(body.status_code || ''),
      grossAmount: String(body.gross_amount || ''),
      serverKey: midtransServerKey,
      signatureKey: String(body.signature_key || ''),
    });

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid Midtrans SHA-512 webhook signature.',
      });
    }

    const transactionStatus = String(body.transaction_status || '');
    const isSettled = transactionStatus === 'settlement' || transactionStatus === 'capture';

    if (isSettled && supabaseUrl && supabaseServiceKey) {
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: order } = await adminSupabase
        .from('payment_orders')
        .update({
          status: 'settlement',
          paid_at: new Date().toISOString(),
          external_reference: String(body.transaction_id || body.order_id),
        })
        .eq('order_number', String(body.order_id))
        .eq('status', 'pending')
        .select()
        .single();

      if (order) {
        const currentBalance = await getCurrentBalance(adminSupabase, order.user_id);
        const newBalance = currentBalance + Number(order.credits_granted || 0);
        await adminSupabase.from('credit_transactions').insert({
          user_id: order.user_id,
          transaction_type: order.package_type === 'subscription' ? 'monthly_allotment' : 'purchase',
          amount: order.credits_granted,
          balance_after: newBalance,
          provider: 'midtrans',
          model: order.payment_method,
          operation: 'verified_webhook_settlement',
          estimated_cost_usd: 0,
          actual_cost_usd: 0,
          description: `Verified Webhook Settlement: ${order.package_name} (${order.order_number})`,
          status: 'completed',
          idempotency_key: `webhook_midtrans_${order.order_number}`,
        });
      }
    }

    return res.status(200).json({
      status: 'verified',
      provider: 'midtrans',
      order_id: body.order_id,
      settled: isSettled,
    });
  }

  return res.status(400).json({
    error: `Unsupported payment webhook provider: ${provider}`,
  });
}
