# AI Movie Factory - Comprehensive Database Audit & Migration Safety Review

**Auditor:** Senior Database Architect & Security Specialist  
**Document Version:** 2.0 (Post-Audit Master Release)  
**Target Environment:** Supabase Cloud PostgreSQL 15+ / PostgREST 12+  
**Target Project:** `jixfakvbhugpypjtyshq` (`https://jixfakvbhugpypjtyshq.supabase.co`)  
**Deployment File:** `supabase/deploy_all_migrations.sql`  
**Verification File:** `supabase/verify_deployment.sql`  

---

## 1. Executive Summary

A comprehensive forensic audit of the AI Movie Factory master consolidated migration script was performed. The inspection revealed that while the underlying schema design correctly mirrors the 24-table architecture specified in the SSOT, the previous consolidated script contained **critical syntax errors, missing functions, and high-risk security permissions**:

1. **Missing Functions:** Undefined functions (`public.trigger_set_timestamp` and `update_updated_at_column`) would have caused the SQL migration to abort immediately with fatal errors upon execution.
2. **Non-Idempotent Statements:** All 40 `CREATE POLICY` statements lacked conditional drops, guaranteeing fatal crashes if re-executed after any partial failure.
3. **Privilege Escalation Risk:** `public.subscriptions` and `public.credit_transactions` were configured with `FOR ALL` access, which would allow client-side requests to directly modify credit balances or grant unlimited subscriptions.
4. **Destructive Warning Origin:** Supabase displayed a "destructive operations" warning dialog because the script contained `ALTER TABLE profiles DROP CONSTRAINT` and raw `DROP` keywords.

All identified defects have been systematically corrected in `supabase/deploy_all_migrations.sql` (V2.0).

---

## 2. Problem Classification by Severity

### A. CRITICAL (Fatal Execution Blockers)
* **Undefined Trigger Functions (Lines 502, 506, 510, 514, 599, 642):**
  - Triggers on `story_concepts`, `seasons`, `episodes`, `scenes`, `agent_project_configs`, and `assets` called non-existent functions `public.trigger_set_timestamp()` and `update_updated_at_column()`.
  - *Fix Applied:* Replaced all disparate trigger calls with a single, hardened `public.handle_updated_at()` function. Added a backward-compatible alias `public.trigger_set_timestamp()` to prevent regressions.
* **Non-Idempotent Policy Creation (40 Policies):**
  - PostgreSQL does not support `CREATE POLICY IF NOT EXISTS`. Re-running the script would trigger `ERROR: policy "..." for relation "..." already exists`.
  - *Fix Applied:* Preceded every single `CREATE POLICY` statement with an explicit `DROP POLICY IF EXISTS "<name>" ON public.<table_name>;`.
* **Non-Idempotent Triggers:**
  - Multiple triggers lacked `DROP TRIGGER IF EXISTS` guards.
  - *Fix Applied:* Standardized all 11 automated timestamp triggers with `DROP TRIGGER IF EXISTS <name> ON <table_name>;`.

### B. HIGH (Security & Financial Integrity Vulnerabilities)
* **Excessive `FOR ALL` Permission on `public.credit_transactions`:**
  - The previous policy permitted authenticated users to `INSERT`, `UPDATE`, and `DELETE` their own ledger transactions. An attacker could forge transactions, alter `balance_after`, or erase debit logs.
  - *Fix Applied:* Restricted client access strictly to `FOR SELECT USING (auth.uid() = user_id)`. `credit_transactions` is now an immutable ledger that can only be written by backend service roles.
* **Excessive `FOR ALL` Permission on `public.subscriptions`:**
  - Allowed client users to execute `UPDATE subscriptions SET tier = 'production_house', credits_allotted = 100000`.
  - *Fix Applied:* Restricted client access strictly to `FOR SELECT USING (auth.uid() = user_id)`. Upgrades require verified payment gateway webhooks.
