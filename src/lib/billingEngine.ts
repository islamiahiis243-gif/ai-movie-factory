/**
 * Billing & Monetization Engine - AI Movie Factory (SSOT Sections 21, 22, 23, 41)
 * Manages Indonesian Flagship subscription plans, immutable credit ledger auditing,
 * payment order processing (QRIS, Virtual Account, E-Wallet, Kartu Kredit),
 * and real-time cost vs gross-margin telemetry.
 */

import {
  SubscriptionPlan,
  CreditTopUpPack,
  CreditTransaction,
  UserSubscription,
  PaymentOrder,
  PlatformRevenueMetrics,
  IndonesianPaymentMethod
} from '../types/database';

export interface IndonesianPaymentChannel {
  id: IndonesianPaymentMethod;
  name: string;
  shortLabel: string;
  category: 'qris' | 'virtual_account' | 'ewallet' | 'card';
  providerCode: string;
  feeIdr: number;
  settlementType: 'Instan (Real-Time)' | 'Otomatis (< 1 Menit)';
  instructions: string[];
}

export const INDONESIAN_PAYMENT_CHANNELS: IndonesianPaymentChannel[] = [
  {
    id: 'qris',
    name: 'QRIS Nasional (Semua Bank & E-Wallet)',
    shortLabel: 'QRIS Instan',
    category: 'qris',
    providerCode: 'NMID ID1026008829104',
    feeIdr: 0,
    settlementType: 'Instan (Real-Time)',
    instructions: [
      'Buka aplikasi BCA Mobile, Livin\' by Mandiri, BRImo, BNI Mobile, GoPay, OVO, DANA, atau ShopeePay.',
      'Pilih menu Scan QRIS dan arahkan kamera ke kode QR di layar.',
      'Pastikan nama merchant adalah PT AI MOVIE FACTORY INDONESIA.',
      'Konfirmasi nominal pembayaran dan masukkan PIN Anda.'
    ]
  },
  {
    id: 'bca_va',
    name: 'BCA Virtual Account',
    shortLabel: 'BCA VA',
    category: 'virtual_account',
    providerCode: '3901',
    feeIdr: 0,
    settlementType: 'Otomatis (< 1 Menit)',
    instructions: [
      'Buka BCA Mobile atau KlikBCA, pilih menu m-Transfer -> BCA Virtual Account.',
      'Masukkan Nomor Virtual Account BCA yang tertera di layar.',
      'Periksa rincian tagihan AI Movie Factory dan konfirmasi pembayaran.',
      'Kredit dan status paket akan aktif otomatis segera setelah transfer berhasil.'
    ]
  },
  {
    id: 'mandiri_va',
    name: 'Mandiri Bill Payment (Livin\')',
    shortLabel: 'Mandiri VA',
    category: 'virtual_account',
    providerCode: '70012',
    feeIdr: 0,
    settlementType: 'Otomatis (< 1 Menit)',
    instructions: [
      'Buka aplikasi Livin\' by Mandiri, pilih menu Bayar -> Multipayment.',
      'Pilih penyedia jasa Midtrans / AI Movie Factory (Kode 70012).',
      'Masukkan Nomor Virtual Account Mandiri yang tertera.',
      'Periksa detail tagihan dan masukkan PIN Livin\' Anda.'
    ]
  },
  {
    id: 'bni_va',
    name: 'BNI Virtual Account',
    shortLabel: 'BNI VA',
    category: 'virtual_account',
    providerCode: '8808',
    feeIdr: 0,
    settlementType: 'Otomatis (< 1 Menit)',
    instructions: [
      'Buka BNI Mobile Banking, pilih menu Transfer -> Virtual Account Billing.',
      'Masukkan Nomor Virtual Account BNI yang tertera pada tagihan.',
      'Pastikan nominal tagihan sesuai dan masukkan Password Transaksi.'
    ]
  },
  {
    id: 'bri_va',
    name: 'BRI Virtual Account (BRIVA)',
    shortLabel: 'BRI VA',
    category: 'virtual_account',
    providerCode: '26215',
    feeIdr: 0,
    settlementType: 'Otomatis (< 1 Menit)',
    instructions: [
      'Buka aplikasi BRImo, pilih menu Pembayaran -> BRIVA.',
      'Masukkan Nomor BRIVA yang tampil pada layar checkout.',
      'Konfirmasi tagihan AI Movie Factory dan masukkan PIN BRImo.'
    ]
  },
  {
    id: 'gopay',
    name: 'GoPay / GoPay Later',
    shortLabel: 'GoPay',
    category: 'ewallet',
    providerCode: 'GOPAY-DIRECT',
    feeIdr: 0,
    settlementType: 'Instan (Real-Time)',
    instructions: [
      'Pilih aplikasi Gojek / GoPay atau scan QR menggunakan GoPay.',
      'Periksa rincian transaksi AI Movie Factory dan tekan Konfirmasi & Bayar.',
      'Masukkan PIN GoPay 6 digit Anda.'
    ]
  },
  {
    id: 'shopeepay',
    name: 'ShopeePay / SPayLater',
    shortLabel: 'ShopeePay',
    category: 'ewallet',
    providerCode: 'SHOPEEPAY-ID',
    feeIdr: 0,
    settlementType: 'Instan (Real-Time)',
    instructions: [
      'Buka aplikasi Shopee atau ShopeePay, lalu scan kode QR/deeplink pembayaran.',
      'Pilih sumber dana ShopeePay atau SPayLater.',
      'Masukkan PIN ShopeePay untuk menyelesaikan transaksi.'
    ]
  },
  {
    id: 'dana',
    name: 'DANA Dompet Digital',
    shortLabel: 'DANA',
    category: 'ewallet',
    providerCode: 'DANA-ID',
    feeIdr: 0,
    settlementType: 'Instan (Real-Time)',
    instructions: [
      'Buka aplikasi DANA dan pilih menu Pay / Pindai.',
      'Verifikasi nominal transaksi AI Movie Factory dan masukkan PIN DANA.'
    ]
  },
  {
    id: 'ovo',
    name: 'OVO Cash / OVO Points',
    shortLabel: 'OVO',
    category: 'ewallet',
    providerCode: 'OVO-ID',
    feeIdr: 0,
    settlementType: 'Instan (Real-Time)',
    instructions: [
      'Pastikan nomor ponsel OVO Anda aktif dan cek notifikasi push di aplikasi OVO.',
      'Pilih metode OVO Cash dan masukkan Security Code OVO Anda.'
    ]
  },
  {
    id: 'credit_card',
    name: 'Kartu Kredit / Debit Online (Visa, Mastercard, JCB)',
    shortLabel: 'Kartu Kredit/Debit',
    category: 'card',
    providerCode: '3DS-2.0-ID',
    feeIdr: 0,
    settlementType: 'Instan (Real-Time)',
    instructions: [
      'Mendukung seluruh kartu kredit & debit berlogo Visa, Mastercard, JCB, dan GPN Online.',
      'Dilindungi enkripsi 3D Secure 2.0 (OTP Bank Penerbit) berstandar Bank Indonesia.'
    ]
  }
];

