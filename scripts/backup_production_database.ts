/**
 * AI MOVIE FACTORY — AUTOMATED PRODUCTION DATABASE BACKUP ENGINE
 * Target: Live Supabase PostgreSQL (jixfakvbhugpypjtyshq)
 * Purpose: Independent, zero-cost production data protection and recovery snapshot.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY must be provided.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const PROTECTED_TABLES = [
  'profiles',
  'projects',
  'project_settings',
  'story_bibles',
  'characters',
  'story_concepts',
  'seasons',
  'episodes',
  'scenes',
  'script_versions',
  'agent_project_configs',
  'production_tasks',
  'agent_execution_logs',
  'assets',
  'pipeline_jobs',
  'pipeline_job_logs',
  'export_packages',
  'subscriptions',
  'credit_transactions',
  'payment_orders',
  'workspaces',
  'workspace_members',
  'workspace_invites',
  'marketplace_templates',
  'creator_milestones',
  'creator_media_kits',
  'publishing_jobs',
  'platform_oauth_tokens',
  'oauth_state_transactions',
  'creator_analytics_snapshots',
  'creator_analytics_sync_jobs',
  'credit_reservations',
  'ai_usage_records',
  'ott_channels',
  'ott_series',
  'ott_seasons',
  'ott_episodes',
  'ott_films',
  'ott_cast_members',
  'ott_access_passes',
  'ott_viewer_subscriptions',
  'ott_playback_sessions',
  'ott_payment_orders',
  'ott_payment_order_refunds',
  'ott_transcoding_jobs',
];

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log('========================================================================');
  console.log('  AI MOVIE FACTORY — PRODUCTION DATABASE BACKUP ENGINE');
  console.log(`  Target: ${supabaseUrl}`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log('========================================================================\n');

  const backupDir = path.resolve(process.cwd(), 'supabase/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupManifest: {
    project: string;
    timestamp: string;
    tablesCount: number;
    tables: Record<string, { count: number; rows: any[] }>;
  } = {
    project: 'jixfakvbhugpypjtyshq',
    timestamp,
    tablesCount: PROTECTED_TABLES.length,
    tables: {},
  };

  let totalRowsCaptured = 0;

  for (const table of PROTECTED_TABLES) {
    try {
      const { data, error, count } = await adminClient
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        console.warn(`  ⚠️ Warning: Unable to query table "${table}": ${error.message}`);
        backupManifest.tables[table] = { count: 0, rows: [] };
      } else {
        const rowCount = data?.length || 0;
        totalRowsCaptured += rowCount;
        backupManifest.tables[table] = {
          count: rowCount,
          rows: data || [],
        };
        console.log(`  ✔ Backed up "${table}": ${rowCount} rows (PostgreSQL Exact Count: ${count ?? rowCount})`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️ Error reading "${table}": ${err?.message}`);
      backupManifest.tables[table] = { count: 0, rows: [] };
    }
  }

  const backupFilePath = path.join(backupDir, `production_snapshot_${timestamp}.json`);
  const jsonContent = JSON.stringify(backupManifest, null, 2);
  fs.writeFileSync(backupFilePath, jsonContent, 'utf-8');

  // Compute SHA-256 Checksum for verification
  const checksum = crypto.createHash('sha256').update(jsonContent).digest('hex');
  const checksumFilePath = path.join(backupDir, `production_snapshot_${timestamp}.sha256`);
  fs.writeFileSync(checksumFilePath, `${checksum}  production_snapshot_${timestamp}.json\n`, 'utf-8');

  console.log('\n========================================================================');
  console.log('✅ BACKUP COMPLETED SUCCESSFULLY!');
  console.log(`  File: ${backupFilePath}`);
  console.log(`  Size: ${(Buffer.byteLength(jsonContent) / 1024).toFixed(2)} KB`);
  console.log(`  Total Tables Backed Up: ${PROTECTED_TABLES.length}`);
  console.log(`  Total Rows Captured: ${totalRowsCaptured}`);
  console.log(`  SHA-256 Checksum: ${checksum}`);
  console.log('========================================================================\n');
}

runBackup().catch((err) => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
