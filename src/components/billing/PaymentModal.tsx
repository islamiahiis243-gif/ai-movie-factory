import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Zap
} from 'lucide-react';
import { PaymentOrder } from '../../types/database';
import { createPaymentOrder, simulateSettlePayment } from '../../lib/supabase';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  item: {
    type: 'subscription' | 'credit_pack';
    id: string;
    name: string;
    priceIdr: number;
    credits: number;
  } | null;
  onPaymentSuccess: (order: PaymentOrder) => void;
  t: any;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  userId,
  item,
  onPaymentSuccess,
  t
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'bca_va' | 'mandiri_va' | 'credit_card'>('qris');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<PaymentOrder | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(900); // 15 mins in seconds

  useEffect(() => {
    if (!isOpen || !item) {
      setCreatedOrder(null);
      setIsProcessing(false);
      setTimeLeft(900);
      return;
    }

    // Auto-create pending order
    const initOrder = async () => {
      const orderNumber = `AMF-${item.type === 'subscription' ? 'SUB' : 'TOP'}-${Date.now().toString().slice(-6)}`;
      const res = await createPaymentOrder(userId, {
        order_number: orderNumber,
        package_type: item.type,
        package_id: item.id,
        package_name: item.name,
        amount: item.priceIdr,
        currency: 'IDR',
        payment_gateway: 'midtrans',
        payment_method: paymentMethod,
        credits_granted: item.credits
      });
      if (res.data) {
        setCreatedOrder(res.data);
      }
    };

    initOrder();
  }, [isOpen, item, paymentMethod, userId]);

  // Countdown timer for pending order
  useEffect(() => {
    if (!createdOrder || createdOrder.status === 'settlement') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdOrder]);

  if (!isOpen || !item) return null;

  const subtotal = item.priceIdr;
  const ppn = Math.round(subtotal * 0.11);
  const grandTotal = subtotal + ppn;

  const formatIdr = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSimulateSettlement = async () => {
    if (!createdOrder) return;
    setIsProcessing(true);
    try {
      const res = await simulateSettlePayment(userId, createdOrder.id);
      if (res.success && res.order) {
        setCreatedOrder(res.order);
        onPaymentSuccess(res.order);
      }
    } catch (err) {
      console.error('Payment settlement error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSettled = createdOrder?.status === 'settlement';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Midtrans & Stripe Secure Gateway Checkout
              </h2>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>Order: {createdOrder?.order_number || 'AMF-PENDING'}</span>
                <span>·</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> 256-Bit SSL Encrypted
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Order Success State */}
          {isSettled ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Pembayaran Berhasil Diverifikasi!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Webhook Midtrans berhasil menerima status settlement. Kuota kredit dan paket Anda telah diaktifkan secara instan.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 max-w-md mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Paket:</span>
                  <span className="text-white font-medium">{item.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Kredit Diberikan:</span>
                  <span className="text-emerald-400 font-mono font-bold">+{item.credits.toLocaleString()} Kredit</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Dibayar:</span>
                  <span className="text-white font-mono">{formatIdr(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Referensi Transaksi:</span>
                  <span className="font-mono text-slate-500 text-[11px]">{createdOrder?.external_reference}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide transition-colors"
              >
                Selesai & Kembali ke Studio
              </button>
            </div>
          ) : (
            <>
              {/* Payment Method Switcher */}
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Pilih Saluran Pembayaran (Payment Method)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => setPaymentMethod('qris')}
                    className={`p-3 border text-left flex flex-col justify-between transition-colors ${
                      paymentMethod === 'qris'
                        ? 'border-amber-400 bg-amber-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-amber-400 mb-2" />
                    <span className="text-xs font-semibold">QRIS</span>
                    <span className="text-[10px] text-slate-500">GoPay, OVO, Dana</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('bca_va')}
                    className={`p-3 border text-left flex flex-col justify-between transition-colors ${
                      paymentMethod === 'bca_va'
                        ? 'border-cyan-400 bg-cyan-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-cyan-400 mb-2" />
                    <span className="text-xs font-semibold">BCA VA</span>
                    <span className="text-[10px] text-slate-500">Virtual Account</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('mandiri_va')}
                    className={`p-3 border text-left flex flex-col justify-between transition-colors ${
                      paymentMethod === 'mandiri_va'
                        ? 'border-blue-400 bg-blue-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-blue-400 mb-2" />
                    <span className="text-xs font-semibold">Mandiri Bill</span>
                    <span className="text-[10px] text-slate-500">Livin / ATM</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('credit_card')}
                    className={`p-3 border text-left flex flex-col justify-between transition-colors ${
                      paymentMethod === 'credit_card'
                        ? 'border-violet-400 bg-violet-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-violet-400 mb-2" />
                    <span className="text-xs font-semibold">Kartu Kredit</span>
                    <span className="text-[10px] text-slate-500">Visa / Mastercard</span>
                  </button>
                </div>
              </div>

              {/* Channel UI */}
              {paymentMethod === 'qris' && (
                <div className="p-5 bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-center gap-6">
                  <div className="bg-white p-3 border border-slate-700 shrink-0">
                    {/* Visual QR Code representation */}
                    <div className="w-36 h-36 bg-black flex flex-col items-center justify-center p-2 text-center text-white">
                      <QrCode className="w-28 h-28 text-white" />
                    </div>
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-amber-400 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Batas Waktu Bayar: {formatTimer(timeLeft)}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">Pindai Kode QRIS dengan Aplikasi Apapun</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Buka aplikasi BCA Mobile, GoPay, OVO, Dana, ShopeePay, atau m-Banking Anda, lalu arahkan kamera ke kode QR di samping.
                    </p>
                    <div className="text-[11px] font-mono text-slate-500">
                      NMID: ID102003889124 · Merchant: AI Movie Factory Studio
                    </div>
                  </div>
                </div>
              )}

              {(paymentMethod === 'bca_va' || paymentMethod === 'mandiri_va') && (
                <div className="p-5 bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Nomor Virtual Account ({paymentMethod === 'bca_va' ? 'BCA' : 'Mandiri'}):</span>
                    <span className="text-amber-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {formatTimer(timeLeft)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 font-mono text-sm text-cyan-300">
                    <span className="tracking-wider">
                      {paymentMethod === 'bca_va' ? '8801 2994 0019 4482' : '7001 2004 8812 9901'}
                    </span>
                    <button
                      onClick={() =>
                        handleCopy(paymentMethod === 'bca_va' ? '8801299400194482' : '7001200488129901')
                      }
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Transfer tepat sesuai nominal tagihan hingga digit terakhir. Sistem akan memverifikasi secara otomatis dalam &lt; 5 detik setelah pembayaran berhasil.
                  </p>
                </div>
              )}

              {paymentMethod === 'credit_card' && (
                <div className="p-5 bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Nomor Kartu Kredit</label>
                    <input
                      type="text"
                      readOnly
                      value="•••• •••• •••• 4242 (Stripe Test Sandbox)"
                      className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 px-3 py-2 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Berlaku Hingga</label>
                      <input
                        type="text"
                        readOnly
                        value="12 / 28"
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 px-3 py-2 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">CVC</label>
                      <input
                        type="text"
                        readOnly
                        value="•••"
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-300 px-3 py-2 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="p-4 bg-slate-950/40 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Item / Paket:</span>
                  <span className="text-white font-medium">{item.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Kredit Diterima:</span>
                  <span className="text-emerald-400 font-mono">+{item.credits.toLocaleString()} Kredit</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-300">{formatIdr(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>PPN 11%:</span>
                  <span className="font-mono text-slate-300">{formatIdr(ppn)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-semibold text-white">
                  <span>Total Tagihan:</span>
                  <span className="font-mono text-amber-400">{formatIdr(grandTotal)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isSettled && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Batalkan
            </button>

            <button
              onClick={handleSimulateSettlement}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-semibold text-xs tracking-wide flex items-center gap-2 transition-colors shadow-lg shadow-amber-950/40"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isProcessing ? 'Memverifikasi Pembayaran...' : 'Simulasikan Pembayaran Berhasil (Webhook Settle)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
