import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Project,
  AgentProjectConfig,
  AgentTask,
  AgentExecutionLog,
  AgentTaskStatus,
  WorkflowExecutionPlan,
  AgentRole,
} from '../../types/database';
import {
  AGENTS_REGISTRY,
  AGENT_CATEGORIES,
  WORKFLOW_PLANS,
  getAgentDefinition,
} from '../../lib/agentsRegistry';
import {
  fetchProjectAgents,
  updateProjectAgentConfig,
  resetProjectAgentsToDefault,
  fetchProductionTasks,
  createProductionTask,
  updateProductionTask,
  cancelProductionTask,
  retryProductionTask,
  approveProductionTask,
  fetchTaskLogs,
  createTaskLog,
} from '../../lib/supabase';
import { AgentConfigModal } from './AgentConfigModal';
import { translations } from '../../lib/translations';

interface AgentManagerViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  currentLang: 'id' | 'en';
}

export const AgentManagerView: React.FC<AgentManagerViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  currentLang,
}) => {
  const t = translations[currentLang];
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const [activeTab, setActiveTab] = useState<'orchestrator' | 'agents' | 'logs'>('orchestrator');
  const [configs, setConfigs] = useState<AgentProjectConfig[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [logs, setLogs] = useState<AgentExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filters
  const [agentCategoryFilter, setAgentCategoryFilter] = useState<string>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);

  // Modal State
  const [editingAgentRole, setEditingAgentRole] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Workflow running state
  const [isLaunchingWorkflow, setIsLaunchingWorkflow] = useState(false);

  // Load project agents, tasks, and logs
  const loadData = async (projectId: string) => {
    setIsLoading(true);
    try {
      const [agentRes, taskRes, logRes] = await Promise.all([
        fetchProjectAgents(projectId),
        fetchProductionTasks(projectId),
        fetchTaskLogs(projectId),
      ]);

      if (agentRes.data) setConfigs(agentRes.data);
      if (taskRes.data) setTasks(taskRes.data);
      if (logRes.data) setLogs(logRes.data);
    } catch (err) {
      console.error('Error loading agent manager data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeProject) {
      loadData(activeProject.id);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    if (autoScrollLogs && logsEndRef.current && activeTab === 'logs') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScrollLogs, activeTab]);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Agent Config Handlers
  const handleSaveConfig = async (role: string, updates: Partial<AgentProjectConfig>) => {
    if (!activeProject) return;
    const target = configs.find((c) => c.agent_role === role);
    if (!target) return;

    await updateProjectAgentConfig(activeProject.id, target.id, updates);
    setConfigs((prev) =>
      prev.map((c) => (c.id === target.id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c))
    );
    showNotification(t.agentManager.configModal.savedSuccess);
  };

  const handleToggleAgent = async (config: AgentProjectConfig) => {
    if (!activeProject) return;
    const newStatus = !config.enabled;
    await updateProjectAgentConfig(activeProject.id, config.id, { enabled: newStatus });
    setConfigs((prev) =>
      prev.map((c) => (c.id === config.id ? { ...c, enabled: newStatus } : c))
    );
  };

  const handleResetAllAgents = async () => {
    if (!activeProject) return;
    if (window.confirm(currentLang === 'id' ? 'Kembalikan semua konfigurasi 14 agen ke pengaturan awal?' : 'Reset all 14 agent configurations to factory defaults?')) {
      await resetProjectAgentsToDefault(activeProject.id);
      await loadData(activeProject.id);
      showNotification(t.agentManager.agents.resetSuccess);
    }
  };

  // Task Handlers
  const handleApproveTask = async (taskId: string) => {
    if (!activeProject) return;
    await approveProductionTask(activeProject.id, taskId, 'Sutradara Utama (Creative Director)');
    
    // Add log
    await createTaskLog(activeProject.id, {
      project_id: activeProject.id,
      task_id: taskId,
      agent_role: 'master_director',
      agent_name: 'Master Director',
      level: 'success',
      message: currentLang === 'id' 
        ? 'Persetujuan Manusia Diterima. Master Director melanjutkan alur ke tahap berikutnya.'
        : 'Human Approval Received. Master Director authorizes downstream pipeline execution.',
      metadata: { approved_by: 'Creative Director', timestamp: new Date().toISOString() },
    });

    await loadData(activeProject.id);
    showNotification(t.agentManager.orchestrator.taskApproved);
  };

  const handleCancelTask = async (taskId: string) => {
    if (!activeProject) return;
    await cancelProductionTask(activeProject.id, taskId);
    await createTaskLog(activeProject.id, {
      project_id: activeProject.id,
      task_id: taskId,
      agent_role: 'master_director',
      agent_name: 'Master Director',
      level: 'error',
      message: currentLang === 'id' 
        ? 'Tugas dibatalkan atas perintah Sutradara.'
        : 'Task cancelled by Director order.',
    });
    await loadData(activeProject.id);
  };

  const handleRetryTask = async (taskId: string) => {
    if (!activeProject) return;
    await retryProductionTask(activeProject.id, taskId);
    await createTaskLog(activeProject.id, {
      project_id: activeProject.id,
      task_id: taskId,
      agent_role: 'master_director',
      agent_name: 'Master Director',
      level: 'action',
      message: currentLang === 'id' 
        ? 'Memulai ulang eksekusi tugas setelah penyetelan parameter.'
        : 'Re-initiating task execution after parameter adjustments.',
    });
    await loadData(activeProject.id);
  };

  // Orchestrator: Launch Coordinated Workflow Plan
  const handleLaunchWorkflow = async (plan: WorkflowExecutionPlan) => {
    if (!activeProject || isLaunchingWorkflow) return;
    setIsLaunchingWorkflow(true);

    try {
      const firstAgentRole = plan.agent_sequence[0] || 'master_director';
      const firstAgent = getAgentDefinition(firstAgentRole);

      // 1. Create Master Task
      const { data: createdTask } = await createProductionTask(activeProject.id, {
        project_id: activeProject.id,
        workflow_type: plan.workflow_key,
        task_name: plan.name,
        agent_role: firstAgentRole,
        agent_name: firstAgent.name,
        status: 'running',
        progress: 25,
        input_params: {
          plan_id: plan.id,
          sequence: plan.agent_sequence,
        },
        requires_human_approval: true,
        is_approved: false,
        dependencies: [],
        execution_time_seconds: 5,
        credits_consumed: Math.round(plan.estimated_credits * 0.3),
      });

      if (!createdTask) return;

      // 2. Initial reasoning log
      await createTaskLog(activeProject.id, {
        project_id: activeProject.id,
        task_id: createdTask.id,
        agent_role: 'master_director',
        agent_name: 'Master Director',
        level: 'reasoning',
        message: currentLang === 'id'
          ? `[Master Director] Menganalisis alur kerja "${plan.name}". Mengorkestrasi dependensi antar agen: ${plan.agent_sequence.join(' -> ')}...`
          : `[Master Director] Analyzing execution plan "${plan.name}". Coordinating agent sequence: ${plan.agent_sequence.join(' -> ')}...`,
        metadata: { plan_id: plan.id, agent_sequence: plan.agent_sequence },
      });

      // 3. Step action log
      await createTaskLog(activeProject.id, {
        project_id: activeProject.id,
        task_id: createdTask.id,
        agent_role: firstAgentRole,
        agent_name: firstAgent.name,
        level: 'action',
        message: currentLang === 'id'
          ? `[${firstAgent.name}] Memproses konteks proyek untuk ${plan.name}. Menyiapkan draf keluaran...`
          : `[${firstAgent.name}] Processing project context for ${plan.name}. Preparing draft deliverable...`,
      });

      // 4. Update task to awaiting_approval to simulate checkpoint
      await updateProductionTask(activeProject.id, createdTask.id, {
        progress: 60,
        status: 'awaiting_approval',
        output_result: {
          stage: firstAgent.title,
          summary: currentLang === 'id' ? 'Draf awal berhasil disusun, memerlukan persetujuan Sutradara.' : 'Draft compiled, awaiting Director approval.',
        },
      });

      await createTaskLog(activeProject.id, {
        project_id: activeProject.id,
        task_id: createdTask.id,
        agent_role: 'master_director',
        agent_name: 'Master Director',
        level: 'approval_required',
        message: currentLang === 'id'
          ? `[Human Checkpoint] Master Director membutuhkan otorisasi kreator sebelum melanjutkan tugas ke agen berikutnya.`
          : `[Human Checkpoint] Master Director requires creator authorization before delegating to downstream agents.`,
      });

      await loadData(activeProject.id);
      showNotification(t.agentManager.orchestrator.taskSuccess);
    } catch (err) {
      console.error('Error launching workflow:', err);
    } finally {
      setIsLaunchingWorkflow(false);
    }
  };

  // Filtered views
  const filteredAgents = useMemo(() => {
    return AGENTS_REGISTRY.filter((agent) => {
      if (agentCategoryFilter === 'all') return true;
      return agent.category === agentCategoryFilter;
    });
  }, [agentCategoryFilter]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskStatusFilter === 'all') return true;
      return task.status === taskStatusFilter;
    });
  }, [tasks, taskStatusFilter]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logLevelFilter === 'all') return true;
      return log.level === logLevelFilter;
    });
  }, [logs, logLevelFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalAgents = AGENTS_REGISTRY.length;
    const activeAgentsCount = configs.filter((c) => c.enabled).length;
    const inProgressTasks = tasks.filter((t) => t.status === 'running').length;
    const pendingApprovalTasks = tasks.filter((t) => t.status === 'awaiting_approval').length;
    const totalCreditsConsumed = tasks.reduce((sum, t) => sum + (t.credits_consumed || 0), 0);

    return {
      totalAgents,
      activeAgentsCount,
      inProgressTasks,
      pendingApprovalTasks,
      totalCreditsConsumed,
    };
  }, [configs, tasks]);

  // Editing agent object
  const activeEditingAgent = useMemo(() => {
    if (!editingAgentRole) return null;
    return getAgentDefinition(editingAgentRole);
  }, [editingAgentRole]);

  const activeEditingConfig = useMemo(() => {
    if (!editingAgentRole) return null;
    return configs.find((c) => c.agent_role === editingAgentRole) || null;
  }, [editingAgentRole, configs]);

  if (!activeProject) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>{currentLang === 'id' ? 'Silakan buat atau pilih proyek terlebih dahulu.' : 'Please create or select a project first.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {statusMessage && (
        <div className="p-3 bg-amber-950/60 border border-amber-600/50 rounded-lg text-amber-200 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-amber-400 hover:text-amber-200 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Header & Project Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              {t.agentManager.title}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {t.agentManager.subtitle}
          </p>
        </div>

        {/* Project Selector Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">
              {t.agentManager.selectProject}
            </span>
            <select
              value={activeProject.id}
              onChange={(e) => onSelectProject && onSelectProject(e.target.value)}
              className="bg-transparent text-xs text-amber-400 font-semibold focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadData(activeProject.id)}
            disabled={isLoading}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors text-xs flex items-center gap-1.5"
            title="Refresh Data"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Studio Telemetry Stats Strip (Strict Anti-Pill, Monospace Values) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.agentManager.stats.totalAgents}
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {stats.totalAgents}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            14 SSOT Core Agents
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.agentManager.stats.activeAgents}
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {stats.activeAgentsCount} / {stats.totalAgents}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {currentLang === 'id' ? 'Aktif dalam pipeline' : 'Active in pipeline'}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.agentManager.stats.activeTasks}
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
            {stats.inProgressTasks}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {currentLang === 'id' ? 'Sedang mengeksekusi' : 'Executing in queue'}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.agentManager.stats.approvalQueue}
          </div>
          <div className={`text-xl font-bold font-mono mt-1 ${stats.pendingApprovalTasks > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
            {stats.pendingApprovalTasks}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {currentLang === 'id' ? 'Human Checkpoint' : 'Human Checkpoint'}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg col-span-2 sm:col-span-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.agentManager.stats.consumedCredits}
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {stats.totalCreditsConsumed}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {currentLang === 'id' ? 'Kredit komputasi terpakai' : 'Compute credits used'}
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('orchestrator')}
          className={`pb-2.5 font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'orchestrator'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🎬</span>
          <span>{t.agentManager.tabs.orchestrator}</span>
          {stats.pendingApprovalTasks > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('agents')}
          className={`pb-2.5 font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'agents'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🤖</span>
          <span>{t.agentManager.tabs.agents}</span>
          <span className="text-xs font-mono text-slate-400">({AGENTS_REGISTRY.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-2.5 font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📟</span>
          <span>{t.agentManager.tabs.logs}</span>
          <span className="text-xs font-mono text-slate-400">({logs.length})</span>
        </button>
      </div>

      {/* TAB 1: ORCHESTRATOR & TASK QUEUE */}
      {activeTab === 'orchestrator' && (
        <div className="space-y-6">
          {/* Master Director Coordinated Workflow Launcher */}
          <div className="p-5 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span className="text-amber-400">⚡</span>
                  {t.agentManager.orchestrator.workflowLauncher}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.agentManager.orchestrator.workflowSub}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {WORKFLOW_PLANS.map((plan: WorkflowExecutionPlan) => (
                <div
                  key={plan.id}
                  className="p-4 bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 rounded-lg flex flex-col justify-between transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300">
                        {plan.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {plan.estimated_credits} CR
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {plan.description}
                    </p>

                    <div className="pt-2 border-t border-slate-900 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                        {plan.agent_sequence.length} {currentLang === 'id' ? 'Agen Terkait' : 'Chained Agents'}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {plan.agent_sequence.map((role: AgentRole, i: number) => {
                          const ag = getAgentDefinition(role);
                          return (
                            <span
                              key={i}
                              title={`${role}: ${ag.title}`}
                              className="text-xs cursor-help bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-slate-300"
                            >
                              {ag.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLaunchWorkflow(plan)}
                    disabled={isLaunchingWorkflow}
                    className="mt-4 w-full py-2 bg-amber-600/90 hover:bg-amber-600 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span>▶</span>
                    <span>{t.agentManager.orchestrator.runPlan}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Task Queue Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                  <span>📋</span>
                  {t.agentManager.orchestrator.taskQueueTitle}
                  <span className="text-xs font-mono text-slate-400 font-normal">
                    ({filteredTasks.length} {currentLang === 'id' ? 'pekerjaan' : 'tasks'})
                  </span>
                </h3>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 text-xs font-mono">
                {(['all', 'running', 'awaiting_approval', 'completed', 'failed', 'queued'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTaskStatusFilter(st)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      taskStatusFilter === st
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {st === 'all' && t.agentManager.orchestrator.allTasks}
                    {st === 'running' && t.agentManager.orchestrator.filterRunning}
                    {st === 'awaiting_approval' && t.agentManager.orchestrator.filterApproval}
                    {st === 'completed' && t.agentManager.orchestrator.filterCompleted}
                    {st === 'failed' && t.agentManager.orchestrator.filterFailed}
                    {st === 'queued' && t.agentManager.orchestrator.filterPending}
                  </button>
                ))}
              </div>
            </div>

            {/* Task Cards List */}
            {filteredTasks.length === 0 ? (
              <div className="p-8 border border-slate-800 rounded-xl bg-slate-900/30 text-center text-slate-400 text-xs">
                {t.agentManager.orchestrator.emptyTasks}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task: AgentTask) => {
                  const agentDef = getAgentDefinition(task.agent_role);
                  const isApproval = task.status === 'awaiting_approval';
                  const isFailed = task.status === 'failed' || task.status === 'cancelled';
                  const isRunning = task.status === 'running';
                  const isDone = task.status === 'completed';

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isApproval
                          ? 'bg-amber-950/20 border-amber-500/70 shadow-lg shadow-amber-950/20'
                          : isFailed
                          ? 'bg-rose-950/20 border-rose-800/80'
                          : 'bg-slate-900/50 border-slate-800/90'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-amber-400 font-mono text-xs font-semibold">
                            {agentDef.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-100">
                                {task.task_name}
                              </h4>
                              {/* Unboxed Status Display */}
                              <span className="text-[11px] font-mono">
                                {isApproval && <span className="text-amber-400 font-semibold">● {t.agentManager.orchestrator.filterApproval}</span>}
                                {isRunning && <span className="text-cyan-400 font-semibold animate-pulse">● {t.agentManager.orchestrator.filterRunning}</span>}
                                {isDone && <span className="text-emerald-400 font-semibold">✓ {t.agentManager.orchestrator.filterCompleted}</span>}
                                {isFailed && <span className="text-rose-400 font-semibold">✕ {t.agentManager.orchestrator.filterFailed}</span>}
                                {task.status === 'queued' && <span className="text-slate-400">○ {t.agentManager.orchestrator.filterPending}</span>}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                              {task.workflow_type.replace('_', ' ')} · {agentDef.title}
                            </p>

                            {/* Metadata Strip */}
                            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-2">
                              <span>{agentDef.name}</span>
                              <span>·</span>
                              <span>{task.credits_consumed || 0} Credits</span>
                              <span>·</span>
                              <span>{new Date(task.started_at).toLocaleTimeString()}</span>
                              {task.approved_by && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-400">{t.agentManager.orchestrator.approvedBy} {task.approved_by}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions & Progress */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 self-end md:self-center">
                          {/* Progress Indicator */}
                          <div className="w-36">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                              <span>Progress</span>
                              <span className="text-slate-200">{task.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isApproval ? 'bg-amber-400' : isFailed ? 'bg-rose-500' : isDone ? 'bg-emerald-400' : 'bg-cyan-400'
                                }`}
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            {isApproval && (
                              <button
                                onClick={() => handleApproveTask(task.id)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded transition-colors shadow flex items-center gap-1.5"
                              >
                                <span>✓</span>
                                <span>{t.agentManager.orchestrator.approveBtn}</span>
                              </button>
                            )}

                            {isFailed && (
                              <button
                                onClick={() => handleRetryTask(task.id)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors"
                              >
                                {t.agentManager.orchestrator.retryBtn}
                              </button>
                            )}

                            {isRunning && (
                              <button
                                onClick={() => handleCancelTask(task.id)}
                                className="px-3 py-1.5 bg-slate-800/80 hover:bg-rose-950/80 text-rose-300 text-xs font-medium rounded transition-colors"
                              >
                                {t.agentManager.orchestrator.cancelBtn}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Error or Deliverable Box */}
                      {task.error_message && (
                        <div className="mt-3 p-2.5 bg-rose-950/40 border border-rose-900/60 rounded text-rose-300 text-xs font-mono">
                          Error: {task.error_message}
                        </div>
                      )}

                      {task.output_result && (
                        <div className="mt-3 p-2.5 bg-slate-950/60 border border-slate-800/80 rounded text-xs text-slate-300 font-mono">
                          <span className="text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                            {currentLang === 'id' ? 'Hasil Keluaran / Status Sintesis:' : 'Generated Deliverable / Status:'}
                          </span>
                          <pre className="text-[11px] whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(task.output_result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: 14 SPECIALIZED AGENTS REGISTRY */}
      {activeTab === 'agents' && (
        <div className="space-y-5">
          {/* Category Filter & Reset Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setAgentCategoryFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  agentCategoryFilter === 'all'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {t.agentManager.agents.categoryAll} ({AGENTS_REGISTRY.length})
              </button>
              {AGENT_CATEGORIES.map((cat: { id: string; name: string; nameId: string }) => (
                <button
                  key={cat.id}
                  onClick={() => setAgentCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    agentCategoryFilter === cat.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {currentLang === 'id' ? cat.nameId : cat.name}
                </button>
              ))}
            </div>

            <button
              onClick={handleResetAllAgents}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors self-end sm:self-center font-mono"
            >
              {t.agentManager.agents.resetAllBtn}
            </button>
          </div>

          {/* 14 Agents Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => {
              const config = configs.find((c) => c.agent_role === agent.role);
              const isEnabled = config ? config.enabled : true;
              const currentModel = config?.selected_model || agent.default_model;
              const requiresApproval = config ? config.requires_approval : (agent.role === 'master_director' || agent.role === 'qc_agent');

              return (
                <div
                  key={agent.role}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    isEnabled
                      ? 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Icon, Name & Toggle */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-xs font-bold text-amber-400">
                          {agent.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-100">
                            {agent.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                            {agent.title}
                          </span>
                        </div>
                      </div>

                      {/* Enable/Disable Toggle */}
                      {config && (
                        <button
                          type="button"
                          onClick={() => handleToggleAgent(config)}
                          className={`text-[11px] font-mono font-medium transition-colors ${
                            isEnabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-slate-400'
                          }`}
                        >
                          {isEnabled ? '● Active' : '○ Off'}
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {agent.description}
                    </p>

                    {/* Technical Profile Unboxed Strip */}
                    <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Model:</span>
                        <span className="text-amber-300 truncate max-w-[170px]" title={currentModel}>
                          {currentModel}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{t.agentManager.agents.costPerRun}:</span>
                        <span className="text-slate-200">{agent.suggested_credit_cost} Credits</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Approval Policy:</span>
                        <span className={requiresApproval ? 'text-amber-400' : 'text-slate-400'}>
                          {requiresApproval ? 'Human Required' : 'Autonomous'}
                        </span>
                      </div>
                    </div>

                    {/* Key Responsibilities */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                        {currentLang === 'id' ? 'Tanggung Jawab Utama:' : 'Core Responsibilities:'}
                      </span>
                      <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                        {agent.responsibilities.slice(0, 3).map((resp: string, i: number) => (
                          <li key={i} className="truncate" title={resp}>
                            {resp}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Required Inputs & Outputs Tags */}
                    <div className="pt-2 border-t border-slate-900/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{agent.inputs.length} Inputs</span>
                      <span>·</span>
                      <span>{agent.outputs.length} Outputs</span>
                      <span>·</span>
                      <span className="text-slate-400 capitalize">{agent.category}</span>
                    </div>
                  </div>

                  {/* Configure Button */}
                  <button
                    onClick={() => setEditingAgentRole(agent.role)}
                    className="mt-4 w-full py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{t.agentManager.agents.configure}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: REAL-TIME EXECUTION TELEMETRY TERMINAL */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Terminal Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {t.agentManager.logs.terminalTitle}
              </span>
              <span className="text-xs font-mono text-slate-400">
                ({filteredLogs.length} events)
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              {/* Level Filter */}
              <select
                value={logLevelFilter}
                onChange={(e) => setLogLevelFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-300 focus:outline-none"
              >
                <option value="all">{t.agentManager.logs.allLevels}</option>
                <option value="reasoning">Reasoning</option>
                <option value="action">Action</option>
                <option value="approval_required">Approval Required</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="info">Info</option>
              </select>

              {/* Auto Scroll Toggle */}
              <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScrollLogs}
                  onChange={(e) => setAutoScrollLogs(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500"
                />
                <span>{t.agentManager.logs.autoScroll}</span>
              </label>

              {/* Clear Logs */}
              <button
                onClick={() => setLogs([])}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                {t.agentManager.logs.clearLogs}
              </button>
            </div>
          </div>

          {/* Monospace Terminal Body */}
          <div className="p-4 bg-[#0A0E17] border border-slate-800/90 rounded-xl font-mono text-xs overflow-y-auto max-h-[600px] space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                {t.agentManager.logs.emptyLogs}
              </div>
            ) : (
              filteredLogs.map((log: AgentExecutionLog) => {
                const isReasoning = log.level === 'reasoning';
                const isAction = log.level === 'action';
                const isApproval = log.level === 'approval_required';
                const isSuccess = log.level === 'success';
                const isError = log.level === 'error';

                return (
                  <div
                    key={log.id}
                    className={`p-2 rounded border leading-relaxed transition-all ${
                      isApproval
                        ? 'bg-amber-950/20 border-amber-500/50 text-amber-200'
                        : isError
                        ? 'bg-rose-950/20 border-rose-900/60 text-rose-300'
                        : isReasoning
                        ? 'bg-purple-950/10 border-purple-900/30 text-purple-300'
                        : isAction
                        ? 'bg-cyan-950/10 border-cyan-900/30 text-cyan-200'
                        : isSuccess
                        ? 'bg-emerald-950/10 border-emerald-900/30 text-emerald-300'
                        : 'bg-slate-900/20 border-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-slate-300 uppercase">
                          [{log.agent_name || log.agent_role}]
                        </span>
                      </div>
                      <span
                        className={`uppercase font-bold text-[9px] px-1.5 py-0.5 rounded ${
                          isApproval
                            ? 'bg-amber-500/20 text-amber-300'
                            : isError
                            ? 'bg-rose-500/20 text-rose-400'
                            : isReasoning
                            ? 'bg-purple-500/20 text-purple-300'
                            : isAction
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : isSuccess
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {log.level}
                      </span>
                    </div>

                    <div className="whitespace-pre-wrap">{log.message}</div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-1.5 pt-1 border-t border-slate-900/60 text-[10px] text-slate-400">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Agent Configuration Modal */}
      {activeEditingAgent && activeEditingConfig && (
        <AgentConfigModal
          agent={activeEditingAgent}
          config={activeEditingConfig}
          isOpen={Boolean(editingAgentRole)}
          onClose={() => setEditingAgentRole(null)}
          onSave={async (updates) => {
            await handleSaveConfig(activeEditingAgent.role, updates);
          }}
          currentLang={currentLang}
        />
      )}
    </div>
  );
};
