/**
 * AI MOVIE FACTORY — ATOMIC CREDIT & FINANCIAL HARDENING ENGINE (PHASE 2)
 * Manages two-phase credit reservations, atomic settlements, rollbacks,
 * balance verification with row-level locks, and usage records.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CreditBalanceResult {
  settledBalance: number;
  reservedBalance: number;
  availableBalance: number;
}

export interface CreditReservationResult {
  reservationId: string;
  status: 'reserved' | 'already_reserved';
  availableBalance: number;
}

export interface CreditSettlementResult {
  transactionId: string | null;
  newBalance: number;
  status: 'settled' | 'already_settled';
}

export interface CreditReleaseResult {
  status: 'released' | 'already_released';
  availableBalance: number;
}

export interface RecordAiUsageParams {
  userId: string;
  projectId?: string | null;
  agentId?: string | null;
  operation: string;
  provider: string;
  model: string;
  requestId?: string | null;
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  durationSeconds?: number | null;
  executionDurationMs?: number | null;
  resolution?: string | null;
  status?: 'completed' | 'failed' | 'timeout';
  creditsReserved?: number;
  creditsCharged?: number;
  providerCostUsd?: number;
  paidEquivalentCostUsd?: number;
  costStatus?: 'free_tier' | 'metered_real' | 'mock_simulated' | 'estimated' | 'unknown';
  rawUsageMetadata?: any;
}

// In-memory test store for local testing without cloud database
interface MemoryReservation {
  id: string;
  userId: string;
  amount: number;
  operation: string;
  status: 'reserved' | 'settled' | 'released' | 'expired';
  idempotencyKey?: string;
  expiresAt: number;
}

const memoryReservations = new Map<string, MemoryReservation>();
const memoryBalances = new Map<string, number>();
const memoryUserLocks = new Map<string, Promise<void>>();

async function acquireMemoryLock(userId: string): Promise<() => void> {
  while (memoryUserLocks.has(userId)) {
    await memoryUserLocks.get(userId);
  }
  let release!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  memoryUserLocks.set(userId, lockPromise);
  return () => {
    if (memoryUserLocks.get(userId) === lockPromise) {
      memoryUserLocks.delete(userId);
    }
    release();
  };
}

export function _resetMemoryCreditStore() {
  memoryReservations.clear();
  memoryBalances.clear();
  memoryUserLocks.clear();
}

export function _setMemoryUserBalance(userId: string, balance: number) {
  memoryBalances.set(userId, balance);
}

/**
 * 1. Query real-time credit balance taking active holds into account
 */
