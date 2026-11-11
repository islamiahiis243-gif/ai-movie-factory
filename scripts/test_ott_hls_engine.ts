/**
 * AI Movie Factory — Phase 6: Independent OTT & Streaming Platform
 * Acceptance & Verification Test Suite: Milestone 2.9.2D (HLS Adaptive Bitrate Streaming & Transcoding Pipeline)
 * Wave II Master Blueprint SSOT: Bagian IV.4 (Arsitektur Video Streaming & Keamanan Konten)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { OttHlsEngine, HLS_STREAM_LADDER } from '../server/ottHlsEngine.ts';
import {
  parseAndValidateStoragePath,
  createSignedHlsDeliveryUrl,
} from '../server/ottMediaDelivery.ts';
import {
  acquirePlaybackSession,
  renewPlaybackSession,
} from '../server/ottPlaybackSessionManager.ts';
import { generateEntitlementGrant } from '../server/ottGrantSigner.ts';

interface AssertionResult {
  num: number;
  description: string;
  passed: boolean;
  details?: string;
}

const results: AssertionResult[] = [];
let assertionCounter = 1;

function assert(description: string, condition: boolean, details?: string) {
  const passed = Boolean(condition);
  results.push({
    num: assertionCounter++,
    description,
    passed,
    details: details || (passed ? 'OK' : 'Assertion failed'),
  });
  if (passed) {
    console.log(`  ✔ [PASS] #${assertionCounter - 1}: ${description}`);
  } else {
    console.error(`  ❌ [FAIL] #${assertionCounter - 1}: ${description} (${details || 'Condition false'})`);
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   AI MOVIE FACTORY — MILESTONE 2.9.2D ACCEPTANCE TEST SUITE');
  console.log('   HLS ADAPTIVE BITRATE STREAMING & TRANSCODING PIPELINE');
  console.log('================================================================\n');

  const engine = new OttHlsEngine();

  // ---------------------------------------------------------------------------
  // SECTION 1: STREAM LADDER RESOLUTION & BITRATE SPECIFICATION (16:9 & 9:16)
  // ---------------------------------------------------------------------------
  console.log('[SECTION 1] Verifying Stream Ladder Specification & Aspect Ratios...');

  assert('Stream ladder defines exactly 4 resolution tiers (1080p, 720p, 480p, 360p)', HLS_STREAM_LADDER.length === 4);

  const ladder1080 = HLS_STREAM_LADDER.find((l) => l.resolution === '1080p')!;
  const ladder720 = HLS_STREAM_LADDER.find((l) => l.resolution === '720p')!;
  const ladder480 = HLS_STREAM_LADDER.find((l) => l.resolution === '480p')!;
  const ladder360 = HLS_STREAM_LADDER.find((l) => l.resolution === '360p')!;

  // 16:9 Widescreen Cinema Dimensions
  assert('1080p landscape has 1920x1080 dimensions', ladder1080.width16x9 === 1920 && ladder1080.height16x9 === 1080);
  assert('720p landscape has 1280x720 dimensions', ladder720.width16x9 === 1280 && ladder720.height16x9 === 720);
  assert('480p landscape has 854x480 dimensions', ladder480.width16x9 === 854 && ladder480.height16x9 === 480);
  assert('360p landscape has 640x360 dimensions', ladder360.width16x9 === 640 && ladder360.height16x9 === 360);

  // 9:16 Vertical Web Drama Dimensions
  assert('1080p vertical has 1080x1920 dimensions', ladder1080.width9x16 === 1080 && ladder1080.height9x16 === 1920);
  assert('720p vertical has 720x1280 dimensions', ladder720.width9x16 === 720 && ladder720.height9x16 === 1280);
  assert('480p vertical has 480x854 dimensions', ladder480.width9x16 === 480 && ladder480.height9x16 === 854);
  assert('360p vertical has 360x640 dimensions', ladder360.width9x16 === 360 && ladder360.height9x16 === 640);

  // Bitrate and Bandwidth Hierarchy
  assert('Bandwidth decreases strictly down the ladder (1080p > 720p > 480p > 360p)',
    ladder1080.bandwidth > ladder720.bandwidth &&
    ladder720.bandwidth > ladder480.bandwidth &&
    ladder480.bandwidth > ladder360.bandwidth);

  assert('Video bitrate conforms to streaming targets (4500k, 2500k, 1200k, 600k)',
    ladder1080.videoBitrateKbps === 4500 &&
    ladder720.videoBitrateKbps === 2500 &&
    ladder480.videoBitrateKbps === 1200 &&
    ladder360.videoBitrateKbps === 600);

  // ---------------------------------------------------------------------------
  // SECTION 2: RFC 8216 MASTER PLAYLIST (M3U8) SPECIFICATION COMPLIANCE
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 2] Verifying RFC 8216 Master Playlist Generation...');

  const renditions16x9 = engine.computeStreamRenditions({
    targetResolutions: ['1080p', '720p', '480p', '360p'],
    aspectRatio: '16:9',
    outputPrefix: 'hls/films/film_001',
  });

  const masterM3u8 = engine.generateMasterPlaylist({
    renditions: renditions16x9,
    aspectRatio: '16:9',
  });

  assert('Master playlist starts with #EXTM3U tag', masterM3u8.startsWith('#EXTM3U'));
  assert('Master playlist declares #EXT-X-VERSION:3', masterM3u8.includes('#EXT-X-VERSION:3'));
  assert('Master playlist declares #EXT-X-INDEPENDENT-SEGMENTS', masterM3u8.includes('#EXT-X-INDEPENDENT-SEGMENTS'));
  assert('Master playlist includes 1080p stream-inf with correct bandwidth and resolution',
    masterM3u8.includes('BANDWIDTH=4800000,RESOLUTION=1920x1080'));
  assert('Master playlist includes 720p stream-inf with correct bandwidth and resolution',
    masterM3u8.includes('BANDWIDTH=2650000,RESOLUTION=1280x720'));
  assert('Master playlist includes 480p stream-inf with correct bandwidth and resolution',
    masterM3u8.includes('BANDWIDTH=1300000,RESOLUTION=854x480'));
  assert('Master playlist includes 360p stream-inf with correct bandwidth and resolution',
    masterM3u8.includes('BANDWIDTH=680000,RESOLUTION=640x360'));
  assert('Master playlist declares video and audio codecs (avc1 and mp4a)',
    masterM3u8.includes('CODECS="avc1.640028,mp4a.40.2"'));
  assert('Master playlist maps rendition URIs to their variant playlist paths',
    masterM3u8.includes('hls/films/film_001/1080p/playlist.m3u8') &&
    masterM3u8.includes('hls/films/film_001/360p/playlist.m3u8'));

  // 9:16 Vertical Master Playlist Test
  const renditions9x16 = engine.computeStreamRenditions({
    targetResolutions: ['1080p', '720p'],
    aspectRatio: '9:16',
    outputPrefix: 'hls/episodes/ep_001',
  });
  const masterVerticalM3u8 = engine.generateMasterPlaylist({
    renditions: renditions9x16,
    aspectRatio: '9:16',
  });
  assert('Vertical 9:16 master playlist reflects 1080x1920 resolution',
    masterVerticalM3u8.includes('RESOLUTION=1080x1920'));
  assert('Vertical 9:16 master playlist reflects 720x1280 resolution',
    masterVerticalM3u8.includes('RESOLUTION=720x1280'));

  // ---------------------------------------------------------------------------
  // SECTION 3: VARIANT MEDIA PLAYLIST & SEGMENTATION CONTRACT
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 3] Verifying Variant Media Playlist & Segment Slicing...');

  const mediaPlaylist = engine.generateMediaPlaylist({
    resolution: '1080p',
    segmentCount: 5,
    segmentDurationSeconds: 6,
    segmentPathPrefix: 'hls/films/film_001/1080p',
    totalRuntimeSeconds: 28,
  });

  assert('Media playlist includes #EXT-X-TARGETDURATION:6', mediaPlaylist.includes('#EXT-X-TARGETDURATION:6'));
  assert('Media playlist includes #EXT-X-MEDIA-SEQUENCE:0', mediaPlaylist.includes('#EXT-X-MEDIA-SEQUENCE:0'));
  assert('Media playlist declares #EXT-X-PLAYLIST-TYPE:VOD', mediaPlaylist.includes('#EXT-X-PLAYLIST-TYPE:VOD'));
  assert('Media playlist generates #EXTINF tags for segments', mediaPlaylist.includes('#EXTINF:6.000,'));
  assert('Media playlist includes partial final segment duration (4.000s for 28s total)',
    mediaPlaylist.includes('#EXTINF:4.000,'));
  assert('Media playlist maps segments sequentially (segment_0000.ts to segment_0004.ts)',
    mediaPlaylist.includes('segment_0000.ts') && mediaPlaylist.includes('segment_0004.ts'));
  assert('Media playlist terminates strictly with #EXT-X-ENDLIST', mediaPlaylist.includes('#EXT-X-ENDLIST'));

  // ---------------------------------------------------------------------------
  // SECTION 4: STREAMING MODE RESOLUTION & PROGRESSIVE MP4 FALLBACK
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 4] Testing Adaptive Bitrate Resolution & Progressive Fallback...');

  // Case A: Content with completed HLS transcoding
  const readyContent = {
    hls_master_playlist_url: 'https://jixfakvbhugpypjtyshq.supabase.co/storage/v1/object/sign/ott-masters/hls/master.m3u8',
    transcoding_status: 'ready',
    available_resolutions: ['1080p', '720p', '480p', '360p'],
    master_video_url: 'ott-masters/film_001/master.mp4',
  };
  const readyResolved = engine.resolvePlaybackMode(readyContent);
  assert('Ready content resolves to mode "hls"', readyResolved.mode === 'hls');
  assert('Ready content is flagged as adaptive (isAdaptive: true)', readyResolved.isAdaptive === true);
  assert('Ready content exposes all available resolutions', readyResolved.resolutions.length === 4);

  // Case B: Content with pending transcoding (Fallback to Progressive MP4)
  const pendingContent = {
    hls_master_playlist_url: null,
    transcoding_status: 'queued',
    available_resolutions: ['1080p'],
    master_video_url: 'ott-masters/film_002/master.mp4',
  };
  const pendingResolved = engine.resolvePlaybackMode(pendingContent);
  assert('Pending transcoding content falls back to mode "progressive"', pendingResolved.mode === 'progressive');
  assert('Pending content is not adaptive (isAdaptive: false)', pendingResolved.isAdaptive === false);
  assert('Pending content hlsUrl is null', pendingResolved.hlsUrl === null);

  // Case C: Legacy content without HLS columns populated
  const legacyContent = {
    master_video_url: 'ott-masters/legacy/film.mp4',
  };
  const legacyResolved = engine.resolvePlaybackMode(legacyContent);
  assert('Legacy content transparently falls back to progressive MP4 (Zero Regression)', legacyResolved.mode === 'progressive');

  // ---------------------------------------------------------------------------
  // SECTION 5: DATABASE MIGRATION V3.18 & SCHEMA RECONCILIATION
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 5] Verifying Database Migration v3_18 SQL Structure...');

  const migrationPath = path.resolve(process.cwd(), 'supabase/upgrade_v3_18_ott_hls_adaptive_streaming.sql');
  assert('upgrade_v3_18_ott_hls_adaptive_streaming.sql exists physically', fs.existsSync(migrationPath));

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert('Migration extends ott_films with hls_master_playlist_url',
    migrationSql.includes('ADD COLUMN IF NOT EXISTS hls_master_playlist_url'));
  assert('Migration extends ott_films with transcoding_status enum constraint',
    migrationSql.includes("CHECK (transcoding_status IN ('not_started', 'queued', 'processing', 'ready', 'failed'))"));
  assert('Migration extends ott_episodes with HLS columns',
    migrationSql.includes('ALTER TABLE public.ott_episodes') && migrationSql.includes('hls_master_playlist_url'));
  assert('Migration creates ott_transcoding_jobs table',
    migrationSql.includes('CREATE TABLE IF NOT EXISTS public.ott_transcoding_jobs'));
  assert('Migration creates indexes on transcoding jobs',
    migrationSql.includes('CREATE INDEX IF NOT EXISTS idx_ott_transcoding_jobs_content'));
  assert('Migration enables Row-Level Security on ott_transcoding_jobs',
    migrationSql.includes('ALTER TABLE public.ott_transcoding_jobs ENABLE ROW LEVEL SECURITY'));
  assert('Migration defines complete_ott_transcoding_job stored procedure with SECURITY DEFINER',
    migrationSql.includes('CREATE OR REPLACE FUNCTION public.complete_ott_transcoding_job') &&
    migrationSql.includes('SECURITY DEFINER'));

  // ---------------------------------------------------------------------------
  // SECTION 6: RPC PRIVILEGE LOCKDOWN & HARDENING (V3.18.1)
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 6] Verifying Migration v3_18_1 RPC Hardening & Privilege Lockdown...');

  const migration181Path = path.resolve(process.cwd(), 'supabase/upgrade_v3_18_1_ott_hls_security_and_validation.sql');
  assert('upgrade_v3_18_1_ott_hls_security_and_validation.sql exists physically', fs.existsSync(migration181Path));

  const migration181Sql = fs.readFileSync(migration181Path, 'utf8');
  assert('complete_ott_transcoding_job validates master playlist path extension (.m3u8)',
    migration181Sql.includes("NOT (p_master_playlist_path LIKE '%.m3u8')"));
  assert('complete_ott_transcoding_job validates job state transition strictly from queued or processing',
    migration181Sql.includes("v_job.status NOT IN ('queued', 'processing')"));
  assert('complete_ott_transcoding_job verifies target catalog item exists before updating',
    migration181Sql.includes("SELECT EXISTS(SELECT 1 FROM public.ott_films WHERE id = v_job.content_id)"));
  assert('complete_ott_transcoding_job revokes execution from PUBLIC, anon, and authenticated',
    migration181Sql.includes('REVOKE ALL ON FUNCTION public.complete_ott_transcoding_job(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;'));
  assert('complete_ott_transcoding_job grants execution exclusively to service_role',
    migration181Sql.includes('GRANT EXECUTE ON FUNCTION public.complete_ott_transcoding_job(UUID, TEXT, JSONB) TO service_role;'));

  // ---------------------------------------------------------------------------
  // SECTION 7: HLS SIGNED DELIVERY URL & PLAYBACK SESSION INTEGRATION
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 7] Verifying HLS Signed Delivery & Playback Session Leases...');

  // Path parsing & boundary checks
  const validParsed = parseAndValidateStoragePath('ott-masters/hls/films/film_999/master.m3u8');
  assert('parseAndValidateStoragePath parses valid HLS master playlist path',
    validParsed.bucket === 'ott-masters' && validParsed.objectPath === 'hls/films/film_999/master.m3u8');

  let pathTraversalCaught = false;
  try {
    parseAndValidateStoragePath('ott-masters/../hls/secret.m3u8');
  } catch (err: any) {
    pathTraversalCaught = err.message.includes('SECURITY_VIOLATION');
  }
  assert('parseAndValidateStoragePath strictly rejects path traversal in HLS paths', pathTraversalCaught);

  let bucketViolationCaught = false;
  try {
    parseAndValidateStoragePath('https://jixfakvbhugpypjtyshq.supabase.co/storage/v1/object/public/unauthorized-bucket/master.m3u8');
  } catch (err: any) {
    bucketViolationCaught = err.message.includes('UNAUTHORIZED_STORAGE_BUCKET');
  }
  assert('parseAndValidateStoragePath rejects unauthorized bucket origins', bucketViolationCaught);

  // Playback Session: HLS Ready content signed delivery test
  const viewer = { id: 'usr_viewer_test_hls', email: 'viewer@hls.test' };
  const contentId = 'film_test_hls_001';
  const channelId = 'chn_test_001';

  const grant = generateEntitlementGrant({
    viewerId: viewer.id,
    contentId,
    contentType: 'film',
    channelId,
    accessPolicy: 'free_with_ads',
    watermarkRequired: false,
  });
  const grantToken = grant.grantToken;

  const mockHlsContent = {
    id: contentId,
    title: 'HLS Test Film',
    channel_id: channelId,
    access_policy: 'free_with_ads',
    publication_status: 'published',
    master_approval_status: 'GATE_5_APPROVED',
    master_video_url: 'ott-masters/films/film_001/master.mp4',
    hls_master_playlist_url: 'ott-masters/hls/films/film_001/master.m3u8',
    transcoding_status: 'ready',
    available_resolutions: ['1080p', '720p', '480p'],
    runtime_seconds: 7200,
  };

  const hlsSession = await acquirePlaybackSession({
    viewer,
    grantToken,
    channelId,
    contentId,
    contentType: 'film',
    adminSupabase: null,
    _mockData: {
      content: mockHlsContent,
      userPasses: [],
      userSubscriptions: [],
    },
  });

  assert('acquirePlaybackSession succeeds for ready HLS content', hlsSession.success === true);
  assert('acquirePlaybackSession resolves streamMode to "hls"', hlsSession.session?.streamMode === 'hls');
  assert('acquirePlaybackSession sets isAdaptive to true', hlsSession.session?.isAdaptive === true);
  assert('acquirePlaybackSession issues signed HLS master playlist URL with token parameter',
    Boolean(hlsSession.session?.hlsMasterPlaylistUrl?.includes('token=')));
  assert('acquirePlaybackSession preserves available multi-resolutions',
    hlsSession.session?.availableResolutions?.length === 3);

  // Renewal with HLS
  const renewResult = await renewPlaybackSession({
    sessionId: hlsSession.session!.sessionId,
    viewer,
    grantToken,
    adminSupabase: null,
    _mockData: {
      contentId,
      channelId,
      session: {
        id: 'sess_rec_1',
        session_id: hlsSession.session!.sessionId,
        user_id: viewer.id,
        channel_id: channelId,
        content_id: contentId,
        content_type: 'film',
        grant_id: 'grant_1',
        status: 'active',
      },
      content: mockHlsContent,
      userPasses: [],
      userSubscriptions: [],
    },
  });

  assert('renewPlaybackSession succeeds for active HLS session', renewResult.success === true);
  assert('renewPlaybackSession issues renewed signed HLS URL with refreshed token parameter',
    Boolean(renewResult.hlsMasterPlaylistUrl?.includes('token=')));

  // ---------------------------------------------------------------------------
  // SECTION 8: TRANSCODING PIPELINE WORKER & STORAGE GUARD UNIT CONTRACT
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 8] Unit Contract: Pipeline Guard Logic (Simulated Storage Environment)...');
  console.log('  ℹ [GUARD_AUDIT]: Memvalidasi logika fail-closed anti-false-ready saat segmen video fisik (.ts) absen.');

  // Mock DB with Storage API simulation
  let simulatedJobStatus = 'queued';
  let simulatedProgress = 0;
  const uploadedFiles: string[] = [];
  let shouldSimulateMissingMaster = false;
  let shouldSimulateMissingSegments = false;

  const mockPipelineDb: any = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => ({
          maybeSingle: async () => {
            if (table === 'ott_transcoding_jobs') {
              return {
                data: {
                  id: 'job_test_001',
                  channel_id: channelId,
                  content_id: contentId,
                  content_type: 'film',
                  source_video_url: 'ott-masters/films/test/master.mp4',
                  status: simulatedJobStatus,
                  target_resolutions: ['1080p', '720p', '480p'],
                  hls_output_prefix: 'hls/films/film_test_001',
                  progress_percent: simulatedProgress,
                },
                error: null,
              };
            }
            if (table === 'ott_films') {
              return {
                data: { id: contentId, channel_id: channelId, publication_status: 'published', runtime_seconds: 300 },
                error: null,
              };
            }
            return { data: null, error: null };
          },
        }),
      }),
      update: (fields: any) => ({
        eq: async (col: string, val: string) => {
          if (fields.status) simulatedJobStatus = fields.status;
          if (fields.progress_percent !== undefined) simulatedProgress = fields.progress_percent;
          return { data: null, error: null };
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (uploadPath: string, buffer: Buffer, opts: any) => {
          uploadedFiles.push(uploadPath);
          return { data: { path: uploadPath }, error: null };
        },
        list: async (prefix: string) => {
          if (shouldSimulateMissingMaster) {
            return { data: [], error: null };
          }
          if (prefix.includes('1080p') || prefix.includes('720p') || prefix.includes('480p')) {
            if (shouldSimulateMissingSegments) {
              return { data: [{ name: 'playlist.m3u8' }], error: null };
            }
            return {
              data: [{ name: 'playlist.m3u8' }, { name: 'segment_0000.ts' }, { name: 'segment_0001.ts' }],
              error: null,
            };
          }
          return {
            data: [{ name: 'master.m3u8' }, { name: '1080p' }, { name: '720p' }, { name: '480p' }],
            error: null,
          };
        },
      }),
    },
    rpc: async (fn: string, params: any) => {
      if (fn === 'complete_ott_transcoding_job') {
        return {
          data: {
            success: true,
            job_id: params.p_job_id,
            content_id: contentId,
            master_playlist_url: params.p_master_playlist_path,
          },
          error: null,
        };
      }
      return { data: null, error: new Error('Unknown RPC') };
    },
  };

  const testEngineWithDb = new OttHlsEngine();
  (testEngineWithDb as any).getDb = () => mockPipelineDb;

  const progressUpdates: number[] = [];
  const pipelineResult = await testEngineWithDb.executeTranscodingPipeline('job_test_001', {
    stepCallback: (pct) => progressUpdates.push(pct),
  });

  assert('executeTranscodingPipeline executes successfully', pipelineResult.success === true);
  assert('executeTranscodingPipeline progresses through stages (25%, 50%, 75%)',
    progressUpdates.includes(25) && progressUpdates.includes(50) && progressUpdates.includes(75));
  assert('executeTranscodingPipeline uploads master.m3u8 physically to storage',
    uploadedFiles.includes('hls/films/film_test_001/master.m3u8'));
  assert('executeTranscodingPipeline uploads variant playlists for all target resolutions (1080p, 720p, 480p)',
    uploadedFiles.includes('hls/films/film_test_001/1080p/playlist.m3u8') &&
    uploadedFiles.includes('hls/films/film_test_001/720p/playlist.m3u8') &&
    uploadedFiles.includes('hls/films/film_test_001/480p/playlist.m3u8'));
  assert('executeTranscodingPipeline returns canonical master playlist path terminating in master.m3u8',
    pipelineResult.masterPlaylistUrl === 'hls/films/film_test_001/master.m3u8');
  assert('executeTranscodingPipeline generates correct renditions count',
    pipelineResult.renditionsCount === 3);

  // Failure guard: Fail-closed if master.m3u8 missing in storage
  simulatedJobStatus = 'queued';
  shouldSimulateMissingMaster = true;
  let physicalMissingCaught = false;
  try {
    await testEngineWithDb.executeTranscodingPipeline('job_test_001');
  } catch (err: any) {
    physicalMissingCaught = err.message.includes('PHYSICAL_ARTIFACTS_NOT_FOUND');
  }
  assert('executeTranscodingPipeline strictly fails-closed if physical master.m3u8 verification fails', physicalMissingCaught);
  shouldSimulateMissingMaster = false;

  // Failure guard: Fail-closed if video segments (.ts) are missing in storage
  simulatedJobStatus = 'queued';
  shouldSimulateMissingSegments = true;
  let missingSegmentsCaught = false;
  try {
    await testEngineWithDb.executeTranscodingPipeline('job_test_001');
  } catch (err: any) {
    missingSegmentsCaught = err.message.includes('HLS_SEGMENTS_NOT_READY');
  }
  assert('executeTranscodingPipeline strictly fails-closed if video segments (.ts) are missing in storage', missingSegmentsCaught);
  shouldSimulateMissingSegments = false;

  // Failure guard: Illegal job state
  simulatedJobStatus = 'completed';
  let illegalStateCaught = false;
  try {
    await testEngineWithDb.executeTranscodingPipeline('job_test_001');
  } catch (err: any) {
    illegalStateCaught = err.message.includes('ILLEGAL_JOB_STATE');
  }
  assert('executeTranscodingPipeline rejects jobs already in completed state', illegalStateCaught);

  // ---------------------------------------------------------------------------
  // SECTION 9: CLIENT-SIDE SIGNED TOKEN PROPAGATION (XHRSETUP)
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 9] Verifying Client-Side Hls.js Token Propagation (xhrSetup)...');

  const playerSrcPath = path.resolve(process.cwd(), 'src/components/ott/CinematicPlayerView.tsx');
  const playerSrcCode = fs.readFileSync(playerSrcPath, 'utf8');

  assert('CinematicPlayerView configures xhrSetup hook on Hls instance',
    playerSrcCode.includes('xhrSetup:'));
  assert('xhrSetup propagates signed delivery token to variant playlists and segment chunks',
    playerSrcCode.includes('targetUrl.searchParams.set(\'token\', token)'));
  assert('CinematicPlayerView has automatic fallback from HLS to Progressive MP4 on error',
    playerSrcCode.includes('falling back to progressive MP4'));
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log('\n================================================================');
  console.log(`   TEST EXECUTION COMPLETE: ${passedCount}/${totalCount} ASSERTIONS PASSED (100%)`);
  console.log('================================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
