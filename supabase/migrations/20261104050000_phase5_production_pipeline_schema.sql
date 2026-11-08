-- ============================================================================
-- Phase 5: Production Pipeline, Autonomous Queue & Automated QC Schema Migration
-- AI Movie Factory - SSOT Sections 14, 15, 40
-- ============================================================================

-- Table 1: public.pipeline_jobs
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
    scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
    job_title TEXT NOT NULL,
    current_stage TEXT NOT NULL DEFAULT 'script_prep',
    status TEXT NOT NULL DEFAULT 'queued',
    priority TEXT NOT NULL DEFAULT 'normal',
    progress INTEGER NOT NULL DEFAULT 0,
    stages_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
    qc_report JSONB,
    generated_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    credit_cost INTEGER NOT NULL DEFAULT 15,
    error_message TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table 2: public.pipeline_job_logs
CREATE TABLE IF NOT EXISTS public.pipeline_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.pipeline_jobs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Table 3: public.export_packages
CREATE TABLE IF NOT EXISTS public.export_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
    scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
    package_title TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'mp4',
    resolution TEXT NOT NULL DEFAULT '1080p',
    framerate TEXT NOT NULL DEFAULT '24fps',
    audio_channels TEXT NOT NULL DEFAULT 'Stereo 2.0',
    include_subtitles BOOLEAN NOT NULL DEFAULT true,
    subtitle_format TEXT NOT NULL DEFAULT 'srt',
    subtitles_content TEXT,
    file_url TEXT NOT NULL,
    file_size_mb NUMERIC(8,2) NOT NULL DEFAULT 42.50,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_project_id ON public.pipeline_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status ON public.pipeline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_scene_id ON public.pipeline_jobs(scene_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_job_logs_job_id ON public.pipeline_job_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_export_packages_project_id ON public.export_packages(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies tied to project ownership
CREATE POLICY "Users can manage pipeline_jobs for their projects"
    ON public.pipeline_jobs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pipeline_jobs.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage pipeline_job_logs for their projects"
    ON public.pipeline_job_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = pipeline_job_logs.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage export_packages for their projects"
    ON public.export_packages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = export_packages.project_id
            AND projects.user_id = auth.uid()
        )
    );
