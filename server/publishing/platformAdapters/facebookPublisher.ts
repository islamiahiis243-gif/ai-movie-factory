/**
 * AI MOVIE FACTORY — FACEBOOK PAGE VIDEO PUBLISHING ADAPTER (T9.4)
 * Official Meta Graph API v19.0 integration for Facebook Page Video & Reels.
 * Requires Facebook Page admin/editor permissions (`pages_manage_posts`, `publish_video`).
 */

import { IServerPlatformPublisher, PublishJobRecord, PublishResult } from '../types';

export class FacebookPlatformPublisher implements IServerPlatformPublisher {
  platformId = 'facebook';
  platformName = 'Facebook';

  async publishVideo(params: {
    job: PublishJobRecord;
    accessToken: string;
  }): Promise<PublishResult> {
    const { job, accessToken } = params;

    if (!job.media_url) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: 'Media URL video master tidak tersedia untuk Facebook.',
      };
    }

    const pageId = job.provider_account_id || 'me';
    const tags = Array.isArray(job.hashtags)
      ? job.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : '#AIMovieFactory #FilmPendek';

    const description = [job.description || job.title, tags].filter(Boolean).join('\n\n');

    try {
      const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/videos`);
      url.searchParams.append('file_url', job.media_url);
      url.searchParams.append('title', job.title.slice(0, 100));
      url.searchParams.append('description', description);
      url.searchParams.append('access_token', accessToken);

      const res = await fetch(url.toString(), { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.id) {
        return {
          status: 'failed',
          progressPercentage: 0,
          errorMessage:
            data.error?.message ||
            `Unggah video ke Halaman Facebook gagal (${res.status}). Pastikan izin publish_video dan pages_manage_posts telah disetujui.`,
          providerSummary: data,
        };
      }

      const videoId = data.id;
      return {
        status: 'published',
        externalPublishId: videoId,
        publishedVideoUrl: `https://www.facebook.com/watch/?v=${videoId}`,
        progressPercentage: 100,
        providerSummary: data,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: err.message || 'Koneksi ke Facebook Graph API gagal.',
      };
    }
  }
}


// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
