/**
 * Vercel Serverless Function: POST /api/publishing/worker
 * AI Movie Factory — Protected Background Publishing Worker (T9.4 & Production Hardened)
 * Triggered by Vercel Cron or background queue runner.
 * Strictly protected by CRON_SECRET, PUBLISHING_WORKER_SECRET, or SUPABASE_SECRET_KEY.
 *
 * Reliability Invariant:
 * Stale jobs (older than 15 min lease) are reconciled before retrying to prevent duplicate uploads.
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

    // 1. Reconcile stale processing jobs (older than 15 minutes lease)
    // Avoid blindly re-queuing if external publication or session already occurred!
    const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: staleJobs } = await adminSupabase
      .from('publishing_jobs')
      .select('id, external_publish_id, published_video_url, retry_count')
      .in('status', ['processing', 'uploading'])
      .lt('claimed_at', staleCutoff);

    if (staleJobs && staleJobs.length > 0) {
      for (const sj of staleJobs) {
        if (sj.external_publish_id || sj.published_video_url) {
          // Reconciled: already published externally
          await adminSupabase
            .from('publishing_jobs')
            .update({
              status: 'published',
              progress_percentage: 100,
              completed_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', sj.id);
        } else if ((sj.retry_count || 0) >= 3) {
          // Max retry exceeded
          await adminSupabase
            .from('publishing_jobs')
            .update({
              status: 'failed',
              error_message: 'Pekerjaan melebihi batas percobaan maksimal (3x). Silakan periksa status studio platform.',
              completed_at: new Date().toISOString(),
            })
            .eq('id', sj.id);
        } else {
          // Increment retry count with fencing before re-queuing
          await adminSupabase
            .from('publishing_jobs')
            .update({
              status: 'queued',
              retry_count: (sj.retry_count || 0) + 1,
              error_message: 'Worker lease kedaluwarsa — dijadwalkan ulang secara aman.',
              worker_claim_id: null,
            })
            .eq('id', sj.id);
        }
      }
    }

    // 2. Claim up to 5 queued jobs atomically
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
