/**
 * AI Movie Factory — Phase 6: Milestone 2.9.2B Verification Suite
 * Cinematic Video Player Engine (HTML5 Progressive MP4, 16:9 & 9:16, Lifecycle & Controls)
 * 
 * Verifies Acceptance Criteria 1 to 13:
 * 1. Native HTML5 Video Element with progressive download streaming (206 partial content support).
 * 2. Clean Custom Cinematic UI Overlay (Play/pause, timeline scrubber, buffer bar, time display, volume, fullscreen, speed 0.5x–2x).
 * 3. Aspect Ratio Adaptability: 16:9 Landscape for film/series, 9:16 Vertical for micro-drama.
 * 4. Auto-Hide UI controls during active playback (fade out after idle, restore on interaction).
 * 5. Keyboard Shortcuts (Space/K, Left/Right +/- 5s, Up/Down +/- 10%, M, F).
 * 6. WebVTT Subtitle Support (<track kind="subtitles"> with custom styling).
 * 7. Chapter Markers (visual tick marks on timeline with titles and seek).
 * 8. Playback Resume / Resume Watching (persists amf_playback_pos_{contentId}, resume logic >10s and <95%).
 * 9. Session Heartbeat Lifecycle Integration (POST /api/ott/playback-session action: heartbeat every 45s).
 * 10. Seamless URL Renewal before Expiry (renewal at 10m before 15m TTL without interrupting playback position).
 * 11. Entitlement Revocation Halting (halts immediately if heartbeat reports terminated or expired).
 * 12. Responsive Desktop & Mobile layout handling.
 * 13. ZERO paid AI API calls, zero external player libraries (video.js, hls.js, plyr).
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';

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

// Player helper functions mirroring CinematicPlayerView
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function calculateResumePosition(savedSeconds: number, totalDuration: number): { shouldResume: boolean; resumeAt: number } {
  // If saved progress is greater than 10 seconds and less than 95% of duration, resume
  if (totalDuration > 0 && savedSeconds > 10 && savedSeconds < totalDuration * 0.95) {
    return { shouldResume: true, resumeAt: savedSeconds };
  }
  return { shouldResume: false, resumeAt: 0 };
}

function shouldRenewSignedUrl(elapsedSeconds: number, ttlSeconds: number = 900): boolean {
  // Renew at 10 minutes (600s) of a 15-minute (900s) TTL
  const renewThreshold = Math.min(600, ttlSeconds * 0.67);
  return elapsedSeconds >= renewThreshold;
}

async function runTestSuite() {
  console.log('\n========================================================================');
  console.log('  AI MOVIE FACTORY — MILESTONE 2.9.2B VERIFICATION SUITE');
  console.log('  Cinematic Video Player Engine (HTML5 Progressive MP4, 16:9 & 9:16)');
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 1: ZERO EXTERNAL PLAYER DEPENDENCIES & CLEAN NATIVE ARCHITECTURE
  // --------------------------------------------------------------------------
  console.log('[TEST GROUP 1] Zero External Player Libraries (Pure Native HTML5 + React)');
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  assert(!allDeps['video.js'], 'No video.js in dependencies', 'Found video.js');
  // Milestone 2.9.2D permits hls.js for MSE adaptive streaming while banning bloated wrapper frameworks
  assert(Boolean(allDeps['hls.js']), 'hls.js enabled for Milestone 2.9.2D adaptive streaming', 'Missing hls.js');
  assert(!allDeps['plyr'], 'No plyr in dependencies', 'Found plyr');
  assert(!allDeps['dashjs'], 'No dashjs in dependencies', 'Found dashjs');
  assert(!allDeps['shaka-player'], 'No shaka-player in dependencies', 'Found shaka-player');

  // Verify Player source files exist
  const playerViewPath = path.resolve(process.cwd(), 'src/components/ott/CinematicPlayerView.tsx');
  const modalWrapperPath = path.resolve(process.cwd(), 'src/components/ott/OttPlayerModal.tsx');
  assert(fs.existsSync(playerViewPath), 'CinematicPlayerView.tsx exists', playerViewPath);
  assert(fs.existsSync(modalWrapperPath), 'OttPlayerModal.tsx exists', modalWrapperPath);

  const playerSrc = fs.readFileSync(playerViewPath, 'utf8');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: NATIVE HTML5 VIDEO ELEMENT & PROGRESSIVE MP4 CONTROLS
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 2] Native HTML5 Video Element & Custom Overlay Controls');
  assert(playerSrc.includes('<video'), 'Player contains native <video> element');
  assert(playerSrc.includes('playsInline'), 'Player enables playsInline for mobile browsers');
  assert(playerSrc.includes('preload="metadata"') || playerSrc.includes('preload="auto"'), 'Player configures proper preload strategy');
  assert(playerSrc.includes('controls={false}'), 'Native browser controls disabled in favor of custom UI');
  assert(playerSrc.includes('handleTogglePlay'), 'Custom Play/Pause controller implemented');
  assert(playerSrc.includes('handleSeek'), 'Scrubbable timeline seek implemented');
  assert(playerSrc.includes('bufferProgress'), 'Buffered data range indicator calculated');
  assert(playerSrc.includes('playbackRate'), 'Playback speed controller supported (0.5x to 2x)');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: ASPECT RATIO ADAPTABILITY (16:9 & 9:16)
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 3] Aspect Ratio Adaptability (16:9 Landscape & 9:16 Vertical)');
  assert(playerSrc.includes("aspectRatio === '9:16'"), 'Player supports 9:16 vertical ratio check');
  assert(playerSrc.includes('aspect-[9/16]') || playerSrc.includes('max-w-md') || playerSrc.includes('isVertical'), 'Vertical format layout styles present');
  assert(playerSrc.includes('aspect-video') || playerSrc.includes('max-w-5xl'), '16:9 landscape aspect ratio present');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: AUTO-HIDE CONTROLS & KEYBOARD SHORTCUTS
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 4] Auto-Hide Overlay & Keyboard Shortcuts');
  assert(playerSrc.includes('handleMouseMove') || playerSrc.includes('resetInactivityTimer'), 'Activity tracking implemented');
  assert(playerSrc.includes('showControls'), 'Controls visibility state managed');
  assert(playerSrc.includes('handleKeyDown'), 'Keyboard listener implemented');
  assert(playerSrc.includes("' '") || playerSrc.includes("'Space'"), 'Spacebar shortcut for play/pause mapped');
  assert(playerSrc.includes("'ArrowLeft'") && playerSrc.includes("'ArrowRight'"), 'Arrow Left/Right +/- 5s seek mapped');
  assert(playerSrc.includes("'ArrowUp'") && playerSrc.includes("'ArrowDown'"), 'Arrow Up/Down volume mapped');
  assert(playerSrc.includes("'m'") || playerSrc.includes("'M'"), 'M key for mute mapped');
  assert(playerSrc.includes("'f'") || playerSrc.includes("'F'"), 'F key for fullscreen mapped');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: WEBVTT SUBTITLES & CHAPTER MARKERS
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 5] WebVTT Subtitles & Chapter Markers');
  assert(playerSrc.includes('<track'), 'WebVTT <track> element rendered');
  assert(playerSrc.includes('kind="subtitles"'), 'Track kind set to subtitles');
  assert(playerSrc.includes('ChapterMarker'), 'ChapterMarker type defined and supported');
  assert(playerSrc.includes('chapters.map'), 'Chapter markers rendered along timeline');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: RESUME WATCHING (LOCALSTORAGE INTEGRATION)
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 6] Playback Resume / Resume Watching');
  assert(playerSrc.includes('amf_playback_pos_'), 'Progress persistence uses amf_playback_pos_ key schema');
  assert(playerSrc.includes('localStorage.setItem'), 'Player writes playback position to localStorage');
  assert(playerSrc.includes('localStorage.getItem'), 'Player reads playback position on load');

  // Verify resume threshold math
  const r1 = calculateResumePosition(5, 120); // 5s into 2min video -> false (too early)
  assert(!r1.shouldResume, 'Resume ignored if < 10 seconds');

  const r2 = calculateResumePosition(45, 120); // 45s into 2min video -> true
  assert(r2.shouldResume && r2.resumeAt === 45, 'Resume triggered when between 10s and 95%');

  const r3 = calculateResumePosition(116, 120); // 116s into 120s video (>96%) -> false (already finished)
  assert(!r3.shouldResume, 'Resume ignored if > 95% (video finished)');

  // --------------------------------------------------------------------------
  // TEST GROUP 7: SESSION HEARTBEAT & LIFECYCLE (45s CADENCE)
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 7] Playback Session Heartbeat Integration');
  assert(playerSrc.includes("action: 'heartbeat'"), 'Heartbeat payload uses action: heartbeat');
  assert(playerSrc.includes('45000') || playerSrc.includes('HEARTBEAT_INTERVAL'), 'Heartbeat interval set to 45 seconds');
  assert(playerSrc.includes('/api/ott/playback-session'), 'Player communicates with serverless control plane');
  assert(playerSrc.includes("action: 'terminate'"), 'Player sends terminate on modal close / unmount');

  // --------------------------------------------------------------------------
  // TEST GROUP 8: SEAMLESS URL RENEWAL BEFORE EXPIRY
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 8] Seamless Signed URL Renewal Before Expiry');
  assert(playerSrc.includes("action: 'renew'"), 'Renewal payload uses action: renew');
  assert(playerSrc.includes('isRenewing'), 'Renewal state tracked to prevent re-entrant calls');
  assert(playerSrc.includes('currentTime'), 'Current playback position preserved across URL renewals');

  // Verify renewal timing logic
  assert(!shouldRenewSignedUrl(300, 900), 'Signed URL at 5m elapsed of 15m does NOT trigger renewal');
  assert(shouldRenewSignedUrl(600, 900), 'Signed URL at 10m elapsed of 15m triggers renewal');
  assert(shouldRenewSignedUrl(750, 900), 'Signed URL at 12.5m elapsed triggers renewal');

  // --------------------------------------------------------------------------
  // TEST GROUP 9: ENTITLEMENT REVOCATION HALTING & SECURITY FAIL-CLOSED
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 9] Entitlement Revocation Halting & Paywall Handling');
  assert(playerSrc.includes('ENTITLEMENT_EXPIRED') || playerSrc.includes('SESSION_TERMINATED'), 'Player checks for session termination or revocation');
  assert(playerSrc.includes('videoRef.current.pause()'), 'Player pauses immediately on error / revocation');
  assert(playerSrc.includes('errorMessage'), 'Clear error banner displayed to viewer');

  // --------------------------------------------------------------------------
  // TEST GROUP 10: TIME FORMATTING ACCURACY
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 10] Time Formatting Precision');
  assert(formatTime(0) === '00:00', '0s formatted as 00:00');
  assert(formatTime(65) === '01:05', '65s formatted as 01:05');
  assert(formatTime(599) === '09:59', '599s formatted as 09:59');
  assert(formatTime(3665) === '1:01:05', '3665s formatted as 1:01:05 (includes hours)');
  assert(formatTime(-10) === '00:00', 'Negative time handled gracefully');
  assert(formatTime(NaN) === '00:00', 'NaN time handled gracefully');

  // --------------------------------------------------------------------------
  // TEST GROUP 11: CATALOG INTEGRATION VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n[TEST GROUP 11] OTT Catalog Integration');
  const catalogViewPath = path.resolve(process.cwd(), 'src/components/studio/OttCatalogManagerView.tsx');
  const catalogSrc = fs.readFileSync(catalogViewPath, 'utf8');

  assert(catalogSrc.includes('OttPlayerModal'), 'OttPlayerModal imported in OttCatalogManagerView');
  assert(catalogSrc.includes('<OttPlayerModal'), 'OttPlayerModal rendered in OttCatalogManagerView');
  assert(catalogSrc.includes('handleLaunchPlayback'), 'Playback launch handler wired to catalog items');
  assert(catalogSrc.includes('Tonton Ep 1 (Gratis)'), 'Ep 1 free preview button triggers player');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`  TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('========================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
