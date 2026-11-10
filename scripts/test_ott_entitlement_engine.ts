/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.1: Hardened Content Access Control & Entitlement Engine Test Suite
 * 
 * Verifies all 32 critical access control & security assertions deterministically:
 * 1. Free content accessible without auth
 * 2. Free content accessible with auth
 * 3. PPV denied without pass (PAYMENT_REQUIRED)
 * 4. PPV allowed with valid active pass (ALLOWED_PPV) & receives ephemeral grant
 * 5. Expired PPV pass denied (ENTITLEMENT_EXPIRED)
 * 6. Revoked PPV pass denied (ACCESS_REVOKED)
 * 7. Episode 1 pass does not unlock Episode 2
 * 8. Granular Season Pass: Season 1 pass unlocks S1E1 and S1E2
 * 9. Granular Season Pass: Season 1 pass does NOT unlock Season 2 Episode 1
 * 10. SVOD denied without subscription (SUBSCRIPTION_REQUIRED)
 * 11. SVOD allowed with active channel subscription (ALLOWED_SVOD)
 * 12. Cancelled SVOD subscription remains ACTIVE until current_period_end (Grace Period)
 * 13. Cancelled SVOD subscription is DENIED after current_period_end lapses
 * 14. Expired SVOD subscription denied (ENTITLEMENT_EXPIRED)
 * 15. Past due SVOD subscription denied (ENTITLEMENT_EXPIRED)
 * 16. Revoked SVOD subscription denied (ACCESS_REVOKED)
 * 17. Channel A subscription does not unlock Channel B (Cross-Tenant Isolation)
 * 18. Draft content denied (CONTENT_NOT_PUBLISHED)
 * 19. Archived content denied (CONTENT_NOT_PUBLISHED)
 * 20. Future scheduled premiere denied (CONTENT_NOT_YET_AVAILABLE)
 * 21. Anonymous viewer denied on paid content (LOGIN_REQUIRED)
 * 22. Viewer A cannot consume Viewer B's pass (Identity Forgery Blocked)
 * 23. Content from Tenant A cannot be authorized under Tenant B channel (Tenant Mismatch Blocked)
 * 24. Tampered or missing content returns CONTENT_UNAVAILABLE
 * 25. Suspended channel returns CONTENT_UNAVAILABLE
 * 26. Master video URL is STRICTLY NEVER leaked or returned (Zero Master URL Leakage)
 * 27. Hybrid early access allows SVOD subscriber or PPV ticket holder
 * 28. Explicit trailer preview returns trailer URL only, NEVER master URL
 * 29. Time boundary: Pass valid at exact start time
 * 30. Time boundary: Pass denied 1ms after expiry time
 * 31. Serverless API handler (/api/ott/resolve-access) returns sanitized HTTP responses
 * 32. Database migration upgrade_v3_15_ott_entitlement_engine.sql RLS & schema integrity
 */

