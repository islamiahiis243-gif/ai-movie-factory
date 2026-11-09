/**
 * Vercel Serverless Function: GET /api/oauth/callback
 * AI Movie Factory — OAuth Callback & Encrypted Token Vault Broker (T9.3.1 Security Hardened)
 * Validates one-time atomic transaction consumption, exchanges code for access & refresh tokens,
 * encrypts secrets with AES-256-GCM, and stores in the server-only platform_oauth_tokens vault.
 */

import { encryptOAuthToken } from '../oauthCrypto';
import { exchangeCodeForTokens, fetchPlatformUserProfile, getProviderConfig } from '../oauthProviders';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { consumeOAuthTransaction } from '../oauthTransactionStore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed. Use GET.');
  }

  const { code, state, error, error_description } = req.query || {};

  // Handle provider cancellation or denial
  if (error) {
    const errorMsg = error_description || error;
    const redirectTarget = `/studio?tab=publishing&subtab=universal_channels&oauth_error=${encodeURIComponent(
      String(errorMsg)
    )}`;
    return res.redirect(302, redirectTarget);
  }

  if (!code || !state) {
    return res.status(400).send('Bad Request: Parameter code dan state diperlukan dari provider OAuth.');
  }

  try {
    const stateStr = String(state);
    // Parse expected platform from secure state token prefix (e.g. amf_st_youtube_<random>)
    const stateParts = stateStr.split('_');
    const expectedPlatform = stateParts[2] || '';

    if (!expectedPlatform) {
      throw new Error('MALFORMED_STATE: Format state token tidak valid.');
    }

    const providerConfig = getProviderConfig(expectedPlatform);

    // 1. Atomically consume the one-time OAuth state transaction
    const transaction = await consumeOAuthTransaction({
      stateToken: stateStr,
      expectedPlatform,
      expectedRedirectUri: providerConfig.redirectUriPath,
    });

    const { userId, platform, returnUrl } = transaction;

    // 2. Exchange authorization code for tokens
    const tokenResult = await exchangeCodeForTokens(platform, String(code));

    // 3. Fetch creator profile metadata from provider
    const profile = await fetchPlatformUserProfile(platform, tokenResult.accessToken);

    // 4. Authenticated symmetric encryption (AES-256-GCM) with AAD
    const aad = `${userId}:${platform}:${profile.accountId}`;
    const encryptedAccessToken = encryptOAuthToken(tokenResult.accessToken, aad);
    const encryptedRefreshToken = tokenResult.refreshToken
      ? encryptOAuthToken(tokenResult.refreshToken, aad)
      : null;

    const expiresAt = tokenResult.expiresIn
      ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
      : null;

    const grantedScopes = tokenResult.scope
      ? tokenResult.scope.split(/[\s,]+/).filter(Boolean)
      : [];

    // 5. Secure storage in server-only platform_oauth_tokens vault using service_role
    const adminSupabase = getSupabaseAdmin();

    const { error: dbError } = await adminSupabase
      .from('platform_oauth_tokens')
      .upsert(
        {
          user_id: userId,
          platform,
          provider_account_id: profile.accountId,
          provider_account_name: profile.accountName,
          provider_avatar_url: profile.avatarUrl || null,
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt,
          granted_scopes: grantedScopes,
          connection_status: 'connected',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,platform,provider_account_id',
        }
      );

    if (dbError) {
      console.error('Failed to store OAuth tokens in vault:', dbError.message);
      return res.redirect(
        302,
        `/studio?tab=publishing&subtab=universal_channels&oauth_error=${encodeURIComponent(
          'Gagal menyimpan kredensial token terenkripsi ke brankas database: ' + dbError.message
        )}`
      );
    }

    // 6. Safe redirect back to Studio Publishing Hub with navigation hint only
    // Note: The UI must verify persistence via /api/oauth/connections and never trust query parameters alone
    const targetBase = returnUrl || '/studio?tab=publishing&subtab=universal_channels';
    const sep = targetBase.includes('?') ? '&' : '?';
    const redirectUrl = `${targetBase}${sep}auth_verify=${encodeURIComponent(platform)}`;

    return res.redirect(302, redirectUrl);
  } catch (err: any) {
    console.error('OAuth callback execution error:', err.message);
    return res.redirect(
      302,
      `/studio?tab=publishing&subtab=universal_channels&oauth_error=${encodeURIComponent(
        err.message || 'Terjadi kesalahan saat memproses otorisasi OAuth.'
      )}`
    );
  }
}
