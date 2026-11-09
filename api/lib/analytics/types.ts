/**
 * AI MOVIE FACTORY — SERVER-SIDE LIVE ANALYTICS TYPES (T9.5)
 * Multi-Platform Metrics Aggregation, Time-Series Snapshots & Adapter Interfaces.
 */

export interface ParsedPlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watchTimeSeconds: number;
  avgViewDurationSeconds: number;
  retentionRate: number; // percentage (0.00 to 100.00)
  subscribersGained: number;
  raw?: any;
}

export interface AnalyticsSnapshotRecord {
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
  watch_time_seconds: number;
  avg_view_duration_seconds: number;
  retention_rate: number;
  subscribers_gained: number;
  raw_provider_metrics?: any;
  sync_source: 'cron_sync' | 'manual_refresh' | 'webhook' | 'initial_snapshot';
  synced_at: string;
  created_at: string;
}

export interface IServerPlatformAnalyticsAdapter {
  platformId: string;
  platformName: string;
  fetchMetrics(params: {
    externalPostId: string;
    accessToken: string;
    jobData?: any;
  }): Promise<ParsedPlatformMetrics>;
}
