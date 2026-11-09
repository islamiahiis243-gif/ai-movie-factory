/**
 * AI MOVIE FACTORY — UNIVERSAL DISTRIBUTION PLATFORM TYPES (T9.2)
 * Supports 13 major platforms across video sharing, short-form, and social networks.
 */

export type FirstWavePlatformId = 'youtube' | 'tiktok' | 'instagram' | 'facebook';

export type ExpansionPlatformId =
  | 'x_twitter'
  | 'linkedin'
  | 'pinterest'
  | 'snapchat'
  | 'threads'
  | 'telegram'
  | 'vimeo'
  | 'dailymotion'
  | 'reddit';

export type PlatformId = FirstWavePlatformId | ExpansionPlatformId;

export type PlatformCategory =
  | 'video_sharing'
  | 'short_form'
  | 'social_network'
  | 'community'
  | 'messaging';

export type PlatformIntegrationStatus =
  | 'planned'
  | 'architecture_ready'
  | 'manual_export_available'
  | 'api_in_development'
  | 'approval_required'
  | 'connected'
  | 'direct_publishing_available'
  | 'temporarily_unavailable';

export interface PlatformCapabilities {
  supportedAspectRatios: string[];
  supportedResolutions: string[];
  maxDurationSeconds: number;
  maxSizeBytes: number;
  supportsDirectPublishing: boolean;
  supportsManualExport: boolean;
  supportsScheduling: boolean;
  supportsDraftInboxMode: boolean;
  supportsThumbnailUpload: boolean;
  supportsSubtitles: boolean;
  supportsAnalytics: boolean;
  requiresAppApproval: boolean;
  accountTypeRequired: 'personal' | 'creator' | 'business_page' | 'channel' | 'developer';
  oauthScopes: string[];
  rateLimitNote?: string;
}

export interface PlatformDefinition {
  id: PlatformId;
  name: string;
  category: PlatformCategory;
  color: string;
  badgeColor: string;
  iconName: string;
  integrationStatus: PlatformIntegrationStatus;
  capabilities: PlatformCapabilities;
  officialDocUrl: string;
  description: {
    id: string;
    en: string;
  };
  manualWorkflowNotes: {
    id: string;
    en: string;
  };
}

export interface PlatformAccount {
  id: string;
  platform: PlatformId;
  accountName: string;
  accountId: string;
  accountAvatarUrl?: string;
  connectionStatus: 'connected' | 'needs_reauth' | 'disconnected';
  grantedScopes: string[];
  connectedAt: string;
  lastSyncAt?: string;
}

export interface PublishingMetadata {
  title: string;
  caption?: string;
  description?: string;
  hashtags: string[];
  category?: string;
  privacy: 'public' | 'unlisted' | 'private';
  thumbnailUrl?: string;
  subtitleUrl?: string;
  aspectRatio: string;
}

export interface ContentValidationIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  suggestion?: string;
}

export interface ContentValidationResult {
  isValid: boolean;
  issues: ContentValidationIssue[];
}

export type PublishingJobStatus =
  | 'draft'
  | 'queued'
  | 'scheduled'
  | 'processing'
  | 'uploading'
  | 'published'
  | 'requires_user_action'
  | 'failed'
  | 'cancelled';

export interface PublishingJob {
  id: string;
  user_id: string;
  project_id?: string;
  export_package_id?: string;
  platform: PlatformId;
  provider_account_id?: string;
  target_format: string;
  title: string;
  caption?: string;
  description?: string;
  hashtags: string[];
  thumbnail_url?: string;
  media_url: string;
  scheduled_at?: string;
  status: PublishingJobStatus;
  progress_percentage: number;
  retry_count: number;
  external_publish_id?: string;
  published_video_url?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface PublishingResult {
  success: boolean;
  jobId: string;
  status: PublishingJobStatus;
  publishedUrl?: string;
  externalId?: string;
  errorMessage?: string;
}

/**
 * Shared Platform Adapter Contract.
 * Server-side adapters implement this contract for actual publishing operations in T9.4.
 */
export interface IPlatformAdapter {
  readonly capabilities: PlatformCapabilities;
  validateContent(
    metadata: PublishingMetadata,
    mediaSpecs?: { durationSeconds?: number; sizeBytes?: number; aspectRatio?: string }
  ): Promise<ContentValidationResult>;
  prepareContent?(masterVideoUrl: string, metadata: PublishingMetadata): Promise<{ adaptedMediaUrl: string }>;
  publishContent?(job: PublishingJob): Promise<PublishingResult>;
  getPublicationStatus?(externalPublishId: string): Promise<PublishingJobStatus>;
  getAnalytics?(externalVideoId: string): Promise<Record<string, any> | null>;
  disconnectAccount?(accountId: string): Promise<boolean>;
}
