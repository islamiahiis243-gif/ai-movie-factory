# AI Movie Factory - Architecture Specification

Document Version: 2.0  
Status: Production Ready (Phases 1–8 Completed)  
Reference: SSOT Parts 1–17

---

## 1. System Topology & Module Map

AI Movie Factory is structured into a modular, decoupled tier system spanning client experience, domain engines, AI provider adapters, orchestration pipelines, and PostgreSQL persistence with Row-Level Security:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT WORKSPACE LAYER                                  │
│   React 19 + TypeScript + Tailwind CSS v4 + Motion UI                                  │
│                                                                                        │
│   [World Builder] ──► [Character Studio] ──► [Story & Script Editor] ──► [Storyboard]   │
│          │                    │                          │                      │      │
│          ▼                    ▼                          ▼                      ▼      │
│   [Agent Orchestrator] ──► [Media Studio] ──► [Production Pipeline & QC] ──► [Export] │
│          │                    │                          │                      │      │
│   [Workspaces & RBAC] ──► [Template Marketplace] ──► [Commercial SaaS & Billing]       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE ADAPTER LAYER                                     │
│   • Multilingual Adaptation Engine (id, en, zh, ja, es + 8 cultural registers)         │
│   • Multi-Provider AI Adapter (Gemini Image/Video/TTS, Runway Gen-3, ElevenLabs, Lyria)│
│   • Autonomous Scene Execution Queue & 4-Pillar Automated QC Validator                 │
│   • Payment Gateway Adapters (Midtrans QRIS/VA + Stripe Elements)                      │
│   • Supabase Client & Resilient Local Sandbox Fallback Engine                          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA & SECURITY LAYER                                     │
│   • Supabase Auth (JWT tokens, Multi-Tenant Session Management)                        │
│   • PostgreSQL Database (24 Relational Tables, GIN indexes, Foreign Key Cascades)      │
│   • Row Level Security (RLS) Policies on 100% of tables (Owner, Member & Role checks)  │
│   • Immutable Credit Ledger with Idempotency Key Validation                            │
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
8. **Master Package Export**: Subtitle generation (SRT, VTT), export packaging presets (MP4 1080p, ProRes 422 4K, WebM), and archive manifests.
9. **Multi-Seat Workspaces & Marketplace (`workspaces`, `marketplace`)**: Studio collaboration containers, Role-Based Access Control (`Owner`, `Director`, `Writer`, `Reviewer`), and community template cloning.

---

## 3. Production Deployment & Security Guarantees

1. **Immutable Credit Ledger**: Every credit debit/credit operation is recorded in `public.credit_transactions` with provider metrics, model identifiers, and idempotency keys to prevent double charging.
2. **Row-Level Security (RLS)**: Enforced across all 24 database tables. Creators and workspace members can only access entities permitted by their verified authentication UID and role tier.
3. **Resilient Local Sandbox**: If Supabase cloud credentials are not supplied, the application automatically mounts an in-memory browser persistence engine with zero fatal errors or crashes.
4. **Consolidated Migration**: Database provisioning is executed via `supabase/deploy_all_migrations.sql` ensuring immediate production parity.
