-- ============================================================================
-- AI MOVIE FACTORY - PHASE 3 DATABASE MIGRATION
-- AI AGENT SYSTEM: AGENT CONFIGS, PRODUCTION TASKS, EXECUTION LOGS
-- Reference: SSOT Sections 12 & 38
-- ============================================================================

-- 1. AGENT PROJECT CONFIGS TABLE
CREATE TABLE IF NOT EXISTS public.agent_project_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_role TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    selected_model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    custom_instructions TEXT NOT NULL DEFAULT '',
    credit_limit_per_run INTEGER NOT NULL DEFAULT 50,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    execution_priority INTEGER NOT NULL DEFAULT 1,
    total_runs INTEGER NOT NULL DEFAULT 0,
    total_credits_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(project_id, agent_role)
);

-- 2. PRODUCTION TASKS TABLE
CREATE TABLE IF NOT EXISTS public.production_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    workflow_type TEXT NOT NULL DEFAULT 'manual',
    task_name TEXT NOT NULL,
    agent_role TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled')),
    progress INTEGER NOT NULL DEFAULT 0,
    input_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_result JSONB,
    error_message TEXT,
    requires_human_approval BOOLEAN NOT NULL DEFAULT true,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_time_seconds INTEGER NOT NULL DEFAULT 0,
    credits_consumed INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. AGENT EXECUTION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.production_tasks(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_role TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'reasoning', 'action', 'approval_required', 'success', 'error')),
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.agent_project_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage agent configurations for their projects"
    ON public.agent_project_configs FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_project_configs.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can manage production tasks for their projects"
    ON public.production_tasks FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = production_tasks.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can view execution logs for their projects"
    ON public.agent_execution_logs FOR ALL
    USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = agent_execution_logs.project_id AND projects.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER set_timestamp_agent_project_configs
    BEFORE UPDATE ON public.agent_project_configs
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