import fs from 'fs';
import path from 'path';
import {
  OttChannel,
  OttSeries,
  OttSeason,
  OttEpisode,
  OttFilm,
  OttAccessPass,
  OttViewerSubscription,
} from '../src/types/database';
import {
  resolveOttContentAccess,
  createTestOttAccessPass,
  createTestOttViewerSubscription,
  generateEntitlementGrant,
  verifyEntitlementGrantToken,
  validateGrantAgainstLiveEntitlement,
  generatePseudonymousWatermark,
  maskTokenForLogging,
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
  total_seasons_count: 2,
  total_episodes_count: 4,
  maturity_rating: '17+',
  default_access_policy: 'ppv_tvod',
  publication_status: 'published',
  featured: true,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const season1: OttSeason = {
  id: 'sea-001',
  series_id: seriesA.id,
  season_number: 1,
  title: 'Season 1: Neon Rise',
  episodes_count: 2,
  publication_status: 'published',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const season2: OttSeason = {
  id: 'sea-002',
  series_id: seriesA.id,
  season_number: 2,
  title: 'Season 2: The Fall',
  episodes_count: 2,
  publication_status: 'published',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

const episode1S1: OttEpisode = {
  id: 'ep-001',
  series_id: seriesA.id,
  season_id: season1.id,
  user_id: channelA.user_id,
  episode_number: 1,
  title: 'Neon Awakening (S1E1)',
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

const episode2S1: OttEpisode = {
  id: 'ep-002',
  series_id: seriesA.id,
  season_id: season1.id,
  user_id: channelA.user_id,
  episode_number: 2,
  title: 'The Firewall Breach (S1E2)',
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

const episode1S2: OttEpisode = {
  id: 'ep-003',
  series_id: seriesA.id,
  season_id: season2.id,
  user_id: channelA.user_id,
  episode_number: 1,
  title: 'Aftermath of Jakarta (S2E1)',
  slug: 'aftermath-of-jakarta',
  runtime_seconds: 210,
  access_policy: 'ppv_tvod',
  ppv_price_idr: 5000,
  publication_status: 'published',
  master_video_url: 'renders/glodok_ep3_master.mp4',
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
assert(Boolean(freeAnon.entitlementGrant?.grantToken), 'Free content provides ephemeral grant token');
assert((freeAnon as any).playbackSession?.videoUrl === undefined, 'Raw master video URL is NOT leaked on free content');

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
  content: episode1S1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [],
  currentTime: now,
});
assert(ppvDeniedNoPass.allowed === false, 'PPV is denied when viewer has no pass');
assert(ppvDeniedNoPass.status === 'PAYMENT_REQUIRED', 'Status is PAYMENT_REQUIRED');
assert(ppvDeniedNoPass.entitlementGrant === undefined, 'entitlementGrant is STRICTLY UNDEFINED when denied');
assert(ppvDeniedNoPass.monetizationPrompt?.priceIdr === 5000, 'Monetization prompt indicates correct PPV price');

const validPassEp1 = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'episode',
  contentId: episode1S1.id,
  validHours: 48,
  now,
});
const ppvAllowed = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1S1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [validPassEp1],
  currentTime: now,
});
assert(ppvAllowed.allowed === true, 'PPV is allowed with valid active pass');
assert(ppvAllowed.status === 'ALLOWED_PPV', 'Status is ALLOWED_PPV');
assert(Boolean(ppvAllowed.entitlementGrant?.grantToken), 'entitlementGrant token is present');
assert((ppvAllowed as any).playbackSession?.videoUrl === undefined, 'Raw master video URL is NEVER returned in response');

const expiredPassEp1 = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'episode',
  contentId: episode1S1.id,
  validHours: -2, // expired 2 hours ago
  now,
});
const ppvExpired = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1S1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [expiredPassEp1],
  currentTime: now,
});
assert(ppvExpired.allowed === false, 'Expired PPV pass is denied');
assert(ppvExpired.status === 'ENTITLEMENT_EXPIRED', 'Status is ENTITLEMENT_EXPIRED');
assert(ppvExpired.entitlementGrant === undefined, 'No entitlementGrant on expired pass');

const revokedPassEp1 = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'episode',
  contentId: episode1S1.id,
  status: 'revoked',
  now,
});
const ppvRevoked = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1S1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [revokedPassEp1],
  currentTime: now,
});
assert(ppvRevoked.allowed === false, 'Revoked PPV pass is denied');
assert(ppvRevoked.status === 'ACCESS_REVOKED', 'Status is ACCESS_REVOKED');
assert(ppvRevoked.entitlementGrant === undefined, 'No entitlementGrant on revoked pass');

// -----------------------------------------------------------------------------
// [TEST 7, 8, 9] Granular Season Pass vs Other Seasons
// -----------------------------------------------------------------------------
console.log('\n[TEST 7, 8, 9] Granular Season Pass vs Other Seasons');
// Viewer has pass for Episode 1 only, attempts to watch Episode 2
const ep2WithEp1Pass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode2S1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [validPassEp1],
  currentTime: now,
});
assert(ep2WithEp1Pass.allowed === false, 'Episode 1 pass does NOT unlock Episode 2');
assert(ep2WithEp1Pass.status === 'PAYMENT_REQUIRED', 'Episode 2 requires separate payment');

// Viewer has Season Pass specifically for Season 1 (content_id: season1.id)
const season1Pass = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'season',
  contentId: season1.id, // specifically Season 1
  validHours: 720,
  now,
});

const ep1S1WithSeasonPass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1S1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [season1Pass],
  currentTime: now,
});
const ep2S1WithSeasonPass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode2S1,
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [season1Pass],
  currentTime: now,
});
const ep1S2WithSeason1Pass = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: episode1S2, // Season 2 Episode 1
  parentSeries: seriesA,
  contentType: 'episode',
  userPasses: [season1Pass], // Season 1 pass!
  currentTime: now,
});

assert(ep1S1WithSeasonPass.allowed === true, 'Season 1 pass unlocks Season 1 Episode 1');
assert(ep2S1WithSeasonPass.allowed === true, 'Season 1 pass unlocks Season 1 Episode 2');
assert(ep1S2WithSeason1Pass.allowed === false, 'Season 1 pass DOES NOT unlock Season 2 Episode 1 (Granular Isolation)');
assert(ep1S2WithSeason1Pass.status === 'PAYMENT_REQUIRED', 'Season 2 requires its own entitlement');

