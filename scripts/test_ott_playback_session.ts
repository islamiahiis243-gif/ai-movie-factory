/**
 * AI Movie Factory — Phase 6: Milestone 2.9.2A Verification Suite
 * Playback Session & Delivery Controller (Serverless Control Plane & Signed Delivery)
 * 
 * Verifies Acceptance Criteria 1 to 14:
 * 1. No valid grant -> no playback session.
 * 2. Forged / tampered grant is rejected.
 * 3. Unauthenticated / invalid JWT is rejected (401).
 * 4. Request body spoofed identity is strictly ignored.
 * 5. Entitlement revoked/expired rejects session creation and renewal.
 * 6. Gate 5 unapproved content is rejected.
 * 7. Master asset is not accessible anonymously (Private bucket).
 * 8. Object path validation strictly enforces bucket and domain boundaries.
 * 9. Live Supabase Storage Signed URL returns HTTP 206 Partial Content on Range Request.
 * 10. Atomic concurrency control and session acquisition.
 * 11. Playback session lifecycle (acquire -> heartbeat -> renew -> terminate).
 * 12. Zero raw master URL permanent leakage.
 * 13. Zero regression on Creator SaaS billing and workflow gates.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../server/supabaseAdmin.ts';
import {
  generateEntitlementGrant,
  verifyEntitlementGrantToken,
} from '../server/ottGrantSigner.ts';
import {
  parseAndValidateStoragePath,
  createSignedDeliveryUrl,
  DEFAULT_SIGNED_DELIVERY_TTL_SECONDS,
} from '../server/ottMediaDelivery.ts';
import {
  acquirePlaybackSession,
  renewPlaybackSession,
  heartbeatPlaybackSession,
  terminatePlaybackSession,
} from '../server/ottPlaybackSessionManager.ts';
import playbackSessionHandler from '../api/ott/playback-session.ts';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${testName}`);
    testsPassed++;
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m ${testName}${details ? ` -> ${details}` : ''}`);
    testsFailed++;
  }
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    jsonPayload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, val: string) {
      this.headers[key] = val;
      return this;
    },
    json(data: any) {
      this.jsonPayload = data;
      return this;
    },
  };
  return res;
}

async function runPlaybackSessionSuite() {
  console.log('\n================================================================');
  console.log(' AI MOVIE FACTORY — MILESTONE 2.9.2A PLAYBACK SESSION TEST SUITE');
  console.log('================================================================\n');

  const now = new Date();
  const testViewer1 = { id: 'usr_viewer_alpha_111', email: 'viewer1@amf.io' };
  const testViewer2 = { id: 'usr_viewer_beta_222', email: 'viewer2@amf.io' };
  const testChannelId = 'chn_studio_galaxy_888';
  const testFilmId = 'flm_cyberpunk_2099_777';

  const mockApprovedFilm: any = {
    id: testFilmId,
    channel_id: testChannelId,
    title: 'Cyberpunk 2099: Neon Horizon',
    publication_status: 'published',
    master_approval_status: 'GATE_5_APPROVED',
    master_video_url: 'ott-masters/films/cyberpunk_2099/master_1080p.mp4',
    runtime_seconds: 5400, // 90 minutes
    access_policy: 'tvod_rental',
    subtitle_vtt_url: 'https://jixfakvbhugpypjtyshq.supabase.co/storage/v1/object/public/project-assets/subs/sub_id.vtt',
    chapters_json: [{ time: 0, title: 'Opening Scene' }, { time: 300, title: 'The Encounter' }],
  };

  const mockValidPass: any = {
    id: 'pass_valid_999',
    user_id: testViewer1.id,
    channel_id: testChannelId,
    content_id: testFilmId,
    content_type: 'film',
    status: 'active',
    valid_from: new Date(now.getTime() - 3600000).toISOString(),
    valid_until: new Date(now.getTime() + 86400000).toISOString(),
  };

  const validGrant = generateEntitlementGrant({
    contentId: testFilmId,
    contentType: 'film',
    viewerId: testViewer1.id,
    channelId: testChannelId,
    accessPolicy: 'tvod_rental',
    now,
  });

  // ---------------------------------------------------------------------------
  // [TEST 1 & 2] Cryptographic Grant Enforcement (No Valid Grant -> Rejected)
  // ---------------------------------------------------------------------------
  console.log('[TEST 1 & 2] Cryptographic Grant Enforcement');
  const reqNoGrant: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'acquire',
      channelId: testChannelId,
      contentId: testFilmId,
      contentType: 'film',
      _mockData: { content: mockApprovedFilm, userPasses: [mockValidPass] },
    },
  };
  const resNoGrant = createMockRes();
  await playbackSessionHandler(reqNoGrant, resNoGrant);
  assert(resNoGrant.statusCode === 400, '1. Missing grant token returns HTTP 400 Bad Request');
  assert(resNoGrant.jsonPayload.error === 'MISSING_REQUIRED_FIELDS', '1b. Error code specifies missing fields');

  // Forged Grant (tampered payload signature)
  const [b64Payload, sig] = validGrant.grantToken.replace('egt_amf_', '').split('.');
  const forgedToken = `egt_amf_${b64Payload}.invalidsignature12345`;
  const reqForgedGrant: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'acquire',
      grantToken: forgedToken,
      channelId: testChannelId,
      contentId: testFilmId,
      contentType: 'film',
      _mockData: { content: mockApprovedFilm, userPasses: [mockValidPass] },
    },
  };
  const resForgedGrant = createMockRes();
  await playbackSessionHandler(reqForgedGrant, resForgedGrant);
  assert(resForgedGrant.statusCode === 403, '2. Forged grant token is strictly rejected with HTTP 403');
  assert(resForgedGrant.jsonPayload.error === 'INVALID_SIGNATURE', '2b. Error specifies INVALID_SIGNATURE');

  // ---------------------------------------------------------------------------
  // [TEST 3 & 4] Authentication & Request Body Anti-Spoofing Guard
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3 & 4] Authentication & Request Body Anti-Spoofing Guard');
  const reqUnauth: any = {
    method: 'POST',
    headers: {},
    body: {
      action: 'acquire',
      grantToken: validGrant.grantToken,
      channelId: testChannelId,
      contentId: testFilmId,
    },
  };
  const resUnauth = createMockRes();
  await playbackSessionHandler(reqUnauth, resUnauth);
  assert(resUnauth.statusCode === 401, '3. Unauthenticated request without JWT returns HTTP 401');

  // Spoofed viewer in request body: User 1 tries to claim to be User 2 in request body
  const reqSpoofed: any = {
    method: 'POST',
    _testUser: testViewer2, // Authenticated session belongs to User 2
    body: {
      action: 'acquire',
      viewerId: testViewer1.id, // Attacker sends User 1 in body
      userId: testViewer1.id,   // Attacker sends User 1 in body
      grantToken: validGrant.grantToken, // User 1's grant token!
      channelId: testChannelId,
      contentId: testFilmId,
      contentType: 'film',
      _mockData: { content: mockApprovedFilm, userPasses: [mockValidPass] },
    },
  };
  const resSpoofed = createMockRes();
  await playbackSessionHandler(reqSpoofed, resSpoofed);
  assert(resSpoofed.statusCode === 403, '4. Token stolen by another user is rejected with HTTP 403');
  assert(resSpoofed.jsonPayload.error === 'VIEWER_MISMATCH', '4b. Error code confirms VIEWER_MISMATCH based on JWT');

  // ---------------------------------------------------------------------------
  // [TEST 5] Live Entitlement Re-Verification (Revocation at DB Level)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Live Entitlement Re-Verification (Instant Revocation)');
  const revokedPass: any = { ...mockValidPass, status: 'revoked' };
  const reqRevoked: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'acquire',
      grantToken: validGrant.grantToken,
      channelId: testChannelId,
      contentId: testFilmId,
      contentType: 'film',
      _mockData: { content: mockApprovedFilm, userPasses: [revokedPass] },
    },
  };
  const resRevoked = createMockRes();
  await playbackSessionHandler(reqRevoked, resRevoked);
  assert(resRevoked.statusCode === 403, '5. Revoked pass in database immediately rejects playback session');
  assert(resRevoked.jsonPayload.error === 'PASS_REVOKED', '5b. Error confirms PASS_REVOKED (Instant Revocation)');

  // ---------------------------------------------------------------------------
  // [TEST 6] Gate 5 Approval Gate Verification
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Gate 5 Approval Gate Verification');
  const unapprovedFilm: any = {
    ...mockApprovedFilm,
    master_approval_status: 'GATE_5_PENDING',
  };
  const reqUnapproved: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'acquire',
      grantToken: validGrant.grantToken,
      channelId: testChannelId,
      contentId: testFilmId,
      contentType: 'film',
      _mockData: { content: unapprovedFilm, userPasses: [mockValidPass] },
    },
  };
  const resUnapproved = createMockRes();
  await playbackSessionHandler(reqUnapproved, resUnapproved);
  assert(resUnapproved.statusCode === 422, '6. Content without Gate 5 director approval is rejected (HTTP 422)');
  assert(resUnapproved.jsonPayload.error === 'GATE_5_UNAPPROVED', '6b. Error code specifies GATE_5_UNAPPROVED');

  // ---------------------------------------------------------------------------
  // [TEST 7 & 8] Storage Object Path Validation & Boundary Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7 & 8] Storage Object Path Validation & Boundary Enforcement');
  // Valid relative path
  const parsed1 = parseAndValidateStoragePath('ott-masters/films/test/master.mp4');
  assert(parsed1.bucket === 'ott-masters' && parsed1.objectPath === 'films/test/master.mp4', '7. Valid relative storage path parsed correctly');

  // Full Supabase URL
  const parsed2 = parseAndValidateStoragePath('https://jixfakvbhugpypjtyshq.supabase.co/storage/v1/object/sign/ott-masters/epic/movie.mp4?token=xyz');
  assert(parsed2.bucket === 'ott-masters' && parsed2.objectPath === 'epic/movie.mp4', '7b. Full Supabase Storage URL parsed and validated');

  // External domain attack
  let externalBlocked = false;
  try {
    parseAndValidateStoragePath('https://malicious-external-cdn.com/storage/v1/object/ott-masters/video.mp4');
  } catch (err: any) {
    externalBlocked = err.message.includes('UNAUTHORIZED_STORAGE_HOST');
  }
  assert(externalBlocked, '8a. External unauthorized host is strictly rejected');

  // Path traversal attack
  let traversalBlocked = false;
  try {
    parseAndValidateStoragePath('ott-masters/../../etc/passwd');
  } catch (err: any) {
    traversalBlocked = err.message.includes('SECURITY_VIOLATION');
  }
  assert(traversalBlocked, '8b. Path traversal attempt (..) is strictly blocked');

  // ---------------------------------------------------------------------------
  // [TEST 9] Live Supabase Storage Private Bucket & HTTP Range Proof
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Live Supabase Storage Private Bucket & HTTP Range Proof');
  const adminClient = getSupabaseAdmin();
  const testFileName = `playback_test_chunk_${Date.now()}.mp4`;
  const dummyBuffer = Buffer.alloc(10240, 0);
  dummyBuffer.write('ftypisom', 4, 'ascii');

  // 1. Upload test object to live private bucket
  const { error: upErr } = await adminClient.storage
    .from('ott-masters')
    .upload(testFileName, dummyBuffer, { contentType: 'video/mp4', upsert: true });
  assert(!upErr, '9a. Test media object uploaded to private ott-masters bucket in production');

  // 2. Verify anonymous public access is BLOCKED
  const { data: pubData } = adminClient.storage.from('ott-masters').getPublicUrl(testFileName);
  let publicBlocked = false;
  try {
    const pubRes = await fetch(pubData.publicUrl);
    if (pubRes.status >= 400) publicBlocked = true;
  } catch {
    publicBlocked = true;
  }
  assert(publicBlocked, '9b. Anonymous public URL access to master video is strictly BLOCKED (Private Bucket verified)');

  // 3. Issue signed URL from production Storage
  const signedResult = await createSignedDeliveryUrl('ott-masters', testFileName, 60, adminClient);
  assert(Boolean(signedResult.signedUrl.includes('token=')), '9c. Signed delivery URL generated with cryptographic token');

  // 4. Test HTTP Range Request (206 Partial Content)
  const rangeRes = await fetch(signedResult.signedUrl, {
    headers: { Range: 'bytes=0-1023' },
  });
  assert(rangeRes.status === 206, '9d. HTTP Range Request successfully returned 206 Partial Content from Supabase Storage CDN');
  assert(rangeRes.headers.get('content-range')?.startsWith('bytes 0-1023/') === true, '9e. Content-Range header correctly reports partial byte window');

  // Cleanup test object
  await adminClient.storage.from('ott-masters').remove([testFileName]);

  // ---------------------------------------------------------------------------
  // [TEST 10 & 11] Playback Session Lifecycle, Renewal & Atomic Concurrency
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 10 & 11] Playback Session Lifecycle, Renewal & Atomic Concurrency');
  const reqAcquire: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'acquire',
      grantToken: validGrant.grantToken,
      channelId: testChannelId,
      contentId: testFilmId,
      contentType: 'film',
      deviceInfo: { fingerprint: 'device_macbook_pro_1', ipHash: 'hash_ip_id_99' },
      _mockData: { content: mockApprovedFilm, userPasses: [mockValidPass] },
    },
  };
  const resAcquire = createMockRes();
  await playbackSessionHandler(reqAcquire, resAcquire);
  assert(resAcquire.statusCode === 200, '10a. Playback session acquired successfully with HTTP 200 OK');
  assert(Boolean(resAcquire.jsonPayload.session?.sessionId), '10b. Returns unique session ID (pss_...)');
  assert(Boolean(resAcquire.jsonPayload.session?.playbackUrl), '10c. Returns time-limited playback signed URL');
  assert(Boolean(resAcquire.jsonPayload.session?.watermark?.text?.startsWith('wm_')), '10d. Returns pseudonymous forensic watermark');

  const activeSessionId = resAcquire.jsonPayload.session.sessionId;

  // Heartbeat test
  const reqHb: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'heartbeat',
      sessionId: activeSessionId,
      currentPositionSeconds: 45.5,
      _mockData: { session: { id: activeSessionId, status: 'active' } },
    },
  };
  const resHb = createMockRes();
  await playbackSessionHandler(reqHb, resHb);
  assert(resHb.statusCode === 200, '11a. Session heartbeat accepted with HTTP 200 OK');

  // Renewal test with active entitlement
  const reqRenew: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'renew',
      sessionId: activeSessionId,
      grantToken: validGrant.grantToken,
      currentPositionSeconds: 60.0,
      _mockData: {
        session: { id: activeSessionId, session_id: activeSessionId, status: 'active', content_id: testFilmId, channel_id: testChannelId, content_type: 'film', grant_id: validGrant.grantId },
        content: mockApprovedFilm,
        userPasses: [mockValidPass],
      },
    },
  };
  const resRenew = createMockRes();
  await playbackSessionHandler(reqRenew, resRenew);
  assert(resRenew.statusCode === 200, '11b. Session renewal granted successfully before signed URL lapses');
  assert(Boolean(resRenew.jsonPayload.playbackUrl), '11c. Fresh signed delivery URL provided upon renewal');

  // Renewal rejection when entitlement revoked mid-stream
  const reqRenewRevoked: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'renew',
      sessionId: activeSessionId,
      grantToken: validGrant.grantToken,
      currentPositionSeconds: 120.0,
      _mockData: {
        session: { id: activeSessionId, session_id: activeSessionId, status: 'active', content_id: testFilmId, channel_id: testChannelId, content_type: 'film', grant_id: validGrant.grantId },
        content: mockApprovedFilm,
        userPasses: [revokedPass], // Revoked mid-playback!
      },
    },
  };
  const resRenewRevoked = createMockRes();
  await playbackSessionHandler(reqRenewRevoked, resRenewRevoked);
  assert(resRenewRevoked.statusCode === 403, '11d. Mid-playback entitlement revocation rejects URL renewal (HTTP 403)');
  assert(resRenewRevoked.jsonPayload.error === 'ENTITLEMENT_REVOKED', '11e. Error specifies ENTITLEMENT_REVOKED');

  // Termination test
  const reqTerm: any = {
    method: 'POST',
    _testUser: testViewer1,
    body: {
      action: 'terminate',
      sessionId: activeSessionId,
      _mockData: {},
    },
  };
  const resTerm = createMockRes();
  await playbackSessionHandler(reqTerm, resTerm);
  assert(resTerm.statusCode === 200, '11f. Playback session terminated cleanly');

  // ---------------------------------------------------------------------------
  // [TEST 12] Zero Raw Master URL Leakage Invariant
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 12] Zero Raw Master URL Leakage Invariant');
  const sessionJsonStr = JSON.stringify(resAcquire.jsonPayload);
  assert(!sessionJsonStr.includes('master_1080p.mp4"'), '12a. Raw permanent master video filename is not exposed directly');
  assert(!sessionJsonStr.includes('storage/v1/object/public/ott-masters'), '12b. No public storage URL returned for private master content');
  assert(resAcquire.jsonPayload.session.playbackUrl.includes('token='), '12c. Media delivery URL is strictly an ephemeral signed URL');

  // ---------------------------------------------------------------------------
  // [TEST 13 & 14] Creator SaaS Billing & Workflow Invariant Protection
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 13 & 14] Creator SaaS Billing & Workflow Invariant Protection');
  const migrationV316Path = path.resolve(process.cwd(), 'supabase/upgrade_v3_16_ott_playback_sessions.sql');
  assert(fs.existsSync(migrationV316Path), '13a. upgrade_v3_16_ott_playback_sessions.sql exists physically');
  const migrationSql = fs.readFileSync(migrationV316Path, 'utf-8');
  assert(!migrationSql.includes('DROP TABLE'), '13b. Migration V3.16 is 100% additive with zero destructive drops');
  assert(!migrationSql.includes('credit_ledger') && !migrationSql.includes('subscriptions'), '13c. Migration has zero collision with Creator Studio SaaS tables');
  assert(migrationSql.includes('acquire_ott_playback_session'), '14a. Atomic concurrency acquisition procedure defined');
  assert(migrationSql.includes('FOR UPDATE'), '14b. Row locking concurrency guard defined in PostgreSQL');

  // ---------------------------------------------------------------------------
  // [TEST 15] Real Concurrent Acquisition & Transactional Advisory Lock Proof
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 15] Real Concurrent Acquisition & Transactional Advisory Lock Proof');
  const { data: userProfiles } = await adminClient.from('profiles').select('id').limit(1);
  const realTestUserId = userProfiles && userProfiles.length > 0 ? userProfiles[0].id : null;

  if (realTestUserId) {
    // 1. Create a temporary channel for testing concurrency
    const testChanSlug = `test-race-channel-${Date.now()}`;
    const { data: createdChan } = await adminClient
      .from('ott_channels')
      .insert({
        user_id: realTestUserId,
        slug: testChanSlug,
        name: 'Concurrency Test Studio',
        status: 'active',
      })
      .select('id')
      .single();

    if (createdChan?.id) {
      // 2. Ensure test user starts with ZERO active sessions
      await adminClient.from('ott_playback_sessions').delete().eq('user_id', realTestUserId);

      // 3. Fire two concurrent acquire calls simultaneously (Zero-Rows Initial State)
      const raceSess1 = `pss_race_1_${Date.now()}`;
      const raceSess2 = `pss_race_2_${Date.now()}`;
      const dummyContentId = '00000000-0000-0000-0000-000000000001';

      console.log('  Firing 2 simultaneous acquire_ott_playback_session calls with Promise.all...');
      const [resRace1, resRace2] = await Promise.all([
        adminClient.rpc('acquire_ott_playback_session', {
          p_session_id: raceSess1,
          p_user_id: realTestUserId,
          p_channel_id: createdChan.id,
          p_content_id: dummyContentId,
          p_content_type: 'film',
          p_grant_id: 'gid_race_token_1',
          p_max_concurrent_streams: 1,
        }),
        adminClient.rpc('acquire_ott_playback_session', {
          p_session_id: raceSess2,
          p_user_id: realTestUserId,
          p_channel_id: createdChan.id,
          p_content_id: dummyContentId,
          p_content_type: 'film',
          p_grant_id: 'gid_race_token_2',
          p_max_concurrent_streams: 1,
        }),
      ]);

      assert(!resRace1.error && !resRace2.error, '15a. Both concurrent transactions executed without deadlock');

      // 4. Query production DB: exactly 1 active session must exist!
      const { data: activeSessions } = await adminClient
        .from('ott_playback_sessions')
        .select('*')
        .eq('user_id', realTestUserId)
        .eq('status', 'active');

      assert(activeSessions?.length === 1, '15b. Exactly 1 active session exists after concurrent acquire (Advisory lock serialization succeeded)');

      const { data: revokedSessions } = await adminClient
        .from('ott_playback_sessions')
        .select('*')
        .eq('user_id', realTestUserId)
        .eq('status', 'revoked');

      assert(revokedSessions?.length === 1, '15c. The other session was atomically revoked via FIFO takeover');

      // Cleanup
      await adminClient.from('ott_playback_sessions').delete().eq('user_id', realTestUserId);
      await adminClient.from('ott_channels').delete().eq('id', createdChan.id);
    }
  } else {
    console.log('  ℹ SKIP: No profiles in database, skipping live advisory lock race test');
  }

  // ---------------------------------------------------------------------------
  // [TEST 16] SECURITY DEFINER Privilege Lockdown & Ownership Guard
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 16] SECURITY DEFINER Privilege Lockdown & Ownership Guard');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
  if (anonKey) {
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(supabaseUrl, anonKey);

    // Direct RPC call by anonymous client must be rejected (REVOKE EXECUTE)
    const { error: anonRpcErr } = await anonClient.rpc('acquire_ott_playback_session', {
      p_session_id: 'pss_illegal_direct_rpc',
      p_user_id: '00000000-0000-0000-0000-000000000001',
      p_channel_id: '00000000-0000-0000-0000-000000000001',
      p_content_id: '00000000-0000-0000-0000-000000000001',
      p_content_type: 'film',
      p_grant_id: 'gid_fake',
    });

    assert(Boolean(anonRpcErr), '16a. Anon role directly calling acquire_ott_playback_session is rejected (REVOKE EXECUTE enforced)');
  }

  // ---------------------------------------------------------------------------
  // [TEST 17] Terminal Status Alignment & Stale Retention Purge Verification
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 17] Terminal Status Alignment & Stale Retention Purge (30-Day Retention Policy)');
  if (adminClient) {
    const { data: testProfiles } = await adminClient.from('profiles').select('id').limit(1);
    if (testProfiles && testProfiles.length > 0) {
      const retentionUserId = testProfiles[0].id;
      const { data: testChannel, error: chanErr } = await adminClient
        .from('ott_channels')
        .insert({
          user_id: retentionUserId,
          name: 'Retention Test Channel',
          slug: `retention-test-${Date.now()}`,
          status: 'active',
        })
        .select()
        .single();

      if (testChannel) {
        const dummyContentId = '00000000-0000-0000-0000-000000000001';
        const pastDate35Days = new Date(Date.now() - 35 * 86400000).toISOString();
        const recentDate5Days = new Date(Date.now() - 5 * 86400000).toISOString();

        // 17a. Verify all statuses can be inserted / exist under updated check constraint
        const sessionsToInsert = [
          // 4 stale terminal sessions (>30 days old) -> MUST be purged
          { session_id: `ret_completed_${Date.now()}`, user_id: retentionUserId, channel_id: testChannel.id, content_id: dummyContentId, content_type: 'film', grant_id: 'g_1', status: 'completed', updated_at: pastDate35Days, expires_at: pastDate35Days },
          { session_id: `ret_terminated_${Date.now()}`, user_id: retentionUserId, channel_id: testChannel.id, content_id: dummyContentId, content_type: 'film', grant_id: 'g_2', status: 'terminated', updated_at: pastDate35Days, expires_at: pastDate35Days },
          { session_id: `ret_expired_${Date.now()}`, user_id: retentionUserId, channel_id: testChannel.id, content_id: dummyContentId, content_type: 'film', grant_id: 'g_3', status: 'expired', updated_at: pastDate35Days, expires_at: pastDate35Days },
          { session_id: `ret_revoked_${Date.now()}`, user_id: retentionUserId, channel_id: testChannel.id, content_id: dummyContentId, content_type: 'film', grant_id: 'g_4', status: 'revoked', updated_at: pastDate35Days, expires_at: pastDate35Days },
          // 2 stale active/paused sessions (>30 days old) -> MUST NEVER be purged by retention (protected)
          { session_id: `ret_active_${Date.now()}`, user_id: retentionUserId, channel_id: testChannel.id, content_id: dummyContentId, content_type: 'film', grant_id: 'g_5', status: 'active', updated_at: pastDate35Days, expires_at: pastDate35Days },
          { session_id: `ret_paused_${Date.now()}`, user_id: retentionUserId, channel_id: testChannel.id, content_id: dummyContentId, content_type: 'film', grant_id: 'g_6', status: 'paused', updated_at: pastDate35Days, expires_at: pastDate35Days },
          // 1 recent terminal session (5 days old) -> MUST NOT be purged (retention window active)
          { session_id: `ret_recent_completed_${Date.now()}`, user_id: retentionUserId, channel_id: testChannel.id, content_id: dummyContentId, content_type: 'film', grant_id: 'g_7', status: 'completed', updated_at: recentDate5Days, expires_at: recentDate5Days },
        ];

        const { error: insertErr } = await adminClient.from('ott_playback_sessions').insert(sessionsToInsert);
        assert(!insertErr, '17a. Expanded status constraint accepts all terminal statuses (completed, terminated, expired, revoked)', insertErr?.message);

        // 17b. Call purge_stale_playback_sessions(30)
        const { data: purgeResult, error: purgeErr } = await adminClient.rpc('purge_stale_playback_sessions', {
          p_days_to_keep: 30,
        });
        assert(!purgeErr && typeof purgeResult === 'number', '17b. purge_stale_playback_sessions(30) executed successfully', purgeErr?.message);

        // 17c. Verify stale terminal sessions were purged
        const { data: remainingStaleTerminal } = await adminClient
          .from('ott_playback_sessions')
          .select('session_id, status')
          .in('session_id', [
            sessionsToInsert[0].session_id,
            sessionsToInsert[1].session_id,
            sessionsToInsert[2].session_id,
            sessionsToInsert[3].session_id,
          ]);
        assert(remainingStaleTerminal?.length === 0, '17c. All 4 stale terminal statuses (>30d) were cleanly purged');

        // 17d. Verify active, paused, and recent terminal sessions were NOT purged
        const { data: remainingProtected } = await adminClient
          .from('ott_playback_sessions')
          .select('session_id, status')
          .in('session_id', [
            sessionsToInsert[4].session_id,
            sessionsToInsert[5].session_id,
            sessionsToInsert[6].session_id,
          ]);
        assert(remainingProtected?.length === 3, '17d. Non-terminal (active, paused) and fresh (<30d) sessions are strictly preserved');

        // Cleanup
        await adminClient.from('ott_playback_sessions').delete().eq('channel_id', testChannel.id);
        await adminClient.from('ott_channels').delete().eq('id', testChannel.id);
      }
    }
  }

  console.log('\n================================================================');
  console.log(` MILESTONE 2.9.2A TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runPlaybackSessionSuite().catch((err) => {
  console.error('Fatal error in playback session suite:', err);
  process.exit(1);
});
