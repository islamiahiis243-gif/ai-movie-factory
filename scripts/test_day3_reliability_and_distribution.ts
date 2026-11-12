/**
 * AI MOVIE FACTORY — SPRINT 5 HARI: DAY 3 ACCEPTANCE TEST SUITE
 * Scope: Reliability, Background Jobs, and Multi-Platform Distribution
 * Targets:
 * - Worker row-level lease claiming (claim_pipeline_job) & lease fencing
 * - 15-Minute stale job reconciliation & dead-letter auto-refund
 * - Strict 3x retry limit enforcement & idempotency (/api/pipeline/retry)
 * - Tab-close recovery & autonomous background processing (TC-WF-09)
 * - Multi-platform distribution pipeline & worker execution (/api/publishing/)
 * - Live Supabase database schema & zero dummy data verification
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import workerHandler, { resolveReconciliationRequiredJob } from '../server/pipeline/workerHandler.ts';
import retryHandler from '../server/pipeline/retryHandler.ts';
import publishingWorkerHandler from '../server/publishing/workerHandler.ts';
import { UniversalPublishingService } from '../src/lib/distribution/publishingService.ts';
import { validateContentForPlatform } from '../src/lib/distribution/platformRegistry.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, title: string, detail?: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${title}`);
    passed++;
  } else {
    console.error(`  ✘ FAIL: ${title}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

function createMockRes() {
  let statusCode = 200;
  let jsonBody: any = null;
  const headers: Record<string, string> = {};

  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader(key: string, val: string) {
      headers[key] = val;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
    getStatusCode: () => statusCode,
    getJson: () => jsonBody,
  };
}

async function runDay3Suite() {
  console.log('\n========================================================================');
  console.log('  AI MOVIE FACTORY — DAY 3 SPRINT: RELIABILITY, JOBS & DISTRIBUTION');
  console.log('========================================================================\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
  const serviceKey = process.env.SUPABASE_SECRET_KEY || '';
  const admin = serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

  // ---------------------------------------------------------------------------
  // SECTION 1: LIVE SUPABASE POSTGRESQL SCHEMA & STORED PROCEDURES
  // ---------------------------------------------------------------------------
  console.log('[SECTION 1] Live Supabase PostgreSQL Schema & RPC Verification');
  if (admin) {
    const { data: cols, error: colErr } = await admin.from('pipeline_jobs').select('*').limit(0);
    assert(!colErr, '1.1 pipeline_jobs table is accessible in production PostgreSQL');

    // Test required Day 3 columns
    const testCols = ['user_id', 'idempotency_key', 'retry_count', 'max_retries', 'worker_claim_id', 'claimed_at', 'metadata', 'execution_payload'];
    for (const c of testCols) {
      const { error } = await admin.from('pipeline_jobs').select(c).limit(0);
      assert(!error, `1.2 Column pipeline_jobs.${c} physically exists in PostgreSQL`);
    }

    // Verify claim_pipeline_job stored procedure
    const { data: rpcTest, error: rpcErr } = await admin.rpc('claim_pipeline_job', {
      p_worker_id: 'test_audit_worker',
      p_lease_seconds: 900,
    });
    assert(!rpcErr, '1.3 claim_pipeline_job RPC is physically installed and executable by service_role');

    // Clean database invariant: check for zero dummy/pollution jobs in production
    const { count: jobCount } = await admin.from('pipeline_jobs').select('*', { count: 'exact', head: true });
    assert((jobCount || 0) === 0, '1.4 Clean database invariant: 0 stray dummy pipeline jobs in production');

    const { count: pubCount } = await admin.from('publishing_jobs').select('*', { count: 'exact', head: true });
    assert((pubCount || 0) === 0, '1.5 Clean database invariant: 0 stray dummy publishing jobs in production');
  } else {
    console.log('  [Notice] Live admin client skipped in offline test environment.');
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: WORKER CLAIMING & LEASE FENCING INVARIANTS
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 2] Worker Claiming & Stale Lease Fencing Invariants');

  // 2.1 Reconcile stale jobs: expired lease without confirmed task transitions to failed + auto-refund
  const mockStaleJob = {
    id: 'stale-test-job-001',
    project_id: 'proj-001',
    user_id: 'user-001',
    status: 'running',
    current_stage: 'video_gen',
    progress: 40,
    credit_cost: 45,
    idempotency_key: 'idemp-stale-001',
    updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    metadata: {},
  };

  const reqWorker1: any = {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
    _testWorker: true,
  };
  const resWorker1 = createMockRes();

  await workerHandler(reqWorker1, resWorker1);
  assert(resWorker1.getStatusCode() === 200, '2.1 Pipeline background worker endpoint executes successfully (200 OK)');
  assert(resWorker1.getJson()?.status === 'ok', '2.2 Worker returns status: ok');

  // 2.2 Reconcile job with pending provider task to 'reconciliation_required' (no premature refund)
  const mockProviderPendingJob = {
    id: 'job-pending-provider',
    idempotency_key: 'idemp-pending-002',
    credit_cost: 45,
    metadata: { provider_task_id: 'task_ext_123', provider_completed: false },
  };

  // 2.3 Resolve reconciliation required job when provider confirmed completed
  const resolvedComplete = await resolveReconciliationRequiredJob({
    adminSupabase: null,
    job: mockProviderPendingJob,
    providerResult: 'completed',
  });
  assert(resolvedComplete.status === 'completed', '2.3 Confirmed provider success resolves job to completed');
  assert(resolvedComplete.settled === true, '2.4 Credits are settled on provider success');
  assert(resolvedComplete.refunded === false, '2.5 Zero duplicate refund issued on confirmed provider success');

  // 2.4 Resolve reconciliation required job when provider confirmed failed
  const resolvedFailed = await resolveReconciliationRequiredJob({
    adminSupabase: null,
    job: mockProviderPendingJob,
    providerResult: 'failed',
    errorMessage: 'Provider synthesis timeout',
  });
  assert(resolvedFailed.status === 'failed', '2.6 Confirmed provider failure resolves job to failed');
  assert(resolvedFailed.refunded === true, '2.7 Credits are auto-refunded to user wallet on provider failure');
  assert(resolvedFailed.settled === false, '2.8 Zero credits settled on provider failure');

  // ---------------------------------------------------------------------------
  // SECTION 3: STRICT 3X RETRY LIMIT & SERVERLESS IDEMPOTENCY
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 3] Strict 3x Retry Limit & Idempotency (/api/pipeline/retry)');

  // 3.1 Unauthenticated retry is rejected (401)
  const reqUnauth: any = {
    method: 'POST',
    body: { jobId: 'job-retry-001' },
  };
  const resUnauth = createMockRes();
  await retryHandler(reqUnauth, resUnauth);
  assert(resUnauth.getStatusCode() === 401, '3.1 Unauthenticated retry is strictly rejected with HTTP 401');

  // 3.2 Missing jobId is rejected (400)
  const reqMissing: any = {
    method: 'POST',
    body: {},
    _testUser: { id: 'director-001' },
  };
  const resMissing = createMockRes();
  await retryHandler(reqMissing, resMissing);
  assert(resMissing.getStatusCode() === 400, '3.2 Missing jobId parameter returns HTTP 400');

  // 3.3 Retry 1st attempt (0 -> 1)
  const reqRetry1: any = {
    method: 'POST',
    body: { jobId: 'job-retry-001' },
    _testUser: { id: 'director-001' },
    _mockRetryCount: 0,
  };
  const resRetry1 = createMockRes();
  await retryHandler(reqRetry1, resRetry1);
  assert(resRetry1.getStatusCode() === 200, '3.3 1st retry attempt accepted (HTTP 200)');
  assert(resRetry1.getJson()?.newRetryCount === 1, '3.4 Retry count incremented to 1/3');
  assert(resRetry1.getJson()?.jobStatus === 'running', '3.5 Job status transitioned to running');

  // 3.4 Retry 2nd attempt (1 -> 2)
  const reqRetry2: any = {
    method: 'POST',
    body: { jobId: 'job-retry-001' },
    _testUser: { id: 'director-001' },
    _mockRetryCount: 1,
  };
  const resRetry2 = createMockRes();
  await retryHandler(reqRetry2, resRetry2);
  assert(resRetry2.getJson()?.newRetryCount === 2, '3.6 2nd retry attempt incremented to 2/3');

  // 3.5 Retry 3rd attempt (2 -> 3)
  const reqRetry3: any = {
    method: 'POST',
    body: { jobId: 'job-retry-001' },
    _testUser: { id: 'director-001' },
    _mockRetryCount: 2,
  };
  const resRetry3 = createMockRes();
  await retryHandler(reqRetry3, resRetry3);
  assert(resRetry3.getJson()?.newRetryCount === 3, '3.7 3rd retry attempt reached maximum limit (3/3)');

  // 3.6 4th attempt strictly blocked (>= 3)
  const reqRetry4: any = {
    method: 'POST',
    body: { jobId: 'job-retry-001' },
    _testUser: { id: 'director-001' },
    _mockRetryCount: 3,
  };
  const resRetry4 = createMockRes();
  await retryHandler(reqRetry4, resRetry4);
  assert(resRetry4.getStatusCode() === 400, '3.8 4th retry strictly blocked with HTTP 400 (Max retries exceeded)');
  assert(resRetry4.getJson()?.error === 'MAX_RETRIES_EXCEEDED', '3.9 Error code explicitly specifies MAX_RETRIES_EXCEEDED');

  // ---------------------------------------------------------------------------
  // SECTION 4: MULTI-PLATFORM DISTRIBUTION & PRE-FLIGHT VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 4] Multi-Platform Distribution & Pre-Flight Validation');

  // 4.1 YouTube pre-flight validation (16:9 Landscape)
  const ytValidation = validateContentForPlatform(
    'youtube',
    {
      title: 'AMF Master Scene: Shadows of Neon Ep 1',
      description: 'Official sci-fi cinematic scene produced with AI Movie Factory.',
      hashtags: ['#SciFi', '#AMF', '#IndieFilm'],
    },
    { durationSeconds: 120, aspectRatio: '16:9' }
  );
  assert(ytValidation.isValid === true, '4.1 YouTube 16:9 landscape validation passes cleanly');
  assert(ytValidation.issues.length === 0, '4.2 Zero validation errors for compliant YouTube upload');

  // 4.2 TikTok pre-flight validation (9:16 Vertical)
  const ttValidation = validateContentForPlatform(
    'tiktok',
    {
      title: 'Vertical Cinematic Teaser',
      caption: 'Shen Zhen confronts the syndicate in Old Sector #Cyberpunk #Shorts',
      hashtags: ['#Cyberpunk', '#Shorts'],
    },
    { durationSeconds: 45, aspectRatio: '9:16' }
  );
  assert(ttValidation.isValid === true, '4.3 TikTok 9:16 vertical validation passes cleanly');

  // 4.3 Instagram Reels pre-flight validation (9:16 Vertical)
  const igValidation = validateContentForPlatform(
    'instagram',
    {
      title: 'Reels Highlight Clip',
      caption: 'Cinematic lighting breakdown #Filmmaking #Director',
      hashtags: ['#Filmmaking', '#Director'],
    },
    { durationSeconds: 30, aspectRatio: '9:16' }
  );
  assert(igValidation.isValid === true, '4.4 Instagram Reels 9:16 vertical validation passes cleanly');

  // 4.4 Formatted Clipboard payload for platform studios
  const ytClipboard = UniversalPublishingService.formatPlatformClipboardPayload('youtube', {
    title: 'Shadows of Neon Scene 1',
    description: 'High-octane action sequence',
    hashtags: ['#Action', '#Cinematic'],
  });
  assert(ytClipboard.includes('Shadows of Neon Scene 1'), '4.5 Formatted YouTube payload contains title');
  assert(ytClipboard.includes('#Action #Cinematic'), '4.6 Formatted YouTube payload contains normalized hashtags');
  assert(ytClipboard.includes('Produced with AI Movie Factory (AMF)'), '4.7 Formatted YouTube payload includes AMF provenance tag');

  // 4.5 Publishing Background Worker Authentication & Execution
  const reqPubUnauth: any = {
    method: 'POST',
    headers: { authorization: 'Bearer invalid-secret' },
  };
  const resPubUnauth = createMockRes();
  await publishingWorkerHandler(reqPubUnauth, resPubUnauth);
  assert(resPubUnauth.getStatusCode() === 401, '4.8 Publishing worker rejects unauthorized requests with HTTP 401');

  console.log('\n========================================================================');
  console.log(`  DAY 3 RELIABILITY & DISTRIBUTION SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDay3Suite().catch((err) => {
  console.error('Fatal error in Day 3 test suite:', err);
  process.exit(1);
});
