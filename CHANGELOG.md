# Changelog - AI Movie Factory

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.14.0] - Phase 14: Hybrid RBAC+ABAC Security, Coretax Automated Billing & Master Flagship Landing Page - 2026-11-08

### Added
- **Hybrid RBAC + ABAC Access Control Architecture (`src/lib/accessControl.ts` & `supabase/upgrade_v3_3_hybrid_rbac_abac.sql`):**
  - Implemented 3-tier hybrid authorization model ensuring strict separation of concerns across platform, team, and resource levels:
    1. **Level 1 (Platform RBAC):** `role = 'admin'` (Super Admin / Owner Console, global financial audit, immutable credit ledger oversight, emergency order rollback) vs `role = 'creator'` (standard production studio access).
    2. **Level 2 (Workspace RBAC):** Granular studio team roles (`owner`, `director`, `writer`, `reviewer`) with specialized permission matrix.
    3. **Level 3 (Contextual ABAC):** Attribute-based dynamic evaluation for 4K/ProRes export (`subscription.tier IN ('pro_studio', 'production_house')` or `role = 'admin'`), AI model execution rights (`credit_balance >= job.cost`), project resource ownership (`project.user_id = uid OR is_member(project.workspace_id)`), and team invitation limits (`active_seats < seat_limit`).
  - Added PostgreSQL Security Definer helper functions: `public.is_platform_admin(p_user_id UUID)` and `public.get_workspace_user_role(p_workspace_id UUID, p_user_id UUID)`.
  - Updated PostgreSQL trigger `validate_payment_order_catalog()` allowing service-role order rollbacks (`cancelled`, `refunded`) while strictly prohibiting manual downgrade of settled orders to draft/pending.

- **Flagship Cinematic Public Landing Page (`src/components/landing/LandingPageView.tsx`):**
  - Created full-width, high-converting Hollywood cyberpunk marketing landing page:
    - **Hero Stage:** Showcase card for official AMF master logo with radial neon cyan/purple/amber ambient glow, high-impact headline, live trust metrics, and dual CTAs (*Mulai Produksi Sekarang* & *Jelajahi Demo*).
    - **Interactive Studio Director Simulator:** 4-genre live pipeline switcher (*Sci-Fi Cyberpunk*, *Historical Epic Nusantara*, *Anime Fantasi*, *Psychological Horror*) showcasing camera framing, focal length, spatial foley soundscapes, and active 14-agent orchestration.
    - **10-Module Hollywood Ecosystem Showcase:** Story & Script, World Builder 3D, Character Studio (Face-Lock), Storyboard Pro, 14 AI Agent Manager, Multi-Modal Media Studio, Parallel Pipeline, QC Continuity Supervisor, Multitrack Editing Post-Pro, and Marketplace Template Blueprints.
    - **Traditional vs AMF Value Comparison:** Side-by-side analysis illustrating 95% budget reduction and instant turnaround time.
    - **Transparent Pricing & Indonesian Payment Showcase:** Real-time multi-currency support (IDR, USD, EUR, CNY, JPY) with official Indonesian payment badges (Bank Mandiri, BCA Virtual Account, GoPay, OVO, DANA, QRIS).
    - **Commercial Rights FAQ & Grand Bottom CTA:** Transparent FAQ on 100% commercial ownership, deep face consistency, and instant starter credits.

- **Dual-Mode Dynamic Topbar Navigation (`src/components/layout/Navbar.tsx`):**
  - **Public Landing Topbar:** Renders marketing-first navigation links (*Fitur Studio*, *14 Agen AI*, *Alur Kerja*, *Harga & Paket*, *FAQ*), regional currency/language switchers, and high-visibility *"Masuk"* & *"Coba Gratis (150 Kredit) 🚀"* CTA buttons. Hides internal studio modules to prevent cognitive overload for public visitors.
  - **Studio Cockpit Topbar:** Automatically activates upon login or studio navigation, rendering workspace tools (*Dashboard*, *Proyek Saya*, *Ruang Kerja Tim*, *Pasar Template*, *Pengaturan*, *Supabase OK*, *+ Proyek Baru*, and *Admin Konsol*).
  - Integrated user-refined official AMF camera emblem (`amf-emblem.png`) with luminous neon styling.

- **Official Master AMF Branding Suite (`public/assets/branding/` & `public/favicon.ico`):**
  - Installed high-resolution master branding files: `amf-logo-master.png` (2752×1536), user-refined cropped `amf-emblem.png` (321×275), `amf-wordmark.png` (395×222), `favicon-128.png`, and browser `favicon.ico`.
  - Updated `index.html` OpenGraph / Twitter Cards meta tags and browser favicon pointers.

### Changed
- **Zero-Duplicate Checkout Modal (`src/components/billing/PaymentModal.tsx` & `src/lib/supabase.ts`):**
  - Replaced repetitive `useEffect` database order insertion with an in-memory draft pattern (`orderDraft`). Switching between payment tabs (Mandiri, BCA, GoPay, OVO, QRIS) now only swaps UI transfer instructions without persisting draft rows in Supabase.
  - Database row creation and settlement are combined atomically upon official user confirmation via serverless webhook.
- **Coretax-Style Automated Admin Settlement (`src/components/admin/AdminDashboardView.tsx`):**
  - Eliminated manual "Klik Setujui" verification queue. Admin dashboard now displays settled transactions with `LUNAS / AKTIF (OTOMATIS)` badge.
  - Added emergency intervention capability: **"Batalkan & Tarik Kredit"** button invoking `admin_rollback_order` via `/api/payment-webhook` (marks order cancelled, logs negative credit deduction in immutable ledger, and reverts subscription tier).
- **Brand Hygiene & Privacy Protection:**
  - Removed all personal name references from public landing page footer, FAQ, and payment badges. Footer standardized to corporate format: `© 2026 AI Movie Factory. Seluruh Hak Cipta Dilindungi Undang-Undang. All Rights Reserved.`
  - Removed technical software version badges from public announcement banner, relocating the build identifier subtly to `Sidebar.tsx` footer (`AMF Engine • v3.3.0 (Production)`).
- **Settings Page UX Cleanup & Developer Diagnostics Protection (`src/components/settings/SettingsView.tsx`):**
  - Streamlined studio settings for ordinary creators into 3 intuitive cards: **Profil Kreator Studio**, **Bahasa & Mata Uang**, and **Keamanan Akun & Kata Sandi** (integrated with `supabase.auth.updateUser`).
  - Restricted technical developer panels (Supabase connection parameters, secret environment variables audit, PostgreSQL migration scripts, and the End-to-End Walkthrough Simulator) strictly to Super Admins (`isPlatformAdmin` / `islamiahiis243@gmail.com`) inside a collapsible diagnostic console.

