/**
 * Vercel Serverless Function: /api/health
 * Production Readiness & Environment Diagnostics Probe (SSOT Part 7 Sec 17 & Part 11 Sec 30)
 * Never exposes secret values — only reports boolean availability of required infrastructure keys.
 */

export default function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';
  const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || '';
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const cronSecret = process.env.CRON_SECRET || '';
  const oauthEncryptionKey = process.env.OAUTH_ENCRYPTION_KEY || process.env.OAUTH_TOKEN_ENCRYPTION_KEY || '';

  const isSupabasePublicConfigured = Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('your-project') &&
      supabaseUrl.startsWith('https://')
  );

  const payload = {
    status: 'ok',
    service: 'ai-movie-factory',
    version: '1.15.10',
    runtime: 'vercel-serverless-node',
    timestamp: new Date().toISOString(),
    ssotCompliance: {
      schemaVersion: 'V3.15 Financial Accuracy & DJP Tax Logic Hardening',
      protectedTablesCount: 24,
      storageBuckets: ['character-avatars', 'project-assets'],
      serverSideSecretsProtected: true,
    },
    configuredServices: {
      supabasePublicClient: isSupabasePublicConfigured,
      supabaseServiceRoleServerOnly: Boolean(
        supabaseSecretKey && !supabaseSecretKey.includes('your-supabase')
      ),
      geminiServerProxy: Boolean(geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY'),
      midtransWebhookVerifier: Boolean(midtransServerKey),
      stripeWebhookVerifier: Boolean(stripeWebhookSecret),
      cronWorkerConfigured: Boolean(cronSecret),
      oauthVaultConfigured: Boolean(oauthEncryptionKey),
      googleOAuthConfigured: Boolean(
        (process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) &&
        (process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)
      ),
      tikTokOAuthConfigured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
      metaOAuthConfigured: Boolean(
        (process.env.META_APP_ID || process.env.INSTAGRAM_CLIENT_ID) &&
        (process.env.META_APP_SECRET || process.env.INSTAGRAM_CLIENT_SECRET)
      ),
    },
  };

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json(payload);
}
