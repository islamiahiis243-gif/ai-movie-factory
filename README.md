# AI Movie Factory 🎬

> **AI-Powered Film & Drama Production Studio SaaS (`v1.15.8` — Production Live & Final Development Milestone)**  
> **Timestamp:** `2026-11-09 21:31 +07:00`  
> **Live Production URL:** [https://ai-movie-factory.vercel.app/](https://ai-movie-factory.vercel.app/)  
> **Production Status:** Vercel `READY` (`dpl_Ak8T46SGhwjXE2qUbT1zMjHVQCZZ`) | Supabase Cloud Active (`jixfakvbhugpypjtyshq`)  
> Integrated production management and orchestration platform for filmmakers, animators, YouTubers, and creative studios.

---

## 🌟 Overview

AI Movie Factory connects the complete audiovisual creative lifecycle:
> **Ideas → World Building → Characters → Story → Script → Storyboard → Image → Video → Voice → Editing & Post-Production → Quality Control → Publishing & Live Analytics**

- **Initial Market:** Indonesia (Default UI: Bahasa Indonesia 🇮🇩)
- **Global Markets:** 5 UI Languages (`id`, `en`, `zh`, `ja`, `es`) & 8 Multilingual Cultural Script/Voice Adapters
- **Single Source of Truth:** Refer to [`docs/ai_movie_factory_SSOT.md`](docs/ai_movie_factory_SSOT.md) for master architecture and specifications.

---

## 🚀 Tech Stack & Production Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Code-Split via `React.lazy` & Vite 8 `manualChunks` (Production build in ~2.8s)
- **Backend / Serverless API (`api/`):** 8 Consolidated Routers under Vercel Hobby 12-function limit with decoupled server logic (`server/`):
  - `GET /api/health`: Production probe & environment configuration audit.
  - `POST /api/ai-generate`: Authenticated AI orchestration proxy (Supabase JWT auth, 2-phase commit atomic credit reservations, usage metering telemetry).
  - `GET,POST /api/credits/[action]`: Atomic credit balance query & ledger transaction dispatcher (`balance`, `transaction`).
  - `GET,POST /api/oauth/[action]`: Social OAuth dispatcher (`url`, `callback`, `connections`, `disconnect`) with AES-256-GCM token encryption & atomic state store.
  - `GET,POST /api/publishing/[action]`: Multi-platform publisher (`job`, `cancel`, `worker`) with lease fencing and double-upload prevention.
  - `GET,POST /api/analytics/[action]`: Social analytics engine (`sync`, `history`, `sync-worker`) with nullable metrics and snapshot retention.
  - `GET,POST /api/admin/financial-analytics`: Admin financial console with stored procedure `get_financial_summary_metrics()`.
  - `POST /api/payment-webhook`: Midtrans SHA-512 signature verified webhook receiver with idempotency, refund protection, and zero-overdraft guarantees.
- **Autonomous Cloud Scheduler:** Supabase `pg_cron` & `pg_net` running worker routines directly in the database without consuming Vercel Hobby cron quotas.
- **Database & Auth:** Supabase PostgreSQL with Row Level Security (RLS) across all tables and atomic RPC functions (`reserve_credits`, `settle_credits`, `release_credits`, `get_user_credit_balance`).
- **Cloud Storage:** Supabase Storage Buckets (`character-avatars` & `project-assets`) with dual-layer local cache persistence.
- **AI Orchestration:** 14 Specialized AI Agents powered by Google Gemini 2.5 Flash.

---

## 📊 Ekosistem 360 Derajat: Status Kesiapan Produksi

| Kategori | Status | Keterangan & Ruang Lingkup |
| :--- | :---: | :--- |
| **Kategori 1: 100% Selesai & Berfungsi Penuh Sekarang** | **100% LIVE** | Autentikasi (Supabase Auth), Sistem Kredit 2-Phase Atomic Commit, Modul 1-4 & 6 (World Builder, Character Studio, Story & Script, Storyboard, QC), 14 AI Agents via Gemini 2.5 Flash, Dashboard Keuangan Admin, Workspace Kolaborasi Tim, 5 Bahasa UI, Publishing Engine (YouTube, TikTok, Meta Instagram Reels, Facebook) & OAuth Security Vault. |
| **Kategori 2: 100% Selesai Kodenya (Mode Simulasi / Kuota Hemat)** | **BY DESIGN** | Video AI Generator & Voiceover Audio Media Studio berjalan dalam mode mock/simulasi untuk menjaga biaya tetap Rp0. Gemini berjalan pada Free Tier (\$0.00 billed cost, rate limit ~15 RPM). Pembayaran manual via Bank Mandiri / E-Wallet terverifikasi ID Billing Coretax. |
| **Kategori 3: Menunggu Tindakan Pemilik (Action Items Pemilik)** | **PENDING OWNER** | Pendaftaran Kredensial Developer App (Google Cloud Console, Meta for Developers, TikTok for Developers), OAuth App Verification publik, Kunci Server Midtrans Production (`MIDTRANS_SERVER_KEY`), dan Domain Kustom Pribadi. |

---

## 🛠️ Local Development Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
- `VITE_SUPABASE_URL`: Your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key (JWT)

*(If no credentials are provided, the studio automatically runs in a resilient local sandbox mode with dual-layer persistence).*

### 3. Deploy Database Schema & Storage Buckets
Open **Supabase Dashboard → SQL Editor** and execute:
1. `supabase/deploy_all_migrations.sql` (provisions all RLS-hardened tables + storage buckets)
2. `supabase/upgrade_v3_10_supabase_cron_scheduler.sql` (cloud cron automation)
3. `supabase/upgrade_v3_11_financial_hardening.sql` (atomic 2-phase credit RPC)
4. `supabase/upgrade_v3_12_financial_analytics.sql` (usage metering & financial analytics metrics)

### 4. Run Development Server & Verification
```bash
npm run dev
npm run typecheck
npx tsx scripts/test_vercel_golive_readiness.ts
npx tsx scripts/test_financial_hardening.ts
npm run build
```

---

## ☁️ Environment Variables Configuration (Vercel)

Add the following variables in **Vercel → Project Settings → Environment Variables**:
- `VITE_SUPABASE_URL` *(Client/Server)*
- `VITE_SUPABASE_ANON_KEY` *(Client/Server)*
- `SUPABASE_SECRET_KEY` *(Server-Only — service_role key for admin APIs and settlement)*
- `GEMINI_API_KEY` *(Server-Only — for `/api/ai-generate` AI orchestration proxy)*
- `OAUTH_ENCRYPTION_KEY` *(Server-Only — 64-char hex key for AES-256-GCM token encryption)*
- `MIDTRANS_SERVER_KEY` *(Server-Only — for Midtrans payment webhook verification)*
- `PUBLISHING_WORKER_SECRET` / `CRON_SECRET` *(Server-Only — cron scheduler authentication)*
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` *(Server-Only — YouTube publishing)*
- `META_APP_ID` & `META_APP_SECRET` *(Server-Only — Instagram Reels & Facebook Video)*
- `TIKTOK_CLIENT_KEY` & `TIKTOK_CLIENT_SECRET` *(Server-Only — TikTok Content Posting)*

---

## 🗺️ Roadmap Status (Phases 1 – 15 Completed)

- [x] **Phase 1: SaaS Foundation** (Completed)
- [x] **Phase 2: Creative Development** (World Builder, Character Studio, Story & Script)
- [x] **Phase 3: AI Agent System** (14 Specialized Agents & Master Director Orchestrator)
- [x] **Phase 4: Media Generation** (Image, Video, Voice, Audio & Central Asset Library)
- [x] **Phase 5: Production Pipeline** (Scene Queue, Telemetry & Master Export Packaging)
- [x] **Phase 6: Commercial SaaS** (Immutable Credit Ledger, Subscriptions, Midtrans/Stripe & Admin Console)
- [x] **Phase 7: Global Expansion** (5 UI Languages, 8 Cultural Script Adapters, Team Workspaces & Marketplace)
- [x] **Phase 8: Storyboard Studio & Consolidated V3.2 Master SQL Deployment** (Completed)
- [x] **Phase 9: Multi-Track NLE Timeline Editing, LUT Color Grading & 9:16 / 16:9 Publishing** (Completed)
- [x] **Phase 10: 12-Pillar Quality Control Engine & Director Approval Gatekeeper** (Completed)
- [x] **Phase 11: Bi-Directional Community Asset & Character Marketplace** (Completed)
- [x] **Phase 12: Dynamic Code-Splitting & Supabase Storage Bucket Media Persistence** (Completed)
- [x] **Phase 13: Vercel Production Go-Live Readiness & Serverless API Layer** (Completed)
- [x] **Phase 14: Commercial Financial Infrastructure, Credit Hardening & SaaS Economics (Phases 2–7)** (Completed)
- [x] **Phase 15: OAuth Security Vault, Multi-Platform Publishing & Live Analytics Sync (T9.3–T9.5)** (Completed)
