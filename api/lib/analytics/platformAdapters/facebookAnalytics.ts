/**
 * AI MOVIE FACTORY — FACEBOOK PAGE VIDEO LIVE ANALYTICS ADAPTER (T9.5)
 * Official Meta Graph API v21.0 Facebook Video Metrics Integration.
 */

import { IServerPlatformAnalyticsAdapter, ParsedPlatformMetrics } from '../types';

export class FacebookAnalyticsAdapter implements IServerPlatformAnalyticsAdapter {
  platformId = 'facebook';
  platformName = 'Facebook';

  async fetchMetrics(params: {
    externalPostId: string;
    accessToken: string;
  }): Promise<ParsedPlatformMetrics> {
    const { externalPostId, accessToken } = params;

    // Fetch video insights and public metrics
    const url = `https://graph.facebook.com/v21.0/${externalPostId}?fields=views,likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`;

    const res = await fetch(url, { method: 'GET' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      throw new Error(`Facebook Graph API Error (${res.status}): ${data.error?.message || res.statusText}`);
    }

    const views = Number(data.views || 0);
    const likes = Number(data.likes?.summary?.total_count || 0);
    const comments = Number(data.comments?.summary?.total_count || 0);
    const shares = Number(data.shares?.count || 0);

    return {
      views,
      likes,
      comments,
      shares,
      watchTimeSeconds: null,
      avgViewDurationSeconds: null,
      retentionRate: null,
      subscribersGained: null,
      isWatchTimeAvailable: false,
      raw: data,
    };
  }
}
