/**
 * AUTOMATED TESTING SUITE — LIVE ANALYTICS SYNC & AGGREGATOR (T9.5)
 * Tests:
 * 1. Platform Adapters Metric Extraction (YouTube, TikTok, Instagram, Facebook)
 * 2. Unauthenticated sync call rejection (401)
 * 3. Cross-user access control & job ownership enforcement (403)
 * 4. Job state guard (rejects syncing non-published / queued jobs)
 * 5. Snapshot persistence & history retrieval
 * 6. Background sync worker authorization guard (CRON_SECRET)
 */

import { YouTubeAnalyticsAdapter } from '../api/lib/analytics/platformAdapters/youtubeAnalytics';
import { TikTokAnalyticsAdapter } from '../api/lib/analytics/platformAdapters/tiktokAnalytics';
import { InstagramAnalyticsAdapter } from '../api/lib/analytics/platformAdapters/instagramAnalytics';
import { FacebookAnalyticsAdapter } from '../api/lib/analytics/platformAdapters/facebookAnalytics';
import {
  AnalyticsService,
  _clearMemorySnapshots,
  _getMemorySnapshots,
} from '../api/lib/analytics/analyticsService';
import { _setMemoryJob } from '../api/lib/publishing/jobProcessor';
import { PublishJobRecord } from '../api/lib/publishing/types';
import syncHandler from '../api/analytics/sync';
import syncWorkerHandler from '../api/analytics/sync-worker';

function createMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let jsonBody: any = null;

  return {
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      return this;
    },
    getStatusCode: () => statusCode,
    getJson: () => jsonBody,
    getHeaders: () => headers,
  };
}

