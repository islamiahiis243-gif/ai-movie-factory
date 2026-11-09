/**
 * AI MOVIE FACTORY — SERVER-SIDE PUBLISHING ENGINE TYPES (T9.4)
 * Server-only types for job processing, token management, and platform publishing adapters.
 * Never exposed directly to client bundles.
 */

export type ServerPublishingStatus =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'processing'
  | 'uploading'
  | 'published'
  | 'requires_user_action'
  | 'failed'
  | 'cancelled';

export interface PublishJobRecord {
  id: string;
  user_id: string;
  project_id?: string | null;
  export_package_id?: string | null;
  platform: string;
  provider_account_id?: string | null;
  target_format: string;
  title: string;
  caption?: string | null;
  description?: string | null;
  hashtags: string[];
  thumbnail_url?: string | null;
  media_url: string;
  scheduled_at?: string | null;
  status: ServerPublishingStatus;
  progress_percentage: number;
  retry_count: number;
  external_publish_id?: string | null;
  published_video_url?: string | null;
  error_message?: string | null;
  idempotency_key?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  provider_response_summary?: any;
  worker_claim_id?: string | null;
  claimed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishResult {
  status: 'published' | 'requires_user_action' | 'failed';
  externalPublishId?: string;
  publishedVideoUrl?: string;
  progressPercentage: number;
  errorMessage?: string;
  providerSummary?: any;
}

export interface IServerPlatformPublisher {
  platformId: string;
  platformName: string;
  publishVideo(params: {
    job: PublishJobRecord;
    accessToken: string;
  }): Promise<PublishResult>;
}
