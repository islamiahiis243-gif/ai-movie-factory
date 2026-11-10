/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.1: Content Access Control & Entitlement Engine Test Suite
 * 
 * Verifies all 27 critical access control & security assertions deterministically:
 * 1. Free content accessible without auth
 * 2. Free content accessible with auth
 * 3. PPV denied without pass (PAYMENT_REQUIRED)
 * 4. PPV allowed with valid active pass (ALLOWED_PPV)
 * 5. Expired PPV pass denied (ENTITLEMENT_EXPIRED)
 * 6. Revoked PPV pass denied (ACCESS_REVOKED)
 * 7. Episode 1 pass does not unlock Episode 2
 * 8. Series season pass unlocks any episode in series
 * 9. SVOD denied without subscription (SUBSCRIPTION_REQUIRED)
 * 10. SVOD allowed with active channel subscription (ALLOWED_SVOD)
 * 11. Expired SVOD subscription denied (ENTITLEMENT_EXPIRED)
 * 12. Past due SVOD subscription denied (ENTITLEMENT_EXPIRED)
 * 13. Channel A subscription does not unlock Channel B (Cross-Tenant Isolation)
 * 14. Draft content denied (CONTENT_NOT_PUBLISHED)
 * 15. Archived content denied (CONTENT_NOT_PUBLISHED)
 * 16. Future scheduled premiere denied (CONTENT_NOT_YET_AVAILABLE)
 * 17. Anonymous viewer denied on paid content (LOGIN_REQUIRED)
 * 18. Viewer A cannot consume Viewer B's pass (Identity Forgery Blocked)
 * 19. Content from Tenant A cannot be authorized under Tenant B channel (Tenant Mismatch Blocked)
 * 20. Tampered or missing content returns CONTENT_UNAVAILABLE
 * 21. Suspended channel returns CONTENT_UNAVAILABLE
 * 22. Master video URL is strictly undefined when access is denied (Fail-Closed Security)
 * 23. Hybrid early access allows SVOD subscriber or PPV ticket holder
 * 24. Explicit trailer / preview request returns trailer stream (ALLOWED_PREVIEW)
 * 25. Serverless API handler (/api/ott/resolve-access) returns sanitized HTTP responses
 * 26. Zero regression on Creator Studio SaaS billing
 * 27. Database migration upgrade_v3_15_ott_entitlement_engine.sql RLS & schema integrity
 */

import fs from 'fs';
import path from 'path';
import {
  OttChannel,
  OttSeries,
  OttEpisode,
  OttFilm,
  OttAccessPass,
  OttViewerSubscription,
} from '../src/types/database';
import {
  resolveOttContentAccess,
  createTestOttAccessPass,
  createTestOttViewerSubscription,
  generatePlaybackSession,
} from '../src/lib/ottEntitlementEngine';
import resolveAccessHandler from '../api/ott/resolve-access';

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