// -----------------------------------------------------------------------------
// [TEST 10, 11, 12, 13, 14, 15, 16, 17] SVOD Lifecycle & Cross-Channel Isolation
// -----------------------------------------------------------------------------
console.log('\n[TEST 10-17] SVOD Lifecycle & Cross-Channel Isolation');
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

// Active SVOD subscription
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

// Cancelled auto-renew, but paid period still active (Grace Period)
const cancelledActiveSub = createTestOttViewerSubscription({
  userId: viewer1.id,
  channelId: channelA.id,
  status: 'cancelled',
  autoRenew: false,
  validDays: 15, // remaining 15 days paid
  now,
});
const svodCancelledGrace = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: svodFilmA,
  contentType: 'film',
  userSubscriptions: [cancelledActiveSub],
  currentTime: now,
});
assert(svodCancelledGrace.allowed === true, 'Cancelled auto-renew keeps access active during paid period');
assert(svodCancelledGrace.status === 'ALLOWED_SVOD', 'Status is ALLOWED_SVOD during cancelled grace period');

// Cancelled auto-renew and paid period has lapsed
const cancelledLapsedSub = createTestOttViewerSubscription({
  userId: viewer1.id,
  channelId: channelA.id,
  status: 'cancelled',
  autoRenew: false,
  startDaysOffset: -35,
  validDays: 30, // ended 5 days ago
  now,
});
const svodCancelledLapsed = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: svodFilmA,
  contentType: 'film',
  userSubscriptions: [cancelledLapsedSub],
  currentTime: now,
});
assert(svodCancelledLapsed.allowed === false, 'Cancelled subscription is denied after period lapses');
assert(svodCancelledLapsed.status === 'ENTITLEMENT_EXPIRED', 'Status is ENTITLEMENT_EXPIRED on lapsed cancellation');

// Revoked subscription
const revokedSub = createTestOttViewerSubscription({
  userId: viewer1.id,
  channelId: channelA.id,
  status: 'revoked',
  validDays: 30,
  now,
});
const svodRevoked = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: svodFilmA,
  contentType: 'film',
  userSubscriptions: [revokedSub],
  currentTime: now,
});
assert(svodRevoked.allowed === false, 'Revoked subscription is denied');
assert(svodRevoked.status === 'ACCESS_REVOKED', 'Status is ACCESS_REVOKED');

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
// [TEST 18, 19, 20] Catalog Status & Scheduled Premiere Gate
// -----------------------------------------------------------------------------
console.log('\n[TEST 18, 19, 20] Catalog Status & Scheduled Premiere Gate');
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

// -----------------------------------------------------------------------------
// [TEST 21, 22, 23] Identity & Cross-Tenant Defense
// -----------------------------------------------------------------------------
console.log('\n[TEST 21, 22, 23] Identity & Cross-Tenant Defense');
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
  content: episode1S1,
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
// [TEST 24, 25, 26] Fail-Closed Security & Zero URL Leakage
// -----------------------------------------------------------------------------
console.log('\n[TEST 24, 25, 26] Fail-Closed Security & Zero URL Leakage');
const missingContentAccess = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: null as any,
  contentType: 'film',
  currentTime: now,
});
assert(missingContentAccess.allowed === false, 'Null/missing content returns CONTENT_UNAVAILABLE');

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

// Verify Zero Master URL Leakage across all decision paths
const allDecisions = [
  freeAnon,
  freeAuth,
  ppvAllowed,
  ppvDeniedNoPass,
  ppvExpired,
  ppvRevoked,
  svodAllowed,
  svodCancelledGrace,
  svodCancelledLapsed,
  draftAccess,
  scheduledAccess,
  anonOnPaid,
  stolenPassAccess,
  tenantMismatchAccess,
  missingContentAccess,
  suspendedChannelAccess,
];
const zeroMasterUrlLeak = allDecisions.every(
  (d) => (d as any).playbackSession?.videoUrl === undefined && (d as any).videoUrl === undefined
);
assert(zeroMasterUrlLeak, 'Zero Master Video URL Leakage Invariant verified across ALL 16 decision paths');

