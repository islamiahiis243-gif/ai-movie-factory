import React, { useState } from 'react';
import {
  ShieldCheck,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Video,
  Image as ImageIcon,
  Mic,
  Music,
  X,
  ArrowRight,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { MediaAsset } from '../../types/database';

export interface CostPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (idempotencyKey: string) => Promise<void> | void;
  assetType: 'image' | 'video' | 'voice' | 'audio';
  assetName: string;
  provider: string;
  model: string;
  creditCost: number;
  walletBalance: number;
  params: {
    durationSeconds?: number;
    aspectRatio?: string;
    resolution?: string;
    cameraMotion?: string;
  };
  sourceAsset?: MediaAsset | null;
  onApproveSourceAsset?: (assetId: string) => void;
  isGenerating?: boolean;
}

export const CostPreviewModal: React.FC<CostPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  assetType,
  assetName,
  provider,
  model,
  creditCost,
  walletBalance,
  params,
  sourceAsset,
  onApproveSourceAsset,
  isGenerating = false,
}) => {
  if (!isOpen) return null;

  const [idempotencyKey] = useState<string>(
    () => `amf_job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );
  const [sourceApprovedLocally, setSourceApprovedLocally] = useState<boolean>(
    sourceAsset?.approval_status === 'approved'
  );

  const isBalanceSufficient = walletBalance >= creditCost;
  const balanceAfter = Math.max(0, walletBalance - creditCost);

  const isGate4Approved =
    assetType !== 'video' ||
    !sourceAsset ||
    sourceAsset.approval_status === 'approved' ||
    sourceApprovedLocally;

  const handleApproveKeyframe = () => {
    if (sourceAsset && onApproveSourceAsset) {
      onApproveSourceAsset(sourceAsset.id);
      setSourceApprovedLocally(true);
    }
  };

  const handleExecute = () => {
    if (!isBalanceSufficient || isGenerating) return;
    onConfirm(idempotencyKey);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-[#101726] border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Konfirmasi Produksi & Estimasi Biaya
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                SSOT Gelombang II · Pre-Generation Cost & Gate 4 Audit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs font-sans">
          {/* Target Job Summary */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Target Output Aset:</span>
              <span className="font-semibold text-white capitalize flex items-center gap-1.5">
                {assetType === 'video' && <Video className="w-3.5 h-3.5 text-cyan-400" />}
                {assetType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-amber-400" />}
                {assetType === 'voice' && <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                {assetType === 'audio' && <Music className="w-3.5 h-3.5 text-purple-400" />}
                {assetName || 'Klip Produksi Baru'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Penyedia & Model AI:</span>
              <span className="font-mono text-amber-300 text-[11px]">
                {provider} ({model})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
              {params.aspectRatio && (
                <div>
                  <span className="block text-slate-500">Rasio Aspek:</span>
                  <span className="font-mono text-slate-200">{params.aspectRatio}</span>
                </div>
              )}
              {params.durationSeconds && (
                <div>
                  <span className="block text-slate-500">Durasi Shot:</span>
                  <span className="font-mono text-slate-200">{params.durationSeconds} Detik</span>
                </div>
              )}
              {params.cameraMotion && (
                <div>
                  <span className="block text-slate-500">Gerakan Kamera:</span>
                  <span className="font-mono text-slate-200 capitalize">
                    {params.cameraMotion.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* GATE 4 ENFORCEMENT: Keyframe Image Approval Check (Only for Video) */}
          {assetType === 'video' && sourceAsset && (
            <div
              className={`p-4 rounded-xl border transition-all ${
                isGate4Approved
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {isGate4Approved ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>Gate 4: Keyframe Image Approval</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                          isGate4Approved
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {isGate4Approved ? 'LULUS (APPROVED)' : 'PENDING REVIEW'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      {isGate4Approved
                        ? `Keyframe acuan "${sourceAsset.asset_name}" telah disetujui sutradara sebagai dasar animasi video.`
                        : `Keyframe acuan "${sourceAsset.asset_name}" masih berstatus '${sourceAsset.approval_status}'. Anda disarankan menguncinya agar hasil video tidak membuang kredit.`}
                    </p>
                  </div>
                </div>

                {!isGate4Approved && onApproveSourceAsset && (
                  <button
                    type="button"
                    onClick={handleApproveKeyframe}
                    className="shrink-0 px-3 py-1.5 bg-amber-400 text-slate-950 text-xs font-bold rounded-lg hover:bg-amber-300 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    Setujui Keyframe (Kunci Gate 4)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cost & Balance Breakdown */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-2 border-b border-slate-800/80">
              <span>Rincian Saldo & Biaya Produksi</span>
              <span className="font-mono text-amber-400">Idempotency Protected</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Saldo Dompet Tersedia Saat Ini:</span>
                <span className="font-mono text-slate-200">{walletBalance} CR</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Biaya Generasi Aset Ini:</span>
                <span className="font-mono font-bold text-rose-400">-{creditCost} CR</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-semibold">
                <span className="text-slate-300">Estimasi Sisa Saldo:</span>
                <span
                  className={`font-mono text-sm ${
                    isBalanceSufficient ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {balanceAfter} CR
                </span>
              </div>
            </div>

            {!isBalanceSufficient && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  Saldo kredit tidak mencukupi untuk menjalankan job ini ({walletBalance} / {creditCost} CR). Silakan top-up saldo kredit Anda.
                </span>
              </div>
            )}
          </div>

          {/* Failed Job Credit Protection Notice */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">
                Jaminan Auto-Refund Kredit (Failed Job Protection):
              </span>
              <p className="mt-0.5 text-slate-400 leading-relaxed">
                Setiap pemanggilan dilengkapi token idempotency unik (<code>{idempotencyKey.substring(0, 16)}...</code>). Jika proses generasi gagal atau mengalami timeout provider, kredit yang direservasi otomatis dikembalikan 100% ke saldo Anda.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={!isBalanceSufficient || isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Generasi...</span>
              </>
            ) : (
              <>
                <span>Konfirmasi & Eksekusi ({creditCost} CR)</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