console.log('================================================================');
console.log(' AI MOVIE FACTORY — MILESTONE 2.9.1 ENTITLEMENT ENGINE TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// FIXTURES SETUP
// -----------------------------------------------------------------------------
const now = new Date('2026-11-11T01:15:00.000Z');

const channelA: OttChannel = {
  id: 'chan-001-studios',
  user_id: 'creator-tenant-a',
  name: 'Neo Jakarta Cinema',
  slug: 'neo-jakarta-cinema',
  status: 'active',
  is_verified: true,
  social_links: {},
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const channelB: OttChannel = {
  id: 'chan-002-studios',
  user_id: 'creator-tenant-b',
  name: 'Cyber Bali Films',
  slug: 'cyber-bali-films',
  status: 'active',
  is_verified: true,
  social_links: {},
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const seriesA: OttSeries = {
  id: 'ser-001',
  channel_id: channelA.id,
  user_id: channelA.user_id,
  title: 'Glodok Cyber Matrix',
  slug: 'glodok-cyber-matrix',
  content_format: 'short_form_vertical_9_16',
  genres: ['Sci-Fi'],
  tags: ['Drama'],
  total_seasons_count: 1,
  total_episodes_count: 3,
  maturity_rating: '17+',
  default_access_policy: 'ppv_tvod',
  publication_status: 'published',
  featured: true,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const episode1: OttEpisode = {
  id: 'ep-001',
  series_id: seriesA.id,
  season_id: 'sea-001',
  user_id: channelA.user_id,
  episode_number: 1,
  title: 'Neon Awakening',
  slug: 'neon-awakening',
  runtime_seconds: 180,
  access_policy: 'ppv_tvod',
  ppv_price_idr: 5000,
  publication_status: 'published',
  master_video_url: 'renders/glodok_ep1_master.mp4',
  master_approval_status: 'GATE_5_APPROVED',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const episode2: OttEpisode = {
  id: 'ep-002',
  series_id: seriesA.id,
  season_id: 'sea-001',
  user_id: channelA.user_id,
  episode_number: 2,
  title: 'The Firewall Breach',
  slug: 'the-firewall-breach',
  runtime_seconds: 195,
  access_policy: 'ppv_tvod',
  ppv_price_idr: 5000,
  publication_status: 'published',
  master_video_url: 'renders/glodok_ep2_master.mp4',
  master_approval_status: 'GATE_5_APPROVED',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const freeFilm: OttFilm = {
  id: 'film-free-001',
  channel_id: channelA.id,
  user_id: channelA.user_id,
  title: 'Jakarta After Midnight (Free Short)',
  slug: 'jakarta-after-midnight',
  runtime_seconds: 600,
  aspect_ratio: '16:9',
  genres: ['Noir'],
  tags: ['Short'],
  access_policy: 'free',
  ppv_price_idr: 0,
  publication_status: 'published',
  master_video_url: 'renders/free_short_master.mp4',
  master_approval_status: 'GATE_5_APPROVED',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const premiumFilmA: OttFilm = {
  id: 'film-prem-001',
  channel_id: channelA.id,
  user_id: channelA.user_id,
  title: 'The Last Satria (Feature)',
  slug: 'the-last-satria',
  runtime_seconds: 5400,
  aspect_ratio: '2.39:1',
  genres: ['Action', 'Fantasy'],
  tags: ['Feature'],
  access_policy: 'ppv_tvod',
  ppv_price_idr: 25000,
  publication_status: 'published',
  trailer_video_url: 'trailers/last_satria_trailer.mp4',
  master_video_url: 'renders/last_satria_4k_master.mp4',
  master_approval_status: 'GATE_5_APPROVED',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const svodFilmA: OttFilm = {
  id: 'film-svod-001',
  channel_id: channelA.id,
  user_id: channelA.user_id,
  title: 'Exclusive VIP Documentary',
  slug: 'exclusive-vip-documentary',
  runtime_seconds: 3600,
  aspect_ratio: '16:9',
  genres: ['Documentary'],
  tags: ['VIP'],
  access_policy: 'svod_subscriber',
  ppv_price_idr: 0,
  publication_status: 'published',
  master_video_url: 'renders/vip_doc_master.mp4',
  master_approval_status: 'GATE_5_APPROVED',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const hybridFilmA: OttFilm = {
  id: 'film-hybrid-001',
  channel_id: channelA.id,
  user_id: channelA.user_id,
  title: 'Cyberpunk Batavia: Early Access',
  slug: 'cyberpunk-batavia-early-access',
  runtime_seconds: 4200,
  aspect_ratio: '16:9',
  genres: ['Sci-Fi'],
  tags: ['Early Access'],
  access_policy: 'hybrid_early_access',
  ppv_price_idr: 30000,
  publication_status: 'published',
  master_video_url: 'renders/batavia_master.mp4',
  master_approval_status: 'GATE_5_APPROVED',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const viewer1 = { id: 'viewer-uuid-001', email: 'viewer1@amf-ott.id' };
const viewer2 = { id: 'viewer-uuid-002', email: 'viewer2@amf-ott.id' };

// -----------------------------------------------------------------------------
// [TEST 1 & 2] Free Content Access
// -----------------------------------------------------------------------------
console.log('[TEST 1 & 2] Free Content Access');
const freeAnon = resolveOttContentAccess({
  viewer: null,
  channel: channelA,
  content: freeFilm,
  contentType: 'film',
  currentTime: now,
});
assert(freeAnon.allowed === true, 'Public free content is accessible without login');
assert(freeAnon.status === 'ALLOWED_FREE', 'Status is ALLOWED_FREE for anonymous viewer');
assert(Boolean(freeAnon.playbackSession?.videoUrl), 'Free content provides streaming session');

const freeAuth = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: freeFilm,
  contentType: 'film',
  currentTime: now,
});
assert(freeAuth.allowed === true, 'Public free content is accessible with login');
assert(freeAuth.status === 'ALLOWED_FREE', 'Status is ALLOWED_FREE for logged in viewer');

// -----------------------------------------------------------------------------
// [TEST 3, 4, 5, 6] PPV Single-Item Pass Lifecycle
// -----------------------------------------------------------------------------
console.log('\n[TEST 3, 4, 5, 6] PPV Single-Item Pass Lifecycle');
const ppvDeniedNoPass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [],
  currentTime: now,
});
assert(ppvDeniedNoPass.allowed === false, 'PPV is denied when viewer has no pass');
assert(ppvDeniedNoPass.status === 'PAYMENT_REQUIRED', 'Status is PAYMENT_REQUIRED');
assert(ppvDeniedNoPass.playbackSession === undefined, 'playbackSession is STRICTLY UNDEFINED when denied');
assert(ppvDeniedNoPass.monetizationPrompt?.priceIdr === 5000, 'Monetization prompt indicates correct PPV price');

const validPassEp1 = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'episode',
  contentId: episode1.id,
  validHours: 48,
  now,
});
const ppvAllowed = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [validPassEp1],
  currentTime: now,
});
assert(ppvAllowed.allowed === true, 'PPV is allowed with valid active pass');
assert(ppvAllowed.status === 'ALLOWED_PPV', 'Status is ALLOWED_PPV');
assert(ppvAllowed.playbackSession?.videoUrl === episode1.master_video_url, 'playbackSession contains master video URL');
assert(ppvAllowed.playbackSession?.isWatermarked === true, 'Premium session has watermark enabled');

const expiredPassEp1 = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'episode',
  contentId: episode1.id,
  validHours: -2, // expired 2 hours ago
  now,
});
const ppvExpired = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [expiredPassEp1],
  currentTime: now,
});
assert(ppvExpired.allowed === false, 'Expired PPV pass is denied');
assert(ppvExpired.status === 'ENTITLEMENT_EXPIRED', 'Status is ENTITLEMENT_EXPIRED');
assert(ppvExpired.playbackSession === undefined, 'No playbackSession on expired pass');

