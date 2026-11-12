/**
 * AI MOVIE FACTORY — SPRINT 5 HARI: DAY 4 ACCEPTANCE TEST SUITE
 * Scope: Monetization, B2C Payments & OTT Streaming Platform
 * Targets:
 * - Content access resolution & Gate 5 publication guard (/api/ott/resolve-access)
 * - Anti-tampering price validation & checkout order creation (/api/ott/checkout)
 * - Midtrans SHA-512 constant-time webhook signature & fulfillment
 * - Playback session controller & signed Progressive MP4 delivery (/api/ott/playback-session)
 * - Dynamic watermarking & playhead resume preservation
 * - Live Supabase database integrity & clean production verification
 */

import 'dotenv/config';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import checkoutHandler from '../server/ott/checkoutHandler.ts';
import playbackSessionHandler from '../server/ott/playbackSessionHandler.ts';
import resolveAccessHandler from '../server/ott/resolveAccessHandler.ts';
import { verifyMidtransSignature } from '../api/payment-webhook.ts';
import { generateEntitlementGrant } from '../src/lib/ottEntitlementEngine.ts';

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

async function runDay4Suite() {
  console.log('\n========================================================================');
  console.log('  AI MOVIE FACTORY — DAY 4 SPRINT: MONETIZATION, PAYMENTS & OTT');
  console.log('========================================================================\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
  const serviceKey = process.env.SUPABASE_SECRET_KEY || '';
  const admin = serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

  // ---------------------------------------------------------------------------
  // SECTION 1: LIVE SUPABASE POSTGRESQL COMMERCE & OTT ENTITLEMENTS
  // ---------------------------------------------------------------------------
  console.log('[SECTION 1] Live Supabase PostgreSQL Commerce & Entitlement Tables');
  if (admin) {
    // 1.1 Verify OTT Tables exist
    const ottTables = [
      'ott_channels',
      'ott_films',
      'ott_series',
      'ott_seasons',
      'ott_episodes',
      'ott_payment_orders',
      'ott_access_passes',
      'ott_viewer_subscriptions',
      'ott_playback_sessions',
      'ott_payment_order_refunds',
    ];

    for (const t of ottTables) {
      const { error } = await admin.from(t).select('*').limit(0);
      assert(!error, `1.1 Table public.${t} exists and is accessible by service_role`);
    }

    // 1.2 Verify clean production database invariant (zero leftover test orders)
    const { count: sessionCount } = await admin.from('ott_playback_sessions').select('*', { count: 'exact', head: true });
    assert((sessionCount || 0) === 0, '1.2 Clean database invariant: 0 stale playback sessions in production');
  } else {
    console.log('  [Notice] Live database checks skipped in offline mode.');
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: ACCESS RESOLUTION & GATE 5 PUBLICATION GUARD
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 2] Access Resolution & Gate 5 Publication Guard (/api/ott/resolve-access)');

  const mockChannel = {
    id: 'chan_001',
    name: 'AMF Cinema Official',
    status: 'active',
  };

  // 2.1 Unapproved Gate 5 content is rejected
  const reqGate5Unapproved: any = {
    method: 'POST',
    _testUser: { id: 'viewer-001', email: 'viewer@test.com' },
    body: {
      contentId: 'film_unapproved_001',
      contentType: 'film',
      channelId: 'chan_001',
      _mockData: {
        channel: mockChannel,
        content: {
          id: 'film_unapproved_001',
          channel_id: 'chan_001',
          title: 'Unapproved Draft Movie',
          access_policy: 'free',
          publication_status: 'published',
          master_approval_status: 'DRAFT', // Unapproved Gate 5
          master_video_url: 'https://storage/master.mp4',
        },
      },
    },
  };
  const resGate5 = createMockRes();
  await resolveAccessHandler(reqGate5Unapproved, resGate5);
  assert(resGate5.getStatusCode() === 422, '2.1 Draft/unapproved Gate 5 content is blocked from resolution (HTTP 422)');
  assert(resGate5.getJson()?.error === 'GATE_5_UNAPPROVED', '2.2 Error code explicitly specifies GATE_5_UNAPPROVED');

  // 2.2 Free access policy resolves to granted
  const reqFreeAccess: any = {
    method: 'POST',
    _testUser: { id: 'viewer-001', email: 'viewer@test.com' },
    body: {
      contentId: 'film_free_001',
      contentType: 'film',
      channelId: 'chan_001',
      _mockData: {
        channel: mockChannel,
        content: {
          id: 'film_free_001',
          channel_id: 'chan_001',
          title: 'Free Indie Short Film',
          access_policy: 'free',
          publication_status: 'published',
          master_approval_status: 'GATE_5_APPROVED',
          master_video_url: 'https://storage/master_free.mp4',
        },
      },
    },
  };
  const resFree = createMockRes();
  await resolveAccessHandler(reqFreeAccess, resFree);
  assert(resFree.getStatusCode() === 200, '2.3 Free content access resolution returns HTTP 200');
  assert(resFree.getJson()?.success === true, '2.4 Access evaluation success is true');
  assert(resFree.getJson()?.decision?.status === 'ALLOWED_FREE', '2.5 Decision status is ALLOWED_FREE');
  assert(Boolean(resFree.getJson()?.decision?.entitlementGrant?.grantToken), '2.6 Ephemeral grant token is generated for free content');

  // 2.3 Paywall content without pass resolves to payment_required
  const reqPaywall: any = {
    method: 'POST',
    _testUser: { id: 'viewer-001', email: 'viewer@test.com' },
    body: {
      contentId: 'film_premium_001',
      contentType: 'film',
      channelId: 'chan_001',
      _mockData: {
        channel: mockChannel,
        content: {
          id: 'film_premium_001',
          channel_id: 'chan_001',
          title: 'Premium Cinema Release',
          access_policy: 'ppv_tvod',
          ppv_price_idr: 25000,
          publication_status: 'published',
          master_approval_status: 'GATE_5_APPROVED',
          master_video_url: 'https://storage/master_premium.mp4',
        },
        userPasses: [],
      },
    },
  };
  const resPaywall = createMockRes();
  await resolveAccessHandler(reqPaywall, resPaywall);
  assert(resPaywall.getStatusCode() === 402, '2.7 Paywall content resolution returns HTTP 402 Payment Required');
  assert(resPaywall.getJson()?.decision?.status === 'PAYMENT_REQUIRED', '2.8 Decision status is PAYMENT_REQUIRED without pass');
  assert(resPaywall.getJson()?.decision?.monetizationPrompt?.priceIdr === 25000, '2.9 Correct catalog pricing is advertised to client (25,000 IDR)');

  // ---------------------------------------------------------------------------
  // SECTION 3: B2C CHECKOUT & ANTI-TAMPERING PRICE VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 3] B2C Checkout & Anti-Tampering Price Validation (/api/ott/checkout)');

  const mockFilm = {
    id: 'film_premium_001',
    channel_id: 'chan_001',
    title: 'Premium Cinema Release',
    ppv_price_idr: 25000,
    publication_status: 'published',
    master_approval_status: 'GATE_5_APPROVED',
    access_policy: 'ppv_tvod',
  };

  // 3.1 Unauthenticated checkout without identity is rejected (401)
  const reqCheckoutUnauth: any = {
    method: 'POST',
    body: { channelId: 'chan_001', orderType: 'ppv_single_film' },
  };
  const resCheckoutUnauth = createMockRes();
  await checkoutHandler(reqCheckoutUnauth, resCheckoutUnauth);
  assert(resCheckoutUnauth.getStatusCode() === 401, '3.1 Unauthenticated checkout returns HTTP 401');

  // 3.2 Price tampering attempt (paying 500 IDR instead of 25,000 IDR) is strictly rejected
  const reqTamper: any = {
    method: 'POST',
    body: {
      channelId: 'chan_001',
      orderType: 'ppv_single_film',
      contentId: 'film_premium_001',
      contentType: 'film',
      clientPrice: 500, // Tampered price
      _mockViewer: { id: 'viewer-001', email: 'viewer@test.com' },
      _mockData: {
        channel: mockChannel,
        film: mockFilm,
      },
    },
  };
  const resTamper = createMockRes();
  await checkoutHandler(reqTamper, resTamper);
  assert(resTamper.getStatusCode() === 400, '3.2 Price tampering attempt is strictly rejected with HTTP 400');
  assert(resTamper.getJson()?.error === 'PRICE_TAMPERING_DETECTED', '3.3 Error code specifies PRICE_TAMPERING_DETECTED');

  // 3.3 Authentic price checkout succeeds and returns order with gross amount in IDR
  const reqValidCheckout: any = {
    method: 'POST',
    body: {
      channelId: 'chan_001',
      orderType: 'ppv_single_film',
      contentId: 'film_premium_001',
      contentType: 'film',
      clientPrice: 25000, // Legitimate price
      _mockViewer: { id: 'viewer-001', email: 'viewer@test.com' },
      _mockData: {
        channel: mockChannel,
        film: mockFilm,
      },
    },
  };
  const resValidCheckout = createMockRes();
  await checkoutHandler(reqValidCheckout, resValidCheckout);
  assert(resValidCheckout.getStatusCode() === 201, '3.4 Compliant checkout creates order successfully (HTTP 201)');
  assert(resValidCheckout.getJson()?.order?.gross_amount === 25000, '3.5 Order gross amount matches catalog price exactly (25,000 IDR)');
  assert(resValidCheckout.getJson()?.order?.status === 'pending', '3.6 Order initialized in pending status');

  // ---------------------------------------------------------------------------
  // SECTION 4: MIDTRANS SIGNATURE VERIFICATION & CONSTANT-TIME COMPARISON
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 4] Midtrans SHA-512 Signature Verification & Security');

  const serverKey = 'SB-Mid-server-TEST-KEY-12345';
  const orderId = 'order_amf_ott_test_999';
  const statusCode = '200';
  const grossAmount = '25000.00';

  // Compute authentic SHA-512 hash
  const authenticSignature = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');

  // 4.1 Valid signature passes
  const isValidSig = verifyMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey,
    signatureKey: authenticSignature,
  });
  assert(isValidSig === true, '4.1 Authentic Midtrans SHA-512 signature verified successfully');

  // 4.2 Forged signature fails
  const isForgedSig = verifyMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey,
    signatureKey: 'forged_fake_signature_hash_000000000000000000000000000000000000000000',
  });
  assert(isForgedSig === false, '4.2 Forged signature is strictly rejected via timingSafeEqual');

  // 4.3 Mismatched gross amount fails
  const isTamperedAmount = verifyMidtransSignature({
    orderId,
    statusCode,
    grossAmount: '1000.00', // Modified amount
    serverKey,
    signatureKey: authenticSignature,
  });
  assert(isTamperedAmount === false, '4.3 Signature with tampered amount is strictly rejected');

  // ---------------------------------------------------------------------------
  // SECTION 5: PLAYBACK SESSION CONTROLLER & PROGRESSIVE MP4 STREAMING
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 5] Playback Session Controller & Progressive MP4 Delivery');

  // 5.1 Unauthenticated playback session acquire is rejected
  const reqSessionUnauth: any = {
    method: 'POST',
    body: { action: 'acquire' },
  };
  const resSessionUnauth = createMockRes();
  await playbackSessionHandler(reqSessionUnauth, resSessionUnauth);
  assert(resSessionUnauth.getStatusCode() === 401, '5.1 Unauthenticated session acquire returns HTTP 401');

  // Issue real HMAC-SHA256 entitlement grant token for viewer-001
  const validGrant = generateEntitlementGrant({
    contentId: 'film_001',
    contentType: 'film',
    viewerId: 'viewer-001',
    channelId: 'chan_001',
    accessPolicy: 'free',
  });

  // 5.2 Session acquire with valid grant returns signed delivery URL & watermark text
  const reqSessionAcquire: any = {
    method: 'POST',
    body: {
      action: 'acquire',
      channelId: 'chan_001',
      contentId: 'film_001',
      contentType: 'film',
      grantToken: validGrant.grantToken,
      _mockData: {
        content: {
          id: 'film_001',
          channel_id: 'chan_001',
          title: 'Test Film',
          publication_status: 'published',
          master_approval_status: 'GATE_5_APPROVED',
          master_video_url: 'ott-masters/film_001/master.mp4',
          runtime_seconds: 120,
        },
      },
    },
    _testUser: { id: 'viewer-001', email: 'viewer@aimoviefactory.local' },
  };
  const resSessionAcquire = createMockRes();
  await playbackSessionHandler(reqSessionAcquire, resSessionAcquire);
  assert(resSessionAcquire.getStatusCode() === 200, '5.2 Session acquire returns HTTP 200 with delivery contract');
  assert(Boolean(resSessionAcquire.getJson()?.session?.sessionId), '5.3 Session ID is issued');
  assert(Boolean(resSessionAcquire.getJson()?.session?.playbackUrl), '5.4 Signed playback URL is returned');
  assert(resSessionAcquire.getJson()?.session?.streamMode === 'progressive', '5.5 Stream mode is confirmed Progressive MP4 for MVP');
  assert(Boolean(resSessionAcquire.getJson()?.session?.watermark?.text), '5.6 Watermark text is included in session configuration');

  // 5.3 Heartbeat preserves active session
  const reqHeartbeat: any = {
    method: 'POST',
    body: {
      action: 'heartbeat',
      sessionId: 'session_active_001',
      currentPositionSeconds: 65,
      _mockData: { sessionActive: true },
    },
    _testUser: { id: 'viewer-001', email: 'viewer@aimoviefactory.local' },
  };
  const resHeartbeat = createMockRes();
  await playbackSessionHandler(reqHeartbeat, resHeartbeat);
  assert(resHeartbeat.getStatusCode() === 200, '5.7 Session heartbeat returns HTTP 200');

  // 5.4 Instant Revocation: revoked pass terminates active session immediately
  const reqRevoked: any = {
    method: 'POST',
    body: {
      action: 'heartbeat',
      sessionId: 'session_revoked_001',
      currentPositionSeconds: 120,
      _mockData: { sessionActive: false, revoked: true },
    },
    _testUser: { id: 'viewer-001', email: 'viewer@aimoviefactory.local' },
  };
  const resRevoked = createMockRes();
  await playbackSessionHandler(reqRevoked, resRevoked);
  assert(resRevoked.getStatusCode() === 403, '5.8 Revoked pass halts session with HTTP 403 (Instant Revocation)');
  assert(resRevoked.getJson()?.error === 'SESSION_REVOKED', '5.9 Error code confirms SESSION_REVOKED');

  console.log('\n========================================================================');
  console.log(`  DAY 4 MONETIZATION & OTT SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDay4Suite().catch((err) => {
  console.error('Fatal error in Day 4 test suite:', err);
  process.exit(1);
});
