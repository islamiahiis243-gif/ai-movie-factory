/**
 * AI MOVIE FACTORY — PRICING & UNIT ECONOMICS SIMULATOR (PHASE 5)
 * Simulates commercial viability, gross margins, and Free Tier subsidies across
 * all 4 subscription tiers under different provider and usage scenarios.
 */

export interface SimulatorScenarioConfig {
  name: string;
  description: string;
  creditBurnRate: number;        // fraction of monthly credits burned (0.0 to 1.0)
  videoTokenFraction: number;     // fraction of credits used on video/media
  retryFailureRate: number;       // fraction of operations that require a retry
}

export const SIMULATION_SCENARIOS: Record<string, SimulatorScenarioConfig> = {
  conservative: {
    name: 'Konservatif (Light Usage)',
    description: 'Pengguna menggunakan ~30% kuota bulanan, mayoritas naskah teks, retry rendah (5%).',
    creditBurnRate: 0.30,
    videoTokenFraction: 0.10,
    retryFailureRate: 0.05,
  },
  normal: {
    name: 'Normal (Standard Production)',
    description: 'Pengguna membakar ~60% kuota kredit bulanan, adegan berimbang, retry wajar (10%).',
    creditBurnRate: 0.60,
    videoTokenFraction: 0.25,
    retryFailureRate: 0.10,
  },
  heavy_usage: {
    name: 'Intensif (Heavy Studio)',
    description: 'Pengguna membakar 90% kuota kredit bulanan, produksi rutin harian.',
    creditBurnRate: 0.90,
    videoTokenFraction: 0.40,
    retryFailureRate: 0.12,
  },
  high_video: {
    name: 'Fokus Video & Media (High Compute)',
    description: 'Pengguna memprioritaskan render gerak video (65% kredit dialokasikan ke media).',
    creditBurnRate: 0.85,
    videoTokenFraction: 0.65,
    retryFailureRate: 0.15,
  },
  high_retry: {
    name: 'Tinggi Percobaan Ulang (High Retry)',
    description: 'Tingkat retry 30% akibat kendala jaringan atau iterasi kreatif intensif.',
    creditBurnRate: 0.75,
    videoTokenFraction: 0.25,
    retryFailureRate: 0.30,
  },
};

export interface SubscriptionTierBaseline {
  id: string;
  name: string;
  monthlyPriceIdr: number;
  monthlyCredits: number;
}

export const TIER_BASELINES: Record<string, SubscriptionTierBaseline> = {
  free: {
    id: 'free',
    name: 'Free Creator',
    monthlyPriceIdr: 0,
    monthlyCredits: 150,
  },
  creator_indie: {
    id: 'creator_indie',
    name: 'Creator Indie',
    monthlyPriceIdr: 149000,
    monthlyCredits: 1500,
  },
  pro_studio: {
    id: 'pro_studio',
    name: 'Pro Studio',
    monthlyPriceIdr: 499000,
    monthlyCredits: 6000,
  },
  production_house: {
    id: 'production_house',
    name: 'Production House',
    monthlyPriceIdr: 1499000,
    monthlyCredits: 20000,
  },
};

export interface SimulatorInput {
  tierUsers: {
    free?: number;
    creator_indie?: number;
    pro_studio?: number;
    production_house?: number;
  };
  scenarioKey?: 'conservative' | 'normal' | 'heavy_usage' | 'high_video' | 'high_retry';
  providerMode?: 'gemini_free' | 'gemini_paid';
  paymentGatewayFeeRate?: number;
  exchangeRateIdr?: number;
}

export interface TierSimulationResult {
  tierId: string;
  tierName: string;
  userCount: number;
  grossRevenueIdr: number;
  paymentGatewayFeeIdr: number;
  netRevenueIdr: number;
  creditsAllottedTotal: number;
  creditsConsumedTotal: number;
  providerBilledCostUsd: number;
  providerBilledCostIdr: number;
  paidEquivalentCostUsd: number;
  paidEquivalentCostIdr: number;
  freeTierSubsidyIdr: number;
  grossProfitIdr: number;
  grossMarginPercent: number;
  averageCostPerUserIdr: number;
}

export interface FullSimulationOutput {
  scenarioName: string;
  providerMode: 'gemini_free' | 'gemini_paid';
  exchangeRateIdr: number;
  totalUsers: number;
  totalGrossRevenueIdr: number;
  totalNetRevenueIdr: number;
  totalProviderBilledCostIdr: number;
  totalPaidEquivalentCostIdr: number;
  totalFreeTierSubsidyIdr: number;
  overallGrossProfitIdr: number;
  overallGrossMarginPercent: number;
  tierResults: Record<string, TierSimulationResult>;
}

// Cost assumptions per credit:
// 1 AMF credit roughly corresponds to ~1,500 Gemini Flash tokens ($0.00015 USD on paid tier)
const PAID_EQUIVALENT_COST_PER_CREDIT_USD = 0.00015;

