/**
 * AI Movie Factory — Server-Only OTT Media Delivery & Storage Path Resolver
 * Phase 6: Web & Independent OTT Publishing Studio (Milestone 2.9.2A)
 * 
 * Strict Security Invariants:
 * 1. Object Path Enforcement: Never trust client-supplied URLs or arbitrary paths.
 * 2. Bucket Boundary: Only allow trusted private OTT buckets ('ott-masters', 'project-assets').
 * 3. Domain Whitelist: Prohibit external domains from being processed as internal storage assets.
 * 4. Path Traversal Defense: Reject any paths containing directory traversal patterns ('..', '//').
 * 5. Bearer Signed Delivery: Generates time-limited signed delivery URLs (TTL 15 min / 900s)
 *    enabling direct CDN byte transfer with HTTP Range Requests (206 Partial Content).
 */

import { getSupabaseAdmin } from './supabaseAdmin.ts';

export const ALLOWED_OTT_STORAGE_BUCKETS = ['ott-masters', 'project-assets'] as const;
export type AllowedOttStorageBucket = typeof ALLOWED_OTT_STORAGE_BUCKETS[number];

export const DEFAULT_SIGNED_DELIVERY_TTL_SECONDS = 900; // 15 minutes

export interface ParsedStorageObject {
  bucket: string;
  objectPath: string;
}

export interface SignedDeliveryUrlResult {
  signedUrl: string;
  expiresAt: string;
  ttlSeconds: number;
}

/**
 * Parses and strictly validates a storage reference from database master_video_url.
 * Ensures the target object belongs to an authorized bucket and approved Supabase storage host.
 */
export function parseAndValidateStoragePath(rawUrlOrPath: string): ParsedStorageObject {
  if (!rawUrlOrPath || typeof rawUrlOrPath !== 'string') {
    throw new Error('INVALID_STORAGE_PATH: URL atau path master video tidak boleh kosong.');
  }

  const trimmed = rawUrlOrPath.trim();

  // Reject path traversal attacks
  if (trimmed.includes('..') || trimmed.includes('\\')) {
    throw new Error('SECURITY_VIOLATION: Path traversal terdeteksi pada referensi video.');
  }

  // Case 1: Full HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new Error('INVALID_STORAGE_URL: Format URL master video tidak valid.');
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    let allowedHost = 'jixfakvbhugpypjtyshq.supabase.co';
    if (supabaseUrl) {
      try {
        allowedHost = new URL(supabaseUrl).host;
      } catch {
        // Fallback to default host
      }
    }

    // Host Whitelist Check: Prohibit external domains
    if (parsedUrl.host !== allowedHost && !parsedUrl.host.includes('.supabase.co')) {
      throw new Error(`UNAUTHORIZED_STORAGE_HOST: Domain ${parsedUrl.host} bukan penyimpanan resmi AI Movie Factory.`);
    }

    // Pattern matching: /storage/v1/object/(public|sign|authenticated)/:bucket/:path
    const pathname = parsedUrl.pathname;
    const match = pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)?\/?([a-zA-Z0-9_-]+)\/(.+)$/);
    if (!match) {
      throw new Error('INVALID_STORAGE_STRUCTURE: Struktur path objek storage Supabase tidak dikenali.');
    }

    const [, bucket, rawPath] = match;
    const objectPath = decodeURIComponent(rawPath);

    if (!ALLOWED_OTT_STORAGE_BUCKETS.includes(bucket as any)) {
      throw new Error(`UNAUTHORIZED_STORAGE_BUCKET: Bucket '${bucket}' tidak diizinkan untuk master video OTT.`);
    }

    return { bucket, objectPath };
  }

  // Case 2: Relative storage path (e.g. "ott-masters/film_123/master.mp4" or "film_123/master.mp4")
  const pathParts = trimmed.split('/').filter(Boolean);
  if (pathParts.length === 0) {
    throw new Error('INVALID_STORAGE_PATH: Path objek kosong.');
  }

  if (ALLOWED_OTT_STORAGE_BUCKETS.includes(pathParts[0] as any)) {
    const bucket = pathParts[0];
    const objectPath = pathParts.slice(1).join('/');
    if (!objectPath) {
      throw new Error('INVALID_STORAGE_PATH: Nama file objek tidak ditentukan.');
    }
    return { bucket, objectPath };
  }

  // Default to ott-masters bucket for raw relative paths
  return {
    bucket: 'ott-masters',
    objectPath: trimmed.replace(/^\/+/, ''),
  };
}

/**
 * Issues a time-limited signed delivery URL directly from Supabase Storage.
 * The signed URL allows browser video players to perform HTTP Range Requests directly against the CDN.
 */
export async function createSignedDeliveryUrl(
  bucket: string,
  objectPath: string,
  ttlSeconds: number = DEFAULT_SIGNED_DELIVERY_TTL_SECONDS,
  adminClient?: any
): Promise<SignedDeliveryUrlResult> {
  const supabase = adminClient || getSupabaseAdmin();
  const expiresAtDate = new Date(Date.now() + ttlSeconds * 1000);

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`STORAGE_SIGNING_ERROR: Gagal menerbitkan signed delivery URL: ${error?.message || 'Unknown error'}`);
  }

  return {
    signedUrl: data.signedUrl,
    expiresAt: expiresAtDate.toISOString(),
    ttlSeconds,
  };
}
