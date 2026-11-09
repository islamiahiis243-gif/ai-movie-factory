/**
 * AI MOVIE FACTORY — OFFICIAL PROVIDER COST ENGINE (PHASE 4)
 * Evaluates provider costs from official rates and usage metering.
 * Strictly separates:
 * 1. provider_actual_cost (billed cost: $0.00 on Gemini Free Tier)
 * 2. paid_equivalent_cost (estimated cost if billed on Gemini Paid Tier)
 * 3. internal_credit_value (nominal credit value in IDR)
 * 4. customer_charge (what user paid in subscription/credits)
 */

export interface ModelPricingDefinition {
  provider: string;
  model: string;
  category: 'text' | 'image' | 'video' | 'audio';
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  cachedCostPerMillionUsd?: number;
  costPerImageUsd?: number;
  costPerVideoSecondUsd?: number;
  costPerVideoSecond4kUsd?: number;
  costPerThousandCharsUsd?: number;
  freeTierEligible: boolean;
  rateSource: string;
  effectiveDate: string;
}

export const OFFICIAL_PROVIDER_PRICING_REGISTRY: Record<string, ModelPricingDefinition> = {
  'gemini-2.5-flash': {
    provider: 'google_gemini',
    model: 'gemini-2.5-flash',
    category: 'text',
    inputCostPerMillionUsd: 0.075,      // $0.075 / 1M input tokens
    outputCostPerMillionUsd: 0.300,     // $0.300 / 1M output tokens
    cachedCostPerMillionUsd: 0.01875,   // $0.01875 / 1M cached input tokens
    freeTierEligible: true,
    rateSource: 'Google AI Gemini Official Pricing (Nov 2026)',
    effectiveDate: '2026-01-01',
  },
  'gemini-1.5-flash': {
    provider: 'google_gemini',
    model: 'gemini-1.5-flash',
    category: 'text',
    inputCostPerMillionUsd: 0.075,
    outputCostPerMillionUsd: 0.300,
    cachedCostPerMillionUsd: 0.01875,
    freeTierEligible: true,
    rateSource: 'Google AI Gemini Official Pricing (Nov 2026)',
    effectiveDate: '2026-01-01',
  },
  'gemini-1.5-pro': {
    provider: 'google_gemini',
    model: 'gemini-1.5-pro',
    category: 'text',
    inputCostPerMillionUsd: 1.250,      // $1.25 / 1M input tokens
    outputCostPerMillionUsd: 5.000,     // $5.00 / 1M output tokens
    cachedCostPerMillionUsd: 0.3125,    // $0.3125 / 1M cached tokens
    freeTierEligible: true,
    rateSource: 'Google AI Gemini Official Pricing (Nov 2026)',
    effectiveDate: '2026-01-01',
  },
  'imagen-3': {
    provider: 'google_gemini',
    model: 'imagen-3',
    category: 'image',
    costPerImageUsd: 0.030,             // $0.030 / generated image
    freeTierEligible: false,
    rateSource: 'Google Cloud Vertex AI Imagen 3 Standard Rates',
    effectiveDate: '2026-01-01',
  },
  'veo-video': {
    provider: 'google_gemini',
    model: 'veo-video',
    category: 'video',
    costPerVideoSecondUsd: 0.040,       // $0.20 per 5s 1080p clip
    costPerVideoSecond4kUsd: 0.080,     // $0.40 per 5s 4K clip
    freeTierEligible: false,
    rateSource: 'Google Cloud Generative Video Reference Tariff',
    effectiveDate: '2026-01-01',
  },
  'elevenlabs-voice': {
    provider: 'elevenlabs',
    model: 'elevenlabs-voice',
    category: 'audio',
    costPerThousandCharsUsd: 0.030,
    freeTierEligible: false,
    rateSource: 'ElevenLabs Multilingual v2 Pricing',
    effectiveDate: '2026-01-01',
  },
};

export const DEFAULT_EXCHANGE_RATE_IDR = 16000; // 1 USD = 16,000 IDR
export const NOMINAL_CREDIT_VALUE_IDR = 44.80;  // 1 AMF Credit = ~Rp 44.80 ($0.0028 USD)

export interface CostCalculationInput {
  provider: string;
  model: string;
  promptTokens?: number;
  candidatesTokens?: number;
  cachedTokens?: number;
  imageCount?: number;
  videoDurationSeconds?: number;
  resolution?: string;
  audioDurationSeconds?: number;
  retryCount?: number;
  isFreeTierActive?: boolean;
  exchangeRateIdr?: number;
  creditsCharged?: number;
}

export interface CostCalculationResult {
  providerActualCostUsd: number;
  paidEquivalentCostUsd: number;
  providerActualCostIdr: number;
  paidEquivalentCostIdr: number;
  internalCreditValueIdr: number;
  customerChargeIdr: number;
  costStatus: 'free_tier' | 'metered_real' | 'mock_simulated' | 'estimated' | 'unknown';
  pricingSource: string;
  currency: string;
  exchangeRateIdr: number;
  breakdown: {
    inputCostUsd: number;
    outputCostUsd: number;
    cachedCostUsd: number;
    mediaCostUsd: number;
  };
}

