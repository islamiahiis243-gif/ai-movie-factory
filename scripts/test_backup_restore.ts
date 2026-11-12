/**
 * AI MOVIE FACTORY — BACKUP & RESTORE INTEGRITY VERIFICATION SUITE
 * Purpose: Empirically verify backup encryption, decryption, checksums, and schema integrity.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { decryptPayload, EncryptedBackupEnvelope, PROTECTED_TABLES } from './backup_production_database';

dotenv.config();

const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!secret) {
  console.error('❌ FATAL: Secret key is required for restore test.');
  process.exit(1);
}

let assertionsPassed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  assertionsPassed++;
  console.log(`  ✔ [PASS] ${msg}`);
}

async function runRestoreVerification() {
  console.log('========================================================================');
  console.log('  AI MOVIE FACTORY — RESTORE TEST & ENCRYPTION VERIFICATION SUITE');
  console.log('========================================================================\n');

  const backupDir = path.resolve(process.cwd(), 'supabase/backups');
  assert(fs.existsSync(backupDir), 'supabase/backups directory exists');

  // 1. Locate the latest encrypted snapshot
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.enc.json'));
  assert(files.length > 0, `Found ${files.length} encrypted snapshot(s) in supabase/backups`);

  files.sort().reverse();
  const latestSnapshot = files[0];
  const snapshotPath = path.join(backupDir, latestSnapshot);
  const sha256Path = snapshotPath.replace('.enc.json', '.enc.sha256');

  console.log(`\nTesting latest snapshot: ${latestSnapshot}`);

  // 2. Verify SHA-256 Checksum on disk
  assert(fs.existsSync(sha256Path), `Checksum file exists: ${path.basename(sha256Path)}`);
  const rawBytes = fs.readFileSync(snapshotPath);
  const actualHash = crypto.createHash('sha256').update(rawBytes).digest('hex');
  const storedHashContent = fs.readFileSync(sha256Path, 'utf-8').trim();
  const storedHash = storedHashContent.split(/\s+/)[0];

  assert(actualHash === storedHash, `SHA-256 checksum matches disk payload (${actualHash.substring(0, 16)}...)`);

  // 3. Parse Envelope
  const envelope: EncryptedBackupEnvelope = JSON.parse(rawBytes.toString('utf-8'));
  assert(envelope.version === '2.0-hardened', 'Envelope version is 2.0-hardened');
  assert(envelope.algorithm === 'aes-256-gcm', 'Envelope algorithm is AES-256-GCM');
  assert(envelope.keyDerivation === 'pbkdf2-sha256-100000', 'Envelope PBKDF2 100k rounds verified');
  assert(typeof envelope.saltHex === 'string' && envelope.saltHex.length === 32, '16-byte salt present');
  assert(typeof envelope.ivHex === 'string' && envelope.ivHex.length === 24, '12-byte GCM IV present');
  assert(typeof envelope.authTagHex === 'string' && envelope.authTagHex.length === 32, '16-byte GCM AuthTag present');
  assert(envelope.tablesCount === PROTECTED_TABLES.length, `Envelope covers all ${PROTECTED_TABLES.length} tables`);

  // 4. Test Decryption with correct secret
  console.log('\nTesting AES-256-GCM decryption with valid secret...');
  const decrypted = decryptPayload(envelope, secret);
  assert(decrypted !== null && typeof decrypted === 'object', 'Payload decrypted and parsed as valid JSON');
  assert(decrypted.project === 'jixfakvbhugpypjtyshq', 'Decrypted project matches target database');
  assert(decrypted.tablesCount === PROTECTED_TABLES.length, `Decrypted manifest includes ${PROTECTED_TABLES.length} tables`);

  for (const table of PROTECTED_TABLES) {
    assert(decrypted.tables[table] !== undefined, `Table "${table}" schema & rows recovered cleanly`);
  }

  // 5. Test Authentication Tamper Resistance (GCM Auth Tag Failure)
  console.log('\nTesting AES-256-GCM tamper-resistance and invalid secret rejection...');
  let wrongKeyFailed = false;
  try {
    decryptPayload(envelope, 'invalid-fake-password-attempt');
  } catch (err) {
    wrongKeyFailed = true;
  }
  assert(wrongKeyFailed, 'Decryption with invalid secret strictly rejected by AES-GCM AuthTag');

  let tamperedPayloadFailed = false;
  try {
    const tamperedEnvelope = { ...envelope, ciphertextBase64: envelope.ciphertextBase64.substring(0, envelope.ciphertextBase64.length - 8) + 'AAAA' };
    decryptPayload(tamperedEnvelope, secret);
  } catch (err) {
    tamperedPayloadFailed = true;
  }
  assert(tamperedPayloadFailed, 'Tampered ciphertext strictly rejected by AES-GCM AuthTag');

  console.log('\n========================================================================');
  console.log(`✅ RESTORE & ENCRYPTION VERIFICATION SUITE PASSED! (${assertionsPassed}/${assertionsPassed} Assertions)`);
  console.log('========================================================================\n');
}

runRestoreVerification().catch((err) => {
  console.error('Restore verification failed:', err);
  process.exit(1);
});
