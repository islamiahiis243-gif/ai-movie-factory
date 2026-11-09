# AI Movie Factory - Environment Variables & Vercel Production Guide

**Document Version:** 4.0  
**Timestamp:** `2026-11-09 21:31 +07:00`  
**Status:** Vercel Go-Live Ready (`v1.15.8`)  
**Live Production URL:** [https://ai-movie-factory.vercel.app/](https://ai-movie-factory.vercel.app/)  
**Reference:** SSOT Part 8 (Section 20), Part 11 (Sections 28–30), Part 15 (Section 45), Phase 14 & 15

---

## 1. Public Client-Side Variables (Vite Browser Bundle)

Client variables are prefixed with `VITE_` and baked into the static bundle during `npm run build`. All client requests using `VITE_SUPABASE_ANON_KEY` are protected by PostgreSQL Row Level Security (RLS) across all Supabase tables and Storage Buckets.

| Variable Name | Required | Example Value | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | `https://your-project-ref.supabase.co` | REST & Realtime API URL for your Supabase project. |
| `VITE_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Public anonymous JWT key from `Supabase -> Project Settings -> API`. |

---

## 2. Server-Only Variables (Vercel Serverless Functions)

Server variables **must never** be prefixed with `VITE_`. They are accessible exclusively within the 8 consolidated serverless endpoints (`api/*`) and backend modules (`server/*`).

### 2.1. Active Core Infrastructure (Currently Configured & Live)

| Variable Name | Required | Example Value | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes (Core AI) | `AIzaSy...` | Server-side execution proxy for Google Gemini 2.5 Flash orchestration. Isolated from browser bundles. |
| `SUPABASE_SECRET_KEY` | Yes (Admin / DB) | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Supabase `service_role` key used for atomic credit RPC, admin financial analytics, and webhook settlements. |
| `APP_URL` | Recommended | `https://ai-movie-factory.vercel.app` | Canonical production domain for OAuth redirect URIs and workspace invite links. |

### 2.2. Security & Background Scheduler Keys

| Variable Name | Required | Example Value | Purpose |
|---|---|---|---|
| `OAUTH_ENCRYPTION_KEY` | Yes (OAuth Vault) | `64-character-hex-string...` | 256-bit cryptographic key for AES-256-GCM encryption of creator OAuth tokens stored in `creator_social_connections`. |
| `CRON_SECRET` / `PUBLISHING_WORKER_SECRET` | Yes (Schedulers) | `random-32-char-secret...` | Bearer authorization secret used by Supabase `pg_cron` / `pg_net` to trigger `/api/publishing/worker` and `/api/analytics/sync-worker`. |

### 2.3. Third-Party Commercial Keys (Pending Owner Activation)

These keys are fully supported in backend code and adapters, but remain pending owner account registration:

| Variable Name | Category | Example Value | Status & Activation Instructions |
|---|---|---|---|
| `MIDTRANS_SERVER_KEY` | Automated Billing | `SB-Mid-server-...` | **Pending Owner:** Register merchant account at Midtrans.com, copy Production Server Key, and add to Vercel env. |
| `GOOGLE_CLIENT_ID` | YouTube Publishing | `...apps.googleusercontent.com` | **Pending Owner:** Register app at Google Cloud Console, enable YouTube Data API v3 & YouTube Analytics API. |
| `GOOGLE_CLIENT_SECRET` | YouTube Publishing | `GOCSPX-...` | **Pending Owner:** Google Cloud OAuth 2.0 Client Secret. |
| `META_APP_ID` | Instagram / Facebook | `123456789012345` | **Pending Owner:** Register app at Meta for Developers, enable Instagram Graph API v21.0 & Facebook Video. |
| `META_APP_SECRET` | Instagram / Facebook | `abcdef123456...` | **Pending Owner:** Meta App Secret. |
| `TIKTOK_CLIENT_KEY` | TikTok Publishing | `aw...` | **Pending Owner:** Register app at TikTok for Developers, enable Content Posting API. |
| `TIKTOK_CLIENT_SECRET` | TikTok Publishing | `...` | **Pending Owner:** TikTok App Client Secret. |
| `STRIPE_WEBHOOK_SECRET` | Global Billing | `whsec_...` | Optional: Webhook signing secret for international Stripe checkout events. |

---

## 3. Production Environment Verification

You can verify the configuration status of these variables at any time by requesting:
```bash
curl -s https://ai-movie-factory.vercel.app/api/health
```
The probe returns a JSON object indicating the configuration status of each subsystem without leaking actual secret values.
