/**
 * AI MOVIE FACTORY — YOUTUBE PUBLISHING ADAPTER (T9.4)
 * Official YouTube Data API v3 integration for Long-Form Videos & Shorts.
 * Compliant with Google API Quotas and Resumable Upload specifications.
 */

import type { IServerPlatformPublisher, PublishJobRecord, PublishResult } from '../types.ts';

export class YouTubePlatformPublisher implements IServerPlatformPublisher {
  platformId = 'youtube';
  platformName = 'YouTube';

  async publishVideo(params: {
    job: PublishJobRecord;
    accessToken: string;
  }): Promise<PublishResult> {
    const { job, accessToken } = params;

    if (!job.media_url) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: 'Media URL video master tidak tersedia.',
      };
    }

    const isShorts =
      job.target_format === '9:16' ||
      job.title.toLowerCase().includes('#shorts') ||
      (job.description || '').toLowerCase().includes('#shorts');

    // Build optimized metadata
    const tags = Array.isArray(job.hashtags)
      ? job.hashtags.map((h) => h.replace(/^#/, ''))
      : ['AIMovieFactory', 'SinemaAI'];

    if (isShorts && !tags.includes('Shorts')) {
      tags.push('Shorts');
    }

    let finalTitle = job.title.trim().slice(0, 100);
    if (isShorts && !finalTitle.includes('#Shorts') && finalTitle.length <= 92) {
      finalTitle += ' #Shorts';
    }

    const finalDescription = [
      job.description || '',
      '\n---',
      'Diproduksi dan dirilis menggunakan AI Movie Factory (AMF)',
      tags.map((t) => `#${t}`).join(' '),
    ]
      .filter(Boolean)
      .join('\n');

    const metadata = {
      snippet: {
        title: finalTitle,
        description: finalDescription,
        tags,
        categoryId: '1', // Film & Animation
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    // 1. Initialize Resumable Upload Session with Google APIs
    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      const errMsg =
        errData.error?.message ||
        `Inisialisasi unggah YouTube gagal (${initRes.status}: ${initRes.statusText})`;

      if (initRes.status === 403 && errMsg.toLowerCase().includes('quota')) {
        return {
          status: 'failed',
          progressPercentage: 0,
          errorMessage:
            'Kuota API YouTube harian tercapai (Quota Exceeded). Coba kembali besok atau ajukan penambahan kuota di Google Cloud Console.',
          providerSummary: errData,
        };
      }

      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: errMsg,
        providerSummary: errData,
      };
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return {
        status: 'failed',
        progressPercentage: 0,
        errorMessage: 'YouTube tidak mengembalikan lokasi sesi upload resumable.',
      };
    }

    // 2. Fetch media stream/buffer from media_url and upload to session
    // Note: For cloud deployment, this streams directly from Supabase Storage or source URL
    const mediaFetchRes = await fetch(job.media_url);
    if (!mediaFetchRes.ok) {
      return {
        status: 'failed',
        progressPercentage: 10,
        errorMessage: `Gagal mengunduh file video master dari storage (${mediaFetchRes.statusText}).`,
      };
    }

    const videoBlob = await mediaFetchRes.arrayBuffer();

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoBlob.byteLength),
      },
      body: videoBlob,
    });

    const uploadData = await uploadRes.json().catch(() => ({}));

    if (!uploadRes.ok || !uploadData.id) {
      return {
        status: 'failed',
        progressPercentage: 50,
        errorMessage:
          uploadData.error?.message || `Gagal mengunggah stream video ke YouTube (${uploadRes.status}).`,
        providerSummary: uploadData,
      };
    }

    const videoId = uploadData.id;
    const publishedUrl = isShorts
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;

    return {
      status: 'published',
      externalPublishId: videoId,
      publishedVideoUrl: publishedUrl,
      progressPercentage: 100,
      providerSummary: {
        id: videoId,
        snippet: uploadData.snippet,
        status: uploadData.status,
      },
    };
  }
}


// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