export function runPricingSimulation(input: SimulatorInput): FullSimulationOutput {
  const {
    tierUsers = { free: 100, creator_indie: 25, pro_studio: 8, production_house: 2 },
    scenarioKey = 'normal',
    providerMode = 'gemini_free',
    paymentGatewayFeeRate = 0.02,
    exchangeRateIdr = 16000,
  } = input;

  const scenario = SIMULATION_SCENARIOS[scenarioKey] || SIMULATION_SCENARIOS.normal;

  const tierResults: Record<string, TierSimulationResult> = {};
  let totalUsers = 0;
  let totalGrossRevenueIdr = 0;
  let totalNetRevenueIdr = 0;
  let totalProviderBilledCostIdr = 0;
  let totalPaidEquivalentCostIdr = 0;
  let totalFreeTierSubsidyIdr = 0;

  for (const [tierId, baseline] of Object.entries(TIER_BASELINES)) {
    const userCount = tierUsers[tierId as keyof typeof tierUsers] || 0;
    totalUsers += userCount;

    const grossRevenueIdr = userCount * baseline.monthlyPriceIdr;
    const paymentGatewayFeeIdr = Number((grossRevenueIdr * paymentGatewayFeeRate).toFixed(0));
    const netRevenueIdr = grossRevenueIdr - paymentGatewayFeeIdr;

    const creditsAllottedTotal = userCount * baseline.monthlyCredits;
    const creditsConsumedTotal = Math.round(creditsAllottedTotal * scenario.creditBurnRate);

    // Calculate paid equivalent cost
    // Factor in video intensity and retries
    const mediaMultiplier = 1.0 + scenario.videoTokenFraction * 0.8;
    const retryMultiplier = 1.0 + scenario.retryFailureRate;
    const totalUsageMultiplier = mediaMultiplier * retryMultiplier;

    const paidEquivalentCostUsd = Number(
      (creditsConsumedTotal * PAID_EQUIVALENT_COST_PER_CREDIT_USD * totalUsageMultiplier).toFixed(4)
    );
    const paidEquivalentCostIdr = Number((paidEquivalentCostUsd * exchangeRateIdr).toFixed(0));

    // Billed provider cost
    let providerBilledCostUsd = 0;
    let providerBilledCostIdr = 0;

    if (providerMode === 'gemini_paid') {
      providerBilledCostUsd = paidEquivalentCostUsd;
      providerBilledCostIdr = paidEquivalentCostIdr;
    } else {
      // Gemini Free Tier -> $0.00 cash billed
      providerBilledCostUsd = 0;
      providerBilledCostIdr = 0;
    }

    // Free Tier subsidy
    const freeTierSubsidyIdr = tierId === 'free' ? paidEquivalentCostIdr : 0;

    // Gross profit and margin
    const grossProfitIdr = netRevenueIdr - providerBilledCostIdr;
    const grossMarginPercent =
      netRevenueIdr > 0
        ? Number((((netRevenueIdr - providerBilledCostIdr) / netRevenueIdr) * 100).toFixed(1))
        : 0;

    const averageCostPerUserIdr =
      userCount > 0 ? Number((providerBilledCostIdr / userCount).toFixed(0)) : 0;

    tierResults[tierId] = {
      tierId,
      tierName: baseline.name,
      userCount,
      grossRevenueIdr,
      paymentGatewayFeeIdr,
      netRevenueIdr,
      creditsAllottedTotal,
      creditsConsumedTotal,
      providerBilledCostUsd,
      providerBilledCostIdr,
      paidEquivalentCostUsd,
      paidEquivalentCostIdr,
      freeTierSubsidyIdr,
      grossProfitIdr,
      grossMarginPercent,
      averageCostPerUserIdr,
    };

    totalGrossRevenueIdr += grossRevenueIdr;
    totalNetRevenueIdr += netRevenueIdr;
    totalProviderBilledCostIdr += providerBilledCostIdr;
    totalPaidEquivalentCostIdr += paidEquivalentCostIdr;
    totalFreeTierSubsidyIdr += freeTierSubsidyIdr;
  }

  const overallGrossProfitIdr = totalNetRevenueIdr - totalProviderBilledCostIdr;
  const overallGrossMarginPercent =
    totalNetRevenueIdr > 0
      ? Number((((totalNetRevenueIdr - totalProviderBilledCostIdr) / totalNetRevenueIdr) * 100).toFixed(1))
      : 0;

  return {
    scenarioName: scenario.name,
    providerMode,
    exchangeRateIdr,
    totalUsers,
    totalGrossRevenueIdr,
    totalNetRevenueIdr,
    totalProviderBilledCostIdr,
    totalPaidEquivalentCostIdr,
    totalFreeTierSubsidyIdr,
    overallGrossProfitIdr,
    overallGrossMarginPercent,
    tierResults,
  };
}

// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
