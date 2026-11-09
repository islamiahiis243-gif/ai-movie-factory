/**
 * Vercel Serverless Function: POST /api/credits/transaction
 * AI Movie Factory — Dedicated Credit Transaction Operations
 * Decoupled from payment-webhook. Handles reserve, settle, release, and refund.
 */

import { authenticateServerlessRequest } from '../lib/supabaseAdmin';
import {
  reserveUserCredits,
  settleUserCredits,
  releaseUserCredits,
  getUserCreditBalance,
} from '../lib/credits/creditEngine';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  let adminSupabase: any = null;
  let user: any = null;

  try {
    const authResult = await authenticateServerlessRequest(req);
    adminSupabase = authResult.adminSupabase;
    user = authResult.user;
  } catch (err: any) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: err.message || 'Sesi autentikasi diperlukan.',
    });
  }

  const { action, amount, reservationId, txId, operation, provider, model, idempotencyKey, description } = req.body || {};

  try {
    if (action === 'reserve') {
      const reservation = await reserveUserCredits({
        adminSupabase,
        userId: user.id,
        amount: Math.abs(Number(amount || 0)),
        operation: operation || 'ai_generation',
        provider,
        model,
        idempotencyKey,
      });
      return res.status(200).json({ success: true, ...reservation });
    }

    if (action === 'settle') {
      if (!reservationId) {
        return res.status(400).json({ error: 'MISSING_RESERVATION_ID' });
      }
      const settled = await settleUserCredits({
        adminSupabase,
        reservationId,
        actualAmount: Math.abs(Number(amount || 0)),
        description,
      });
      return res.status(200).json({ success: true, ...settled });
    }

    if (action === 'release') {
      if (!reservationId) {
        return res.status(400).json({ error: 'MISSING_RESERVATION_ID' });
      }
      const released = await releaseUserCredits({
        adminSupabase,
        reservationId,
        reason: description,
      });
      return res.status(200).json({ success: true, ...released });
    }

    if (action === 'refund') {
      if (!txId) {
        return res.status(400).json({ error: 'MISSING_TX_ID' });
      }

      // Check if already refunded
      const { data: alreadyRefunded } = await adminSupabase
        .from('credit_transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('transaction_type', 'refund')
        .eq('idempotency_key', `refund_${txId}`)
        .maybeSingle();

      if (alreadyRefunded) {
        return res.status(400).json({
          error: 'ALREADY_REFUNDED',
          message: 'Transaksi ini sudah pernah dikembalikan (refund) sebelumnya.',
        });
      }

      // Query target transaction
      const { data: targetTx } = await adminSupabase
        .from('credit_transactions')
        .select('*')
        .eq('id', txId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!targetTx || targetTx.transaction_type !== 'usage') {
        return res.status(400).json({
          error: 'INVALID_REFUND_TARGET',
          message: 'Transaksi penggunaan tidak ditemukan untuk refund.',
        });
      }

      const refundAmount = Math.abs(Number(targetTx.amount || 0));
      const bal = await getUserCreditBalance(adminSupabase, user.id);
      const newBal = bal.settledBalance + refundAmount;

      const { data: newTx, error: txErr } = await adminSupabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          project_id: targetTx.project_id,
          job_id: targetTx.job_id,
          transaction_type: 'refund',
          amount: refundAmount,
          balance_after: newBal,
          provider: targetTx.provider || 'system',
          model: targetTx.model || 'auto_refund_guard',
          operation: 'failed_job_credit_refund',
          estimated_cost_usd: 0,
          actual_cost_usd: 0,
          description: `Refund: ${targetTx.description || 'Pekerjaan Gagal'}`,
          status: 'completed',
          idempotency_key: `refund_${txId}`,
        })
        .select()
        .single();

      if (txErr) throw txErr;

      return res.status(200).json({
        success: true,
        refundedAmount: refundAmount,
        newBalance: newBal,
        transaction: newTx,
      });
    }

    return res.status(400).json({
      error: 'INVALID_ACTION',
      message: 'Action tidak dikenali. Gunakan reserve, settle, release, atau refund.',
    });
  } catch (err: any) {
    if (err.code === 'INSUFFICIENT_CREDITS' || err.status === 402) {
      return res.status(402).json({
        error: 'INSUFFICIENT_CREDITS',
        message: err.message,
      });
    }
    return res.status(500).json({
      error: 'TRANSACTION_ERROR',
      message: err.message || 'Terjadi kesalahan pemrosesan transaksi kredit.',
    });
  }
}
