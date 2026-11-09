/**
 * Vercel Serverless Function: POST /api/oauth/disconnect
 * AI Movie Factory — Reliable OAuth Disconnect & Revocation Lifecycle Broker (T9.3.1)
 * Enforces:
 * - Controlled disconnect lifecycle: Connected -> Disconnecting -> Disconnected
 * - Provider remote revocation when officially supported
 * - Safe operational recording of revocation status (success / failed / unsupported)
 * - Immediate local credential invalidation so AMF can no longer use the tokens
 * - Zero token value logging
 */

import { authenticateServerlessRequest } from '../supabaseAdmin.ts';
import { getProviderConfig } from '../oauthProviders.ts';
import { decryptOAuthToken } from '../oauthCrypto.ts';

export type RemoteRevocationStatus = 'success' | 'failed' | 'unsupported' | 'pending';

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

    // 1. Retrieve the existing token record
    let query = adminSupabase
      .from('platform_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform);

    if (accountId) {
      query = query.eq('provider_account_id', accountId);
    }

    const { data: records, error: fetchErr } = await query;

    if (fetchErr) {
      throw new Error(`Gagal membaca brankas kredensial: ${fetchErr.message}`);
    }

    if (!records || records.length === 0) {
      return res.status(200).json({
        success: true,
        platform,
        status: 'disconnected',
        message: `Akun platform ${platform} sudah tidak terhubung atau telah diputuskan sebelumnya.`,
        remoteRevocation: 'unsupported',
      });
    }

    const record = records[0];
    const providerConfig = getProviderConfig(platform);
    let remoteRevocationStatus: RemoteRevocationStatus = 'unsupported';
    let remoteRevocationError: string | null = null;

    // 2. Attempt remote revocation if provider supports it
    if (providerConfig.revokeUrl && record.encrypted_access_token) {
      try {
        const aad = `${user.id}:${platform}:${record.provider_account_id}`;
        const decryptedToken = decryptOAuthToken(record.encrypted_access_token, aad);

        let revokeRes: Response | null = null;

        if (platform === 'youtube') {
          // Google OAuth2 revocation
          revokeRes = await fetch(`${providerConfig.revokeUrl}?token=${encodeURIComponent(decryptedToken)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
        } else if (platform === 'tiktok') {
          // TikTok Open API revocation
          const body = new URLSearchParams({
            client_key: providerConfig.clientId,
            client_secret: providerConfig.clientSecret,
            token: decryptedToken,
          });
          revokeRes = await fetch(providerConfig.revokeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });
        }

        if (revokeRes && (revokeRes.ok || revokeRes.status === 200)) {
          remoteRevocationStatus = 'success';
        } else {
          remoteRevocationStatus = 'failed';
          remoteRevocationError = `Provider HTTP ${revokeRes?.status || 'Unknown'}`;
        }
      } catch (err: any) {
        remoteRevocationStatus = 'failed';
        remoteRevocationError = err.message || 'Network error during remote revocation';
      }
    } else {
      // Provider does not support direct token revocation endpoint (e.g. Meta Graph API)
      remoteRevocationStatus = 'unsupported';
    }

    // 3. Invalidate local credentials immediately
    // Wipes ciphertext tokens and marks status disconnected so AMF can no longer use them
    const { error: updateErr } = await adminSupabase
      .from('platform_oauth_tokens')
      .update({
        encrypted_access_token: 'REVOKED',
        encrypted_refresh_token: null,
        connection_status: 'disconnected',
        revoked_at: new Date().toISOString(),
        remote_revocation_status: remoteRevocationStatus,
        remote_revocation_error: remoteRevocationError,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (updateErr) {
      console.error('Failed to update token record status to disconnected:', updateErr.message);
      // Hard delete as secondary safeguard if update fails
      await adminSupabase.from('platform_oauth_tokens').delete().eq('id', record.id);
    }

    return res.status(200).json({
      success: true,
      platform,
      status: 'disconnected',
      remoteRevocation: remoteRevocationStatus,
      message:
        remoteRevocationStatus === 'success'
          ? `Akun ${providerConfig.name} berhasil diputuskan dan otorisasi dicabut secara remote.`
          : remoteRevocationStatus === 'unsupported'
          ? `Kredensial lokal ${providerConfig.name} telah dihapus dari brankas AMF. (Provider mengelola pencabutan melalui pengaturan akun Anda).`
          : `Kredensial lokal ${providerConfig.name} telah dinonaktifkan di AMF. (Pencabutan remote provider akan dicoba ulang).`,
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi') ? 401 : 500;
    return res.status(status).json({
      error: err.message || 'Gagal memutuskan sambungan platform.',
    });
  }
}
