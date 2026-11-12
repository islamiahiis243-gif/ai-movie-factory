import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  ShieldCheck,
  Download,
  Filter,
  Search,
  Plus,
  Layers,
  ChevronRight,
  Sparkles,
  Zap,
  Cpu,
  Video,
  Eye,
  Film,
  Volume2,
  Terminal,
  FileCode,
  ArrowUpRight
} from 'lucide-react';
import {
  Project,
  Episode,
  SceneItem,
  PipelineJob,
  PipelineStage,
  PipelineJobStatus,
  PipelineJobPriority,
  QCReport,
  ExportPackage,
  PipelineJobLog,
  ScreenplayBlock
} from '../../types/database';
import {
  fetchPipelineJobs,
  createPipelineJob,
  updatePipelineJob,
  pausePipelineJob,
  resumePipelineJob,
  cancelPipelineJob,
  approvePipelineJob,
  fetchJobLogs,
  addJobLog,
  fetchExportPackages,
  createExportPackage,
  fetchProjectEpisodes,
  fetchScenes,
  fetchScreenplayBlocks,
  supabase
} from '../../lib/supabase';
import {
  PIPELINE_STAGE_DEFINITIONS,
  PIPELINE_STAGE_ORDER,
  evaluateSceneQC,
  generateSubtitles
} from '../../lib/pipelineEngine';
import { QCReportModal } from './QCReportModal';

interface ProductionPipelineViewProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (projectId: string) => void;
  language: 'id' | 'en';
  t: any;
}

