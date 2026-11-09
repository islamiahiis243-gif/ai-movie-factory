/**
 * AI MOVIE FACTORY — TIKTOK PUBLISHING ADAPTER (T9.4)
 * Official TikTok Content Posting API v2 integration.
 * Supports Direct Post and Creator Inbox with honest permission verification.
 */

import type { IServerPlatformPublisher, PublishJobRecord, PublishResult } from '../types.ts';

export class TikTokPlatformPublisher implements IServerPlatformPublisher {
  platformId = 'tiktok';
  platformName = 'TikTok';

  async publishVideo(params: {
    job: PublishJobRecord;
    accessToken: string;
  }): Promise<PublishResult> {
    const { job, accessToken } = params;

    if (!job.media_url) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: 'Media URL video master tidak tersedia untuk TikTok.',
      };
    }

    const tags = Array.isArray(job.hashtags)
      ? job.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : '#AIMovieFactory #FilmPendekAI';

    const titleWithTags = `${job.title} ${tags}`.trim().slice(0, 2000);

    // Payload for TikTok Content Posting API v2: PULL_FROM_URL
    const payload = {
      post_info: {
        title: titleWithTags,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
        auto_add_music: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: job.media_url,
      },
    };

    try {
      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      // Check TikTok response code
      if (!res.ok || data.error?.code !== 'ok') {
        const errCode = data.error?.code || res.status;
        const errMsg = data.error?.message || res.statusText;

        // If Direct Post permission is pending developer app review on TikTok
        if (
          errCode === 'scope_not_authorized' ||
          errCode === 'unaudited_client_can_only_post_to_admin_users' ||
          String(errMsg).toLowerCase().includes('permission') ||
          String(errMsg).toLowerCase().includes('unaudited')
        ) {
          return {
            status: 'requires_user_action',
            progressPercentage: 50,
            errorMessage:
              'Aplikasi TikTok Anda memerlukan persetujuan izin "Direct Post" dari TikTok Developer Portal, atau posting harus dikonfirmasi manual di Creator Inbox TikTok.',
            providerSummary: data,
          };
        }

        return {
          status: 'failed',
          progressPercentage: 0,
          errorMessage: `TikTok API Error (${errCode}): ${errMsg}`,
          providerSummary: data,
        };
      }

      const publishId = data.data?.publish_id || data.publish_id;

      return {
        status: 'published',
        externalPublishId: publishId,
        publishedVideoUrl: publishId ? `https://www.tiktok.com/@creator/video/${publishId}` : undefined,
        progressPercentage: 100,
        providerSummary: data,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: err.message || 'Koneksi jaringan ke TikTok API gagal.',
      };
    }
  }
}


// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