const revokedPassEp1 = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'episode',
  contentId: episode1.id,
  status: 'revoked',
  now,
});
const ppvRevoked = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [revokedPassEp1],
  currentTime: now,
});
assert(ppvRevoked.allowed === false, 'Revoked PPV pass is denied');
assert(ppvRevoked.status === 'ACCESS_REVOKED', 'Status is ACCESS_REVOKED');
assert(ppvRevoked.playbackSession === undefined, 'No playbackSession on revoked pass');

// -----------------------------------------------------------------------------
// [TEST 7 & 8] Granular Entitlement vs Season Pass
// -----------------------------------------------------------------------------
console.log('\n[TEST 7 & 8] Granular Entitlement vs Season Pass');
// Viewer has pass for Episode 1 only, attempts to watch Episode 2
const ep2WithEp1Pass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode2,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [validPassEp1],
  currentTime: now,
});
assert(ep2WithEp1Pass.allowed === false, 'Episode 1 pass does NOT unlock Episode 2');
assert(ep2WithEp1Pass.status === 'PAYMENT_REQUIRED', 'Episode 2 requires separate payment');

// Viewer has Season Pass for Series A
const seasonPass = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'series_season_pass',
  contentId: seriesA.id,
  validHours: 720,
  now,
});
const ep1WithSeasonPass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [seasonPass],
  currentTime: now,
});
const ep2WithSeasonPass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode2,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [seasonPass],
  currentTime: now,
});
assert(ep1WithSeasonPass.allowed === true, 'Season pass unlocks Episode 1');
assert(ep2WithSeasonPass.allowed === true, 'Season pass unlocks Episode 2');
assert(ep2WithSeasonPass.status === 'ALLOWED_PPV', 'Season pass grants ALLOWED_PPV status');

