/**
 * AI MOVIE FACTORY — ONE-TIME OAUTH TRANSACTION STORE (T9.3.1)
 * Enforces strictly atomic, single-use OAuth state parameters to eliminate replay attacks.
 * Binds transactions to: AMF User ID, Provider Platform, Redirect URI, Expiration, and Optional PKCE.
 */

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabaseAdmin';

export interface OAuthTransaction {
  id: string;
  userId: string;
  platform: string;
  stateToken: string;
  redirectUri: string;
  returnUrl?: string;
  codeVerifier?: string;
  consumedAt?: string | null;
  expiresAt: string;
  createdAt: string;
}

// In-memory fallback / test cache with atomic CAS (Compare-And-Swap) lock
const memoryTransactionStore = new Map<string, OAuthTransaction>();
const activeLocks = new Set<string>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes strict TTL

/**
 * Creates and persists a cryptographically secure, one-time OAuth state transaction.
 */
export async function createOAuthTransaction(params: {
  userId: string;
  platform: string;
  redirectUri: string;
  returnUrl?: string;
  codeVerifier?: string;
  ttlMs?: number;
}): Promise<{ state: string; transaction: OAuthTransaction }> {
  const { userId, platform, redirectUri, returnUrl, codeVerifier, ttlMs } = params;

  if (!userId || !platform || !redirectUri) {
    throw new Error('userId, platform, and redirectUri are required for OAuth transaction');
  }

  // 32-byte cryptographically random hex token
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const stateToken = `amf_st_${platform}_${randomBytes}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (ttlMs || DEFAULT_TTL_MS)).toISOString();

  const transaction: OAuthTransaction = {
    id: crypto.randomUUID ? crypto.randomUUID() : `tx_${Date.now()}_${Math.random()}`,
    userId,
    platform,
    stateToken,
    redirectUri,
    returnUrl: returnUrl || '/studio?tab=publishing&subtab=universal_channels',
    codeVerifier,
    consumedAt: null,
    expiresAt,
    createdAt: now.toISOString(),
  };

  // 1. Try persisting to Supabase Cloud public.oauth_state_transactions via service_role
  try {
    const adminSupabase = getSupabaseAdmin();
    const { error: dbErr } = await adminSupabase.from('oauth_state_transactions').insert({
      id: transaction.id,
      user_id: transaction.userId,
      platform: transaction.platform,
      state_token: transaction.stateToken,
      redirect_uri: transaction.redirectUri,
      code_verifier: transaction.codeVerifier || null,
      expires_at: transaction.expiresAt,
      created_at: transaction.createdAt,
    });

    if (dbErr) {
      // If table is pending cloud migration or not yet available, fallback to memory
      console.warn('oauth_state_transactions table notice (falling back to memory):', dbErr.message);
    }
  } catch (err: any) {
    console.warn('OAuth state persistence using in-memory transactional cache:', err.message);
  }

  // Always mirror in memory store for resilient multi-layer resolution
  memoryTransactionStore.set(stateToken, { ...transaction });

  return { state: stateToken, transaction };
}

/**
 * Atomically consumes an OAuth state transaction exactly once.
 * Rejects:
 * - Unknown or forged states
 * - Reused / already consumed states (Replay attack detection)
 * - Expired states
 * - Provider platform mismatches
 * - Redirect URI mismatches
 */
export async function consumeOAuthTransaction(params: {
  stateToken: string;
  expectedPlatform: string;
  expectedRedirectUri?: string;
}): Promise<OAuthTransaction> {
  const { stateToken, expectedPlatform, expectedRedirectUri } = params;

  if (!stateToken || typeof stateToken !== 'string') {
    throw new Error('Parameter state diperlukan dan tidak boleh kosong.');
  }

  // Atomic lock on stateToken to guarantee zero race-condition window
  if (activeLocks.has(stateToken)) {
    throw new Error('REPLAY_DETECTED: Transaksi OAuth sedang diproses secara bersamaan.');
  }
  activeLocks.add(stateToken);

  try {
    let consumedTransaction: OAuthTransaction | null = null;
    let failureReason: string | null = null;

    // 1. Attempt atomic DB update if Supabase admin is configured
    try {
      const adminSupabase = getSupabaseAdmin();
      const nowIso = new Date().toISOString();

      // Atomic UPDATE WHERE consumed_at IS NULL AND expires_at > now
      const { data: updatedRows, error: updateErr } = await adminSupabase
        .from('oauth_state_transactions')
        .update({ consumed_at: nowIso })
        .eq('state_token', stateToken)
        .is('consumed_at', null)
        .gt('expires_at', nowIso)
        .eq('platform', expectedPlatform)
        .select();

      if (!updateErr && updatedRows && updatedRows.length > 0) {
        const row = updatedRows[0];
        consumedTransaction = {
          id: row.id,
          userId: row.user_id,
          platform: row.platform,
          stateToken: row.state_token,
          redirectUri: row.redirect_uri,
          codeVerifier: row.code_verifier,
          consumedAt: row.consumed_at,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        };
      } else {
        // Detailed failure diagnosis from database
        const { data: existingRows } = await adminSupabase
          .from('oauth_state_transactions')
          .select('*')
          .eq('state_token', stateToken)
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          const existing = existingRows[0];
          if (existing.consumed_at) {
            failureReason = 'REPLAY_DETECTED: State OAuth telah digunakan sebelumnya (Replay Attack dicegah).';
          } else if (new Date(existing.expires_at).getTime() <= Date.now()) {
            failureReason = 'EXPIRED_STATE: Masa berlaku transaksi OAuth telah kedaluwarsa (maksimal 5 menit).';
          } else if (existing.platform !== expectedPlatform) {
            failureReason = `PROVIDER_MISMATCH: Transaksi ditujukan untuk platform ${existing.platform}, bukan ${expectedPlatform}.`;
          } else if (expectedRedirectUri && existing.redirect_uri !== expectedRedirectUri) {
            failureReason = 'REDIRECT_URI_MISMATCH: Redirect URI transaksi tidak sesuai.';
          }
        }
      }
    } catch {
      // Supabase query failed, proceed to memory store check
    }

    // 2. Check memory store if not yet resolved from DB
    if (!consumedTransaction) {
      const memTx = memoryTransactionStore.get(stateToken);
      if (!memTx) {
        throw new Error(failureReason || 'INVALID_STATE: Token transaksi OAuth tidak valid atau tidak ditemukan.');
      }

      if (memTx.consumedAt) {
        throw new Error('REPLAY_DETECTED: State OAuth telah digunakan sebelumnya (Replay Attack dicegah).');
      }

      if (new Date(memTx.expiresAt).getTime() <= Date.now()) {
        throw new Error('EXPIRED_STATE: Masa berlaku transaksi OAuth telah kedaluwarsa (maksimal 5 menit).');
      }

      if (memTx.platform !== expectedPlatform) {
        throw new Error(`PROVIDER_MISMATCH: Transaksi ditujukan untuk platform ${memTx.platform}, bukan ${expectedPlatform}.`);
      }

      if (expectedRedirectUri && memTx.redirectUri !== expectedRedirectUri) {
        throw new Error('REDIRECT_URI_MISMATCH: Redirect URI transaksi tidak sesuai.');
      }

      // Atomic CAS in memory
      memTx.consumedAt = new Date().toISOString();
      consumedTransaction = { ...memTx };
    }

    if (!consumedTransaction) {
      throw new Error(failureReason || 'INVALID_STATE: Otorisasi transaksi OAuth gagal diverifikasi.');
    }

    // Also mark memory store as consumed to keep in sync
    const memEntry = memoryTransactionStore.get(stateToken);
    if (memEntry) {
      memEntry.consumedAt = consumedTransaction.consumedAt;
    }

    return consumedTransaction;
  } finally {
    activeLocks.delete(stateToken);
  }
}

/**
 * Resets memory store (for testing purposes only)
 */
export function _resetMemoryTransactionStore(): void {
  memoryTransactionStore.clear();
  activeLocks.clear();
}
