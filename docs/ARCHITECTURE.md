# AI Movie Factory - Architecture Specification

Document Version: 3.0  
Status: Production Ready & Final Development Milestone (`v1.15.8`)  
Timestamp: `2026-11-09 21:31 +07:00`  
Live Production: [https://ai-movie-factory.vercel.app/](https://ai-movie-factory.vercel.app/) (Vercel Status: `READY`)  
Reference: SSOT Parts 1–17, Phase 14 & 15 Architecture

---

## 1. System Topology & Module Map

AI Movie Factory is structured into a modular, decoupled tier system spanning client experience, domain engines, AI provider adapters, orchestration pipelines, and PostgreSQL persistence with Row-Level Security:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT WORKSPACE LAYER                                  │
│   React 19 + TypeScript + Tailwind CSS v4 + Motion UI (Code-Split via Vite 8)          │
│                                                                                        │
│   [World Builder] ──► [Character Studio] ──► [Story & Script Editor] ──► [Storyboard]   │
│          │                    │                          │                      │      │
│          ▼                    ▼                          ▼                      ▼      │
│   [Agent Orchestrator] ──► [Media Studio] ──► [Production Pipeline & QC] ──► [Publish] │
│          │                    │                          │                      │      │
│   [Workspaces & RBAC] ──► [Template Marketplace] ──► [Commercial SaaS & Analytics]     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   VERCEL ZERO-COST SERVERLESS API LAYER (8 CONSOLIDATED ROUTERS)       │
│   • /api/health                          • /api/credits/[action]                       │
│   • /api/ai-generate (JWT Auth + 2PC)    • /api/oauth/[action] (AES-256-GCM Vault)     │
│   • /api/payment-webhook (SHA-512)       • /api/publishing/[action] (Lease Fencing)    │
│   • /api/admin/financial-analytics       • /api/analytics/[action] (Nullable Metrics)  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA & SECURITY LAYER (SUPABASE)                          │
│   • Supabase Auth (JWT tokens, Multi-Tenant Session Management)                        │
│   • PostgreSQL Database (28 Tables, Row-Level Security, GIN Indexes)                   │
│   • Two-Phase Atomic Credit Engine (reserve_credits, settle_credits, release_credits)  │
│   • Autonomous Cloud Cron Scheduler (pg_cron & pg_net background worker dispatch)      │
│   • Immutable Credit Ledger with Idempotency Key Validation & Overdraft Prevention     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Nine Production Modules (End-to-End Walkthrough)

1. **World Building (`world_builder`)**: Cosmic foundation, metaphysical cultivation hierarchies, sects/factions, interactive geography, and historical timelines.
2. **Character Studio (`character_studio`)**: Biometric dossiers, facial breakdowns, costume sets, voice profiles, visual consistency seed prompt generator, and relationship graph.
3. **Story & Script Engine (`story_script`)**: Multi-act narrative frameworks, 3-tier Season/Episode/Scene hierarchy, screenplay blocks, character tagging, and Multilingual Cultural Adaptation.
4. **Storyboard Studio (`storyboard`)**: Shot Composition Director (Wide, Medium, OTS, ECU, Dutch), camera motion rigs (Dolly, Pan, Tilt, Crane), lighting presets, and visual seed prompts.
5. **AI Agent Orchestrator (`agent_manager`)**: Registry of 14 Specialized AI Agents with Master Director coordination, multi-step execution plans, human approval gates, and execution logs.
6. **Media Studio (`media_studio`)**: Generative image synthesis (`gemini-3.1-flash-lite-image`), video generation with motion control (`gemini-omni-1.1-flash`), voice synthesis (`gemini-3.8-flash-tts`), and Central Asset Library.
7. **Production Pipeline (`production_pipeline`)**: Scene-level autonomous job queue, background progress telemetry, and 4-pillar automated Quality Control (Visual, Audio, Narrative, Technical).
8. **Master Package Export & Multi-Track NLE**: Multi-track timeline (V1, A1, A2, A3), LUT color grading presets, subtitle generation (SRT, VTT), and multi-aspect ratio conform (16:9, 9:16 Vertical, Cinemascope).
9. **Multi-Seat Workspaces & Marketplace (`workspaces`, `marketplace`)**: Studio collaboration containers, Role-Based Access Control (`Owner`, `Director`, `Writer`, `Reviewer`), and community template cloning.

---

## 3. Production Deployment & Security Guarantees

1. **Two-Phase Commit Atomic Credit Protocol**:
   - `reserve_credits`: Locks the profile row (`FOR UPDATE`), verifies sufficient balance, debits available balance, and records a pending hold in `public.credit_reservations`.
   - `settle_credits`: Finalizes the deduction with actual token telemetry once the AI provider completes successfully.
   - `release_credits`: Restores the reserved hold back to the user's available balance if the provider fails or times out.
   - Idempotency and row-level locks prevent concurrent double-spending or negative overdrafts.
2. **Usage Metering Telemetry & Provider Cost Engine**:
   - Google Gemini 2.5 Flash token counts (`promptTokenCount`, `candidatesTokenCount`, `cachedContentTokenCount`) are extracted directly from SDK response metadata and persisted to `public.ai_usage_records`.
   - Disaggregates Billed Actual Cost (\$0.00 on Free Tier), Paid-Equivalent Cost (subsidy), and Customer Charges.
3. **OAuth 2.0 Security Vault (AES-256-GCM)**:
   - Social media platform tokens (YouTube, TikTok, Meta Instagram Reels, Facebook) are encrypted with AES-256-GCM and stored in `public.creator_social_connections`.
   - Single-use state tokens with 5-minute TTL stored in `public.oauth_state_transactions` prevent CSRF and replay attacks.
4. **Publishing Worker Lease Fencing**:
   - Worker claims are acquired atomically using conditional PostgreSQL queries (`WHERE status = 'queued'`).
   - Incremental fencing tokens guard against stale worker updates when execution leases expire.
   - Safe transitions to `requires_user_action` upon ambiguous network timeouts to prevent duplicate video uploads.
5. **Vercel Hobby Zero-Cost Compliance**:
   - Serverless functions consolidated into 8 routers (below the 12-function Hobby limit).
   - Sub-daily crons removed from `vercel.json` (preventing error `3Fpeeb1`); worker scheduling handled autonomously via Supabase `pg_cron` & `pg_net`.
6. **Row-Level Security (RLS)**:
   - Enforced across all 28 database tables. Creators and workspace members can only access entities permitted by their verified authentication UID and role tier.