// -----------------------------------------------------------------------------
// [TEST 27 & 28] Hybrid Early Access & Preview Stream Protection
// -----------------------------------------------------------------------------
console.log('\n[TEST 27 & 28] Hybrid Early Access & Preview Stream Protection');
const hybridWithSvod = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: hybridFilmA,
  contentType: 'film',
  userSubscriptions: [activeSubChannelA],
  currentTime: now,
});
assert(hybridWithSvod.allowed === true, 'Hybrid early access unlocks via channel SVOD subscription');

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
  previewAccess.previewUrl === premiumFilmA.trailer_video_url,
  'Preview returns trailer_video_url ONLY, never master_video_url'
);

// -----------------------------------------------------------------------------
// [TEST 29 & 30] Precise Time Boundaries
// -----------------------------------------------------------------------------
console.log('\n[TEST 29 & 30] Precise Time Boundaries');
// Pass starts at 01:15:00.000Z
const passExactStart = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'film',
  contentId: premiumFilmA.id,
  validFrom: now.toISOString(),
  validHours: 24,
  now,
});
const accessAtExactStart = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: premiumFilmA,
  contentType: 'film',
  userPasses: [passExactStart],
  currentTime: now, // exactly equal to valid_from
});
assert(accessAtExactStart.allowed === true, 'Pass is valid exactly at start time');

// Tested 1ms before start time
const beforeStartTime = new Date(now.getTime() - 1);
const accessBeforeStart = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: premiumFilmA,
  contentType: 'film',
  userPasses: [passExactStart],
  currentTime: beforeStartTime,
});
assert(accessBeforeStart.allowed === false, 'Pass is denied before start time');

// Tested exactly at expiration time
const expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const accessAtExpiry = resolveOttContentAccess({
  viewer: viewer1,
  channel: channelA,
  content: premiumFilmA,
  contentType: 'film',
  userPasses: [passExactStart],
  currentTime: expiryTime,
});
assert(accessAtExpiry.allowed === false, 'Pass is denied exactly at expiration time');

// -----------------------------------------------------------------------------
// [TEST 31] Serverless API Endpoint Handler
// -----------------------------------------------------------------------------
console.log('\n[TEST 31] Serverless API Endpoint Handler (/api/ott/resolve-access)');
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

  // Method rejection
  const reqGet = { method: 'GET' };
  const resGet = createMockRes();
  await resolveAccessHandler(reqGet, resGet);
  assert(resGet.statusCode === 405, 'Serverless endpoint rejects GET with 405');

  // Free content resolution
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
  assert(Boolean(resFree.jsonPayload.decision.entitlementGrant), 'HTTP 200 response contains entitlementGrant');
  assert((resFree.jsonPayload.decision as any).playbackSession?.videoUrl === undefined, 'No master video URL in API response');

  // Unauthenticated paid request
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
  assert(resPaidAnon.statusCode === 401, 'Unauthenticated paid request returns HTTP 401');
}

await testServerlessEndpoint();

// -----------------------------------------------------------------------------
// [TEST 32] Database Migration SQL & RLS Verification
// -----------------------------------------------------------------------------
console.log('\n[TEST 32] Database Migration SQL & RLS Verification');
const migrationPath = path.resolve(process.cwd(), 'supabase/upgrade_v3_15_ott_entitlement_engine.sql');
assert(fs.existsSync(migrationPath), 'supabase/upgrade_v3_15_ott_entitlement_engine.sql exists');

const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.ott_access_passes'), 'Migration defines ott_access_passes');
assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.ott_viewer_subscriptions'), 'Migration defines ott_viewer_subscriptions');
assert(sqlContent.includes('ALTER TABLE public.ott_access_passes ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on ott_access_passes');
assert(sqlContent.includes('ALTER TABLE public.ott_viewer_subscriptions ENABLE ROW LEVEL SECURITY;'), 'RLS enabled on ott_viewer_subscriptions');
assert(sqlContent.includes('DEFAULT now()'), 'Uses true now() TIMESTAMPTZ default');
assert(sqlContent.includes('check_ott_access_pass_channel_integrity'), 'Polymorphic content channel integrity trigger defined');

// -----------------------------------------------------------------------------
// [TEST 33] Cryptographic Entitlement Grant Token Security & Verification Suite
// -----------------------------------------------------------------------------
console.log('\n[TEST 33] Cryptographic Entitlement Grant Token Security & Verification Suite');

// 1. Valid token for user and content is verified successfully
const grant1 = generateEntitlementGrant({
  contentId: premiumFilmA.id,
  contentType: 'film',
  viewerId: viewer1.id,
  channelId: channelA.id,
  accessPolicy: 'ppv_tvod',
  now,
  watermarkRequired: true,
});
const verifyValid = verifyEntitlementGrantToken(grant1.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  expectedContentType: 'film',
  currentTime: now,
});
assert(verifyValid.valid === true, '1. Valid grant token is verified successfully');
assert(verifyValid.payload?.sub === viewer1.id, '1b. Payload sub matches viewerId');
assert(verifyValid.payload?.cid === premiumFilmA.id, '1c. Payload cid matches contentId');

