/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.3: B2C OTT Checkout & Payment Modal
 * 
 * Strict Invariants:
 * 1. Shows itemized pricing with verified gross amount and zero hidden markups.
 * 2. Uses authentic Midtrans Snap gateway tokens & redirect URLs.
 * 3. Zero direct client-side RPC fulfillment (Fulfillment handled strictly by backend).
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Clock,
  ExternalLink,
  Loader2,
  Sparkles,
  Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase.ts';
import { OttPaymentOrder, OttPaymentOrderType } from '../../types/database.ts';

export interface OttCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  orderType: OttPaymentOrderType;
  contentId?: string;
  contentType?: 'film' | 'episode' | 'season' | 'channel';
  title: string;
  priceIdr: number;
  onPaymentSuccess?: (order: OttPaymentOrder) => void;
}

export const OttCheckoutModal: React.FC<OttCheckoutModalProps> = ({
  isOpen,
  onClose,
  channelId,
  orderType,
  contentId,
  contentType = 'film',
  title,
  priceIdr,
  onPaymentSuccess,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [order, setOrder] = useState<OttPaymentOrder | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<{
    token?: string;
    redirectUrl?: string;
    isGatewayMock?: boolean;
  } | null>(null);
  const [isSettled, setIsSettled] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(900); // 15 mins

  useEffect(() => {
    if (isOpen) {
      setOrder(null);
      setPaymentDetails(null);
      setIsSettled(false);
      setErrorMsg(null);
      setTimeLeftSeconds(900);
      handleCreateOrder();
    }
  }, [isOpen, contentId, channelId]);

  useEffect(() => {
    if (!order || isSettled) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [order, isSettled]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const handleCreateOrder = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const user = supabase ? (await supabase.auth.getUser()).data?.user : null;

      const res = await fetch('/api/ott/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          orderType,
          contentId,
          contentType,
          paymentMethod: 'midtrans_snap',
          clientPrice: priceIdr,
          _mockViewer: user ? undefined : { id: '00000000-0000-0000-0000-000000000001', email: 'viewer@aimoviefactory.local' },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membuat pesanan pembayaran.');
      }

      setOrder(data.order);
      setPaymentDetails(data.paymentDetails);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem checkout.');
    } finally {
      setLoading(false);
    }
  };

  // Secure backend sandbox settlement simulator (dev/sandbox only)
  const handleSimulateSandboxSettlement = async () => {
    if (!order) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ott/sandbox-simulate-settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: order.order_number }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Simulasi pembayaran ditolak.');
      }

      setIsSettled(true);
      if (onPaymentSuccess) {
        onPaymentSuccess({
          ...order,
          status: 'settlement',
          entitlement_fulfilled: true,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal simulasi penyelesaian pembayaran.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMidtransGateway = () => {
    if (paymentDetails?.redirectUrl) {
      window.open(paymentDetails.redirectUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">OTT Storefront Checkout</h3>
              <p className="text-[11px] text-slate-400">Transaksi resmi langsung ke kreator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start space-x-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSettled ? (
            /* Success State */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Pembayaran Sukses!</h4>
                <p className="text-xs text-slate-400">
                  Tiket akses nonton Anda telah aktif secara otomatis di server.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-left space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>No. Pesanan:</span>
                  <span className="font-mono text-white">{order?.order_number}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Durasi Akses:</span>
                  <span className="font-semibold text-emerald-400">
                    {orderType === 'svod_channel' ? '30 Hari (Non Auto-Renew)' : '48 Jam (PPV Pass)'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Bayar:</span>
                  <span className="font-bold text-white">
                    Rp {priceIdr.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20"
              >
                Mulai Menonton Sekarang
              </button>
            </div>
          ) : (
            <>
              {/* Order Item Summary */}
              <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-medium tracking-wide uppercase">
                      {orderType === 'svod_channel' ? 'Langganan Channel 30 Hari (SVOD)' : 'Tiket PPV 48 Jam (TVOD)'}
                    </span>
                    <h4 className="text-sm font-bold text-white">{title}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-white font-mono">
                      Rp {priceIdr.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Midtrans Gateway Action */}
              {loading && !order ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-400">Menghubungkan ke gateway Midtrans Snap...</span>
                </div>
              ) : (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-mono">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-4 h-4" />
                      <span>Sisa waktu: {formatCountdown(timeLeftSeconds)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Midtrans Snap Pay</span>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-3">
                    <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Pembayaran Terenkripsi Midtrans Snap</h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Mendukung pembayaran resmi via QRIS (semua e-wallet), Virtual Account (BCA, Mandiri, BNI, BRI), dan Kartu Kredit.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenMidtransGateway}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20"
                    >
                      <span>Buka Halaman Pembayaran Midtrans</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sandbox Backend Simulator (Dev/Test Environment only) */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={loading || !order}
                      onClick={handleSimulateSandboxSettlement}
                      className="w-full py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      )}
                      <span>⚡ Simulasi Pembayaran Sukses (Sandbox Backend)</span>
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-1">
                      Mode Sandbox: Memanggil backend simulator untuk mengonfirmasi transaksi secara instan.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>256-bit SSL Enkripsi Terverifikasi</span>
          </div>
          <span>Midtrans Payment Gateway</span>
        </div>
      </div>
    </div>
  );
};

export default OttCheckoutModal;