export function calculateProviderCost(input: CostCalculationInput): CostCalculationResult {
  const {
    provider,
    model,
    promptTokens = 0,
    candidatesTokens = 0,
    cachedTokens = 0,
    imageCount = 0,
    videoDurationSeconds = 0,
    resolution = '1080p',
    isFreeTierActive = true,
    exchangeRateIdr = DEFAULT_EXCHANGE_RATE_IDR,
    creditsCharged = 0,
  } = input;

  const pricing = OFFICIAL_PROVIDER_PRICING_REGISTRY[model];

  // If mock/simulated media
  if (provider === 'mock' || model.includes('mock') || model.includes('svg')) {
    return {
      providerActualCostUsd: 0,
      paidEquivalentCostUsd: 0,
      providerActualCostIdr: 0,
      paidEquivalentCostIdr: 0,
      internalCreditValueIdr: creditsCharged * NOMINAL_CREDIT_VALUE_IDR,
      customerChargeIdr: creditsCharged * NOMINAL_CREDIT_VALUE_IDR,
      costStatus: 'mock_simulated',
      pricingSource: 'Internal Mock Simulator (Zero Provider Invoiced Cost)',
      currency: 'USD',
      exchangeRateIdr,
      breakdown: { inputCostUsd: 0, outputCostUsd: 0, cachedCostUsd: 0, mediaCostUsd: 0 },
    };
  }

  // If unlisted/unknown model
  if (!pricing) {
    return {
      providerActualCostUsd: 0,
      paidEquivalentCostUsd: 0,
      providerActualCostIdr: 0,
      paidEquivalentCostIdr: 0,
      internalCreditValueIdr: creditsCharged * NOMINAL_CREDIT_VALUE_IDR,
      customerChargeIdr: creditsCharged * NOMINAL_CREDIT_VALUE_IDR,
      costStatus: 'unknown',
      pricingSource: 'Unverified Model Tariff (Unknown Cost)',
      currency: 'USD',
      exchangeRateIdr,
      breakdown: { inputCostUsd: 0, outputCostUsd: 0, cachedCostUsd: 0, mediaCostUsd: 0 },
    };
  }

  // Compute text tokens cost
  const inputCost = pricing.inputCostPerMillionUsd
    ? (promptTokens / 1000000) * pricing.inputCostPerMillionUsd
    : 0;

  const outputCost = pricing.outputCostPerMillionUsd
    ? (candidatesTokens / 1000000) * pricing.outputCostPerMillionUsd
    : 0;

  const cachedCost = pricing.cachedCostPerMillionUsd
    ? (cachedTokens / 1000000) * pricing.cachedCostPerMillionUsd
    : 0;

  // Compute media cost
  let mediaCost = 0;
  if (pricing.costPerImageUsd && imageCount > 0) {
    mediaCost += imageCount * pricing.costPerImageUsd;
  }
  if (pricing.costPerVideoSecondUsd && videoDurationSeconds > 0) {
    const rate = resolution === '4K' && pricing.costPerVideoSecond4kUsd
      ? pricing.costPerVideoSecond4kUsd
      : pricing.costPerVideoSecondUsd;
    mediaCost += videoDurationSeconds * rate;
  }

  const rawPaidEquivalentUsd = Number((inputCost + outputCost + cachedCost + mediaCost).toFixed(6));

  // Determine actual billed cost based on Free Tier status
  let actualBilledUsd = 0;
  let costStatus: 'free_tier' | 'metered_real' = 'free_tier';

  if (isFreeTierActive && pricing.freeTierEligible) {
    actualBilledUsd = 0.0;
    costStatus = 'free_tier';
  } else {
    actualBilledUsd = rawPaidEquivalentUsd;
    costStatus = 'metered_real';
  }

  const customerCharge = creditsCharged * NOMINAL_CREDIT_VALUE_IDR;

  return {
    providerActualCostUsd: actualBilledUsd,
    paidEquivalentCostUsd: rawPaidEquivalentUsd,
    providerActualCostIdr: Number((actualBilledUsd * exchangeRateIdr).toFixed(2)),
    paidEquivalentCostIdr: Number((rawPaidEquivalentUsd * exchangeRateIdr).toFixed(2)),
    internalCreditValueIdr: customerCharge,
    customerChargeIdr: customerCharge,
    costStatus,
    pricingSource: pricing.rateSource,
    currency: 'USD',
    exchangeRateIdr,
    breakdown: {
      inputCostUsd: Number(inputCost.toFixed(6)),
      outputCostUsd: Number(outputCost.toFixed(6)),
      cachedCostUsd: Number(cachedCost.toFixed(6)),
      mediaCostUsd: Number(mediaCost.toFixed(6)),
    },
  };
}

// Vercel Serverless Function guard: Prevents build failure when scanning api/ directory
export default function handler(req: any, res: any) {
  return res.status(404).json({ error: 'Internal module. Not an endpoint.' });
}
