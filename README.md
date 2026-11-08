# AI Movie Factory 🎬

> **AI-Powered Film & Drama Production Studio SaaS (`v1.14.0` — Production Live & Flagship Branding Ready)**  
> Integrated production management and orchestration platform for filmmakers, animators, YouTubers, and creative studios.

---

## 🌟 Overview

AI Movie Factory connects the complete audiovisual creative lifecycle:
> **Ideas → World Building → Characters → Story → Script → Storyboard → Image → Video → Voice → Editing & Post-Production → Quality Control → Final Master Export**

- **Initial Market:** Indonesia (Default UI: Bahasa Indonesia 🇮🇩)
- **Global Markets:** 5 UI Languages (`id`, `en`, `zh`, `ja`, `es`) & 8 Multilingual Cultural Script/Voice Adapters
- **Single Source of Truth:** Refer to [`docs/ai_movie_factory_SSOT.md`](docs/ai_movie_factory_SSOT.md) for master architecture and specifications.

---

## 🚀 Tech Stack & Production Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Code-Split via `React.lazy` & Vite 8 `manualChunks`
- **Backend / Serverless API (`api/`):** Vercel Serverless Functions (`/api/health`, `/api/ai-generate`, `/api/payment-webhook`)
- **Database & Auth:** Supabase PostgreSQL (24 tables hardened with V3.2 Enterprise RLS) & Supabase Auth
- **Cloud Storage:** Supabase Storage Buckets (`character-avatars` & `project-assets`) with dual-layer local cache persistence
- **AI Orchestration:** 14 Specialized AI Agents & Multi-provider adapter architecture (Google Gemini, Runway Gen-3, Kling AI, ElevenLabs, Suno)

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
1. `supabase/deploy_all_migrations.sql` (provisions all 24 RLS-hardened tables + `character-avatars` and `project-assets` storage buckets)
2. `supabase/verify_deployment.sql` (verifies 100% schema and RLS readiness)

### 4. Run Development Server & Verification
```bash
npm run dev
npm run typecheck
npm run verify:golive
npm run build
```

---

## ☁️ Deploying to Vercel (Production Go-Live)

1. Push this repository to your private GitHub repository (`ai-movie-factory`).
2. Import the project in the [Vercel Dashboard](https://vercel.com/new) (Framework Preset: **Vite**, automatically configured via [`vercel.json`](vercel.json)).
3. Add the following **Environment Variables** in **Vercel → Project Settings → Environment Variables**:
   - `VITE_SUPABASE_URL` *(Client/Server)*
   - `VITE_SUPABASE_ANON_KEY` *(Client/Server)*
   - `SUPABASE_SECRET_KEY` *(Server-Only — for verified payment webhook settlement)*
   - `GEMINI_API_KEY` *(Server-Only — for `/api/ai-generate` orchestration proxy)*
   - `MIDTRANS_SERVER_KEY` *(Server-Only — for `/api/payment-webhook` SHA-512 verification)*
   - `STRIPE_WEBHOOK_SECRET` *(Server-Only — optional Stripe webhook verification)*
   - `APP_URL` *(Canonical production domain, e.g., `https://ai-movie-factory.vercel.app`)*
4. Click **Deploy**. After deployment completes, verify `https://<your-domain>/api/health`.

---

## 🗺️ Roadmap Status (Phases 1 – 13 Completed)

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