### Fixed
- **Purged Ghost/Orphan Draft Orders in PostgreSQL:**
  - Purged 15 orphaned draft orders previously generated during payment method previewing, restoring the database `public.payment_orders` to a completely clean state.

## [1.13.0] - Phase 13: Vercel Production Go-Live Readiness & Serverless API Layer - 2026-11-08

### Added
- **Vercel Production Configuration (`vercel.json` & `.npmrc`):**
  - Added canonical `vercel.json` defining Vite build pipeline, SPA deep-link rewrites (`/((?!api/|assets/|.*\\..*).* )` -> `/index.html`), Serverless API routing (`/api/(.*)`), immutable caching headers (`max-age=31536000, immutable`) on `/assets/(.*)`, and strict HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`).
  - Upgraded `esbuild` in `package.json` to `^0.28.0` (matching `vite@^8.3.0` peer requirements) and added `.npmrc` so standard `npm install` on Vercel Linux build containers completes with zero `ERESOLVE` errors.
- **Server-Side Vercel Serverless API Layer (`api/`):**
  - `GET /api/health` (`api/health.ts`): Production readiness probe reporting schema compliance (`V3.2 Enterprise Master`, 24 tables, 2 storage buckets) and boolean service configuration flags without exposing secret values.
  - `POST /api/ai-generate` (`api/ai-generate.ts`): Server-side Gemini AI orchestration proxy keeping `GEMINI_API_KEY` isolated on the server.
  - `POST /api/payment-webhook` (`api/payment-webhook.ts`): Cryptographic SHA-512 Midtrans & Stripe webhook verifier using `crypto.timingSafeEqual` and server-only `SUPABASE_SECRET_KEY` (`service_role`) to settle `public.payment_orders` and append to `public.credit_transactions`.
- **Settings Studio Go-Live Readiness Panel & Documentation:**
  - Added **Vercel Go-Live Readiness & Serverless API Endpoints** diagnostic panel in `src/components/settings/SettingsView.tsx`.
  - Updated `README.md`, `docs/ENVIRONMENT_VARIABLES.md`, `docs/API_DOCUMENTATION.md`, `.env.example`, and `scripts/test_vercel_golive_readiness.ts`.

## [1.12.0] - Phase 12: Code-Splitting & Cloud Storage Bucket Media Persistence - 2026-11-08

### Added
- **Dynamic Code-Splitting & Bundle Optimization (`src/App.tsx` & `vite.config.ts`):**
  - Converted 15 studio and enterprise modules (`WorldBuilderView`, `CharacterStudioView`, `StoryScriptView`, `StoryboardView`, `AgentManagerView`, `MediaStudioView`, `ProductionPipelineView`, `QualityControlView`, `EditingPostView`, `SubscriptionView`, `CreditsUsageView`, `AdminDashboardView`, `WorkspaceView`, `MarketplaceView`, `SettingsView`) to `React.lazy` dynamic imports wrapped in `<Suspense>`.
  - Configured `manualChunks` in `vite.config.ts` separating `vendor-react`, `vendor-supabase`, `vendor-icons`, and `studio-engines` into dedicated cacheable chunks, eliminating large single-bundle bottlenecks and resolving Vite 8 native `import.meta.dirname` configuration compatibility.
- **Supabase Storage Bucket Integration (`character-avatars` & `project-assets`):**
  - Added idempotent SQL provisioning for `storage.buckets` (`character-avatars` 10 MB limit, `project-assets` 50 MB limit) and `storage.objects` RLS policies in `supabase/deploy_all_migrations.sql` and `supabase/upgrade_v3_to_v3_2.sql`.
  - Implemented `uploadCharacterReferenceImage`, `uploadProjectAssetToBucket`, and `listStudioBucketObjects` in `src/lib/supabase.ts` with automatic dual-layer persistence (uploading directly to Supabase Storage when configured and falling back to local persistent bucket cache `ai_movie_factory_storage_buckets_v1` in offline/guest mode).
  - Added **Custom Character Face Reference Sheet Uploader** in `CharacterModal.tsx` and 1-click reference portrait upload overlays on character cards and the Character Inspector modal in `CharacterStudioView.tsx`.
  - Added direct **"Unggah ke Bucket (`project-assets`)"** media file uploader in `MediaStudioView.tsx`.

## [1.11.0] - Phase 11: Community Asset & Character Marketplace Studio Integration - 2026-11-08

### Added
- **Community Asset & Character Marketplace (`MarketplaceView.tsx` & `CharacterStudioView.tsx`):**
  - Enabled creators to share (publish) and download (import) ready-to-use **Character Studio Packs** (`MarketplaceCharacterPack`) directly into any project's **Character Studio**.
  - **Complete 3-Pillar Character Pack Specification (`MarketplaceCharacterSheet`):**
    1. **Visual Seed & Physical Anatomy Sheet:** `visual_consistency_prompt` (Master Stable Seed with 1-click clipboard copy), `face_structure`, `eyes`, `hair`, `physique_height`, and `distinguishing_features`.
    2. **Multi-Layered Costume & Artifact Catalog:** `daily_attire`, `battle_robes`, and `accessories_artifacts`.
    3. **Vocal Profile & Acoustic Reference:** `pitch_tone`, `speech_tempo`, and `voice_actor_reference` for TTS / Voice Director synchronization.
  - **4 Curated Multi-Character Studio Packs (`INITIAL_CHARACTER_MARKETPLACE_PACKS` in `multilingualAdapters.ts`):**
    - *Nine Heavens Immortal Roster (Xianxia / Wuxia Pack)*: Lin Xuan, Su Qingxue, Kaisar Iblis Mo Wuya.
    - *Cyberpunk Neo-Tokyo 2099: Syndicate & Netrunners Pack*: Kaelen "Zero" Vance, Nyx "Valkyrie" Kuroda.
    - *Nusantara Kolosal: Jawara & Putri Keraton Majapahit Pack*: Raden Arya Wirabhumi, Dyah Pitaloka Anindita.
    - *Seoul Prestige K-Drama: Chaebol Heir & Ace Prosecutor Pack*: Kang Tae-Oh, Han Seo-Yun.
  - **Direct Character Studio Import & Export Workflows:**
    - Target Project Selector in Marketplace allowing 1-click import of an entire Character Pack or an individual character directly into the selected project's Character Studio (`importCharacterPackToProject`).
    - Multi-character Pack Publisher Modal (`publishCharacterPackToMarketplace`) allowing creators to select characters from their project and publish them to the Marketplace.
    - Inline **"Unduh Paket Karakter (Marketplace)"** browser modal and per-character **"Bagikan ke Marketplace"** button integrated directly inside `CharacterStudioView.tsx`.
    - Dual-layer persistence across `fetchCharacters` and `createCharacterRecord` (`src/lib/supabase.ts`) ensuring imported characters are immediately available in both cloud-connected and local/guest projects.

## [1.10.0] - Phase 10: Quality Control, Visual Continuity & Approval Hub - 2026-11-08

### Added
- **Dedicated Quality Control & Continuity Studio (`QualityControlView.tsx`):**
  - Implemented full compliance with SSOT Part 13 (Section 34 & 35) and Step 14–15 of the Standard Production Workflow.
  - **12-Pillar Automated Quality & Continuity Audit Engine:**
    1. Character Appearance & Facial Consistency (Seed prompt verification against character identity sheet).
    2. Costume & Accessory Continuity across adjacent scene cuts.
    3. Environment & Setting Consistency (Lighting, weather, spiritual aura alignment).
    4. Story Continuity & World Codex Rules (Cultivation realms / power scaling bounds).
    5. Dialogue & Character Tone (Honorifics and emotional burst adherence).
    6. Scene Order & Chronological Numbering.
    7. Visual Quality & AI Artifact Scan (Micro-blurring, hand/finger distortion detection).
    8. Audio Quality & Broadcast Loudness Normalization (-14 LUFS standard).
    9. Aspect Ratio Conformance (16:9 Landscape & 9:16 Vertical mobile formats).
    10. Output Resolution Conformance (1080p Full HD & 4K Ultra HD master standards).
    11. Missing Asset Detection (Unrendered shots, absent voiceovers, blank scenes).
    12. Overall Production Completeness Score (0–100% Production Readiness Index).
  - **Creative Entity Versioning & Director Approval Gatekeeper:**
    - Unified approval hub tracking Characters, Scenes, Screenplay Blocks, Storyboard Shots, Media Assets, and Master Export Packages.
    - Support for all 5 official SSOT approval states (`draft`, `submitted`, `approved`, `rejected`, `revision_required`).
    - Director review modal with custom revision feedback notes and immutable timestamped audit history.
    - Batch-approval tool (`Setujui Semua Draf Teruji`) for certified entities.
  - **Missing Asset Scanner & Remediation Navigator:**
    - Live anomaly scanner flagging unrendered assets with direct 1-click navigation links to Character Studio, Story & Script, Media Studio, or Post-Production.
  - Multi-language localization across all 5 production languages (`id`, `en`, `zh`, `ja`, `es`).

## [1.9.0] - Phase 9: Editing, Post-Production & Multi-Platform Publishing Studio - 2026-11-07

### Added
- **Multi-Track Interactive Timeline Editor (`EditingPostView.tsx`):**
  - Multi-track timeline architecture supporting Video (V1), Voice/Dialogue (A1), Background Music (A2), and Sound Effects (A3).
  - Synchronized playhead scrubbing, frame-accurate timecode indicator (`HH:MM:SS`), and multi-speed playback controller (`0.5x`, `1.0x`, `1.5x`, `2.0x`).
  - Clip trimming, re-ordering, volume gain faders, and track-level mute toggles.
  - Video transition engine supporting `Cut`, `Crossfade`, `Wipe Left`, `Dip to Black`, and `Zoom Dissolve`.
- **Cinematic Color Grading LUT Profiles:**
  - Real-time video canvas post-processing filters with 5 curated cinematic presets:
    - `xianxia_ethereal`: Volumetric high contrast, mystical cyan-gold tint, and soft glow bloom.
    - `cyberpunk_neon`: High saturation, electric magenta-cyan neon balance, and deep crushed blacks.
    - `golden_warmth`: Warm amber nostalgic glow, filmic soft highlights.
    - `film_noir`: High-contrast black & white monochrome with heavy chiaroscuro shadow gradient.
    - `kodak_vintage`: 35mm analogue grain emulation with warm saturated reds and greens.
- **Dynamic Multi-Platform Publishing Engine:**
  - Automated video aspect ratio, bitrate, and container framing targets:
    - YouTube Master (16:9 4K / 1080p @ 24fps)
    - TikTok / Instagram Reels / Shorts (9:16 Vertical 1080x1920)
    - Cinemascope Anamorphic Feature Film (2.39:1 Ultra-Wide 24fps)
    - Web Drama / Social Preview (4:5 Portrait 1080x1350)
- **Central Asset Import & Master Render Package Integration:**
  - 1-click import from Media Studio generated assets (video, voice, and background music tracks).
  - Automatic audio ducking configuration on A2 BGM tracks during A1 dialogue segments.
  - Integration with `export_packages` for direct MP4 master export with timed SRT subtitles.
  - Local browser storage sequence persistence (`ai_movie_factory_timeline_sequences_v1`) to prevent loss of editing work across sessions.

### Fixed
- **Instant Project Creation Visibility & Resilient Dual-Layer Persistence:**
  - Resolved issue where newly created projects did not immediately appear in the project list after submission by implementing instant optimistic React state updating in `handleSubmitProject` (`src/App.tsx`).
  - Added dual-layer caching in `createProjectRecord` (`src/lib/supabase.ts`) so successful Supabase database inserts are also immediately mirrored to the local cache (`saveLocalProjects`), preventing list disappearances if network or relationship caches lag.
  - Added direct flat fallback query (`select('*')`) in `fetchProjects` if PostgREST relational schema cache encounters a delay resolving `project_settings` joins.

## [1.8.3] - Database Migration Script V3.2 Enterprise Master & Comprehensive Defense - 2026-11-07

### Enterprise Security & Defense-in-Depth Remediations
- **Dynamic RLS Purge Engine:** Implemented PL/pgSQL dynamic policy loop purging all legacy/rogue permissive policies on all 24 tables before re-establishing strict, unified canonical RLS policies.
- **Server-Controlled Payment Integrity:** Fully locked down `payment_orders` by revoking `UPDATE` and `DELETE` from authenticated and anonymous clients; payments are strictly created with status `'pending'` and can only be transitioned to `'settlement'`/`'paid'` by server-side webhook processes (`service_role`). Replaced all comparison operators with NULL-safe `IS DISTINCT FROM`.
- **Soft-Delete Enforcement in Security Definer Helpers & RLS:** Injected active profile checks (`is_active = true AND deleted_at IS NULL`) into `is_workspace_owner` and `is_workspace_member`, preventing deactivated accounts from accessing workspace resources.
- **Comprehensive Backend-Controlled Operational Fields Defense:** Added operational integrity triggers protecting `pipeline_jobs` (blocking client tampering of stages, progress, qc reports, outputs, and costs), `production_tasks` (blocking client-side completion forging and credit tampering), and `export_packages` (blocking client fabrication of download URLs and file sizes).
- **Execution Log Append-Only Guarantee:** Revoked `UPDATE`, `DELETE`, and `TRUNCATE` from all client roles on `pipeline_job_logs` and `agent_execution_logs`.
- **Global Creative Entity Project Immutability:** Attached `prevent_project_id_reassignment` across all 12 creative child tables (`project_settings`, `story_bibles`, `characters`, `story_concepts`, `seasons`, `episodes`, `scenes`, `assets`, `pipeline_jobs`, `agent_project_configs`, `production_tasks`, `export_packages`).
- **Master V3.2 In-Place Upgrade Script (`supabase/upgrade_v3_to_v3_2.sql`):** Created non-destructive upgrade migration script preserving 100% of existing live production data.

## [1.8.2] - Database Migration Script V3.1 Enterprise Hardening & In-Place Upgrade - 2026-11-07

### Security & Defense-in-Depth Hardening
- **Workspace Authorization Enforcement:** Enforced `status = 'active'` check within `is_workspace_member(UUID)` and workspace member policies, strictly barring `pending` or `suspended` users from accessing workspace data.
- **Strict Server-Side Payment Catalog Validation:** Hardened `validate_payment_order_catalog` trigger to validate both `topup_credits` and `subscription` packages against the official SSOT Sections 21/22 pricing catalog, rejecting all unknown `package_id` entries and preventing client-side promotion to `settlement`/`paid`.
- **Creative Entity Tenant Immutability:** Attached `prevent_project_id_reassignment` triggers to `characters`, `scenes`, and `episodes` to strictly forbid moving parent creative entities across projects, eliminating cross-project reference drift for `assets` and `pipeline_jobs`.
- **Operational Pipeline Field Defense:** Added `protect_pipeline_job_operational_fields` trigger preventing client-side credit cost tampering on pipeline jobs.
- **Financial Ledger Retention & Soft-Delete Harmonization:** Updated `credit_transactions` foreign key to `ON DELETE RESTRICT` and added `is_active` and `deleted_at` soft-delete columns to `profiles`, resolving the cascade conflict between immutable ledgers and account deactivations.
- **In-Place Upgrade Migration (`supabase/upgrade_v3_to_v3_1.sql`):** Created a non-destructive upgrade migration script preserving 100% of existing user data on active databases.

## [1.8.1] - Database Migration Script V3.0 Production Hardening & Peer Audit Remediation - 2026-11-07

### Security & Integrity Hardening
- **Master Database Migration (`supabase/deploy_all_migrations.sql` V3.0):**
  - **Transaction Wrapping:** Enclosed entire 1,200-line DDL script in `BEGIN; ... COMMIT;` block to guarantee atomic deployment (zero partial failure state).
  - **Composite Foreign Key Fix:** Solved PostgreSQL cascading delete violation on `assets` and `pipeline_jobs` by replacing invalid composite `ON DELETE SET NULL` with single-column nullable references accompanied by defensive `BEFORE INSERT OR UPDATE` triggers (`check_asset_project_integrity` and `check_pipeline_job_project_integrity`) ensuring multi-tenant project boundary consistency.
  - **Security Definer Enumeration Protection:** Hardened `is_workspace_owner(UUID)` and `is_workspace_member(UUID)` by eliminating caller-provided `p_user_id` parameter; functions now derive identity strictly from `auth.uid()`, preventing user probing attacks.
  - **Search Path & Privileges:** Locked down function execution with `SET search_path = public`, granted execute rights to `anon`, `authenticated`, and `service_role` (allowing PostgREST to cleanly evaluate RLS conditions for guest queries without throwing 42501 permission denied).
  - **Financial Ledger Immutability:** Enforced immutable append-only ledger on `credit_transactions` via statement and row triggers rejecting `UPDATE`, `DELETE`, and `TRUNCATE`, reinforced with explicit SQL role privilege revocations.
  - **Payment Catalog Tamper-Proofing:** Implemented `validate_payment_order_catalog` trigger preventing client-side credit quantity/amount alterations and disallowing unauthorized status promotions.
  - **Diagnostic Engine (`supabase/verify_deployment.sql`):** Upgraded 10-point post-deployment verification script with table-level RLS validation, fixed `pg_tables` alias (`a.tablename`), non-recursive RLS smoke test, and master deployment verdict.

## [1.8.0] - Phase 8: Polishing & Production Deployment Preparation - 2026-11-06

### Added
- **Full End-to-End Production Integration Walkthrough:**
  - Integrated complete seamless pipeline flow: `World Building` ➔ `Character Studio` ➔ `Story & Script (with Multilingual Cultural Adaptation)` ➔ `Storyboard Studio` ➔ `AI Agent Orchestrator` ➔ `Media Studio Asset Generation` ➔ `Production Pipeline & Automated QC` ➔ `Master Package Export` ➔ `Multi-Seat Workspace Collaboration`.
  - Added interactive **End-to-End Walkthrough Simulator** in Settings (`SettingsView.tsx`), executing automated verification tests across all 9 production modules with real-time progress indicators, simulated roundtrip latency telemetry, and verification logs.
- **Dedicated Storyboard Studio Module (`StoryboardView.tsx`):**
  - Shot Composition Director supporting 6 cinematic framing options (Wide Establishing, Medium Character, Over-The-Shoulder, Close-Up Emotional Beat, Extreme Close-Up, Dutch Angle).
  - Multi-Axis Camera Motion Controls (Dolly Track, Pan 180°, Tilt Vertical, Crane Boom, Static Locked-Off, Handheld Kinetic).
  - Lighting Mood Presets (Volumetric Golden Hour, Moody Chiaroscuro Noir, Bioluminescent Neon, Spiritual Qi Radiance).
  - Framing & blocking notes editor with dynamic shot approval status management (`draft`, `approved`, `render_ready`).
  - Visual Continuity Seed Prompt Generator with 1-click clipboard export for injection into Media Studio (`gemini-3.1-flash-lite-image`).
- **Production Environment & Supabase Deployment Readiness:**
  - Consolidated single-file database deployment script (`supabase/deploy_all_migrations.sql`) incorporating all 8 migration files (24 tables, GIN indexes, RLS security policies, and trigger automation) for 1-click execution in the Supabase SQL Editor.
  - Interactive **Production Environment Variables Table** in `SettingsView.tsx` with live configuration status indicators (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `APP_URL`).
  - Interactive **PostgreSQL Database Schema & Security Audit** tab detailing all 24 production tables, primary keys, and RLS enforcement status.
  - Updated `profiles` table check constraint to support all 5 production languages (`'id', 'en', 'zh', 'ja', 'es'`).
  - Added automated Supabase Dashboard URL normalization (`normalizeSupabaseUrl` in `src/lib/supabase.ts`) converting web console links (`https://supabase.com/dashboard/project/<ref>`) into live REST API endpoints (`https://<ref>.supabase.co`).
  - Added intelligent Supabase API key diagnostics in `SettingsView.tsx` detecting Platform Management Keys (`sb_publishable_...`) versus PostgREST Database Public Keys (JWT `eyJhbGciOi...`).


