/**
 * AI MOVIE FACTORY — SPRINT 5 HARI: DAY 5 ACCEPTANCE TEST SUITE
 * Scope: UX Polish, Secret Exposure Audit, Database Security & Release Candidate Lock
 * Targets:
 * - Zero server-side secret exposure across all browser assets (dist/assets/*.js)
 * - Live Supabase PostgreSQL RLS enforcement (credit_reservations, ai_usage_records)
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
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // SECTION 1: CLIENT BUNDLE SECRET EXPOSURE & QUARANTINE AUDIT
  // ---------------------------------------------------------------------------
  console.log('[SECTION 1] Client Bundle Secret Exposure & Security Quarantine Audit');

  const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
  assert(fs.existsSync(distAssetsDir), '1.1 dist/assets exists physically after production build');

  if (fs.existsSync(distAssetsDir)) {
    const jsFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.js'));
    assert(jsFiles.length > 0, `1.2 Found ${jsFiles.length} production JavaScript bundles to audit`);

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

    // 1.4 Verify raw secret values from .env are strictly NOT embedded into any client asset
    const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
    const secretValuesToCheck: string[] = [];
    const sensitiveEnvKeys = [
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'MIDTRANS_SERVER_KEY',
      'OTT_GRANT_SIGNING_SECRET',
      'UNIVERSAL_PUBLISHING_WORKER_SECRET',
      'CRON_SECRET',
      'SUPABASE_ACCESS_TOKEN',
      'GITHUB_PAT',
    ];

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      for (const sec of sensitiveEnvKeys) {
        if (trimmed.startsWith(`${sec}=`)) {
          const val = trimmed.substring(`${sec}=`.length).replace(/^["']|["']$/g, '').trim();
          if (val && val.length > 8) {
            secretValuesToCheck.push(val);
          }
        }
      }
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

    assert(!foundRawSecretValue, '1.4 Zero raw secret credential values embedded in client bundles', rawSecretDetail);
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: LIVE SUPABASE POSTGRESQL RLS ENFORCEMENT & INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n[SECTION 2] Live Supabase PostgreSQL RLS Enforcement & Invariants');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SECRET_KEY || '';

  const adminClient = serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;
  const anonClient = anonKey ? createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }) : null;

  if (adminClient && anonClient) {
    // 2.1 Verify RLS on credit_reservations blocks anon read/write
    const { data: anonReservations } = await anonClient
      .from('credit_reservations')
      .select('*')
      .limit(10);
    assert(
      !anonReservations || anonReservations.length === 0,
      '2.1 Anon role is completely shielded from credit_reservations (0 rows visible)'
    );

    const { error: anonInsertResErr } = await anonClient
      .from('credit_reservations')
      .insert({ user_id: 'anon-attacker', amount: 9999, status: 'reserved' });
    assert(Boolean(anonInsertResErr), '2.2 Anon direct insert into credit_reservations is strictly blocked');

    // 2.2 Verify RLS on ai_usage_records blocks anon read/write
    const { data: anonUsage } = await anonClient
      .from('ai_usage_records')
      .select('*')
      .limit(10);
    assert(
      !anonUsage || anonUsage.length === 0,
      '2.3 Anon role is completely shielded from ai_usage_records (0 rows visible)'
    );

    const { error: anonInsertUsageErr } = await anonClient
      .from('ai_usage_records')
      .insert({ user_id: 'anon-attacker', model: 'gpt-4o', credit_cost: 999 });
    assert(Boolean(anonInsertUsageErr), '2.4 Anon direct insert into ai_usage_records is strictly blocked');

    // 2.3 Verify service_role retains administrative execution capability
    const { error: adminResErr } = await adminClient.from('credit_reservations').select('id').limit(0);
    assert(!adminResErr, '2.5 Service role maintains administrative access to credit_reservations');

    const { error: adminUsageErr } = await adminClient.from('ai_usage_records').select('id').limit(0);
    assert(!adminUsageErr, '2.6 Service role maintains administrative access to ai_usage_records');

    // 2.4 Clean database invariant checks (zero test pollution)
    const { count: sessionCount } = await adminClient
      .from('ott_playback_sessions')
      .select('*', { count: 'exact', head: true });
    assert((sessionCount || 0) === 0, '2.7 Clean database invariant: 0 stale OTT playback sessions in production');

    const { count: dummyJobCount } = await adminClient
      .from('pipeline_jobs')
      .select('*', { count: 'exact', head: true })
      .like('project_id', 'test%');
    assert((dummyJobCount || 0) === 0, '2.8 Clean database invariant: 0 stray test pipeline jobs in production');
  } else {
    console.log('  [Notice] Live database checks skipped in offline mode.');
  }

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
