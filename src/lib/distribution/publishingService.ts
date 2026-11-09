/**
 * AI MOVIE FACTORY — UNIVERSAL PUBLISHING SERVICE (T9.2)
 * High-level orchestration service for multi-platform distribution drafts,
 * pre-flight content validation, and manual export packaging.
 */

import {
  PlatformId,
  PublishingMetadata,
  PublishingJob,
  ContentValidationResult,
} from './types';
import {
  getPlatformById,
  validateContentForPlatform,
  getAllPlatforms,
} from './platformRegistry';
import {
  createPublishingJob,
  fetchUserPublishingJobs,
  updatePublishingJobDraft,
  cancelPublishingJob,
  deletePublishingJob,
} from './publishingRepository';

export class UniversalPublishingService {
  /**
   * Validate content for multiple target platforms simultaneously.
   */
  static validateForMultiplePlatforms(
    platformIds: PlatformId[],
    metadata: PublishingMetadata,
    mediaSpecs?: { durationSeconds?: number; sizeBytes?: number; aspectRatio?: string }
  ): Record<PlatformId, ContentValidationResult> {
    const results: Partial<Record<PlatformId, ContentValidationResult>> = {};
    for (const pid of platformIds) {
      results[pid] = validateContentForPlatform(pid, metadata, mediaSpecs);
    }
    return results as Record<PlatformId, ContentValidationResult>;
  }

  /**
   * Create synchronized draft jobs across multiple platforms.
   */
  static async createMultiPlatformDrafts(params: {
    userId: string;
    projectId?: string;
    exportPackageId?: string;
    platformIds: PlatformId[];
    targetFormats: Record<PlatformId, string>;
    metadata: PublishingMetadata;
    mediaUrl: string;
  }): Promise<{ jobs: PublishingJob[]; errors: Record<PlatformId, string> }> {
    const jobs: PublishingJob[] = [];
    const errors: Record<PlatformId, string> = {} as any;

    for (const pid of params.platformIds) {
      const platformDef = getPlatformById(pid);
      if (!platformDef) {
        errors[pid] = `Platform ${pid} tidak terdaftar.`;
        continue;
      }

      const res = await createPublishingJob({
        user_id: params.userId,
        project_id: params.projectId,
        export_package_id: params.exportPackageId,
        platform: pid,
        target_format: params.targetFormats[pid] || '16:9',
        title: params.metadata.title,
        caption: params.metadata.caption,
        description: params.metadata.description,
        hashtags: params.metadata.hashtags,
        thumbnail_url: params.metadata.thumbnailUrl,
        media_url: params.mediaUrl,
        status: 'draft',
        progress_percentage: 0,
        retry_count: 0,
      });

      if (res.data) {
        jobs.push(res.data);
      } else if (res.error) {
        errors[pid] = res.error;
      }
    }

    return { jobs, errors };
  }

  /**
   * Formats a complete copyable text payload ready to paste into native platform studios.
   */
  static formatPlatformClipboardPayload(
    platformId: PlatformId,
    metadata: PublishingMetadata
  ): string {
    const platform = getPlatformById(platformId);
    const tagsStr = metadata.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');

    if (platformId === 'youtube') {
      return `${metadata.title}\n\n${metadata.description || ''}\n\n${tagsStr}\n\nProduced with AI Movie Factory (AMF)`;
    }

    if (platformId === 'tiktok' || platformId === 'instagram' || platformId === 'threads') {
      const mainText = metadata.caption || metadata.title;
      return `${mainText}\n.\n.\n${tagsStr}\n#AIMovieFactory #AIFilm`;
    }

    if (platformId === 'x_twitter') {
      return `${metadata.title}\n\n${tagsStr}`;
    }

    return `${metadata.title}\n\n${metadata.description || ''}\n\n${tagsStr}`;
  }

  /**
   * Helper querying repository
   */
  static fetchUserJobs = fetchUserPublishingJobs;
  static updateDraft = updatePublishingJobDraft;
  static cancelJob = cancelPublishingJob;
  static deleteJob = deletePublishingJob;
  static getPlatform = getPlatformById;
  static getRegistry = getAllPlatforms;
}
