import React from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Volume2,
  Film,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { QCReport, PipelineJob } from '../../types/database';

interface QCReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: QCReport;
  job?: PipelineJob;
  onApprove?: (jobId: string) => void;
  t: any;
}

export const QCReportModal: React.FC<QCReportModalProps> = ({
  isOpen,
  onClose,
  report,
  job,
  onApprove,
  t
}) => {
  if (!isOpen || !report) return null;

  const scoreColor =
    report.overall_score >= 90
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
      : report.overall_score >= 75
      ? 'text-amber-400 border-amber-500/30 bg-amber-950/20'
      : 'text-rose-400 border-rose-500/30 bg-rose-950/20';

  const categoryIcons: Record<string, React.ReactNode> = {
    visual_continuity: <Film className="w-4 h-4 text-cyan-400" />,
    audio_sync: <Volume2 className="w-4 h-4 text-violet-400" />,
    narrative_lore: <Sparkles className="w-4 h-4 text-amber-400" />,
    technical_specs: <Cpu className="w-4 h-4 text-blue-400" />
  };

  const categoryLabels: Record<string, string> = {
    visual_continuity: 'Visual Continuity & Character Seed Lock',
    audio_sync: 'Dialogue & Lip Sync Alignment',
    narrative_lore: 'Narrative Lore & World Codex Conformity',
    technical_specs: 'Technical Specs Conformance (24fps / -14 LUFS)'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-none shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                {t?.productionPipeline?.qcModal?.title || 'Automated Quality Control (QC) Report'}
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>{job?.job_title || 'Scene Job'}</span>
                <span>·</span>
                <span className="font-mono text-slate-500">ID: {report.id}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Score Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`p-4 border ${scoreColor} flex flex-col items-center justify-center text-center`}>
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">
                {t?.productionPipeline?.qcModal?.overallScore || 'Overall Quality'}
              </span>
              <div className="text-4xl font-mono font-bold tracking-tight tabular-nums">
                {report.overall_score}
                <span className="text-sm font-normal text-slate-500">/100</span>
              </div>
              <div className="text-[11px] font-mono tracking-widest uppercase mt-1">
                {report.status === 'passed'
                  ? t?.productionPipeline?.qcModal?.passBadge || 'PASSED'
                  : report.status === 'warning'
                  ? t?.productionPipeline?.qcModal?.warningBadge || 'ATTENTION'
                  : t?.productionPipeline?.qcModal?.failBadge || 'FAILED'}
              </div>
            </div>

            <div className="md:col-span-3 p-4 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    {report.audited_by_agent}
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    {new Date(report.audited_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {report.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 mt-3 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Passed: {report.checks.filter(c => c.status === 'passed').length}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Attention: {report.checks.filter(c => c.status === 'warning').length}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Failed: {report.checks.filter(c => c.status === 'failed').length}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Check Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Audit Breakdown by Production Category
            </h3>
            <div className="space-y-2">
              {report.checks.map(check => {
                const statusIcon =
                  check.status === 'passed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : check.status === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  );

                const itemBorder =
                  check.status === 'passed'
                    ? 'border-slate-800 hover:border-slate-700'
                    : check.status === 'warning'
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : 'border-rose-500/30 bg-rose-950/10';

                return (
                  <div
                    key={check.id}
                    className={`p-4 bg-slate-950/40 border ${itemBorder} transition-colors space-y-2`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        {statusIcon}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{check.check_name}</span>
                          <span className="text-xs text-slate-500 font-mono">
                            [{categoryLabels[check.category] || check.category}]
                          </span>
                        </div>
                      </div>
                      <div className="font-mono text-xs font-semibold tabular-nums text-slate-300">
                        {check.score}/100
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 pl-6 leading-relaxed">
                      {check.details}
                    </p>

                    {check.recommendation && (
                      <div className="ml-6 pl-3 border-l border-cyan-500/40 text-[11px] text-cyan-300 font-mono">
                        Recommendation: {check.recommendation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            {t?.productionPipeline?.qcModal?.closeBtn || 'Close'}
          </button>

          <div className="flex items-center gap-3">
            {job && job.status === 'awaiting_approval' && onApprove && (
              <button
                onClick={() => {
                  onApprove(job.id);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium tracking-wide flex items-center gap-2 transition-colors shadow-lg shadow-emerald-950/50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t?.productionPipeline?.qcModal?.approveBtn || 'Approve & Proceed to Final Assembly'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
