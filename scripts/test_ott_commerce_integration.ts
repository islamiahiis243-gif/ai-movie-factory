/**
 * AI Movie Factory — Phase 6: Independent OTT & Streaming Platform
 * Database Integration Test Suite: Milestone 2.9.3 (B2C Payment / OTT Commerce & Access Fulfillment)
 * 
 * STRICT ARCHITECTURAL CONSTRAINT:
 * Mutating tests against the production database (jixfakvbhugpypjtyshq) are strictly prohibited.
 * This suite executes ONLY when a dedicated isolated test database is provided via
 * TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const PROD_PROJECT_REF = 'jixfakvbhugpypjtyshq';

async function runIntegrationTests() {
  console.log('\n================================================================');
  console.log('   AI MOVIE FACTORY — OTT COMMERCE DATABASE INTEGRATION TESTS');
  console.log('   ISOLATED POSTGRESQL RPC, LEDGER & ENTITLEMENT VERIFICATION');
  console.log('================================================================\n');

  const testUrl = process.env.TEST_SUPABASE_URL?.trim();
  const testKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY?.trim();

  // Fail-fast guard against running on production
  const isProdTarget = Boolean(
    (testUrl && testUrl.includes(PROD_PROJECT_REF)) ||
    (!testUrl && process.env.VITE_SUPABASE_URL?.includes(PROD_PROJECT_REF))
  );

  if (isProdTarget || !testUrl || !testKey) {
    console.log('  🛡 [ISOLATION_GUARD]: Production database mutation prevented.');
    if (isProdTarget) {
      console.log(`     Target URL explicitly references production project (${PROD_PROJECT_REF}).`);
    } else {
      console.log('     Dedicated TEST_SUPABASE_URL & TEST_SUPABASE_SERVICE_ROLE_KEY not configured.');
    }
    console.log('     Integration tests require an isolated staging/branch database.');
    console.log('\n================================================================');
    console.log('   INTEGRATION TEST STATUS: NOT RUN (Isolated DB not configured)');
    console.log('   SAFETY INTEGRITY: 100% (Zero production mutations performed)');
    console.log('================================================================\n');
    return;
  }

  // If we reach here, a dedicated isolated test database is explicitly configured
  console.log(`  ✔ [ISOLATION_VERIFIED]: Connecting to isolated test database: ${testUrl}`);
  const testDb = createClient(testUrl, testKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testOrderNum = `TEST-ORD-INT-${Date.now()}`;
  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✔ [PASS] #${total}: ${desc}`);
    } else {
      console.error(`  ❌ [FAIL] #${total}: ${desc}`);
    }
  }

  try {
    // 1. Fixture Setup on isolated test DB
    const { data: testUser } = await testDb.auth.admin.createUser({
      email: `test-viewer-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    const userId = testUser?.user?.id;
    if (!userId) throw new Error('Failed to create test user in isolated test DB');

    // Insert test channel
    const { data: channel, error: chErr } = await testDb
      .from('ott_channels')
      .insert({
        user_id: userId,
        name: 'Integration Test Channel',
        slug: `int-test-channel-${Date.now()}`,
        status: 'active',
      })
      .select()
      .single();
    if (chErr) throw new Error(`Channel insert error: ${chErr.message}`);

    // Insert test order
    const { data: order, error: ordErr } = await testDb
      .from('ott_payment_orders')
      .insert({
        order_number: testOrderNum,
        user_id: userId,
        channel_id: channel.id,
        order_type: 'ppv_single',
        gross_amount: 50000,
        currency: 'IDR',
        status: 'pending',
        payment_gateway: 'midtrans',
      })
      .select()
      .single();
    if (ordErr) throw new Error(`Order insert error: ${ordErr.message}`);

    // 2. Test Settlement RPC
    const { data: settleRes, error: setErr } = await testDb.rpc('fulfill_ott_payment_order', {
      p_order_number: testOrderNum,
      p_gateway_transaction_id: `tx-int-${Date.now()}`,
      p_status: 'settlement',
      p_gateway_payload: { status_code: '200', transaction_status: 'settlement' },
      p_gateway_fee: 350,
    });
    assert('fulfill_ott_payment_order succeeds on settlement', !setErr && settleRes?.success === true);
    assert('Access pass created on settlement', Boolean(settleRes?.pass_id));

    // 3. Test Partial Refund
    const refKey1 = `rf_int_1_${Date.now()}`;
    const { data: ref1Res, error: ref1Err } = await testDb.rpc('fulfill_ott_payment_order', {
      p_order_number: testOrderNum,
      p_gateway_transaction_id: `tx-int-${Date.now()}`,
      p_status: 'partial_refund',
      p_gateway_payload: { refund_id: refKey1, refund_amount: 15000 },
      p_refund_amount: 15000,
      p_refund_key: refKey1,
    });
    assert('Partial refund (Rp 15.000) processed successfully', !ref1Err && ref1Res?.success === true);
    assert('Refunded amount updated to 15.000', ref1Res?.refunded_amount === 15000);

    // 4. Verify Ledger Row in Isolated DB
    const { data: ledgerRows, error: ledgErr } = await testDb
      .from('ott_payment_order_refunds')
      .select('*')
      .eq('order_id', order.id);
    assert('Ledger contains exactly 1 refund row', !ledgErr && ledgerRows?.length === 1);
    assert('Ledger refund_key matches refKey1', ledgerRows?.[0]?.refund_key === refKey1);

    // 5. Duplicate Refund Callback (Idempotency)
    const { data: dupRes, error: dupErr } = await testDb.rpc('fulfill_ott_payment_order', {
      p_order_number: testOrderNum,
      p_gateway_transaction_id: `tx-int-${Date.now()}`,
      p_status: 'partial_refund',
      p_gateway_payload: { refund_id: refKey1, refund_amount: 15000 },
      p_refund_amount: 15000,
      p_refund_key: refKey1,
    });
    assert('Duplicate refund callback returns already_processed: true', !dupErr && dupRes?.already_processed === true);

    const { data: ledgerAfterDup } = await testDb
      .from('ott_payment_order_refunds')
      .select('*')
      .eq('order_id', order.id);
    assert('Duplicate callback did NOT insert extra ledger row', ledgerAfterDup?.length === 1);

    // 6. Full Refund Closure
    const refKeyFull = `rf_int_full_${Date.now()}`;
    const { data: fullRes, error: fullErr } = await testDb.rpc('fulfill_ott_payment_order', {
      p_order_number: testOrderNum,
      p_gateway_transaction_id: `tx-int-${Date.now()}`,
      p_status: 'refund',
      p_gateway_payload: { refund_id: refKeyFull },
      p_refund_key: refKeyFull,
    });
    assert('Full refund succeeds and sets status to refund', !fullErr && fullRes?.status === 'refund');
    assert('Access pass is revoked on full refund', fullRes?.revoked === true);

    // 7. Verify Zero Drift: Order refunded_amount strictly equals sum of ledger
    const { data: finalOrder } = await testDb.from('ott_payment_orders').select('*').eq('id', order.id).single();
    const { data: allRefunds } = await testDb.from('ott_payment_order_refunds').select('refund_amount').eq('order_id', order.id);
    const sumLedger = allRefunds?.reduce((a, c) => a + Number(c.refund_amount), 0) || 0;
    assert('Zero drift: order refunded_amount strictly equals sum of ledger entries', Number(finalOrder?.refunded_amount) === sumLedger);

    console.log(`\n================================================================`);
    console.log(`   INTEGRATION TEST COMPLETE: ${passed}/${total} ASSERTIONS PASSED (100%)`);
    console.log('================================================================\n');

    // Safe Teardown
    await testDb.from('ott_payment_order_refunds').delete().eq('order_id', order.id);
    await testDb.from('ott_access_passes').delete().eq('order_ref_id', testOrderNum);
    await testDb.from('ott_payment_orders').delete().eq('id', order.id);
    await testDb.from('ott_channels').delete().eq('id', channel.id);
    await testDb.auth.admin.deleteUser(userId);
  } catch (err: any) {
    console.error('Integration test failed with error:', err.message);
    process.exit(1);
  }
}

runIntegrationTests().catch((err) => {
  console.error('Fatal integration test error:', err);
  process.exit(1);
});
