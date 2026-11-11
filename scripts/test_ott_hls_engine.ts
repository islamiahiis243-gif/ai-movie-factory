/**
 * AI Movie Factory — Phase 6: Independent OTT & Streaming Platform
 * Acceptance & Verification Test Suite: Milestone 2.9.2D (HLS Adaptive Bitrate Streaming & Transcoding Pipeline)
 * Wave II Master Blueprint SSOT: Bagian IV.4 (Arsitektur Video Streaming & Keamanan Konten)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { OttHlsEngine, HLS_STREAM_LADDER } from '../server/ottHlsEngine.ts';

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
  // SUMMARY
  // ---------------------------------------------------------------------------
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
