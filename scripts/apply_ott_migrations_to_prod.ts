/**
 * Production Migration Applier for Phase 6 OTT
 * Connects directly to Supabase Management API using SUPABASE_ACCESS_TOKEN
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';

async function executeSql(sql: string, description: string) {
  console.log(`\nExecuting: ${description}...`);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN must be set in environment.');
  }
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'jixfakvbhugpypjtyshq';

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Migration error (${res.status}): ${errorText}`);
  }

  const result = await res.json();
  console.log(`✔ Success: ${description}`);
  return result;
}

async function main() {
  try {
    // 1. Apply remaining upgrade_v3_14 triggers and RLS policies
    const v314Sql = `
    DROP TRIGGER IF EXISTS trg_ott_channels_updated_at ON public.ott_channels;
    CREATE TRIGGER trg_ott_channels_updated_at BEFORE UPDATE ON public.ott_channels FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    DROP TRIGGER IF EXISTS trg_ott_series_updated_at ON public.ott_series;
    CREATE TRIGGER trg_ott_series_updated_at BEFORE UPDATE ON public.ott_series FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    DROP TRIGGER IF EXISTS trg_ott_seasons_updated_at ON public.ott_seasons;
    CREATE TRIGGER trg_ott_seasons_updated_at BEFORE UPDATE ON public.ott_seasons FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    DROP TRIGGER IF EXISTS trg_ott_episodes_updated_at ON public.ott_episodes;
    CREATE TRIGGER trg_ott_episodes_updated_at BEFORE UPDATE ON public.ott_episodes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    DROP TRIGGER IF EXISTS trg_ott_films_updated_at ON public.ott_films;
    CREATE TRIGGER trg_ott_films_updated_at BEFORE UPDATE ON public.ott_films FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

    CREATE OR REPLACE FUNCTION public.check_ott_master_approval_before_publishing()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
        IF NEW.publication_status = 'published' THEN
            IF NEW.master_approval_status != 'GATE_5_APPROVED' THEN
                RAISE EXCEPTION 'Item katalog tidak dapat dipublikasikan tanpa persetujuan final Gate 5 (master_approval_status = GATE_5_APPROVED). Status saat ini: %', NEW.master_approval_status;
            END IF;
            IF NEW.master_video_url IS NULL OR NEW.master_video_url = '' THEN
                RAISE EXCEPTION 'Item katalog tidak dapat dipublikasikan tanpa referensi file master video yang valid.';
            END IF;
            IF NEW.published_at IS NULL THEN
                NEW.published_at = now();
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_ott_episodes_publication_guard ON public.ott_episodes;
    CREATE TRIGGER trg_ott_episodes_publication_guard BEFORE INSERT OR UPDATE ON public.ott_episodes FOR EACH ROW EXECUTE FUNCTION public.check_ott_master_approval_before_publishing();

    DROP TRIGGER IF EXISTS trg_ott_films_publication_guard ON public.ott_films;
    CREATE TRIGGER trg_ott_films_publication_guard BEFORE INSERT OR UPDATE ON public.ott_films FOR EACH ROW EXECUTE FUNCTION public.check_ott_master_approval_before_publishing();

    ALTER TABLE public.ott_channels ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ott_series ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ott_seasons ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ott_episodes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ott_films ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ott_cast_members ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Channel owner full access" ON public.ott_channels;
    CREATE POLICY "Channel owner full access" ON public.ott_channels FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Public read active channels" ON public.ott_channels;
    CREATE POLICY "Public read active channels" ON public.ott_channels FOR SELECT USING (status = 'active');

    DROP POLICY IF EXISTS "Series owner full access" ON public.ott_series;
    CREATE POLICY "Series owner full access" ON public.ott_series FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Public read published series" ON public.ott_series;
    CREATE POLICY "Public read published series" ON public.ott_series FOR SELECT USING (publication_status = 'published');

    DROP POLICY IF EXISTS "Seasons owner full access" ON public.ott_seasons;
    CREATE POLICY "Seasons owner full access" ON public.ott_seasons FOR ALL USING (EXISTS (SELECT 1 FROM public.ott_series WHERE ott_series.id = ott_seasons.series_id AND ott_series.user_id = auth.uid()));

    DROP POLICY IF EXISTS "Public read published seasons" ON public.ott_seasons;
    CREATE POLICY "Public read published seasons" ON public.ott_seasons FOR SELECT USING (publication_status = 'published');

    DROP POLICY IF EXISTS "Episodes owner full access" ON public.ott_episodes;
    CREATE POLICY "Episodes owner full access" ON public.ott_episodes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Public read published episodes" ON public.ott_episodes;
    CREATE POLICY "Public read published episodes" ON public.ott_episodes FOR SELECT USING (publication_status = 'published');

    DROP POLICY IF EXISTS "Films owner full access" ON public.ott_films;
    CREATE POLICY "Films owner full access" ON public.ott_films FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Public read published films" ON public.ott_films;
    CREATE POLICY "Public read published films" ON public.ott_films FOR SELECT USING (publication_status = 'published');

    DROP POLICY IF EXISTS "Cast owner full access" ON public.ott_cast_members;
    CREATE POLICY "Cast owner full access" ON public.ott_cast_members FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Public read cast members" ON public.ott_cast_members;
    CREATE POLICY "Public read cast members" ON public.ott_cast_members FOR SELECT USING (true);
    `;

    await executeSql(v314Sql, 'upgrade_v3_14 Triggers & RLS Policies');

    // 2. Apply upgrade_v3_15
    const v315Path = path.resolve(process.cwd(), 'supabase/upgrade_v3_15_ott_entitlement_engine.sql');
    const v315Sql = fs.readFileSync(v315Path, 'utf-8');
    await executeSql(v315Sql, 'upgrade_v3_15_ott_entitlement_engine.sql');

    // 3. Verify in production DB
    const verifySql = `
      SELECT table_name, (
        SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name
      ) AS column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_name IN ('ott_channels', 'ott_series', 'ott_seasons', 'ott_episodes', 'ott_films', 'ott_cast_members', 'ott_access_passes', 'ott_viewer_subscriptions')
      ORDER BY table_name;
    `;
    const checkResult = await executeSql(verifySql, 'Verify OTT Tables in Supabase Production');
    console.log('\n--- Production Verification Result ---');
    console.table(checkResult);

  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

main();
