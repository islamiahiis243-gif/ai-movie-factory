/**
 * AI Movie Factory — Server-Only OTT Entitlement Grant Token Signer & Verifier
 * Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.1 Clearance)
 * 
 * Strict Security Invariants:
 * 1. Server-Only Isolation: This module MUST NEVER be bundled into the browser/Vite frontend.
 * 2. Cryptographic Integrity: HMAC-SHA256 signatures with constant-time equality check (crypto.timingSafeEqual).
 * 3. Privacy Preservation: ZERO raw email addresses or PII in Base64URL claims.
 *    The `wm` claim uses pseudonymous forensic hashing (HMAC of viewerId with secret).
 * 4. Bounded-Life Replay Policy:
 *    - Grant Token is a Bearer Session Ticket valid for multi-chunk/multi-request playback during its bounded validity period (`exp`).
 *    - `jti` is a unique Grant ID (not a single-use nonce), enabling lawful playback streaming without breaking HTTP range requests.
 * 5. Instant Revocation Support (Tier-2 Live Re-verification):
 *    - `validateGrantAgainstLiveEntitlement()` checks live pass/subscription status so revocation by admin takes effect IMMEDIATELY,
 *      without waiting for token expiry.
 * 6. Zero Raw Storage URL Leakage: Tokens contain NO master video file paths or storage URLs.
 */

import crypto from 'crypto';
import type {
  OttAccessPolicy,
  OttContentType,
  OttEntitlementGrant,
  OttEntitlementGrantPayload,
  OttAccessPass,
  OttViewerSubscription,
} from '../src/types/database.ts';

/**
 * Default validity window for an ephemeral playback grant token (2 hours).
 */
export const DEFAULT_GRANT_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Retrieves the cryptographic secret used to sign and verify entitlement grants.
 * Strictly server-side: reads environment secrets with fallback.
 */
export function getGrantSigningSecret(): string {
  return (
    process.env.OTT_GRANT_SIGNING_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    'amf-ott-secure-grant-signing-key-production-ssot'
  );
}

/**
 * Generates a pseudonymous, privacy-preserving watermark identifier.
 * NEVER leaks raw email addresses or PII into Base64URL claims.
 * The server with the secret can forensically link the hash back to the viewer if needed.
 */
export function generatePseudonymousWatermark(viewerId: string, secret?: string): string {
  if (!viewerId || viewerId === 'anon') {
    return 'anon';
  }
  const key = secret || getGrantSigningSecret();
  const hash = crypto.createHmac('sha256', key).update(`wm_${viewerId}`).digest('hex').substring(0, 16);
  return `wm_${hash}`;
}

/**
 * Mask token string for safe, sanitized application logs.
 * Example: "egt_amf_eyJ2Ij...a9c4f1"
 */
export function maskTokenForLogging(token?: string | null): string {
  if (!token || typeof token !== 'string') return '[NO_TOKEN]';
  if (token.length <= 20) return '[REDACTED]';
  return `${token.substring(0, 16)}...${token.slice(-6)}`;
}

/**
 * Options for generating an entitlement grant.
 */
export interface GenerateEntitlementGrantOptions {
  contentId: string;
  contentType?: 'episode' | 'film';
  viewerId: string;
  channelId: string;
  accessPolicy: OttAccessPolicy;
  now?: Date;
  maxExpiryMs?: number;
  watermarkRequired?: boolean;
}

/**
 * Generates an opaque, cryptographically signed entitlement grant token.
 * HMAC-SHA256 signature binds the grant strictly to viewer, content, channel, and expiry.
 * Raw video storage URLs are NEVER included in the token or payload.
 */
