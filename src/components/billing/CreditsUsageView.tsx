import React, { useState, useEffect } from 'react';
import {
  Coins,
  TrendingDown,
  TrendingUp,
  Plus,
  Download,
  Calculator,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Zap,
  Cpu
} from 'lucide-react';
import {
  CreditTransaction,
  CreditTopUpPack,
  CreditTransactionType,
  PaymentOrder
} from '../../types/database';
import {
  CREDIT_TOP_UP_PACKS,
  calculateSceneCreditCost
} from '../../lib/billingEngine';
import {
  fetchCreditTransactions,
  refundCreditTransaction
} from '../../lib/supabase';
import { PaymentModal } from './PaymentModal';

interface CreditsUsageViewProps {
  userId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  language: 'id' | 'en';
  t: any;
}

export const CreditsUsageView: React.FC<CreditsUsageViewProps> = ({
  userId,
  onShowToast,
  language,
  t
}) => {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Top Up Modal State
  const [selectedPack, setSelectedPack] = useState<CreditTopUpPack | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // Estimator State
  const [estDialogue, setEstDialogue] = useState<number>(6);
  const [estKeyframes, setEstKeyframes] = useState<number>(2);
  const [estVideoSec, setEstVideoSec] = useState<number>(8);
  const [estVoice, setEstVoice] = useState<boolean>(true);
  const [estAudio, setEstAudio] = useState<boolean>(true);
  const [estQC, setEstQC] = useState<boolean>(true);

  useEffect(() => {
    loadTransactions();
  }, [userId]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetchCreditTransactions(userId);
      if (res.data) setTransactions(res.data);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPack = (pack: CreditTopUpPack) => {
    setSelectedPack(pack);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (order: PaymentOrder) => {
    setIsPaymentModalOpen(false);
    loadTransactions();
    onShowToast(`Top-Up ${order.package_name} berhasil! ${order.credits_granted} kredit ditambahkan ke akun.`, 'success');
  };

  const handleRefund = async (txId: string) => {
    const res = await refundCreditTransaction(userId, txId, 'Kompensasi audit teknis sutradara');
    if (res.success) {
      loadTransactions();
      onShowToast(t?.creditsUsage?.refundSuccess || 'Kredit berhasil dikembalikan ke saldo.', 'success');
    } else {
      onShowToast(res.error || 'Gagal memproses refund.', 'error');
    }
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Type', 'Operation', 'Provider', 'Model', 'Amount', 'BalanceAfter', 'CostUSD', 'Status'];
    const rows = transactions.map(t => [
      t.id,
      t.created_at,
      t.transaction_type,
      t.operation,
      t.provider || '',
      t.model || '',
      t.amount,
      t.balance_after,
      t.actual_cost_usd,
      t.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AMF_Credit_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatIdr = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  // Metrics
  const currentBalance = transactions.length > 0 ? transactions[0].balance_after : 150;
  const usageTxs = transactions.filter(t => t.transaction_type === 'usage');
  const totalConsumed = Math.abs(usageTxs.reduce((sum, t) => sum + t.amount, 0));
  const totalRefunded = transactions
    .filter(t => t.transaction_type === 'refund')
    .reduce((sum, t) => sum + t.amount, 0);

  // Estimator computation
  const estimatedCalc = calculateSceneCreditCost({
    dialogueCount: estDialogue,
    keyframesCount: estKeyframes,
    videoSeconds: estVideoSec,
    hasVoiceDubbing: estVoice,
    hasMusic: estAudio,
    hasQCAudit: estQC
  });

  // Filtered transactions
  const filteredTxs = transactions.filter(t => {
    if (filterType !== 'all' && t.transaction_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.description.toLowerCase().includes(q) ||
        t.operation.toLowerCase().includes(q) ||
        (t.model && t.model.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              {t?.creditsUsage?.title || 'Credit Ledger & Usage Tracking'}
            </h1>
            <span className="text-xs font-mono text-cyan-400 border border-cyan-500/30 px-2 py-0.5 uppercase tracking-wider">
              SSOT Sec. 22
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {t?.creditsUsage?.subtitle ||
              'Immutable auditable transaction ledger, scene cost calculator, and instant top-up packs.'}
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors self-start md:self-auto shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Top Balance & Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-950/70 border border-amber-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              {t?.creditsUsage?.balanceTitle || 'Active Credit Balance'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">Live Balance</span>
          </div>
          <div className="text-3xl font-mono font-bold text-white tabular-nums my-2">
            {currentBalance.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-1.5">Kredit</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span>Paket aktif: Pro Studio (4.500 / bln)</span>
          </div>
        </div>

        <div className="p-5 bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" />
              {t?.creditsUsage?.consumedCredits || 'Consumed Credits'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">Bulan Ini</span>
          </div>
          <div className="text-3xl font-mono font-bold text-rose-400 tabular-nums my-2">
            {totalConsumed.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-1.5">Kredit</span>
          </div>
          <div className="text-xs text-slate-400">
            Total pemakaian AI model (Gemini, Veo, TTS)
          </div>
        </div>

        <div className="p-5 bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Total Refund / Kompensasi
            </span>
            <span className="text-[11px] font-mono text-slate-500">Audit Koreksi</span>
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-400 tabular-nums my-2">
            +{totalRefunded.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-1.5">Kredit</span>
          </div>
          <div className="text-xs text-slate-400">
            Dikembalikan otomatis karena regenerasi QC
          </div>
        </div>
      </div>

      {/* Top-Up Packs Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          {t?.creditsUsage?.topUpPacksTitle || 'Production Credit Top-Up Packs'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_TOP_UP_PACKS.map(pack => (
            <div
              key={pack.id}
              className={`p-4 bg-slate-950/50 border flex flex-col justify-between relative transition-all ${
                pack.popular
                  ? 'border-amber-500/50 bg-amber-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-2.5 right-3 px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Populer
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-white">{pack.name}</h4>
                <div className="text-xl font-mono font-bold text-amber-400 my-1">
                  {pack.credits.toLocaleString()}
                  {pack.bonusCredits > 0 && (
                    <span className="text-xs text-emerald-400 ml-1.5 font-normal">
                      +{pack.bonusCredits} Bonus
                    </span>
                  )}
                  <span className="text-xs text-slate-500 ml-1">Kredit</span>
                </div>
                <div className="text-xs font-mono text-slate-300 pb-3">
                  {formatIdr(pack.priceIdr)}
                </div>
              </div>

              <button
                onClick={() => handleBuyPack(pack)}
                className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Beli Paket</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Scene Credit Estimator (SSOT Section 22) */}
      <div className="p-6 bg-slate-950/60 border border-slate-800 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-400" />
            {t?.creditsUsage?.calculatorTitle || 'Scene Credit Cost Estimator'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t?.creditsUsage?.calculatorDesc ||
              'Calculate required credits prior to launching scene pipeline rendering workflows.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sliders */}
          <div className="space-y-4 md:col-span-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Jumlah Kalimat Dialog:</span>
                <span className="font-mono text-cyan-400">{estDialogue} Kalimat</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={estDialogue}
                onChange={e => setEstDialogue(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Keyframe Visual (Image Gen):</span>
                <span className="font-mono text-cyan-400">{estKeyframes} Frame</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={estKeyframes}
                onChange={e => setEstKeyframes(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Durasi Video Gerak (Seconds):</span>
                <span className="font-mono text-cyan-400">{estVideoSec} Detik</span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                value={estVideoSec}
                onChange={e => setEstVideoSec(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={estVoice}
                  onChange={e => setEstVoice(e.target.checked)}
                  className="rounded-none bg-slate-900 border-slate-700 text-cyan-500"
                />
                Sulih Suara TTS
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={estAudio}
                  onChange={e => setEstAudio(e.target.checked)}
                  className="rounded-none bg-slate-900 border-slate-700 text-cyan-500"
                />
                Musik & Foley SFX
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={estQC}
                  onChange={e => setEstQC(e.target.checked)}
                  className="rounded-none bg-slate-900 border-slate-700 text-cyan-500"
                />
                Audit QC 4 Pilar
              </label>
            </div>
          </div>

          {/* Result Card */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Estimasi Penggunaan
              </span>
              <div className="text-3xl font-mono font-bold text-amber-400 tabular-nums">
                {estimatedCalc.totalCredits}
                <span className="text-sm font-normal text-slate-400 ml-1.5">Kredit</span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-400 font-mono">
                <div className="flex justify-between">
                  <span>Script & Tags:</span>
                  <span>{estimatedCalc.breakdown.scriptPreparation}</span>
                </div>
                <div className="flex justify-between">
                  <span>Keyframe Render:</span>
                  <span>{estimatedCalc.breakdown.keyframeSynthesis}</span>
                </div>
                <div className="flex justify-between">
                  <span>Video Motion:</span>
                  <span>{estimatedCalc.breakdown.videoMotionRendering}</span>
                </div>
                <div className="flex justify-between">
                  <span>Voice Dubbing:</span>
                  <span>{estimatedCalc.breakdown.voiceDubbing}</span>
                </div>
                <div className="flex justify-between">
                  <span>Audio & QC:</span>
                  <span>{estimatedCalc.breakdown.cinematicAudio + estimatedCalc.breakdown.qualityControlAudit}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 mt-2 text-[11px] text-slate-500 font-mono">
              Biaya API aktual: ~ ${estimatedCalc.estimatedCostUsd} USD
            </div>
          </div>
        </div>
      </div>

      {/* Auditable Credit Transaction Ledger (SSOT Section 22) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              {t?.creditsUsage?.ledgerTitle || 'Auditable Credit Transaction Ledger'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t?.creditsUsage?.ledgerDesc ||
                'Transparent balance ledger recording AI foundation models and provider costs.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-300 px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">Semua Tipe Transaksi</option>
              <option value="usage">Pemakaian (Usage)</option>
              <option value="purchase">Pembelian (Purchase)</option>
              <option value="refund">Pengembalian (Refund)</option>
              <option value="monthly_allotment">Alokasi Bulanan</option>
            </select>

            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 px-3 py-1.5 focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Deskripsi & Operasi</th>
                <th className="p-3">Penyedia / Model</th>
                <th className="p-3 text-right">Mutasi</th>
                <th className="p-3 text-right">Sisa Saldo</th>
                <th className="p-3 text-right">Biaya API</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    Tidak ada transaksi kredit yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredTxs.map(tx => {
                  const isPositive = tx.amount > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>

                      <td className="p-3">
                        <div className="font-medium text-white">{tx.description}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{tx.operation}</div>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {tx.provider ? `${tx.provider} / ${tx.model}` : '-'}
                      </td>

                      <td
                        className={`p-3 font-mono font-bold text-right tabular-nums whitespace-nowrap ${
                          isPositive ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive ? `+${tx.amount}` : tx.amount}
                      </td>

                      <td className="p-3 font-mono text-right text-slate-300 tabular-nums">
                        {tx.balance_after.toLocaleString()}
                      </td>

                      <td className="p-3 font-mono text-right text-slate-400 tabular-nums text-[11px]">
                        {tx.actual_cost_usd > 0 ? `$${tx.actual_cost_usd.toFixed(4)}` : '-'}
                      </td>

                      <td className="p-3 text-center">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 border border-slate-700 uppercase tracking-wider text-slate-300">
                          {tx.status}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        {tx.transaction_type === 'usage' && (
                          <button
                            onClick={() => handleRefund(tx.id)}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline font-mono"
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedPack && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          userId={userId}
          item={{
            type: 'topup_credits',
            id: selectedPack.id,
            name: selectedPack.name,
            priceIdr: selectedPack.priceIdr,
            credits: selectedPack.credits + selectedPack.bonusCredits
          }}
          onPaymentSuccess={handlePaymentSuccess}
          t={t}
        />
      )}
    </div>
  );
};
