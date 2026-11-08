# AI Movie Factory - API & Service Layer Documentation

Document Version: 3.0 (`v1.13.0`)  
Reference: SSOT Part 7 (Sections 16–18), Part 9 (Sections 21–22), Part 15 (Section 45)

---

## 1. Vercel Serverless Backend APIs (`api/`)

### `GET /api/health` (`api/health.ts`)
- **Purpose:** Production readiness probe and environment configuration audit.
- **Security:** Never exposes secret values; returns boolean availability flags (`supabasePublicClient`, `supabaseServiceRoleServerOnly`, `geminiServerProxy`, `midtransWebhookVerifier`, `stripeWebhookVerifier`) and SSOT V3.2 schema metadata.

### `POST /api/ai-generate` (`api/ai-generate.ts`)
- **Purpose:** Server-side AI orchestration proxy keeping `GEMINI_API_KEY` isolated from browser bundles.
- **Request Body:** `{ operation: 'script_outline' | 'character_seed' | 'continuity_audit' | 'shot_prompt', prompt: string, model?: string, systemInstruction?: string }`
- **Response:** `{ status: 'completed', operation, provider: 'google_gemini', model, output: string, timestamp: string }`

### `POST /api/payment-webhook` (`api/payment-webhook.ts`)
- **Purpose:** Verified server-side webhook receiver for Midtrans (`SHA-512` signature check via `verifyMidtransSignature`) and Stripe.
- **Security:** Uses `SUPABASE_SECRET_KEY` (`service_role`) on the server to transition `public.payment_orders` from `'pending'` to `'settlement'` and append an immutable credit record to `public.credit_transactions`.

---

## 2. Application Service Layer (`src/lib/supabase.ts`)

### Project & Universe Services
- `fetchProjects(userId)` / `createProjectRecord(userId, payload)` / `updateProjectRecord(projectId, updates)` / `deleteProjectRecord(projectId)`
- `fetchWorldBible(projectId)` / `saveWorldBibleRecord(projectId, payload)`

### Character Studio & Marketplace Services
- `fetchCharacters(projectId)` / `createCharacterRecord(projectId, charData)` / `updateCharacterRecord(characterId, updates)` / `deleteCharacterRecord(characterId)`
- `fetchCharacterMarketplacePacks(genre?)` / `importCharacterPackToProject(projectId, packId, specificCharacterId?)` / `publishCharacterPackToMarketplace(payload)`

### Cloud Storage Bucket Services (`character-avatars` & `project-assets`)
- `uploadCharacterReferenceImage(projectId, fileOrPayload, characterName?)`
- `uploadProjectAssetToBucket(projectId, fileOrPayload, assetLabel?)`
- `listStudioBucketObjects(bucket?, projectId?)`