/**
 * Canonical Subscription Plans — 100% aligned with PostgreSQL trigger `validate_payment_order_catalog()`
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'Free Creator',
    tagline: 'Eksplorasi awal pembuatan naskah, world building, dan konsep sinematik AI.',
    monthlyPriceIdr: 0,
    yearlyPriceIdr: 0,
    monthlyCredits: 150,
    maxResolution: '1080p Standard',
    maxConcurrentJobs: 1,
    features: [
      '150 Kredit Produksi awal',
      'Akses World Builder & Character Studio',
      'Sintesis Naskah & Beat Sheet Otomatis',
      'Resolusi video standar 1080p (24fps)',
      '1 antrean pekerjaan render simultan',
      '1 Ruang Kerja Studio Pribadi'
    ]
  },
  {
    id: 'creator_indie',
    tier: 'creator',
    name: 'Creator Indie',
    tagline: 'Ideal untuk kreator film pendek, animasi donghua, dan serial YouTube/TikTok.',
    monthlyPriceIdr: 149000,
    yearlyPriceIdr: 1430000,
    monthlyCredits: 1500,
    maxResolution: '1080p Cinematic',
    maxConcurrentJobs: 2,
    features: [
      '1.500 Kredit Produksi per bulan (18.000/thn)',
      'Akses ke seluruh 14 Agen AI Terspesialisasi',
      'Generasi Gambar Konsistensi Seed Karakter',
      'Ekspor Tanpa Watermark (MP4 & Subtitle SRT/VTT)',
      '2 antrean pekerjaan render simultan',
      'Penyimpanan Cloud Aset Produksi 25 GB'
    ]
  },
  {
    id: 'pro_studio',
    tier: 'pro_studio',
    name: 'Pro Studio',
    tagline: 'Pilihan utama studio produksi independen & sutradara web-series profesional.',
    monthlyPriceIdr: 499000,
    yearlyPriceIdr: 4790000,
    monthlyCredits: 6000,
    maxResolution: '4K Ultra HD & ProRes',
    maxConcurrentJobs: 5,
    recommended: true,
    features: [
      '6.000 Kredit Produksi per bulan (72.000/thn)',
      'Prioritas Dedicated GPU Worker Antrean Cepat',
      'Video Motion Control Kamera Lengkap (Veo / Runway)',
      'Sulih Suara Multi-Karakter dengan Tag Emosi TTS',
      'Ekspor Master 4K & Apple ProRes 422 HQ',
      'Audit QC Otomatis 4 Pilar Penuh',
      'Kolaborasi Tim hingga 5 Kursi Studio',
      'Penyimpanan Cloud Aset Produksi 100 GB'
    ]
  },
  {
    id: 'production_house',
    tier: 'production_house',
    name: 'Production House',
    tagline: 'Solusi skala enterprise untuk rumah produksi, stasiun TV, dan agensi kreatif.',
    monthlyPriceIdr: 1499000,
    yearlyPriceIdr: 14390000,
    monthlyCredits: 20000,
    maxResolution: '4K DCI Cinema Grade',
    maxConcurrentJobs: 20,
    features: [
      '20.000 Kredit Produksi per bulan (240.000/thn)',
      'Antrean Render Instan Prioritas Tertinggi (20 Job Simultan)',
      'Fine-tuning Konsistensi Wajah & Kostum Lintas Episode',
      'Kolaborasi Multi-Seat Tim Produksi (Hingga 25 Kursi)',
      'Akses API Eksternal & Integrasi Webhook Midtrans/Enterprise',
      'Mastering Audio Surround 5.1 & Cue Sheet Broadcast',
      'Penyimpanan Cloud Aset Produksi 1 TB',
      'Faktur Pajak PPN Resmi & SLA 99.9%'
    ]
  }
];

/**
 * Canonical Top-Up Packs — 100% aligned with PostgreSQL trigger `validate_payment_order_catalog()`
 */
