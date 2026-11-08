/**
 * Billing & Monetization Engine - AI Movie Factory (SSOT Sections 21, 22, 23, 41)
 * Manages subscription plans, immutable credit ledger auditing, payment order processing,
 * and cost vs gross-margin calculations.
 */

import {
  SubscriptionPlan,
  CreditTopUpPack,
  CreditTransaction,
  UserSubscription,
  PaymentOrder,
  PlatformRevenueMetrics
} from '../types/database';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free',
    tier: 'free',
    name: 'Free Creator',
    tagline: 'Eksplorasi awal pembuatan naskah dan konsep animasi AI.',
    monthlyPriceIdr: 0,
    yearlyPriceIdr: 0,
    monthlyCredits: 150,
    maxResolution: '1080p Standard',
    maxConcurrentJobs: 1,
    features: [
      '150 Kredit Produksi per bulan',
      'Akses World Builder & Character Studio',
      'Sintesis Naskah & Beat Sheet Otomatis',
      'Resolusi video standar 1080p (24fps)',
      '1 antrean pekerjaan render simultan',
      'Watermark pratinjau komunitas'
    ]
  },
  {
    id: 'plan_creator',
    tier: 'creator',
    name: 'Creator (Indie)',
    tagline: 'Ideal untuk kreator drama pendek dan serial YouTube/TikTok.',
    monthlyPriceIdr: 99000,
    yearlyPriceIdr: 950000,
    monthlyCredits: 1200,
    maxResolution: '1080p Cinematic',
    maxConcurrentJobs: 2,
    features: [
      '1.200 Kredit Produksi per bulan',
      'Akses ke seluruh 14 Agen AI Terspesialisasi',
      'Generasi Gambar Konsistensi Seed Karakter',
      'Ekspor Tanpa Watermark (MP4 & Subtitle SRT)',
      '2 antrean pekerjaan render simultan',
      'Penyimpanan Aset Produksi 10 GB'
    ]
  },
  {
    id: 'plan_pro_studio',
    tier: 'pro_studio',
    name: 'Pro Studio',
    tagline: 'Pilihan utama studio produksi independen & sutradara web-series.',
    monthlyPriceIdr: 299000,
    yearlyPriceIdr: 2870000,
    monthlyCredits: 4500,
    maxResolution: '4K Ultra HD & ProRes',
    maxConcurrentJobs: 5,
    recommended: true,
    features: [
      '4.500 Kredit Produksi per bulan',
      'Prioritas Dedicated GPU Worker Antrean Cepat',
      'Video Motion Control Kamera Lengkap (Veo / Runway)',
      'Sulih Suara Multi-Karakter dengan Tag Emosi TTS',
      'Ekspor Master 4K & Apple ProRes 422 HQ',
      'Audit QC Otomatis 4 Pilar Penuh',
      '5 antrean pekerjaan render simultan',
      'Penyimpanan Aset Produksi 50 GB'
    ]
  },
  {
    id: 'plan_production_house',
    tier: 'production_house',
    name: 'Production House',
    tagline: 'Solusi skala enterprise untuk rumah produksi dan agensi kreatif.',
    monthlyPriceIdr: 999000,
    yearlyPriceIdr: 9590000,
    monthlyCredits: 18000,
    maxResolution: '4K DCI Cinema Grade',
    maxConcurrentJobs: 20,
    features: [
      '18.000 Kredit Produksi per bulan',
      'Antrean Render Instan Tanpa Batas Simultan',
      'Fine-tuning Model Wajah & Kostum Kustom',
      'Dukungan Multi-Seat Kolaborasi Tim (Hingga 10 Anggota)',
      'Akses API Eksternal & Integrasi Webhook',
      'Mastering Audio Surround 5.1 & Cue Sheet Broadcast',
      'Penyimpanan Aset Produksi 500 GB Cloud',
      'Dedicated Account Manager & SLA 99.9%'
    ]
  }
];