async function runAnalyticsSyncTests() {
  console.log('================================================================');
  console.log('AI MOVIE FACTORY — T9.5 LIVE ANALYTICS SYNC VERIFICATION SUITE');
  console.log('================================================================\n');

  // Setup Global Mock Fetch for Platform Analytics APIs
  const originalFetch = global.fetch;

  (global as any).fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // 1. YouTube Data API v3 Mock
    if (urlStr.includes('googleapis.com/youtube/v3/videos')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          items: [
            {
              id: 'yt-vid-12345',
              statistics: {
                viewCount: '154200',
                likeCount: '8900',
                commentCount: '450',
              },
            },
          ],
        }),
      } as any;
    }

    // 2. TikTok Open API Mock
    if (urlStr.includes('open.tiktokapis.com/v2/video/query/')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: {
            videos: [
              {
                id: 'tt-vid-98765',
                view_count: 85200,
                like_count: 6700,
                comment_count: 310,
                share_count: 145,
              },
            ],
          },
        }),
      } as any;
    }

    // 3. Instagram Graph API Mock
    if (urlStr.includes('graph.facebook.com') && urlStr.includes('fields=like_count,comments_count')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          like_count: 5400,
          comments_count: 290,
          media_type: 'VIDEO',
        }),
      } as any;
    }

    if (urlStr.includes('graph.facebook.com') && urlStr.includes('/insights')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: [
            { name: 'plays', values: [{ value: 92400 }] },
            { name: 'reach', values: [{ value: 78000 }] },
            { name: 'likes', values: [{ value: 5400 }] },
            { name: 'comments', values: [{ value: 290 }] },
            { name: 'shares', values: [{ value: 180 }] },
          ],
        }),
      } as any;
    }

    // 4. Facebook Graph API Video Mock
    if (urlStr.includes('graph.facebook.com') && urlStr.includes('fields=views,likes.summary')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          id: 'fb-vid-55555',
          views: 43100,
          likes: { summary: { total_count: 2200 } },
          comments: { summary: { total_count: 110 } },
          shares: { count: 85 },
        }),
      } as any;
    }

    // Fallback original fetch
    if (originalFetch) {
      return originalFetch(url, init);
    }
    throw new Error(`Unhandled mock fetch URL: ${urlStr}`);
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: Platform Adapter Metric Extraction
    // -------------------------------------------------------------
    console.log('=== TEST 1: Platform Analytics Adapters Metric Extraction ===');

    // 1.1 YouTube Adapter
    const ytAdapter = new YouTubeAnalyticsAdapter();
    const ytMetrics = await ytAdapter.fetchMetrics({
      externalPostId: 'yt-vid-12345',
      accessToken: 'mock_yt_token',
    });
    if (ytMetrics.views !== 154200 || ytMetrics.likes !== 8900 || ytMetrics.comments !== 450) {
      throw new Error(`YouTube metrics mismatch: ${JSON.stringify(ytMetrics)}`);
    }
    console.log('✔ YouTube Analytics Adapter: Successfully parsed 154,200 views & 8,900 likes');

    // 1.2 TikTok Adapter
    const ttAdapter = new TikTokAnalyticsAdapter();
    const ttMetrics = await ttAdapter.fetchMetrics({
      externalPostId: 'tt-vid-98765',
      accessToken: 'mock_tt_token',
    });
    if (ttMetrics.views !== 85200 || ttMetrics.likes !== 6700 || ttMetrics.shares !== 145) {
      throw new Error(`TikTok metrics mismatch: ${JSON.stringify(ttMetrics)}`);
    }
    console.log('✔ TikTok Analytics Adapter: Successfully parsed 85,200 views & 145 shares');

    // 1.3 Instagram Adapter
    const igAdapter = new InstagramAnalyticsAdapter();
    const igMetrics = await igAdapter.fetchMetrics({
      externalPostId: 'ig-reel-11111',
      accessToken: 'mock_ig_token',
    });
    if (igMetrics.views !== 92400 || igMetrics.likes !== 5400 || igMetrics.shares !== 180) {
      throw new Error(`Instagram metrics mismatch: ${JSON.stringify(igMetrics)}`);
    }
    console.log('✔ Instagram Analytics Adapter: Successfully parsed 92,400 Reels plays & 5,400 likes');

    // 1.4 Facebook Adapter
    const fbAdapter = new FacebookAnalyticsAdapter();
    const fbMetrics = await fbAdapter.fetchMetrics({
      externalPostId: 'fb-vid-55555',
      accessToken: 'mock_fb_token',
    });
    if (fbMetrics.views !== 43100 || fbMetrics.likes !== 2200 || fbMetrics.shares !== 85) {
      throw new Error(`Facebook Analytics Adapter: ${JSON.stringify(fbMetrics)}`);
    }
    console.log('✔ Facebook Analytics Adapter: Successfully parsed 43,100 views & 2,200 likes');

    // -------------------------------------------------------------
    // TEST 2: Unauthenticated Endpoint Call Rejection (401)
    // -------------------------------------------------------------
    console.log('\n=== TEST 2: Security & Unauthenticated Request Rejection ===');
    const reqUnauth = {
      method: 'POST',
      body: { publishingJobId: 'job-any' },
    };
    const resUnauth = createMockRes();
    await syncHandler(reqUnauth, resUnauth);
    if (resUnauth.getStatusCode() !== 401) {
      throw new Error(`Expected 401 on unauthenticated sync call, got ${resUnauth.getStatusCode()}`);
    }
    console.log('✔ POST /api/analytics/sync correctly rejected unauthenticated request (401)');

    // -------------------------------------------------------------
    // TEST 3: Cross-User Ownership Enforcement (403)
    // -------------------------------------------------------------
    console.log('\n=== TEST 3: Multi-Tenant Isolation & Cross-User Rejection ===');
    const userA = 'user-creator-alice-111';
    const userB = 'user-creator-bob-222';
    const publishedJobId = 'job-published-alice-001';

    const publishedJobAlice: PublishJobRecord = {
      id: publishedJobId,
      user_id: userA,
      platform: 'youtube',
      target_format: '16:9',
      title: 'Alice AI Film',
      hashtags: ['FilmAI'],
      media_url: 'https://storage.googleapis.com/test.mp4',
      status: 'published',
      external_publish_id: 'yt-vid-12345',
      published_video_url: 'https://youtube.com/watch?v=yt-vid-12345',
      progress_percentage: 100,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    _setMemoryJob(publishedJobAlice);

    let crossUserBlocked = false;
    try {
      await AnalyticsService.syncJobAnalytics({
        publishingJobId: publishedJobId,
        userId: userB, // Bob attempting to sync Alice's job
        mockAccessToken: 'mock_token',
      });
    } catch (err: any) {
      crossUserBlocked = true;
      console.log('✔ Cross-user sync attempt blocked:', err.message);
    }
    if (!crossUserBlocked) {
      throw new Error('SECURITY VIOLATION: User B was able to sync User A job analytics!');
    }

    // -------------------------------------------------------------
    // TEST 4: Job State Invariant (Reject Non-Published Jobs)
    // -------------------------------------------------------------
    console.log('\n=== TEST 4: State Invariant Guard (Only Published Jobs Synced) ===');
    const queuedJobId = 'job-queued-002';
    const queuedJob: PublishJobRecord = {
      id: queuedJobId,
      user_id: userA,
      platform: 'youtube',
      target_format: '16:9',
      title: 'Queued Film',
      hashtags: [],
      media_url: 'https://storage.googleapis.com/test.mp4',
      status: 'queued', // Not yet published!
      progress_percentage: 0,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    _setMemoryJob(queuedJob);

    let invalidStateCaught = false;
    try {
      await AnalyticsService.syncJobAnalytics({
        publishingJobId: queuedJobId,
        userId: userA,
        mockAccessToken: 'mock_token',
      });
    } catch (err: any) {
      invalidStateCaught = true;
      console.log('✔ Non-published job sync correctly rejected:', err.message);
    }
    if (!invalidStateCaught) {
      throw new Error('FAILED: Queued job was erroneously allowed to sync analytics!');
    }

    // -------------------------------------------------------------
    // TEST 5: Snapshot Persistence & Real Metric Persistence
    // -------------------------------------------------------------
    console.log('\n=== TEST 5: Snapshot Creation & Persistence ===');
    _clearMemorySnapshots();

    const snapshot = await AnalyticsService.syncJobAnalytics({
      publishingJobId: publishedJobId,
      userId: userA,
      syncSource: 'manual_refresh',
      mockAccessToken: 'mock_token',
    });

    if (!snapshot || snapshot.views !== 154200) {
      throw new Error(`Snapshot views mismatch: ${snapshot?.views}`);
    }
    if (snapshot.publishing_job_id !== publishedJobId || snapshot.platform !== 'youtube') {
      throw new Error(`Snapshot job metadata mismatch: ${JSON.stringify(snapshot)}`);
    }

    const savedSnapshots = _getMemorySnapshots(publishedJobId);
    if (savedSnapshots.length === 0) {
      throw new Error('Snapshot was not stored in snapshots storage');
    }
    console.log(`✔ Snapshot successfully persisted: ${snapshot.views.toLocaleString('id-ID')} views recorded at ${snapshot.synced_at}`);

    // -------------------------------------------------------------
    // TEST 6: Background Sync Worker Guard (CRON_SECRET)
    // -------------------------------------------------------------
    console.log('\n=== TEST 6: Background Sync Worker Authorization ===');
    process.env.CRON_SECRET = 'amf_super_secret_cron_token_2026';

    // 6.1 Invalid Secret Rejection
    const workerReqBad = {
      method: 'POST',
      headers: { authorization: 'Bearer wrong_token' },
    };
    const workerResBad = createMockRes();
    await syncWorkerHandler(workerReqBad, workerResBad);
    if (workerResBad.getStatusCode() !== 401) {
      throw new Error(`Expected 401 on bad worker secret, got ${workerResBad.getStatusCode()}`);
    }
    console.log('✔ POST /api/analytics/sync-worker rejected invalid secret (401)');

    // 6.2 Valid Secret Authorized (POST)
    const workerReqGood = {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    };
    const workerResGood = createMockRes();
    await syncWorkerHandler(workerReqGood, workerResGood);
    if (workerResGood.getStatusCode() !== 200) {
      throw new Error(`Expected 200 on authorized worker call, got ${workerResGood.getStatusCode()}`);
    }
    console.log('✔ POST /api/analytics/sync-worker authorized with CRON_SECRET (200 OK)');

    // 6.3 Vercel Cron GET Request Compatibility Verification
    const workerReqVercelGet = {
      method: 'GET',
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    };
    const workerResVercelGet = createMockRes();
    await syncWorkerHandler(workerReqVercelGet, workerResVercelGet);
    if (workerResVercelGet.getStatusCode() !== 200) {
      throw new Error(`Expected 200 on Vercel Cron GET request, got ${workerResVercelGet.getStatusCode()}`);
    }
    console.log('✔ GET /api/analytics/sync-worker (Vercel Cron) successfully accepted & authorized (200 OK)');

    // -------------------------------------------------------------
    // TEST 7: Honest Data Integrity (Unavailable vs Zero Distinction)
    // -------------------------------------------------------------
    console.log('\n=== TEST 7: Data Integrity & Unavailable vs Zero Distinction ===');
    if (ttMetrics.watchTimeSeconds !== null || ttMetrics.avgViewDurationSeconds !== null) {
      throw new Error('TikTok watch time must be null (unavailable), not 0');
    }
    console.log('✔ TikTok adapter strictly reports watch time as unavailable (null), preventing fabricated metrics');

    console.log('\n================================================================');
    console.log('ALL T9.5 LIVE ANALYTICS VERIFICATION TESTS PASSED SUCCESSFULLY! ✔');
    console.log('================================================================');
  } finally {
    global.fetch = originalFetch;
  }
}

runAnalyticsSyncTests().catch((err) => {
  console.error('\n❌ T9.5 ANALYTICS TEST RUN FAILED:', err);
  process.exit(1);
});
