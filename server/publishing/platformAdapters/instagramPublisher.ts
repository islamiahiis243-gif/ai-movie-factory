/**
 * AI MOVIE FACTORY — INSTAGRAM REELS PUBLISHING ADAPTER (T9.4)
 * Official Meta Graph API v19.0 container flow for Instagram Reels.
 * Requires Instagram Professional Account linked to a Facebook Page.
 */

import { IServerPlatformPublisher, PublishJobRecord, PublishResult } from '../types';

export class InstagramPlatformPublisher implements IServerPlatformPublisher {
  platformId = 'instagram';
  platformName = 'Instagram (Reels)';

  async publishVideo(params: {
    job: PublishJobRecord;
    accessToken: string;
  }): Promise<PublishResult> {
    const { job, accessToken } = params;

    if (!job.media_url) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: 'Media URL video master tidak tersedia untuk Instagram Reels.',
      };
    }

    const igUserId = job.provider_account_id;
    if (!igUserId) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: 'ID Akun Instagram Bisnis/Kreator tidak ditemukan pada profil tersimpan.',
      };
    }

    const tags = Array.isArray(job.hashtags)
      ? job.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : '#AIMovieFactory #SinemaReels';

    const caption = [job.caption || job.title, tags].filter(Boolean).join('\n\n').slice(0, 2200);

    try {
      // Step 1: Create Media Container for Reel
      const containerUrl = new URL(`https://graph.facebook.com/v21.0/${igUserId}/media`);
      containerUrl.searchParams.append('media_type', 'REELS');
      containerUrl.searchParams.append('video_url', job.media_url);
      containerUrl.searchParams.append('caption', caption);
      containerUrl.searchParams.append('share_to_feed', 'true');
      containerUrl.searchParams.append('access_token', accessToken);

      const initRes = await fetch(containerUrl.toString(), { method: 'POST' });
      const initData = await initRes.json().catch(() => ({}));

      if (!initRes.ok || !initData.id) {
        return {
          status: 'failed',
          progressPercentage: 20,
          errorMessage:
            initData.error?.message ||
            `Pembuatan kontainer Instagram Reels gagal (${initRes.status}). Pastikan akun adalah Instagram Professional & terhubung ke Facebook Page.`,
          providerSummary: initData,
        };
      }

      const containerId = initData.id;

      // Step 2: Poll container status (up to 3 attempts, 3s interval)
      let isReady = false;
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const statusUrl = `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`;
        const statusRes = await fetch(statusUrl);
        const statusData = await statusRes.json().catch(() => ({}));

        if (statusData.status_code === 'FINISHED') {
          isReady = true;
          break;
        } else if (statusData.status_code === 'ERROR') {
          return {
            status: 'failed',
            progressPercentage: 40,
            errorMessage: 'Pemrosesan video reels di server Instagram gagal.',
            providerSummary: statusData,
          };
        }
      }

      // Step 3: Publish container if ready
      if (isReady) {
        const publishUrl = new URL(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`);
        publishUrl.searchParams.append('creation_id', containerId);
        publishUrl.searchParams.append('access_token', accessToken);

        const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
        const publishData = await publishRes.json().catch(() => ({}));

        if (!publishRes.ok || !publishData.id) {
          return {
            status: 'failed',
            progressPercentage: 70,
            errorMessage: publishData.error?.message || 'Penerbitan kontainer Instagram Reels gagal.',
            providerSummary: publishData,
          };
        }

        const publishedMediaId = publishData.id;
        return {
          status: 'published',
          externalPublishId: publishedMediaId,
          publishedVideoUrl: `https://www.instagram.com/p/${publishedMediaId}/`,
          progressPercentage: 100,
          providerSummary: publishData,
        };
      }

      // If container is still encoding on Meta servers, report user action / pending status cleanly
      return {
        status: 'requires_user_action',
        externalPublishId: containerId,
        progressPercentage: 60,
        errorMessage:
          'Video sedang diproses/di-encode oleh server Meta. Silakan periksa beberapa saat lagi atau publish otomatis dari Meta Business Suite.',
        providerSummary: { containerId, status: 'IN_PROGRESS' },
      };
    } catch (err: any) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: err.message || 'Koneksi ke Meta Graph API Instagram gagal.',
      };
    }
  }
}


// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
