/**
 * AI MOVIE FACTORY — INSTAGRAM REELS LIVE ANALYTICS ADAPTER (T9.5)
 * Official Meta Graph API v21.0 Instagram Insights Integration.
 */

import { IServerPlatformAnalyticsAdapter, ParsedPlatformMetrics } from '../types';

export class InstagramAnalyticsAdapter implements IServerPlatformAnalyticsAdapter {
  platformId = 'instagram';
  platformName = 'Instagram';

  async fetchMetrics(params: {
    externalPostId: string;
    accessToken: string;
  }): Promise<ParsedPlatformMetrics> {
    const { externalPostId, accessToken } = params;

    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let rawData: any = {};

    // 1. Fetch base media counts (like_count, comments_count)
    try {
      const baseRes = await fetch(
        `https://graph.facebook.com/v21.0/${externalPostId}?fields=like_count,comments_count,media_type&access_token=${accessToken}`
      );
      if (baseRes.ok) {
        const baseData = await baseRes.json();
        likes = Number(baseData.like_count || 0);
        comments = Number(baseData.comments_count || 0);
        rawData.base = baseData;
      }
    } catch {
      // Fall through to insights
    }

    // 2. Fetch Reels Insights (reach, plays, shares, saved, total_interactions)
    try {
      const insightsRes = await fetch(
        `https://graph.facebook.com/v21.0/${externalPostId}/insights?metric=reach,plays,shares,saved,total_interactions&access_token=${accessToken}`
      );
      if (insightsRes.ok) {
        const iData = await insightsRes.json();
        rawData.insights = iData;
        const metricsArray = iData.data || [];
        for (const m of metricsArray) {
          const val = Number(m.values?.[0]?.value || 0);
          if (m.name === 'plays') views = val;
          if (m.name === 'shares') shares = val;
          if (m.name === 'likes' && !likes) likes = val;
          if (m.name === 'comments' && !comments) comments = val;
        }
      }
    } catch {
      // Keep base counts
    }

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
      raw: rawData,
    };
  }
}


// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