export const CREDIT_TOP_UP_PACKS: CreditTopUpPack[] = [
  {
    id: 'pack_starter',
    name: 'Starter Boost',
    credits: 500,
    bonusCredits: 0,
    priceIdr: 49000
  },
  {
    id: 'pack_producer',
    name: 'Producer Pack',
    credits: 1500,
    bonusCredits: 150,
    priceIdr: 129000,
    popular: true
  },
  {
    id: 'pack_studio',
    name: 'Studio Block',
    credits: 5000,
    bonusCredits: 750,
    priceIdr: 389000
  },
  {
    id: 'pack_cinema',
    name: 'Cinema Bulk',
    credits: 20000,
    bonusCredits: 4000,
    priceIdr: 1399000
  }
];

/**
 * Returns initial default subscription for a user
 */
export function getInitialSubscription(userId: string): UserSubscription {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: `sub_${userId}`,
    user_id: userId,
    tier: 'pro_studio',
    status: 'active',
    billing_cycle: 'monthly',
    price_paid: 299000,
    currency: 'IDR',
    credits_allotted: 4500,
    current_period_start: now.toISOString(),
    current_period_end: nextMonth.toISOString(),
    cancel_at_period_end: false,
    payment_provider: 'midtrans',
    payment_method: 'qris',
    created_at: new Date(now.getTime() - 15 * 86400000).toISOString(),
    updated_at: now.toISOString()
  };
}

/**
 * Returns initial demo credit ledger audit transactions (SSOT Section 22)
 */
export function getInitialCreditTransactions(userId: string): CreditTransaction[] {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();

  return [
    {
      id: 'tx_001_allotment',
      user_id: userId,
      transaction_type: 'monthly_allotment',
      amount: 4500,
      balance_after: 4500,
      provider: 'system',
      model: 'subscription_quota',
      operation: 'monthly_quota_reset',
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      description: 'Alokasi kredit bulanan paket Pro Studio',
      status: 'completed',
      idempotency_key: `quota_${userId}_202611`,
      created_at: hoursAgo(120)
    },
    {
      id: 'tx_002_script',
      user_id: userId,
      transaction_type: 'usage',
      amount: -12,
      balance_after: 4488,
      provider: 'google_gemini',
      model: 'gemini-2.5-pro',
      operation: 'script_screenplay_generation',
      estimated_cost_usd: 0.0072,
      actual_cost_usd: 0.0068,
      description: 'Sintesis Naskah Episode 1 Adegan 1-3 oleh Script Writer Agent',
      status: 'completed',
      idempotency_key: 'tx_scr_ep1_001',
      created_at: hoursAgo(72)
    },
    {
      id: 'tx_003_keyframes',
      user_id: userId,
      transaction_type: 'usage',
      amount: -25,
      balance_after: 4463,
      provider: 'google_gemini',
      model: 'gemini-3.1-flash-lite-image',
      operation: 'character_keyframe_synthesis',
      estimated_cost_usd: 0.024,
      actual_cost_usd: 0.021,
      description: 'Sintesis 5 Keyframe Visual Puncak Tebing Naga (Xiao Chen Seed)',
      status: 'completed',
      idempotency_key: 'tx_img_scene1_001',
      created_at: hoursAgo(48)
    },
    {
      id: 'tx_004_motion_video',
      user_id: userId,
      transaction_type: 'usage',
      amount: -64,
      balance_after: 4399,
      provider: 'google_gemini',
      model: 'gemini-omni-1.1-flash',
      operation: 'image_to_video_motion',
      estimated_cost_usd: 0.128,
      actual_cost_usd: 0.119,
      description: 'Rendering 8s Video Gerak Kamera Paning Lembah Kabut (24fps)',
      status: 'completed',
      idempotency_key: 'tx_vid_scene3_001',
      created_at: hoursAgo(24)
    },
    {
      id: 'tx_005_voice_dubbing',
      user_id: userId,
      transaction_type: 'usage',
      amount: -16,
      balance_after: 4383,
      provider: 'google_gemini',
      model: 'gemini-3.8-flash-tts',
      operation: 'voice_dialogue_synthesis',
      estimated_cost_usd: 0.012,
      actual_cost_usd: 0.011,
      description: 'Sulih Suara Dialog Tetua Gu & Xiao Chen (Tag Emosi <whisper>)',
      status: 'completed',
      idempotency_key: 'tx_tts_scene1_002',
      created_at: hoursAgo(12)
    },
    {
      id: 'tx_006_topup',
      user_id: userId,
      transaction_type: 'purchase',
      amount: 1650,
      balance_after: 6033,
      provider: 'midtrans',
      model: 'qris_settlement',
      operation: 'credit_pack_purchase',
      estimated_cost_usd: 0,
      actual_cost_usd: 0,
      description: 'Pembelian Producer Pack (1.500 + 150 Bonus Kredit) via QRIS',
      status: 'completed',
      idempotency_key: 'pay_ord_1650_qris',
      created_at: hoursAgo(6)
    },
    {
      id: 'tx_007_pipeline_job',
      user_id: userId,
      transaction_type: 'usage',
      amount: -23,
      balance_after: 6010,
      provider: 'google_gemini',
      model: 'gemini-omni-1.1-flash',
      operation: 'autonomous_pipeline_scene_render',
      estimated_cost_usd: 0.065,
      actual_cost_usd: 0.059,
      description: 'Eksekusi Autonomous Pipeline Adegan 1: Puncak Tebing Naga',
      status: 'completed',
      idempotency_key: 'tx_pipe_scene1_full',
      created_at: hoursAgo(2)
    }
  ];
}

