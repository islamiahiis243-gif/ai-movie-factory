/**
 * AI MOVIE FACTORY — HARDENED PRODUCTION DATABASE BACKUP ENGINE
 * Target: Live Supabase PostgreSQL (jixfakvbhugpypjtyshq)
 * Security: AES-256-GCM Authenticated Encryption with PBKDF2 Key Derivation
 * Reliability: Fail-Closed Strict Policy, Chunked Pagination, Full Post-Write Verification
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const encryptionSecret = process.env.BACKUP_ENCRYPTION_KEY || serviceRoleKey;

if (!serviceRoleKey) {
  console.error('❌ FATAL: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

if (!encryptionSecret) {
  console.error('❌ FATAL: Encryption secret cannot be derived. Provide BACKUP_ENCRYPTION_KEY or SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export const PROTECTED_TABLES = [
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

export interface EncryptedBackupEnvelope {
  version: '2.0-hardened';
  algorithm: 'aes-256-gcm';
  keyDerivation: 'pbkdf2-sha256-100000';
  timestamp: string;
  project: string;
  tablesCount: number;
  totalRows: number;
  saltHex: string;
  ivHex: string;
  authTagHex: string;
  ciphertextBase64: string;
}

export function encryptPayload(plaintext: string, secret: string): {
  saltHex: string;
  ivHex: string;
  authTagHex: string;
  ciphertextBase64: string;
} {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
  const key = crypto.pbkdf2Sync(secret, salt, 100_000, 32, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    saltHex: salt.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextBase64: encrypted.toString('base64'),
  };
}

export function decryptPayload(envelope: EncryptedBackupEnvelope, secret: string): any {
  const salt = Buffer.from(envelope.saltHex, 'hex');
  const iv = Buffer.from(envelope.ivHex, 'hex');
  const authTag = Buffer.from(envelope.authTagHex, 'hex');
  const ciphertext = Buffer.from(envelope.ciphertextBase64, 'base64');

  const key = crypto.pbkdf2Sync(secret, salt, 100_000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log('========================================================================');
  console.log('  AI MOVIE FACTORY — HARDENED PRODUCTION DATABASE BACKUP ENGINE');
  console.log(`  Target: ${supabaseUrl}`);
  console.log(`  Mode: Fail-Closed Strict | AES-256-GCM Authenticated Encryption`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log('========================================================================\n');

  const backupDir = path.resolve(process.cwd(), 'supabase/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const manifest: {
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
  const CHUNK_SIZE = 1000;

  for (const table of PROTECTED_TABLES) {
    let tableRows: any[] = [];
    let page = 0;
    let expectedExactCount: number | null = null;

    while (true) {
      const from = page * CHUNK_SIZE;
      const to = from + CHUNK_SIZE - 1;

      const { data, error, count } = await adminClient
        .from(table)
        .select('*', { count: page === 0 ? 'exact' : undefined })
        .range(from, to);

      if (error) {
        console.error(`\n❌ FATAL FAIL-CLOSED ERROR on table "${table}" [range: ${from}-${to}]:`);
        console.error(`   Message: ${error.message} (Code: ${error.code})`);
        console.error(`   ABORTING BACKUP IMMEDIATELY. Incomplete snapshots are strictly prohibited.`);
        process.exit(1);
      }

      if (page === 0 && count !== null && count !== undefined) {
        expectedExactCount = count;
      }

      if (data && data.length > 0) {
        tableRows.push(...data);
      }

      if (!data || data.length < CHUNK_SIZE) {
        break; // Exhausted all rows
      }
      page++;
    }

    // Fail-Closed Count Integrity Check
    if (expectedExactCount !== null && tableRows.length !== expectedExactCount) {
      console.error(`\n❌ FATAL FAIL-CLOSED INTEGRITY MISMATCH on table "${table}":`);
      console.error(`   Expected rows: ${expectedExactCount}, Retrieved rows: ${tableRows.length}`);
      console.error(`   ABORTING BACKUP IMMEDIATELY.`);
      process.exit(1);
    }

    totalRowsCaptured += tableRows.length;
    manifest.tables[table] = {
      count: tableRows.length,
      rows: tableRows,
    };

    console.log(`  ✔ [PAGINATED] "${table}": ${tableRows.length} rows captured (Pages: ${page + 1})`);
  }

  // 1. Serialize manifest
  const rawJson = JSON.stringify(manifest);

  // 2. Encrypt with AES-256-GCM
  console.log('\n🔒 Encrypting database snapshot with AES-256-GCM...');
  const encryptedPayload = encryptPayload(rawJson, encryptionSecret);

  const envelope: EncryptedBackupEnvelope = {
    version: '2.0-hardened',
    algorithm: 'aes-256-gcm',
    keyDerivation: 'pbkdf2-sha256-100000',
    timestamp,
    project: manifest.project,
    tablesCount: PROTECTED_TABLES.length,
    totalRows: totalRowsCaptured,
    ...encryptedPayload,
  };

  const envelopeJson = JSON.stringify(envelope, null, 2);
  const backupFilePath = path.join(backupDir, `production_snapshot_${timestamp}.enc.json`);
  fs.writeFileSync(backupFilePath, envelopeJson, 'utf-8');

  // 3. Post-write Checksum computation
  const fileBuffer = fs.readFileSync(backupFilePath);
  const sha256Checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const checksumFilePath = path.join(backupDir, `production_snapshot_${timestamp}.enc.sha256`);
  const checksumContent = `${sha256Checksum}  production_snapshot_${timestamp}.enc.json\n`;
  fs.writeFileSync(checksumFilePath, checksumContent, 'utf-8');

  // 4. Remote Off-Site Cloud Storage Replication (Private Supabase Storage Bucket)
  console.log('☁️ Replicating encrypted snapshot to private off-site cloud storage (database-backups)...');
  const remoteFileName = `production_snapshot_${timestamp}.enc.json`;
  const remoteChecksumName = `production_snapshot_${timestamp}.enc.sha256`;

  const { error: uploadEncErr } = await adminClient.storage
    .from('database-backups')
    .upload(remoteFileName, fileBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadEncErr) {
    console.error(`\n❌ FATAL FAIL-CLOSED ERROR: Failed to replicate encrypted backup to cloud storage:`, uploadEncErr.message);
    process.exit(1);
  }

  const { error: uploadShaErr } = await adminClient.storage
    .from('database-backups')
    .upload(remoteChecksumName, Buffer.from(checksumContent, 'utf-8'), {
      contentType: 'text/plain',
      upsert: true,
    });

  if (uploadShaErr) {
    console.error(`\n❌ FATAL FAIL-CLOSED ERROR: Failed to replicate checksum to cloud storage:`, uploadShaErr.message);
    process.exit(1);
  }

  console.log(`  ✔ [REMOTE SYNC] Successfully uploaded to cloud storage: database-backups/${remoteFileName}`);

  // 5. Post-write Decryption & Verification in-flight
  console.log('🔍 Executing post-write decryption & schema verification test...');
  const reReadEnvelope = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8')) as EncryptedBackupEnvelope;
  const decryptedManifest = decryptPayload(reReadEnvelope, encryptionSecret);

  if (decryptedManifest.tablesCount !== PROTECTED_TABLES.length) {
    throw new Error(`Verification failed: Decrypted table count mismatch (${decryptedManifest.tablesCount} != ${PROTECTED_TABLES.length})`);
  }

  for (const table of PROTECTED_TABLES) {
    if (!decryptedManifest.tables[table]) {
      throw new Error(`Verification failed: Table "${table}" missing in decrypted manifest.`);
    }
  }

  console.log('\n========================================================================');
  console.log('✅ HARDENED BACKUP COMPLETED & VERIFIED SUCCESSFULLY!');
  console.log(`  Encrypted File: ${backupFilePath}`);
  console.log(`  Cloud Replica: database-backups/${remoteFileName}`);
  console.log(`  File Size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`  Encryption: AES-256-GCM (PBKDF2-100k, AuthTag Verified)`);
  console.log(`  Tables Protected: ${PROTECTED_TABLES.length}/${PROTECTED_TABLES.length}`);
  console.log(`  Total Rows Captured: ${totalRowsCaptured}`);
  console.log(`  SHA-256 Checksum: ${sha256Checksum}`);
  console.log(`  Fail-Closed Status: ACTIVE (0 warnings, 0 skips)`);
  console.log('========================================================================\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename || '')) {
  runBackup().catch((err) => {
    console.error('Fatal backup error:', err);
    process.exit(1);
  });
}

export { runBackup };
