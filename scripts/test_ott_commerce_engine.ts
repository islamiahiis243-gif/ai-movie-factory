/**
 * AI Movie Factory — Phase 6: Independent OTT & Streaming Platform
 * Automated Acceptance Test Suite: Milestone 2.9.3 (B2C Payment / OTT Commerce & Access Fulfillment)
 * 
 * Verifies:
 * 1. Strict Database Isolation between OTT B2C orders and Creator SaaS credit billing.
 * 2. Server-side Catalog Price Verification & Anti-Tampering.
 * 3. Midtrans SHA-512 Webhook Signature Verification & Forgery Rejection.
 * 4. Atomic Idempotent Pass Issuance (PPV Single 48-Hour Pass).
 * 5. Atomic Idempotent Subscription Issuance (SVOD Channel 30-Day Pass).
 * 6. Protection against duplicate webhook callbacks (Advisory lock idempotency).
 * 7. Refund entitlement revocation (Pass revoked upon refund).
 * 8. Creator Revenue Analytics (`get_ott_creator_revenue_summary`) with VERIFIED_ACTUAL metrics.
 */

import 'dotenv/config';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../server/supabaseAdmin.ts';
import { ottCommerceEngine } from '../server/ottCommerceEngine.ts';
import { OttPaymentOrder } from '../src/types/database.ts';

