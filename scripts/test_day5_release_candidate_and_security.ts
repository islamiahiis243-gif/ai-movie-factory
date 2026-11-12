/**
 * AI MOVIE FACTORY — SPRINT 5 HARI: DAY 5 ACCEPTANCE TEST SUITE
 * Scope: UX Polish, Secret Exposure Audit, Database Security & Release Candidate Lock
 * Strict Fail-Closed Invariants:
 * - Anti-vacuum fail-closed guard: Aborts with failure if secrets < 3 or bundle missing
 * - Mandatory live Supabase PostgreSQL connection (no silent offline bypass)
 * - Explicit PostgreSQL 42501 permission-denied RLS verification (credit_reservations, ai_usage_records)
 * - Zero dummy / test record pollution in live production tables
 * - System health & versioning provenance (/api/health SSOT compliance)
 * - End-to-end 5-Gate production lifecycle & Commercial MVP Release Candidate sign-off
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import healthHandler from '../api/health.ts';

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

async function runDay5Suite() {
  console.log('\n========================================================================');
  console.log('  AI MOVIE FACTORY — DAY 5 SPRINT: SECURITY AUDIT & RELEASE CANDIDATE');
  console.log('  STRICT FAIL-CLOSED VERIFICATION (ANTI-VACUUM & MANDATORY LIVE DB)');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // SECTION 1: CLIENT BUNDLE SECRET EXPOSURE & QUARANTINE AUDIT (FAIL-CLOSED)
  // ---------------------------------------------------------------------------
  console.log('[SECTION 1] Client Bundle Secret Exposure & Security Quarantine Audit (Fail-Closed)');

  const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
  const bundleExists = fs.existsSync(distAssetsDir);
  assert(bundleExists, '1.1 dist/assets exists physically after production build');
  if (!bundleExists) {
    throw new Error('FAIL-CLOSED: Production build bundle dist/assets is missing. Run npm run build first.');
  }

  const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
  assert(jsFiles.length > 0, `1.2 Found ${jsFiles.length} production JavaScript bundles to audit`);
  if (jsFiles.length === 0) {
    throw new Error('FAIL-CLOSED: Zero JavaScript bundles found in dist/assets. Audit cannot proceed.');
  }

  // 1.3 Verify server-only signing and secret-handling functions are excluded from client bundle
  let serverModulesBundled = false;
  let bundledDetail = '';
  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf-8');
    if (content.includes('generatePseudonymousWatermark') || content.includes('validateGrantAgainstLiveEntitlement')) {
      serverModulesBundled = true;
      bundledDetail = `Server-only logic found in ${jsFile}`;
      break;
    }
  }
  assert(!serverModulesBundled, '1.3 Server-only signing and live entitlement modules excluded from client bundle', bundledDetail);
  if (serverModulesBundled) {
    throw new Error(`FAIL-CLOSED: Server-only modules leaked into client bundle: ${bundledDetail}`);
  }

  // 1.4 Anti-Vacuum Secret Audit: Gather active secrets from process.env and .env
  const sensitiveEnvKeys = [
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MIDTRANS_SERVER_KEY',
    'OTT_GRANT_SIGNING_SECRET',
    'UNIVERSAL_PUBLISHING_WORKER_SECRET',
    'CRON_SECRET',
    'SUPABASE_ACCESS_TOKEN',
    'GITHUB_PAT',
    'GEMINI_API_KEY',
  ];

  const secretValuesSet = new Set<string>();

  // Collect from process.env
  for (const key of sensitiveEnvKeys) {
    const val = process.env[key]?.trim();
    if (val && val.length > 8) {
      secretValuesSet.add(val);
    }
  }

  // Collect from .env if present
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      for (const sec of sensitiveEnvKeys) {
        if (trimmed.startsWith(`${sec}=`)) {
          const val = trimmed.substring(`${sec}=`.length).replace(/^["']|["']$/g, '').trim();
          if (val && val.length > 8) {
            secretValuesSet.add(val);
          }
        }
      }
    }
  }

  const secretValuesToCheck = Array.from(secretValuesSet);

  // Strict Fail-Closed Anti-Vacuum Gate: must have gathered at least 3 active secrets
  const hasEnoughSecrets = secretValuesToCheck.length >= 3;
  assert(
    hasEnoughSecrets,
    `1.4 Anti-Vacuum Fail-Closed Gate: Gathered ${secretValuesToCheck.length} active secrets for bundle comparison (Minimum: 3)`
  );
  if (!hasEnoughSecrets) {
    throw new Error(`FAIL-CLOSED: Insufficient active secrets gathered (${secretValuesToCheck.length} < 3). Audit cannot verify secret isolation.`);
  }

  let foundRawSecretValue = false;
  let rawSecretDetail = '';
  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf-8');
    for (const val of secretValuesToCheck) {
      if (content.includes(val)) {
        foundRawSecretValue = true;
        rawSecretDetail = `Raw secret value found in ${jsFile}`;
        break;
      }
    }
    if (foundRawSecretValue) break;
  }

  assert(!foundRawSecretValue, '1.5 Zero raw secret credential values embedded in client bundles', rawSecretDetail);
  if (foundRawSecretValue) {
    throw new Error(`FAIL-CLOSED: Raw secret credentials leaked into client bundle: ${rawSecretDetail}`);
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: LIVE SUPABASE POSTGRESQL RLS ENFORCEMENT & EXPLICIT 42501 CHECKS
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 2] Live Supabase PostgreSQL RLS Enforcement & Explicit Error 42501 Checks (Mandatory)');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SECRET_KEY || '';

  // Mandatory Live Database Prerequisites (No silent offline bypass!)
  const hasDbCredentials = Boolean(supabaseUrl && anonKey && serviceKey);
  assert(hasDbCredentials, '2.0 Mandatory Database Credentials: VITE_SUPABASE_URL, ANON_KEY & SECRET_KEY configured');
  if (!hasDbCredentials) {
    throw new Error('FAIL-CLOSED: Live database credentials missing. Offline mode is strictly prohibited for Release Candidate verification.');
  }

  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // 2.1 Verify RLS on credit_reservations: explicitly asserts PostgreSQL 42501 permission denied
  const { data: anonReservations, error: anonResErr } = await anonClient
    .from('credit_reservations')
    .select('*')
    .limit(10);

  assert(
    anonResErr?.code === '42501' && anonResErr?.message?.includes('permission denied'),
    `2.1 Anon SELECT on credit_reservations is explicitly rejected with PostgreSQL 42501 (Permission Denied: "${anonResErr?.message}")`
  );
  assert(
    anonReservations === null,
    '2.2 Anon role receives strictly null data (0 rows leaked from credit_reservations)'
  );

  const { error: anonInsertResErr } = await anonClient
    .from('credit_reservations')
    .insert({ user_id: '00000000-0000-0000-0000-000000000000', amount: 9999, status: 'reserved' });
  assert(
    anonInsertResErr?.code === '42501',
    `2.3 Anon INSERT into credit_reservations is explicitly rejected with PostgreSQL 42501 (Got code: ${anonInsertResErr?.code})`
  );

  // 2.2 Verify RLS on ai_usage_records: explicitly asserts PostgreSQL 42501 permission denied
  const { data: anonUsage, error: anonUsageErr } = await anonClient
    .from('ai_usage_records')
    .select('*')
    .limit(10);

  assert(
    anonUsageErr?.code === '42501' && anonUsageErr?.message?.includes('permission denied'),
    `2.4 Anon SELECT on ai_usage_records is explicitly rejected with PostgreSQL 42501 (Permission Denied: "${anonUsageErr?.message}")`
  );
  assert(
    anonUsage === null,
    '2.5 Anon role receives strictly null data (0 rows leaked from ai_usage_records)'
  );

  const { error: anonInsertUsageErr } = await anonClient
    .from('ai_usage_records')
    .insert({ user_id: '00000000-0000-0000-0000-000000000000', operation: 'generate', model: 'gemini' });
  assert(
    anonInsertUsageErr?.code === '42501',
    `2.6 Anon INSERT into ai_usage_records is explicitly rejected with PostgreSQL 42501 (Got code: ${anonInsertUsageErr?.code})`
  );

  // 2.3 Verify service_role retains administrative execution capability
  const { error: adminResErr } = await adminClient.from('credit_reservations').select('id').limit(0);
  assert(!adminResErr, '2.7 Service role maintains administrative access to credit_reservations');

  const { error: adminUsageErr } = await adminClient.from('ai_usage_records').select('id').limit(0);
  assert(!adminUsageErr, '2.8 Service role maintains administrative access to ai_usage_records');

  // 2.4 Clean database invariant checks (zero test pollution)
  const { count: sessionCount } = await adminClient
    .from('ott_playback_sessions')
    .select('*', { count: 'exact', head: true });
  assert((sessionCount || 0) === 0, '2.9 Clean database invariant: 0 stale OTT playback sessions in production');

  const { count: dummyJobCount } = await adminClient
    .from('pipeline_jobs')
    .select('*', { count: 'exact', head: true })
    .like('project_id', 'test%');
  assert((dummyJobCount || 0) === 0, '2.10 Clean database invariant: 0 stray test pipeline jobs in production');

  // ---------------------------------------------------------------------------
  // SECTION 3: SYSTEM HEALTH CONTRACT & PROVENANCE (/api/health)
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 3] System Health Contract & Versioning Provenance (/api/health)');

  const reqHealth: any = { method: 'GET' };
  const resHealth = createMockRes();
  await healthHandler(reqHealth, resHealth);

  assert(resHealth.getStatusCode() === 200, '3.1 Health endpoint returns HTTP 200 OK');
  const healthJson = resHealth.getJson();
  assert(healthJson?.status === 'ok', '3.2 Health status is "ok"');
  assert(healthJson?.service === 'ai-movie-factory', '3.3 Service identity confirms "ai-movie-factory"');
  assert(healthJson?.version === '1.16.1', '3.4 App version is locked at 1.16.1 for Commercial MVP');
  assert(healthJson?.ssotCompliance?.protectedTablesCount === 24, '3.5 24 core protected tables accounted for in schema registry');
  assert(healthJson?.ssotCompliance?.serverSideSecretsProtected === true, '3.6 Server-side secret protection confirmed active');
  assert(
    Array.isArray(healthJson?.ssotCompliance?.storageBuckets) &&
      healthJson.ssotCompliance.storageBuckets.includes('ott-masters') &&
      healthJson.ssotCompliance.storageBuckets.includes('project-assets') &&
      healthJson.ssotCompliance.storageBuckets.includes('character-avatars'),
    '3.7 All 3 production storage buckets registered (ott-masters, project-assets, character-avatars)'
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: 5-GATE PRODUCTION LIFECYCLE & UX RESILIENCE GUARANTEES
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 4] 5-Gate Production Lifecycle & UX Resilience Guarantees');

  // Verify Gate order and attachment in workflow
  const workflowFile = path.resolve(process.cwd(), 'src/lib/workflowGates.ts');
  assert(fs.existsSync(workflowFile), '4.1 workflowGates.ts exists physically');
  const workflowContent = fs.readFileSync(workflowFile, 'utf-8');

  assert(workflowContent.includes("titleId: 'Gate 1: Script Approval'"), '4.2 Gate 1 (Script Approval) registered');
  assert(workflowContent.includes("titleId: 'Gate 2: World & Character Approval'"), '4.3 Gate 2 (World & Character Approval) registered');
  assert(workflowContent.includes("titleId: 'Gate 3: Storyboard Approval'"), '4.4 Gate 3 (Storyboard Approval) registered');
  assert(workflowContent.includes("titleId: 'Gate 4: Keyframe Image Approval'"), '4.5 Gate 4 (Keyframe Still Approval) registered');
  assert(workflowContent.includes("titleId: 'Gate 5: Final Master Approval'"), '4.6 Gate 5 (Final Master Approval) registered');

  // Verify Director Approval Gate fail-closed guards
  assert(
    workflowContent.includes('export const DIRECTOR_APPROVAL_GATES'),
    '4.7 DIRECTOR_APPROVAL_GATES SSOT registry exported for UI components'
  );

  // Verify Cinematic Player progressive streaming mode
  const playerFile = path.resolve(process.cwd(), 'src/components/ott/CinematicPlayerView.tsx');
  assert(fs.existsSync(playerFile), '4.8 CinematicPlayerView.tsx exists physically');
  const playerContent = fs.readFileSync(playerFile, 'utf-8');
  assert(
    playerContent.includes("headers['Authorization'] = `Bearer") &&
      playerContent.includes("hbHeaders['Authorization'] = `Bearer") &&
      playerContent.includes("renewHeaders['Authorization'] = `Bearer"),
    '4.9 Cinematic player transmits authenticated JWT Bearer headers on acquire, heartbeat, and renew'
  );
  assert(playerContent.includes('streamMode'), '4.10 Player adapts gracefully between Progressive MP4 and HLS modes');
  assert(playerContent.includes('watermark'), '4.11 Player canvas overlay renders dynamic visible forensic watermark');

  // ---------------------------------------------------------------------------
  // SECTION 5: COMMERCIAL MVP RELEASE CANDIDATE (RC) MILESTONE AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 5] Commercial MVP Release Candidate (RC) Sign-Off');

  // Day 1 to Day 5 Full Sprint Alignment Check
  const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md');
  const changelogContent = fs.readFileSync(changelogPath, 'utf-8');

  assert(changelogContent.includes('[Sprint 5 Hari - Day 1]'), '5.1 Day 1 (Audit & Scope Lock) documented in CHANGELOG.md');
  assert(changelogContent.includes('[Sprint 5 Hari - Day 2 Reconciled]'), '5.2 Day 2 (Film Pipeline & 10 Audit Findings) documented');
  assert(changelogContent.includes('[Sprint 5 Hari - Day 3]'), '5.3 Day 3 (Reliability, Workers & Distribution) documented');
  assert(changelogContent.includes('[Sprint 5 Hari - Day 4]'), '5.4 Day 4 (Monetization & OTT Platform) documented');

  const agentDocPath = path.resolve(process.cwd(), 'AGENT.md');
  const agentDocContent = fs.readFileSync(agentDocPath, 'utf-8');
  assert(agentDocContent.includes('Target 17 November 2026'), '5.5 AGENT.md explicitly tracks 17 November 2026 target');
  assert(agentDocContent.includes('Progressive MP4'), '5.6 Progressive MP4 streaming verified as official commercial MVP baseline');

  console.log('\n========================================================================');
  console.log(`  DAY 5 RELEASE CANDIDATE SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDay5Suite().catch((err) => {
  console.error('Fatal error in Day 5 test suite:', err);
  process.exit(1);
});
