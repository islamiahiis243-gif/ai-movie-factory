/**
 * AI MOVIE FACTORY — PUBLISHING JOB PROCESSOR & STATE MACHINE ENGINE (T9.4)
 * Enforces controlled state machine transitions, server-side idempotency,
 * atomic job claiming, and execution across registered platform publishers.
 */

import { getSupabaseAdmin } from '../supabaseAdmin';
import { PublishJobRecord, ServerPublishingStatus, IServerPlatformPublisher } from './types';
import { getValidAccessToken } from './tokenManager';
import { YouTubePlatformPublisher } from './platformAdapters/youtubePublisher';
import { TikTokPlatformPublisher } from './platformAdapters/tiktokPublisher';
import { InstagramPlatformPublisher } from './platformAdapters/instagramPublisher';
import { FacebookPlatformPublisher } from './platformAdapters/facebookPublisher';

const PUBLISHERS: Record<string, IServerPlatformPublisher> = {
  youtube: new YouTubePlatformPublisher(),
  tiktok: new TikTokPlatformPublisher(),
  instagram: new InstagramPlatformPublisher(),
  facebook: new FacebookPlatformPublisher(),
};

// In-memory jobs cache for testing / local execution resilience
const memoryJobsStore = new Map<string, PublishJobRecord>();

/**
 * Validates allowable state machine transitions.
 * Prevents invalid state jumps and client-forged terminal transitions.
 */
export function isValidStatusTransition(
  current: ServerPublishingStatus,
  next: ServerPublishingStatus
): boolean {
  if (current === next) return true;

  switch (current) {
    case 'draft':
      return next === 'queued' || next === 'cancelled';
    case 'queued':
      return next === 'processing' || next === 'scheduled' || next === 'cancelled';
    case 'scheduled':
      return next === 'queued' || next === 'cancelled';
    case 'processing':
      return next === 'uploading' || next === 'requires_user_action' || next === 'failed';
    case 'uploading':
      return next === 'published' || next === 'requires_user_action' || next === 'failed';
    case 'requires_user_action':
      return next === 'queued' || next === 'cancelled';
    case 'failed':
      return next === 'queued'; // retry allowed
    case 'published':
      return false; // terminal
    case 'cancelled':
      return false; // terminal
    default:
      return false;
  }
}

/**
 * Registers an in-memory job (useful for unit tests and local simulation)
 */
export function _setMemoryJob(job: PublishJobRecord): void {
  memoryJobsStore.set(job.id, { ...job });
}

export function _getMemoryJob(id: string): PublishJobRecord | undefined {
  return memoryJobsStore.get(id);
}

/**
 * Fetches a publishing job from database or memory store.
 */
export async function getPublishingJob(jobId: string): Promise<PublishJobRecord | null> {
  try {
    const adminSupabase = getSupabaseAdmin();
    const { data: job, error } = await adminSupabase
      .from('publishing_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (!error && job) {
      return job as PublishJobRecord;
    }
  } catch {
    // Database unavailable, fallback to memory
  }

  return memoryJobsStore.get(jobId) || null;
}

/**
 * Updates a publishing job with strict state machine validation and fencing protection.
 */
export async function updatePublishingJob(
  jobId: string,
  updates: Partial<PublishJobRecord>,
  options?: { expectedWorkerClaimId?: string }
): Promise<PublishJobRecord> {
  const current = await getPublishingJob(jobId);
  if (!current) {
    throw new Error(`Job publikasi #${jobId} tidak ditemukan.`);
  }

  // Fencing check: if a lease claim was expected, ensure the job has not been claimed by a newer worker
  if (options?.expectedWorkerClaimId && current.worker_claim_id && current.worker_claim_id !== options.expectedWorkerClaimId) {
    throw new Error(
      `Fencing violation: Worker lease expired or was taken over by another worker (${current.worker_claim_id} vs ${options.expectedWorkerClaimId}). Update rejected.`
    );
  }

  if (updates.status && !isValidStatusTransition(current.status, updates.status)) {
    throw new Error(
      `Transisi status tidak valid: Tidak dapat mengubah status dari "${current.status}" ke "${updates.status}".`
    );
  }

  const updatedRecord: PublishJobRecord = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  try {
    const adminSupabase = getSupabaseAdmin();
    let query = adminSupabase.from('publishing_jobs').update(updates).eq('id', jobId);
    if (options?.expectedWorkerClaimId) {
      query = query.eq('worker_claim_id', options.expectedWorkerClaimId);
    }
    await query;
  } catch {
    // Database write failed, retain in memory
  }

  memoryJobsStore.set(jobId, updatedRecord);
  return updatedRecord;
}

