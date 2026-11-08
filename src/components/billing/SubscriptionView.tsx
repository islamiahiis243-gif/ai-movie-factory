import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import {
  SubscriptionPlan,
  SubscriptionTier,
  UserSubscription,
  PaymentOrder
} from '../../types/database';
import { SUBSCRIPTION_PLANS } from '../../lib/billingEngine';
import { fetchUserSubscription, updateUserSubscription } from '../../lib/supabase';
import { PaymentModal } from './PaymentModal';

interface SubscriptionViewProps {
  userId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  language: 'id' | 'en';
  t: any;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  userId,
  onShowToast,
  language,
  t
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  useEffect(() => {
    loadSubscription();
  }, [userId]);

  const loadSubscription = async () => {
    setLoading(true);
    try {
      const res = await fetchUserSubscription(userId);
      if (res.data) setSubscription(res.data);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (subscription?.tier === plan.tier) return;
    if (plan.tier === 'free') {
      updateUserSubscription(userId, { tier: 'free', price_paid: 0, credits_allotted: 150 });
      setSubscription(prev => (prev ? { ...prev, tier: 'free', price_paid: 0, credits_allotted: 150 } : null));
      onShowToast('Paket berhasil diubah ke Free Creator.', 'info');
      return;
    }

    setSelectedPlanForCheckout(plan);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = (order: PaymentOrder) => {
    setIsPaymentModalOpen(false);
    loadSubscription();
    onShowToast(`Langganan ${order.package_name} berhasil diaktifkan!`, 'success');
  };

  const formatIdr = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.tier === subscription?.tier) || SUBSCRIPTION_PLANS[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              {t?.subscription?.title || 'Subscription Plans & Studio Tiers'}
            </h1>
            <span className="text-xs font-mono text-cyan-400 border border-cyan-500/30 px-2 py-0.5 uppercase tracking-wider">
              SSOT Sec. 21 & 23
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {t?.subscription?.subtitle ||
              'Scale generation capacities, monthly credits allotment, and 4K cinematic studio rendering queues.'}
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
            {t?.subscription?.monthly || 'Monthly'}
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
              billingCycle === 'yearly'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{t?.subscription?.yearly || 'Yearly'}</span>
            <span className="text-[10px] font-mono px-1 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              -20%
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
                  {t?.subscription?.currentPlan || 'Current Active Tier'}
                </span>
                <span className="text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 uppercase tracking-wider">
                  {subscription.status}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">{currentPlan.name}</h3>
              <p className="text-xs text-slate-400">
                Alokasi {subscription.credits_allotted.toLocaleString()} kredit bulanan · Tagihan berikutnya:{' '}
                <span className="font-mono text-slate-300">
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>

          <div className="text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-800/80">
            <div className="text-xs text-slate-400">Metode Pembayaran Aktif</div>
            <div className="text-xs font-medium text-white flex items-center md:justify-end gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Midtrans QRIS / Virtual Account Auto-Renew</span>
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
                    <span>Kredit Bulanan:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      {plan.monthlyCredits.toLocaleString()} Kredit
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
                    {t?.subscription?.activePlanBadge || 'Sedang Digunakan'}
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

      {/* Payment Notice Footnote */}
      <div className="p-4 bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="leading-relaxed">
          {t?.subscription?.paymentNotice ||
            'Didukung oleh Midtrans & Stripe dengan verifikasi pembayaran otomatis (QRIS, VA, Kartu Kredit).'}
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
            credits: selectedPlanForCheckout.monthlyCredits
          }}
          onPaymentSuccess={handlePaymentSuccess}
          t={t}
        />
      )}
    </div>
  );
};
