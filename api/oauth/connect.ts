/**
 * Vercel Serverless Function: POST /api/oauth/connect
 * AI Movie Factory — Serverless OAuth Broker (T9.3)
 * Authenticates creator, validates provider credentials, and issues CSRF-protected redirect URL.
 */

import { authenticateServerlessRequest } from '../lib/supabaseAdmin';
import { generateOAuthState } from '../lib/oauthCrypto';
import { getProviderConfig, buildAuthorizationUrl } from '../lib/oauthProviders';

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

    // Generate CSRF state
    const state = generateOAuthState({
      userId: user.id,
      platform,
      returnUrl,
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
