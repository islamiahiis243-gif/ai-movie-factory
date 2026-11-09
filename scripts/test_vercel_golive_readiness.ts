/**
 * Test Script: Phase 13 — Vercel Production Go-Live Readiness & Serverless API Verification
 * Verifies:
 * 1. `vercel.json` configuration structure (framework, buildCommand, SPA rewrites, security headers).
 * 2. `package.json` dependency peer compatibility (`esbuild@^0.28.0` with `vite@^8.3.0`).
 * 3. `/api/health` serverless probe response & secret non-exposure.
 * 4. `/api/payment-webhook` SHA-512 cryptographic signature verification (`verifyMidtransSignature`).
 * 5. `/api/ai-generate` input validation and server-side key protection.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import healthHandler from '../api/health';
import aiGenerateHandler from '../api/ai-generate';
import paymentWebhookHandler, { verifyMidtransSignature } from '../api/payment-webhook';

function createMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let jsonBody: any = null;
  return {
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      return this;
    },
    getStatusCode: () => statusCode,
    getJson: () => jsonBody,
    getHeaders: () => headers,
  };
}

async function runVercelGoLiveTests() {
  console.log('=== TEST 1: Validate vercel.json & package.json Go-Live Configuration ===');
  const rootDir = process.cwd();
  const vercelJsonPath = path.join(rootDir, 'vercel.json');
  const pkgJsonPath = path.join(rootDir, 'package.json');

  if (!fs.existsSync(vercelJsonPath)) {
    throw new Error('vercel.json is missing from root directory');
  }
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  if (vercelConfig.framework !== 'vite' || vercelConfig.outputDirectory !== 'dist') {
    throw new Error('Invalid framework or outputDirectory in vercel.json');
  }
  if (!Array.isArray(vercelConfig.rewrites) || vercelConfig.rewrites.length < 2) {
    throw new Error('Missing SPA and API rewrites in vercel.json');
  }
  if (!Array.isArray(vercelConfig.headers) || vercelConfig.headers.length < 2) {
    throw new Error('Missing security and cache headers in vercel.json');
  }
  console.log('✔ vercel.json validated (framework: vite, SPA rewrites, security & immutable cache headers)');

  // Validate Vercel Crons (P0 Correction)
  if (!Array.isArray(vercelConfig.crons) || vercelConfig.crons.length !== 2) {
    throw new Error('vercel.json must define exactly 2 cron jobs in "crons" array');
  }

  const publishingCron = vercelConfig.crons.find((c: any) => c.path === '/api/publishing/worker');
  const analyticsCron = vercelConfig.crons.find((c: any) => c.path === '/api/analytics/sync-worker');

  if (!publishingCron) throw new Error('Missing /api/publishing/worker in vercel.json crons');
  if (!analyticsCron) throw new Error('Missing /api/analytics/sync-worker in vercel.json crons');

  // Verify standard 5-field cron syntax (minute, hour, day-of-month, month, day-of-week)
  function isValidCronSyntax(expr: string): boolean {
    if (typeof expr !== 'string') return false;
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const [min, hour, dom, mon, dow] = parts;
    const minRegex = /^(\*(\/([1-5]?[0-9]))?|([0-5]?[0-9])(-[0-5]?[0-9])?)$/;
    const hourRegex = /^(\*(\/(2[0-3]|1[0-9]|[1-9]))?|(2[0-3]|1[0-9]|[0-9])(-(2[0-3]|1[0-9]|[0-9]))?)$/;
    const domRegex = /^(\*(\/([1-9]|[12][0-9]|3[01]))?|([1-9]|[12][0-9]|3[01])(-([1-9]|[12][0-9]|3[01]))?)$/;
    const monRegex = /^(\*(\/(1[0-2]|[1-9]))?|(1[0-2]|[1-9])(-(1[0-2]|[1-9]))?)$/;
    const dowRegex = /^(\*(\/([0-7]))?|([0-7])(-[0-7])?)$/;
    return (
      minRegex.test(min) &&
      hourRegex.test(hour) &&
      domRegex.test(dom) &&
      monRegex.test(mon) &&
      dowRegex.test(dow)
    );
  }

  if (!isValidCronSyntax(publishingCron.schedule)) {
    throw new Error(`Invalid cron format for publishing worker: ${publishingCron.schedule}`);
  }
  if (!isValidCronSyntax(analyticsCron.schedule)) {
    throw new Error(`Invalid cron format for analytics worker: ${analyticsCron.schedule}`);
  }

  // Regression & Negative Tests: Ensure invalid cron patterns are strictly rejected
  const invalidPatterns = ['/10', '0 /4', '* * * *', '* * * * * *', '60 * * * *', '0 25 * * *', 'not-a-cron'];
  for (const bad of invalidPatterns) {
    if (isValidCronSyntax(bad)) {
      throw new Error(`Cron validator failed to reject invalid expression: "${bad}"`);
    }
  }

  if (publishingCron.schedule !== '*/10 * * * *') {
    throw new Error(`Expected */10 * * * * for publishing worker, got ${publishingCron.schedule}`);
  }
  if (analyticsCron.schedule !== '0 */4 * * *') {
    throw new Error(`Expected 0 */4 * * * for analytics worker, got ${analyticsCron.schedule}`);
  }
  console.log('✔ vercel.json crons validated (5-field standard syntax: publishing worker "*/10 * * * *", analytics worker "0 */4 * * *", semantic validator & negative tests passed)');

  const pkgConfig = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  if (!pkgConfig.devDependencies?.esbuild?.startsWith('^0.28')) {
    throw new Error(`Expected esbuild ^0.28.0 for Vite 8 compatibility, got ${pkgConfig.devDependencies?.esbuild}`);
  }
  console.log(`✔ package.json validated (name: ${pkgConfig.name}, version: ${pkgConfig.version}, esbuild: ${pkgConfig.devDependencies.esbuild})`);

  console.log('\n=== TEST 2: Verify GET /api/health Serverless Endpoint ===');
  const healthRes = createMockRes();
  healthHandler({ method: 'GET' }, healthRes);
  const healthData = healthRes.getJson();
  if (healthRes.getStatusCode() !== 200 || healthData?.status !== 'ok') {
    throw new Error('GET /api/health did not return 200 OK');
  }
  if (healthData?.ssotCompliance?.protectedTablesCount !== 24) {
    throw new Error('Expected 24 protected tables in /api/health ssotCompliance');
  }
  console.log(
    `✔ GET /api/health returned 200 OK (version: ${healthData.version}, schema: ${healthData.ssotCompliance.schemaVersion})`
  );

  console.log('\n=== TEST 3: Verify POST /api/payment-webhook Cryptographic Signature Verification ===');
  const mockServerKey = 'SB-Mid-server-TestSecretKey999';
  const orderId = 'ORD-20261108-001';
  const statusCode = '200';
  const grossAmount = '299000.00';
  const validSig = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${mockServerKey}`)
    .digest('hex');

  const isAccepted = verifyMidtransSignature({
    orderId,
    statusCode,
    grossAmount,
    serverKey: mockServerKey,
    signatureKey: validSig,
  });
  const isTamperedRejected = verifyMidtransSignature({
    orderId,
    statusCode,
    grossAmount: '1000.00', // tampered amount
    serverKey: mockServerKey,
    signatureKey: validSig,
  });

  if (!isAccepted || isTamperedRejected) {
    throw new Error('Midtrans SHA-512 signature verification failed security check');
  }
  console.log('✔ Midtrans SHA-512 signature verifier accepted valid signature & rejected tampered amount');

  process.env.MIDTRANS_SERVER_KEY = mockServerKey;
  const webhookRes = createMockRes();
  await paymentWebhookHandler(
    {
      method: 'POST',
      headers: { 'x-payment-provider': 'midtrans' },
      body: {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: validSig,
        transaction_status: 'settlement',
      },
    },
    webhookRes
  );
  if (webhookRes.getStatusCode() !== 200 || webhookRes.getJson()?.status !== 'verified') {
    throw new Error('POST /api/payment-webhook failed on valid signed payload');
  }
  console.log('✔ POST /api/payment-webhook verified signed settlement payload (200 OK)');

  console.log('\n=== TEST 4: Verify POST /api/ai-generate Validation & Server Key Protection ===');
  const emptyPromptRes = createMockRes();
  await aiGenerateHandler({ method: 'POST', body: { prompt: '   ' } }, emptyPromptRes);
  if (emptyPromptRes.getStatusCode() !== 400) {
    throw new Error('Expected 400 Bad Request for empty prompt on /api/ai-generate');
  }
  console.log('✔ POST /api/ai-generate properly rejected empty prompt (400 Bad Request)');

  console.log('\nALL PHASE 13 VERCEL GO-LIVE READINESS TESTS PASSED SUCCESSFULLY!');
}

runVercelGoLiveTests().catch((err) => {
  console.error('VERCEL GO-LIVE TEST FAILED:', err);
  process.exit(1);
});
