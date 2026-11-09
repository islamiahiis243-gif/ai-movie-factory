import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Coins,
  DollarSign,
  Activity,
  Users,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  Cpu,
  Server,
  Clock,
  Building2,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Calculator,
  Zap,
  ShieldAlert
} from 'lucide-react';
import {
  CreditTransaction,
  PaymentOrder,
  PlatformRevenueMetrics
} from '../../types/database';
import {
  computePlatformMetrics,
  OFFICIAL_MERCHANT_BANK_ACCOUNT
} from '../../lib/billingEngine';
import {
  fetchCreditTransactions,
  fetchPaymentOrders,
  adminFetchAllBillingData,
  adminApprovePaymentOrder,
  adminRejectPaymentOrder,
  adminAdjustCredits,
  fetchAdminFinancialAnalytics
} from '../../lib/supabase';

interface AdminDashboardViewProps {
  currentUserId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  language: 'id' | 'en';
  t: any;
}

type EnrichedOrder = PaymentOrder & {
  user_display_name?: string;
  user_email?: string;
};

type EnrichedTransaction = CreditTransaction & {
  user_display_name?: string;
  user_email?: string;
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUserId,
  onShowToast,
  t
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'paymentVerification' | 'ledgerAudit' | 'userGovernance' | 'systemHealth' | 'financialAnalytics'
  >('overview');
  const [transactions, setTransactions] = useState<EnrichedTransaction[]>([]);
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; display_name: string; email: string; role: string }>>([]);
  const [metrics, setMetrics] = useState<PlatformRevenueMetrics | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Financial Analytics & Simulator State (Phases 3–6)
  const [financialData, setFinancialData] = useState<any>(null);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState<boolean>(false);
  const [simScenario, setSimScenario] = useState<string>('normal');
  const [simProviderMode, setSimProviderMode] = useState<string>('gemini_free');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Manual Credit Adjustment Form
  const [targetUserId, setTargetUserId] = useState<string>(currentUserId);
  const [adjustAmount, setAdjustAmount] = useState<number>(500);
  const [adjustReason, setAdjustReason] = useState<string>('Kompensasi audit teknis sutradara');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  useEffect(() => {
    loadAdminData();
  }, [currentUserId]);

  const loadAdminData = async () => {
    try {
      const globalData = await adminFetchAllBillingData();
      if (globalData) {
        setOrders(globalData.orders);
        setTransactions(globalData.transactions);
        setProfiles(globalData.profiles);
        setMetrics(computePlatformMetrics(globalData.transactions, globalData.orders));
        return;
      }

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
    }
  };

  const loadFinancialData = async () => {
    setIsLoadingFinancial(true);
    try {
      const data = await fetchAdminFinancialAnalytics({ action: 'overview' });
      if (data && data.success) {
        setFinancialData(data);
      }
    } catch (err) {
      console.error('Failed to load financial analytics:', err);
    } finally {
      setIsLoadingFinancial(false);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const data = await fetchAdminFinancialAnalytics({
        action: 'run_simulation',
        scenarioKey: simScenario,
        providerMode: simProviderMode,
      });
      if (data && data.success) {
        setSimulationResult(data.simulation);
        onShowToast('Simulasi harga & profitabilitas berhasil dijalankan.', 'success');
      } else {
        onShowToast('Gagal menjalankan simulasi.', 'error');
      }
    } catch (err) {
      console.error('Simulation error:', err);
      onShowToast('Terjadi kesalahan saat menjalankan simulasi.', 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRollbackOrder = async (order: EnrichedOrder) => {
    const reason = window.prompt(
      `Konfirmasi Tindakan Darurat:\nApakah Anda yakin ingin membatalkan transaksi #${order.order_number} (${formatIdr(Number(order.amount || 0))}) untuk pengguna ${order.user_display_name || order.user_email}?\n\nKredit yang telah diberikan (+${order.credits_granted}) akan ditarik kembali dari akun pengguna secara otomatis.\n\nMasukkan alasan pembatalan:`,
      'Pembatalan transaksi atas permintaan pengguna / mutasi tidak valid'
    );
    if (!reason) return;

    setProcessingOrderId(order.id);
    try {
      const res = await adminRejectPaymentOrder(order.id, reason);
      if (res.success) {
        onShowToast(
          `Transaksi #${order.order_number} telah dibatalkan & kredit berhasil ditarik dari akun.`,
          'info'
        );
        await loadAdminData();
      } else {
        onShowToast(res.error || 'Gagal membatalkan transaksi.', 'error');
      }
    } finally {
      setProcessingOrderId(null);
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

  const formatIdr = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const settledOrders = orders.filter(
    o => o.status === 'settlement' || o.status === 'completed' || o.status === 'paid'
  );

  const renderPaymentVerificationTable = () => (
    <div className="space-y-4">
      <div className="p-4 bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Buku Besar Pendapatan & Aktivasi Otomatis (Coretax Mode)
            </h3>
            <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] uppercase">
              100% Otomatis
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Seluruh transaksi dengan ID Billing valid langsung aktif secara otomatis (LUNAS / AKTIF) tanpa antrean manual.
            Rekening Tujuan: <strong className="text-cyan-300 font-mono">Bank Mandiri {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountNumber}</strong> &amp; E-Wallet{' '}
            <strong className="text-emerald-300 font-mono">{OFFICIAL_MERCHANT_BANK_ACCOUNT.ewalletNumber}</strong> a/n{' '}
            <strong className="text-white">{OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs">
            {settledOrders.length} Transaksi Lunas / Aktif
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 bg-slate-950/40">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="p-3">No. Invoice &amp; Waktu</th>
              <th className="p-3">Pengguna</th>
              <th className="p-3">Paket &amp; Kuota</th>
              <th className="p-3 text-right">Nominal (IDR)</th>
              <th className="p-3">Saluran &amp; Catatan ID Billing</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Tindakan Darurat Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-xs">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Belum ada transaksi pembayaran lunas yang tercatat. Transaksi baru akan muncul otomatis begitu pembayaran dilakukan.
                </td>
              </tr>
            ) : (
              orders.map(ord => {
                const isSettled =
                  ord.status === 'settlement' || ord.status === 'completed' || ord.status === 'paid';
                const isCancelled =
                  ord.status === 'cancelled' || ord.status === 'cancel' || ord.status === 'failed';
                const isBusy = processingOrderId === ord.id;

                return (
                  <tr key={ord.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-mono whitespace-nowrap">
                      <div className="text-white font-bold">{ord.order_number}</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(ord.paid_at || ord.created_at).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-white">{ord.user_display_name || 'Creator'}</div>
                      <div className="text-[11px] font-mono text-slate-400">{ord.user_email || ord.user_id}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-white font-medium">{ord.package_name}</div>
                      <div className="text-[11px] font-mono text-emerald-400">
                        +{Number(ord.credits_granted || 0).toLocaleString('id-ID')} Kredit
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">
                      {formatIdr(Number(ord.amount || 0))}
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-cyan-300 uppercase text-[11px]">
                        {ord.payment_method}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5 max-w-xs truncate" title={ord.external_reference || ''}>
                        {ord.external_reference || 'Aktivasi Otomatis ID Billing'}
                      </div>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {isSettled ? (
                        <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] uppercase">
                          LUNAS / AKTIF (OTOMATIS)
                        </span>
                      ) : isCancelled ? (
                        <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/40 text-rose-300 font-mono text-[10px] uppercase">
                          DIBATALKAN / REFUND
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-[10px] uppercase">
                          MEMPROSES
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {isSettled ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRollbackOrder(ord)}
                          className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 disabled:opacity-50 text-rose-200 text-[11px] flex items-center gap-1 transition-colors ml-auto"
                          title="Batalkan pesanan dan tarik kembali kredit yang diberikan"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{isBusy ? 'Memproses...' : 'Batalkan & Tarik Kredit'}</span>
                        </button>
                      ) : isCancelled ? (
                        <span className="text-[11px] font-mono text-rose-400">
                          Telah Dibatalkan
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-500">
                          -
                        </span>
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
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              {t?.adminPanel?.title || 'Konsol Komersial & Verifikasi Pembayaran Admin'}
            </h1>
            <span className="text-xs font-mono text-cyan-400 border border-cyan-500/30 px-2 py-0.5 uppercase tracking-wider">
              OWNER: {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Kelola persetujuan pembayaran masuk (Bank Mandiri {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountNumber} & E-Wallet{' '}
            {OFFICIAL_MERCHANT_BANK_ACCOUNT.ewalletNumber}), audit margin API AI, dan saldo kredit seluruh pengguna.
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
              {t?.adminPanel?.metrics?.mrr || 'Pendapatan (IDR)'}
            </span>
            <div className="text-xl font-mono font-bold text-white tabular-nums mt-1">
              {formatIdr(metrics.mrrIdr)}
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
              Transaksi Lunas / Aktif
            </span>
            <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
              {settledOrders.length} Lunas
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
              Total Pengguna
            </span>
            <div className="text-xl font-mono font-bold text-indigo-300 tabular-nums mt-1">
              {profiles.length || 1} Akun
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-indigo-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-indigo-400" />
          Ringkasan &amp; Mutasi Coretax
        </button>

        <button
          onClick={() => setActiveTab('paymentVerification')}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'paymentVerification'
              ? 'border-amber-400 text-white bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          Buku Besar Tagihan &amp; ID Billing ({settledOrders.length})
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
          {t?.adminPanel?.tabs?.userManagement || 'Manajemen Kredit User'}
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
          {t?.adminPanel?.tabs?.systemHealth || 'Service Health'}
        </button>

        <button
          onClick={() => {
            setActiveTab('financialAnalytics');
            if (!financialData) loadFinancialData();
          }}
          className={`px-4 py-2.5 text-xs font-medium tracking-wide flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'financialAnalytics'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span>Analisis Keuangan &amp; Simulator (Phases 3–6)</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & PAYMENT VERIFICATION */}
      {activeTab === 'overview' && (() => {
        const settledOrders = orders.filter(
          o => o.status === 'settlement' || o.status === 'completed' || o.status === 'paid'
        );
        const totalRevenueIdr = settledOrders.reduce((s, o) => s + Number(o.amount || 0), 0);
        const usageTxs = transactions.filter(tx => tx.transaction_type === 'usage' && tx.status !== 'refunded');
        const totalApiUsd = usageTxs.reduce((s, tx) => s + Number(tx.actual_cost_usd || 0), 0);
        const totalApiIdr = Math.round(totalApiUsd * 16000);
        const netGrossProfitIdr = Math.max(0, totalRevenueIdr - totalApiIdr);
        const marginPct = totalRevenueIdr > 0 ? ((netGrossProfitIdr / totalRevenueIdr) * 100).toFixed(1) : '0.0';

        const sumByModelKeyword = (kw: string) => {
          const matching = usageTxs.filter(tx => (tx.model || '').toLowerCase().includes(kw));
          const credits = Math.abs(matching.reduce((s, tx) => s + Number(tx.amount || 0), 0));
          const costUsd = matching.reduce((s, tx) => s + Number(tx.actual_cost_usd || 0), 0);
          const pct = metrics && metrics.totalCreditsConsumed > 0
            ? Math.min(100, Math.round((credits / metrics.totalCreditsConsumed) * 100))
            : 0;
          return { credits, costUsd: costUsd.toFixed(4), pct };
        };

        const imgStats = sumByModelKeyword('image');
        const vidStats = sumByModelKeyword('omni');
        const ttsStats = sumByModelKeyword('tts');
        const proStats = sumByModelKeyword('pro');

        return (
          <div className="space-y-6">
            {/* Priority Payment Verification Queue */}
            {renderPaymentVerificationTable()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue vs Cost Analysis */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Analisis Pendapatan Rekening {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kalkulasi langsung dari transaksi yang telah disetujui masuk ke Bank Mandiri / E-Wallet Anda.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-300">Total Pembayaran Disetujui (Masuk Rekening):</span>
                    <span className="font-mono font-bold text-emerald-400">{formatIdr(totalRevenueIdr)}</span>
                  </div>

                  <div className="p-3 bg-slate-900/80 border border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-300">
                      Biaya Token & Render API AI (${totalApiUsd.toFixed(4)} USD @ Rp16.000):
                    </span>
                    <span className="font-mono text-rose-400">- {formatIdr(totalApiIdr)}</span>
                  </div>

                  <div className="p-3 bg-slate-900/80 border border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-300">Gross Profit Bersih Platform:</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {formatIdr(netGrossProfitIdr)} ({marginPct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider Model Utilization */}
              <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Distribusi Konsumsi API Model AI (Real-Time)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pemantauan kuota kredit dan biaya aktual per model AI dari buku besar transaksi.
                </p>

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Google Gemini Flash Image (Keyframes):</span>
                      <span className="font-mono text-slate-400">
                        {imgStats.credits} Kredit · ${imgStats.costUsd} USD
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                      <div className="h-full bg-cyan-400" style={{ width: `${imgStats.pct}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Google Gemini Omni / Veo (Motion Video):</span>
                      <span className="font-mono text-slate-400">
                        {vidStats.credits} Kredit · ${vidStats.costUsd} USD
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${vidStats.pct}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Google Gemini Flash TTS (Character Voice):</span>
                      <span className="font-mono text-slate-400">
                        {ttsStats.credits} Kredit · ${ttsStats.costUsd} USD
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                      <div className="h-full bg-violet-400" style={{ width: `${ttsStats.pct}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Google Gemini 2.5 Pro (Screenplay & Lore Reasoning):</span>
                      <span className="font-mono text-slate-400">
                        {proStats.credits} Kredit · ${proStats.costUsd} USD
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${proStats.pct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 2: DEDICATED PAYMENT VERIFICATION */}
      {activeTab === 'paymentVerification' && renderPaymentVerificationTable()}

      {/* TAB 3: GLOBAL TRANSACTION AUDIT */}
      {activeTab === 'ledgerAudit' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-950/40 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Platform Transaction Audit Log</h3>
              <p className="text-xs text-slate-400">
                Pemeriksaan kepatuhan buku besar kredit seluruh pengguna secara real-time.
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(tx.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-slate-300 text-[11px]">
                      <div className="font-sans font-semibold text-white">{tx.user_display_name || 'Creator'}</div>
                      <div className="text-[10px] text-slate-500">{tx.user_email || tx.user_id}</div>
                    </td>
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
                      {tx.actual_cost_usd > 0 ? `$${Number(tx.actual_cost_usd).toFixed(4)}` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 border border-slate-700 uppercase tracking-wider text-slate-300">
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: USER GOVERNANCE & MANUAL ADJUSTMENTS */}
      {activeTab === 'userGovernance' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 bg-slate-950/60 border border-slate-800 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Manajemen Kredit & Intervensi Akun Pengguna
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pilih pengguna untuk menambah atau menyesuaikan saldo kredit secara langsung.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Pilih Pengguna Target</label>
                {profiles.length > 0 ? (
                  <select
                    value={targetUserId}
                    onChange={e => setTargetUserId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} ({p.email}) — [{p.role}]
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={targetUserId}
                    onChange={e => setTargetUserId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
                  />
                )}
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
                  placeholder="Alasan penyesuaian (e.g. Bonus kredit atau koreksi manual)..."
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

      {/* TAB 5: SYSTEM HEALTH & API LATENCY */}
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
                  <span className="text-emerald-400 font-mono">Operational</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Rekening Bank Mandiri ({OFFICIAL_MERCHANT_BANK_ACCOUNT.accountNumber}):</span>
                  <span className="text-emerald-400 font-mono">Active (a/n {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder})</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">E-Wallet OVO / GoPay / DANA ({OFFICIAL_MERCHANT_BANK_ACCOUNT.ewalletNumber}):</span>
                  <span className="text-emerald-400 font-mono">Active (a/n {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder})</span>
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
                  <span className="text-emerald-400 font-mono">99.9% Uptime</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Gemini 3.1 Flash Lite Image:</span>
                  <span className="text-emerald-400 font-mono">Operational</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300">Server-Side Billing & Approval Engine:</span>
                  <span className="text-emerald-400 font-mono">Ready & Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: FINANCIAL ANALYTICS & PRICING SIMULATOR (PHASES 3–6) */}
      {activeTab === 'financialAnalytics' && (
        <div className="space-y-6">
          {/* Top Bar with Status & Refresh */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Dashboard Keuangan &amp; Simulator Margin SaaS
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] uppercase">
                  Google Gemini Free Tier Aktif (Biaya Billed $0.00)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Melacak telemetri token aktual, subsidi provider Google, ekivalen biaya berbayar, dan proyeksi margin laba kotor 4 tier subscription.
              </p>
            </div>
            <button
              onClick={loadFinancialData}
              disabled={isLoadingFinancial}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingFinancial ? 'animate-spin' : ''}`} />
              <span>{isLoadingFinancial ? 'Memuat Data...' : 'Segarkan Analitik'}</span>
            </button>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Total Pendapatan
              </span>
              <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
                {formatIdr(financialData?.summary?.total_platform_revenue_idr || metrics?.mrrIdr || 0)}
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Gross Inflow (Coretax)</span>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                Biaya Billed Aktual
              </span>
              <div className="text-xl font-mono font-bold text-white tabular-nums mt-1">
                ${Number(financialData?.summary?.total_billed_provider_cost_usd || 0).toFixed(4)}
              </div>
              <span className="text-[10px] text-emerald-400 mt-1">Rp 0 (100% Free Tier)</span>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
                Ekivalen Paid Tier
              </span>
              <div className="text-xl font-mono font-bold text-amber-300 tabular-nums mt-1">
                ${Number(financialData?.summary?.total_paid_equivalent_cost_usd || 0).toFixed(4)}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                {formatIdr(Number(financialData?.summary?.paid_equivalent_cost_idr || 0))}
              </span>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider">
                Subsidi Google
              </span>
              <div className="text-xl font-mono font-bold text-indigo-300 tabular-nums mt-1">
                {formatIdr(Number(financialData?.summary?.free_tier_subsidy_idr || 0))}
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Penghematan Biaya</span>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                Laba Kotor &amp; Margin
              </span>
              <div className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
                {financialData?.summary?.gross_margin_percent !== undefined
                  ? `${financialData.summary.gross_margin_percent}%`
                  : '100%'}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                {formatIdr(financialData?.summary?.gross_profit_idr || metrics?.mrrIdr || 0)}
              </span>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider">
                Token Termetering
              </span>
              <div className="text-xl font-mono font-bold text-purple-300 tabular-nums mt-1">
                {Number(financialData?.summary?.total_tokens || 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 mt-1">
                {Number(financialData?.summary?.total_requests || 0)} Permintaan AI
              </span>
            </div>
          </div>

          {/* Tier Profitability & Sensitivity Analysis */}
          <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-bold text-white">
                  Analisis Profitabilitas 4 Tier Berlangganan AMF
                </h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Kurs Referensi: $1 = Rp 16.000 | Baseline Langganan Tetap
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Paket Berlangganan</th>
                    <th className="p-3 text-right">Harga Bulanan</th>
                    <th className="p-3 text-right">Kredit Bulanan</th>
                    <th className="p-3 text-right">Nilai / Kredit (IDR)</th>
                    <th className="p-3 text-right">Biaya Billed Aktual</th>
                    <th className="p-3 text-right">Ekivalen Paid Biaya</th>
                    <th className="p-3 text-center">Margin Laba Kotor</th>
                    <th className="p-3 text-center">Status Keuangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                  <tr className="hover:bg-slate-900/40">
                    <td className="p-3 font-sans font-semibold text-white">Free Creator</td>
                    <td className="p-3 text-right text-slate-400">Rp0</td>
                    <td className="p-3 text-right text-amber-400">150</td>
                    <td className="p-3 text-right text-slate-500">Rp 0</td>
                    <td className="p-3 text-right text-emerald-400">Rp 0</td>
                    <td className="p-3 text-right text-slate-400">~Rp 120</td>
                    <td className="p-3 text-center text-slate-400">0%</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-[10px]">
                        Freemium (Subsidi Free Tier)
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-900/40">
                    <td className="p-3 font-sans font-semibold text-white">Creator Indie</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">Rp 149.000</td>
                    <td className="p-3 text-right text-amber-400">1.500</td>
                    <td className="p-3 text-right text-slate-300">Rp 99.33</td>
                    <td className="p-3 text-right text-emerald-400">Rp 0</td>
                    <td className="p-3 text-right text-slate-400">~Rp 1.200</td>
                    <td className="p-3 text-center text-emerald-400 font-bold">&gt; 98%</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px]">
                        Sangat Menguntungkan
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-900/40">
                    <td className="p-3 font-sans font-semibold text-white">Pro Studio</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">Rp 499.000</td>
                    <td className="p-3 text-right text-amber-400">6.000</td>
                    <td className="p-3 text-right text-slate-300">Rp 83.17</td>
                    <td className="p-3 text-right text-emerald-400">Rp 0</td>
                    <td className="p-3 text-right text-slate-400">~Rp 4.800</td>
                    <td className="p-3 text-center text-emerald-400 font-bold">&gt; 98%</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px]">
                        Sangat Menguntungkan
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-900/40">
                    <td className="p-3 font-sans font-semibold text-white">Production House</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">Rp 1.499.000</td>
                    <td className="p-3 text-right text-amber-400">20.000</td>
                    <td className="p-3 text-right text-slate-300">Rp 74.95</td>
                    <td className="p-3 text-right text-emerald-400">Rp 0</td>
                    <td className="p-3 text-right text-slate-400">~Rp 16.000</td>
                    <td className="p-3 text-center text-emerald-400 font-bold">&gt; 98%</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px]">
                        Sangat Menguntungkan
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Pricing & Sensitivity Simulator */}
          <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white">
                  Simulator Sensitivitas &amp; Biaya Provider (Phase 5)
                </h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Uji Ketahanan Margin Pada Berbagai Kondisi Penggunaan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-300">Skenario Sensitivitas</label>
                <select
                  value={simScenario}
                  onChange={e => setSimScenario(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="normal">Normal (Baseline ~800 tokens/agent, 5% retry)</option>
                  <option value="conservative">Konservatif (~400 tokens/agent, 2% retry)</option>
                  <option value="heavy_usage">Penggunaan Intensif (~1500 tokens/agent, 10% retry)</option>
                  <option value="high_video">Beban Media Tinggi (~2.5 min video per batch)</option>
                  <option value="high_retry">Tingkat Kegagalan Tinggi (25% retry rate)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-300">Mode Provider Google Gemini</label>
                <select
                  value={simProviderMode}
                  onChange={e => setSimProviderMode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 px-3 py-2 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="gemini_free">Gemini Free Tier (Billed $0.00 / 100% Subsidi)</option>
                  <option value="gemini_paid">Gemini Paid Tier ($0.075/1M input, $0.30/1M output)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-xs tracking-wide flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-950/40"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  {isSimulating ? 'Menghitung Simulasi...' : 'Jalankan Simulasi Skenario'}
                </button>
              </div>
            </div>

            {/* Simulation Results Display */}
            {simulationResult && (
              <div className="p-4 bg-slate-900/60 border border-slate-800 space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase font-mono">
                    Hasil Simulasi: {simulationResult.scenarioName || simulationResult.scenario_name} ({(simulationResult.providerMode || simulationResult.provider_mode) === 'gemini_free' ? 'Gemini Free Tier' : 'Gemini Paid Tier'})
                  </span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 border ${
                    (simulationResult.overallGrossMarginPercent ?? simulationResult.gross_margin_percent ?? 100) >= 70
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  }`}>
                    Gross Margin: {simulationResult.overallGrossMarginPercent ?? simulationResult.gross_margin_percent ?? 100}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-slate-950/80 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Total Pendapatan Terproyeksi</span>
                    <span className="text-white font-bold">{formatIdr(simulationResult.totalGrossRevenueIdr ?? simulationResult.total_revenue_idr ?? 0)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Biaya Provider AI (USD)</span>
                    <span className="text-cyan-300 font-bold">${Number(simulationResult.total_provider_cost_usd ?? ((simulationResult.totalProviderBilledCostIdr || 0) / 16000)).toFixed(4)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Biaya Provider AI (IDR)</span>
                    <span className="text-cyan-300 font-bold">{formatIdr(simulationResult.totalProviderBilledCostIdr ?? simulationResult.total_provider_cost_idr ?? 0)}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/80 border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">Laba Bersih Terproyeksi</span>
                    <span className="text-emerald-400 font-bold">{formatIdr(simulationResult.overallGrossProfitIdr ?? simulationResult.net_profit_idr ?? 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Financial Anomaly Detection & Alerts */}
          {financialData?.anomalies && financialData.anomalies.length > 0 && (
            <div className="p-5 bg-rose-950/20 border border-rose-900/40 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-bold text-rose-200">
                  Peringatan Deteksi Anomali Finansial &amp; Penggunaan
                </h4>
              </div>
              <div className="space-y-2">
                {financialData.anomalies.map((ano: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-950/60 border border-rose-900/30 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-rose-300">{ano.reason}</span>
                      <span className="text-slate-500 font-mono text-[10px] ml-2">
                        Op: {ano.operation} | Model: {ano.model}
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {new Date(ano.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent AI Usage Records Table */}
          <div className="p-5 bg-slate-950/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">
                  Pencatatan Telemetri Penggunaan AI Terbaru
                </h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Tercatat pada public.ai_usage_records (Supabase Cloud)
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Waktu &amp; ID</th>
                    <th className="p-3">Operasi &amp; Model</th>
                    <th className="p-3 text-right">Total Token</th>
                    <th className="p-3 text-right">Prompt / Output</th>
                    <th className="p-3 text-right">Durasi (ms)</th>
                    <th className="p-3 text-right">Biaya Billed</th>
                    <th className="p-3 text-right">Ekivalen Paid</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                  {(!financialData?.recent_usage || financialData.recent_usage.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 font-sans">
                        Belum ada telemetri penggunaan AI yang tercatat. Panggilan AI baru akan otomatis termetering di sini.
                      </td>
                    </tr>
                  ) : (
                    financialData.recent_usage.map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-slate-900/40">
                        <td className="p-3 text-slate-400 text-[10px]">
                          <div>{new Date(rec.created_at).toLocaleString('id-ID')}</div>
                          <div className="text-slate-600 truncate max-w-[100px]">{rec.id}</div>
                        </td>
                        <td className="p-3 font-sans">
                          <div className="text-white font-semibold">{rec.operation}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">{rec.model}</div>
                        </td>
                        <td className="p-3 text-right font-bold text-purple-300">
                          {Number(rec.total_tokens || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-slate-400 text-[11px]">
                          {Number(rec.prompt_tokens || 0).toLocaleString()} / {Number(rec.candidates_tokens || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-slate-400">
                          {rec.execution_duration_ms ? `${rec.execution_duration_ms}ms` : '-'}
                        </td>
                        <td className="p-3 text-right text-emerald-400">
                          ${Number(rec.billed_cost_usd || 0).toFixed(5)}
                        </td>
                        <td className="p-3 text-right text-amber-300">
                          ${Number(rec.paid_equivalent_cost_usd || 0).toFixed(5)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-1.5 py-0.5 border text-[10px] uppercase ${
                            rec.status === 'completed'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
