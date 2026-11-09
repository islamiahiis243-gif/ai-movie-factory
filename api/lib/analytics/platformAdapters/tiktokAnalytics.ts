/**
 * AI MOVIE FACTORY — TIKTOK LIVE ANALYTICS ADAPTER (T9.5)
 * Official TikTok Open API Video Query Integration.
 */

import { IServerPlatformAnalyticsAdapter, ParsedPlatformMetrics } from '../types';

export class TikTokAnalyticsAdapter implements IServerPlatformAnalyticsAdapter {
  platformId = 'tiktok';
  platformName = 'TikTok';

  async fetchMetrics(params: {
    externalPostId: string;
    accessToken: string;
  }): Promise<ParsedPlatformMetrics> {
    const { externalPostId, accessToken } = params;

    const url = 'https://open.tiktokapis.com/v2/video/query/?fields=id,title,like_count,comment_count,share_count,view_count';
    const body = {
      filters: {
        video_ids: [externalPostId],
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data.error && data.error.code && data.error.code !== 'ok' && data.error.code !== 0)) {
      throw new Error(`TikTok Video Query API Error: ${data.error?.message || res.statusText || 'Gagal memuat video'}`);
    }

    const video = data.data?.videos?.[0] || {};

    return {
      views: Number(video.view_count || 0),
      likes: Number(video.like_count || 0),
      comments: Number(video.comment_count || 0),
      shares: Number(video.share_count || 0),
      watchTimeSeconds: null,
      avgViewDurationSeconds: null,
      retentionRate: null,
      subscribersGained: null,
      isWatchTimeAvailable: false,
      raw: video,
    };
  }
}