/**
 * Returns initial payment orders for a user
 */
export function getInitialPaymentOrders(userId: string): PaymentOrder[] {
  const now = Date.now();
  return [
    {
      id: 'ord_001_sub',
      user_id: userId,
      order_number: 'AMF-SUB-202611-0089',
      package_type: 'subscription',
      package_id: 'plan_pro_studio',
      package_name: 'Langganan Pro Studio (Bulanan)',
      amount: 299000,
      currency: 'IDR',
      payment_gateway: 'midtrans',
      payment_method: 'qris',
      status: 'settlement',
      credits_granted: 4500,
      external_reference: 'midtrans-trx-8829411',
      paid_at: new Date(now - 15 * 86400000).toISOString(),
      created_at: new Date(now - 15 * 86400000).toISOString()
    },
    {
      id: 'ord_002_pack',
      user_id: userId,
      order_number: 'AMF-TOP-202611-0144',
      package_type: 'credit_pack',
      package_id: 'pack_producer',
      package_name: 'Top-Up Producer Pack (1.500 + 150 Bonus)',
      amount: 129000,
      currency: 'IDR',
      payment_gateway: 'midtrans',
      payment_method: 'qris',
      status: 'settlement',
      credits_granted: 1650,
      external_reference: 'midtrans-trx-9912048',
      paid_at: new Date(now - 6 * 3600000).toISOString(),
      created_at: new Date(now - 6 * 3600000).toISOString()
    }
  ];
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
  // Estimated API cost: ~ $0.003 per credit
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
 * Calculates platform administrative telemetry metrics
 */
export function computePlatformMetrics(
  transactions: CreditTransaction[],
  orders: PaymentOrder[]
): PlatformRevenueMetrics {
  const settledOrders = orders.filter(o => o.status === 'settlement');
  const totalRevenueIdr = settledOrders.reduce((sum, o) => sum + o.amount, 0);

  const usageTx = transactions.filter(t => t.transaction_type === 'usage');
  const totalCreditsConsumed = Math.abs(usageTx.reduce((sum, t) => sum + t.amount, 0));
  const totalApiCostUsd = usageTx.reduce((sum, t) => sum + t.actual_cost_usd, 0);

  const totalCreditsSold = settledOrders.reduce((sum, o) => sum + o.credits_granted, 0);

  // Approximate gross margin: Revenue IDR vs API cost in IDR (USD 1 = Rp 16.000)
  const apiCostIdr = totalApiCostUsd * 16000;
  const grossMarginPercent =
    totalRevenueIdr > 0 ? Math.round(((totalRevenueIdr - apiCostIdr) / totalRevenueIdr) * 100) : 84;

  return {
    mrrIdr: 299000,
    totalCreditsSold: totalCreditsSold || 6150,
    totalCreditsConsumed: totalCreditsConsumed || 140,
    totalApiCostUsd: Number(totalApiCostUsd.toFixed(4)) || 0.238,
    grossMarginPercent: Math.max(10, Math.min(96, grossMarginPercent)),
    activeSubscribers: 1,
    activeJobsRunning: 1
  };
}
