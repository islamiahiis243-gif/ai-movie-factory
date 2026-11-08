# AI Movie Factory - Environment Variables & Vercel Go-Live Guide

Document Version: 3.0  
Status: Vercel Go-Live Ready (`v1.13.0`)  
Reference: SSOT Part 8 (Section 20), Part 11 (Sections 28–30) & Part 15 (Section 45)

---

## 1. Public Client-Side Variables (Vite Browser Bundle)

Client variables are prefixed with `VITE_` and embedded at build time. All data access using `VITE_SUPABASE_ANON_KEY` is strictly governed by PostgreSQL Row Level Security (RLS) across all 24 tables and 2 Storage Buckets.

| Variable Name | Required | Example Value | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | `https://your-project-ref.supabase.co` | REST & Realtime API URL for your Supabase project. |
| `VITE_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Public anonymous JWT key from `Supabase -> Project Settings -> API`. |

---

## 2. Server-Only Variables (Vercel Serverless Functions)

Server variables **must never** be prefixed with `VITE_`. They are read exclusively by the Vercel Serverless API endpoints (`api/health.ts`, `api/ai-generate.ts`, `api/payment-webhook.ts`).

| Variable Name | Required | Example Value | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes (AI Proxy) | `AIzaSy...` | Used exclusively by `POST /api/ai-generate` to execute Gemini models server-side without exposing credentials to the client. |
| `SUPABASE_SECRET_KEY` | Yes (Webhooks) | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Supabase `service_role` secret key used exclusively by `POST /api/payment-webhook` to settle verified payment orders and credit `public.credit_transactions`. |
| `MIDTRANS_SERVER_KEY` | Production Billing | `SB-Mid-server-...` | Used by `POST /api/payment-webhook` to verify SHA-512 cryptographic signatures on incoming Midtrans payment notifications. |
| `STRIPE_WEBHOOK_SECRET` | Optional Billing | `whsec_...` | Webhook signing secret for international Stripe checkout events. |
| `APP_URL` | Recommended | `https://ai-movie-factory.vercel.app` | Canonical public URL for callbacks and workspace invitations. |