export const ProductionPipelineView: React.FC<ProductionPipelineViewProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  language,
  t
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'sceneRunner' | 'qcCenter' | 'exporter'>('queue');
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [exportPackages, setExportPackages] = useState<ExportPackage[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Inspection
  const [selectedQCJob, setSelectedQCJob] = useState<PipelineJob | null>(null);
  const [isQCModalOpen, setIsQCModalOpen] = useState<boolean>(false);
  const [selectedLogsJob, setSelectedLogsJob] = useState<PipelineJob | null>(null);
  const [jobLogs, setJobLogs] = useState<PipelineJobLog[]>([]);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);

  // Subtitle Preview Modal
  const [previewSubtitleContent, setPreviewSubtitleContent] = useState<string | null>(null);

  // Toast Notification State
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Scene Runner State
  const [runnerEpisodeId, setRunnerEpisodeId] = useState<string>('');
  const [runnerSceneId, setRunnerSceneId] = useState<string>('');
  const [runnerPriority, setRunnerPriority] = useState<PipelineJobPriority>('normal');
  const [runnerSkipExisting, setRunnerSkipExisting] = useState<boolean>(true);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);

  // Exporter Form State
  const [exportTitle, setExportTitle] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'mp4' | 'prores' | 'webm'>('mp4');
  const [exportResolution, setExportResolution] = useState<'1080p' | '4K'>('1080p');
  const [exportFramerate, setExportFramerate] = useState<'24fps' | '30fps' | '60fps'>('24fps');
  const [exportAudioChannels, setExportAudioChannels] = useState<'Stereo 2.0' | 'Surround 5.1'>('Stereo 2.0');
  const [exportSubtitles, setExportSubtitles] = useState<boolean>(true);
  const [exportSubtitleFormat, setExportSubtitleFormat] = useState<'srt' | 'vtt'>('srt');
  const [isPackaging, setIsPackaging] = useState<boolean>(false);

  // Load project data
  useEffect(() => {
    if (!currentProjectId) return;
    loadPipelineData();
  }, [currentProjectId]);

  const loadPipelineData = async () => {
    setLoading(true);
    try {
      const [jobsRes, pkgsRes, epsRes] = await Promise.all([
        fetchPipelineJobs(currentProjectId),
        fetchExportPackages(currentProjectId),
        fetchProjectEpisodes(currentProjectId)
      ]);

      if (jobsRes.data) setJobs(jobsRes.data);
      if (pkgsRes.data) setExportPackages(pkgsRes.data);
      if (epsRes.data) {
        setEpisodes(epsRes.data);
        if (epsRes.data.length > 0 && !runnerEpisodeId) {
          setRunnerEpisodeId(epsRes.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load pipeline data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load scenes when runner episode changes
  useEffect(() => {
    if (!runnerEpisodeId || !currentProjectId) return;
    const loadScenes = async () => {
      const res = await fetchScenes(runnerEpisodeId, currentProjectId);
      if (res.data) {
        setScenes(res.data);
        if (res.data.length > 0) {
          setRunnerSceneId(res.data[0].id);
        }
      }
    };
    loadScenes();
  }, [runnerEpisodeId, currentProjectId]);

  // Simulation timer for running jobs
  useEffect(() => {
    const timer = setInterval(() => {
      setJobs(prevJobs => {
        let changed = false;
        const updated = prevJobs.map(job => {
          if (job.status === 'running') {
            changed = true;
            const newProgress = Math.min(100, job.progress + 4);

            // Determine stage based on progress
            let currentStage = job.current_stage;
            if (newProgress >= 15 && job.current_stage === 'script_prep') {
              currentStage = 'image_gen';
            } else if (newProgress >= 40 && job.current_stage === 'image_gen') {
              currentStage = 'video_gen';
            } else if (newProgress >= 65 && job.current_stage === 'video_gen') {
              currentStage = 'voice_audio';
            } else if (newProgress >= 75 && job.current_stage === 'voice_audio') {
              currentStage = 'qc_audit';
            } else if (newProgress >= 80 && job.current_stage === 'qc_audit') {
              // Pause at user approval gate
              return {
                ...job,
                progress: 80,
                current_stage: 'user_approval' as PipelineStage,
                status: 'awaiting_approval' as PipelineJobStatus,
                stages_completed: Array.from(new Set([...job.stages_completed, 'script_prep', 'image_gen', 'video_gen', 'voice_audio', 'qc_audit'])) as PipelineStage[],
                qc_report: job.qc_report || evaluateSceneQC(job.job_title)
              };
            } else if (newProgress >= 95 && job.current_stage === 'final_assembly') {
              currentStage = 'export_ready';
            } else if (newProgress >= 100) {
              return {
                ...job,
                progress: 100,
                current_stage: 'export_ready' as PipelineStage,
                status: 'completed' as PipelineJobStatus,
                stages_completed: PIPELINE_STAGE_ORDER,
                completed_at: new Date().toISOString()
              };
            }

            return {
              ...job,
              progress: newProgress,
              current_stage: currentStage,
              stages_completed: Array.from(new Set([...job.stages_completed, currentStage])) as PipelineStage[]
            };
          }
          return job;
        });

        if (changed) {
          // Sync changes
          return updated;
        }
        return prevJobs;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  // Metrics calculation
  const totalJobs = jobs.length;
  const activeJobsCount = jobs.filter(j => j.status === 'running').length;
  const queuedJobsCount = jobs.filter(j => j.status === 'queued').length;
  const awaitingApprovalCount = jobs.filter(j => j.status === 'awaiting_approval').length;
  const completedJobsCount = jobs.filter(j => j.status === 'completed').length;
  const failedJobsCount = jobs.filter(j => j.status === 'failed').length;

  const validScores = jobs.filter(j => j.qc_report?.overall_score).map(j => j.qc_report!.overall_score);
  const avgQcScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 94;

  // Actions
  const handlePause = async (jobId: string) => {
    await pausePipelineJob(currentProjectId, jobId);
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'paused' } : j)));
  };

  const handleResume = async (jobId: string) => {
    await resumePipelineJob(currentProjectId, jobId);
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'running' } : j)));
  };

  const handleCancel = async (jobId: string) => {
    await cancelPipelineJob(currentProjectId, jobId);
    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'cancelled' } : j)));
  };

  const handleRetryJob = async (jobId: string) => {
    const targetJob = jobs.find(j => j.id === jobId);
    if (!targetJob) return;

    const currentRetries = targetJob.retry_count || 0;
    const maxRetries = targetJob.max_retries || 3;

    if (currentRetries >= maxRetries) {
      showToast(`Batas maksimal percobaan ulang (${maxRetries}x) telah tercapai untuk job ini.`, 'error');
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data?.session;
      const res = await fetch('/api/pipeline/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({
          jobId,
          idempotencyKey: `retry_${jobId}_${Date.now()}`,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const nextRetry = json.newRetryCount || currentRetries + 1;
        setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'running', progress: 25, retry_count: nextRetry, error_message: undefined } : j)));
        showToast(json.message || `Job #${jobId.slice(0, 8)} dijadwalkan ulang untuk eksekusi (Retry ${nextRetry}/${maxRetries})!`, 'success');
        return;
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (errJson.error === 'MAX_RETRIES_EXCEEDED') {
          showToast(errJson.message || `Batas maksimal retry (${maxRetries}x) tercapai.`, 'error');
          return;
        }
      }
    } catch (apiErr) {
      console.warn('API retry failed, falling back to direct db update:', apiErr);
    }

    const nextRetry = currentRetries + 1;
    await updatePipelineJob(currentProjectId, jobId, {
      status: 'running',
      progress: 25,
      retry_count: nextRetry,
      error_message: undefined,
    });

    await addJobLog(jobId, {
      job_id: jobId,
      project_id: currentProjectId,
      stage: targetJob.current_stage,
      level: 'action',
      message: `Sutradara memicu Percobaan Ulang (Retry #${nextRetry}/${maxRetries}). Mengalokasikan ulang worker.`,
    });

    setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'running', progress: 25, retry_count: nextRetry, error_message: undefined } : j)));
    showToast(`Job #${jobId.slice(0, 8)} dijadwalkan ulang untuk eksekusi (Retry ${nextRetry}/${maxRetries})!`, 'success');
  };

  const handleApprove = async (jobId: string) => {
    await approvePipelineJob(currentProjectId, jobId, 'Director Master');
    setJobs(prev =>
      prev.map(j =>
        j.id === jobId
          ? {
              ...j,
              is_approved: true,
              approved_by: 'Director Master',
              approved_at: new Date().toISOString(),
              status: 'running',
              current_stage: 'final_assembly',
              progress: 85
            }
          : j
      )
    );
  };

  const handleOpenQC = (job: PipelineJob) => {
    const report = job.qc_report || evaluateSceneQC(job.job_title);
    setSelectedQCJob({ ...job, qc_report: report });
    setIsQCModalOpen(true);
  };

  const handleOpenLogs = async (job: PipelineJob) => {
    setSelectedLogsJob(job);
    const logsRes = await fetchJobLogs(job.id);
    if (logsRes.data && logsRes.data.length > 0) {
      setJobLogs(logsRes.data);
    } else {
      // Default generated logs
      const sampleLogs: PipelineJobLog[] = [
        {
          id: 'l1',
          job_id: job.id,
          project_id: currentProjectId,
          stage: 'script_prep',
          level: 'info',
          message: 'Script screenplay blocks parsed. Identified character dialogue and action beats.',
          timestamp: new Date(Date.now() - 600000).toISOString()
        },
        {
          id: 'l2',
          job_id: job.id,
          project_id: currentProjectId,
          stage: 'image_gen',
          level: 'action',
          message: 'Keyframe rendering dispatched to gemini-3.1-flash-lite-image with locked character seeds.',
          timestamp: new Date(Date.now() - 400000).toISOString()
        },
        {
          id: 'l3',
          job_id: job.id,
          project_id: currentProjectId,
          stage: 'video_gen',
          level: 'action',
          message: 'Interpolating 24fps motion envelope with dynamic cinematic pan.',
          timestamp: new Date(Date.now() - 200000).toISOString()
        },
        {
          id: 'l4',
          job_id: job.id,
          project_id: currentProjectId,
          stage: 'qc_audit',
          level: 'success',
          message: 'Automated QC evaluation complete: Visual continuity score 96/100.',
          timestamp: new Date(Date.now() - 60000).toISOString()
        }
      ];
      setJobLogs(sampleLogs);
    }
    setIsLogsModalOpen(true);
  };

  // Launch Scene Pipeline
  const handleLaunchSceneJob = async () => {
    if (!runnerSceneId) return;
    setIsLaunching(true);

    const selectedScene = scenes.find(s => s.id === runnerSceneId);
    const sceneTitle = selectedScene ? `Adegan ${selectedScene.scene_number}: ${selectedScene.title}` : 'Adegan Baru';

    const newJobData = {
      project_id: currentProjectId,
      episode_id: runnerEpisodeId,
      scene_id: runnerSceneId,
      job_title: `${sceneTitle} (Scene Batch)`,
      current_stage: 'script_prep' as PipelineStage,
      status: 'running' as PipelineJobStatus,
      priority: runnerPriority,
      progress: 5,
      stages_completed: ['script_prep' as PipelineStage],
      generated_asset_ids: [],
      credit_cost: runnerSkipExisting ? 18 : 23,
      is_approved: false,
      started_at: new Date().toISOString()
    };

    const res = await createPipelineJob(currentProjectId, newJobData);
    if (res.data) {
      setJobs(prev => [res.data!, ...prev]);
      // Add first log
      await addJobLog(res.data.id, {
        job_id: res.data.id,
        project_id: currentProjectId,
        stage: 'script_prep',
        level: 'info',
        message: `Scene execution started autonomously with priority ${runnerPriority}.`
      });
      setActiveTab('queue');
    }
    setIsLaunching(false);
  };

  // Create Export Package
  const handleCreateExport = async () => {
    setIsPackaging(true);

    // Fetch blocks for subtitle generation
    let subtitlesContent = '';
    if (exportSubtitles) {
      if (scenes.length > 0) {
        const blocksRes = await fetchScreenplayBlocks(scenes[0].id);
        subtitlesContent = generateSubtitles(blocksRes.data || [], exportSubtitleFormat);
      } else {
        subtitlesContent = generateSubtitles([], exportSubtitleFormat);
      }
    }

    const title = exportTitle || `Master Render Delivery - ${exportResolution} ${exportFormat.toUpperCase()}`;
    const newPkgData = {
      project_id: currentProjectId,
      episode_id: runnerEpisodeId,
      package_title: title,
      format: exportFormat,
      resolution: exportResolution,
      framerate: exportFramerate,
      audio_channels: exportAudioChannels,
      include_subtitles: exportSubtitles,
      subtitle_format: exportSubtitleFormat,
      subtitles_content: subtitlesContent,
      file_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      file_size_mb: exportResolution === '4K' ? 320.5 : 78.4,
      status: 'ready' as const
    };

    const res = await createExportPackage(currentProjectId, newPkgData);
    if (res.data) {
      setExportPackages(prev => [res.data!, ...prev]);
      setExportTitle('');
    }
    setIsPackaging(false);
  };

  // Download subtitle helper
  const handleDownloadSubtitle = (pkg: ExportPackage) => {
    const content = pkg.subtitles_content || generateSubtitles([], pkg.subtitle_format);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pkg.package_title.replace(/\s+/g, '_')}.${pkg.subtitle_format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered jobs
  const filteredJobs = jobs.filter(job => {
    if (statusFilter !== 'all' && job.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && job.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        job.job_title.toLowerCase().includes(q) ||
        job.current_stage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast / Notification Banner */}
      {toastNotification && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            toastNotification.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              : toastNotification.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : 'bg-amber-950/60 border-amber-500/50 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                toastNotification.type === 'error'
                  ? 'bg-rose-400'
                  : toastNotification.type === 'success'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              } animate-pulse`}
            />
            <span>{toastNotification.message}</span>
          </div>
          <button onClick={() => setToastNotification(null)} className="text-slate-400 hover:text-white ml-4 text-sm font-bold">
            ×
          </button>
        </div>
      )}

      {/* Top Header & Telemetry Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-amber-400" />
              {t?.productionPipeline?.title || 'Production Pipeline & Autonomous Queue'}
            </h1>
            <span className="text-xs font-mono text-cyan-400 border border-cyan-500/30 px-2 py-0.5 uppercase tracking-wider">
              SSOT Sec. 14 & 15
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {t?.productionPipeline?.subtitle ||
              'Autonomous scene-level execution queue, background rendering telemetry, automated Quality Control (QC) inspection, and master delivery packaging.'}
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-400 hidden sm:inline font-medium">
            {t?.productionPipeline?.selectProject || 'Project:'}
          </span>
          <select
            value={currentProjectId}
            onChange={e => onSelectProject(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Telemetry Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-950/60 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            {t?.productionPipeline?.stats?.activeJobs || 'Active Jobs'}
          </span>
          <div className="text-2xl font-mono font-bold text-cyan-400 tabular-nums mt-1">
            {activeJobsCount}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-400" />
            {t?.productionPipeline?.stats?.queued || 'Queued'}
          </span>
          <div className="text-2xl font-mono font-bold text-slate-300 tabular-nums mt-1">
            {queuedJobsCount}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {t?.productionPipeline?.stats?.awaitingApproval || 'In Review'}
          </span>
          <div className="text-2xl font-mono font-bold text-amber-400 tabular-nums mt-1">
            {awaitingApprovalCount}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            {t?.productionPipeline?.stats?.completed || 'Completed'}
          </span>
          <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
            {completedJobsCount}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="w-3 h-3 text-rose-400" />
            {t?.productionPipeline?.stats?.failed || 'Failed'}
          </span>
          <div className="text-2xl font-mono font-bold text-rose-400 tabular-nums mt-1">
            {failedJobsCount}
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-indigo-400" />
            {t?.productionPipeline?.stats?.avgQcScore || 'Avg QC Score'}
          </span>
          <div className="text-2xl font-mono font-bold text-indigo-300 tabular-nums mt-1">
            {avgQcScore}
            <span className="text-xs font-normal text-slate-500">/100</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'queue'
              ? 'border-amber-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-400" />
          {t?.productionPipeline?.tabs?.queue || 'Job Queue & Monitoring'}
          <span className="ml-1 text-[11px] font-mono text-slate-500">({jobs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sceneRunner')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'sceneRunner'
              ? 'border-amber-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Play className="w-4 h-4 text-cyan-400" />
          {t?.productionPipeline?.tabs?.sceneRunner || 'Scene-Level Runner'}
        </button>

        <button
          onClick={() => setActiveTab('qcCenter')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'qcCenter'
              ? 'border-amber-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          {t?.productionPipeline?.tabs?.qcCenter || 'Quality Control Center'}
        </button>

        <button
          onClick={() => setActiveTab('exporter')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'exporter'
              ? 'border-amber-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Download className="w-4 h-4 text-violet-400" />
          {t?.productionPipeline?.tabs?.exporter || 'Master Export & Delivery Hub'}
          <span className="ml-1 text-[11px] font-mono text-slate-500">({exportPackages.length})</span>
        </button>
      </div>

      {/* TAB 1: JOB QUEUE & MONITORING */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/40 p-3 border border-slate-800">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-slate-500 ml-1 shrink-0" />
              <input
                type="text"
                placeholder={t?.productionPipeline?.filters?.searchPlaceholder || 'Search jobs, scenes, or episodes...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">{t?.productionPipeline?.filters?.allStatuses || 'All Statuses'}</option>
                <option value="running">Running</option>
                <option value="queued">Queued</option>
                <option value="awaiting_approval">Awaiting Approval</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="failed">Failed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">{t?.productionPipeline?.filters?.allPriorities || 'All Priorities'}</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>

              <button
                onClick={() => setActiveTab('sceneRunner')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Scene Job</span>
              </button>
            </div>
          </div>

          {/* Job Cards */}
          <div className="space-y-3">
            {filteredJobs.length === 0 ? (
              <div className="p-8 text-center border border-slate-800/80 bg-slate-950/20 text-slate-500 text-xs">
                No pipeline jobs match your filter criteria.
              </div>
            ) : (
              filteredJobs.map(job => {
                const isRunning = job.status === 'running';
                const isAwaitingApproval = job.status === 'awaiting_approval';
                const isCompleted = job.status === 'completed';
                const isPaused = job.status === 'paused';

                const priorityStyles: Record<string, string> = {
                  urgent: 'text-rose-400 border-rose-500/40 bg-rose-950/20',
                  high: 'text-amber-400 border-amber-500/40 bg-amber-950/20',
                  normal: 'text-slate-300 border-slate-700 bg-slate-900/40',
                  low: 'text-slate-500 border-slate-800 bg-slate-950/40'
                };

                return (
                  <div
                    key={job.id}
                    className="p-4 bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
                  >
                    {/* Top Row: Title, Priority, Status, Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning
                              ? 'bg-cyan-400 animate-ping'
                              : isAwaitingApproval
                              ? 'bg-amber-400'
                              : isCompleted
                              ? 'bg-emerald-400'
                              : 'bg-slate-500'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white tracking-wide">
                              {job.job_title}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 border uppercase tracking-wider ${
                                priorityStyles[job.priority] || priorityStyles.normal
                              }`}
                            >
                              {job.priority}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-slate-500 text-[11px]">ID: {job.id}</span>
                            <span>·</span>
                            <span>Cost: {job.credit_cost} Credits</span>
                            <span>·</span>
                            <span>Started: {new Date(job.started_at).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isAwaitingApproval && (
                          <button
                            onClick={() => handleOpenQC(job)}
                            className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            {t?.productionPipeline?.actions?.viewQC || 'Review QC'}
                          </button>
                        )}

                        {isAwaitingApproval && (
                          <button
                            onClick={() => handleApprove(job.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t?.productionPipeline?.actions?.approve || 'Approve'}
                          </button>
                        )}

                        {isRunning && (
                          <button
                            onClick={() => handlePause(job.id)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}

                        {isPaused && (
                          <button
                            onClick={() => handleResume(job.id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
                            title="Resume"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}

                        {!isCompleted && !isFailed && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Cancel Job"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {isFailed && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer rounded"
                            title="Coba Ulang Job (Maksimal 3x)"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                            <span>Retry ({job.retry_count || 0}/{job.max_retries || 3})</span>
                          </button>
                        )}

                        {job.qc_report && !isAwaitingApproval && (
                          <button
                            onClick={() => handleOpenQC(job)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
                            title="View QC Report"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenLogs(job)}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          title="System Logs"
                        >
                          <Terminal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stage Timeline Stepper */}
                    <div className="pt-2 border-t border-slate-900">
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {PIPELINE_STAGE_ORDER.map(st => {
                          const isDone = job.stages_completed.includes(st);
                          const isCurrent = job.current_stage === st && !isCompleted;
                          const stDef = PIPELINE_STAGE_DEFINITIONS.find(d => d.stage === st);

                          return (
                            <div
                              key={st}
                              className={`p-1.5 text-center border text-[10px] font-mono transition-colors ${
                                isDone
                                  ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                                  : isCurrent
                                  ? 'border-cyan-400 bg-cyan-950/30 text-cyan-200 animate-pulse'
                                  : 'border-slate-800/80 bg-slate-950/30 text-slate-600'
                              }`}
                            >
                              <div className="truncate">
                                {language === 'id' ? stDef?.labelId : stDef?.labelEn}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Progress Bar & Telemetry details */}
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex-1 bg-slate-900 h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isCompleted
                              ? 'bg-emerald-400'
                              : isAwaitingApproval
                              ? 'bg-amber-400'
                              : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                        {job.progress}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SCENE-LEVEL RUNNER (SSOT Section 15) */}
      {activeTab === 'sceneRunner' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="p-6 bg-slate-950/60 border border-slate-800 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" />
                {t?.productionPipeline?.runner?.title || 'Scene Pipeline Execution Configuration'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {t?.productionPipeline?.runner?.desc ||
                  'Execute generation and rendering at the individual scene level without re-rendering the full episode (SSOT Section 15).'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Select Episode */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t?.productionPipeline?.runner?.selectEpisode || 'Select Episode'}
                </label>
                <select
                  value={runnerEpisodeId}
                  onChange={e => setRunnerEpisodeId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  {episodes.map(ep => (
                    <option key={ep.id} value={ep.id}>
                      Episode {ep.episode_number}: {ep.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Scene */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t?.productionPipeline?.runner?.selectScene || 'Select Target Scene'}
                </label>
                <select
                  value={runnerSceneId}
                  onChange={e => setRunnerSceneId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  {scenes.map(sc => (
                    <option key={sc.id} value={sc.id}>
                      Adegan {sc.scene_number}: {sc.title} ({sc.time_of_day})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority & Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t?.productionPipeline?.runner?.priority || 'Job Execution Priority'}
                </label>
                <select
                  value={runnerPriority}
                  onChange={e => setRunnerPriority(e.target.value as PipelineJobPriority)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="urgent">Urgent (Real-time dedicated runner)</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low (Background queue)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="skipExisting"
                  checked={runnerSkipExisting}
                  onChange={e => setRunnerSkipExisting(e.target.checked)}
                  className="w-4 h-4 bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 rounded-none cursor-pointer"
                />
                <label htmlFor="skipExisting" className="text-xs text-slate-300 cursor-pointer">
                  {t?.productionPipeline?.runner?.skipExistingStages || 'Skip stages with pre-generated assets'}
                </label>
              </div>
            </div>

            {/* Cost & Estimates */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="text-slate-400">
                  {t?.productionPipeline?.runner?.estimatedCredits || 'Estimated Credit Consumption:'}
                </div>
                <div className="text-lg font-mono font-bold text-amber-400">
                  {runnerSkipExisting ? '18 Credits' : '23 Credits'}
                </div>
              </div>

              <div className="space-y-1 text-right">
                <div className="text-slate-400">
                  {t?.productionPipeline?.runner?.estimatedTime || 'Estimated Processing Time:'}
                </div>
                <div className="text-sm font-mono text-slate-200">~ 28-35 Seconds</div>
              </div>
            </div>

            <button
              onClick={handleLaunchSceneJob}
              disabled={isLaunching || !runnerSceneId}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-semibold text-xs tracking-wide flex items-center justify-center gap-2 transition-colors shadow-lg shadow-cyan-950/40"
            >
              <Play className="w-4 h-4" />
              {isLaunching
                ? 'Launching Pipeline...'
                : t?.productionPipeline?.runner?.launchBtn || 'Launch Scene Processing Pipeline'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: QUALITY CONTROL CENTER */}
      {activeTab === 'qcCenter' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950/40 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Scene Quality Control & Continuity Audit Log
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect character consistency, lighting continuity, dialogue sync, and technical specs across all scenes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.filter(j => j.qc_report).map(job => {
              const report = job.qc_report!;
              return (
                <div
                  key={job.id}
                  className="p-5 bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{job.job_title}</h3>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          Audited: {new Date(report.audited_at).toLocaleDateString()} · {report.audited_by_agent}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-mono font-bold tabular-nums text-emerald-400">
                          {report.overall_score}
                          <span className="text-xs font-normal text-slate-500">/100</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                          {report.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 border border-slate-800/80">
                      {report.summary}
                    </p>

                    {/* Breakdown bars */}
                    <div className="space-y-1.5">
                      {report.checks.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 truncate max-w-[200px]">{c.check_name}</span>
                          <span className="font-mono tabular-nums text-slate-300">{c.score}/100</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">
                      {job.is_approved ? `Approved by ${job.approved_by}` : 'Pending final approval'}
                    </span>
                    <button
                      onClick={() => handleOpenQC(job)}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      View Full Audit Breakdown
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: MASTER EXPORT & DELIVERY HUB */}
      {activeTab === 'exporter' && (
        <div className="space-y-6">
          {/* Packaging Form */}
          <div className="p-6 bg-slate-950/60 border border-slate-800 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                <Download className="w-4 h-4 text-violet-400" />
                {t?.productionPipeline?.exporter?.title || 'Master Packaging & Subtitle Delivery'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {t?.productionPipeline?.exporter?.subtitle ||
                  'Compile final assembled scenes into delivery packages with automated multi-format subtitles (SRT/VTT).'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t?.productionPipeline?.exporter?.resolution || 'Target Resolution'}
                </label>
                <select
                  value={exportResolution}
                  onChange={e => setExportResolution(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="1080p">1080p Full HD (1920x1080)</option>
                  <option value="4K">4K UHD (3840x2160 Master)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t?.productionPipeline?.exporter?.format || 'Container Format'}
                </label>
                <select
                  value={exportFormat}
                  onChange={e => setExportFormat(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="mp4">MP4 (H.264 / AAC - Web & Broadcast)</option>
                  <option value="prores">Apple ProRes 422 HQ (Master Archive)</option>
                  <option value="webm">WebM (VP9 / Opus)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t?.productionPipeline?.exporter?.framerate || 'Target Framerate'}
                </label>
                <select
                  value={exportFramerate}
                  onChange={e => setExportFramerate(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="24fps">24fps (Cinematic Standard)</option>
                  <option value="30fps">30fps</option>
                  <option value="60fps">60fps (High Motion)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {t?.productionPipeline?.exporter?.subtitleFormat || 'Subtitle Format'}
                </label>
                <select
                  value={exportSubtitleFormat}
                  onChange={e => setExportSubtitleFormat(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="srt">SubRip (.srt)</option>
                  <option value="vtt">WebVTT (.vtt)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-800">
              <input
                type="text"
                placeholder="Optional package title (e.g. Episode 1 Master Cut v1.2)"
                value={exportTitle}
                onChange={e => setExportTitle(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 flex-1 focus:outline-none focus:border-cyan-500"
              />

              <button
                onClick={handleCreateExport}
                disabled={isPackaging}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white font-semibold text-xs tracking-wide flex items-center gap-2 transition-colors shrink-0"
              >
                <Download className="w-4 h-4" />
                {isPackaging
                  ? 'Packaging...'
                  : t?.productionPipeline?.exporter?.newPackageBtn || 'Generate Master Export Package'}
              </button>
            </div>
          </div>

          {/* Export Packages List */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Generated Export Packages ({exportPackages.length})
            </h3>

            {exportPackages.map(pkg => (
              <div
                key={pkg.id}
                className="p-4 bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{pkg.package_title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 border border-slate-700 text-slate-300 uppercase">
                      {pkg.format} · {pkg.resolution} · {pkg.framerate}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>Size: {pkg.file_size_mb} MB</span>
                    <span>·</span>
                    <span>Audio: {pkg.audio_channels}</span>
                    <span>·</span>
                    <span>Subtitles: {pkg.include_subtitles ? `Yes (.${pkg.subtitle_format})` : 'No'}</span>
                    <span>·</span>
                    <span className="font-mono text-slate-500">
                      {new Date(pkg.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pkg.include_subtitles && (
                    <>
                      <button
                        onClick={() =>
                          setPreviewSubtitleContent(
                            pkg.subtitles_content || generateSubtitles([], pkg.subtitle_format)
                          )
                        }
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                        Preview Subtitles
                      </button>

                      <button
                        onClick={() => handleDownloadSubtitle(pkg)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                        .{pkg.subtitle_format.toUpperCase()}
                      </button>
                    </>
                  )}

                  <a
                    href={pkg.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Video Master
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QC REPORT MODAL */}
      <QCReportModal
        isOpen={isQCModalOpen}
        onClose={() => setIsQCModalOpen(false)}
        report={selectedQCJob?.qc_report}
        job={selectedQCJob || undefined}
        onApprove={handleApprove}
        t={t}
      />

      {/* SYSTEM LOGS MODAL */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white tracking-wide">
                  Pipeline Execution Telemetry Logs
                </span>
                <span className="text-xs font-mono text-slate-500">({selectedLogsJob?.job_title})</span>
              </div>
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 font-mono text-xs bg-slate-950 text-slate-300 overflow-y-auto space-y-2 max-h-[60vh]">
              {jobLogs.map(l => (
                <div key={l.id} className="flex items-start gap-2 border-b border-slate-900 pb-1.5">
                  <span className="text-slate-600 shrink-0 text-[11px]">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`uppercase text-[10px] px-1 shrink-0 ${
                      l.level === 'action'
                        ? 'text-cyan-400 bg-cyan-950/30'
                        : l.level === 'success'
                        ? 'text-emerald-400 bg-emerald-950/30'
                        : l.level === 'warning'
                        ? 'text-amber-400 bg-amber-950/30'
                        : 'text-slate-400'
                    }`}
                  >
                    [{l.stage}]
                  </span>
                  <span className="leading-relaxed">{l.message}</span>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40 text-right">
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTITLES PREVIEW MODAL */}
      {previewSubtitleContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white tracking-wide">
                  Subtitle Content Code Preview
                </span>
              </div>
              <button
                onClick={() => setPreviewSubtitleContent(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <pre className="p-4 font-mono text-xs bg-slate-950 text-cyan-300 overflow-y-auto max-h-[60vh] whitespace-pre-wrap leading-relaxed">
              {previewSubtitleContent}
            </pre>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40 text-right">
              <button
                onClick={() => setPreviewSubtitleContent(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
