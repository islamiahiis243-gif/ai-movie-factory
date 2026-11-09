/**
 * Vercel Serverless Function: POST /api/publishing/worker
 * AI Movie Factory — Protected Background Publishing Worker (T9.4)
 * Triggered by Vercel Cron or background queue runner.
 * Strictly protected by CRON_SECRET or PUBLISHING_WORKER_SECRET.
 */

import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { executePublishingJob } from '../lib/publishing/jobProcessor';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // Verify Worker Authentication Secret
  const authHeader = String(req.headers?.authorization || '');
  const workerSecret =
    process.env.CRON_SECRET ||
    process.env.PUBLISHING_WORKER_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    '';

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!workerSecret || token !== workerSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing worker authentication secret.' });
  }

  const claimId = `worker_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const processedJobs = [];

  try {
    const adminSupabase = getSupabaseAdmin();

    // 1. Recover stale processing jobs (older than 15 minutes)
    const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await adminSupabase
      .from('publishing_jobs')
      .update({
        status: 'queued',
        error_message: 'Job recovered from stalled worker process.',
        worker_claim_id: null,
      })
      .eq('status', 'processing')
      .lt('claimed_at', staleCutoff);

    // 2. Claim up to 5 queued jobs
    const { data: queuedJobs, error: fetchErr } = await adminSupabase
      .from('publishing_jobs')
      .select('id, user_id, platform')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(5);

    if (fetchErr) {
      return res.status(500).json({ error: 'Failed to claim queued jobs: ' + fetchErr.message });
    }

    // 3. Process claimed jobs sequentially
    for (const job of queuedJobs || []) {
      try {
        const result = await executePublishingJob({
          jobId: job.id,
          workerClaimId: claimId,
        });
        processedJobs.push({ id: job.id, status: result.status });
      } catch (err: any) {
        processedJobs.push({ id: job.id, status: 'failed', error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      claimId,
      processedCount: processedJobs.length,
      jobs: processedJobs,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Worker execution encountered an unexpected error.',
    });
  }
}
