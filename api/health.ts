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

  const isSupabasePublicConfigured = Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes('your-project') &&
      supabaseUrl.startsWith('https://')
  );

  const payload = {
    status: 'ok',
    service: 'ai-movie-factory',
    version: '1.13.0',
    runtime: 'vercel-serverless-node',
    timestamp: new Date().toISOString(),
    ssotCompliance: {
      schemaVersion: 'V3.2 Enterprise Master',
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
    },
  };

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).json(payload);
}