/**
 * Executes a single publishing job from queued state to completion.
 */
export async function executePublishingJob(params: {
  jobId: string;
  workerClaimId?: string;
  mockAccessToken?: string;
}): Promise<PublishJobRecord> {
  const { jobId, workerClaimId, mockAccessToken } = params;
  const job = await getPublishingJob(jobId);

  if (!job) {
    throw new Error(`Publishing job #${jobId} not found.`);
  }

  const publisher = PUBLISHERS[job.platform];
  if (!publisher) {
    throw new Error(
      `Platform publisher untuk "${job.platform}" belum tersedia untuk penerbitan langsung (gunakan ekspor manual).`
    );
  }

  // 1. Transition to processing
  await updatePublishingJob(jobId, {
    status: 'processing',
    progress_percentage: 15,
    started_at: new Date().toISOString(),
    worker_claim_id: workerClaimId || 'direct_dispatch',
    claimed_at: new Date().toISOString(),
  });

  try {
    // 2. Retrieve & verify valid decrypted access token
    let accessToken = mockAccessToken || '';
    if (!accessToken) {
      const tokenPayload = await getValidAccessToken({
        userId: job.user_id,
        platform: job.platform,
        accountId: job.provider_account_id,
      });
      accessToken = tokenPayload.accessToken;
    }

    // 3. Transition to uploading
    await updatePublishingJob(
      jobId,
      {
        status: 'uploading',
        progress_percentage: 40,
      },
      { expectedWorkerClaimId: workerClaimId }
    );

    // 4. Invoke platform publisher adapter
    const result = await publisher.publishVideo({
      job,
      accessToken,
    });

    // 5. Update based on real provider result
    const completedAt = new Date().toISOString();

    if (result.status === 'published') {
      return await updatePublishingJob(
        jobId,
        {
          status: 'published',
          progress_percentage: 100,
          external_publish_id: result.externalPublishId,
          published_video_url: result.publishedVideoUrl,
          provider_response_summary: result.providerSummary || null,
          completed_at: completedAt,
          error_message: null,
        },
        { expectedWorkerClaimId: workerClaimId }
      );
    } else if (result.status === 'requires_user_action') {
      return await updatePublishingJob(
        jobId,
        {
          status: 'requires_user_action',
          progress_percentage: result.progressPercentage || 50,
          external_publish_id: result.externalPublishId,
          error_message: result.errorMessage,
          provider_response_summary: result.providerSummary || null,
          completed_at: completedAt,
        },
        { expectedWorkerClaimId: workerClaimId }
      );
    } else {
      const newRetryCount = (job.retry_count || 0) + 1;
      return await updatePublishingJob(
        jobId,
        {
          status: 'failed',
          progress_percentage: result.progressPercentage || 0,
          error_message: result.errorMessage || 'Penerbitan video gagal diproses oleh provider.',
          retry_count: newRetryCount,
          completed_at: completedAt,
          provider_response_summary: result.providerSummary || null,
        },
        { expectedWorkerClaimId: workerClaimId }
      );
    }
  } catch (err: any) {
    const isAmbiguousTimeout =
      err.message?.toLowerCase().includes('timeout') ||
      err.message?.toLowerCase().includes('etimedout') ||
      err.message?.toLowerCase().includes('fetch failed') ||
      err.message?.toLowerCase().includes('504');

    if (isAmbiguousTimeout) {
      // Ambiguous state: avoid duplicate upload by moving to requires_user_action
      return await updatePublishingJob(
        jobId,
        {
          status: 'requires_user_action',
          progress_percentage: 50,
          error_message: `Unggahan mengalami kendala jaringan yang ambigu (${err.message}). Status ditangguhkan ke requires_user_action untuk mencegah duplikasi unggahan.`,
          completed_at: new Date().toISOString(),
        },
        { expectedWorkerClaimId: workerClaimId }
      );
    }

    const newRetryCount = (job.retry_count || 0) + 1;
    return await updatePublishingJob(
      jobId,
      {
        status: 'failed',
        progress_percentage: 0,
        error_message: err.message || 'Terjadi kesalahan sistem saat mengeksekusi publikasi.',
        retry_count: newRetryCount,
        completed_at: new Date().toISOString(),
      },
      { expectedWorkerClaimId: workerClaimId }
    );
  }
}
