import React from 'react';
import {
  Compass,
  ArrowRight,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Film
} from 'lucide-react';
import { NextBestAction } from '../../lib/workflowGates';

interface NextBestActionBannerProps {
  action: NextBestAction;
  projectName?: string;
  onNavigate: (targetTab: string) => void;
  className?: string;
}

export const NextBestActionBanner: React.FC<NextBestActionBannerProps> = ({
  action,
  projectName,
  onNavigate,
  className = '',
}) => {
  const gates = [
    { label: 'G1 Naskah', passed: action.gateStatus.gate1 },
    { label: 'G2 Karakter', passed: action.gateStatus.gate2 },
    { label: 'G3 Storyboard', passed: action.gateStatus.gate3 },
    { label: 'G4 Keyframe', passed: action.gateStatus.gate4 },
    { label: 'G5 Master', passed: action.gateStatus.gate5 },
  ];

  return (
    <div
      className={`rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-slate-900/80 to-[#0B0F17] p-5 shadow-xl relative overflow-hidden ${className}`}
    >
      {/* Background Accent glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
        {/* Left Side: Current Stage & Next Action */}
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Compass className="w-3.5 h-3.5" />
              Langkah Terbaik Selanjutnya (Next Best Action)
            </span>
            {projectName && (
              <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <Film className="w-3 h-3 text-slate-500" />
                {projectName}
              </span>
            )}
            <span className="text-[11px] font-mono text-slate-500">
              · {action.stageName}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>{action.actionTitle}</span>
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            {action.actionDescription}
          </p>

          {/* 5 Director Approval Gates Mini Stepper */}
          <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Director Gates:
            </span>
            {gates.map((g, idx) => (
              <div
                key={idx}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  g.passed
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800/80 text-slate-500 border border-slate-700/50'
                }`}
              >
                {g.passed ? (
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                ) : (
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                )}
                <span>{g.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Primary Direct Action Button */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={() => onNavigate(action.targetTab)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-400/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <span>{action.buttonLabel}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
