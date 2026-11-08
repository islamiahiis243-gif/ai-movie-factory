import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  FileText,
  Printer,
  Receipt
} from 'lucide-react';
import {
  SubscriptionPlan,
  UserSubscription,
  PaymentOrder
} from '../../types/database';
import { SUBSCRIPTION_PLANS } from '../../lib/billingEngine';
import { fetchUserSubscription, updateUserSubscription, fetchPaymentOrders } from '../../lib/supabase';
import { PaymentModal, printIndonesianTaxInvoice } from './PaymentModal';

interface SubscriptionViewProps {
  userId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  language: 'id' | 'en';
  t: any;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  userId,
  onShowToast,
  t
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [, setLoading] = useState<boolean>(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  useEffect(() => {
    loadSubscriptionAndOrders();
  }, [userId]);

  const loadSubscriptionAndOrders = async () => {
    setLoading(true);
    try {
      const [subRes, ordRes] = await Promise.all([
        fetchUserSubscription(userId),
        fetchPaymentOrders(userId)
      ]);
      if (subRes.data) setSubscription(subRes.data);
      if (ordRes.data) setPaymentOrders(ordRes.data);
    } catch (err) {
      console.error('Failed to load subscription & orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (subscription?.tier === plan.tier) return;
    if (plan.tier === 'free') {
      await updateUserSubscription(userId, { tier: 'free', price_paid: 0, credits_allotted: 150 });
      setSubscription(prev => (prev ? { ...prev, tier: 'free', price_paid: 0, credits_allotted: 150 } : null));
      onShowToast('Paket berhasil diubah ke Free Creator.', 'info');
      return;
    }

    setSelectedPlanForCheckout(plan);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (order: PaymentOrder) => {
    setIsPaymentModalOpen(false);
    loadSubscriptionAndOrders();
    onShowToast(`Langganan ${order.package_name} berhasil diaktifkan!`, 'success');
  };

  const formatIdr = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.tier === subscription?.tier) || SUBSCRIPTION_PLANS[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              {t?.subscription?.title || 'Paket Langganan & Tagihan Studio'}
            </h1>
            <span className="text-xs font-mono text-cyan-400 border border-cyan-500/30 px-2 py-0.5 uppercase tracking-wider">
              Standar Flagship Indonesia
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {t?.subscription?.subtitle ||
              'Tingkatkan kapasitas kuota kredit produksi, resolusi master 4K/ProRes, dan antrean GPU dengan pembayaran QRIS, Virtual Account (BCA, Mandiri, BNI, BRI), E-Wallet, atau Kartu Kredit.'}
          </p>
        </div>

        {/* Monthly / Yearly Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 self-start md:self-auto shrink-0">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 text-xs font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t?.subscription?.monthly || 'Bulanan'}
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{t?.subscription?.yearly || 'Tahunan'}</span>
            <span className="text-[10px] font-mono px-1 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Hemat 20%
            </span>
          </button>
        </div>
      </div>

      {/* Current Subscription Status Banner */}
      {subscription && (
        <div className="p-5 bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  {t?.subscription?.currentPlan || 'Paket Aktif Saat Ini'}
                </span>
                <span className="text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 uppercase tracking-wider">
                  {subscription.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">{currentPlan.name}</h3>
              <p className="text-xs text-slate-400">
                Alokasi {subscription.credits_allotted.toLocaleString('id-ID')} kredit · Siklus aktif hingga:{' '}
                <span className="font-mono text-slate-300">
                  {new Date(subscription.current_period_end).toLocaleDateString('id-ID')}
                </span>
              </p>
            </div>
          </div>

          <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-800/80">
            <div className="text-xs text-slate-400">Saluran Pembayaran Terdaftar</div>
            <div className="text-xs font-medium text-white flex items-center md:justify-end gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {subscription.tier === 'free'
                  ? 'Paket Gratis (Rp 0 / Tanpa Tagihan Berulang)'
                  : `Midtrans (${String(subscription.payment_method || 'qris').toUpperCase()})`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SUBSCRIPTION_PLANS.map(plan => {
          const isCurrent = subscription?.tier === plan.tier;
          const price = billingCycle === 'monthly' ? plan.monthlyPriceIdr : Math.round(plan.yearlyPriceIdr / 12);
          const totalYearly = plan.yearlyPriceIdr;

          return (
            <div
              key={plan.id}
              className={`p-6 bg-slate-950/50 border flex flex-col justify-between transition-all relative ${
                isCurrent
                  ? 'border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-950/20'
                  : plan.recommended
                  ? 'border-amber-500/50 bg-amber-950/10 shadow-lg shadow-amber-950/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-widest">
                  Pilihan Utama
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 min-h-[32px] leading-relaxed">
                    {plan.tagline}
                  </p>
                </div>

                {/* Price */}
                <div className="py-2 border-y border-slate-800/80">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-bold text-white tracking-tight">
                      {price === 0 ? 'Gratis' : formatIdr(price)}
                    </span>
                    {price > 0 && (
                      <span className="text-xs text-slate-500 font-mono">/ bln</span>
                    )}
                  </div>
                  {billingCycle === 'yearly' && price > 0 && (
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Ditagih {formatIdr(totalYearly)} / tahun
                    </div>
                  )}
                </div>

                {/* Quotas */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Kredit Produksi:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {(billingCycle === 'yearly' && plan.tier !== 'free'
                        ? plan.monthlyCredits * 12
                        : plan.monthlyCredits
                      ).toLocaleString('id-ID')}{' '}
                      Kredit
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Resolusi Maks:</span>
                    <span className="text-slate-200 font-medium">{plan.maxResolution}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Render Simultan:</span>
                    <span className="text-slate-200 font-mono">{plan.maxConcurrentJobs} Job</span>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2 pt-2 border-t border-slate-900">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    Fitur Paket:
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider cursor-default"
                  >
                    {t?.subscription?.activePlanBadge || 'Paket Aktif'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-2 text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5 ${
                      plan.recommended
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    <span>{t?.subscription?.upgradeBtn || 'Pilih Paket Ini'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Riwayat Tagihan & Faktur Pajak PPN 11% */}
      <div className="bg-slate-950/60 border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Riwayat Tagihan & Faktur Pajak Elektronik (PPN 11%)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total Transaksi: {paymentOrders.length}
          </span>
        </div>

        {paymentOrders.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-800 text-xs text-slate-500">
            Belum ada riwayat tagihan berbayar (0 transaksi). Pilih paket langganan atau top-up kredit untuk mulai bertransaksi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-3">No. Invoice</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Paket / Layanan</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3">Nominal (IDR)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Faktur Pajak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paymentOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-3 font-mono text-slate-200">{ord.order_number}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(ord.paid_at || ord.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">{ord.package_name}</td>
                    <td className="py-2.5 px-3 font-mono text-cyan-400 uppercase">
                      {ord.payment_method}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-white">{formatIdr(ord.amount)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono uppercase border ${
                          ord.status === 'settlement' || ord.status === 'completed'
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-950/40 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {ord.status === 'settlement' ? 'LUNAS' : ord.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {(ord.status === 'settlement' || ord.status === 'completed') && (
                        <button
                          onClick={() => printIndonesianTaxInvoice(ord)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono transition-colors"
                        >
                          <Printer className="w-3 h-3 text-amber-400" />
                          <span>Cetak Faktur</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Notice Footnote */}
      <div className="p-4 bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-3">
        <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="leading-relaxed">
          Seluruh transaksi didukung oleh gerbang pembayaran nasional berstandar Bank Indonesia (QRIS, Virtual Account BCA/Mandiri/BNI/BRI, GoPay, ShopeePay, DANA, OVO, dan Kartu Kredit 3DS 2.0) lengkap dengan Faktur Pajak PPN 11%.
        </p>
      </div>

      {/* Checkout Modal */}
      {selectedPlanForCheckout && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          userId={userId}
          item={{
            type: 'subscription',
            id: selectedPlanForCheckout.id,
            name: `Langganan ${selectedPlanForCheckout.name} (${billingCycle === 'monthly' ? 'Bulanan' : 'Tahunan'})`,
            priceIdr:
              billingCycle === 'monthly'
                ? selectedPlanForCheckout.monthlyPriceIdr
                : selectedPlanForCheckout.yearlyPriceIdr,
            credits:
              billingCycle === 'monthly'
                ? selectedPlanForCheckout.monthlyCredits
                : selectedPlanForCheckout.monthlyCredits * 12,
            billingCycle
          }}
          onPaymentSuccess={handlePaymentSuccess}
          t={t}
        />
      )}
    </div>
  );
};
