/**
 * AI MOVIE FACTORY — YOUTUBE LIVE ANALYTICS ADAPTER (T9.5)
 * Official YouTube Data API v3 & YouTube Analytics API Integration.
 */

import { IServerPlatformAnalyticsAdapter, ParsedPlatformMetrics } from '../types';

export class YouTubeAnalyticsAdapter implements IServerPlatformAnalyticsAdapter {
  platformId = 'youtube';
  platformName = 'YouTube';

  async fetchMetrics(params: {
    externalPostId: string;
    accessToken: string;
  }): Promise<ParsedPlatformMetrics> {
    const { externalPostId, accessToken } = params;

    // 1. Fetch real-time public statistics from YouTube Data API v3
    const dataApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${encodeURIComponent(
      externalPostId
    )}`;

    const res = await fetch(dataApiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(`YouTube Data API Error (${res.status}): ${data.error?.message || res.statusText}`);
    }

    const item = data.items?.[0];
    const stats = item?.statistics || {};

    let views = Number(stats.viewCount || 0);
    let likes = Number(stats.likeCount || 0);
    let comments = Number(stats.commentCount || 0);
    let shares = 0;
    let watchTimeSeconds: number | null = null;
    let avgViewDurationSeconds: number | null = null;
    let retentionRate: number | null = null;
    let subscribersGained: number | null = null;
    let isWatchTimeAvailable = false;

    // 2. Optional: Attempt granular engagement & retention via YouTube Analytics API
    try {
      const now = new Date();
      const startDate = '2024-01-01';
      const endDate = now.toISOString().slice(0, 10);

      const analyticsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained&filters=video==${encodeURIComponent(
        externalPostId
      )}`;

      const aRes = await fetch(analyticsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (aRes.ok) {
        const aData = await aRes.json();
        const row = aData.rows?.[0];
        if (row && Array.isArray(row)) {
          const estimatedMinutes = Number(row[0] || 0);
          watchTimeSeconds = Math.round(estimatedMinutes * 60);
          avgViewDurationSeconds = Math.round(Number(row[1] || 0));
          retentionRate = Math.min(100, Math.max(0, Number(row[2] || 0)));
          subscribersGained = Number(row[3] || 0);
          isWatchTimeAvailable = true;
        }
      }
    } catch {
      // Analytics API may fail if scopes are limited; keep metrics as null (unavailable)
    }

    return {
      views,
      likes,
      comments,
      shares,
      watchTimeSeconds,
      avgViewDurationSeconds,
      retentionRate,
      subscribersGained,
      isWatchTimeAvailable,
      raw: stats,
    };
  }
}
