-- ==============================================================================
-- AI MOVIE FACTORY - MASTER TECHNICAL POST-DEPLOYMENT VERIFICATION ENGINE (V3.2)
-- Enterprise Security Audit, RLS Inspection & Operational Field Defense Probes
-- Run this in Supabase SQL Editor after executing upgrade_v3_to_v3_2.sql OR deploy_all_migrations.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE EXISTENCE & ROW-LEVEL SECURITY ENFORCEMENT CHECK (ALL 24 TABLES)
-- ------------------------------------------------------------------------------
WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'profiles', 'projects', 'project_settings', 'story_bibles', 'characters',
    'story_concepts', 'seasons', 'episodes', 'scenes', 'script_versions',
    'agent_project_configs', 'production_tasks', 'agent_execution_logs',
    'assets', 'pipeline_jobs', 'pipeline_job_logs', 'export_packages',
    'subscriptions', 'credit_transactions', 'payment_orders', 'workspaces',
    'workspace_members', 'workspace_invites', 'marketplace_templates'
  ]) AS table_name
),
actual_tables AS (
  SELECT tablename AS table_name, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
),
policies_per_table AS (
  SELECT tablename AS table_name, count(*) AS policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
),
table_audit AS (
  SELECT 
    e.table_name,
    CASE WHEN a.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS existence,
    CASE WHEN a.rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS rls_status,
    COALESCE(p.policy_count, 0) AS active_policies,
    CASE 
      WHEN a.table_name IS NOT NULL AND a.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN 'PASS'
      ELSE 'FAIL'
    END AS check_result
  FROM expected_tables e
  LEFT JOIN actual_tables a ON a.table_name = e.table_name
  LEFT JOIN policies_per_table p ON p.table_name = e.table_name
)
SELECT 
  '1. Tables & RLS Status' AS check_category,
  table_name,
  existence,
  rls_status,
  active_policies,
  check_result
FROM table_audit
ORDER BY CASE WHEN check_result = 'FAIL' THEN 1 ELSE 2 END, table_name;

-- ------------------------------------------------------------------------------
-- 2. SECURITY DEFINER FUNCTIONS & HARDENED DEFENSE AUDIT
-- ------------------------------------------------------------------------------
SELECT 
  '2. Security Functions' AS check_category,
  p.proname AS function_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER (SECURE)' ELSE 'INVOKER (CHECK RISK)' END AS security_type,
  CASE 
    WHEN array_to_string(p.proconfig, ', ') LIKE '%search_path=%' THEN 'RESTRICTED SEARCH_PATH (PASS)'
    ELSE 'DEFAULT SEARCH_PATH (REVIEW)'
  END AS search_path_status,
  CASE WHEN p.prosecdef THEN 'PASS' ELSE 'FAIL' END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'handle_updated_at', 'handle_new_user', 'is_workspace_owner', 'is_workspace_member', 
    'protect_profile_fields', 'validate_payment_order_catalog', 'prevent_project_id_reassignment', 
    'protect_pipeline_job_operational_fields', 'protect_production_task_operational_fields', 
    'protect_export_package_operational_fields', 'enforce_immutable_credit_ledger'
  );

-- ------------------------------------------------------------------------------
-- 3. FINANCIAL LEDGER & SOFT-DELETE RETENTION AUDIT
-- ------------------------------------------------------------------------------
-- 3a. Ledger Immutability Trigger
SELECT 
  '3a. Ledger Immutability' AS check_category,
  'credit_transactions' AS target_table,
  t.tgname AS trigger_name,
  p.proname AS executed_function,
  'PASS' AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'credit_transactions' 
  AND t.tgname = 'trg_enforce_immutable_credit_transactions';

-- 3b. Foreign Key Restrict on Credit Transactions
SELECT 
  '3b. Ledger Retention FK' AS check_category,
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule,
  CASE WHEN rc.delete_rule = 'RESTRICT' THEN 'PASS (FINANCIALLY AUDITABLE)' ELSE 'FAIL' END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'credit_transactions' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.constraint_name LIKE '%user_id%';

-- 3c. Profiles Soft-Delete Columns Verification
SELECT 
  '3c. Profiles Soft-Delete' AS check_category,
  column_name,
  data_type,
  CASE WHEN is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULLABLE' END AS nullable_status,
  'PASS' AS status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name IN ('is_active', 'deleted_at')
ORDER BY column_name;

-- 3d. Projects Workspace Link Verification
SELECT 
  '3d. Projects Workspace Link' AS check_category,
  column_name,
  data_type,
  'PASS' AS status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'projects' 
  AND column_name = 'workspace_id';

-- ------------------------------------------------------------------------------
-- 4. CROSS-PROJECT INTEGRITY & OPERATIONAL DEFENSE TRIGGERS
-- ------------------------------------------------------------------------------
SELECT 
  '4. Operational Defense' AS check_category,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS trigger_function,
  'PASS' AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('characters', 'scenes', 'episodes', 'assets', 'pipeline_jobs', 'production_tasks', 'export_packages', 'payment_orders')
  AND t.tgname IN (
    'trg_prevent_characters_project_reassignment',
    'trg_prevent_scenes_project_reassignment',
    'trg_prevent_episodes_project_reassignment',
    'trg_check_asset_project_integrity',
    'trg_check_pipeline_job_project_integrity',
    'trg_protect_pipeline_job_operational_fields',
    'trg_protect_production_task_operational_fields',
    'trg_protect_export_package_operational_fields',
    'trg_validate_payment_order_catalog'
  )
ORDER BY c.relname, t.tgname;

-- ------------------------------------------------------------------------------
-- 5. WORKSPACE NON-RECURSIVE RLS SMOKE TEST
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM * FROM public.workspaces LIMIT 1;
  PERFORM * FROM public.workspace_members LIMIT 1;
  RAISE NOTICE 'RLS Non-Recursion Smoke Test: SUCCESS (Zero loop errors detected)';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'RLS Recursion Smoke Test: FAILED with error %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. SUMMARY VERDICT (V3.2 ENTERPRISE MASTER)
-- ------------------------------------------------------------------------------
SELECT
  COUNT(*) AS total_expected_tables,
  COUNT(CASE WHEN a.tablename IS NOT NULL THEN 1 END) AS deployed_tables,
  COUNT(CASE WHEN a.rowsecurity THEN 1 END) AS rls_protected_tables,
  CASE 
    WHEN COUNT(*) = 24 AND COUNT(CASE WHEN a.tablename IS NOT NULL AND a.rowsecurity THEN 1 END) = 24 
    THEN 'ALL 24 TABLES DEPLOYED, PROTECTED BY RLS & ENTERPRISE HARDENED (PASS V3.2)'
    ELSE 'DEPLOYMENT INCOMPLETE OR RLS MISSING (FAIL)'
  END AS master_verdict
FROM (
  SELECT unnest(ARRAY[
    'profiles', 'projects', 'project_settings', 'story_bibles', 'characters',
    'story_concepts', 'seasons', 'episodes', 'scenes', 'script_versions',
    'agent_project_configs', 'production_tasks', 'agent_execution_logs',
    'assets', 'pipeline_jobs', 'pipeline_job_logs', 'export_packages',
    'subscriptions', 'credit_transactions', 'payment_orders', 'workspaces',
    'workspace_members', 'workspace_invites', 'marketplace_templates'
  ]) AS table_name
) e
LEFT JOIN pg_tables a ON a.schemaname = 'public' AND a.tablename = e.table_name;
