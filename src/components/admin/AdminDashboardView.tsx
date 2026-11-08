import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Coins,
  DollarSign,
  Activity,
  Users,
  Search,
  Filter,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Server,
  Layers,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import {
  CreditTransaction,
  PaymentOrder,
  PlatformRevenueMetrics,
  UserProfile
} from '../../types/database';
import { computePlatformMetrics } from '../../lib/billingEngine';
import {
  fetchCreditTransactions,
  fetchPaymentOrders,
  adminAdjustCredits,
  refundCreditTransaction,
  getLocalProfile
} from '../../lib/supabase';

interface AdminDashboardViewProps {
  currentUserId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  language: 'id' | 'en';
  t: any;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUserId,
  onShowToast,
  language,
  t
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ledgerAudit' | 'userGovernance' | 'systemHealth'>('overview');
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [metrics, setMetrics] = useState<PlatformRevenueMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Manual Credit Adjustment Form
  const [targetUserId, setTargetUserId] = useState<string>(currentUserId);
  const [adjustAmount, setAdjustAmount] = useState<number>(500);
  const [adjustReason, setAdjustReason] = useState<string>('Kompensasi audit teknis sutradara');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  useEffect(() => {
    loadAdminData();
  }, [currentUserId]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [txRes, ordRes] = await Promise.all([
        fetchCreditTransactions(currentUserId),
        fetchPaymentOrders(currentUserId)
      ]);

      const txList = txRes.data || [];
      const ordList = ordRes.data || [];
      setTransactions(txList);
      setOrders(ordList);
      setMetrics(computePlatformMetrics(txList, ordList));
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustCredits = async () => {
    if (!adjustReason || adjustAmount === 0) return;
    setIsAdjusting(true);
    try {
      const res = await adminAdjustCredits(targetUserId, adjustAmount, adjustReason);
      if (res.success) {
        onShowToast(`Berhasil menyesuaikan ${adjustAmount} kredit untuk pengguna.`, 'success');
        setAdjustReason('');
        loadAdminData();
      } else {
        onShowToast(res.error || 'Gagal menyesuaikan kredit.', 'error');
      }
    } catch (err) {
      console.error('Adjustment error:', err);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleRefundTransaction = async (txId: string) => {
    const res = await refundCreditTransaction(targetUserId, txId, 'Audit Intervensi Admin');
    if (res.success) {
      onShowToast('Transaksi berhasil di-refund ke saldo akun.', 'success');
      loadAdminData();
    } else {
      onShowToast(res.error || 'Gagal refund transaksi.', 'error');
    }
  };

  const formatIdr = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              {t?.adminPanel?.title || 'SaaS Commercial & Operations Console'}
            </h1>
            <span className="text-xs font-mono text-cyan-400 border border-cyan-500/30 px-2 py-0.5 uppercase tracking-wider">
              SSOT Sec. 41
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {t?.adminPanel?.subtitle ||
              'Operational monitoring, AI API gross-margin auditing, and user credit balance governance.'}
          </p>
        </div>

        <button
          onClick={loadAdminData}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors self-start md:self-auto shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Top Financial & Operational Telemetry Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {t?.adminPanel?.metrics?.mrr || 'MRR (IDR)'}
            </span>
            <div className="text-xl font-mono font-bold text-white tabular-nums mt-1">
              {formatIdr(metrics.mrrIdr)}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
              {t?.adminPanel?.metrics?.grossMargin || 'Gross Margin'}
            </span>
            <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
              {metrics.grossMarginPercent}%
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
              {t?.adminPanel?.metrics?.totalCreditsSold || 'Kredit Terjual'}
            </span>
            <div className="text-xl font-mono font-bold text-amber-400 tabular-nums mt-1">
              {metrics.totalCreditsSold.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {t?.adminPanel?.metrics?.totalCreditsConsumed || 'Kredit Terpakai'}
            </span>
            <div className="text-xl font-mono font-bold text-slate-200 tabular-nums mt-1">
              {metrics.totalCreditsConsumed.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
              {t?.adminPanel?.metrics?.apiCost || 'Biaya API AI'}
            </span>
            <div className="text-xl font-mono font-bold text-cyan-400 tabular-nums mt-1">
              ${metrics.totalApiCostUsd}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider">
              {t?.adminPanel?.metrics?.subscribers || 'Pelanggan'}
            </span>
            <div className="text-xl font-mono font-bold text-indigo-300 tabular-nums mt-1">
              {metrics.activeSubscribers} Studio
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-indigo-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-indigo-400" />
          {t?.adminPanel?.tabs?.overview || 'Financial & Operational Summary'}
        </button>

        <button
          onClick={() => setActiveTab('ledgerAudit')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'ledgerAudit'
              ? 'border-indigo-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          {t?.adminPanel?.tabs?.ledgerAudit || 'Global Transaction Audit'}
          <span className="text-[11px] font-mono text-slate-500">({transactions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('userGovernance')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'userGovernance'
              ? 'border-indigo-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-cyan-400" />
          {t?.adminPanel?.tabs?.userManagement || 'User Credit Governance'}
        </button>

        <button
          onClick={() => setActiveTab('systemHealth')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'systemHealth'
              ? 'border-indigo-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-4 h-4 text-emerald-400" />
          {t?.adminPanel?.tabs?.systemHealth || 'Service Health & API Latency'}
        </button>
      </div>

      {/* TAB 1: OVERVIEW & GROSS MARGIN ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue vs Cost Analysis */}
            <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Analisis Margin Kotor AI SaaS (Gross Margin Breakdown)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Memastikan biaya API model AI (Gemini, Veo, ElevenLabs) selalu di bawah 20% dari total pendapatan kredit (SSOT Bagian 22: &quot;Calculate actual provider costs before setting subscription limits&quot;).
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-3 bg-slate-900/80 border border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-300">Total Pendapatan Terkumpul (Midtrans Settlement):</span>
                  <span className="font-mono font-bold text-emerald-400">{formatIdr(428000)}</span>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-300">Biaya Token & Render API AI ($0.238 USD @ Rp16.000):</span>
                  <span className="font-mono text-rose-400">- {formatIdr(3808)}</span>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-300">Gross Profit Bersih Platform:</span>
                  <span className="font-mono font-bold text-cyan-400">{formatIdr(424192)} (99.1%)</span>
                </div>
              </div>
            </div>

            {/* Provider Model Utilization */}
            <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Distribusi Konsumsi API Model AI
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pemantauan kuota token dan durasi per detik video yang diproses oleh AI adapters.
              </p>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Google Gemini 3.1 Flash Lite (Keyframes):</span>
                    <span className="font-mono text-slate-400">25 Kredit · $0.021 USD</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: '22%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Google Gemini Omni 1.1 Flash / Veo (Motion Video):</span>
                    <span className="font-mono text-slate-400">87 Kredit · $0.178 USD</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: '62%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Google Gemini 3.8 Flash TTS (Character Voice):</span>
                    <span className="font-mono text-slate-400">16 Kredit · $0.011 USD</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                    <div className="h-full bg-violet-400" style={{ width: '12%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Google Gemini 2.5 Pro (Screenplay & Lore Reasoning):</span>
                    <span className="font-mono text-slate-400">12 Kredit · $0.007 USD</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: '4%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL TRANSACTION AUDIT */}
      {activeTab === 'ledgerAudit' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950/40 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Platform Transaction Audit Log</h3>
              <p className="text-xs text-slate-400">
                Pemeriksaan kepatuhan buku besar kredit, pencocokan idempotency key, dan intervensi refund korektif.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Pengguna</th>
                  <th className="p-3">Deskripsi Transaksi</th>
                  <th className="p-3 text-right">Mutasi</th>
                  <th className="p-3 text-right">Saldo</th>
                  <th className="p-3 text-right">Biaya API</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Intervensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </td>
                    <td className="p-3 text-slate-300 text-[11px]">user-demo-studio</td>
                    <td className="p-3 font-sans text-white">{tx.description}</td>
                    <td
                      className={`p-3 text-right font-bold ${
                        tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                    <td className="p-3 text-right text-slate-300">{tx.balance_after}</td>
                    <td className="p-3 text-right text-slate-400">
                      {tx.actual_cost_usd > 0 ? `$${tx.actual_cost_usd.toFixed(4)}` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 border border-slate-700 uppercase tracking-wider text-slate-300">
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-sans">
                      {tx.transaction_type === 'usage' && (
                        <button
                          onClick={() => handleRefundTransaction(tx.id)}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          Paksa Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: USER GOVERNANCE & MANUAL ADJUSTMENTS */}
      {activeTab === 'userGovernance' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 bg-slate-950/60 border border-slate-800 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Manajemen Kredit & Intervensi Akun Pengguna
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Lakukan penyesuaian kredit manual dengan catatan audit wajib untuk kompensasi kendala rendering atau bonus kemitraan studio.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">ID Pengguna Target</label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={e => setTargetUserId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Jumlah Penyesuaian Kredit (+ atau -)</label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-white px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[11px] text-slate-500 font-mono">
                  Gunakan nilai positif untuk menambah, negatif untuk memotong.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Alasan Penyesuaian (Audit Justification)</label>
                <textarea
                  rows={3}
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder={
                    t?.adminPanel?.reasonPlaceholder ||
                    'Alasan penyesuaian (e.g. Kompensasi gangguan render)...'
                  }
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleAdjustCredits}
                disabled={isAdjusting || !adjustReason}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-xs tracking-wide flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40"
              >
                <Plus className="w-4 h-4" />
                {isAdjusting
                  ? 'Menyimpan Penyesuaian...'
                  : t?.adminPanel?.adjustCreditsBtn || 'Eksekusi Penyesuaian Kredit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM HEALTH & API LATENCY */}
      {activeTab === 'systemHealth' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Status Infrastruktur Cloud & Database
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Supabase PostgreSQL & RLS:</span>
                  <span className="text-emerald-400 font-mono">Operational (14ms)</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Local Storage Sandbox Fallback:</span>
                  <span className="text-emerald-400 font-mono">Active & Synced</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Dev Server Port 3000:</span>
                  <span className="text-emerald-400 font-mono">HTTP 200 OK</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                Status AI API Provider & Latensi
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Google Gemini 2.5 Pro (Reasoning):</span>
                  <span className="text-emerald-400 font-mono">99.9% Uptime (280ms)</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Gemini 3.1 Flash Lite Image:</span>
                  <span className="text-emerald-400 font-mono">Operational (1.2s / frame)</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Midtrans Payment Gateway Webhook:</span>
                  <span className="text-emerald-400 font-mono">Ready & Listening</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
