/**
 * Vercel Serverless Function: POST /api/admin/financial-analytics
 * AI Movie Factory — Protected Administrator Financial Analytics & Simulator API (Phase 6)
 * Strictly restricted to platform administrators.
 */

import { authenticateServerlessRequest, getSupabaseAdmin } from '../lib/supabaseAdmin';
import { runPricingSimulation, FullSimulationOutput } from '../lib/cost/pricingSimulator';
import { calculateProviderCost } from '../lib/cost/providerCostEngine';

async function isPlatformAdmin(adminSupabase: any, userId: string, email?: string): Promise<boolean> {
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
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
      message: err.message || 'Sesi autentikasi administrator diperlukan.',
    });
  }

  // Admin Role Verification Guard
  const isAdmin = await isPlatformAdmin(adminSupabase, user.id, user.email);
  if (!isAdmin) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Akses ditolak: Endpoint analitik keuangan hanya dapat diakses oleh administrator sistem.',
    });
  }

  const body = req.body || {};
  const action = body.action || req.query.action || 'overview';

  try {
    if (action === 'run_simulation') {
      const simulation = runPricingSimulation({
        tierUsers: body.tierUsers,
        scenarioKey: body.scenarioKey,
        providerMode: body.providerMode,
        paymentGatewayFeeRate: body.paymentGatewayFeeRate,
        exchangeRateIdr: body.exchangeRateIdr,
      });
      return res.status(200).json({ success: true, simulation });
    }

    // 1. Fetch Cloud Metrics via Stored Procedure
    const { data: summaryMetrics } = await adminSupabase.rpc('get_financial_summary_metrics', {
      p_start_date: body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_end_date: body.endDate || new Date().toISOString(),
    });

    const summary = Array.isArray(summaryMetrics) && summaryMetrics.length > 0 ? summaryMetrics[0] : {};

    // 2. Fetch Subscription & Payment Revenue
    const { data: settledOrders } = await adminSupabase
      .from('payment_orders')
      .select('amount, package_type, package_id, status, created_at')
      .in('status', ['settlement', 'completed', 'paid']);

    const totalRevenueIdr = (settledOrders || []).reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);

    // 3. Fetch Active Subscriptions by Tier
    const { data: subscriptions } = await adminSupabase
      .from('subscriptions')
      .select('tier, status, user_id');

    const tierCounts: Record<string, number> = {
      free: 0,
      creator_indie: 0,
      pro_studio: 0,
      production_house: 0,
    };

    (subscriptions || []).forEach((s: any) => {
      const t = s.tier === 'creator' ? 'creator_indie' : s.tier;
      if (tierCounts[t] !== undefined) {
        tierCounts[t]++;
      } else {
        tierCounts.free++;
      }
    });

    // 4. Fetch Recent Usage Records & Breakdown
    const { data: recentRecords } = await adminSupabase
      .from('ai_usage_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // 5. Detect Financial Anomalies
    const { data: anomalyRecords } = await adminSupabase
      .from('ai_usage_records')
      .select('id, user_id, operation, model, total_tokens, retry_count, status, created_at')
      .or('total_tokens.gt.8000,retry_count.gt.3,status.eq.failed')
      .order('created_at', { ascending: false })
      .limit(10);

    const anomalies = (anomalyRecords || []).map((rec: any) => {
      let reason = 'Anomali terdeteksi';
      if (rec.total_tokens > 8000) reason = `Lonjakan token tidak wajar (${rec.total_tokens} tokens)`;
      else if (rec.retry_count > 3) reason = `Tingkat percobaan ulang tinggi (${rec.retry_count}x retries)`;
      else if (rec.status === 'failed') reason = `Kegagalan eksekusi provider pada operasi ${rec.operation}`;
      return {
        recordId: rec.id,
        userId: rec.user_id,
        operation: rec.operation,
        model: rec.model,
        reason,
        timestamp: rec.created_at,
      };
    });

    // 6. Calculate Gross Margin
    const billedCostIdr = Number(summary.total_billed_provider_cost_usd || 0) * 16000;
    const paidEquivalentIdr = Number(summary.total_paid_equivalent_cost_usd || 0) * 16000;
    const grossProfitIdr = totalRevenueIdr - billedCostIdr;
    const grossMarginPercent =
      totalRevenueIdr > 0 ? Number((((totalRevenueIdr - billedCostIdr) / totalRevenueIdr) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      overview: {
        totalRevenueIdr,
        totalBilledProviderCostUsd: Number(summary.total_billed_provider_cost_usd || 0),
        totalBilledProviderCostIdr: billedCostIdr,
        totalPaidEquivalentCostUsd: Number(summary.total_paid_equivalent_cost_usd || 0),
        totalPaidEquivalentCostIdr: paidEquivalentIdr,
        freeTierSubsidyIdr: paidEquivalentIdr, // Entire current consumption subsidized by Gemini Free
        grossProfitIdr,
        grossMarginPercent,
        totalOperationsCount: Number(summary.total_operations_count || 0),
        totalPromptTokens: Number(summary.total_prompt_tokens || 0),
        totalCandidatesTokens: Number(summary.total_candidates_tokens || 0),
        totalTokens: Number(summary.total_tokens || 0),
        totalCreditsCharged: Number(summary.total_credits_charged || 0),
        activeSubscribersCount: (subscriptions || []).length,
      },
      tierDistribution: tierCounts,
      anomalies,
      recentRecords: recentRecords || [],
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'ANALYTICS_ERROR',
      message: err.message || 'Gagal memproses analitik keuangan sistem.',
    });
  }
}
