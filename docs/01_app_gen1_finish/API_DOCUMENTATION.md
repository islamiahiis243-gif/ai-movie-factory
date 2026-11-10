# AI Movie Factory - API & Service Layer Documentation

**Document Version:** 4.0 (`v1.15.8`)  
**Timestamp:** `2026-11-09 21:31 +07:00`  
**Reference:** SSOT Part 7 (Sections 16–18), Part 9 (Sections 21–22), Part 15 (Section 45), Roadmap Phase 14 & 15  
**Deployment Infrastructure:** Vercel Hobby Serverless (8 Consolidated Routes under 12-function limit) + Supabase Cloud PostgreSQL (pg_cron autonomous worker scheduler)

---

## 1. Consolidated Vercel Serverless Backend APIs (`api/`)

To comply strictly with Vercel Hobby's 12-serverless-function quota without incurring \$20/month Vercel Pro fees, backend endpoints are consolidated into 8 active routers. All server helpers, cost engines, and adapters are decoupled into `server/` at the repository root and included via `vercel.json` (`functions.includeFiles`).

### 1.1. `GET /api/health` (`api/health.ts`)
- **Purpose:** Production health and zero-cost environment audit probe.
- **Security:** Read-only, unauthenticated. Never reveals sensitive values.
- **Response Example:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-11-09T14:31:00.000Z",
    "version": "1.15.7",
    "schemaVersion": "V3.9 Live Analytics Sync",
    "environment": {
      "supabasePublicClient": true,
      "supabaseServiceRoleServerOnly": true,
      "geminiServerProxy": true,
      "oauthVaultConfigured": false,
      "publishingWorkerConfigured": true,
      "googleOAuthConfigured": false,
      "tikTokOAuthConfigured": false,
      "metaOAuthConfigured": false,
      "midtransWebhookVerifier": false,
      "stripeWebhookVerifier": false
    }
  }
  ```

### 1.2. `POST /api/ai-generate` (`api/ai-generate.ts`)
- **Purpose:** High-security AI orchestration proxy for Google Gemini 2.5 Flash, executing two-phase atomic credit reservations and usage metering telemetry extraction.
- **Security:** Mandatory Supabase Auth JWT (`Authorization: Bearer <token>`). Returns HTTP 401 for unauthenticated calls and HTTP 402 for insufficient balances.
- **Credit Lifecycle:**
  1. `reserve_credits(user_id, cost, operation, 'gemini-2.5-flash', metadata)` (row-level lock on `profiles(id)`).
  2. Executes Gemini SDK generation server-side.
  3. Extracts exact tokens from `response.usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`, `cachedContentTokenCount`).
  4. Records immutable telemetry into `public.ai_usage_records`.
  5. `settle_credits(reservation_id, final_cost, actual_tokens)`. If failure occurs, automatically calls `release_credits(reservation_id, reason)`.
- **Request Body:**
  ```json
  {
    "operation": "script_outline" | "character_seed" | "continuity_audit" | "shot_prompt" | "storyboard_director",
    "prompt": "String prompt payload",
    "model": "gemini-2.5-flash",
    "systemInstruction": "Optional system directives",
    "estimatedCost": 10
  }
  ```
- **Response:**
  ```json
  {
    "status": "completed",
    "operation": "script_outline",
    "provider": "google_gemini",
    "model": "gemini-2.5-flash",
    "output": "Generated screenplay or narrative text...",
    "usage": {
      "promptTokens": 420,
      "candidatesTokens": 185,
      "totalTokens": 605,
      "cachedTokens": 0
    },
    "cost": {
      "billedUsd": 0.00,
      "equivalentPaidUsd": 0.000087,
      "creditsSettled": 10
    },
    "timestamp": "2026-11-09T14:31:00.000Z"
  }
  ```

### 1.3. `GET, POST /api/credits/[action]` (`api/credits/[action].ts`)
- **Purpose:** Consolidated dispatcher for credit balances and atomic transactions (`/api/credits/balance` and `/api/credits/transaction`).
- **Security:** Mandatory Supabase Auth JWT.
- **Actions:**
  - `GET /api/credits/balance`: Returns available balance, held reservations, lifetime spent, and current subscription tier via `get_user_credit_balance()` RPC.
  - `POST /api/credits/transaction`: Dispatches two-phase reservation, settlement, or release operations (`reserve`, `settle`, `release`).

### 1.4. `GET, POST /api/oauth/[action]` (`api/oauth/[action].ts`)
- **Purpose:** Consolidated OAuth 2.0 lifecycle dispatcher for YouTube, TikTok, Instagram Reels, and Facebook Page Video (`/api/oauth/url`, `/api/oauth/callback`, `/api/oauth/connections`, `/api/oauth/disconnect`).
- **Security:** Mandatory Supabase Auth JWT for all routes except the provider callback (`/api/oauth/callback`).
- **OAuth Security Vault:** Tokens are encrypted at rest using AES-256-GCM with Authenticated Additional Data (`userId`) and 12-byte random IVs.
- **State Store:** Single-use cryptographic state tokens stored in `public.oauth_state_transactions` with 5-minute TTL, defending against CSRF and Replay attacks.

### 1.5. `GET, POST /api/publishing/[action]` (`api/publishing/[action].ts`)
- **Purpose:** Consolidated router for social video publishing (`/api/publishing/job`, `/api/publishing/cancel`, `/api/publishing/worker`).
- **Security:** JWT authentication for creator job creation/cancellation; `CRON_SECRET` / `PUBLISHING_WORKER_SECRET` for the worker routine.
- **Actions:**
  - `POST /api/publishing/job`: Creates queued publishing job with video URL, title, description, tags, and target platform.
  - `POST /api/publishing/cancel`: Safely cancels a queued job before worker lease acquisition.
  - `GET, POST /api/publishing/worker`: Cron-driven worker processing `queued` jobs with lease fencing tokens, atomic claim transitions, and duplicate upload prevention.

### 1.6. `GET, POST /api/analytics/[action]` (`api/analytics/[action].ts`)
- **Purpose:** Consolidated social analytics dispatcher (`/api/analytics/sync`, `/api/analytics/history`, `/api/analytics/sync-worker`).
- **Security:** JWT authentication for manual creator sync and history; `CRON_SECRET` for automated synchronization worker.
- **Actions:**
  - `POST /api/analytics/sync`: Live real-time sync with platform APIs (YouTube Data API v3, TikTok Video Query v2, Meta Graph API v21.0).
  - `GET /api/analytics/history`: Time-series snapshot history for published video performance.
  - `GET, POST /api/analytics/sync-worker`: Periodic snapshot worker triggered via Supabase `pg_cron`.

### 1.7. `GET, POST /api/admin/financial-analytics` (`api/admin/financial-analytics.ts`)
- **Purpose:** Executive admin financial console and SaaS sensitivity simulator.
- **Security:** Strict Admin JWT guard (requires `profiles.role === 'admin'`). Rejects unauthenticated calls with HTTP 401 and non-admin creators with HTTP 403.
- **Response Data:**
  - Real-time token usage aggregates (`prompt_tokens`, `candidates_tokens`, `total_tokens`).
  - Google Gemini cost breakdown (Billed Actual \$0.00 vs Equivalent Paid USD/IDR).
  - 4-Tier SaaS Gross Profit Margin projections under 5 stress scenarios (`conservative`, `normal`, `heavy_usage`, `high_video`, `high_retry`).
  - Financial anomaly detection alerts (high token spikes, repeated retries, rapid debit anomalies).

### 1.8. `POST /api/payment-webhook` (`api/payment-webhook.ts`)
- **Purpose:** Cryptographically verified payment webhook receiver for Midtrans and Stripe.
- **Security:**
  - Computes and verifies SHA-512 signature `SHA512(order_id + status_code + gross_amount + ServerKey)` for Midtrans notifications.
  - Protects against duplicate settlement or refund replays via `refund_${txId}` idempotency keys.
  - Atomically transitions order status to `settlement` and credits user balance using `service_role` security definer.

---

## 2. Autonomous Cloud Scheduler (Supabase `pg_cron` & `pg_net`)

To preserve zero-cost operation without requiring a Vercel Pro upgrade, sub-daily cron jobs run directly from Supabase Cloud PostgreSQL:
- **Publishing Worker:** Triggers every 5 minutes (`*/5 * * * *`) via `net.http_post()` to `/api/publishing/worker` with `Authorization: Bearer <PUBLISHING_WORKER_SECRET>`.
- **Analytics Sync Worker:** Triggers every 4 hours (`0 */4 * * *`) via `net.http_post()` to `/api/analytics/sync-worker` with `Authorization: Bearer <CRON_SECRET>`.

---

## 3. Client Service Layer (`src/lib/supabase.ts`)

### Project & World Services
- `fetchProjects(userId)`: Fetches owner projects with settings and thumbnail metadata.
- `createProjectRecord(userId, payload)`: Creates new project with default production parameters.
- `updateProjectRecord(projectId, updates)`: Updates project metadata and status.
- `deleteProjectRecord(projectId)`: Cascading delete for project assets and children.
- `fetchWorldBible(projectId)` / `saveWorldBibleRecord(projectId, payload)`: World building universe codex.

### Character Studio & Marketplace Services
- `fetchCharacters(projectId)` / `createCharacterRecord(projectId, charData)`: Character dossiers and seed prompts.
- `fetchCharacterMarketplacePacks(genre?)`: Pre-seeded character packs from community repository.
- `importCharacterPackToProject(projectId, packId)`: 1-click character import into project roster.

### Cloud Storage Services (`character-avatars` & `project-assets`)
- `uploadCharacterReferenceImage(projectId, fileOrPayload, characterName?)`: Supabase Storage upload with local fallback.
- `uploadProjectAssetToBucket(projectId, fileOrPayload, assetLabel?)`: Production asset storage.
- `listStudioBucketObjects(bucket?, projectId?)`: Storage directory listing.
