import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  QrCode,
  Building2,
  Wallet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  FileText,
  Printer,
  Zap
} from 'lucide-react';
import { PaymentOrder, IndonesianPaymentMethod } from '../../types/database';
import { createPaymentOrder, simulateSettlePayment } from '../../lib/supabase';
import { INDONESIAN_PAYMENT_CHANNELS } from '../../lib/billingEngine';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  item: {
    type: 'subscription' | 'credit_pack' | 'topup_credits';
    id: string;
    name: string;
    priceIdr: number;
    credits: number;
    billingCycle?: 'monthly' | 'yearly';
  } | null;
  onPaymentSuccess: (order: PaymentOrder) => void;
  t: any;
}

export function printIndonesianTaxInvoice(order: PaymentOrder) {
  const subtotal = Number(order.amount || 0);
  const dpp = Math.round(subtotal / 1.11);
  const ppn = subtotal - dpp;
  const formatIdr = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Faktur Pajak & Invoice Resmi - ${order.order_number}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 40px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
    .badge { display: inline-block; background: #059669; color: #fff; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; font-size: 13px; }
    th { background: #f1f5f9; font-weight: 700; }
    .totals { margin-top: 20px; width: 340px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .totals .grand { font-weight: 800; font-size: 15px; border-top: 2px solid #0f172a; padding-top: 10px; }
    .footer { margin-top: 40px; font-size: 11px; color: #475569; border-top: 1px solid #e2e8f0; padding-top: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">PT AI MOVIE FACTORY INDONESIA</div>
      <div style="font-size:12px;color:#475569;">Gedung Cyber 2 Tower Lt. 18, Jl. H.R. Rasuna Said Blok X-5, Jakarta Selatan 12950</div>
      <div style="font-size:12px;color:#475569;">NPWP: 01.884.920.4-091.000 · PKP Resmi Direktorat Jenderal Pajak RI</div>
    </div>
    <div style="text-align:right;">
      <div class="badge">LUNAS / SETTLED</div>
      <div style="font-size:14px;font-weight:700;margin-top:6px;">INVOICE #${order.order_number}</div>
      <div style="font-size:12px;color:#475569;">Tanggal: ${new Date(order.paid_at || order.created_at).toLocaleString('id-ID')}</div>
    </div>
  </div>
  <div style="font-size:13px;margin-bottom:12px;">
    <strong>Metode Pembayaran:</strong> ${String(order.payment_method || 'qris').toUpperCase()} (${order.payment_gateway.toUpperCase()})<br/>
    <strong>Referensi Settlement:</strong> ${order.external_reference || order.id}
  </div>
  <table>
    <thead>
      <tr>
        <th>Deskripsi Layanan / Paket</th>
        <th>Tipe</th>
        <th>Kuota Kredit</th>
        <th style="text-align:right;">Harga (IDR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${order.package_name}</td>
        <td>${order.package_type === 'subscription' ? 'Langganan Studio' : 'Top-Up Kredit Produksi'}</td>
        <td>+${Number(order.credits_granted || 0).toLocaleString('id-ID')} Kredit</td>
        <td style="text-align:right;">${formatIdr(subtotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    <div><span>Dasar Pengenaan Pajak (DPP):</span><span>${formatIdr(dpp)}</span></div>
    <div><span>PPN 11% (Termasuk):</span><span>${formatIdr(ppn)}</span></div>
    <div><span>Biaya Layanan Gateway:</span><span>Rp 0</span></div>
    <div class="grand"><span>Total Dibayar:</span><span>${formatIdr(subtotal)}</span></div>
  </div>
  <div class="footer">
    Dokumen ini adalah Bukti Pembayaran dan Faktur Pajak Elektronik yang sah serta diterbitkan secara otomatis oleh sistem Billing PT AI Movie Factory Indonesia.
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=840,height=720');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  userId,
  item,
  onPaymentSuccess,
}) => {
  const [activeCategory, setActiveCategory] = useState<'qris' | 'virtual_account' | 'ewallet' | 'card'>('qris');
  const [paymentMethod, setPaymentMethod] = useState<IndonesianPaymentMethod>('qris');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<PaymentOrder | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(900);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState<string>('4532 •••• •••• 8891');
  const [cardExpiry, setCardExpiry] = useState<string>('08/29');
  const [cardCvv, setCardCvv] = useState<string>('889');

  useEffect(() => {
    if (!isOpen || !item) {
      setCreatedOrder(null);
      setIsProcessing(false);
      setErrorMessage(null);
      setTimeLeft(900);
      return;
    }

    const initOrder = async () => {
      setErrorMessage(null);
      const canonicalType = item.type === 'credit_pack' ? 'topup_credits' : item.type;
      const orderNumber = `AMF-${canonicalType === 'subscription' ? 'SUB' : 'TOP'}-${Date.now().toString().slice(-6)}`;
      const res = await createPaymentOrder(userId, {
        order_number: orderNumber,
        package_type: canonicalType,
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
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    };

    initOrder();
  }, [isOpen, item, paymentMethod, userId]);

  useEffect(() => {
    if (!createdOrder || createdOrder.status === 'settlement') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdOrder]);

  if (!isOpen || !item) return null;

  const totalAmount = item.priceIdr;
  const dppAmount = Math.round(totalAmount / 1.11);
  const ppnAmount = totalAmount - dppAmount;

  const formatIdr = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const selectedChannel =
    INDONESIAN_PAYMENT_CHANNELS.find(c => c.id === paymentMethod) || INDONESIAN_PAYMENT_CHANNELS[0];

  const getVirtualAccountNumber = (method: IndonesianPaymentMethod) => {
    const suffix = (createdOrder?.order_number || '881920').replace(/\D/g, '').padEnd(6, '8').slice(-6);
    if (method === 'bca_va') return `3901 0812 ${suffix}`;
    if (method === 'mandiri_va') return `7001 2088 ${suffix}`;
    if (method === 'bni_va') return `8808 0091 ${suffix}`;
    if (method === 'bri_va') return `2621 5004 ${suffix}`;
    return `8801 2994 ${suffix}`;
  };

  const handleConfirmPayment = async () => {
    if (!createdOrder) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await simulateSettlePayment(userId, createdOrder.id);
      if (res.success && res.order) {
        setCreatedOrder(res.order);
        onPaymentSuccess(res.order);
      } else {
        setErrorMessage(res.error || 'Gagal memverifikasi pembayaran.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat konfirmasi pembayaran.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text.replace(/\s+/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSettled = createdOrder?.status === 'settlement' || createdOrder?.status === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Gerbang Pembayaran Nasional (QRIS · Virtual Account · E-Wallet · Kartu)
              </h2>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>No. Tagihan: {createdOrder?.order_number || 'AMF-INIT'}</span>
                <span>·</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Terenkripsi Standar Bank Indonesia (BI-FAST / GPN)
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
              {errorMessage}
            </div>
          )}

          {isSettled && createdOrder ? (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 mx-auto bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Pembayaran Lunas & Terverifikasi!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Transaksi Anda telah diselesaikan secara real-time. Kuota kredit dan status layanan telah ditambahkan ke akun Anda.
                </p>
              </div>

              <div className="p-4 bg-slate-950/90 border border-slate-800 max-w-md mx-auto text-left space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Nomor Invoice:</span>
                  <span className="text-white font-mono">{createdOrder.order_number}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Paket / Layanan:</span>
                  <span className="text-white font-medium">{item.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Saluran Pembayaran:</span>
                  <span className="text-amber-400 font-semibold">{selectedChannel.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Kredit Ditambahkan:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    +{item.credits.toLocaleString('id-ID')} Kredit
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Dibayar (Termasuk PPN 11%):</span>
                  <span className="text-white font-mono font-bold">{formatIdr(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Referensi Settlement:</span>
                  <span className="font-mono text-slate-400 text-[11px]">{createdOrder.external_reference}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => printIndonesianTaxInvoice(createdOrder)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cetak / Unduh Faktur Pajak (PDF)</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wide transition-colors"
                >
                  Selesai & Kembali ke Studio
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Category Tabs */}
              <div className="space-y-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  1. Pilih Kategori & Metode Pembayaran Indonesia
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('qris');
                      setPaymentMethod('qris');
                    }}
                    className={`p-2.5 border text-left transition-colors ${
                      activeCategory === 'qris'
                        ? 'border-amber-400 bg-amber-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-amber-400 mb-1" />
                    <div className="text-xs font-semibold">QRIS Nasional</div>
                    <div className="text-[10px] text-slate-500">Semua Bank & E-Wallet</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('virtual_account');
                      setPaymentMethod('bca_va');
                    }}
                    className={`p-2.5 border text-left transition-colors ${
                      activeCategory === 'virtual_account'
                        ? 'border-cyan-400 bg-cyan-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-cyan-400 mb-1" />
                    <div className="text-xs font-semibold">Virtual Account</div>
                    <div className="text-[10px] text-slate-500">BCA, Mandiri, BNI, BRI</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('ewallet');
                      setPaymentMethod('gopay');
                    }}
                    className={`p-2.5 border text-left transition-colors ${
                      activeCategory === 'ewallet'
                        ? 'border-emerald-400 bg-emerald-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-emerald-400 mb-1" />
                    <div className="text-xs font-semibold">E-Wallet Instan</div>
                    <div className="text-[10px] text-slate-500">GoPay, ShopeePay, DANA, OVO</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('card');
                      setPaymentMethod('credit_card');
                    }}
                    className={`p-2.5 border text-left transition-colors ${
                      activeCategory === 'card'
                        ? 'border-violet-400 bg-violet-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-violet-400 mb-1" />
                    <div className="text-xs font-semibold">Kartu Kredit/Debit</div>
                    <div className="text-[10px] text-slate-500">Visa, Mastercard, JCB</div>
                  </button>
                </div>

                {/* Sub-channel selector for Virtual Account or E-Wallet */}
                {activeCategory === 'virtual_account' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {(['bca_va', 'mandiri_va', 'bni_va', 'bri_va'] as IndonesianPaymentMethod[]).map(methodId => {
                      const ch = INDONESIAN_PAYMENT_CHANNELS.find(c => c.id === methodId)!;
                      return (
                        <button
                          key={methodId}
                          type="button"
                          onClick={() => setPaymentMethod(methodId)}
                          className={`px-3 py-2 border text-xs font-mono transition-colors ${
                            paymentMethod === methodId
                              ? 'border-cyan-400 bg-cyan-950/30 text-cyan-200 font-bold'
                              : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                          }`}
                        >
                          {ch.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeCategory === 'ewallet' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {(['gopay', 'shopeepay', 'dana', 'ovo'] as IndonesianPaymentMethod[]).map(methodId => {
                      const ch = INDONESIAN_PAYMENT_CHANNELS.find(c => c.id === methodId)!;
                      return (
                        <button
                          key={methodId}
                          type="button"
                          onClick={() => setPaymentMethod(methodId)}
                          className={`px-3 py-2 border text-xs font-mono transition-colors ${
                            paymentMethod === methodId
                              ? 'border-emerald-400 bg-emerald-950/30 text-emerald-200 font-bold'
                              : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                          }`}
                        >
                          {ch.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Channel Instructions & Details */}
              {(activeCategory === 'qris' || activeCategory === 'ewallet') && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center gap-5">
                  <div className="bg-white p-3 border border-slate-700 shrink-0 text-center">
                    <div className="text-[9px] font-bold text-slate-900 tracking-wider uppercase mb-1">
                      QRIS Standar Pembayaran Nasional
                    </div>
                    <div className="w-36 h-36 bg-slate-950 flex flex-col items-center justify-center p-2 text-white mx-auto">
                      <QrCode className="w-28 h-28 text-white" />
                    </div>
                    <div className="text-[9px] font-mono text-slate-700 mt-1">
                      NMID: ID1026008829104
                    </div>
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-amber-400 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Batas Waktu Pembayaran: {formatTimer(timeLeft)}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">{selectedChannel.name}</h4>
                    <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                      {selectedChannel.instructions.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeCategory === 'virtual_account' && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">{selectedChannel.name}</span>
                    <span className="text-amber-400 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Batas Waktu: {formatTimer(timeLeft)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 font-mono text-sm text-cyan-300">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Nomor Virtual Account</div>
                      <span className="tracking-wider font-bold text-base">
                        {getVirtualAccountNumber(paymentMethod)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(getVirtualAccountNumber(paymentMethod))}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Tersalin' : 'Salin Nomor VA'}</span>
                    </button>
                  </div>

                  <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                    {selectedChannel.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeCategory === 'card' && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Nomor Kartu Kredit / Debit Visa / Mastercard / JCB</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-3 py-2 font-mono focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">Masa Berlaku (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={e => setCardExpiry(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-3 py-2 font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-300">CVV / CVC</label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-3 py-2 font-mono focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tax & Order Summary */}
              <div className="p-4 bg-slate-950/50 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Layanan / Paket:</span>
                  <span className="text-white font-medium">{item.name}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Alokasi Kredit Produksi:</span>
                  <span className="text-emerald-400 font-mono font-semibold">
                    +{item.credits.toLocaleString('id-ID')} Kredit
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Dasar Pengenaan Pajak (DPP):</span>
                  <span className="font-mono text-slate-300">{formatIdr(dppAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>PPN 11% (Termasuk dalam Harga Paket):</span>
                  <span className="font-mono text-slate-300">{formatIdr(ppnAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Biaya Layanan Pembayaran ({selectedChannel.shortLabel}):</span>
                  <span className="font-mono text-emerald-400">Rp 0 (Gratis)</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-sm font-bold text-white">
                  <span>Total Tagihan Dibayar:</span>
                  <span className="font-mono text-amber-400">{formatIdr(totalAmount)}</span>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Faktur Pajak PPN 11% diterbitkan otomatis setelah pembayaran terverifikasi.</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={isProcessing}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs tracking-wide transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isProcessing ? 'Memverifikasi Settlement...' : 'Konfirmasi & Selesaikan Pembayaran'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
