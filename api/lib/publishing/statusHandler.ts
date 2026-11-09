/**
 * Vercel Serverless Function: GET /api/publishing/status
 * AI Movie Factory — Publishing Job Status Query Endpoint (T9.4)
 * Authenticates creator, validates job ownership, returns sanitized progress and external URL.
 */

import { authenticateServerlessRequest } from '../supabaseAdmin';
import { getPublishingJob } from './jobProcessor';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  try {
    const { user } = await authenticateServerlessRequest(req);
    const jobId = String(req.query?.jobId || '');

    if (!jobId) {
      return res.status(400).json({ error: 'Parameter query "jobId" diperlukan.' });
    }

    const job = await getPublishingJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job publikasi tidak ditemukan.' });
    }

    if (job.user_id !== user.id) {
      return res.status(403).json({ error: 'Akses ditolak ke job pengguna lain.' });
    }

    return res.status(200).json({
      success: true,
      job: {
        id: job.id,
        platform: job.platform,
        status: job.status,
        progressPercentage: job.progress_percentage,
        externalPublishId: job.external_publish_id,
        publishedVideoUrl: job.published_video_url,
        errorMessage: job.error_message,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        updatedAt: job.updated_at,
      },
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi') ? 401 : 500;
    return res.status(status).json({
      error: err.message || 'Gagal mengambil status job publikasi.',
    });
  }
}