// 2. Expired token is rejected
const futureAfterExpiry = new Date(new Date(grant1.expiresAt).getTime() + 1000); // 1s past expiry
const verifyExpired = verifyEntitlementGrantToken(grant1.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: futureAfterExpiry,
});
assert(verifyExpired.valid === false, '2. Expired grant token is strictly rejected');
assert(Boolean(verifyExpired.reason?.includes('expired')), '2b. Reason specifies token expiration');

// 3. User A token used by User B is rejected
const verifyWrongUser = verifyEntitlementGrantToken(grant1.grantToken, {
  expectedViewerId: viewer2.id, // User B
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});
assert(verifyWrongUser.valid === false, '3. Grant token used by another viewer is strictly rejected (Viewer Binding)');
assert(Boolean(verifyWrongUser.reason?.includes('viewer binding mismatch')), '3b. Reason specifies viewer binding mismatch');

// 4. Content A token used for Content B is rejected
const verifyWrongContent = verifyEntitlementGrantToken(grant1.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: hybridFilmA.id, // Content B
  expectedChannelId: channelA.id,
  currentTime: now,
});
assert(verifyWrongContent.valid === false, '4. Grant token used for different content is rejected (Content Binding)');
assert(Boolean(verifyWrongContent.reason?.includes('content binding mismatch')), '4b. Reason specifies content mismatch');

// 5. Channel A token used for Channel B is rejected
const verifyWrongChannel = verifyEntitlementGrantToken(grant1.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelB.id, // Channel B
  currentTime: now,
});
assert(verifyWrongChannel.valid === false, '5. Grant token used for different channel is rejected (Channel Binding)');
assert(Boolean(verifyWrongChannel.reason?.includes('channel binding mismatch')), '5b. Reason specifies channel mismatch');

// 6. Modified / tampered payload with invalid signature is rejected
const [prefixPayload, originalSig] = grant1.grantToken.replace('egt_amf_', '').split('.');
// Decode payload, modify viewerId to viewer2, re-encode without signature update
const decodedPayload = JSON.parse(Buffer.from(prefixPayload, 'base64url').toString('utf-8'));
decodedPayload.sub = viewer2.id;
const forgedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
const forgedToken = `egt_amf_${forgedPayloadB64}.${originalSig}`;

const verifyTampered = verifyEntitlementGrantToken(forgedToken, {
  expectedViewerId: viewer2.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});
assert(verifyTampered.valid === false, '6. Tampered payload with forged claim is rejected (HMAC Cryptographic Guard)');
assert(Boolean(verifyTampered.reason?.includes('signature mismatch')), '6b. Reason specifies cryptographic signature mismatch');

// 7. Malformed token structure (no prefix, missing signature, invalid chars)
const verifyMalformed1 = verifyEntitlementGrantToken('not_a_valid_token', {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});
const verifyMalformed2 = verifyEntitlementGrantToken('egt_amf_nodotseparator', {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});
assert(verifyMalformed1.valid === false, '7a. Token without egt_amf_ prefix is rejected');
assert(verifyMalformed2.valid === false, '7b. Token without payload.signature dot delimiter is rejected');

// 8. Grant token expiry is strictly capped to underlying pass validity window
// Example: pass expires in 45 minutes, shorter than default 2h window
const shortRentalExpiryMs = now.getTime() + 45 * 60 * 1000;
const cappedGrant = generateEntitlementGrant({
  contentId: premiumFilmA.id,
  contentType: 'film',
  viewerId: viewer1.id,
  channelId: channelA.id,
  accessPolicy: 'ppv_tvod',
  now,
  maxExpiryMs: shortRentalExpiryMs,
  watermarkRequired: true,
});
const cappedExpiryMs = new Date(cappedGrant.expiresAt).getTime();
assert(
  cappedExpiryMs === shortRentalExpiryMs,
  '8. Grant token expiry is capped to rental pass validity window (Never outlives pass)'
);

// 9. Grant token and payload NEVER contain or reveal raw master video URL
const tokenString = grant1.grantToken;
const payloadString = JSON.stringify(verifyValid.payload);
assert(!tokenString.includes('master.mp4'), '9a. Grant token string does NOT contain master video filename/path');
assert(!payloadString.includes('master.mp4'), '9b. Grant token payload does NOT contain master video storage URL');
assert(!tokenString.includes('storage.supabase'), '9c. Grant token does NOT contain storage domain');

