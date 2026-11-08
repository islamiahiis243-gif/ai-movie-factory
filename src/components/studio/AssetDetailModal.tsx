import React from 'react';
import { MediaAsset, Character, SceneItem } from '../../types/database';
import { translations } from '../../lib/translations';

interface AssetDetailModalProps {
  asset: MediaAsset;
  characters: Character[];
  scenes: SceneItem[];
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUseAsVideoSource?: (asset: MediaAsset) => void;
  currentLang: 'id' | 'en';
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  characters,
  scenes,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onDelete,
  onUseAsVideoSource,
  currentLang,
}) => {
  const t = translations[currentLang];
  if (!isOpen) return null;

  const linkedCharacter = characters.find((c) => c.id === asset.character_id);
  const linkedScene = scenes.find((s) => s.id === asset.scene_id);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(asset.prompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-4xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>{asset.asset_name}</span>
              <span className="text-xs font-mono text-slate-400 font-normal">
                [v{asset.version}]
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-1">
              <span className="uppercase text-amber-400 font-semibold">{asset.asset_type}</span>
              <span>·</span>
              <span>{asset.subtype.replace('_', ' ')}</span>
              <span>·</span>
              <span>{asset.provider}</span>
              <span>·</span>
              <span className="text-slate-300">{asset.model}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label={t.common.close}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Media Preview Box */}
          <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl overflow-hidden flex items-center justify-center p-3">
            {asset.asset_type === 'image' && (
              <img
                src={asset.file_url}
                alt={asset.asset_name}
                className="max-h-[380px] w-auto object-contain rounded-lg shadow-lg"
              />
            )}

            {asset.asset_type === 'video' && (
              <div className="relative w-full max-h-[380px] flex items-center justify-center">
                <img
                  src={asset.file_url}
                  alt={asset.asset_name}
                  className="max-h-[380px] w-auto object-contain rounded-lg"
                />
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl text-center shadow-xl">
                    <span className="text-2xl mb-1 block">🎬</span>
                    <span className="text-xs font-mono font-semibold text-cyan-300 block">
                      Video Motion Preview ({asset.generation_params.duration_seconds || 5}s)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                      Camera: {asset.generation_params.camera_motion || 'pan_right'} · Intensity: {asset.generation_params.motion_intensity || 8}/10
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(asset.asset_type === 'voice' || asset.asset_type === 'audio') && (
              <div className="w-full py-8 px-6 bg-slate-900/40 rounded-xl flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl">
                  {asset.asset_type === 'voice' ? '🎙️' : '🎵'}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-200">
                    {asset.asset_name}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    {asset.asset_type === 'voice' ? 'Voice Track · Speech Synthesis' : 'Soundtrack · Audio Design'}
                  </div>
                </div>
                <audio controls src={asset.file_url} className="w-full max-w-md accent-amber-500" />
              </div>
            )}
          </div>

          {/* Details & Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Prompt Section */}
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2 col-span-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Generation Prompt
                </span>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  <span>{t.mediaStudio.actions.copyPrompt}</span>
                </button>
              </div>
              <p className="text-slate-300 font-sans leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                {asset.prompt}
              </p>
            </div>

            {/* Generation Parameters */}
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                {t.mediaStudio.modal.generationParameters}
              </span>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Aspect Ratio:</span>
                  <span>{asset.generation_params.aspect_ratio || '16:9'}</span>
                </div>
                {asset.generation_params.resolution && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resolution:</span>
                    <span>{asset.generation_params.resolution}</span>
                  </div>
                )}
                {asset.generation_params.seed && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Seed:</span>
                    <span className="text-amber-400">{asset.generation_params.seed}</span>
                  </div>
                )}
                {asset.generation_params.camera_motion && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Camera Motion:</span>
                    <span className="text-cyan-300">{asset.generation_params.camera_motion}</span>
                  </div>
                )}
                {asset.generation_params.motion_intensity && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Motion Intensity:</span>
                    <span>{asset.generation_params.motion_intensity} / 10</span>
                  </div>
                )}
                {asset.generation_params.duration_seconds && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration:</span>
                    <span>{asset.generation_params.duration_seconds} seconds</span>
                  </div>
                )}
                {asset.generation_params.language && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Language:</span>
                    <span>{asset.generation_params.language}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Compute Cost:</span>
                  <span className="text-amber-400 font-bold">{asset.credit_cost} Credits</span>
                </div>
              </div>
            </div>

            {/* Context & Association */}
            <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                Production Context
              </span>
              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Character:</span>
                  <span className="truncate max-w-[160px] text-slate-200">
                    {linkedCharacter ? linkedCharacter.name : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Scene Link:</span>
                  <span className="truncate max-w-[160px] text-slate-200">
                    {linkedScene ? `Scene #${linkedScene.scene_number}: ${linkedScene.title}` : 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Approval Status:</span>
                  <span className={
                    asset.approval_status === 'approved' ? 'text-emerald-400 font-semibold' :
                    asset.approval_status === 'rejected' ? 'text-rose-400 font-semibold' :
                    'text-amber-400'
                  }>
                    {asset.approval_status.toUpperCase()}
                  </span>
                </div>
                {asset.approved_by && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Approved By:</span>
                    <span className="text-emerald-400">{asset.approved_by}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Created:</span>
                  <span>{new Date(asset.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDelete(asset.id)}
              className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 rounded transition-colors"
            >
              {t.mediaStudio.actions.delete}
            </button>

            {asset.asset_type === 'image' && onUseAsVideoSource && (
              <button
                type="button"
                onClick={() => {
                  onUseAsVideoSource(asset);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-950/40 border border-cyan-800/60 rounded transition-colors flex items-center gap-1.5"
              >
                <span>🎥</span>
                <span>{t.mediaStudio.actions.useAsVideoSource}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {asset.approval_status !== 'rejected' && (
              <button
                type="button"
                onClick={() => onReject(asset.id)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                {t.mediaStudio.actions.reject}
              </button>
            )}

            {asset.approval_status !== 'approved' && (
              <button
                type="button"
                onClick={() => onApprove(asset.id)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors shadow flex items-center gap-1"
              >
                <span>✓</span>
                <span>{t.mediaStudio.actions.approve}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