### Updated
- Documentation updated to Version 2.0: `docs/DEVELOPMENT_ROADMAP.md`, `docs/ARCHITECTURE.md`, and `docs/ENVIRONMENT_VARIABLES.md`.
- `src/App.tsx` navigation updated with full mounting of `StoryboardView`, eliminating all temporary placeholder fallbacks across the studio suite.

## [1.7.0] - Phase 7: Global Expansion, Multilingual Engine, Team Workspaces, and Template Marketplace - 2026-11-05

### Added
- **Global Expansion Architecture (SSOT Sections 25, 42):**
  - Expanded interface localization to 5 global languages: Bahasa Indonesia (`id`), English (`en`), Simplified Chinese (`zh` 简体中文), Japanese (`ja` 日本語), and Spanish (`es` Español).
  - Regional currency auto-detection and conversion engine (`src/lib/multilingualAdapters.ts`) supporting `IDR` (Rp), `USD` ($), `CNY` (¥), `JPY` (¥), and `EUR` (€) with real-time conversion parity.
  - Interactive language selector and currency selector in the persistent top navigation bar (`Navbar.tsx`).
- **Multilingual Script & Voice Generation Adapters (SSOT Section 42):**
  - Cinematic translation engine (`translateScriptScene`) with culturally preserved honorifics and stylistic registers across 8 languages (Mandarin Chinese, Japanese, Korean, Thai, Arabic, Spanish, English, Indonesian).
  - Integrated "Adaptasi Bahasa" modal into the Screenplay Editor (`StoryScriptView.tsx`) with instant side-by-side translation preview, cultural notes breakdown, and 1-click scene application.
