/**
 * Vercel Serverless Function: GET /api/oauth/connections
 * AI Movie Factory — Sanitized Connection Metadata Provider (T9.3)
 * STRICT SECURITY: Only exposes sanitized connection metadata (name, account ID, status, expiry).
 * NEVER leaks token ciphertext, encryption keys, or IVs to the client.
 */

import { authenticateServerlessRequest } from '../supabaseAdmin';
import { getProviderConfig } from '../oauthProviders';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  try {
    const { adminSupabase, user } = await authenticateServerlessRequest(req);

    // Read only sanitized columns from the vault for active connections
    const { data: rows, error: dbError } = await adminSupabase
      .from('platform_oauth_tokens')
      .select('id, platform, provider_account_id, provider_account_name, provider_avatar_url, connection_status, token_expires_at, granted_scopes, created_at, updated_at')
      .eq('user_id', user.id)
      .in('connection_status', ['connected', 'expired', 'needs_reauth']);

    if (dbError) {
      // In case the table is pending cloud migration execution, return empty list gracefully
      console.warn('OAuth connections fetch notice (table may be pending migration):', dbError.message);
      return res.status(200).json({
        connections: [],
        configuredPlatforms: {
          youtube: getProviderConfig('youtube').isConfigured,
          tiktok: getProviderConfig('tiktok').isConfigured,
          instagram: getProviderConfig('instagram').isConfigured,
          facebook: getProviderConfig('facebook').isConfigured,
        },
        notice: 'Database table platform_oauth_tokens pending execution or empty.',
      });
    }

    const now = Date.now();
    const sanitized = (rows || []).map((row: any) => {
      let status = row.connection_status || 'connected';
      if (row.token_expires_at && new Date(row.token_expires_at).getTime() < now) {
        status = 'expired';
      }
      return {
        id: row.id,
        platform: row.platform,
        provider_account_id: row.provider_account_id,
        provider_account_name: row.provider_account_name,
        provider_avatar_url: row.provider_avatar_url,
        connection_status: status,
        token_expires_at: row.token_expires_at,
        granted_scopes: row.granted_scopes || [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return res.status(200).json({
      connections: sanitized,
      configuredPlatforms: {
        youtube: getProviderConfig('youtube').isConfigured,
        tiktok: getProviderConfig('tiktok').isConfigured,
        instagram: getProviderConfig('instagram').isConfigured,
        facebook: getProviderConfig('facebook').isConfigured,
      },
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi') ? 401 : 500;
    return res.status(status).json({
      error: err.message || 'Gagal mengambil status koneksi platform.',
    });
  }
}
