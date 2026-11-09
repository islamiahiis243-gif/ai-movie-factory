/**
 * AI MOVIE FACTORY — FINANCIAL INFRASTRUCTURE & CREDIT HARDENING TEST SUITE
 * Validates:
 * 1. Unauthenticated request rejection (401)
 * 2. Invalid JWT rejection (401)
 * 3. Insufficient balance rejection (402)
 * 4. Sufficient balance reservation & settlement
 * 5. Concurrent requests & double spending prevention
 * 6. Provider failure automatic credit release (no credit lost)
 * 7. Double refund prevention
 * 8. Two-phase commit idempotency (double settle/release blocked)
 * 9. Payment webhook integrity & backward compatibility
 * 10. Usage metering extraction (tokens)
 */

import {
  _resetMemoryCreditStore,
  _setMemoryUserBalance,
  getUserCreditBalance,
  reserveUserCredits,
  settleUserCredits,
  releaseUserCredits,
  recordAiUsage,
} from '../api/lib/credits/creditEngine';
import aiGenerateHandler from '../api/ai-generate';
import creditBalanceHandler from '../api/credits/balance';
import creditTransactionHandler from '../api/credits/transaction';
import paymentWebhookHandler, { verifyMidtransSignature } from '../api/payment-webhook';
import {
  calculateProviderCost,
  PROVIDER_PRICING_REGISTRY,
  convertUsdToIdr
} from '../api/lib/cost/providerCostEngine';
import {
  runPricingSimulation,
  SIMULATION_SCENARIOS
} from '../api/lib/cost/pricingSimulator';
import financialAnalyticsHandler from '../api/admin/financial-analytics';

function createMockReqRes(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req = {
    method: options.method || 'POST',
    headers: options.headers || {},
    body: options.body || {},
    query: {},
  };

  let statusCode = 200;
  let responseData: any = null;
  const headersSent: Record<string, string> = {};

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headersSent[name] = value;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    _getStatusCode: () => statusCode,
    _getData: () => responseData,
  };

  return { req, res };
}

