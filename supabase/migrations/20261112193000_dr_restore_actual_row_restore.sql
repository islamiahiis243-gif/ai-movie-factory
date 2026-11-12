-- Isolated disaster-recovery target schema. Never writes to public production tables.
CREATE SCHEMA IF NOT EXISTS dr_restore_test;
GRANT USAGE ON SCHEMA dr_restore_test TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.profiles (LIKE public.profiles INCLUDING ALL);
ALTER TABLE dr_restore_test.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.profiles TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.projects (LIKE public.projects INCLUDING ALL);
ALTER TABLE dr_restore_test.projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.projects FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.projects TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.project_settings (LIKE public.project_settings INCLUDING ALL);
ALTER TABLE dr_restore_test.project_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.project_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.project_settings TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.story_bibles (LIKE public.story_bibles INCLUDING ALL);
ALTER TABLE dr_restore_test.story_bibles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.story_bibles FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.story_bibles TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.characters (LIKE public.characters INCLUDING ALL);
ALTER TABLE dr_restore_test.characters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.characters FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.characters TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.story_concepts (LIKE public.story_concepts INCLUDING ALL);
ALTER TABLE dr_restore_test.story_concepts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.story_concepts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.story_concepts TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.seasons (LIKE public.seasons INCLUDING ALL);
ALTER TABLE dr_restore_test.seasons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.seasons FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.seasons TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.episodes (LIKE public.episodes INCLUDING ALL);
ALTER TABLE dr_restore_test.episodes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.episodes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.episodes TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.scenes (LIKE public.scenes INCLUDING ALL);
ALTER TABLE dr_restore_test.scenes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.scenes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.scenes TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.script_versions (LIKE public.script_versions INCLUDING ALL);
ALTER TABLE dr_restore_test.script_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.script_versions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.script_versions TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.agent_project_configs (LIKE public.agent_project_configs INCLUDING ALL);
ALTER TABLE dr_restore_test.agent_project_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.agent_project_configs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.agent_project_configs TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.production_tasks (LIKE public.production_tasks INCLUDING ALL);
ALTER TABLE dr_restore_test.production_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.production_tasks FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.production_tasks TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.agent_execution_logs (LIKE public.agent_execution_logs INCLUDING ALL);
ALTER TABLE dr_restore_test.agent_execution_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.agent_execution_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.agent_execution_logs TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.assets (LIKE public.assets INCLUDING ALL);
ALTER TABLE dr_restore_test.assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.assets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.assets TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.pipeline_jobs (LIKE public.pipeline_jobs INCLUDING ALL);
ALTER TABLE dr_restore_test.pipeline_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.pipeline_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.pipeline_jobs TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.pipeline_job_logs (LIKE public.pipeline_job_logs INCLUDING ALL);
ALTER TABLE dr_restore_test.pipeline_job_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.pipeline_job_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.pipeline_job_logs TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.export_packages (LIKE public.export_packages INCLUDING ALL);
ALTER TABLE dr_restore_test.export_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.export_packages FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.export_packages TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.subscriptions (LIKE public.subscriptions INCLUDING ALL);
ALTER TABLE dr_restore_test.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.credit_transactions (LIKE public.credit_transactions INCLUDING ALL);
ALTER TABLE dr_restore_test.credit_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.credit_transactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.credit_transactions TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.payment_orders (LIKE public.payment_orders INCLUDING ALL);
ALTER TABLE dr_restore_test.payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.payment_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.payment_orders TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.workspaces (LIKE public.workspaces INCLUDING ALL);
ALTER TABLE dr_restore_test.workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.workspaces FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.workspaces TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.workspace_members (LIKE public.workspace_members INCLUDING ALL);
ALTER TABLE dr_restore_test.workspace_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.workspace_members FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.workspace_members TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.workspace_invites (LIKE public.workspace_invites INCLUDING ALL);
ALTER TABLE dr_restore_test.workspace_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.workspace_invites FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.workspace_invites TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.marketplace_templates (LIKE public.marketplace_templates INCLUDING ALL);
ALTER TABLE dr_restore_test.marketplace_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.marketplace_templates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.marketplace_templates TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.creator_milestones (LIKE public.creator_milestones INCLUDING ALL);
ALTER TABLE dr_restore_test.creator_milestones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.creator_milestones FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.creator_milestones TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.creator_media_kits (LIKE public.creator_media_kits INCLUDING ALL);
ALTER TABLE dr_restore_test.creator_media_kits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.creator_media_kits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.creator_media_kits TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.publishing_jobs (LIKE public.publishing_jobs INCLUDING ALL);
ALTER TABLE dr_restore_test.publishing_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.publishing_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.publishing_jobs TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.platform_oauth_tokens (LIKE public.platform_oauth_tokens INCLUDING ALL);
ALTER TABLE dr_restore_test.platform_oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.platform_oauth_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.platform_oauth_tokens TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.oauth_state_transactions (LIKE public.oauth_state_transactions INCLUDING ALL);
ALTER TABLE dr_restore_test.oauth_state_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.oauth_state_transactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.oauth_state_transactions TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.creator_analytics_snapshots (LIKE public.creator_analytics_snapshots INCLUDING ALL);
ALTER TABLE dr_restore_test.creator_analytics_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.creator_analytics_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.creator_analytics_snapshots TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.creator_analytics_sync_jobs (LIKE public.creator_analytics_sync_jobs INCLUDING ALL);
ALTER TABLE dr_restore_test.creator_analytics_sync_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.creator_analytics_sync_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.creator_analytics_sync_jobs TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.credit_reservations (LIKE public.credit_reservations INCLUDING ALL);
ALTER TABLE dr_restore_test.credit_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.credit_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.credit_reservations TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ai_usage_records (LIKE public.ai_usage_records INCLUDING ALL);
ALTER TABLE dr_restore_test.ai_usage_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ai_usage_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ai_usage_records TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_channels (LIKE public.ott_channels INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_channels FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_channels TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_series (LIKE public.ott_series INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_series ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_series FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_series TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_seasons (LIKE public.ott_seasons INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_seasons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_seasons FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_seasons TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_episodes (LIKE public.ott_episodes INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_episodes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_episodes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_episodes TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_films (LIKE public.ott_films INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_films ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_films FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_films TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_cast_members (LIKE public.ott_cast_members INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_cast_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_cast_members FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_cast_members TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_access_passes (LIKE public.ott_access_passes INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_access_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_access_passes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_access_passes TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_viewer_subscriptions (LIKE public.ott_viewer_subscriptions INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_viewer_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_viewer_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_viewer_subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_playback_sessions (LIKE public.ott_playback_sessions INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_playback_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_playback_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_playback_sessions TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_payment_orders (LIKE public.ott_payment_orders INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_payment_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_payment_orders TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_payment_order_refunds (LIKE public.ott_payment_order_refunds INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_payment_order_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_payment_order_refunds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_payment_order_refunds TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.ott_transcoding_jobs (LIKE public.ott_transcoding_jobs INCLUDING ALL);
ALTER TABLE dr_restore_test.ott_transcoding_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.ott_transcoding_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.ott_transcoding_jobs TO service_role;

CREATE TABLE IF NOT EXISTS dr_restore_test.restore_audit (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  restored_at timestamptz NOT NULL DEFAULT now(),
  snapshot_timestamp text NOT NULL,
  tables_restored integer NOT NULL,
  total_rows_restored integer NOT NULL,
  checksum_verified boolean NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'SUCCESS'
);
ALTER TABLE dr_restore_test.restore_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE dr_restore_test.restore_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE dr_restore_test.restore_audit TO service_role;

CREATE OR REPLACE FUNCTION public.dr_restore_reset_target()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['profiles', 'projects', 'project_settings', 'story_bibles', 'characters', 'story_concepts', 'seasons', 'episodes', 'scenes', 'script_versions', 'agent_project_configs', 'production_tasks', 'agent_execution_logs', 'assets', 'pipeline_jobs', 'pipeline_job_logs', 'export_packages', 'subscriptions', 'credit_transactions', 'payment_orders', 'workspaces', 'workspace_members', 'workspace_invites', 'marketplace_templates', 'creator_milestones', 'creator_media_kits', 'publishing_jobs', 'platform_oauth_tokens', 'oauth_state_transactions', 'creator_analytics_snapshots', 'creator_analytics_sync_jobs', 'credit_reservations', 'ai_usage_records', 'ott_channels', 'ott_series', 'ott_seasons', 'ott_episodes', 'ott_films', 'ott_cast_members', 'ott_access_passes', 'ott_viewer_subscriptions', 'ott_playback_sessions', 'ott_payment_orders', 'ott_payment_order_refunds', 'ott_transcoding_jobs'] LOOP
    EXECUTE format('DELETE FROM dr_restore_test.%I', v_table);
  END LOOP;
  DELETE FROM dr_restore_test.restore_audit;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dr_restore_reset_target() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dr_restore_reset_target() TO service_role;

CREATE OR REPLACE FUNCTION public.dr_restore_write_table(p_table_name text, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE v_columns text; v_count integer; v_expected integer;
BEGIN
  IF p_table_name IS NULL OR NOT (p_table_name = ANY (ARRAY['profiles', 'projects', 'project_settings', 'story_bibles', 'characters', 'story_concepts', 'seasons', 'episodes', 'scenes', 'script_versions', 'agent_project_configs', 'production_tasks', 'agent_execution_logs', 'assets', 'pipeline_jobs', 'pipeline_job_logs', 'export_packages', 'subscriptions', 'credit_transactions', 'payment_orders', 'workspaces', 'workspace_members', 'workspace_invites', 'marketplace_templates', 'creator_milestones', 'creator_media_kits', 'publishing_jobs', 'platform_oauth_tokens', 'oauth_state_transactions', 'creator_analytics_snapshots', 'creator_analytics_sync_jobs', 'credit_reservations', 'ai_usage_records', 'ott_channels', 'ott_series', 'ott_seasons', 'ott_episodes', 'ott_films', 'ott_cast_members', 'ott_access_passes', 'ott_viewer_subscriptions', 'ott_playback_sessions', 'ott_payment_orders', 'ott_payment_order_refunds', 'ott_transcoding_jobs'])) THEN
    RAISE EXCEPTION 'table is not allow-listed for restore: %', p_table_name;
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;
  v_expected := jsonb_array_length(p_rows);
  IF v_expected = 0 THEN RETURN 0; END IF;
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO v_columns
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = format('dr_restore_test.%I', p_table_name)::regclass
    AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';
  IF v_columns IS NULL THEN RAISE EXCEPTION 'no writable columns found for table %', p_table_name; END IF;
  EXECUTE format(
    'INSERT INTO dr_restore_test.%I (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::dr_restore_test.%I, $1)',
    p_table_name, v_columns, v_columns, p_table_name
  ) USING p_rows;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> v_expected THEN
    RAISE EXCEPTION 'restore row count mismatch for %: expected %, inserted %', p_table_name, v_expected, v_count;
  END IF;
  RETURN v_count;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dr_restore_write_table(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dr_restore_write_table(text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.dr_restore_verify_counts(p_expected jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE v_table text; v_actual bigint; v_expected_count bigint; v_result jsonb := '{}'::jsonb;
BEGIN
  IF jsonb_typeof(p_expected) <> 'object' THEN RAISE EXCEPTION 'expected counts must be a JSON object'; END IF;
  FOREACH v_table IN ARRAY ARRAY['profiles', 'projects', 'project_settings', 'story_bibles', 'characters', 'story_concepts', 'seasons', 'episodes', 'scenes', 'script_versions', 'agent_project_configs', 'production_tasks', 'agent_execution_logs', 'assets', 'pipeline_jobs', 'pipeline_job_logs', 'export_packages', 'subscriptions', 'credit_transactions', 'payment_orders', 'workspaces', 'workspace_members', 'workspace_invites', 'marketplace_templates', 'creator_milestones', 'creator_media_kits', 'publishing_jobs', 'platform_oauth_tokens', 'oauth_state_transactions', 'creator_analytics_snapshots', 'creator_analytics_sync_jobs', 'credit_reservations', 'ai_usage_records', 'ott_channels', 'ott_series', 'ott_seasons', 'ott_episodes', 'ott_films', 'ott_cast_members', 'ott_access_passes', 'ott_viewer_subscriptions', 'ott_playback_sessions', 'ott_payment_orders', 'ott_payment_order_refunds', 'ott_transcoding_jobs'] LOOP
    IF NOT (p_expected ? v_table) THEN RAISE EXCEPTION 'missing expected row count for %', v_table; END IF;
    v_expected_count := (p_expected ->> v_table)::bigint;
    EXECUTE format('SELECT count(*) FROM dr_restore_test.%I', v_table) INTO v_actual;
    IF v_actual <> v_expected_count THEN
      RAISE EXCEPTION 'restore verification mismatch for %: expected %, actual %', v_table, v_expected_count, v_actual;
    END IF;
    v_result := v_result || jsonb_build_object(v_table, v_actual);
  END LOOP;
  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dr_restore_verify_counts(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dr_restore_verify_counts(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.dr_restore_write_audit(
  p_snapshot_timestamp text,p_tables_restored integer,p_total_rows_restored integer,p_checksum_verified boolean,p_source text
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO dr_restore_test.restore_audit
    (snapshot_timestamp,tables_restored,total_rows_restored,checksum_verified,source,status)
  VALUES (p_snapshot_timestamp,p_tables_restored,p_total_rows_restored,p_checksum_verified,p_source,'SUCCESS')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.dr_restore_write_audit(text,integer,integer,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dr_restore_write_audit(text,integer,integer,boolean,text) TO service_role;