- **Team Collaboration Workspaces & Multi-Seat Access Control (SSOT Section 42):**
  - Dedicated `WorkspaceView.tsx` component providing multi-seat studio containers.
  - Role-Based Access Control (RBAC) supporting 4 distinct production roles:
    - `Studio Owner`: Full billing, administrative, project creation, and team quota control.
    - `Director`: Creative direction, visual styling, prompt approvals, and pipeline execution.
    - `Writer`: Screenplay drafting, dialogue refinement, and scene hierarchy editing.
    - `Reviewer / QC`: Quality control evaluation, continuity review, and output playback only.
  - Multi-seat quota metering and progress visualization with automatic seat-limit enforcement tied to subscription tiers (1 seat Free, 2 seats Creator, 5 seats Pro Studio, 20 seats Production House).
  - Member invitation and removal workflows with instant role re-assignment.
- **Community Workflow & Asset Template Marketplace (SSOT Section 42):**
  - Dedicated `MarketplaceView.tsx` component featuring curated cinematic universe bibles, character packs, and workflow pipelines.
  - Initial high-fidelity community templates:
    - *Xianxia Epic Universe Bible* (Cultivation realms, spiritual techniques, protagonist & rival character pack).
    - *Cyberpunk Neo-Tokyo 2099* (Bioluminescent megacity, cybernetic implants, noir detective archetype).
    - *K-Drama High-Tension Romance* (Chaebol power struggle, emotional pacing arc).
    - *High-Impact Martial Choreography Pipeline* (Cinematic 24fps camera motions, physics-grounded martial combat).
  - 1-click "Klon Template ke Proyek Saya" (cloning universe bibles, rules, and character dossiers into new active projects).
  - Full-text search and category filtering (`universe_bible`, `character_pack`, `workflow_pipeline`, `screenplay_arc`).