async function runFinancialHardeningTests() {
  console.log('========================================================================');
  console.log('AI MOVIE FACTORY — FINANCIAL INFRASTRUCTURE HARDENING TEST SUITE (PHASE 2)');
  console.log('========================================================================\n');

  _resetMemoryCreditStore();

  // -------------------------------------------------------------------------
  // TEST 1: Request without JWT rejected with 401 Unauthorized
  // -------------------------------------------------------------------------
  console.log('=== TEST 1: Request Without JWT Authentication Guard ===');
  {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { prompt: 'Tuliskan adegan pembuka film' },
    });
    await aiGenerateHandler(req, res);
    if (res._getStatusCode() !== 401) {
      throw new Error(`Expected 401 on missing JWT, got ${res._getStatusCode()}`);
    }
    const data = res._getData();
    if (data.error !== 'UNAUTHORIZED') {
      throw new Error(`Expected error 'UNAUTHORIZED', got ${JSON.stringify(data)}`);
    }
    console.log('✔ POST /api/ai-generate strictly rejects unauthenticated request (401 Unauthorized)');

    const { req: balReq, res: balRes } = createMockReqRes({
      method: 'GET',
    });
    await creditBalanceHandler(balReq, balRes);
    if (balRes._getStatusCode() !== 401) {
      throw new Error(`Expected 401 on /api/credits/balance, got ${balRes._getStatusCode()}`);
    }
    console.log('✔ GET /api/credits/balance strictly rejects unauthenticated request (401 Unauthorized)');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Request with Invalid JWT rejected with 401
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 2: Request With Invalid / Malformed JWT Guard ===');
  {
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer invalid_tampered_token_xyz' },
      body: { prompt: 'Tuliskan adegan' },
    });
    await aiGenerateHandler(req, res);
    if (res._getStatusCode() !== 401) {
      throw new Error(`Expected 401 on invalid JWT, got ${res._getStatusCode()}`);
    }
    console.log('✔ POST /api/ai-generate strictly rejects invalid/expired token (401 Unauthorized)');
  }

  // -------------------------------------------------------------------------
  // TEST 3: User with Insufficient Balance Rejected with 402 Payment Required
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 3: Insufficient Balance Rejection (402 Payment Required) ===');
  {
    const zeroBalanceUserId = 'usr_broke_001';
    _setMemoryUserBalance(zeroBalanceUserId, 2); // only 2 credits

    try {
      await reserveUserCredits({
        adminSupabase: null,
        userId: zeroBalanceUserId,
        amount: 10, // requires 10 credits
        operation: 'ai_script_outline',
      });
      throw new Error('Expected reservation to fail with insufficient credits');
    } catch (err: any) {
      if (err.status !== 402 && err.code !== 'INSUFFICIENT_CREDITS') {
        throw new Error(`Expected 402 INSUFFICIENT_CREDITS, got: ${err.message}`);
      }
      console.log(`✔ Insufficient balance rejected: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 4: User with Sufficient Balance Successfully Reserves and Settles
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 4: Sufficient Balance Reservation & Settlement Lifecycle ===');
  {
    const normalUserId = 'usr_funded_002';
    _setMemoryUserBalance(normalUserId, 150);

    const reservation = await reserveUserCredits({
      adminSupabase: null,
      userId: normalUserId,
      amount: 15,
      operation: 'ai_script_outline',
      idempotencyKey: 'idemp_test_4',
    });

    if (reservation.status !== 'reserved' || !reservation.reservationId) {
      throw new Error(`Expected active reservation, got: ${JSON.stringify(reservation)}`);
    }

    // Available balance should now be 135 (150 - 15 on hold)
    const midBal = await getUserCreditBalance(null, normalUserId);
    if (midBal.availableBalance !== 135 || midBal.reservedBalance !== 15) {
      throw new Error(`Expected available 135 & reserved 15, got: ${JSON.stringify(midBal)}`);
    }
    console.log(`✔ Credit reserved (Hold: 15 cr, Available: ${midBal.availableBalance} cr)`);

    // Settle credits
    const settled = await settleUserCredits({
      adminSupabase: null,
      reservationId: reservation.reservationId,
      actualAmount: 15,
      description: 'Generasi Naskah Episode 1',
    });

    if (settled.status !== 'settled' || settled.newBalance !== 135) {
      throw new Error(`Expected settled balance 135, got: ${JSON.stringify(settled)}`);
    }

    const finalBal = await getUserCreditBalance(null, normalUserId);
    if (finalBal.settledBalance !== 135 || finalBal.reservedBalance !== 0) {
      throw new Error(`Expected settled 135, reserved 0, got: ${JSON.stringify(finalBal)}`);
    }
    console.log(`✔ Credit settled atomically (Final Settled: ${finalBal.settledBalance} cr, Reserved: 0)`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Concurrent Requests & Double Spending Prevention
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 5: Concurrent Requests & Race-Condition Double Spending Defense ===');
  {
    const raceUserId = 'usr_race_003';
    _setMemoryUserBalance(raceUserId, 20); // exactly 20 credits

    // 4 concurrent requests trying to reserve 10 credits each (total 40 credits requested, only 20 available)
    const attempts = [1, 2, 3, 4].map(i =>
      reserveUserCredits({
        adminSupabase: null,
        userId: raceUserId,
        amount: 10,
        operation: `ai_operation_${i}`,
        idempotencyKey: `race_tx_${i}`,
      })
        .then(res => ({ success: true, res }))
        .catch(err => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(attempts);
    const successCount = results.filter(r => r.success).length;
    const rejectedCount = results.filter(r => !r.success).length;

    if (successCount !== 2 || rejectedCount !== 2) {
      throw new Error(
        `Expected exactly 2 successes and 2 rejections out of 4, got ${successCount} success and ${rejectedCount} rejected`
      );
    }

    const raceBal = await getUserCreditBalance(null, raceUserId);
    if (raceBal.availableBalance !== 0 || raceBal.reservedBalance !== 20) {
      throw new Error(`Expected available 0, reserved 20, got: ${JSON.stringify(raceBal)}`);
    }

    console.log(`✔ Concurrency handled: Exactly ${successCount} succeeded and ${rejectedCount} rejected (Available: ${raceBal.availableBalance} cr, Overdraft Prevented)`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Provider Failure Triggers Automatic Credit Release (No Loss)
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 6: Provider Failure / Timeout Rollback (No Credit Loss) ===');
  {
    const failUserId = 'usr_fail_004';
    _setMemoryUserBalance(failUserId, 50);

    const hold = await reserveUserCredits({
      adminSupabase: null,
      userId: failUserId,
      amount: 25,
      operation: 'ai_character_design',
    });

    const midBal = await getUserCreditBalance(null, failUserId);
    if (midBal.availableBalance !== 25) {
      throw new Error('Hold failed');
    }

    // Simulate provider failure -> release credits
    const releaseResult = await releaseUserCredits({
      adminSupabase: null,
      reservationId: hold.reservationId,
      reason: 'Google Gemini 504 Gateway Timeout Simulation',
    });

    if (releaseResult.status !== 'released' || releaseResult.availableBalance !== 50) {
      throw new Error(`Expected released balance 50, got: ${JSON.stringify(releaseResult)}`);
    }

    const restoredBal = await getUserCreditBalance(null, failUserId);
    if (restoredBal.availableBalance !== 50 || restoredBal.reservedBalance !== 0) {
      throw new Error(`Expected fully restored 50 credits, got: ${JSON.stringify(restoredBal)}`);
    }

    console.log(`✔ Provider failure rollback verified: All 25 held credits restored to available balance (${restoredBal.availableBalance} cr)`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Double Settlement & Double Release Prevention
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 7: Two-Phase Commit State Machine Invariants ===');
  {
    const stateUserId = 'usr_state_005';
    _setMemoryUserBalance(stateUserId, 100);

    const hold = await reserveUserCredits({
      adminSupabase: null,
      userId: stateUserId,
      amount: 10,
      operation: 'ai_test',
    });

    await settleUserCredits({
      adminSupabase: null,
      reservationId: hold.reservationId,
      actualAmount: 10,
    });

    // Attempt second settlement (should be idempotent / return already_settled without deducting again)
    const secondSettle = await settleUserCredits({
      adminSupabase: null,
      reservationId: hold.reservationId,
      actualAmount: 10,
    });

    if (secondSettle.status !== 'already_settled' || secondSettle.newBalance !== 90) {
      throw new Error(`Second settle deducted credits again! Balance: ${secondSettle.newBalance}`);
    }

    // Attempt to release an already settled reservation (must be strictly rejected)
    try {
      await releaseUserCredits({
        adminSupabase: null,
        reservationId: hold.reservationId,
      });
      throw new Error('Expected release on settled reservation to fail');
    } catch (err: any) {
      if (!err.message.includes('CANNOT_RELEASE_SETTLED')) {
        throw new Error(`Unexpected error on releasing settled: ${err.message}`);
      }
      console.log(`✔ Releasing settled reservation strictly rejected: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 8: Payment Webhook Backward Compatibility & Midtrans SHA-512 Verification
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 8: Payment Webhook Cryptographic Verification & Compatibility ===');
  {
    const serverKey = 'SB-Mid-server-TEST998877';
    const orderId = 'AMF-SUB-MOCK-999';
    const statusCode = '200';
    const grossAmount = '149000.00';

    const crypto = await import('crypto');
    const validSignature = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    const isValid = verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey,
      signatureKey: validSignature,
    });

    if (!isValid) throw new Error('Valid Midtrans signature was rejected');

    const isTampered = verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount: '99000.00', // tampered amount
      serverKey,
      signatureKey: validSignature,
    });

    if (isTampered) throw new Error('Tampered Midtrans payload was accepted');
    console.log('✔ Midtrans SHA-512 signature verified and tampered payload strictly rejected');

    // Test payment-webhook record_usage overdraft rejection (401/402/503 depending on Supabase server key availability)
    const { req: ovReq, res: ovRes } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'record_usage',
        amount: 500, // exceeds balance
      },
    });
    await paymentWebhookHandler(ovReq, ovRes);
    const code = ovRes._getStatusCode();
    if (code !== 401 && code !== 402 && code !== 503) {
      throw new Error(`Expected 401, 402, or 503 on unauthenticated record_usage, got ${code}`);
    }
    console.log(`✔ payment-webhook unauthenticated/unconfigured guard active (HTTP ${code})`);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Usage Metering Telemetry Storage
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 9: Usage Metering Data Contract & Token Verification ===');
  {
    let recordedData: any = null;
    const mockAdminSupabase: any = {
      from(table: string) {
        return {
          insert(payload: any) {
            recordedData = payload;
            return Promise.resolve({ error: null });
          },
        };
      },
    };

    await recordAiUsage(mockAdminSupabase, {
      userId: 'usr_metering_006',
      projectId: 'proj_001',
      operation: 'ai_script_outline',
      provider: 'google_gemini',
      model: 'gemini-2.5-flash',
      promptTokens: 420,
      candidatesTokens: 185,
      totalTokens: 605,
      durationSeconds: 1.45,
      creditsReserved: 5,
      creditsCharged: 5,
      costStatus: 'free_tier',
      rawUsageMetadata: { promptTokenCount: 420, candidatesTokenCount: 185 },
    });

    if (!recordedData || recordedData.total_tokens !== 605 || recordedData.prompt_tokens !== 420) {
      throw new Error(`Usage metering recording failed: ${JSON.stringify(recordedData)}`);
    }

    if (recordedData.cost_status !== 'free_tier') {
      throw new Error(`Expected cost_status 'free_tier', got ${recordedData.cost_status}`);
    }

    console.log(`✔ Usage metering verified: 420 prompt tokens + 185 candidate tokens = 605 total tokens recorded with cost_status='free_tier'`);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Provider Cost Engine (Rates, Free Tier $0.00, Paid-Equivalent)
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 10: Provider Cost Engine & Gemini Free/Paid Rates ===');
  {
    // Test Gemini 2.5 Flash on Free Tier
    const freeResult = calculateProviderCost({
      provider: 'google_gemini',
      model: 'gemini-2.5-flash',
      promptTokens: 10000, // 10k tokens
      candidatesTokens: 5000, // 5k tokens
      isFreeTierActive: true,
      exchangeRateIdr: 16000,
    });

    if (freeResult.providerActualCostUsd !== 0 || freeResult.providerActualCostIdr !== 0) {
      throw new Error(`Expected Free Tier billed cost to be $0.00, got ${freeResult.providerActualCostUsd}`);
    }

    if (freeResult.costStatus !== 'free_tier') {
      throw new Error(`Expected costStatus 'free_tier', got ${freeResult.costStatus}`);
    }

    // Expected paid-equivalent for 2.5 Flash:
    // Input: 10,000 * $0.075 / 1,000,000 = $0.00075
    // Output: 5,000 * $0.30 / 1,000,000 = $0.00150
    // Total: $0.00225
    const expectedPaidUsd = 0.00225;
    if (Math.abs(freeResult.paidEquivalentCostUsd - expectedPaidUsd) > 0.00001) {
      throw new Error(`Expected paidEquivalentCostUsd ~${expectedPaidUsd}, got ${freeResult.paidEquivalentCostUsd}`);
    }

    if (freeResult.paidEquivalentCostIdr !== Math.round(expectedPaidUsd * 16000)) {
      throw new Error(`Expected paidEquivalentCostIdr ${Math.round(expectedPaidUsd * 16000)}, got ${freeResult.paidEquivalentCostIdr}`);
    }

    // Test Gemini 2.5 Flash on Paid Tier
    const paidResult = calculateProviderCost({
      provider: 'google_gemini',
      model: 'gemini-2.5-flash',
      promptTokens: 10000,
      candidatesTokens: 5000,
      isFreeTierActive: false,
      exchangeRateIdr: 16000,
    });

    if (paidResult.providerActualCostUsd !== expectedPaidUsd) {
      throw new Error(`Expected Paid Tier billed cost to match paid equivalent, got ${paidResult.providerActualCostUsd}`);
    }
    if (paidResult.costStatus !== 'metered_real') {
      throw new Error(`Expected costStatus 'metered_real', got ${paidResult.costStatus}`);
    }

    // Test Mock Media Generation
    const mockMediaResult = calculateProviderCost({
      provider: 'mock_simulated',
      model: 'mock-video-v1',
      videoDurationSeconds: 60,
    });
    if (mockMediaResult.costStatus !== 'mock_simulated' || mockMediaResult.providerActualCostUsd !== 0) {
      throw new Error(`Expected mock media costStatus 'mock_simulated' with $0.00 cost`);
    }

    console.log(`✔ Provider Cost Engine verified: Gemini Free Tier Billed = $0.00, Paid-Equivalent = $${freeResult.paidEquivalentCostUsd.toFixed(5)} (${freeResult.paidEquivalentCostIdr} IDR), Paid Tier Billed = $${paidResult.providerActualCostUsd.toFixed(5)}, Mock Media = $0.00`);
  }

  // -------------------------------------------------------------------------
  // TEST 11: Pricing Simulator (4 Tiers, 5 Scenarios, Free vs Paid)
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 11: Pricing Simulator Multi-Tier & Sensitivity Scenarios ===');
  {
    const scenarioKeys = Object.keys(SIMULATION_SCENARIOS);
    if (scenarioKeys.length !== 5) {
      throw new Error(`Expected 5 sensitivity scenarios, found ${scenarioKeys.length}`);
    }

    // Run across all 5 scenarios with gemini_free
    for (const key of scenarioKeys) {
      const simOutput = runPricingSimulation({
        scenarioKey: key,
        providerMode: 'gemini_free',
      });

      if (!simOutput || Object.keys(simOutput.tierResults).length !== 4) {
        throw new Error(`Simulation failed for scenario ${key}`);
      }
      if (simOutput.totalProviderBilledCostIdr !== 0) {
        throw new Error(`Expected Rp 0 provider cost for gemini_free in scenario ${key}, got ${simOutput.totalProviderBilledCostIdr}`);
      }
      if (simOutput.totalFreeTierSubsidyIdr <= 0) {
        throw new Error(`Expected positive free tier subsidy in scenario ${key}`);
      }
      if (simOutput.overallGrossMarginPercent < 90) {
        throw new Error(`Expected >90% margin in gemini_free mode for scenario ${key}`);
      }
    }

    // Run normal scenario with gemini_paid to verify margin sustainability
    const paidSim = runPricingSimulation({
      scenarioKey: 'normal',
      providerMode: 'gemini_paid',
    });

    if (paidSim.totalProviderBilledCostIdr <= 0) {
      throw new Error(`Expected positive provider cost in gemini_paid mode`);
    }
    // With 1500 credits at Rp149k and Gemini Flash rates, gross margin should still be >80%
    if (paidSim.overallGrossMarginPercent < 80) {
      throw new Error(`Expected robust margin (>80%) even under gemini_paid, got ${paidSim.overallGrossMarginPercent}%`);
    }

    console.log(`✔ Pricing Simulator verified across all 5 sensitivity scenarios. Gemini Free Margin: 100%, Gemini Paid Margin: ${paidSim.overallGrossMarginPercent}%, Projected Gross Profit: Rp ${paidSim.overallGrossProfitIdr.toLocaleString('id-ID')}`);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Admin Financial Analytics Endpoint (Security & Action Routing)
  // -------------------------------------------------------------------------
  console.log('\n=== TEST 12: Admin Financial Analytics Endpoint (401/403/200) ===');
  {
    // 1. Unauthenticated -> 401
    const { req: unauthReq, res: unauthRes } = createMockReqRes({
      method: 'POST',
      body: { action: 'overview' },
    });
    await financialAnalyticsHandler(unauthReq, unauthRes);
    if (unauthRes._getStatusCode() !== 401) {
      throw new Error(`Expected 401 on unauthenticated analytics call, got ${unauthRes._getStatusCode()}`);
    }

    // 2. Non-admin user -> 403
    const { req: nonAdminReq, res: nonAdminRes } = createMockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer mock_token_creator' },
      body: { action: 'overview' },
    });
    (nonAdminReq as any)._testUser = { id: 'usr_non_admin_001', email: 'creator@example.com' };
    (nonAdminReq as any)._testAdminClient = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle() {
                    return Promise.resolve({ data: { role: 'user', email: 'creator@example.com' } });
                  },
                };
              },
            };
          },
        };
      },
    };
    await financialAnalyticsHandler(nonAdminReq, nonAdminRes);
    if (nonAdminRes._getStatusCode() !== 403) {
      throw new Error(`Expected 403 on non-admin analytics call, got ${nonAdminRes._getStatusCode()}`);
    }

    // 3. Admin user running simulation -> 200
    const { req: adminReq, res: adminRes } = createMockReqRes({
      method: 'POST',
      headers: { authorization: 'Bearer mock_token_admin' },
      body: {
        action: 'run_simulation',
        scenarioKey: 'normal',
        providerMode: 'gemini_free',
      },
    });
    (adminReq as any)._testUser = { id: 'usr_admin_001', email: 'islamiahiis243@gmail.com' };
    (adminReq as any)._testAdminClient = {
      from() {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { role: 'admin' } }) }) }),
        };
      },
    };
    await financialAnalyticsHandler(adminReq, adminRes);
    if (adminRes._getStatusCode() !== 200) {
      throw new Error(`Expected 200 on admin run_simulation, got ${adminRes._getStatusCode()}`);
    }
    const adminData = adminRes._getData();
    if (!adminData.success || !adminData.simulation) {
      throw new Error(`Expected valid simulation output in admin response`);
    }

    console.log(`✔ Admin Financial Analytics API verified: 401 unauthenticated guard, 403 non-admin guard, 200 simulation execution`);
  }

  console.log('\n========================================================================');
  console.log('✅ ALL 12 FINANCIAL INFRASTRUCTURE & HARDENING TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================');
}

runFinancialHardeningTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
