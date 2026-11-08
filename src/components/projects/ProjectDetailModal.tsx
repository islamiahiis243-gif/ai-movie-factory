import React from 'react';
import { Project } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { X, Clapperboard, Calendar, Ratio, Cpu, Layers, DollarSign, Edit3, Trash2, Copy } from 'lucide-react';

interface ProjectDetailModalProps {
  project: Project | null;
  onClose: () => void;
  onEdit: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onDelete: (project: Project) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const { t } = useAuth();
  if (!project) return null;

  const s = project.settings;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#101726] border border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{project.name}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>{project.genre}</span>
                <span aria-hidden="true">·</span>
                <span>{project.production_format}</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-400 font-medium">{t.statuses[project.status] || project.status}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Synopsis */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Sinopsis & Visi Cerita
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5">
              {project.description || 'Tidak ada deskripsi yang disediakan.'}
            </p>
          </div>

          {/* Core Specs Grid */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
              Parameter Produksi
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-lg">
                <div className="text-[11px] text-slate-500">Musim & Episode</div>
                <div className="text-sm font-semibold text-white mt-1 font-mono tabular-nums">
                  {s?.seasons_count || 1} Musim · {s?.episodes_count || 1} Ep
                </div>
              </div>
              <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-lg">
                <div className="text-[11px] text-slate-500">Durasi per Ep</div>
                <div className="text-sm font-semibold text-white mt-1 font-mono tabular-nums">
                  {s?.episode_duration_minutes || 10} Menit
                </div>
              </div>
              <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-lg">
                <div className="text-[11px] text-slate-500">Target Adegan</div>
                <div className="text-sm font-semibold text-white mt-1 font-mono tabular-nums">
                  {s?.scene_count_target || 10} Adegan
                </div>
              </div>
              <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-lg">
                <div className="text-[11px] text-slate-500">Aspek Rasio & Output</div>
                <div className="text-sm font-semibold text-white mt-1 font-mono tabular-nums">
                  {s?.aspect_ratio || '16:9'} · {s?.output_resolution || '4K'} ({s?.frame_rate || '24fps'})
                </div>
              </div>
              <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-lg">
                <div className="text-[11px] text-slate-500">Mode Produksi</div>
                <div className="text-sm font-semibold text-white mt-1">
                  {s?.production_mode ? t.modes[s.production_mode] : 'AI-Assisted'}
                </div>
              </div>
              <div className="p-3 bg-slate-900/50 border border-slate-800/60 rounded-lg">
                <div className="text-[11px] text-slate-500">Alokasi Anggaran Kredit</div>
                <div className="text-sm font-semibold text-amber-400 mt-1 font-mono tabular-nums">
                  {(s?.credit_budget || 0).toLocaleString()} Kredit
                </div>
              </div>
            </div>
          </div>

          {/* Visual Style */}
          {s?.visual_style && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Gaya Visual
              </h4>
              <div className="text-xs text-slate-300 bg-slate-900/50 border border-slate-800/60 rounded-lg p-2.5">
                {s.visual_style}
              </div>
            </div>
          )}

          {/* Enabled Modules & Agents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Modul Aktif ({s?.enabled_modules?.length || 0})
              </h4>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {s?.enabled_modules?.map((m) => (
                  <div key={m} className="text-xs text-slate-300 bg-slate-900/40 px-2.5 py-1.5 rounded border border-slate-800/60 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="capitalize">{m.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Agen AI Terdaftar ({s?.enabled_agents?.length || 0})
              </h4>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {s?.enabled_agents?.map((a) => (
                  <div key={a} className="text-xs text-slate-300 bg-slate-900/40 px-2.5 py-1.5 rounded border border-slate-800/60 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="capitalize">{a.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between font-mono">
            <span>Dibuat: {new Date(project.created_at).toLocaleString()}</span>
            <span>ID: {project.id}</span>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(project);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t.projects.edit}</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onDuplicate(project);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-900 border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{t.projects.duplicate}</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onDelete(project);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-md transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.projects.delete}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
