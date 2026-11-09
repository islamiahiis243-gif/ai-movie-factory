/**
 * AI MOVIE FACTORY — PUBLISHING DISPATCHER ORCHESTRATOR (T9.4)
 * Validates ownership, enforces idempotency, and coordinates job execution.
 */

import { getPublishingJob, updatePublishingJob, executePublishingJob } from './jobProcessor';
import { PublishJobRecord } from './types';

export class PublishingDispatcher {
  /**
   * Dispatches a publishing job for processing.
   * Ensures:
   * - User ownership verification (users cannot dispatch another user's job)
   * - Idempotency enforcement
   * - Immediate validation of media and platform parameters
   */
  static async dispatchJob(params: {
    jobId: string;
    userId: string;
    idempotencyKey?: string;
  }): Promise<PublishJobRecord> {
    const { jobId, userId, idempotencyKey } = params;

    const job = await getPublishingJob(jobId);
    if (!job) {
      throw new Error(`Job publikasi #${jobId} tidak ditemukan.`);
    }

    if (job.user_id !== userId) {
      throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk memproses job ini.');
    }

    if (job.status === 'published') {
      return job; // Idempotent return if already published
    }

    if (job.status === 'processing' || job.status === 'uploading') {
      return job; // Already in flight
    }

    // Check media file availability
    if (!job.media_url) {
      throw new Error('Video master belum dipilih atau media URL tidak tersedia.');
    }

    // Queue the job if it was draft or failed
    if (job.status === 'draft' || job.status === 'failed') {
      await updatePublishingJob(jobId, {
        status: 'queued',
        idempotency_key: idempotencyKey || job.idempotency_key,
        error_message: null,
      });
    }

    // Execute job
    const updated = await executePublishingJob({
      jobId,
      workerClaimId: `disp_${userId.slice(0, 8)}_${Date.now()}`,
    });

    return updated;
  }

  /**
   * Cancels a pending or queued job.
   */
  static async cancelJob(params: {
    jobId: string;
    userId: string;
  }): Promise<PublishJobRecord> {
    const { jobId, userId } = params;

    const job = await getPublishingJob(jobId);
    if (!job) {
      throw new Error(`Job publikasi #${jobId} tidak ditemukan.`);
    }

    if (job.user_id !== userId) {
      throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk membatalkan job ini.');
    }

    if (job.status === 'published') {
      throw new Error('Job yang sudah berhasil dipublikasikan tidak dapat dibatalkan.');
    }

    return await updatePublishingJob(jobId, {
      status: 'cancelled',
      error_message: 'Dibatalkan oleh pengguna.',
    });
  }
}