- **Database & Security:**
  - PostgreSQL schema migration (`supabase/migrations/20261104070000_phase7_global_expansion_schema.sql`) for `public.workspaces`, `public.workspace_members`, `public.workspace_invites`, and `public.marketplace_templates`.
  - Row Level Security (RLS) policies enforcing multi-tenant workspace isolation and public template discovery.
- **Navigation & Documentation:**
  - Added "KOLABORASI & KOMUNITAS" navigation group to `Sidebar.tsx` and quick access tabs in `Navbar.tsx`.
  - Updated `docs/DATABASE_SCHEMA.md` and `docs/DEVELOPMENT_ROADMAP.md`.

## [1.6.0] - Phase 6: Commercial SaaS, Credit Ledger Auditing, and Admin Console - 2026-11-05

### Added
- **Commercial SaaS & Monetization Architecture (SSOT Sections 21, 22, 23, 41):**
  - Integrated 4-tier configurable subscription structure: `Free Creator` (Rp 0), `Creator (Indie)` (Rp 99.000/bln), `Pro Studio` (Rp 299.000/bln [Recommended]), and `Production House` (Rp 999.000/bln).
  - Monthly vs Annual billing toggle with 20% annual savings discount.
  - Granular tier feature matrices governing monthly credit allotments, max rendering resolutions (1080p vs 4K ProRes), simultaneous rendering queue slots (1 to 20), and SLA support tiers.
- **Midtrans & Stripe Payment Gateway Integration (SSOT Section 21):**
  - Production-grade payment checkout modal (`PaymentModal.tsx`) with 256-bit SSL simulated security.
  - Multi-channel support: Dynamic QRIS (GoPay, OVO, Dana, ShopeePay, BCA Mobile) with active 15-minute countdown timer, BCA Virtual Account, Mandiri Bill, and Credit Card (Visa/Mastercard).
  - Verified settlement simulator triggering instant webhook fulfillment, account upgrading, and credit granting.
- **Immutable Auditable Credit Ledger (SSOT Section 22):**
  - Dedicated `CreditsUsageView.tsx` tracking all credit events in `public.credit_transactions`.
  - Records exact parameters: User ID, Project, Job, AI Provider (`google_gemini`, `runway_gen3`, `elevenlabs`), Model, Operation, Estimated USD cost, Actual provider cost, Credits charged, and Resulting balance.
  - Idempotency control keys preventing duplicate debits on retries or re-sent webhooks.
  - Interactive Scene Credit Cost Estimator with real-time sliders for dialogue lines, keyframes, video duration, and audio/QC layers.
  - One-click credit transaction refund mechanism for technical render compensation.
  - CSV export of complete immutable ledger history.
- **Production Credit Top-Up Packs:**
  - 4 instant top-up packs (`Starter Boost` 500 cr, `Producer Pack` 1.500 cr + 150 bonus [Popular], `Studio Block` 5.000 cr + 750 bonus, `Cinema Bulk` 20.000 cr + 4.000 bonus).
