/**
 * Vercel Serverless Function: POST /api/oauth/disconnect
 * AI Movie Factory — OAuth Revocation & Vault Disconnect Broker (T9.3)
 * Authenticates user, revokes token at provider if supported, and deletes/marks revoked in vault.
 */

import { authenticateServerlessRequest } from '../lib/supabaseAdmin';
import { getProviderConfig } from '../lib/oauthProviders';
import { decryptOAuthToken } from '../lib/oauthCrypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { adminSupabase, user } = await authenticateServerlessRequest(req);
    const { platform, accountId } = req.body || {};

    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({ error: 'Parameter "platform" diperlukan.' });
    }

    // Retrieve the existing token record to attempt remote revocation
    let query = adminSupabase
      .from('platform_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform);

    if (accountId) {
      query = query.eq('provider_account_id', accountId);
    }

    const { data: records, error: fetchErr } = await query;

    if (!fetchErr && records && records.length > 0) {
      const record = records[0];
      const providerConfig = getProviderConfig(platform);

      // Best effort remote revocation
      if (providerConfig.revokeUrl && record.encrypted_access_token) {
        try {
          const aad = `${user.id}:${platform}:${record.provider_account_id}`;
          const decryptedToken = decryptOAuthToken(record.encrypted_access_token, aad);
          await fetch(`${providerConfig.revokeUrl}?token=${encodeURIComponent(decryptedToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }).catch(() => {});
        } catch {
          // Ignore revocation failure if token is already expired or invalid
        }
      }
    }

    // Delete or mark revoked in database
    let deleteQuery = adminSupabase
      .from('platform_oauth_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', platform);

    if (accountId) {
      deleteQuery = deleteQuery.eq('provider_account_id', accountId);
    }

    const { error: deleteErr } = await deleteQuery;
    if (deleteErr) {
      console.error('Failed to remove token record from vault:', deleteErr);
      return res.status(500).json({ error: 'Gagal memperbarui status vault: ' + deleteErr.message });
    }

    return res.status(200).json({
      success: true,
      platform,
      message: `Akun platform ${platform} berhasil diputuskan dan kredensial terenkripsi telah dihapus dari brankas.`,
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi') ? 401 : 500;
    return res.status(status).json({
      error: err.message || 'Gagal memutuskan sambungan platform.',
    });
  }
}
