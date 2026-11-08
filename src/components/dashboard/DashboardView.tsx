import React from 'react';
import { Project, ProductionActivity, ProductionJob } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import {
  Film,
  Plus,
  PlayCircle,
  Clock,
  Layers,
  Coins,
  Bot,
  Activity,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  activities: ProductionActivity[];
  jobs: ProductionJob[];
  isDemoData: boolean;
  onOpenCreateProject: () => void;
  onSelectProject: (project: Project) => void;
  onViewAllProjects: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  activities,
  jobs,
  isDemoData,
  onOpenCreateProject,
  onSelectProject,
  onViewAllProjects,
}) => {
  const { t, profile } = useAuth();

  // Metrics computation from real data
  const totalProjects = projects.length;
  const totalEpisodes = projects.reduce((acc, p) => acc + (p.settings?.episodes_count || 1), 0);
  const totalScenes = projects.reduce((acc, p) => acc + (p.settings?.scene_count_target || 10), 0);
  const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const failedJobs = jobs.filter((j) => j.status === 'failed').length;
  const totalBudget = projects.reduce((acc, p) => acc + (p.settings?.credit_budget || 0), 0);
  const creditConsumption = Math.round(totalBudget * 0.28); // 28% estimated usage
  const availableCredits = Math.max(0, totalBudget - creditConsumption);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#131B2E] via-[#0E1526] to-[#0B0F17] border border-slate-800/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-amber-400 tracking-wider uppercase">
              AI Movie Factory Cockpit
            </span>
            {isDemoData && (
              <span className="text-[11px] text-amber-300/80 font-mono">
                · {t.dashboard.demoNotice}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {t.dashboard.welcome}, {profile.display_name}
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            {t.dashboard.welcomeSub}
          </p>
        </div>

        <button
          onClick={onOpenCreateProject}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-amber-400/20 whitespace-nowrap shrink-0 self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{t.dashboard.quickCreate}</span>
        </button>
      </div>

      {/* KPI Stat Cards (SSOT Section 6 requirements) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">{t.dashboard.metrics.totalProjects}</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">{totalProjects}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Studio Portofolio</div>
        </div>

        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">{t.dashboard.metrics.totalEpisodes}</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">{totalEpisodes}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Seluruh Serial</div>
        </div>

        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">{t.dashboard.metrics.totalScenes}</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">{totalScenes}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Target Rincian</div>
        </div>

        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">{t.dashboard.metrics.activeAgents}</div>
          <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums mt-1">14</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Master Roster Siap</div>
        </div>

        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">{t.dashboard.metrics.availableCredits}</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
            {availableCredits.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">Kredit Saldo</div>
        </div>

        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400">{t.dashboard.metrics.activeJobs}</div>
          <div className="text-2xl font-bold text-blue-400 font-mono tabular-nums mt-1">{activeJobs}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            {failedJobs > 0 ? `${failedJobs} gagal` : '0 gagal'}
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Projects + Active Jobs / Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {t.dashboard.recentProjects}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Proyek produksi audiovisual terakhir yang diperbarui.
              </p>
            </div>
            <button
              onClick={onViewAllProjects}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{t.dashboard.viewAllProjects}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#101726] border border-slate-800/80">
              <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">{t.dashboard.noProjectsYet}</p>
              <p className="text-xs text-slate-500 mt-1">{t.dashboard.noProjectsSub}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 4).map((project) => (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  className="p-4 rounded-xl bg-[#101726] border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-amber-400 font-medium">{project.genre}</span>
                      <span aria-hidden="true">·</span>
                      <span>{project.production_format}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {project.settings?.aspect_ratio || '16:9'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                      {project.name}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-1 max-w-xl">
                      {project.description || 'Tidak ada deskripsi'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto text-xs">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500 font-mono">Status</div>
                      <div className="text-amber-400 font-medium font-mono text-xs">
                        {t.statuses[project.status] || project.status}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:border-slate-700">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Production Jobs & Recent Activity */}
        <div className="space-y-6">
          {/* Active Jobs in Queue */}
          <div className="p-5 rounded-xl bg-[#101726] border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white tracking-tight uppercase tracking-wider text-slate-400">
                {t.dashboard.activeJobsTitle}
              </h3>
              <span className="text-[10px] font-mono text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                {activeJobs} Antrean
              </span>
            </div>

            {jobs.length === 0 ? (
              <p className="text-xs text-slate-500">{t.dashboard.noJobs}</p>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate pr-2">{job.task_name}</span>
                      <span className="text-[10px] font-mono text-blue-400 tabular-nums">{job.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{job.agent_name}</span>
                      <span className="capitalize">{job.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="p-5 rounded-xl bg-[#101726] border border-slate-800/80 space-y-3">
            <h3 className="text-xs font-bold text-white tracking-tight uppercase tracking-wider text-slate-400">
              {t.dashboard.recentActivity}
            </h3>

            <div className="space-y-3 text-xs">
              {activities.map((act) => (
                <div key={act.id} className="pb-3 border-b border-slate-800/60 last:border-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="text-amber-400/90 font-medium">{act.activity_type}</span>
                    <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">{act.description}</p>
                  <div className="text-[10px] text-slate-500 font-mono">{act.project_name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