- **SaaS Operations & Admin Console (`admin_panel` SSOT Section 41):**
  - Operational analytics cockpit (`AdminDashboardView.tsx`) tracking MRR, Total Credits Sold, Total Credits Consumed, Total AI Provider API Costs, and Calculated Gross Margin (90%+).
  - Provider model utilization breakdown comparing Gemini 3.1 Flash Lite, Gemini Omni 1.1 Flash / Veo, Gemini 3.8 Flash TTS, and Gemini 2.5 Pro costs.
  - Global transaction inspection and administrative force-refund tool.
  - User Credit Governance tool: Manual credit grant and deduction with required audit justification memo.
  - System health and infrastructure latency monitor (Supabase, Dev Server, AI API latencies).
- **Database & Security:**
  - PostgreSQL schema migration (`supabase/migrations/20261104060000_phase6_commercial_saas_schema.sql`) for `public.subscriptions`, `public.credit_transactions`, and `public.payment_orders`.
  - Row Level Security (RLS) policies scoped strictly to authenticated user identity (`auth.uid() = user_id`).
- **Internationalization (i18n):**
  - Full Indonesian and English translations for `subscription`, `creditsUsage`, and `adminPanel`.

## [1.5.0] - Phase 5: Production Pipeline, Autonomous Queue and Automated QC - 2026-11-05

### Added
- **Production Pipeline Module (`production_pipeline` SSOT Sections 14, 15, 40):**
  - Integrated 4-tab production cockpit: `Job Queue & Monitoring`, `Scene-Level Runner`, `Quality Control Center`, and `Master Export & Delivery Hub`.
  - Real-time pipeline telemetry dashboard tracking active background jobs, queued items, jobs awaiting director approval, completed renders, failures, average QC conformance score, and credits.
- **Autonomous Scene-Level Processing (SSOT Section 15):**
  - Scene-level execution independence: Creators can queue, re-render, and process individual scenes autonomously without being forced to re-render the entire episode.
  - Granular 8-stage execution graph: `script_prep` $\rightarrow$ `image_gen` $\rightarrow$ `video_gen` $\rightarrow$ `voice_audio` $\rightarrow$ `qc_audit` $\rightarrow$ `user_approval` $\rightarrow$ `final_assembly` $\rightarrow$ `export_ready`.
  - Autonomous stage progression simulator with live percentage progress, stage steppers, and stage-skipping option for credit savings.
  - Priority-tiered scheduling (`urgent`, `high`, `normal`, `low`) with live job controls (Pause, Resume, Cancel, Approve).
- **Automated Quality Control (QC) Engine (SSOT Section 14, 40):**
  - Automated QC evaluation runner (`evaluateSceneQC`) auditing scenes across 4 key pillars:
    - **Visual Continuity:** Facial seed consistency and lighting atmosphere continuity across shots.
    - **Audio-Visual Sync:** Dialogue duration matching against video duration envelope and lip movement alignment.
    - **Narrative Lore Codex:** Spiritual aura color matching, sect insignia accuracy, and realm power markers against the World Bible.
    - **Technical Specs Conformance:** Constant 24.00fps, 1080p/4K resolution, and broadcast audio loudness (-14 LUFS).
  - Visual QC Report Modal (`QCReportModal.tsx`) with category breakdown scores, auditor agent signature, pass/warning/fail status, and direct "Approve & Proceed to Final Assembly" checkpoint action.
- **Master Packaging & Subtitle Delivery Hub (SSOT Section 40):**
  - Multi-container packaging support (`MP4` H.264/AAC, `Apple ProRes 422 HQ` 4K archival master, and `WebM`).
  - Automated subtitle generation engine (`generateSubtitles`) converting scene screenplay dialogue blocks into standards-compliant SubRip (`.srt`) and WebVTT (`.vtt`) formats with precise timecodes.
  - Subtitle code preview lightbox and one-click `.srt`/`.vtt` file download.
  - Master video package download simulator.
- **Database Schema & Telemetry:**
  - PostgreSQL schema migration (`supabase/migrations/20261104050000_phase5_production_pipeline_schema.sql`) for `public.pipeline_jobs`, `public.pipeline_job_logs`, and `public.export_packages`.
  - Comprehensive Row Level Security (RLS) policies scoped to project ownership.
  - Telemetry log viewer modal displaying timestamped system actions and agent reasoning logs per pipeline job.
- **Internationalization (i18n):**
  - Full Indonesian and English dictionaries for all Production Pipeline tabs, job statuses, QC criteria, modal dialogs, and packaging presets.

## [1.4.0] - Phase 4: Media Generation and Production Asset Library - 2026-11-05

### Added
- **Media Studio Module (`media_studio` SSOT Section 13, 39):**
  - Integrated cockpit for multimodal generation across 4 core media domains: Images, Videos, Voice Tracks, and Music/Sound Design.
  - Multi-tab studio interface: `Pustaka Aset Produksi` (Asset Library), `Sintesis Gambar AI` (Image Studio), `Generator Video & Gerak` (Video Studio), `Pengarah Vokal & TTS` (Voice Director), and `Musik & Tata Suara` (Audio Studio).
  - Production telemetry metrics banner tracking total assets, image stills, video motion clips, voice dubbing tracks, audio/SFX tracks, approval counts, and compute credits consumed.
- **AI Provider Adapter Architecture (SSOT Section 18):**
  - Modular provider abstraction (`MediaProviderAdapter` in `src/lib/mediaAdapters.ts`) decoupling the studio from proprietary single-provider lock-in.
  - **Google Gemini Native Adapter (`google_gemini`)**:
    - Image Generation: `gemini-3.1-flash-lite-image` (high-throughput keyframes & storyboard panels) and `gemini-nano-banana-2.1` (stylized master 2K/4K visual art).
    - Video Generation: `gemini-omni-1.1-flash` (Veo motion synthesis, physical dynamics, and camera choreography).
    - Voice Synthesis: `gemini-3.8-flash-tts` (vocal burst emotion tags `<laugh>`, `<gasp>`, `<whisper>`) and `gemini-3.8-flash-lite-tts`.
    - Music & Audio: `lyria-3-clip-preview` (orchestral themes, traditional Xianxia instruments, and technique SFX).
  - **Runway Gen-3 Alpha Adapter (`runway_gen3`)**: Image-to-video motion control and orbital camera moves.
  - **ElevenLabs Adapter (`elevenlabs`)**: Multilingual voice cloning and character dubbing.
  - **Suno Audio Adapter (`suno_audio`)**: Thematic symphonic score and battle duel soundtrack composition.
- **Cinematic Image Synthesis & Character Continuity:**
  - Automated character continuity linking: Selecting a registered character from Character Studio directly injects their master visual continuity seed prompt.
  - Screenplay scene association: Directly ties generated frames to specific scene sluglines and emotional beats.
  - Aspect ratio switcher (`16:9`, `9:16`, `1:1`, `21:9`) and resolution targeting (`1080p`, `4K`).
  - Negative prompt support for filtering undesired artifacts.