export const CREDIT_TOP_UP_PACKS: CreditTopUpPack[] = [
  {
    id: 'starter_boost',
    name: 'Starter Boost Pack',
    credits: 500,
    bonusCredits: 0,
    priceIdr: 49000
  },
  {
    id: 'producer_pack',
    name: 'Producer Pack',
    credits: 1500,
    bonusCredits: 150,
    priceIdr: 149000,
    popular: true
  },
  {
    id: 'studio_block',
    name: 'Studio Block Pack',
    credits: 5000,
    bonusCredits: 750,
    priceIdr: 449000
  },
  {
    id: 'cinema_bulk',
    name: 'Cinema Bulk Pack',
    credits: 20000,
    bonusCredits: 4000,
    priceIdr: 1499000
  }
];

/**
 * Returns initial default subscription for a new user (Free Creator tier, Rp 0, 150 Credits)
 */
export function getInitialSubscription(userId: string): UserSubscription {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: `sub_${userId}`,
    user_id: userId,
    tier: 'free',
    status: 'active',
    billing_cycle: 'monthly',
    price_paid: 0,
    currency: 'IDR',
    credits_allotted: 150,
    current_period_start: now.toISOString(),
    current_period_end: nextMonth.toISOString(),
    cancel_at_period_end: false,
    payment_provider: 'midtrans',
    payment_method: 'qris',
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

/**
 * Returns initial welcome credit allotment for a new user (150 Free Creator credits, 0 dummy usages)
 */
export function getInitialCreditTransactions(userId: string): CreditTransaction[] {
  return [
    {
      id: `tx_welcome_${userId}`,
      user_id: userId,
      transaction_type: 'monthly_allotment',
      amount: 150,
      balance_after: 150,
      provider: 'system',
      model: 'free_welcome_quota',
      operation: 'initial_account_allotment',
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      description: 'Alokasi Kredit Awal Paket Free Creator (150 Kredit)',
      status: 'completed',
      idempotency_key: `welcome_${userId}`,
      created_at: new Date().toISOString()
    }
  ];
}

/**
 * Returns initial payment orders for a user (0 dummy orders in production)
 */
export function getInitialPaymentOrders(_userId: string): PaymentOrder[] {
  return [];
}

/**
 * Calculates Scene Credit Cost dynamically
 */
export function calculateSceneCreditCost(
  options: {
    dialogueCount: number;
    keyframesCount: number;
    videoSeconds: number;
    hasVoiceDubbing: boolean;
    hasMusic: boolean;
    hasQCAudit: boolean;
  }
): {
  totalCredits: number;
  breakdown: Record<string, number>;
  estimatedCostUsd: number;
} {
  const scriptCost = Math.max(2, Math.round(options.dialogueCount * 0.5));
  const imageCost = options.keyframesCount * 5;
  const videoCost = Math.round(options.videoSeconds * 1.5);
  const voiceCost = options.hasVoiceDubbing ? Math.max(3, options.dialogueCount * 1) : 0;
  const audioCost = options.hasMusic ? 4 : 0;
  const qcCost = options.hasQCAudit ? 1 : 0;

  const totalCredits = scriptCost + imageCost + videoCost + voiceCost + audioCost + qcCost;
  const estimatedCostUsd = Number((totalCredits * 0.0028).toFixed(4));

  return {
    totalCredits,
    breakdown: {
      scriptPreparation: scriptCost,
      keyframeSynthesis: imageCost,
      videoMotionRendering: videoCost,
      voiceDubbing: voiceCost,
      cinematicAudio: audioCost,
      qualityControlAudit: qcCost
    },
    estimatedCostUsd
  };
}

/**
 * Calculates genuine platform administrative telemetry metrics from real ledger & orders
 * (Zero hardcoded fallback numbers)
 */
export function computePlatformMetrics(
  transactions: CreditTransaction[],
  orders: PaymentOrder[],
  activeJobsRunning = 0
): PlatformRevenueMetrics {
  const settledOrders = orders.filter(o =>
    o.status === 'settlement' || o.status === 'completed' || o.status === 'paid'
  );
  const totalRevenueIdr = settledOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const subOrders = settledOrders.filter(o => o.package_type === 'subscription');
  const mrrIdr = subOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const usageTx = transactions.filter(t => t.transaction_type === 'usage' && t.status !== 'refunded');
  const totalCreditsConsumed = Math.abs(usageTx.reduce((sum, t) => sum + Number(t.amount || 0), 0));
  const totalApiCostUsd = usageTx.reduce((sum, t) => sum + Number(t.actual_cost_usd || 0), 0);

  const totalCreditsSold = settledOrders.reduce((sum, o) => sum + Number(o.credits_granted || 0), 0);

  const apiCostIdr = totalApiCostUsd * 16000;
  const grossMarginPercent =
    totalRevenueIdr > 0
      ? Math.max(0, Math.min(100, Math.round(((totalRevenueIdr - apiCostIdr) / totalRevenueIdr) * 100)))
      : 0;

  const uniquePaidUsers = new Set(settledOrders.map(o => o.user_id).filter(Boolean));

  return {
    mrrIdr: mrrIdr || totalRevenueIdr,
    totalCreditsSold,
    totalCreditsConsumed,
    totalApiCostUsd: Number(totalApiCostUsd.toFixed(4)),
    grossMarginPercent,
    activeSubscribers: uniquePaidUsers.size,
    activeJobsRunning
  };
}
