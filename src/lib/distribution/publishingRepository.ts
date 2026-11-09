/**
 * AI MOVIE FACTORY — PUBLISHING JOBS REPOSITORY (T9.2)
 * Manages publishing job persistence with Supabase Cloud and local fallback.
 * Enforces ownership validation and transparent error reporting.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import { PublishingJob, PublishingJobStatus } from './types';

const LOCAL_STORAGE_JOBS_KEY = 'amf_publishing_jobs_v1';

function getLocalJobs(): PublishingJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_JOBS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to read local publishing jobs:', err);
    return [];
  }
}

function saveLocalJobs(jobs: PublishingJob[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_JOBS_KEY, JSON.stringify(jobs));
  } catch (err) {
    console.warn('Failed to save local publishing jobs:', err);
  }
}

/**
 * Fetch all publishing jobs for a user, optionally filtered by project.
 */
export async function fetchUserPublishingJobs(
  userId: string,
  projectId?: string
): Promise<{ data: PublishingJob[]; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('publishing_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Supabase fetchUserPublishingJobs returned error, using local:', error.message);
      } else if (data) {
        return { data: data as PublishingJob[], error: null };
      }
    } catch (err: any) {
      console.warn('Supabase fetchUserPublishingJobs failed:', err);
    }
  }

  // Fallback
  const all = getLocalJobs().filter((j) => j.user_id === userId);
  const filtered = projectId ? all.filter((j) => j.project_id === projectId) : all;
  return { data: filtered, error: null };
}

/**
 * Create a new publishing job record (starts in 'draft' or 'queued' state).
 */
export async function createPublishingJob(
  jobData: Omit<PublishingJob, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: PublishingJob | null; error: string | null }> {
  const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}`;
  const now = new Date().toISOString();

  const newJob: PublishingJob = {
    ...jobData,
    id: newId,
    progress_percentage: 0,
    retry_count: 0,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('publishing_jobs')
        .insert(newJob)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }
      if (data) {
        const local = getLocalJobs();
        saveLocalJobs([data as PublishingJob, ...local]);
        return { data: data as PublishingJob, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err.message || 'Gagal menyimpan draft publikasi ke cloud' };
    }
  }

  // Pure local fallback
  const local = getLocalJobs();
  saveLocalJobs([newJob, ...local]);
  return { data: newJob, error: null };
}

/**
 * Update allowed fields of a publishing draft.
 * CRITICAL SECURITY: Normal users cannot directly set status to 'published' or modify server fields.
 */
export async function updatePublishingJobDraft(
  jobId: string,
  userId: string,
  updates: Partial<Pick<PublishingJob, 'title' | 'caption' | 'description' | 'hashtags' | 'target_format' | 'scheduled_at' | 'status'>>
): Promise<{ data: PublishingJob | null; error: string | null }> {
  // Prevent unauthorized status manipulation
  if (updates.status && !['draft', 'queued', 'scheduled', 'cancelled'].includes(updates.status)) {
    return {
      data: null,
      error: 'Status pekerjaan hanya dapat diubah ke draft, queued, scheduled, atau cancelled oleh pengguna.',
    };
  }

  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('publishing_jobs')
        .update(payload)
        .eq('id', jobId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }
      if (data) {
        const local = getLocalJobs().map((j) => (j.id === jobId ? (data as PublishingJob) : j));
        saveLocalJobs(local);
        return { data: data as PublishingJob, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err.message || 'Gagal memperbarui draft publikasi' };
    }
  }

  // Local fallback
  const all = getLocalJobs();
  const idx = all.findIndex((j) => j.id === jobId && j.user_id === userId);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...payload };
    saveLocalJobs(all);
    return { data: all[idx], error: null };
  }

  return { data: null, error: 'Pekerjaan publikasi tidak ditemukan' };
}

/**
 * Cancel a publishing job.
 */
export async function cancelPublishingJob(
  jobId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  return updatePublishingJobDraft(jobId, userId, { status: 'cancelled' }).then((res) => ({
    success: !!res.data,
    error: res.error,
  }));
}

/**
 * Delete a draft or cancelled job.
 */
export async function deletePublishingJob(
  jobId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('publishing_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', userId)
        .in('status', ['draft', 'cancelled', 'failed']);

      if (error) {
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menghapus pekerjaan publikasi' };
    }
  }

  const all = getLocalJobs().filter((j) => !(j.id === jobId && j.user_id === userId));
  saveLocalJobs(all);
  return { success: true, error: null };
}