- **Video & Camera Motion Rig Generator:**
  - Image-to-video source selector pulling any previously synthesized image still directly from the project library.
  - Camera Motion Rig parameters: Pan Right/Left, Tilt Up/Down, Zoom In/Out, Orbital Track, and Static Focus.
  - Dynamic motion intensity slider (1 to 10) and duration configuration (3s, 5s, 8s, 10s).
- **Character Voice Director & TTS Dubbing:**
  - Speaking character selector linked to character roster and voice profiles (pitch, tempo).
  - Quick-insert emotion burst tags (`<whisper>`, `<laugh>`, `<gasp>`, `<shout>`) for expressive delivery.
  - Multilingual voice synthesis (Bahasa Indonesia, English, Chinese Mandarin, Japanese) and speech tempo control.
- **Central Production Asset Library (`assets` table):**
  - Unified catalog tracking provider, model, prompt, generation parameters (seed, aspect ratio, duration), credit cost, and file location.
  - Creator approval checkpoint workflow (`draft`, `in_review`, `approved`, `rejected`) with one-click authorization badges.
  - Asset Detail Inspection Modal (`AssetDetailModal.tsx`) with high-resolution lightbox, audio player, prompt clipboard copy, and "Use as Video Source" flow.
- **Database & Security:**
  - PostgreSQL schema migration (`supabase/migrations/20261104040000_phase4_media_generation_schema.sql`) for `public.assets` table with foreign keys to projects, episodes, scenes, and characters.
  - Row Level Security (RLS) policies guaranteeing multi-tenant project isolation.
  - Dual-mode architecture: Automatic fallback to persistent local storage sandbox seeded with demo Xianxia assets.
- **Internationalization (i18n):**
  - Full Indonesian and English translations for all Media Studio sections, generation forms, filters, and modals.

## [1.3.0] - Phase 3: AI Agent System and Master Director Orchestrator - 2026-11-05

### Added
- **14 Specialized AI Agent Registry (SSOT Section 12):**
  - Master Director (`master_director`): High-level workflow orchestration, task delegation, and execution telemetry.
  - World Builder Agent (`world_builder_agent`): Cultivation realms, sect lore, geographical rules, and world bible adherence.
  - Story Architect (`story_architect`): Narrative arcs, pacing, act turning points, and seasonal loglines.
  - Script Writer (`script_writer`): Cinematic sluglines, action beats, character dialogue, and parentheticals.
  - Character Designer (`character_designer`): Visual continuity formulas, stable reference seeds, and costume variations.
  - Cultivation System Agent (`cultivation_agent`): Xianxia power levels, spiritual arts, tribulation mechanics, and talisman rules.
  - Fight Choreographer (`fight_choreographer`): Martial arts choreography, kinetic beats, physics, and spiritual impact breakdown.
  - Storyboard Director (`storyboard_director`): Camera coverage, shot types, framing, and aspect-ratio compositions.
  - Cinematographer (`cinematographer`): Lighting schemes, color palettes, camera lenses, and movement rigs.
  - Image Generation Agent (`image_gen_agent`): Generative prompt synthesis for characters, environments, and keyframes.
  - Video Generation Agent (`video_gen_agent`): Motion descriptors, temporal consistency guides, and video clip prompts.
  - Voice Agent (`voice_agent`): Multilingual acoustic synthesis, pitch ranges, cadence, and emotion tags.
  - Editor Agent (`editor_agent`): Rhythm, pacing, scene transitions, and multi-shot montage assembly.
  - Quality Control Agent (`qc_agent`): Script continuity audit, character facial invariance checks, and lore conflict detection.
- **Master Director Orchestrator & Workflow Plans (SSOT Section 13, 38):**
  - 4 Pre-configured Master Execution Workflows:
    1. *Full Script Production Pipeline*: Chained execution across Story Architect -> Script Writer -> Fight Choreographer -> QC Agent.
    2. *Character Visual Continuity & Audit Pipeline*: Character Designer -> World Builder Agent -> QC Agent.
    3. *Storyboard & Shot Breakdown Pipeline*: Storyboard Director -> Cinematographer -> Image Generation Agent.
    4. *Martial Arts Duel Choreography*: Cultivation System Agent -> Fight Choreographer -> Cinematographer -> QC Agent.
  - Dynamic task queue manager (`production_tasks`) supporting statuses: `pending`, `in_progress`, `needs_approval`, `completed`, `failed`.
  - Human Approval Checkpoints (`needs_approval`) requiring director confirmation before downstream tasks proceed.
  - Task cancellation, retry, and approval state transitions.
- **Real-Time Execution Telemetry Terminal (SSOT Section 13):**
  - Live log streaming terminal supporting 6 event levels: `info`, `reasoning`, `action`, `approval_required`, `success`, `error`.
  - Monospace layout with timestamp, agent role tags, step tracking, auto-scroll toggle, and level filtering.
- **Agent Configuration Modal (`AgentConfigModal.tsx`):**
  - Fine-grained per-agent tuning: Foundation Gemini models (`gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.1-flash-lite-image`, `gemini-3.8-flash-tts`).
  - Creative temperature slider (0.1 to 1.0), credit budget limits, human approval enforcement toggle, and project-level system prompt overrides.
- **Database & Security:**
  - PostgreSQL schema migration (`supabase/migrations/20261104030000_phase3_agent_system_schema.sql`) creating `agent_project_configs`, `production_tasks`, and `agent_execution_logs`.
  - Row Level Security (RLS) policies guaranteeing multi-tenant project isolation.
  - Dual-mode architecture: Automatic fallback to persistent local storage sandbox when Supabase is unconfigured.
- **Internationalization (i18n):**
  - Comprehensive translations in Indonesian (`id`) and English (`en`) for all 14 agents, workflows, task statuses, telemetry levels, and modal dialogues.

## [1.2.0] - Phase 2 (Part B): Story & Script Engine and Scene Hierarchy - 2026-11-04

### Added
- **Story Concept & Premise Manager (SSOT Section 10):**
  - Project-level story premise, hook logline, and overarching narrative synopsis.
  - Multi-structure narrative frameworks support: Classical Three-Act, Kishōtenketsu (4-act twist), Five-Act Dramatic, Hero's Journey / Monomyth, and Dynamic Dual-Protagonist Romantic Tension.
  - Tone & atmosphere guidelines and target audience demography tracking.
- **Season & Episode 3-Tier Hierarchy (SSOT Sections 10 & 37):**
  - Structural seasons manager with status tracking (`in_development`, `in_production`, `completed`), target episode counts, and arc synopsis.
  - Episode planner with sequential episode numbering, episode-level loglines, target runtime minutes, and scene target quotas.