export function generateEntitlementGrant(
  contentIdOrOptions: string | GenerateEntitlementGrantOptions,
  viewerIdArg?: string,
  channelIdArg?: string,
  accessPolicyArg?: OttAccessPolicy,
  nowArg?: Date,
  watermarkRequiredArg: boolean = true
): OttEntitlementGrant {
  const isOptions = typeof contentIdOrOptions === 'object';
  const contentId = isOptions ? contentIdOrOptions.contentId : contentIdOrOptions;
  const contentType: 'episode' | 'film' = isOptions ? (contentIdOrOptions.contentType || 'film') : 'film';
  const viewerId = isOptions ? contentIdOrOptions.viewerId : viewerIdArg!;
  const channelId = isOptions ? contentIdOrOptions.channelId : channelIdArg!;
  const accessPolicy = isOptions ? contentIdOrOptions.accessPolicy : accessPolicyArg!;
  const now = (isOptions ? contentIdOrOptions.now : nowArg) || new Date();
  const watermarkRequired = isOptions
    ? (contentIdOrOptions.watermarkRequired !== undefined ? contentIdOrOptions.watermarkRequired : true)
    : watermarkRequiredArg;
  const maxExpiryMs = isOptions ? contentIdOrOptions.maxExpiryMs : undefined;

  const nowMs = now.getTime();
  let expMs = nowMs + DEFAULT_GRANT_TTL_MS;
  // Cap expiry if the underlying ticket/subscription expires sooner than the default window
  if (maxExpiryMs !== undefined && maxExpiryMs > nowMs) {
    expMs = Math.min(expMs, maxExpiryMs);
  }

  const grantId = `gid_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const secret = getGrantSigningSecret();

  // Privacy Guard: Never store raw email in wm claim; use pseudonymous hash
  const wmClaim: boolean | string = watermarkRequired ? generatePseudonymousWatermark(viewerId, secret) : false;

  const payload: OttEntitlementGrantPayload = {
    v: 1,
    sub: viewerId,
    cid: contentId,
    cty: contentType,
    chid: channelId,
    pol: accessPolicy,
    wm: wmClaim,
    iat: nowMs,
    exp: expMs,
    jti: grantId,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  const signature = hmac.digest('base64url');
  const grantToken = `egt_amf_${payloadB64}.${signature}`;

  return {
    grantToken,
    expiresAt: new Date(expMs).toISOString(),
    issuedAt: now.toISOString(),
    accessPolicy,
    watermarkRequired,
    viewerId,
    contentId,
    channelId,
    grantId,
  };
}

/**
 * Options for verifying an entitlement grant token on subsequent playback requests.
 */
export interface VerifyGrantTokenOptions {
  expectedViewerId: string;
  expectedContentId: string;
  expectedChannelId: string;
  expectedContentType?: 'episode' | 'film';
  currentTime?: Date;
}

/**
 * Result of entitlement grant token verification.
 */
export interface VerifyGrantTokenResult {
  valid: boolean;
  reason?: string;
  code?: string;
  payload?: OttEntitlementGrantPayload;
}

/**
 * Verifies the cryptographic signature, context bindings, and expiry of an entitlement grant token.
 * Consumed by Milestone 2.9.2 streaming player session issuer.
 */
export function verifyEntitlementGrantToken(
  token: string,
  options: VerifyGrantTokenOptions
): VerifyGrantTokenResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, code: 'MISSING_TOKEN', reason: 'Missing or empty grant token.' };
  }

  if (!token.startsWith('egt_amf_')) {
    return { valid: false, code: 'INVALID_PREFIX', reason: 'Invalid token prefix (must begin with egt_amf_).' };
  }

  const rawToken = token.slice('egt_amf_'.length);
  const parts = rawToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, code: 'MALFORMED_GRANT_TOKEN', reason: 'Malformed token structure (expected payload.signature).' };
  }

  const [payloadB64, providedSig] = parts;

  // 1. Verify HMAC Signature using timing-safe comparison to prevent timing attacks
  const secret = getGrantSigningSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  const expectedSig = hmac.digest('base64url');

  if (providedSig.length !== expectedSig.length) {
    return { valid: false, code: 'INVALID_SIGNATURE', reason: 'Cryptographic signature mismatch (Token tampered or invalid secret).' };
  }

  const sigBufProvided = Buffer.from(providedSig);
  const sigBufExpected = Buffer.from(expectedSig);
  if (!crypto.timingSafeEqual(sigBufProvided, sigBufExpected)) {
    return { valid: false, code: 'INVALID_SIGNATURE', reason: 'Cryptographic signature mismatch (Token tampered or invalid secret).' };
  }

  // 2. Parse payload safely
  let payload: OttEntitlementGrantPayload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, code: 'JSON_PARSE_ERROR', reason: 'Failed to parse token payload JSON.' };
  }

  const now = options.currentTime || new Date();
  const nowMs = now.getTime();

  // 3. Expiration Check
  if (nowMs >= payload.exp) {
    return {
      valid: false,
      code: 'TOKEN_EXPIRED',
      reason: `Grant token expired at ${new Date(payload.exp).toISOString()} (Current: ${now.toISOString()}).`,
      payload,
    };
  }

  // 4. Issued-At Clock Skew Check (reject tokens claiming to be issued > 60 seconds into future)
  if (payload.iat > nowMs + 60000) {
    return {
      valid: false,
      code: 'CLOCK_SKEW_VIOLATION',
      reason: 'Token issued in the future (Clock skew violation).',
      payload,
    };
  }

  // 5. Viewer Binding Check
  if (payload.sub !== options.expectedViewerId) {
    return {
      valid: false,
      code: 'VIEWER_MISMATCH',
      reason: `Token viewer binding mismatch: Expected ${options.expectedViewerId}, got ${payload.sub}.`,
      payload,
    };
  }

  // 6. Content ID Binding Check
  if (payload.cid !== options.expectedContentId) {
    return {
      valid: false,
      code: 'CONTENT_MISMATCH',
      reason: `Token content binding mismatch: Expected ${options.expectedContentId}, got ${payload.cid}.`,
      payload,
    };
  }

  // 7. Channel ID Binding Check
  if (payload.chid !== options.expectedChannelId) {
    return {
      valid: false,
      code: 'CHANNEL_MISMATCH',
      reason: `Token channel binding mismatch: Expected ${options.expectedChannelId}, got ${payload.chid}.`,
      payload,
    };
  }

  // 8. Content Type Binding Check (if specified)
  if (options.expectedContentType && payload.cty !== options.expectedContentType) {
    return {
      valid: false,
      code: 'CONTENT_TYPE_MISMATCH',
      reason: `Token content type binding mismatch: Expected ${options.expectedContentType}, got ${payload.cty}.`,
      payload,
    };
  }

  return {
    valid: true,
    payload,
  };
}

/**
 * Options for validating a grant token against live database entitlement state (Tier 2).
 */
export interface LiveEntitlementCheckOptions {
  pass?: OttAccessPass | null;
  subscription?: OttViewerSubscription | null;
  contentPublicationStatus?: 'draft' | 'in_review' | 'published' | 'archived';
  now?: Date;
}

/**
 * Result of live entitlement state re-verification.
 */
export interface LiveEntitlementCheckResult {
  valid: boolean;
  code?: string;
  reason?: string;
}

/**
 * Re-verifies a validated grant token against authoritative live database records.
 * Solves the instant-revocation problem: If a pass/subscription is revoked or expired
 * while the token is still mathematically within its `exp` window, this function immediately rejects access.
 */
export function validateGrantAgainstLiveEntitlement(
  payload: OttEntitlementGrantPayload,
  options: LiveEntitlementCheckOptions
): LiveEntitlementCheckResult {
  const now = options.now || new Date();
  const nowMs = now.getTime();

  // Content publication check
  if (options.contentPublicationStatus && options.contentPublicationStatus !== 'published') {
    return {
      valid: false,
      code: 'CONTENT_NOT_PUBLISHED',
      reason: `Content is no longer published (Status: ${options.contentPublicationStatus}).`,
    };
  }

  // Free and trailer preview grants do not require pass/subscription re-checks
  if (payload.pol === 'free' || payload.pol === 'trailer_preview') {
    return { valid: true };
  }

  // TVOD Rental or Lifetime Policy Check
  if (payload.pol === 'tvod_rental' || payload.pol === 'tvod_lifetime') {
    if (!options.pass) {
      return {
        valid: false,
        code: 'PASS_NOT_FOUND',
        reason: 'Underlying TVOD access pass was not found in database.',
      };
    }
    if (options.pass.status === 'revoked') {
      return {
        valid: false,
        code: 'PASS_REVOKED',
        reason: 'Access pass was revoked by administrator or payment dispute.',
      };
    }
    if (options.pass.status === 'expired') {
      return {
        valid: false,
        code: 'PASS_EXPIRED',
        reason: 'Access pass has expired.',
      };
    }
    if (options.pass.valid_until && new Date(options.pass.valid_until).getTime() <= nowMs) {
      return {
        valid: false,
        code: 'PASS_EXPIRED',
        reason: `Access pass expired at ${options.pass.valid_until}.`,
      };
    }
    return { valid: true };
  }

  // SVOD Channel Subscription Policy Check
  if (payload.pol === 'svod_channel' || payload.pol === 'hybrid') {
    if (!options.subscription) {
      return {
        valid: false,
        code: 'SUBSCRIPTION_NOT_FOUND',
        reason: 'Underlying SVOD subscription was not found in database.',
      };
    }
    if (options.subscription.status === 'revoked') {
      return {
        valid: false,
        code: 'SUBSCRIPTION_REVOKED',
        reason: 'Channel subscription was revoked.',
      };
    }
    if (options.subscription.status === 'expired') {
      return {
        valid: false,
        code: 'SUBSCRIPTION_EXPIRED',
        reason: 'Channel subscription has expired.',
      };
    }
    if (
      options.subscription.status === 'cancelled' &&
      new Date(options.subscription.current_period_end).getTime() <= nowMs
    ) {
      return {
        valid: false,
        code: 'SUBSCRIPTION_EXPIRED',
        reason: `Subscription cancellation grace period ended at ${options.subscription.current_period_end}.`,
      };
    }
    return { valid: true };
  }

  return { valid: true };
}