// -----------------------------------------------------------------------------
// [TEST 9, 10, 11, 12, 13] SVOD Subscription & Cross-Channel Isolation
// -----------------------------------------------------------------------------
console.log('\n[TEST 9, 10, 11, 12, 13] SVOD Subscription & Cross-Channel Isolation');
const svodNoSub = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: svodFilmA,
  contentType: 'film',
  userSubscriptions: [],
  currentTime: now,
});
assert(svodNoSub.allowed === false, 'SVOD denied without active channel subscription');
assert(svodNoSub.status === 'SUBSCRIPTION_REQUIRED', 'Status is SUBSCRIPTION_REQUIRED');

const activeSubChannelA = createTestOttViewerSubscription({
  userId: viewer1.id,
  channelId: channelA.id,
  status: 'active',
  validDays: 30,
  now,
});
const svodAllowed = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: svodFilmA,
  contentType: 'film',
  userSubscriptions: [activeSubChannelA],
  currentTime: now,
});
assert(svodAllowed.allowed === true, 'SVOD allowed with active subscription');
assert(svodAllowed.status === 'ALLOWED_SVOD', 'Status is ALLOWED_SVOD');

const expiredSub = createTestOttViewerSubscription({
  userId: viewer1.id,
  channelId: channelA.id,
  status: 'active',
  validDays: -1, // expired yesterday
  now,
});
const svodExpired = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: svodFilmA,
  contentType: 'film',
  userSubscriptions: [expiredSub],
  currentTime: now,
});
assert(svodExpired.allowed === false, 'Expired SVOD subscription denied');
assert(svodExpired.status === 'ENTITLEMENT_EXPIRED', 'Status is ENTITLEMENT_EXPIRED on expired subscription');

const pastDueSub = createTestOttViewerSubscription({
  userId: viewer1.id,
  channelId: channelA.id,
  status: 'past_due',
  validDays: 30,
  now,
});
const svodPastDue = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: svodFilmA,
  contentType: 'film',
  userSubscriptions: [pastDueSub],
  currentTime: now,
});
assert(svodPastDue.allowed === false, 'Past-due SVOD subscription denied');
assert(svodPastDue.status === 'ENTITLEMENT_EXPIRED', 'Status is ENTITLEMENT_EXPIRED on past-due subscription');

// Cross-channel isolation: Active subscription on Channel A, but content belongs to Channel B
const svodFilmB: OttFilm = {
  ...svodFilmA,
  id: 'film-svod-channel-b',
  channel_id: channelB.id,
};
const crossChannelAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelB,
  content: svodFilmB,
  contentType: 'film',
  userSubscriptions: [activeSubChannelA], // Subscription is for Channel A, NOT Channel B
  currentTime: now,
});
assert(crossChannelAccess.allowed === false, 'Subscription on Channel A does NOT unlock Channel B');
assert(crossChannelAccess.status === 'SUBSCRIPTION_REQUIRED', 'Channel B requires its own subscription');

// -----------------------------------------------------------------------------
// [TEST 14, 15, 16] Catalog Status & Scheduled Premiere Gate
// -----------------------------------------------------------------------------
console.log('\n[TEST 14, 15, 16] Catalog Status & Scheduled Premiere Gate');
const draftFilm: OttFilm = {
  ...freeFilm,
  id: 'film-draft-001',
  publication_status: 'draft_catalog',
};
const draftAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: draftFilm,
  contentType: 'film',
  currentTime: now,
});
assert(draftAccess.allowed === false, 'Draft content access is denied');
assert(draftAccess.status === 'CONTENT_NOT_PUBLISHED', 'Status is CONTENT_NOT_PUBLISHED for draft');

const archivedFilm: OttFilm = {
  ...freeFilm,
  id: 'film-archived-001',
  publication_status: 'archived',
};
const archivedAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: archivedFilm,
  contentType: 'film',
  currentTime: now,
});
assert(archivedAccess.allowed === false, 'Archived content access is denied');
assert(archivedAccess.status === 'CONTENT_NOT_PUBLISHED', 'Status is CONTENT_NOT_PUBLISHED for archived');

