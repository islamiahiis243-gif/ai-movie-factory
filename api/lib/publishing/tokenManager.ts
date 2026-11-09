/**
 * AI MOVIE FACTORY — SERVER-SIDE TOKEN MANAGER & REFRESH BROKER (T9.4)
 * Securely retrieves and decrypts stored tokens inside server environment only.
 * Automatically checks token expiration and performs refresh with providers.
 * Enforces AES-256-GCM re-encryption and vault synchronization.
 */

import { getSupabaseAdmin } from '../supabaseAdmin';
import { decryptOAuthToken, encryptOAuthToken } from '../oauthCrypto';
import { getProviderConfig } from '../oauthProviders';

export interface DecryptedTokenPayload {
  accessToken: string;
  providerAccountId: string;
  providerAccountName: string;
  expiresAt?: string | null;
}

/**
 * Retrieves and ensures a valid, active access token for publishing.
 * Automatically performs server-side refresh if near expiration.
 */
export async function getValidAccessToken(params: {
  userId: string;
  platform: string;
  accountId?: string | null;
}): Promise<DecryptedTokenPayload> {
  const { userId, platform, accountId } = params;
  const adminSupabase = getSupabaseAdmin();

  let query = adminSupabase
    .from('platform_oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .neq('connection_status', 'revoked')
    .neq('connection_status', 'disconnected');

  if (accountId) {
    query = query.eq('provider_account_id', accountId);
  }

  const { data: rows, error: fetchErr } = await query;

  if (fetchErr || !rows || rows.length === 0) {
    throw new Error(
      `Akun platform ${platform.toUpperCase()} belum terhubung. Silakan hubungkan akun terlebih dahulu di Studio Publishing Hub.`
    );
  }

  const tokenRecord = rows[0];
  const aad = `${userId}:${platform}:${tokenRecord.provider_account_id}`;

  if (!tokenRecord.encrypted_access_token || tokenRecord.encrypted_access_token === 'REVOKED') {
    throw new Error(`Kredensial ${platform.toUpperCase()} telah diputuskan atau tidak valid.`);
  }

  let decryptedAccessToken = '';
  try {
    decryptedAccessToken = decryptOAuthToken(tokenRecord.encrypted_access_token, aad);
  } catch (err: any) {
    throw new Error(`Gagal mendekripsi kredensial vault: ${err.message}`);
  }

  // Check if near expiration (within 5 minutes) or expired
  const now = Date.now();
  const isExpiring =
    tokenRecord.token_expires_at &&
    new Date(tokenRecord.token_expires_at).getTime() < now + 5 * 60 * 1000;

  if (isExpiring && tokenRecord.encrypted_refresh_token) {
    try {
      const decryptedRefreshToken = decryptOAuthToken(tokenRecord.encrypted_refresh_token, aad);
      const refreshed = await refreshProviderToken(platform, decryptedRefreshToken);

      if (refreshed.accessToken) {
        decryptedAccessToken = refreshed.accessToken;
        const newExpiresAt = refreshed.expiresIn
          ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
          : null;

        const newEncryptedAccess = encryptOAuthToken(refreshed.accessToken, aad);
        const newEncryptedRefresh = refreshed.refreshToken
          ? encryptOAuthToken(refreshed.refreshToken, aad)
          : tokenRecord.encrypted_refresh_token;

        await adminSupabase
          .from('platform_oauth_tokens')
          .update({
            encrypted_access_token: newEncryptedAccess,
            encrypted_refresh_token: newEncryptedRefresh,
            token_expires_at: newExpiresAt,
            connection_status: 'connected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', tokenRecord.id);

        return {
          accessToken: decryptedAccessToken,
          providerAccountId: tokenRecord.provider_account_id,
          providerAccountName: tokenRecord.provider_account_name,
          expiresAt: newExpiresAt,
        };
      }
    } catch (refreshErr: any) {
      console.warn(`Token refresh failed for ${platform}:`, refreshErr.message);
      // Mark needs reauth if refresh token rejected
      await adminSupabase
        .from('platform_oauth_tokens')
        .update({
          connection_status: 'needs_reauth',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tokenRecord.id);

      throw new Error(
        `Sesi otorisasi ${platform.toUpperCase()} telah kedaluwarsa dan gagal diperbarui secara otomatis. Silakan lakukan otorisasi ulang di Publishing Hub.`
      );
    }
  }

  return {
    accessToken: decryptedAccessToken,
    providerAccountId: tokenRecord.provider_account_id,
    providerAccountName: tokenRecord.provider_account_name,
    expiresAt: tokenRecord.token_expires_at,
  };
}

/**
 * Calls official provider refresh endpoints to exchange refresh token for a new access token.
 */
export async function refreshProviderToken(
  platform: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const providerConfig = getProviderConfig(platform);

  switch (platform) {
    case 'youtube': {
      const body = new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const res = await fetch(providerConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error_description || data.error || 'YouTube token refresh failed');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // Google may return a new refresh token if rotated
        expiresIn: data.expires_in,
      };
    }

    case 'tiktok': {
      const body = new URLSearchParams({
        client_key: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const res = await fetch(providerConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await res.json();
      const tokenData = data.data || data;
      if (!res.ok || data.error) {
        throw new Error(data.message || 'TikTok token refresh failed');
      }

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    }

    case 'instagram':
    case 'facebook': {
      // Meta Graph API long-lived user access token refresh
      const url = new URL(providerConfig.tokenUrl);
      url.searchParams.append('grant_type', 'fb_exchange_token');
      url.searchParams.append('client_id', providerConfig.clientId);
      url.searchParams.append('client_secret', providerConfig.clientSecret);
      url.searchParams.append('fb_exchange_token', refreshToken);

      const res = await fetch(url.toString(), { method: 'GET' });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error?.message || 'Meta token refresh failed');
      }

      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      };
    }

    default:
      throw new Error(`Token refresh not supported for platform: ${platform}`);
  }
}
