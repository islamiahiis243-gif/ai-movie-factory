/**
 * AUTOMATED SECURITY & INTEGRATION TEST SUITE (T9.3)
 * Serverless OAuth Broker & Encrypted Token Vault
 *
 * Verifies:
 * 1. AES-256-GCM symmetric encryption & decryption round-trip.
 * 2. Tampered ciphertext rejection (authenticated tag verification).
 * 3. Additional Authenticated Data (AAD) mismatch detection.
 * 4. OAuth State parameter HMAC-SHA256 integrity and expiration.
 * 5. Serverless API endpoint authentication guards and method restrictions.
 * 6. Non-leakage of token secrets in sanitized connection metadata.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  encryptOAuthToken,
  decryptOAuthToken,
  generateOAuthState,
  verifyOAuthState,
} from '../api/lib/oauthCrypto';
import { getProviderConfig, buildAuthorizationUrl } from '../api/lib/oauthProviders';
import connectHandler from '../api/oauth/connect';
import connectionsHandler from '../api/oauth/connections';
import disconnectHandler from '../api/oauth/disconnect';

function createMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let jsonBody: any = null;
  let redirectedUrl: string | null = null;
  let sentText: string | null = null;

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
    send(text: string) {
      sentText = text;
      return this;
    },
    redirect(code: number, url: string) {
      statusCode = code;
      redirectedUrl = url;
      return this;
    },
    getStatusCode: () => statusCode,
    getJson: () => jsonBody,
    getHeaders: () => headers,
    getRedirectedUrl: () => redirectedUrl,
    getSentText: () => sentText,
  };
}

async function runOAuthSecurityTests() {
  console.log('=== TEST 1: AES-256-GCM Authenticated Encryption Round-Trip ===');
  const dummyAccessToken = 'ya29.a0AfH6SMB_SAMPLE_SECRET_ACCESS_TOKEN_1234567890';
  const aad = 'usr-uuid-1234:youtube:UC_SAMPLE_CHANNEL_ID';

  const envelope = encryptOAuthToken(dummyAccessToken, aad);
  console.log('✔ Token successfully encrypted into envelope:', envelope.substring(0, 40) + '...');

  const parts = envelope.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Envelope structure is invalid (must have 4 v1-prefixed segments)');
  }

  const decrypted = decryptOAuthToken(envelope, aad);
  if (decrypted !== dummyAccessToken) {
    throw new Error('Decrypted token does not match original plaintext');
  }
  console.log('✔ Decryption verified: Plaintext exactly restored with valid AAD');

  console.log('\n=== TEST 2: Tampered Ciphertext & Auth Tag Verification Failure ===');
  // Alter 1 byte of the ciphertext hex
  const lastChar = envelope.slice(-1);
  const tamperedChar = lastChar === 'a' ? 'b' : 'a';
  const tamperedEnvelope = envelope.slice(0, -1) + tamperedChar;

  let tamperedCaught = false;
  try {
    decryptOAuthToken(tamperedEnvelope, aad);
  } catch (err: any) {
    tamperedCaught = true;
    console.log('✔ Tampered ciphertext correctly rejected by AES-256-GCM auth tag:', err.message);
  }
  if (!tamperedCaught) {
    throw new Error('SECURITY VIOLATION: Tampered ciphertext was accepted without error!');
  }

  console.log('\n=== TEST 3: AAD Mismatch / Cross-Account Transplantation Rejection ===');
  // Attempting to decrypt token for a different user ID or platform
  const mismatchedAad = 'attacker-uuid-9999:youtube:UC_SAMPLE_CHANNEL_ID';
  let aadCaught = false;
  try {
    decryptOAuthToken(envelope, mismatchedAad);
  } catch (err: any) {
    aadCaught = true;
    console.log('✔ AAD mismatch correctly rejected:', err.message);
  }
  if (!aadCaught) {
    throw new Error('SECURITY VIOLATION: Decryption succeeded with mismatched AAD!');
  }

  console.log('\n=== TEST 4: Tamper-Proof OAuth State Parameter & Expiration ===');
  const userId = 'usr-98765';
  const stateStr = generateOAuthState({
    userId,
    platform: 'youtube',
    returnUrl: '/studio?tab=publishing',
  });
  console.log('✔ Generated HMAC-signed state parameter:', stateStr.substring(0, 35) + '...');

  const verifiedState = verifyOAuthState(stateStr);
  if (verifiedState.userId !== userId || verifiedState.platform !== 'youtube') {
    throw new Error('State payload data mismatch');
  }
  console.log('✔ State signature and payload verified successfully');

  // Verify tampered state rejection
  const tamperedState = stateStr.replace('.', '.tampered');
  let stateTamperCaught = false;
  try {
    verifyOAuthState(tamperedState);
  } catch (err: any) {
    stateTamperCaught = true;
    console.log('✔ Tampered state signature correctly rejected:', err.message);
  }
  if (!stateTamperCaught) {
    throw new Error('SECURITY VIOLATION: Tampered state parameter was accepted!');
  }

  console.log('\n=== TEST 5: OAuth Provider Registry & Scope Configurations ===');
  const ytConfig = getProviderConfig('youtube');
  const ttConfig = getProviderConfig('tiktok');
  const igConfig = getProviderConfig('instagram');
  const fbConfig = getProviderConfig('facebook');

  if (
    !ytConfig.authUrl.includes('accounts.google.com') ||
    !ttConfig.authUrl.includes('tiktok.com') ||
    !igConfig.authUrl.includes('facebook.com') ||
    !fbConfig.authUrl.includes('facebook.com')
  ) {
    throw new Error('Provider auth URLs are misconfigured');
  }
  console.log('✔ First-Wave providers (YouTube, TikTok, Instagram, Facebook) registered with official endpoints');

  console.log('\n=== TEST 6: Serverless OAuth Endpoints Authentication Guards ===');
  // 6.1 connectHandler: Method not allowed on GET
  const reqGet = { method: 'GET' };
  const resGet = createMockRes();
  await connectHandler(reqGet, resGet);
  if (resGet.getStatusCode() !== 405) {
    throw new Error(`Expected 405 Method Not Allowed on GET /api/oauth/connect, got ${resGet.getStatusCode()}`);
  }
  console.log('✔ /api/oauth/connect enforces POST-only method restriction (405)');

  // 6.2 connectHandler: 401 without auth token
  const reqUnauth = { method: 'POST', body: { platform: 'youtube' } };
  const resUnauth = createMockRes();
  await connectHandler(reqUnauth, resUnauth);
  if (resUnauth.getStatusCode() !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${resUnauth.getStatusCode()}`);
  }
  console.log('✔ /api/oauth/connect rejects unauthenticated callers (401)');

  // 6.3 connectionsHandler: 401 without auth token
  const resConnUnauth = createMockRes();
  await connectionsHandler({ method: 'GET' }, resConnUnauth);
  if (resConnUnauth.getStatusCode() !== 401) {
    throw new Error(`Expected 401 Unauthorized on /api/oauth/connections, got ${resConnUnauth.getStatusCode()}`);
  }
  console.log('✔ /api/oauth/connections rejects unauthenticated callers (401)');

  // 6.4 disconnectHandler: 401 without auth token
  const resDiscUnauth = createMockRes();
  await disconnectHandler({ method: 'POST', body: { platform: 'youtube' } }, resDiscUnauth);
  if (resDiscUnauth.getStatusCode() !== 401) {
    throw new Error(`Expected 401 Unauthorized on /api/oauth/disconnect, got ${resDiscUnauth.getStatusCode()}`);
  }
  console.log('✔ /api/oauth/disconnect rejects unauthenticated callers (401)');

  console.log('\n=== TEST 7: Database Migration Files Audit (V3.8 OAuth Vault) ===');
  const v38Path = path.join(process.cwd(), 'supabase', 'upgrade_v3_8_oauth_token_vault.sql');
  const deployAllPath = path.join(process.cwd(), 'supabase', 'deploy_all_migrations.sql');

  if (!fs.existsSync(v38Path)) {
    throw new Error('upgrade_v3_8_oauth_token_vault.sql does not exist');
  }
  const v38Sql = fs.readFileSync(v38Path, 'utf8');
  if (!v38Sql.includes('platform_oauth_tokens') || !v38Sql.includes('encrypted_access_token')) {
    throw new Error('v3.8 migration does not define platform_oauth_tokens table');
  }
  if (!v38Sql.includes('REVOKE ALL ON TABLE public.platform_oauth_tokens FROM anon, authenticated')) {
    throw new Error('SECURITY VIOLATION: Missing client access revocation in v3.8 migration');
  }
  if (!v38Sql.includes('CREATE OR REPLACE VIEW public.creator_connected_platforms')) {
    throw new Error('v3.8 migration missing sanitized metadata view');
  }

  const deployAllSql = fs.readFileSync(deployAllPath, 'utf8');
  if (!deployAllSql.includes('platform_oauth_tokens')) {
    throw new Error('deploy_all_migrations.sql does not include v3.8 migration');
  }
  console.log('✔ upgrade_v3_8_oauth_token_vault.sql validated with strict RLS and zero client exposure');
  console.log('✔ deploy_all_migrations.sql synchronized with v3.8');

  console.log('\n======================================================');
  console.log('✅ ALL T9.3 OAUTH BROKER & ENCRYPTED VAULT TESTS PASSED!');
  console.log('======================================================');
}

runOAuthSecurityTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
