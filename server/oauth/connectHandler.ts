/**
 * Vercel Serverless Function: POST /api/oauth/connect
 * AI Movie Factory — Serverless OAuth Broker (T9.3.1 Security Hardened)
 * Authenticates creator, validates provider credentials, registers one-time atomic state transaction,
 * and issues CSRF-protected redirect URL.
 */

import { authenticateServerlessRequest } from '../supabaseAdmin';
import { getProviderConfig, buildAuthorizationUrl } from '../oauthProviders';
import { createOAuthTransaction } from '../oauthTransactionStore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { user } = await authenticateServerlessRequest(req);
    const { platform, returnUrl } = req.body || {};

    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({ error: 'Parameter "platform" diperlukan.' });
    }

    const providerConfig = getProviderConfig(platform);

    if (!providerConfig.isConfigured) {
      return res.status(503).json({
        error: `Kredensial OAuth Developer untuk platform "${providerConfig.name}" belum dikonfigurasi di server environment Vercel.`,
        platform,
        isConfigured: false,
        requiredEnvVars: providerConfig.requiredEnvVars,
        setupGuideUrl: 'https://github.com/islamiahiis243-gif/ai-movie-factory/blob/main/docs/publishing_monetization_growth_plan.md',
      });
    }

    // Register atomic one-time OAuth state transaction
    const { state } = await createOAuthTransaction({
      userId: user.id,
      platform,
      redirectUri: providerConfig.redirectUriPath,
      returnUrl,
      ttlMs: 5 * 60 * 1000, // 5 minutes strict TTL
    });

    const redirectUrl = buildAuthorizationUrl(platform, state);

    return res.status(200).json({
      success: true,
      platform,
      state,
      redirectUrl,
    });
  } catch (err: any) {
    const status = err.message?.includes('autentikasi') ? 401 : 500;
    return res.status(status).json({
      error: err.message || 'Gagal memulai koneksi OAuth platform.',
    });
  }
}
