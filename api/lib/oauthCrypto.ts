/**
 * AI MOVIE FACTORY — OAUTH CRYPTOGRAPHIC VAULT (T9.3)
 * Authenticated Symmetric Encryption (AES-256-GCM) with IV/Nonce & Auth Tag
 * CSRF Protection & Signed State Token Broker
 */

import crypto from 'crypto';

const ENVELOPE_VERSION = 'v1';
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Resolves the 256-bit (32-byte) symmetric encryption key.
 * Hierarchy:
 * 1. OAUTH_ENCRYPTION_KEY env var (hex 64 chars or 32-byte string/base64)
 * 2. SHA-256 derived key from SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY
 * 3. Fallback deterministic development/test key (non-production only)
 */
export function getEncryptionKey(): Buffer {
  const envKey = (process.env.OAUTH_ENCRYPTION_KEY || process.env.OAUTH_TOKEN_ENCRYPTION_KEY)?.trim();
  if (envKey) {
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    if (envKey.length === 32) {
      return Buffer.from(envKey, 'utf8');
    }
    // Attempt base64 decode if 44 chars (32 bytes base64 encoded)
    try {
      const buf = Buffer.from(envKey, 'base64');
      if (buf.length === 32) return buf;
    } catch {
      // Fall through to hash derivation
    }
    return crypto.createHash('sha256').update(envKey).digest();
  }

  const supabaseSecret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseSecret && !supabaseSecret.includes('your-supabase')) {
    return crypto
      .createHash('sha256')
      .update(`amf_oauth_vault_salt_${supabaseSecret}`)
      .digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: OAUTH_ENCRYPTION_KEY is required in production environment'
    );
  }

  // Development/Test fallback key
  return crypto
    .createHash('sha256')
    .update('amf_dev_test_oauth_vault_key_2026')
    .digest();
}

/**
 * Encrypts an OAuth token (access token or refresh token) using AES-256-GCM.
 * @param plaintext The secret token string
 * @param aad Additional Authenticated Data (e.g. `userId:platform:accountId`)
 * @returns Serialized envelope: `v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 */
export function encryptOAuthToken(plaintext: string, aad: string): string {
  if (!plaintext) {
    throw new Error('Plaintext token cannot be empty');
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 96-bit IV for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENVELOPE_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an OAuth token envelope using AES-256-GCM.
 * Authenticates that ciphertext and AAD have not been tampered with or transplanted.
 */
export function decryptOAuthToken(envelope: string, aad: string): string {
  if (!envelope || typeof envelope !== 'string') {
    throw new Error('Invalid token envelope format');
  }

  const parts = envelope.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed token envelope: expected 4 segments');
  }

  const [version, ivHex, tagHex, cipherHex] = parts;
  if (version !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelope version: ${version}`);
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  if (iv.length !== 12) {
    throw new Error('Invalid IV length: expected 12 bytes');
  }
  if (authTag.length !== 16) {
    throw new Error('Invalid authentication tag length: expected 16 bytes');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    throw new Error(
      `Decryption failed: Ciphertext or authentication tag verification failed (${err.message})`
    );
  }
}

export interface OAuthStatePayload {
  userId: string;
  platform: string;
  returnUrl?: string;
  nonce: string;
  iat: number;
  exp: number;
}

/**
 * Generates a tamper-proof HMAC-SHA256 signed OAuth State parameter.
 */
export function generateOAuthState(params: {
  userId: string;
  platform: string;
  returnUrl?: string;
}): string {
  const { userId, platform, returnUrl } = params;
  const now = Date.now();
  const payload: OAuthStatePayload = {
    userId,
    platform,
    returnUrl: returnUrl || '/studio?tab=publishing&subtab=universal_channels',
    nonce: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: now + STATE_MAX_AGE_MS,
  };

  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const secret = process.env.OAUTH_STATE_SECRET?.trim()
    ? crypto.createHash('sha256').update(process.env.OAUTH_STATE_SECRET.trim()).digest()
    : getEncryptionKey();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(base64Payload)
    .digest('hex');

  return `${base64Payload}.${signature}`;
}

/**
 * Validates and unpacks an OAuth State parameter.
 * Rejects expired, tampered, or mismatched states.
 */
export function verifyOAuthState(stateString: string): OAuthStatePayload {
  if (!stateString || typeof stateString !== 'string') {
    throw new Error('Missing or invalid state parameter');
  }

  const dotIndex = stateString.indexOf('.');
  if (dotIndex === -1) {
    throw new Error('Malformed state parameter: missing signature');
  }

  const base64Payload = stateString.substring(0, dotIndex);
  const signature = stateString.substring(dotIndex + 1);

  const secret = process.env.OAUTH_STATE_SECRET?.trim()
    ? crypto.createHash('sha256').update(process.env.OAUTH_STATE_SECRET.trim()).digest()
    : getEncryptionKey();
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(base64Payload)
    .digest('hex');

  // Constant-time comparison
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid state signature: CSRF verification failed');
  }

  // Restore base64
  let base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  let payload: OAuthStatePayload;
  try {
    const rawJson = Buffer.from(base64, 'base64').toString('utf8');
    payload = JSON.parse(rawJson);
  } catch {
    throw new Error('Failed to parse state payload JSON');
  }

  if (!payload.userId || !payload.platform || !payload.exp) {
    throw new Error('Incomplete state payload');
  }

  if (Date.now() > payload.exp) {
    throw new Error('OAuth state has expired (exceeded 10 minutes limit)');
  }

  return payload;
}
