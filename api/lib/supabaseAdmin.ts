/**
 * AI MOVIE FACTORY — SERVERLESS SUPABASE ADMIN HELPER
 * Authenticates user bearer tokens and provides service_role database client.
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Konfigurasi server Supabase (SUPABASE_SECRET_KEY) belum tersedia.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticateServerlessRequest(req: any): Promise<{
  adminSupabase: SupabaseClient;
  user: User;
}> {
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || '');
  let accessToken = '';

  if (authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.slice(7).trim();
  } else if (req.body?.accessToken) {
    accessToken = String(req.body.accessToken);
  } else if (req.query?.accessToken) {
    accessToken = String(req.query.accessToken);
  }

  if (!accessToken) {
    throw new Error('Sesi autentikasi diperlukan (Authorization Bearer token tidak ditemukan).');
  }

  const adminSupabase = getSupabaseAdmin();
  const { data, error } = await adminSupabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    throw new Error('Token sesi tidak valid atau telah kedaluwarsa.');
  }

  return { adminSupabase, user: data.user };
}


// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