- **Shot-Ready Scene Breakdown & Roster (SSOT Section 11):**
  - Scene sluglines automatically parsed and formatted (`INT./EXT. LOCATION - TIME OF DAY`).
  - Scene emotional beat and dramatic intent formulation.
  - Dynamic character tagging associating registered characters from Character Studio with scene appearances.
  - Dedicated scene creation & editing modal (`SceneModal.tsx`).
- **Cinematic Screenplay Editor Studio:**
  - Standardized screenplay block layout supporting Action, Character Dialogue, Parenthetical Tone Notes, and Scene Transitions (`CUT TO:`, `DISSOLVE TO:`).
  - Speaker selector wired directly to tagged characters with delivery notes.
  - Move up, move down, and reorder controls for screenplay blocks.
  - Visual continuity generator prompt seed preview with 1-click clipboard copy.
  - Director notes for camera angles/motion and sound/music ambience design.
- **Approval Checkpoint & Versioning Flow (SSOT Sections 10, 37, 38):**
  - Human Approval Checkpoint workflow allowing creators/directors to approve scene scripts with verification badges (`Disetujui`, `Dalam Peninjauan`, `Draf`).
  - Version snapshot system recording changelog notes and maintaining complete screenplay block history (`script_versions`).
- **Database & Security:**
  - PostgreSQL schema migration (`supabase/migrations/20261104020000_phase2_story_script_schema.sql`) for `story_concepts`, `seasons`, `episodes`, `scenes`, and `script_versions`.
  - Multi-tenant Row Level Security (RLS) policies enforcing project ownership.
  - Complete local storage fallback persistence with rich seed data for episodes and multi-block Xianxia scenes.
- **Internationalization (i18n):**
  - Full Indonesian and English translations for all Story & Script terms, screenplay blocks, approval badges, and dialogs.

## [1.1.0] - Phase 2: Creative Development (World Builder & Character Studio) - 2026-11-04

### Added
- **World Builder Module (SSOT Section 8 & 37):**
  - Project-scoped Story Bible manager with dual live Supabase PostgreSQL and local sandbox persistence.
  - Universe Overview: World name, thematic synopsis, ancient historical background, rules of the world, and magic/tech systems.
  - Xianxia / Fantasy Cultivation Realms Manager: Ordered realm hierarchy (#1 upwards), breakthrough requirements, and special abilities with add/edit/delete.
  - Factions & Sects Architecture: Faction classifications (sects, clans, kingdoms, corporations, syndicates), alignments (righteous, demonic, neutral, chaotic), leadership, headquarters, and specialties.
  - World Geography & Locations: Regional territory catalog, terrain & climate, danger levels (peaceful, moderate, perilous, forbidden), and controlling factions.
  - Chronological History & Timeline: Milestone eras, timestamps, pivotal events, and narrative significance trackers.
- **Character Studio Module (SSOT Section 9 & 37):**
  - Multi-tab character creation & editing modal (`CharacterModal`).
  - Deep identity breakdown: Protagonist, antagonist, supporting, mentor, and recurring role classifications.
  - Facial & Physical Breakdown: Precise face structure/jawline, eye shape & iris color, hairstyle & length, physique & height, and distinguishing features (scars, birthmarks).
  - Costume & Relics Catalog: Daily attire, battle robes / armor, artifacts, weapons, and accessories.
  - Vocal Characterization: Pitch/tone range, tempo, and voice actor reference.
  - Master Visual Continuity Formula: Generative AI stable seed prompt generator compiling character traits for seamless visual consistency across scenes.
  - Inter-Character Relationship Web: Network connections, relation types (e.g. sect siblings, mortal enemies, mentors), and dynamic descriptions.
  - Roster view with search bar, role filter segmented controls, card inspect modal, and quick "Copy Prompt Seed" clipboard action.
- **Database & Security:**
  - PostgreSQL schema migration (`supabase/migrations/20261104010000_phase2_world_character_schema.sql`) for `story_bibles` and `characters` tables.
  - Row Level Security (RLS) policies enforcing multi-tenant project ownership.
  - Seamless fallback persistence in local storage with seed demo characters (Ye Chen, Lin Yue'er, Elder Bai Cang, Gu Tianxiao) and Tianhuang Continent world lore.
- **Internationalization (i18n):**
  - Full Indonesian and English translations for all World Builder and Character Studio terms, fields, roles, alignments, and toasts.

## [1.0.0] - Phase 1: SaaS Foundation - 2026-11-04

### Added
- **Application Shell & UI Architecture:**
  - Premium cinematic dark production studio theme (`#0B0F17` charcoal, deep navy surfaces, 1px hairline borders).
  - Strict Top Bar Contract implementation (single brand mark, single-line navigation links, user menu, language switcher).
  - Complete SSOT Section 5 Navigation sidebar covering Overview, Production Studio, Business, and System.
  - Responsive layout for desktop (1440px baseline) and mobile/tablet devices.
- **Internationalization (i18n):**
  - Default Bahasa Indonesia with full English language switching.
  - Centralized translation dictionary (`src/lib/translations.ts`) for all UI labels, filters, notifications, and statuses.
- **Project Management (CRUD & Configuration):**
  - Full dynamic project creation modal supporting all 15 configuration fields from SSOT Section 49 (Genre, Custom Genre, Format, Seasons, Episodes, Duration, Target Scenes, Aspect Ratio, Resolution, Frame Rate, Visual Style, Languages, Production Mode, Modules, 14 AI Agents, Human Approval Checkpoint, Credit Budget).
  - Project listing view with live multi-criteria filtering (search, genre, format, status), sorting, and unboxed metadata cards.
  - Detailed project inspection modal (`ProjectDetailModal`).
  - Project editing and duplication capabilities.
  - Secure deletion modal with explicit user confirmation.
- **Cockpit Dashboard:**
  - Live statistics display: Total projects, total episodes, total scenes, active AI agents (14), credit budget, and queue jobs.
  - Active jobs monitor with progress bars and agent assignment.
  - Recent studio production activities feed.
- **Database & Security:**
  - Initial Supabase PostgreSQL migration script (`supabase/migrations/20261104000000_initial_schema.sql`).
  - Core tables: `profiles`, `projects`, `project_settings` with UUID PKs, foreign keys, timestamps triggers, and Row Level Security (RLS) policies.
  - Transparent dual-mode client: Cloud Supabase Auth/PostgreSQL integration when configured, with a local sandbox preview mode when disconnected.
- **Documentation:**
  - `docs/ai_movie_factory_SSOT.md` (Master Prompt & SSOT Document v1.0).
  - `docs/DATABASE_SCHEMA.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ENVIRONMENT_VARIABLES.md`
  - `docs/API_DOCUMENTATION.md`
  - `docs/DEVELOPMENT_ROADMAP.md`
  - `README.md`