// 10. Fail-closed: Null, empty or undefined parameters always return valid: false
const verifyNull = verifyEntitlementGrantToken(null as any, {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
});
const verifyEmpty = verifyEntitlementGrantToken('', {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
});
assert(verifyNull.valid === false, '10a. Null token safely yields valid: false');
assert(verifyEmpty.valid === false, '10b. Empty token safely yields valid: false');

// -----------------------------------------------------------------------------
// [TEST 34] Server-Only Secret Isolation & Bundle Inspection
// -----------------------------------------------------------------------------
console.log('\n[TEST 34] Server-Only Secret Isolation & Bundle Inspection');
const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
  let secretLeakedInBundle = false;
  let signerFunctionInBundle = false;

  for (const jsFile of jsFiles) {
    const fileContent = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf-8');
    if (fileContent.includes('OTT_GRANT_SIGNING_SECRET')) {
      secretLeakedInBundle = true;
    }
    if (fileContent.includes('generatePseudonymousWatermark') || fileContent.includes('validateGrantAgainstLiveEntitlement')) {
      signerFunctionInBundle = true;
    }
  }

  assert(!secretLeakedInBundle, '1. OTT_GRANT_SIGNING_SECRET is strictly absent from browser JS bundles');
  assert(!signerFunctionInBundle, '2. Server-only signing and verification logic is excluded from client bundles');
} else {
  console.log('  ℹ SKIP: dist/assets not found, skipping bundle scan (run npm run build first)');
}

// -----------------------------------------------------------------------------
// [TEST 35] Bounded-Life Replay Policy & JTI Semantics
// -----------------------------------------------------------------------------
console.log('\n[TEST 35] Bounded-Life Replay Policy & JTI Semantics');
const grantA = generateEntitlementGrant({
  contentId: premiumFilmA.id,
  contentType: 'film',
  viewerId: viewer1.id,
  channelId: channelA.id,
  accessPolicy: 'ppv_tvod',
  now,
  watermarkRequired: true,
});
const grantB = generateEntitlementGrant({
  contentId: premiumFilmA.id,
  contentType: 'film',
  viewerId: viewer1.id,
  channelId: channelA.id,
  accessPolicy: 'ppv_tvod',
  now,
  watermarkRequired: true,
});

assert(Boolean(grantA.grantId.startsWith('gid_')), '1. JTI contains unique grant ID prefix gid_');
assert(grantA.grantId !== grantB.grantId, '2. Sequential grants for same viewer/content receive distinct JTIs');

// Replay policy: Within validity window, bearer grant token can be verified multiple times
// for multi-chunk/range streaming playback requests
const replay1 = verifyEntitlementGrantToken(grantA.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});
const replay2 = verifyEntitlementGrantToken(grantA.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: new Date(now.getTime() + 10000), // 10 seconds later in stream
});
assert(replay1.valid === true, '3. Initial playback request verified successfully');
assert(replay2.valid === true, '4. Subsequent playback request with same token within exp window is permitted (Streaming multi-chunk playback)');

// Sanitized logging check
const masked = maskTokenForLogging(grantA.grantToken);
assert(!masked.includes(grantA.grantToken), '5. Masked token for logging does NOT contain full token string');
assert(masked.startsWith('egt_amf_') && masked.includes('...'), '6. Masked token format preserves debug prefix and suffix only');

// -----------------------------------------------------------------------------
// [TEST 36] Instant Revocation & Live Entitlement State Re-Verification
// -----------------------------------------------------------------------------
console.log('\n[TEST 36] Instant Revocation & Live Entitlement State Re-Verification');

// Skenario 1: PPV pass aktif saat token diterbitkan, kemudian pass dicabut oleh admin
const livePassActive = createTestOttAccessPass({
  userId: viewer1.id,
  channelId: channelA.id,
  contentType: 'film',
  contentId: premiumFilmA.id,
  validHours: 48,
  now,
});
const grantForRevocation = generateEntitlementGrant({
  contentId: premiumFilmA.id,
  contentType: 'film',
  viewerId: viewer1.id,
  channelId: channelA.id,
  accessPolicy: 'tvod_rental',
  now,
  maxExpiryMs: now.getTime() + 2 * 60 * 60 * 1000,
});

// Verifikasi kriptografis awal sukses
const verifiedInitial = verifyEntitlementGrantToken(grantForRevocation.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});
assert(verifiedInitial.valid === true, '1. Token kriptografis valid sebelum pencabutan');