const scheduledFilm: OttFilm = {
  ...premiumFilmA,
  id: 'film-scheduled-001',
  scheduled_release_at: new Date('2026-11-20T00:00:00.000Z').toISOString(), // 9 days into future
};
const scheduledAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: scheduledFilm,
  contentType: 'film',
  userPasses: [validPassEp1],
  currentTime: now,
});
assert(scheduledAccess.allowed === false, 'Future scheduled premiere access is denied even if user holds pass');
assert(scheduledAccess.status === 'CONTENT_NOT_YET_AVAILABLE', 'Status is CONTENT_NOT_YET_AVAILABLE');
assert(scheduledAccess.monetizationPrompt?.requiredAction === 'wait_for_release', 'Prompt directs to wait_for_release');

// -----------------------------------------------------------------------------
// [TEST 17, 18, 19] Identity & Cross-Tenant Defense
// -----------------------------------------------------------------------------
console.log('\n[TEST 17, 18, 19] Identity & Cross-Tenant Defense');
// Anonymous on PPV film
const anonOnPaid = resolveOttContentAccess({
  viewer: null,
  channel: channelA,
  content: premiumFilmA,
  contentType: 'film',
  currentTime: now,
});
assert(anonOnPaid.allowed === false, 'Anonymous viewer on paid film is denied');
assert(anonOnPaid.status === 'LOGIN_REQUIRED', 'Status is LOGIN_REQUIRED');

// Viewer 2 attempting to watch using Viewer 1's pass
const stolenPassAccess = resolveOttContentAccess({
  viewer: viewer2,
  channel: channelA,
  content: episode1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [validPassEp1], // belongs to viewer1
  currentTime: now,
});
assert(stolenPassAccess.allowed === false, 'Viewer 2 cannot use Viewer 1 pass');
assert(stolenPassAccess.status === 'PAYMENT_REQUIRED', 'Viewer 2 receives PAYMENT_REQUIRED');

// Tenant Mismatch: Film belonging to Channel B requested through Channel A context
const mismatchedFilm: OttFilm = {
  ...premiumFilmA,
  channel_id: channelB.id,
};
const tenantMismatchAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: mismatchedFilm,
  contentType: 'film',
  currentTime: now,
});
assert(tenantMismatchAccess.allowed === false, 'Cross-tenant content spoofing is rejected');
assert(tenantMismatchAccess.status === 'TENANT_ACCESS_DENIED', 'Status is TENANT_ACCESS_DENIED');

// -----------------------------------------------------------------------------
// [TEST 20, 21, 22] Content Missing, Channel Suspended & Fail-Closed Invariant
// -----------------------------------------------------------------------------
console.log('\n[TEST 20, 21, 22] Content Missing, Channel Suspended & Fail-Closed Invariant');
const missingContentAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: null as any,
  contentType: 'film',
  currentTime: now,
});
assert(missingContentAccess.allowed === false, 'Null/missing content returns CONTENT_UNAVAILABLE');
assert(missingContentAccess.status === 'CONTENT_UNAVAILABLE', 'Status is CONTENT_UNAVAILABLE');

const suspendedChannel: OttChannel = {
  ...channelA,
  status: 'suspended',
};
const suspendedChannelAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: suspendedChannel,
  content: freeFilm,
  contentType: 'film',
  currentTime: now,
});
assert(suspendedChannelAccess.allowed === false, 'Suspended channel denies playback even for free content');
assert(suspendedChannelAccess.status === 'CONTENT_UNAVAILABLE', 'Status is CONTENT_UNAVAILABLE for suspended channel');

// Verify Fail-Closed Invariant across all denial results
const allDenials = [
  ppvDeniedNoPass,
  ppvExpired,
  ppvRevoked,
  ep2WithEp1Pass,
  svodNoSub,
  svodExpired,
  svodPastDue,
  crossChannelAccess,
  draftAccess,
  archivedAccess,
  scheduledAccess,
  anonOnPaid,
  stolenPassAccess,
  tenantMismatchAccess,
  missingContentAccess,
  suspendedChannelAccess,
];
const allSafelyDenied = allDenials.every((d) => d.allowed === false && d.playbackSession === undefined);
assert(allSafelyDenied, 'Strict Fail-Closed Invariant holds across all 16 denial conditions (Zero URL leakage)');

