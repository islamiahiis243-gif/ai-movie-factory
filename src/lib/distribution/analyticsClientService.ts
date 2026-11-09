/**
 * AI MOVIE FACTORY — CLIENT ANALYTICS SERVICE (T9.5)
 * Connects Creator Intelligence UI with serverless analytics sync endpoints.
 */

export interface LiveAnalyticsSnapshot {
  id: string;
  user_id: string;
  project_id?: string | null;
  publishing_job_id: string;
  platform: string;
  external_post_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watch_time_seconds?: number | null;
  avg_view_duration_seconds?: number | null;
  retention_rate?: number | null;
  subscribers_gained?: number | null;
  sync_source: string;
  synced_at: string;
}

export class AnalyticsClientService {
  /**
   * Triggers an immediate serverless live sync for a published film.
   */
  static async syncJob(publishingJobId: string, accessToken: string): Promise<LiveAnalyticsSnapshot> {
    const res = await fetch('/api/analytics/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publishingJobId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyinkronkan analitik live.');
    }

    return data.snapshot;
  }

  /**
   * Fetches the user's historical analytics snapshots.
   */
  static async fetchHistory(accessToken: string, jobId?: string): Promise<LiveAnalyticsSnapshot[]> {
    const url = jobId
      ? `/api/analytics/history?jobId=${encodeURIComponent(jobId)}`
      : '/api/analytics/history';

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal memuat riwayat analitik.');
    }

    return data.snapshots || [];
  }
}