// Re-verifikasi dengan live pass aktif -> Valid
const liveCheckActive = validateGrantAgainstLiveEntitlement(verifiedInitial.payload!, {
  pass: livePassActive,
  now,
});
assert(liveCheckActive.valid === true, '2. Live check lolos saat pass aktif di database');

// Admin mencabut tiket (status = 'revoked')
const revokedPass: OttAccessPass = { ...livePassActive, status: 'revoked' };
const liveCheckRevoked = validateGrantAgainstLiveEntitlement(verifiedInitial.payload!, {
  pass: revokedPass,
  now: new Date(now.getTime() + 5 * 60 * 1000), // 5 menit kemudian, token exp masih panjang
});
assert(liveCheckRevoked.valid === false, '3. Grant ditolak seketika saat pass dicabut di database (Zero-delay revocation)');
assert(liveCheckRevoked.code === 'PASS_REVOKED', '4. Alasan penolakan spesifik PASS_REVOKED');

// Skenario 2: PPV pass kedaluwarsa di database
const expiredPass: OttAccessPass = {
  ...livePassActive,
  status: 'expired',
  valid_until: new Date(now.getTime() - 1000).toISOString(),
};
const liveCheckExpiredPass = validateGrantAgainstLiveEntitlement(verifiedInitial.payload!, {
  pass: expiredPass,
  now,
});
assert(liveCheckExpiredPass.valid === false, '5. Grant ditolak saat pass kedaluwarsa di database');
assert(liveCheckExpiredPass.code === 'PASS_EXPIRED', '6. Alasan penolakan spesifik PASS_EXPIRED');

// Skenario 3: SVOD langganan dicabut
const liveSubActive = createTestOttViewerSubscription({
  userId: viewer1.id,
  channelId: channelA.id,
  status: 'active',
  validDays: 30,
  now,
});
const grantForSvod = generateEntitlementGrant({
  contentId: svodFilmA.id,
  contentType: 'film',
  viewerId: viewer1.id,
  channelId: channelA.id,
  accessPolicy: 'svod_channel',
  now,
});
const verifiedSvod = verifyEntitlementGrantToken(grantForSvod.grantToken, {
  expectedViewerId: viewer1.id,
  expectedContentId: svodFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});
const revokedSubLive: OttViewerSubscription = { ...liveSubActive, status: 'revoked' };
const liveCheckRevokedSub = validateGrantAgainstLiveEntitlement(verifiedSvod.payload!, {
  subscription: revokedSubLive,
  now,
});
assert(liveCheckRevokedSub.valid === false, '7. SVOD grant ditolak seketika saat subscription dicabut');
assert(liveCheckRevokedSub.code === 'SUBSCRIPTION_REVOKED', '8. Alasan penolakan spesifik SUBSCRIPTION_REVOKED');

// Skenario 4: Konten ditarik dari publikasi (status != published)
const liveCheckUnpublished = validateGrantAgainstLiveEntitlement(verifiedInitial.payload!, {
  pass: livePassActive,
  contentPublicationStatus: 'draft',
  now,
});
assert(liveCheckUnpublished.valid === false, '9. Grant ditolak seketika jika konten di-unpublish');
assert(liveCheckUnpublished.code === 'CONTENT_NOT_PUBLISHED', '10. Alasan penolakan spesifik CONTENT_NOT_PUBLISHED');

// -----------------------------------------------------------------------------
// [TEST 37] Payload Privacy & Pseudonymous Forensic Watermark (No Raw Email)
// -----------------------------------------------------------------------------
console.log('\n[TEST 37] Payload Privacy & Pseudonymous Forensic Watermark (No Raw Email)');
const viewerWithEmail = { id: 'usr_forensic_789', email: 'director.secret@movie-studio.id' };
const privateGrant = generateEntitlementGrant({
  contentId: premiumFilmA.id,
  contentType: 'film',
  viewerId: viewerWithEmail.id,
  channelId: channelA.id,
  accessPolicy: 'ppv_tvod',
  now,
  watermarkRequired: true,
});
const verifiedPrivate = verifyEntitlementGrantToken(privateGrant.grantToken, {
  expectedViewerId: viewerWithEmail.id,
  expectedContentId: premiumFilmA.id,
  expectedChannelId: channelA.id,
  currentTime: now,
});

const payloadJsonStr = JSON.stringify(verifiedPrivate.payload);
assert(!payloadJsonStr.includes('director.secret@movie-studio.id'), '1. Raw viewer email is NEVER present in grant payload JSON');
assert(!payloadJsonStr.includes('@'), '2. Grant payload contains zero email addresses or domain at-signs');
assert(
  typeof verifiedPrivate.payload?.wm === 'string' && verifiedPrivate.payload.wm.startsWith('wm_'),
  '3. Forensic watermark claim wm uses pseudonymous hash (wm_...)'
);
assert(
  verifiedPrivate.payload?.wm !== viewerWithEmail.id,
  '4. Watermark hash does not directly expose raw viewer ID string'
);