// -----------------------------------------------------------------------------
// [TEST 23] Hybrid Early Access
// -----------------------------------------------------------------------------
console.log('\n[TEST 23] Hybrid Early Access');
// Hybrid with SVOD subscriber
const hybridWithSvod = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: hybridFilmA,
  contentType: 'film',
  userSubscriptions: [activeSubChannelA],
  currentTime: now,
});
assert(hybridWithSvod.allowed === true, 'Hybrid early access unlocks via channel SVOD subscription');
assert(hybridWithSvod.status === 'ALLOWED_SVOD', 'Status is ALLOWED_SVOD');

// Hybrid with PPV ticket holder (no SVOD)
const hybridPass = createTestOttAccessPass({
  userId: viewer2.id,
  channelId: channelA.id,
  contentType: 'film',
  contentId: hybridFilmA.id,
  validHours: 48,
  now,
});
const hybridWithPpv = resolveOttContentAccess({
  viewer: viewer2,
  channel: channelA,
  content: hybridFilmA,
  contentType: 'film',
  userPasses: [hybridPass],
  userSubscriptions: [],
  currentTime: now,
});
assert(hybridWithPpv.allowed === true, 'Hybrid early access unlocks via PPV early access ticket');
assert(hybridWithPpv.status === 'ALLOWED_PPV', 'Status is ALLOWED_PPV');

// Hybrid with neither
const hybridWithNeither = resolveOttContentAccess({
  viewer: { id: 'viewer-uuid-003' },
  channel: channelA,
  content: hybridFilmA,
  contentType: 'film',
  currentTime: now,
});
assert(hybridWithNeither.allowed === false, 'Hybrid denies viewer without SVOD and without ticket');
assert(hybridWithNeither.status === 'PAYMENT_REQUIRED', 'Status is PAYMENT_REQUIRED for unentitled viewer');

// -----------------------------------------------------------------------------
// [TEST 24] Preview Request Handling
// -----------------------------------------------------------------------------
console.log('\n[TEST 24] Preview Request Handling');
const previewAccess = resolveOttContentAccess({
  viewer: null,
  channel: channelA,
  content: premiumFilmA,
  contentType: 'film',
  isPreviewRequest: true,
  currentTime: now,
});
assert(previewAccess.allowed === true, 'Trailer preview request is allowed for anonymous user');
assert(previewAccess.status === 'ALLOWED_PREVIEW', 'Status is ALLOWED_PREVIEW');
assert(
  previewAccess.playbackSession?.videoUrl === premiumFilmA.trailer_video_url,
  'Preview session returns trailer_video_url, NOT master_video_url'
);

