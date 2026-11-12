/**
 * AI MOVIE FACTORY — DISASTER RECOVERY & DATABASE RESTORATION ENGINE
 * Purpose: Full roundtrip decryption, relational integrity verification, and actual database restoration.
 * Modes:
 *   (default)        : Dry-run. Load local snapshot, verify FK relational constraints. No DB writes.
 *   --from-cloud     : Download latest from Supabase Storage, verify remote SHA-256, then dry-run.
 *   --apply-target   : Full restoration. Download from cloud, verify checksum, verify FK integrity,
 *                      then write all rows into isolated dr_restore_test schema + record audit log.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { decryptPayload, EncryptedBackupEnvelope, PROTECTED_TABLES } from './backup_production_database';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jixfakvbhugpypjtyshq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const encryptionSecret = process.env.BACKUP_ENCRYPTION_KEY || serviceRoleKey;

if (!serviceRoleKey || !encryptionSecret) {
  console.error('❌ FATAL: SUPABASE_SECRET_KEY and encryption secret are required for restoration engine.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export interface RelationalIntegrityReport {
  totalTables: number;
  totalRows: number;
  passedRelations: number;
  violationsCount: number;
  relations: Array<{
    relation: string;
    parentTable: string;
    childTable: string;
    foreignKey: string;
    checkedRows: number;
    orphanedRows: number;
    status: 'VALID' | 'VIOLATED';
  }>;
}

export function verifyRelationalIntegrity(tables: Record<string, { count: number; rows: any[] }>): RelationalIntegrityReport {
  const report: RelationalIntegrityReport = {
    totalTables: Object.keys(tables).length,
    totalRows: Object.values(tables).reduce((acc, t) => acc + (t.rows?.length || 0), 0),
    passedRelations: 0,
    violationsCount: 0,
    relations: [],
  };

  const RELATIONAL_CONSTRAINTS = [
    { parent: 'profiles', parentKey: 'id', child: 'projects', childKey: 'user_id', name: 'projects -> profiles' },
    { parent: 'projects', parentKey: 'id', child: 'project_settings', childKey: 'project_id', name: 'project_settings -> projects' },
    { parent: 'profiles', parentKey: 'id', child: 'subscriptions', childKey: 'user_id', name: 'subscriptions -> profiles' },
    { parent: 'profiles', parentKey: 'id', child: 'credit_transactions', childKey: 'user_id', name: 'credit_transactions -> profiles' },
    { parent: 'workspaces', parentKey: 'id', child: 'workspace_members', childKey: 'workspace_id', name: 'workspace_members -> workspaces' },
    { parent: 'profiles', parentKey: 'id', child: 'workspace_members', childKey: 'user_id', name: 'workspace_members -> profiles' },
    { parent: 'profiles', parentKey: 'id', child: 'ott_channels', childKey: 'creator_id', name: 'ott_channels -> profiles' },
    { parent: 'ott_channels', parentKey: 'id', child: 'ott_films', childKey: 'channel_id', name: 'ott_films -> ott_channels' },
    { parent: 'ott_films', parentKey: 'id', child: 'ott_payment_orders', childKey: 'film_id', name: 'ott_payment_orders -> ott_films' },
    { parent: 'ott_films', parentKey: 'id', child: 'ott_access_passes', childKey: 'film_id', name: 'ott_access_passes -> ott_films' },
    { parent: 'ott_payment_orders', parentKey: 'id', child: 'ott_access_passes', childKey: 'order_id', name: 'ott_access_passes -> ott_payment_orders' },
  ];

  for (const c of RELATIONAL_CONSTRAINTS) {
    const parentData = tables[c.parent]?.rows || [];
    const childData = tables[c.child]?.rows || [];

    const parentIdSet = new Set(parentData.map((row: any) => row[c.parentKey]));
    let orphanedCount = 0;

    for (const childRow of childData) {
      const foreignValue = childRow[c.childKey];
      if (foreignValue !== null && foreignValue !== undefined && !parentIdSet.has(foreignValue)) {
        orphanedCount++;
      }
    }

    const isPassing = orphanedCount === 0;
    if (isPassing) report.passedRelations++;
    else report.violationsCount++;

    report.relations.push({
      relation: c.name,
      parentTable: c.parent,
      childTable: c.child,
      foreignKey: c.childKey,
      checkedRows: childData.length,
      orphanedRows: orphanedCount,
      status: isPassing ? 'VALID' : 'VIOLATED',
    });
  }

  return report;
}

async function downloadAndVerifyFromCloud(): Promise<{ envelope: EncryptedBackupEnvelope; rawBytes: Buffer; snapshotName: string }> {
  console.log('☁️ Querying latest remote encrypted backup from Supabase Storage...');
  const { data: fileList, error: listErr } = await adminClient.storage
    .from('database-backups')
    .list('', { sortBy: { column: 'name', order: 'desc' } });

  if (listErr || !fileList || fileList.length === 0) {
    throw new Error(`Failed to list remote cloud backups: ${listErr?.message || 'Empty bucket'}`);
  }

  const latestEnc = fileList.find(f => f.name.endsWith('.enc.json'));
  if (!latestEnc) throw new Error('No .enc.json backups found in remote storage bucket');
  const checksumName = latestEnc.name.replace(/\.enc\.json$/, '.enc.sha256');
  const latestSha = fileList.find(f => f.name === checksumName);
  if (!latestSha) {
    throw new Error(`FAIL-CLOSED: Required checksum object is missing for snapshot ${latestEnc.name}`);
  }

  console.log(`  Downloading remote snapshot: ${latestEnc.name}...`);
  const { data: encBlob, error: encErr } = await adminClient.storage
    .from('database-backups')
    .download(latestEnc.name);
  if (encErr || !encBlob) throw new Error(`Failed to download remote snapshot: ${encErr?.message}`);
  const rawBytes = Buffer.from(await encBlob.arrayBuffer());

  console.log(`  Downloading matching remote checksum: ${latestSha.name}...`);
  const { data: shaBlob, error: shaErr } = await adminClient.storage
    .from('database-backups')
    .download(latestSha.name);
  if (shaErr || !shaBlob) throw new Error(`Failed to download remote checksum: ${shaErr?.message}`);

  const shaContent = Buffer.from(await shaBlob.arrayBuffer()).toString('utf-8').trim();
  const expectedHash = shaContent.split(/\s+/)[0].toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error('FAIL-CLOSED: Remote SHA-256 checksum file has an invalid format');
  }
  const actualHash = crypto.createHash('sha256').update(rawBytes).digest('hex');
  if (actualHash !== expectedHash) {
    throw new Error(
      `❌ FAIL-CLOSED: Remote cloud object SHA-256 MISMATCH!\nExpected: ${expectedHash}\nGot: ${actualHash}\nAborting restoration.`
    );
  }
  console.log(`  ✔ [CLOUD CHECKSUM VERIFIED] SHA-256: ${actualHash.substring(0, 24)}... MATCHES ${checksumName}`);

  const envelope: EncryptedBackupEnvelope = JSON.parse(rawBytes.toString('utf-8'));
  return { envelope, rawBytes, snapshotName: latestEnc.name };
}

async function applyRestoreToTargetDatabase(
  manifest: any,
  source: string
): Promise<void> {
  console.log('\n🗄️  Applying actual row restore to isolated schema dr_restore_test...');
  console.log('   Production schema public is never modified.');

  const expectedCounts: Record<string, number> = {};
  for (const table of PROTECTED_TABLES) {
    const tableData = manifest.tables?.[table];
    if (!tableData || !Array.isArray(tableData.rows)) {
      throw new Error(`FAIL-CLOSED: Snapshot is missing table payload for ${table}`);
    }
    const declaredCount = Number(tableData.count);
    if (!Number.isInteger(declaredCount) || declaredCount !== tableData.rows.length) {
      throw new Error(`FAIL-CLOSED: Snapshot count mismatch for ${table}: declared ${tableData.count}, rows ${tableData.rows.length}`);
    }
    expectedCounts[table] = tableData.rows.length;
  }

  const { error: resetError } = await adminClient.rpc('dr_restore_reset_target');
  if (resetError) throw new Error(`Failed to clear isolated restore schema: ${resetError.message}`);

  let totalWritten = 0;
  let tablesWritten = 0;
  const CHUNK_SIZE = 250;

  for (const table of PROTECTED_TABLES) {
    const rows: any[] = manifest.tables[table].rows;
    let tableWritten = 0;

    for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
      const batch = rows.slice(offset, offset + CHUNK_SIZE);
      const { data, error } = await adminClient.rpc('dr_restore_write_table', {
        p_table_name: table,
        p_rows: batch,
      });
      if (error) {
        throw new Error(`Restore write failed for ${table} at row offset ${offset}: ${error.message}`);
      }
      const inserted = Number(data);
      if (!Number.isInteger(inserted) || inserted !== batch.length) {
        throw new Error(`FAIL-CLOSED: RPC row count mismatch for ${table}: expected ${batch.length}, inserted ${String(data)}`);
      }
      tableWritten += inserted;
    }

    if (tableWritten !== rows.length) {
      throw new Error(`FAIL-CLOSED: Table ${table} restore mismatch: expected ${rows.length}, wrote ${tableWritten}`);
    }
    totalWritten += tableWritten;
    tablesWritten++;
    console.log(`  ✔ [ROWS WRITTEN] dr_restore_test.${table}: ${tableWritten} rows`);
  }

  console.log('\n🔎 Verifying persisted row counts directly inside PostgreSQL...');
  const { data: verifiedCounts, error: verifyError } = await adminClient.rpc('dr_restore_verify_counts', {
    p_expected: expectedCounts,
  });
  if (verifyError) throw new Error(`Post-restore PostgreSQL count verification failed: ${verifyError.message}`);
  for (const table of PROTECTED_TABLES) {
    const actual = Number((verifiedCounts as Record<string, unknown>)?.[table]);
    if (actual !== expectedCounts[table]) {
      throw new Error(`FAIL-CLOSED: Persisted count mismatch for ${table}: expected ${expectedCounts[table]}, got ${actual}`);
    }
  }

  const { data: auditId, error: auditError } = await adminClient.rpc('dr_restore_write_audit', {
    p_snapshot_timestamp: String(manifest.timestamp),
    p_tables_restored: tablesWritten,
    p_total_rows_restored: totalWritten,
    p_checksum_verified: true,
    p_source: source,
  });
  if (auditError || auditId === null || auditId === undefined) {
    throw new Error(`Restore completed but audit record could not be persisted: ${auditError?.message || 'missing audit id'}`);
  }

  console.log(`  ✔ [POSTGRES VERIFIED] ${tablesWritten}/${PROTECTED_TABLES.length} tables; ${totalWritten} rows`);
  console.log(`  ✔ [AUDIT PERSISTED] dr_restore_test.restore_audit id=${auditId}`);
}

async function runRestore() {
  const isFromCloud = process.argv.includes('--from-cloud') || process.argv.includes('--apply-target');
  const isApplyTarget = process.argv.includes('--apply-target');
  const backupDir = path.resolve(process.cwd(), 'supabase/backups');

  const mode = isApplyTarget ? 'FULL RESTORE TO TARGET DB' : isFromCloud ? 'CLOUD DRY-RUN + CHECKSUM VERIFY' : 'LOCAL DRY-RUN';

  console.log('========================================================================');
  console.log('  AI MOVIE FACTORY — DATABASE RESTORATION & INTEGRITY ENGINE');
  console.log(`  Mode: ${mode}`);
  console.log(`  Source: ${isFromCloud ? 'Remote Cloud Storage (database-backups)' : 'Local Hardened Storage'}`);
  console.log('========================================================================\n');

  let envelope: EncryptedBackupEnvelope;
  let rawBytes: Buffer;
  let snapshotName = 'local';

  if (isFromCloud) {
    const result = await downloadAndVerifyFromCloud();
    envelope = result.envelope;
    rawBytes = result.rawBytes;
    snapshotName = result.snapshotName;
  } else {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.enc.json')).sort().reverse();
    if (files.length === 0) throw new Error('No local encrypted snapshot found.');
    snapshotName = files[0];
    console.log(`  Loading local snapshot: ${snapshotName}`);
    rawBytes = fs.readFileSync(path.join(backupDir, snapshotName));
    envelope = JSON.parse(rawBytes.toString('utf-8'));

    // Local checksum verification
    const localChecksumPath = path.join(backupDir, snapshotName.replace('.enc.json', '.enc.sha256'));
    if (fs.existsSync(localChecksumPath)) {
      const storedHash = fs.readFileSync(localChecksumPath, 'utf-8').trim().split(/\s+/)[0];
      const actualHash = crypto.createHash('sha256').update(rawBytes).digest('hex');
      if (storedHash !== actualHash) throw new Error(`Local SHA-256 MISMATCH: snapshot may be corrupted.`);
      console.log(`  ✔ [LOCAL CHECKSUM VERIFIED] SHA-256: ${actualHash.substring(0, 24)}...`);
    }
  }

  console.log('🔒 Decrypting AES-256-GCM authenticated payload...');
  const decrypted = decryptPayload(envelope, encryptionSecret);

  console.log('\n🔍 Verifying Full Relational Constraints & Schema Graph Integrity...');
  const report = verifyRelationalIntegrity(decrypted.tables);

  for (const r of report.relations) {
    console.log(`  ✔ [${r.status}] ${r.relation} (Rows: ${r.checkedRows}, Orphaned: ${r.orphanedRows})`);
  }

  if (report.violationsCount > 0) {
    console.error(`\n❌ RESTORATION ABORTED: ${report.violationsCount} relational FK violations detected.`);
    process.exit(1);
  }

  if (isApplyTarget) {
    await applyRestoreToTargetDatabase(decrypted, `cloud:${snapshotName}`);
  }

  const mode_label = isApplyTarget ? 'FULL RESTORE TO TARGET DB' : 'DRY-RUN';

  console.log('\n========================================================================');
  console.log(`✅ DATABASE RESTORATION & RELATIONAL VERIFICATION PASSED! [${mode_label}]`);
  console.log(`  Snapshot: ${snapshotName}`);
  console.log(`  Source: ${isFromCloud ? 'Remote Cloud Object Storage' : 'Local Disk Storage'}`);
  console.log(`  Remote SHA-256 Checksum: ${isFromCloud ? 'VERIFIED' : 'N/A (local)'}`);
  console.log(`  Tables Verified: ${report.totalTables}/${PROTECTED_TABLES.length}`);
  console.log(`  Total Rows Restorable: ${report.totalRows}`);
  console.log(`  Foreign Key Relations Checked: ${report.relations.length} (0 Violations, 0 Orphaned Rows)`);
  if (isApplyTarget) {
    console.log(`  Target Schema: dr_restore_test (isolated restore zone, zero production impact)`);
    console.log(`  Restoration Write: COMPLETED & AUDIT LOGGED`);
  } else {
    console.log(`  Dry-Run Status: 100% CLEAN & CONSISTENT`);
  }
  console.log('========================================================================\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runRestore().catch((err) => {
    console.error('Fatal restoration error:', err);
    process.exit(1);
  });
}

export { runRestore };