export async function getUserCreditBalance(
  adminSupabase: SupabaseClient | null,
  userId: string
): Promise<CreditBalanceResult> {
  if (adminSupabase) {
    try {
      const { data, error } = await adminSupabase.rpc('get_user_credit_balance', {
        p_user_id: userId,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return {
          settledBalance: Number(data[0].settled_balance ?? 150),
          reservedBalance: Number(data[0].reserved_balance ?? 0),
          availableBalance: Number(data[0].available_balance ?? 150),
        };
      }
    } catch (err: any) {
      console.warn('Fallback to memory balance query:', err.message);
    }
  }

  // In-memory fallback
  const settled = memoryBalances.get(userId) ?? 150;
  const now = Date.now();
  let reserved = 0;
  for (const r of memoryReservations.values()) {
    if (r.userId === userId && r.status === 'reserved' && r.expiresAt > now) {
      reserved += r.amount;
    }
  }
  return {
    settledBalance: settled,
    reservedBalance: reserved,
    availableBalance: Math.max(0, settled - reserved),
  };
}

/**
 * 2. Atomic Credit Reservation (Phase 1)
 * Locks balance and creates a temporary hold. Rejects if balance < amount.
 */
export async function reserveUserCredits(params: {
  adminSupabase: SupabaseClient | null;
  userId: string;
  amount: number;
  operation: string;
  provider?: string;
  model?: string;
  idempotencyKey?: string;
}): Promise<CreditReservationResult> {
  const {
    adminSupabase,
    userId,
    amount,
    operation,
    provider = 'google_gemini',
    model = 'gemini-2.5-flash',
    idempotencyKey,
  } = params;

  if (amount <= 0) {
    throw new Error('INVALID_AMOUNT: Jumlah kredit reservasi harus lebih besar dari 0.');
  }

  if (adminSupabase) {
    try {
      const { data, error } = await adminSupabase.rpc('reserve_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_operation: operation,
        p_provider: provider,
        p_model: model,
        p_idempotency_key: idempotencyKey || null,
      });

      if (error) {
        if (error.message.includes('INSUFFICIENT_CREDITS')) {
          const err: any = new Error(error.message);
          err.code = 'INSUFFICIENT_CREDITS';
          err.status = 402;
          throw err;
        }
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        return {
          reservationId: data[0].reservation_id,
          status: data[0].status,
          availableBalance: Number(data[0].available_balance),
        };
      }
    } catch (err: any) {
      if (err.code === 'INSUFFICIENT_CREDITS' || err.status === 402) {
        throw err;
      }
      console.warn('reserveUserCredits cloud RPC error, using memory fallback:', err.message);
    }
  }

  // Memory fallback with atomic check & user mutex lock
  const releaseLock = await acquireMemoryLock(userId);
  try {
    if (idempotencyKey) {
      for (const r of memoryReservations.values()) {
        if (r.idempotencyKey === idempotencyKey) {
          const bal = await getUserCreditBalance(null, userId);
          return {
            reservationId: r.id,
            status: 'already_reserved',
            availableBalance: bal.availableBalance,
          };
        }
      }
    }

    const currentBal = await getUserCreditBalance(null, userId);
    if (currentBal.availableBalance < amount) {
      const err: any = new Error(
        `INSUFFICIENT_CREDITS: Saldo kredit tidak mencukupi (Tersedia: ${currentBal.availableBalance}, Diperlukan: ${amount})`
      );
      err.code = 'INSUFFICIENT_CREDITS';
      err.status = 402;
      throw err;
    }

    const resId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    memoryReservations.set(resId, {
      id: resId,
      userId,
      amount,
      operation,
      status: 'reserved',
      idempotencyKey,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return {
      reservationId: resId,
      status: 'reserved',
      availableBalance: currentBal.availableBalance - amount,
    };
  } finally {
    releaseLock();
  }
}

/**
 * 3. Atomic Credit Settlement (Phase 2 - Success)
 * Converts reservation into settled usage transaction.
 */
export async function settleUserCredits(params: {
  adminSupabase: SupabaseClient | null;
  reservationId: string;
  actualAmount: number;
  providerCostUsd?: number;
  usageMetadata?: any;
  description?: string;
}): Promise<CreditSettlementResult> {
  const {
    adminSupabase,
    reservationId,
    actualAmount,
    providerCostUsd = 0,
    usageMetadata = null,
    description = 'Eksekusi AI Studio',
  } = params;

  if (adminSupabase) {
    try {
      const { data, error } = await adminSupabase.rpc('settle_credits', {
        p_reservation_id: reservationId,
        p_actual_amount: actualAmount,
        p_provider_cost_usd: providerCostUsd,
        p_usage_metadata: usageMetadata ? JSON.parse(JSON.stringify(usageMetadata)) : null,
        p_description: description,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return {
          transactionId: data[0].transaction_id,
          newBalance: Number(data[0].new_balance),
          status: data[0].status,
        };
      }
      if (error) throw error;
    } catch (err: any) {
      console.warn('settleUserCredits cloud RPC error, using memory fallback:', err.message);
    }
  }

  // Memory fallback
  const res = memoryReservations.get(reservationId);
  if (!res) {
    throw new Error('RESERVATION_NOT_FOUND: Reservasi kredit tidak ditemukan.');
  }

  if (res.status === 'settled') {
    const curBal = memoryBalances.get(res.userId) ?? 150;
    return { transactionId: null, newBalance: curBal, status: 'already_settled' };
  }

  if (res.status !== 'reserved') {
    throw new Error(`INVALID_RESERVATION_STATUS: Reservasi berstatus "${res.status}", tidak dapat diselesaikan.`);
  }

  const currentSettled = memoryBalances.get(res.userId) ?? 150;
  const newBal = currentSettled - actualAmount;
  if (newBal < 0) {
    throw new Error(`NEGATIVE_BALANCE_VIOLATION: Saldo tidak boleh negatif (${newBal}).`);
  }

  res.status = 'settled';
  memoryBalances.set(res.userId, newBal);

  return {
    transactionId: `tx_mem_${Date.now()}`,
    newBalance: newBal,
    status: 'settled',
  };
}

/**
 * 4. Atomic Credit Release (Phase 2 - Rollback on Error/Timeout)
 * Releases held credits back to available balance.
 */
export async function releaseUserCredits(params: {
  adminSupabase: SupabaseClient | null;
  reservationId: string;
  reason?: string;
}): Promise<CreditReleaseResult> {
  const { adminSupabase, reservationId, reason = 'Kegagalan atau pembatalan' } = params;

  if (adminSupabase) {
    try {
      const { data, error } = await adminSupabase.rpc('release_credits', {
        p_reservation_id: reservationId,
        p_reason: reason,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return {
          status: data[0].status,
          availableBalance: Number(data[0].available_balance),
        };
      }
      if (error) throw error;
    } catch (err: any) {
      console.warn('releaseUserCredits cloud RPC error, using memory fallback:', err.message);
    }
  }

  // Memory fallback
  const res = memoryReservations.get(reservationId);
  if (!res) {
    throw new Error('RESERVATION_NOT_FOUND: Reservasi kredit tidak ditemukan.');
  }

  if (res.status === 'released') {
    const bal = await getUserCreditBalance(null, res.userId);
    return { status: 'already_released', availableBalance: bal.availableBalance };
  }

  if (res.status === 'settled') {
    throw new Error('CANNOT_RELEASE_SETTLED: Reservasi kredit telah diselesaikan.');
  }

  res.status = 'released';
  const bal = await getUserCreditBalance(null, res.userId);
  return { status: 'released', availableBalance: bal.availableBalance };
}

/**
 * 5. Record Usage Metrics (SSOT Metering)
 */
export async function recordAiUsage(
  adminSupabase: SupabaseClient | null,
  params: RecordAiUsageParams
): Promise<void> {
  if (!adminSupabase) return;

  try {
    await adminSupabase.from('ai_usage_records').insert({
      user_id: params.userId,
      project_id: params.projectId || null,
      agent_id: params.agentId || null,
      operation: params.operation,
      provider: params.provider,
      model: params.model,
      request_id: params.requestId || null,
      prompt_tokens: params.promptTokens || 0,
      candidates_tokens: params.candidatesTokens || 0,
      total_tokens: params.totalTokens || 0,
      cached_tokens: params.cachedTokens || 0,
      duration_seconds: params.durationSeconds || null,
      execution_duration_ms: params.executionDurationMs || null,
      resolution: params.resolution || null,
      status: params.status || 'completed',
      credits_reserved: params.creditsReserved || 0,
      credits_charged: params.creditsCharged || 0,
      provider_cost_usd: params.providerCostUsd || 0,
      paid_equivalent_cost_usd: params.paidEquivalentCostUsd || 0,
      cost_status: params.costStatus || 'free_tier',
      raw_usage_metadata: params.rawUsageMetadata || null,
    });
  } catch (err: any) {
    console.warn('recordAiUsage telemetry insert failed:', err.message);
  }
}

// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