* **Unrestricted `payment_orders` Mutations:**
  - Allowed client users to arbitrarily change order status to `paid`.
  - *Fix Applied:* Split into two distinct granular policies:
    - `FOR SELECT USING (auth.uid() = user_id)`
    - `FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending')`
* **`public.handle_new_user()` Security Definer Hardening:**
  - Did not specify `SET search_path = public, auth`, leaving it vulnerable to malicious search_path exploitation.
  - Would throw null-constraint violations if `NEW.email` was null (e.g. phone/anonymous OAuth).
  - *Fix Applied:* Added `SET search_path = public, auth`, defensive `COALESCE` with unique fallback names (`Creator_<uuid_prefix>`), and `ON CONFLICT (id) DO UPDATE` to gracefully handle duplicate registration events.

### C. MEDIUM (Destructive Operation Warnings & Redundancies)
* **The Supabase Destructive Operation Warning:**
  - Supabase's SQL editor uses heuristic scanners that trigger the red destructive warning on any query containing `DROP ...`, `ALTER TABLE ... DROP CONSTRAINT`, or `SECURITY DEFINER`.
  - In the previous script, an unnecessary `ALTER TABLE public.profiles DROP CONSTRAINT profiles_preferred_language_check` was run at the very end.
  - *Fix Applied:* Defined `public.profiles` correctly in Phase 1 with `preferred_language IN ('id', 'en', 'zh', 'ja', 'es')`, eliminating the late drop constraint and keeping the schema clean.

---

## 3. Database State and Backup Assessment

### Question 1: What is the current database condition?
**Answer: A. New database, no important existing data.**
*Technical Proof:* A live REST query against the project endpoint `https://jixfakvbhugpypjtyshq.supabase.co/rest/v1/projects?select=count` returned:
```json
{"code":"PGRST205","message":"Could not find the table 'public.projects' in the schema cache"}
```
This confirms that PostgREST connects to an empty database with no application tables initialized. There are zero existing project records, story bibles, or character files at risk of being lost or overwritten.

### Question 2: Is there a verified database backup?
**Answer: B. No, there is no application backup, but none is needed for this new database.**
Because the application tables have not yet been deployed, there is no historical creator data to back up. Once deployed, Supabase automatically provides automated daily backups and WAL archives.

---

## 4. Complete 24-Table Architecture & TypeScript Model Compatibility

All 24 relational tables in `supabase/deploy_all_migrations.sql` map 1:1 with `src/types/database.ts`:

| # | Table Name | Development Phase | Primary Purpose | Foreign Key Relationships |
|---|---|---|---|---|
| 1 | `profiles` | Phase 1: Foundation | User identity, preferences | References `auth.users(id) ON DELETE CASCADE` |
| 2 | `projects` | Phase 1: Foundation | Master film/drama containers | References `profiles(id) ON DELETE CASCADE` |
| 3 | `project_settings` | Phase 1: Foundation | 15 Section 49 parameters | References `projects(id) ON DELETE CASCADE` (1:1 UNIQUE) |
| 4 | `story_bibles` | Phase 2A: World Builder | Universe lore, cultivation | References `projects(id) ON DELETE CASCADE` (1:1 UNIQUE) |
| 5 | `characters` | Phase 2A: Characters | Biometric dossiers & prompts | References `projects(id) ON DELETE CASCADE` |
| 6 | `story_concepts` | Phase 2B: Screenplay | Logline, synopsis, frameworks | References `projects(id) ON DELETE CASCADE` (1:1 UNIQUE) |
| 7 | `seasons` | Phase 2B: Screenplay | Season hierarchy | References `projects(id) ON DELETE CASCADE` |
| 8 | `episodes` | Phase 2B: Screenplay | Episode hierarchy | References `seasons(id) ON DELETE CASCADE` |
| 9 | `scenes` | Phase 2B: Screenplay | Shot-ready screenplay blocks | References `episodes(id) ON DELETE CASCADE` |
| 10 | `script_versions` | Phase 2B: Screenplay | Version snapshots & rollback | References `scenes(id) ON DELETE CASCADE` |
| 11 | `agent_project_configs` | Phase 3: AI Agents | 14 Specialized AI Agent configs | References `projects(id) ON DELETE CASCADE` |
| 12 | `production_tasks` | Phase 3: AI Agents | Orchestrated execution tasks | References `projects(id) ON DELETE CASCADE` |
| 13 | `agent_execution_logs` | Phase 3: AI Agents | Live execution telemetry | References `production_tasks(id) ON DELETE CASCADE` |
| 14 | `assets` | Phase 4: Media Studio | Central Asset Library | References `projects(id)`, `scenes(id)`, `characters(id)` |
| 15 | `pipeline_jobs` | Phase 5: Pipeline | Scene-level rendering jobs | References `projects(id)`, `scenes(id)` |
| 16 | `pipeline_job_logs` | Phase 5: Pipeline | Step-by-step rendering logs | References `pipeline_jobs(id) ON DELETE CASCADE` |
| 17 | `export_packages` | Phase 5: Pipeline | Subtitles, MP4 & ProRes renders | References `projects(id) ON DELETE CASCADE` |
| 18 | `subscriptions` | Phase 6: Commercial | 4-tier SaaS billing records | References `profiles(id) ON DELETE CASCADE` |
| 19 | `credit_transactions` | Phase 6: Commercial | Immutable auditable ledger | References `profiles(id) ON DELETE CASCADE` |
| 20 | `payment_orders` | Phase 6: Commercial | Midtrans & Stripe orders | References `profiles(id) ON DELETE CASCADE` |
| 21 | `workspaces` | Phase 7: Collaboration | Multi-seat studio containers | References `profiles(id) ON DELETE CASCADE` |
| 22 | `workspace_members` | Phase 7: Collaboration | RBAC (Owner/Director/Writer) | References `workspaces(id)`, `profiles(id)` |
| 23 | `workspace_invites` | Phase 7: Collaboration | Seat invitation tokens | References `workspaces(id)`, `profiles(id)` |
| 24 | `marketplace_templates` | Phase 7: Marketplace | Community universe bibles | Public read discovery |

---

## 5. Step-by-Step Deployment Guide (Non-Technical)

### Step 1: Open the SQL Editor in Supabase
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard/project/jixfakvbhugpypjtyshq).
2. On the left navigation bar, click the **SQL Editor** icon (represented by the `>_` terminal symbol).
3. Click the **New Query** button in the top left.

### Step 2: Paste the Corrected Migration Script
1. Open the file `supabase/deploy_all_migrations.sql` in your AI Movie Factory workspace.
2. Select all text (`Ctrl+A` or `Cmd+A`) and copy it (`Ctrl+C` or `Cmd+C`).
3. Paste it directly into the Supabase SQL Editor query box.

### Step 3: Run the Script
1. Click the green **Run** button (or press `Ctrl+Enter` / `Cmd+Enter`).
2. *Note regarding the Supabase Warning:* If Supabase displays the yellow warning dialog ("This query includes destructive operations..."), click **Run Query**. This dialog is triggered purely because the script includes safe `DROP TRIGGER IF EXISTS` and `DROP POLICY IF EXISTS` statements designed to guarantee that the script can be re-run without errors.
3. You should see: **`Success. No rows returned`** in under 3 seconds.

### Step 4: Verify with the Post-Deployment Script
1. In the Supabase SQL Editor, click **New Query**.
2. Copy the contents of `supabase/verify_deployment.sql`.
3. Paste into the editor and click **Run**.
4. The output will return a 24-row audit table showing:
   ```
   overall_status: ALL 24 TABLES DEPLOYED & PROTECTED BY RLS (PASS)
   ```

### Step 5: Verify in AI Movie Factory
1. Return to AI Movie Factory in your browser.
2. Navigate to **Settings** and click **Uji Koneksi Supabase**.
3. The badge will confirm: **`Koneksi Supabase Cloud terverifikasi dan aktif! Tabel "projects" aktif dengan Row-Level Security`**.