// Forensik: Server dengan secret yang sama dapat memverifikasi keterkaitan watermark
const computedWatermark = generatePseudonymousWatermark(viewerWithEmail.id);
assert(verifiedPrivate.payload?.wm === computedWatermark, '5. Server can forensically reconcile watermark to viewer identity');

// -----------------------------------------------------------------------------
// [TEST 38] Trusted Server-Side Identity Verification & Request Body Spoofing Resistance
// -----------------------------------------------------------------------------
console.log('\n[TEST 38] Trusted Server-Side Identity Verification & Request Body Spoofing Resistance');
// Skenario: Penyerang mengirim body dengan viewerId/userId korban di request body,
// tetapi server mengevaluasi access strictly menggunakan verified JWT/session identity
let spoofResolvedUser = '';
const mockRes: any = {
  status: (code: number) => ({
    json: (data: any) => {
      spoofResolvedUser = data?.decision?.entitlementGrant?.viewerId || '';
      return data;
    },
  }),
  setHeader: () => {},
};

// Request dengan user session terverifikasi = 'usr_legitimate_456'
// Request body mengirim spoofed userId = 'usr_victim_111'
const spoofReq: any = {
  method: 'POST',
  _testUser: { id: 'usr_legitimate_456', email: 'legit@amf.io' },
  body: {
    channelId: channelA.id,
    contentId: freeFilm.id,
    contentType: 'film',
    userId: 'usr_victim_111', // Spoofed!
    viewerId: 'usr_victim_111', // Spoofed!
    _mockData: {
      channel: channelA,
      content: freeFilm,
    },
  },
};

await resolveAccessHandler(spoofReq, mockRes);
assert(spoofResolvedUser === 'usr_legitimate_456', '1. Endpoint strictly resolves to verified session user, ignoring spoofed body userId');
assert(spoofResolvedUser !== 'usr_victim_111', '2. Spoofed body userId was strictly ignored');

// -----------------------------------------------------------------------------
// [TEST 39] Non-Destructive Corrective RLS SQL Quarantine Policy Verification
// -----------------------------------------------------------------------------
console.log('\n[TEST 39] Non-Destructive Corrective RLS SQL Quarantine Policy Verification');
const correctiveSqlPath = path.resolve(process.cwd(), 'supabase/corrective_v3_15_disable_entitlements.sql');
assert(fs.existsSync(correctiveSqlPath), '1. corrective_v3_15_disable_entitlements.sql exists physically');

const correctiveSql = fs.readFileSync(correctiveSqlPath, 'utf-8');
assert(!correctiveSql.includes('DROP TABLE'), '2. Corrective script NEVER drops any table (Zero data loss)');
assert(
  correctiveSql.includes('DROP POLICY IF EXISTS "Viewers can view own access passes"') &&
  correctiveSql.includes('DROP POLICY IF EXISTS "Channel owners can view channel access passes"'),
  '3. Corrective script explicitly drops ALL permissive access passes policies (Prevents OR-bypass)'
);
assert(
  correctiveSql.includes('DROP POLICY IF EXISTS "Viewers can view own subscriptions"') &&
  correctiveSql.includes('DROP POLICY IF EXISTS "Channel owners can view channel subscriptions"'),
  '4. Corrective script explicitly drops ALL permissive subscription policies (Prevents OR-bypass)'
);
assert(
  correctiveSql.includes('REVOKE ALL ON public.ott_access_passes FROM anon, authenticated, PUBLIC;') &&
  correctiveSql.includes('REVOKE ALL ON public.ott_viewer_subscriptions FROM anon, authenticated, PUBLIC;'),
  '5. Corrective script revokes ALL privileges from anon, authenticated, and PUBLIC'
);
assert(
  correctiveSql.includes('GRANT ALL ON public.ott_access_passes TO service_role;') &&
  correctiveSql.includes('GRANT ALL ON public.ott_viewer_subscriptions TO service_role;'),
  '6. Service role retains full administrative access for background processing and inspection'
);
assert(
  correctiveSql.includes('AS RESTRICTIVE') && correctiveSql.includes('USING (false)'),
  '7. Installs explicit RESTRICTIVE fail-closed quarantine policies'
);

console.log('\n================================================================');
console.log(` MILESTONE 2.9.1 TEST SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('================================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