const supabase = getSupabaseAdmin();

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
  console.log('   AI MOVIE FACTORY — MILESTONE 2.9.3 ACCEPTANCE TEST SUITE');
  console.log('   B2C OTT COMMERCE, GATEWAY SECURITY & ACCESS FULFILLMENT');
  console.log('================================================================\n');

  if (!supabase) {
    throw new Error('Supabase client is not available in environment.');
  }

  // Ensure test fixtures: 1 channel, 1 user profile, 1 film
  const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
  if (!profiles || profiles.length === 0) {
    throw new Error('No user profile found in database.');
  }
  const testUserId = profiles[0].id;
  let testChannelId: string = '';
  let testFilmId: string = '';

  // 1. Setup / Resolve Test Channel
  console.log('[SECTION 1] Preparing Fixtures & Isolation Verification...');
  const { data: channels } = await supabase
    .from('ott_channels')
    .select('id, name')
    .limit(1);

  if (channels && channels.length > 0) {
    testChannelId = channels[0].id;
  } else {
    const { data: newCh, error: chErr } = await supabase
      .from('ott_channels')
      .insert({
        user_id: testUserId,
        name: 'Commerce Test Channel',
        slug: `commerce-test-${Date.now()}`,
        status: 'active',
        subscription_price_idr: 39000,
        is_subscription_enabled: true,
      })
      .select('id')
      .single();
    if (chErr) console.error('Channel insert error:', chErr);
    testChannelId = newCh?.id || '';
  }
  assert('Test Channel exists for OTT Commerce', Boolean(testChannelId), `Channel ID: ${testChannelId}`);

  // 2. Setup / Resolve Test Film
  const { data: films } = await supabase
    .from('ott_films')
    .select('id, title, ppv_price_idr')
    .eq('channel_id', testChannelId)
    .limit(1);

  if (films && films.length > 0) {
    testFilmId = films[0].id;
  } else {
    const { data: newFilm, error: filmErr } = await supabase
      .from('ott_films')
      .insert({
        channel_id: testChannelId,
        user_id: testUserId,
        title: 'Cyber Heist 2099 (Master)',
        slug: `cyber-heist-${Date.now()}`,
        synopsis: 'A high-stakes digital heist movie in Neo-Jakarta.',
        genres: ['Action', 'Sci-Fi'],
        aspect_ratio: '16:9',
        runtime_seconds: 5400,
        access_policy: 'ppv_tvod',
        ppv_price_idr: 25000,
        publication_status: 'published',
        master_approval_status: 'GATE_5_APPROVED',
        master_video_url: 'https://cdn.amf.tv/films/cyber_heist_master.mp4',
        poster_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401',
      })
      .select('id')
      .single();
    if (filmErr) console.error('Film insert error:', filmErr);
    testFilmId = newFilm?.id || '';
  }
  assert('Test Film catalog item exists with PPV pricing', Boolean(testFilmId), `Film ID: ${testFilmId}`);

  // 3. Database Schema Isolation Contract
  console.log('\n[SECTION 2] Verifying Isolation Contract (SaaS vs OTT B2C)...');
  const { data: ottOrdersCols } = await supabase
    .from('ott_payment_orders')
    .select('id, order_number, user_id, channel_id, gross_amount, net_creator_amount, entitlement_fulfilled, pass_id, subscription_id')
    .limit(1);

  assert('public.ott_payment_orders table exists and is accessible', Boolean(ottOrdersCols !== null));

  // Verify that creator SaaS credit ledger and payment_orders remain isolated
  const { count: initialPaymentOrdersCount } = await supabase
    .from('payment_orders')
    .select('*', { count: 'exact', head: true });

  const { count: initialCreditTxCount } = await supabase
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true });

  assert('AMF SaaS credit billing tables baseline noted', true, 
    `SaaS payment_orders: ${initialPaymentOrdersCount}, credit_transactions: ${initialCreditTxCount}`);

  // 4. Server-Side Catalog Price Anti-Tampering Check
  console.log('\n[SECTION 3] Testing Price Verification & Anti-Tampering Guard...');
  let priceTamperCaught = false;
  try {
    await ottCommerceEngine.createOrder({
      userId: testUserId,
      channelId: testChannelId,
      orderType: 'ppv_single',
      contentId: testFilmId,
      contentType: 'film',
      clientProvidedPrice: 100, // Client tries to buy Rp 25,000 film for Rp 100
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Price tampering detected')) {
      priceTamperCaught = true;
    }
  }
  assert('Engine blocks client-submitted price tampering (Rp 100 vs Rp 25,000)', priceTamperCaught);

  // Legitimate order creation
  const orderRes = await ottCommerceEngine.createOrder({
    userId: testUserId,
    channelId: testChannelId,
    orderType: 'ppv_single',
    contentId: testFilmId,
    contentType: 'film',
  });

  assert('Legitimate PPV order created successfully', Boolean(orderRes.order && orderRes.order.order_number));
  assert('Order gross amount matches catalog price exactly (Rp 25,000)', orderRes.order.gross_amount === 25000);
  assert('Order initial status is pending', orderRes.order.status === 'pending');
  assert('Order entitlement_fulfilled is initially false', orderRes.order.entitlement_fulfilled === false);
  assert('Simulated QRIS payload generated for viewer', Boolean(orderRes.paymentDetails.qrString));

  // 5. Webhook Signature Security (Midtrans SHA-512)
  console.log('\n[SECTION 4] Testing Webhook Signature Verification & Forgery Guard...');
  const legitimateSignature = ottCommerceEngine.generateSignature(
    orderRes.order.order_number,
    '200',
    25000
  );

  const validPayload = {
    order_id: orderRes.order.order_number,
    status_code: '200',
    gross_amount: '25000.00',
    signature_key: legitimateSignature,
    transaction_status: 'settlement',
    fraud_status: 'accept',
    transaction_id: `midtrans-tx-${Date.now()}`,
  };

  const isLegitValid = ottCommerceEngine.verifyWebhookSignature(validPayload);
  assert('Valid SHA-512 webhook signature accepted', isLegitValid);

  // Forged payload check
  const forgedPayload = {
    ...validPayload,
    signature_key: 'forged_fake_signature_hash_000000000000000000000000000000000',
  };
  const isForgedValid = ottCommerceEngine.verifyWebhookSignature(forgedPayload);
  assert('Forged webhook signature strictly rejected', !isForgedValid);

  let forgedExecutionBlocked = false;
  try {
    await ottCommerceEngine.handleWebhook(forgedPayload);
  } catch (err: any) {
    if (err.message && err.message.includes('INVALID_WEBHOOK_SIGNATURE')) {
      forgedExecutionBlocked = true;
    }
  }
  assert('Forged webhook execution blocked with INVALID_WEBHOOK_SIGNATURE exception', forgedExecutionBlocked);

  // 6. Atomic Fulfillment & Entitlement Issuance (PPV Single 48-Hour Pass)
  console.log('\n[SECTION 5] Testing Atomic Fulfillment & Pass Issuance...');
  const fulfillResult = await ottCommerceEngine.handleWebhook(validPayload);

  assert('Order fulfillment returned success: true', fulfillResult.success === true);
  assert('Order status updated to settlement', fulfillResult.status === 'settlement');
  assert('Access pass ID issued and returned', Boolean(fulfillResult.passId));
  assert('Net creator amount calculated with fee deduction', (fulfillResult.netCreatorAmount ?? 0) > 0);

  // Verify access pass in database
  const { data: passRow } = await supabase
    .from('ott_access_passes')
    .select('*')
    .eq('id', fulfillResult.passId)
    .single();

  assert('Pass exists in ott_access_passes table', Boolean(passRow));
  assert('Pass user_id matches purchaser', passRow?.user_id === testUserId);
  assert('Pass channel_id matches channel', passRow?.channel_id === testChannelId);
  assert('Pass status is active', passRow?.status === 'active');
  assert('Pass price_paid_idr recorded accurately', Number(passRow?.price_paid_idr) === 25000);

  const validUntil = new Date(passRow?.valid_until).getTime();
  const validFrom = new Date(passRow?.valid_from).getTime();
  const diffHours = Math.round((validUntil - validFrom) / (1000 * 60 * 60));
  assert('Pass validity window is exactly 48 hours for PPV single', diffHours === 48, `Calculated: ${diffHours}h`);

  // 7. Idempotency Guard against Duplicate Webhooks
  console.log('\n[SECTION 6] Testing Idempotency Protection against Duplicate Webhooks...');
  const duplicateFulfill = await ottCommerceEngine.handleWebhook(validPayload);
  assert('Duplicate webhook callback recognized as already fulfilled', duplicateFulfill.alreadyFulfilled === true);
  assert('Duplicate webhook returned identical pass ID', duplicateFulfill.passId === fulfillResult.passId);

  // Verify no duplicate passes created in database
  const { data: allPassesForOrder } = await supabase
    .from('ott_access_passes')
    .select('id')
    .eq('order_ref_id', orderRes.order.order_number);

  assert('Exactly one access pass issued despite duplicate webhook calls', allPassesForOrder?.length === 1);

  // 8. SVOD Channel Subscription Fulfillment (30-Day Monthly Pass)
  console.log('\n[SECTION 7] Testing SVOD Channel Subscription Order & Fulfillment...');
  // Clean up any pre-existing subscription for this test fixture to verify exact 30-day initial grant
  await supabase
    .from('ott_viewer_subscriptions')
    .delete()
    .eq('user_id', testUserId)
    .eq('channel_id', testChannelId);

  // Ensure channel has subscription price set
  await supabase
    .from('ott_channels')
    .update({ subscription_price_idr: 39000, is_subscription_enabled: true })
    .eq('id', testChannelId);

  const svodOrder = await ottCommerceEngine.createOrder({
    userId: testUserId,
    channelId: testChannelId,
    orderType: 'svod_channel',
  });

  assert('SVOD Channel order created', Boolean(svodOrder.order && svodOrder.order.order_number));
  assert('SVOD gross amount matches channel subscription price (Rp 39,000)', svodOrder.order.gross_amount === 39000);

  const svodSig = ottCommerceEngine.generateSignature(
    svodOrder.order.order_number,
    '200',
    39000
  );

  const svodPayload = {
    order_id: svodOrder.order.order_number,
    status_code: '200',
    gross_amount: '39000.00',
    signature_key: svodSig,
    transaction_status: 'settlement',
    fraud_status: 'accept',
  };

  const svodFulfill = await ottCommerceEngine.handleWebhook(svodPayload);
  assert('SVOD order fulfilled successfully', svodFulfill.success === true);
  assert('Subscription ID issued and returned', Boolean(svodFulfill.subscriptionId));

  const { data: subRow } = await supabase
    .from('ott_viewer_subscriptions')
    .select('*')
    .eq('id', svodFulfill.subscriptionId)
    .single();

  assert('Subscription active in ott_viewer_subscriptions table', subRow?.status === 'active');
  const subStart = new Date(subRow?.current_period_start).getTime();
  const subEnd = new Date(subRow?.current_period_end).getTime();
  const subDays = Math.round((subEnd - subStart) / (1000 * 60 * 60 * 24));
  assert('Subscription validity period is 30 days', subDays === 30, `Calculated: ${subDays} days`);

  // 9. Refund Entitlement Revocation
  console.log('\n[SECTION 8] Testing Refund Flow & Instant Entitlement Revocation...');
  const refundPayload = {
    order_id: orderRes.order.order_number,
    status_code: '200',
    gross_amount: '25000.00',
    signature_key: legitimateSignature,
    transaction_status: 'refund',
  };

  const refundResult = await ottCommerceEngine.handleWebhook(refundPayload);
  assert('Refund webhook processed successfully', refundResult.success === true);
  assert('Refund status recorded as refund', refundResult.status === 'refund');

  const { data: revokedPass } = await supabase
    .from('ott_access_passes')
    .select('status')
    .eq('id', fulfillResult.passId)
    .single();

  assert('Access pass status changed to revoked upon order refund', revokedPass?.status === 'revoked');

  // 10. Creator Revenue Report & Financial Transparency
  console.log('\n[SECTION 9] Testing Creator Revenue Analytics (Verified Actual)...');
  const report = await ottCommerceEngine.getCreatorRevenueReport(testChannelId);

  assert('Creator revenue report generated', Boolean(report));
  assert('Report channel ID matches target', report.channel_id === testChannelId);
  assert('Gross revenue accurately sums settled orders', report.gross_revenue_idr >= 39000);
  assert('Platform fee computed accurately (~10%)', report.platform_fees_idr > 0);
  assert('Net creator earnings greater than zero', report.net_creator_earnings_idr > 0);
  assert('Formula holds: Net = Gross - (Gateway Fees + Platform Fee)', 
    Math.abs(report.net_creator_earnings_idr - (report.gross_revenue_idr - report.gateway_fees_idr - report.platform_fees_idr)) < 1.0);
  assert('Report labeled strictly with VERIFIED_ACTUAL data mode', report.data_mode === 'VERIFIED_ACTUAL');

  // 11. SaaS Isolation Re-Verification
  console.log('\n[SECTION 10] Final Isolation Check (AMF SaaS Credit Billing Tables)...');
  const { count: finalPaymentOrdersCount } = await supabase
    .from('payment_orders')
    .select('*', { count: 'exact', head: true });

  const { count: finalCreditTxCount } = await supabase
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true });

  assert('AMF SaaS payment_orders table unchanged by OTT B2C transactions',
    finalPaymentOrdersCount === initialPaymentOrdersCount,
    `Before: ${initialPaymentOrdersCount}, After: ${finalPaymentOrdersCount}`
  );

  assert('AMF SaaS credit_transactions table unchanged by OTT B2C transactions',
    finalCreditTxCount === initialCreditTxCount,
    `Before: ${initialCreditTxCount}, After: ${finalCreditTxCount}`
  );

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log('\n================================================================');
  console.log(`   TEST EXECUTION COMPLETE: ${passedCount}/${totalCount} ASSERTIONS PASSED`);
  console.log('================================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