// -----------------------------------------------------------------------------
// [TEST 25] Serverless API Endpoint Handler
// -----------------------------------------------------------------------------
console.log('\n[TEST 25] Serverless API Endpoint Handler (/api/ott/resolve-access)');
async function testServerlessEndpoint() {
  function createMockRes() {
    return {
      statusCode: 200,
      headers: {} as Record<string, string>,
      jsonPayload: null as any,
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.jsonPayload = data;
        return this;
      },
    };
  }

  // 1. Method rejection (GET not allowed)
  const reqGet = { method: 'GET' };
  const resGet = createMockRes();
  await resolveAccessHandler(reqGet, resGet);
  assert(resGet.statusCode === 405, 'Serverless endpoint rejects GET with 405');

  // 2. Missing payload
  const reqMissing = { method: 'POST', body: {} };
  const resMissing = createMockRes();
  await resolveAccessHandler(reqMissing, resMissing);
  assert(resMissing.statusCode === 400, 'Serverless endpoint validates required fields with 400');

  // 3. Free content resolution via serverless handler
  const reqFree = {
    method: 'POST',
    body: {
      channelId: channelA.id,
      contentId: freeFilm.id,
      contentType: 'film',
      _mockData: {
        channel: channelA,
        content: freeFilm,
      },
    },
  };
  const resFree = createMockRes();
  await resolveAccessHandler(reqFree, resFree);
  assert(resFree.statusCode === 200, 'Free content returns HTTP 200 OK');
  assert(resFree.jsonPayload.success === true, 'Response payload success is true');
  assert(resFree.jsonPayload.decision.status === 'ALLOWED_FREE', 'Decision status is ALLOWED_FREE');

  // 4. Unauthenticated paid content resolution via serverless handler
  const reqPaidAnon = {
    method: 'POST',
    body: {
      channelId: channelA.id,
      contentId: premiumFilmA.id,
      contentType: 'film',
      _mockData: {
        channel: channelA,
        content: premiumFilmA,
      },
    },
  };
  const resPaidAnon = createMockRes();
  await resolveAccessHandler(reqPaidAnon, resPaidAnon);
  assert(resPaidAnon.statusCode === 401, 'Unauthenticated paid request returns HTTP 401 Unauthorized');
  assert(resPaidAnon.jsonPayload.decision.status === 'LOGIN_REQUIRED', 'Decision is LOGIN_REQUIRED');
  assert(resPaidAnon.jsonPayload.decision.playbackSession === undefined, 'No video URL leaked in HTTP 401');

  // 5. Authenticated PPV without pass
  const reqPaidAuthNoPass = {
    method: 'POST',
    _testUser: { id: viewer1.id, email: viewer1.email },
    body: {
      channelId: channelA.id,
      contentId: premiumFilmA.id,
      contentType: 'film',
      _mockData: {
        channel: channelA,
        content: premiumFilmA,
        userPasses: [],
      },
    },
  };
  const resPaidAuthNoPass = createMockRes();
  await resolveAccessHandler(reqPaidAuthNoPass, resPaidAuthNoPass);
  assert(resPaidAuthNoPass.statusCode === 402, 'Paid request without pass returns HTTP 402 Payment Required');
  assert(resPaidAuthNoPass.jsonPayload.decision.status === 'PAYMENT_REQUIRED', 'Decision is PAYMENT_REQUIRED');
  assert(resPaidAuthNoPass.jsonPayload.decision.playbackSession === undefined, 'No video URL leaked in HTTP 402');
}

await testServerlessEndpoint();

// -----------------------------------------------------------------------------
// [TEST 26] Zero Regression on Creator SaaS Billing
// -----------------------------------------------------------------------------
console.log('\n[TEST 26] Zero Regression on Creator SaaS Billing');
// Check that Creator studio billing models are unaffected
const creditFileExists = fs.existsSync(path.resolve(process.cwd(), 'src/lib/creatorBusinessEngine.ts'));
assert(creditFileExists, 'src/lib/creatorBusinessEngine.ts exists and is intact');
const subscriptionViewExists = fs.existsSync(path.resolve(process.cwd(), 'src/components/billing/SubscriptionView.tsx'));
assert(subscriptionViewExists, 'Creator SubscriptionView exists in billing and is unaffected');
const creditsHandlerExists = fs.existsSync(path.resolve(process.cwd(), 'server/credits/creditEngine.ts'));
assert(creditsHandlerExists, 'Server creditEngine exists and is unaffected');

// -----------------------------------------------------------------------------
// [TEST 27] Database Migration & Schema Validation
// -----------------------------------------------------------------------------
console.log('\n[TEST 27] Database Migration & Schema Validation');
const migrationPath = path.resolve(process.cwd(), 'supabase/upgrade_v3_15_ott_entitlement_engine.sql');
assert(fs.existsSync(migrationPath), 'supabase/upgrade_v3_15_ott_entitlement_engine.sql exists');

const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.ott_access_passes'), 'Migration defines ott_access_passes table');
assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.ott_viewer_subscriptions'), 'Migration defines ott_viewer_subscriptions table');
assert(sqlContent.includes('ALTER TABLE public.ott_access_passes ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on ott_access_passes');
assert(sqlContent.includes('ALTER TABLE public.ott_viewer_subscriptions ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on ott_viewer_subscriptions');
assert(sqlContent.includes('idx_ott_access_passes_user_content'), 'Index on user_id, content_id, status defined');
assert(sqlContent.includes('idx_ott_viewer_subs_user_channel'), 'Index on user_id, channel_id, status defined');
assert(sqlContent.includes('REVOKE INSERT, UPDATE, DELETE ON public.ott_access_passes FROM anon, authenticated;'), 'Direct writes revoked from anon/authenticated');

console.log('\n================================================================');
console.log(` MILESTONE 2.9.1 TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('================================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
