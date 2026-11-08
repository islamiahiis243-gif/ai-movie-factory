import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Wallet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  FileText,
  Printer,
  Zap,
  RefreshCw,
  MessageCircle,
  UserCheck
} from 'lucide-react';
import { PaymentOrder, IndonesianPaymentMethod } from '../../types/database';
import {
  createPaymentOrder,
  submitDirectPaymentProof,
  checkPaymentOrderStatus
} from '../../lib/supabase';
import {
  INDONESIAN_PAYMENT_CHANNELS,
  OFFICIAL_MERCHANT_BANK_ACCOUNT
} from '../../lib/billingEngine';

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
      <div class="brand">AI MOVIE FACTORY INDONESIA</div>
      <div style="font-size:12px;color:#475569;">Merchant Resmi: ${OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder} · Bank Mandiri (${OFFICIAL_MERCHANT_BANK_ACCOUNT.accountNumber})</div>
      <div style="font-size:12px;color:#475569;">Layanan Produksi Film & Animasi AI Terpadu</div>
    </div>
    <div style="text-align:right;">
      <div class="badge">LUNAS / SETTLED</div>
      <div style="font-size:14px;font-weight:700;margin-top:6px;">INVOICE #${order.order_number}</div>
      <div style="font-size:12px;color:#475569;">Tanggal: ${new Date(order.paid_at || order.created_at).toLocaleString('id-ID')}</div>
    </div>
  </div>
  <div style="font-size:13px;margin-bottom:12px;">
    <strong>Metode Pembayaran:</strong> ${String(order.payment_method || 'mandiri_va').toUpperCase()}<br/>
    <strong>Penerima Resmi:</strong> ${OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder}<br/>
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
    <div><span>Biaya Layanan Transfer:</span><span>Rp 0</span></div>
    <div class="grand"><span>Total Dibayar:</span><span>${formatIdr(subtotal)}</span></div>
  </div>
  <div class="footer">
    Dokumen ini adalah Bukti Pembayaran dan Faktur Elektronik yang sah serta diterbitkan secara otomatis oleh sistem Billing AI Movie Factory.
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
  const [activeCategory, setActiveCategory] = useState<'virtual_account' | 'ewallet'>('virtual_account');
  const [paymentMethod, setPaymentMethod] = useState<IndonesianPaymentMethod>('mandiri_va');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [createdOrder, setCreatedOrder] = useState<PaymentOrder | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [copiedAmount, setCopiedAmount] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(1800);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [senderNote, setSenderNote] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !item) {
      setCreatedOrder(null);
      setIsProcessing(false);
      setIsCheckingStatus(false);
      setErrorMessage(null);
      setTimeLeft(1800);
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
    if (!createdOrder || createdOrder.status === 'settlement' || createdOrder.status === 'completed') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdOrder]);

  // Poll order status automatically while in 'processing' (waiting for Admin approval)
  useEffect(() => {
    if (!createdOrder || createdOrder.status !== 'processing') return;
    const poll = setInterval(async () => {
      const checkRes = await checkPaymentOrderStatus(userId, createdOrder.id);
      if (checkRes.success && checkRes.order) {
        setCreatedOrder(checkRes.order);
        if (checkRes.settled) {
          onPaymentSuccess(checkRes.order);
        }
      }
    }, 8000);
    return () => clearInterval(poll);
  }, [createdOrder, userId, onPaymentSuccess]);

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

  const billingId = `88008-15900-${(createdOrder?.order_number || '881920').replace(/\D/g, '').slice(-6).padStart(6, '0')}`;

  const handleConfirmTransfer = async () => {
    if (!createdOrder) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const note = senderNote.trim() || `ID Billing ${billingId} (${selectedChannel.shortLabel})`;
      const res = await submitDirectPaymentProof(userId, createdOrder.id, note, billingId);
      if (res.success && res.order) {
        setCreatedOrder(res.order);
        if (
          res.order.status === 'settlement' ||
          res.order.status === 'completed' ||
          res.order.status === 'paid'
        ) {
          onPaymentSuccess(res.order);
        }
      } else {
        setErrorMessage(res.error || 'Gagal memverifikasi ID Billing pembayaran.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat verifikasi pembayaran otomatis.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCheckStatus = async () => {
    if (!createdOrder) return;
    setIsCheckingStatus(true);
    setErrorMessage(null);
    try {
      const res = await checkPaymentOrderStatus(userId, createdOrder.id);
      if (res.success && res.order) {
        setCreatedOrder(res.order);
        if (res.settled) {
          onPaymentSuccess(res.order);
        }
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleCopyAccount = (text: string) => {
    navigator.clipboard.writeText(text.replace(/\s+/g, ''));
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleCopyAmount = (amount: number) => {
    navigator.clipboard.writeText(String(amount));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const getWhatsAppConfirmationUrl = () => {
    const msg = `Halo Admin AI Movie Factory (${OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder}), saya sudah melakukan pembayaran:\n\n` +
      `• No. Invoice: ${createdOrder?.order_number}\n` +
      `• Paket: ${item.name} (+${item.credits.toLocaleString('id-ID')} Kredit)\n` +
      `• Nominal: ${formatIdr(totalAmount)}\n` +
      `• Metode Tujuan: ${selectedChannel.bankName} (${selectedChannel.accountNumber} a/n ${selectedChannel.accountHolder})\n` +
      `• Pengirim: ${senderNote || '-'}\n\n` +
      `Mohon bantuannya untuk verifikasi dan aktivasi paket saya. Terima kasih!`;
    return `https://wa.me/${OFFICIAL_MERCHANT_BANK_ACCOUNT.whatsappAdmin}?text=${encodeURIComponent(msg)}`;
  };

  const isSettled =
    createdOrder?.status === 'settlement' ||
    createdOrder?.status === 'completed' ||
    createdOrder?.status === 'paid';
  const isWaitingVerification = createdOrder?.status === 'processing';

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
                Pembayaran Resmi Studio (Bank Mandiri · GoPay · OVO · DANA)
              </h2>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>No. Tagihan: {createdOrder?.order_number || 'AMF-INIT'}</span>
                <span>·</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Penerima Resmi: {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder}
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
                  Pembayaran Anda telah diverifikasi. Kuota kredit dan status layanan telah aktif di akun studio Anda.
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
                  <span>Referensi Verifikasi:</span>
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
          ) : isWaitingVerification && createdOrder ? (
            <div className="py-4 space-y-5">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
                <Clock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">
                    Konfirmasi Transfer Diterima — Menunggu Verifikasi Mutasi
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Permintaan aktivasi Anda telah tercatat di sistem. Tim Admin sedang mencocokkan mutasi pembayaran ke rekening{' '}
                    <span className="text-amber-300 font-semibold">
                      {selectedChannel.bankName} ({selectedChannel.accountNumber} a/n {selectedChannel.accountHolder})
                    </span>
                    . Halaman ini akan otomatis memperbarui status begitu pembayaran disetujui.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950/90 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Nomor Tagihan / Invoice:</span>
                  <span className="text-white font-mono font-bold">{createdOrder.order_number}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Paket / Kuota Kredit:</span>
                  <span className="text-emerald-400 font-semibold">
                    {item.name} (+{item.credits.toLocaleString('id-ID')} Kredit)
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Rekening / E-Wallet Tujuan:</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {selectedChannel.bankName} · {selectedChannel.accountNumber} (a/n {selectedChannel.accountHolder})
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Nominal Transfer:</span>
                  <span className="text-white font-mono font-bold">{formatIdr(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Data Pengirim:</span>
                  <span className="text-cyan-300 font-mono">{senderNote}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Status Saat Ini:</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] uppercase">
                    Menunggu Verifikasi Admin
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <a
                  href={getWhatsAppConfirmationUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim Bukti Transfer via WhatsApp Admin (081352006569)</span>
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualCheckStatus}
                    disabled={isCheckingStatus}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin text-amber-400' : ''}`} />
                    <span>{isCheckingStatus ? 'Memeriksa...' : 'Cek Status Verifikasi'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Category Tabs */}
              <div className="space-y-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  1. Pilih Metode Pembayaran Resmi (Atas Nama: {OFFICIAL_MERCHANT_BANK_ACCOUNT.accountHolder})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('virtual_account');
                      setPaymentMethod('mandiri_va');
                    }}
                    className={`p-3 border text-left transition-colors ${
                      activeCategory === 'virtual_account'
                        ? 'border-cyan-400 bg-cyan-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      <span className="text-[10px] font-mono text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5">
                        REKENING UTAMA
                      </span>
                    </div>
                    <div className="text-xs font-semibold">Transfer Bank Mandiri / Antar-Bank (BI-FAST)</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Bank Mandiri · 1590011997714 · a/n SUMARLIN
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('ewallet');
                      setPaymentMethod('gopay');
                    }}
                    className={`p-3 border text-left transition-colors ${
                      activeCategory === 'ewallet'
                        ? 'border-emerald-400 bg-emerald-950/20 text-white'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5">
                        E-WALLET RESMI
                      </span>
                    </div>
                    <div className="text-xs font-semibold">Dompet Digital (GoPay · OVO · DANA)</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      081352006569 · a/n SUMARLIN
                    </div>
                  </button>
                </div>

                {/* Sub-channel selector */}
                {activeCategory === 'virtual_account' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {(['mandiri_va', 'bca_va', 'bri_va', 'bni_va'] as IndonesianPaymentMethod[]).map(methodId => {
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
                    {(['gopay', 'ovo', 'dana', 'shopeepay'] as IndonesianPaymentMethod[]).map(methodId => {
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

              {/* Official Destination Account Box */}
              <div className="p-4 bg-slate-950/90 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 font-semibold">{selectedChannel.name}</span>
                    <span className="px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-mono text-[10px]">
                      ID BILLING: {billingId}
                    </span>
                  </div>
                  <span className="text-amber-400 font-mono flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Batas Waktu: {formatTimer(timeLeft)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 font-mono">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">
                        {activeCategory === 'virtual_account'
                          ? 'Nomor Rekening Bank Mandiri (Kode 008)'
                          : `Nomor Tujuan ${selectedChannel.shortLabel}`}
                      </div>
                      <div className="tracking-wider font-bold text-base text-cyan-300 mt-0.5">
                        {selectedChannel.accountNumber}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-sans font-semibold mt-0.5">
                        a/n {selectedChannel.accountHolder}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(selectedChannel.accountNumber)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      {copiedAccount ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedAccount ? 'Tersalin' : 'Salin Nomor'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 font-mono">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Total Sesuai ID Billing</div>
                      <div className="tracking-wider font-bold text-base text-amber-400 mt-0.5">
                        {formatIdr(totalAmount)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                        Termasuk PPN 11% · Aktivasi Otomatis
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAmount(totalAmount)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      {copiedAmount ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedAmount ? 'Tersalin' : 'Salin Nominal'}</span>
                    </button>
                  </div>
                </div>

                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside pt-1">
                  {selectedChannel.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>

              {/* Sender Reference Input */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Nama Pengirim / Referensi Pembayaran (Opsional)</span>
                </label>
                <input
                  type="text"
                  value={senderNote}
                  onChange={e => setSenderNote(e.target.value)}
                  placeholder={`Contoh: Nama Pengirim / Referensi ID Billing ${billingId}`}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white px-3 py-2.5 focus:border-amber-400 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">
                  Pembayaran dengan nominal sesuai ke{' '}
                  <strong className="text-slate-200">
                    {selectedChannel.bankName} ({selectedChannel.accountNumber} a/n {selectedChannel.accountHolder})
                  </strong>{' '}
                  akan langsung diverifikasi dan diaktifkan secara otomatis pada ID Billing{' '}
                  <strong className="text-indigo-300 font-mono">{billingId}</strong>.
                </p>
              </div>

              {/* Tax & Order Summary */}
              <div className="p-4 bg-slate-950/50 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Kode ID Billing Resmi:</span>
                  <span className="text-indigo-300 font-mono font-semibold">{billingId}</span>
                </div>
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
                <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-sm font-bold text-white">
                  <span>Total Tagihan Dibayar:</span>
                  <span className="font-mono text-amber-400">{formatIdr(totalAmount)}</span>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Paket, kuota kredit, dan Faktur Pajak PPN 11% aktif otomatis setelah pembayaran selesai.</span>
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
                    onClick={handleConfirmTransfer}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs tracking-wide transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isProcessing ? 'Memverifikasi ID Billing...' : 'Verifikasi ID Billing & Aktifkan Otomatis'}</span>
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
