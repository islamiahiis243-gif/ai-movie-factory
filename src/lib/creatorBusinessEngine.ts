/**
 * Creator Business Intelligence & Financial Breakdown Engine - AI Movie Factory (SSOT Wave II - Section III.3 & TC-WF-16)
 *
 * Hardened for Milestone 2.8.1: Financial Accuracy & Tax Logic Hardening.
 *
 * Compliance Highlights:
 * 1. Strict Revenue Deduplication: Prevents double counting between creator_milestones and payment_orders.
 * 2. Refund Partitioning: Strictly separates cash refunds (buyer refunds) from credit balance refunds (quota restores).
 * 3. AI Cost Clarity: Differentiates internal credit billing equivalent from raw provider API billing invoices.
 * 4. Realistic Hosting & CDN: Strictly marked as [ESTIMATED_PROJECTION] unless backed by provider egress invoice.
 * 5. DJP Legal Tax Compliance:
 *    - PPh Final UMKM PP 55/2022 (0.5% omzet bruto, batas Rp 4.8 M, masa berlaku, fasilitas omzet Rp 500 jt bebas pajak untuk WP OP).
 *    - PPN PMK 131/2024 / UU HPP: Dikenakan pada DPP Penyerahan oleh PKP, BUKAN pada laba operasional bersih.
 *    - PPh 21 (TER PP 58/2023 / Pasal 17) dan PPh 23 (2% Jasa Teknik/Manajemen) dipisahkan secara tegas.
 *    - Status 'TAX_BASIS_UNCONFIRMED' bila data profil pajak pengguna belum terkonfirmasi lengkap.
 * 6. AI Business Advisor: Explicitly labels confidence as "Rule-Based Coverage Score" (not financial certainty).
 */

import { CreatorMilestone, CreditTransaction, PaymentOrder, PublishingPlatformKey } from '../types/database';

export type FinancialDataClassification = 
  | 'VERIFIED_ACTUAL' 
  | 'ESTIMATED_PROJECTION'
  | 'ESTIMATED_BENCHMARK'
  | 'INTERNAL_RATE_EQUIVALENT'
  | 'DATA_PENDING';

export type TaxPayerCategory = 
  | 'wp_op_umkm'           // Wajib Pajak Orang Pribadi UMKM
  | 'wp_badan_umkm'        // Wajib Pajak Badan UMKM (CV/Firma/PT)
  | 'pkp_badan'            // Pengusaha Kena Pajak (PKP) Badan Usaha
  | 'non_pkp_op'           // Orang Pribadi Non-PKP / Freelancer
  | 'custom_jurisdiction'; // Wajib Pajak Luar Negeri / Kustom

export type TaxRegimeType = 
  | 'pph_final_umkm'        // PPh Final UMKM PP 55/2022 (0.5% Omzet Bruto)
  | 'ppn_11_dpp_nilai_lain' // PPN 11% Efektif (12% x 11/12 DPP Penyerahan JKP/BKP - PMK 131/2024)
  | 'pph_21_freelance'      // PPh 21 Jasa Kreatif Orang Pribadi (TER PP 58/2023)
  | 'pph_23_jasa'           // PPh 23 Jasa Produksi/Editing oleh Badan Pemotong (2% Bruto)
  | 'non_pkp_exempt'        // Non-PKP (Bebas PPN; PPh dihitung terpisah)
  | 'tax_basis_unconfirmed' // Basis Pajak Belum Terkonfirmasi (Data belum lengkap)
  | 'custom';               // Kustom Mandiri

export interface TaxRegimeConfig {
  type: TaxRegimeType;
  label: string;
  ratePercent: number;
  basis: 'gross_revenue' | 'dpp_penyerahan' | 'net_operating_profit' | 'unconfirmed';
  legalReference: string;
  description: string;
  requiresEligibilityCheck: boolean;
}

export const LEGAL_TAX_DISCLAIMER = 
  'Kalkulasi perpajakan ini merupakan estimasi perencanaan informatif berdasarkan simulasi ketentuan DJP (UU HPP / PP 55/2022 / PP 58/2023 / PMK 131/2024) dan bukan merupakan Surat Ketetapan Pajak (SKP) atau pengganti nasihat konsultan pajak resmi.';

export const TAX_REGIME_PRESETS: Record<TaxRegimeType, TaxRegimeConfig> = {
  pph_final_umkm: {
    type: 'pph_final_umkm',
    label: 'PPh Final UMKM (0.5% Omzet - PP 55/2022)',
    ratePercent: 0.5,
    basis: 'gross_revenue',
    legalReference: 'PP No. 55 Tahun 2022 / UU Harmonisasi Peraturan Perpajakan (HPP)',
    description: 'Tarif PPh 0,5% dari peredaran bruto untuk WP dengan omzet s.d. Rp 4,8 Milyar. WP OP berhak atas fasilitas omzet s.d. Rp 500 juta bebas pajak.',
    requiresEligibilityCheck: true,
  },
  ppn_11_dpp_nilai_lain: {
    type: 'ppn_11_dpp_nilai_lain',
    label: 'PPN 11% Efektif (DPP Nilai Lain - PMK 131/2024)',
    ratePercent: 11.0,
    basis: 'dpp_penyerahan',
    legalReference: 'PMK No. 131/2024 jo. UU HPP',
    description: 'Pajak Pertambahan Nilai dikenakan atas penyerahan JKP/BKP oleh Pengusaha Kena Pajak (PKP) berdasarkan Dasar Pengenaan Pajak (DPP), BUKAN atas laba bersih.',
    requiresEligibilityCheck: true,
  },
  pph_21_freelance: {
    type: 'pph_21_freelance',
    label: 'PPh 21 Imbalan Jasa Kreatif OP (TER PP 58/2023)',
    ratePercent: 2.5, // Estimasi rata-rata TER Kategori A/B
    basis: 'gross_revenue',
    legalReference: 'PP No. 58 Tahun 2023 jo. Pasal 17 UU PPh',
    description: 'Pemotongan PPh 21 atas penghasilan orang pribadi dari kegiatan jasa pembuatan film/animasi bebas berdasarkan Tarif Efektif Rata-Rata.',
    requiresEligibilityCheck: false,
  },
  pph_23_jasa: {
    type: 'pph_23_jasa',
    label: 'PPh 23 Jasa Pembuatan Konten (2% Bruto)',
    ratePercent: 2.0,
    basis: 'gross_revenue',
    legalReference: 'Pasal 23 ayat (1) huruf c UU PPh',
    description: 'Potongan PPh 23 sebesar 2% atas imbalan jasa penyiaran, pembuatan film pendek, editing, atau manajemen yang dipotong oleh pihak Badan ber-NPWP.',
    requiresEligibilityCheck: false,
  },
  non_pkp_exempt: {
    type: 'non_pkp_exempt',
    label: 'Non-PKP (Bebas PPN)',
    ratePercent: 0.0,
    basis: 'dpp_penyerahan',
    legalReference: 'PMK Batasan Pengusaha Kecil Non-PKP',
    description: 'Kreator non-PKP beromzet di bawah Rp 4,8 Milyar tidak wajib memungut PPN dari penonton/klien.',
    requiresEligibilityCheck: false,
  },
  tax_basis_unconfirmed: {
    type: 'tax_basis_unconfirmed',
    label: 'Basis Pajak Belum Terkonfirmasi',
    ratePercent: 0.0,
    basis: 'unconfirmed',
    legalReference: 'Memerlukan Konfirmasi Profil Wajib Pajak',
    description: 'Profil wajib pajak belum lengkap. Sistem secara jujur tidak mengarang besaran pajak hingga status PKP dan bentuk badan usaha terverifikasi.',
    requiresEligibilityCheck: false,
  },
  custom: {
    type: 'custom',
    label: 'Kustom Mandiri (Yurisdiksi Luar / Khusus)',
    ratePercent: 5.0,
    basis: 'net_operating_profit',
    legalReference: 'Konfigurasi Mandiri Pengguna',
    description: 'Tarif pajak kustom yang ditentukan mandiri oleh pengguna sesuai domisili fiskal.',
    requiresEligibilityCheck: false,
  },
};

export type FinancialTimePeriod = 'all_time' | 'last_30_days' | 'last_7_days' | 'by_project';

export interface ProviderBillingEntry {
  jobId: string;
  provider: 'google_gemini' | 'runway' | 'elevenlabs' | 'openai' | 'other';
  model: string;
  usageUnits: number;
  unitType: 'tokens' | 'seconds' | 'images' | 'characters';
  currency: 'USD' | 'IDR';
  costAmount: number;
  invoiceReference?: string;
}

export interface FinancialLineItem {
  id: string;
  category: 
    | 'cash_revenue_order' 
    | 'external_revenue_milestone' 
    | 'cash_refund' 
    | 'credit_refund_operation' 
    | 'platform_fee' 
    | 'gateway_fee' 
    | 'ai_credit_equivalent' 
    | 'ai_provider_actual' 
    | 'hosting_cdn_estimate' 
    | 'tax_estimate';
  label: string;
  amountIdr: number;
  classification: FinancialDataClassification;
  dataSource: string;
  isDeduction: boolean;
  notes?: string;
}

export interface ComprehensiveFinancialReport {
  period: FinancialTimePeriod;
  periodLabel: string;
  selectedProjectId?: string;
  generatedAt: string;
  classification: FinancialDataClassification;
  hasVerifiedActualData: boolean;

  // Revenue Components (Strictly Deduplicated)
  grossRevenueIdr: number;            // Total recognized cash gross revenue
  onPlatformOrdersGrossIdr: number;   // Settled payment orders (tickets, passes, PPV)
  externalMilestonesGrossIdr: number; // Off-platform confirmed payouts (YouTube AdSense, TikTok)
  pendingRevenueIdr: number;          // Unsettled / pending orders (NOT in gross)

  // Refund Components (Strictly Partitioned)
  cashRefundsIdr: number;             // Real money returned to buyers (DEDUCTED FROM NET PROFIT)
  creditRefundsCount: number;         // Quota credits restored to user ledger
  creditRefundsEquivalentIdr: number; // Informational IDR quota equivalent (NOT deducted from cash gross)

  // Platform Share Components (Non-Universal, Program Aware)
  platformFeesIdr: number;
  platformProgram: string;
  isPlatformFeeEstimated: boolean;

  // Gateway Fees (Actual Settlement vs Standard Benchmark)
  gatewayFeesIdr: number;
  isGatewayFeeEstimated: boolean;

  // AI Production Costs (Internal Credit Rate vs Raw Provider Invoice)
  internalAiCreditsConsumed: number;
  internalCreditCostEquivalentIdr: number; // Credits * Rp 1.000 (Internal rate equivalent)
  actualProviderCostIdr: number;           // Real provider API invoice (if provided)
  hasActualProviderInvoices: boolean;

  // Hosting & CDN Costs (Explicitly Estimated Benchmark)
  hostingCdnCostIdr: number;
  isHostingCdnEstimated: boolean;

  // Tax Estimation (DJP Legal Rules)
  taxIdr: number;
  taxRegime: TaxRegimeConfig;
  taxPayerCategory: TaxPayerCategory;
  taxableBaseIdr: number;
  taxBasisStatus: 'CONFIRMED' | 'UNCONFIRMED_DATA_PENDING';
  taxDisclaimer: string;

  // Operating Totals & Net Results
  totalOperatingCashCostsIdr: number; // cashRefunds + platformFees + gatewayFees + aiCostUsed + hostingCdnCost
  totalDeductionsIdr: number;         // totalOperatingCashCostsIdr + taxIdr
  netProfitIdr: number;               // grossRevenueIdr - totalDeductionsIdr
  netProfitMarginPercent: number;     // (netProfit / grossRevenue) * 100
  roiPercent: number;                 // (netProfit / totalInvestment) * 100

  // Traceable Line Items
  lineItems: FinancialLineItem[];

  // Operational Counts
  totalViews: number;
  totalPublishedFilms: number;
  settledOrdersCount: number;
  unitCostPerViewIdr: number;
}

export interface AIBusinessAdvisorDirective {
  id: string;
  title: string;
  category: 'monetization' | 'cost_efficiency' | 'distribution_roi' | 'tax_optimization';
  badge: 'OPTIMAL' | 'RECOMMENDED' | 'WARNING' | 'DATA_PENDING';
  ruleBasedConfidenceScore: number; // 0-100 (Internal coverage metric, not financial probability)
  confidenceDescription: string;
  evidenceDataSource: string;
  marketAssumptions: string;
  riskBoundary: string;
  strategicAction: string;
}

// Standard Internal Credit Value Conversion: 1 Credit = Rp 1.000 IDR (Internal user quota equivalent)
export const INTERNAL_CREDIT_RATE_IDR = 1000;

/**
 * Filter items by date period safely.
 */
export function isDateWithinPeriod(dateIso: string | undefined, period: FinancialTimePeriod): boolean {
  if (!dateIso || period === 'all_time' || period === 'by_project') return true;
  const itemDate = new Date(dateIso).getTime();
  const now = Date.now();
  if (isNaN(itemDate)) return false;

  if (period === 'last_7_days') {
    return itemDate >= now - 7 * 24 * 60 * 60 * 1000;
  }
  if (period === 'last_30_days') {
    return itemDate >= now - 30 * 24 * 60 * 60 * 1000;
  }
  return true;
}

/**
 * Compute Comprehensive Financial Report with strict deduplication, legal tax logic, and partitioned refunds.
 */
export function calculateComprehensiveFinancialReport(params: {
  milestones: CreatorMilestone[];
  creditTransactions: CreditTransaction[];
  paymentOrders?: PaymentOrder[];
  providerInvoices?: ProviderBillingEntry[];
  period?: FinancialTimePeriod;
  selectedProjectId?: string;
  taxRegime?: TaxRegimeType;
  taxPayerCategory?: TaxPayerCategory;
  customTaxRate?: number;
  isGrossPrePlatformCut?: boolean;
  platformProgram?: string;
  isUmkmRevenueOver500M?: boolean; // For WP OP UMKM: omzet s.d. 500 jt bebas PPh Final
}): ComprehensiveFinancialReport {
  const period = params.period || 'all_time';
  const selectedProjectId = params.selectedProjectId;
  const isGrossPrePlatformCut = Boolean(params.isGrossPrePlatformCut);
  const platformProgram = params.platformProgram || (isGrossPrePlatformCut ? 'pre_split_partner_program' : 'direct_net_payout');
  const taxPayerCategory = params.taxPayerCategory || 'wp_op_umkm';
  const isUmkmRevenueOver500M = params.isUmkmRevenueOver500M !== undefined ? params.isUmkmRevenueOver500M : true;

  const chosenRegimeKey = params.taxRegime || 'pph_final_umkm';
  const taxPreset = TAX_REGIME_PRESETS[chosenRegimeKey] || TAX_REGIME_PRESETS.pph_final_umkm;
  const taxRegime: TaxRegimeConfig = {
    ...taxPreset,
    ratePercent: chosenRegimeKey === 'custom' && params.customTaxRate !== undefined
      ? Math.max(0, Math.min(params.customTaxRate, 50))
      : taxPreset.ratePercent,
  };

  const lineItems: FinancialLineItem[] = [];

  // ==========================================================================
  // 1. PAYMENT ORDERS AUDIT (Primary on-platform atomic transaction ledger)
  // ==========================================================================
  let onPlatformOrdersGrossIdr = 0;
  let pendingRevenueIdr = 0;
  let cashRefundsIdr = 0;
  let gatewayFeesIdr = 0;
  let settledOrdersCount = 0;

  if (params.paymentOrders && params.paymentOrders.length > 0) {
    const relevantOrders = params.paymentOrders.filter((ord) => 
      isDateWithinPeriod(ord.paid_at || ord.created_at, period)
    );

    relevantOrders.forEach((ord) => {
      const isSettled = ['completed', 'settlement', 'paid'].includes(ord.status);
      const isPending = ['pending', 'processing'].includes(ord.status);
      const isCashRefundOrCancelled = ['refund', 'cancel', 'cancelled', 'expire'].includes(ord.status);

      if (isSettled && ord.amount > 0) {
        onPlatformOrdersGrossIdr += ord.amount;
        settledOrdersCount += 1;

        lineItems.push({
          id: `rev_order_${ord.id}`,
          category: 'cash_revenue_order',
          label: `Transaksi Penonton: ${ord.package_name || ord.order_number}`,
          amountIdr: ord.amount,
          classification: 'VERIFIED_ACTUAL',
          dataSource: `payment_orders (No: ${ord.order_number}, Status: ${ord.status})`,
          isDeduction: false,
          notes: `Metode: ${ord.payment_method.toUpperCase()}`,
        });

        // Gateway Fee Calculation (Bank Indonesia MDR standards)
        let fee = 0;
        if (ord.payment_method === 'qris') {
          fee = Math.round(ord.amount * 0.007); // 0.7% BI QRIS MDR
        } else if (ord.payment_method === 'credit_card') {
          fee = Math.round(ord.amount * 0.029 + 2000); // 2.9% + Rp 2.000
        } else {
          fee = 2500; // Flat Virtual Account fee
        }
        gatewayFeesIdr += fee;

      } else if (isPending && ord.amount > 0) {
        pendingRevenueIdr += ord.amount;

      } else if (isCashRefundOrCancelled && ord.amount > 0) {
        cashRefundsIdr += ord.amount;
        lineItems.push({
          id: `refund_cash_${ord.id}`,
          category: 'cash_refund',
          label: `Refund Uang Penonton: ${ord.order_number}`,
          amountIdr: ord.amount,
          classification: 'VERIFIED_ACTUAL',
          dataSource: `payment_orders (Status: ${ord.status})`,
          isDeduction: true,
          notes: 'Pengembalian dana riil kepada pembeli tiket/konten.',
        });
      }
    });
  }

  // Gateway fee line item
  if (gatewayFeesIdr > 0) {
    lineItems.push({
      id: 'cost_gateway_fee',
      category: 'gateway_fee',
      label: `Biaya Merchant Gateway (${settledOrdersCount} transaksi)`,
      amountIdr: gatewayFeesIdr,
      classification: 'ESTIMATED_BENCHMARK',
      dataSource: 'Standar MDR Settlement Gateway (QRIS 0.7% / VA Flat / CC 2.9%)',
      isDeduction: true,
    });
  }

  // ==========================================================================
  // 2. CREATOR MILESTONES AUDIT & DEDUPLICATION DEFENSE
  // ==========================================================================
  const filteredMilestones = params.milestones.filter((m) => {
    if (selectedProjectId && m.project_id && m.project_id !== selectedProjectId) return false;
    return isDateWithinPeriod(m.release_date || m.created_at, period);
  });

  let totalViews = 0;
  let externalMilestonesGrossIdr = 0;

  filteredMilestones.forEach((m) => {
    totalViews += m.views_count || 0;
    const rev = Number(m.revenue_earned) || 0;

    // DEDUPLICATION INVARIANT:
    // If platform is 'web_drama' and we already have on-platform payment_orders,
    // milestone revenue_earned is treated as an aggregate snapshot of those orders to prevent double counting!
    const isInternalOttSeries = m.platform === 'web_drama';
    const hasInternalOrders = onPlatformOrdersGrossIdr > 0;

    if (rev > 0) {
      if (isInternalOttSeries && hasInternalOrders) {
        // Log as duplicate-protected line item with 0 addition
        lineItems.push({
          id: `rev_milestone_dupe_${m.id}`,
          category: 'external_revenue_milestone',
          label: `Snapshot Rilis Web Drama: ${m.project_name} (Terdeduplikasi)`,
          amountIdr: 0,
          classification: 'VERIFIED_ACTUAL',
          dataSource: `creator_milestones (ID: ${m.id})`,
          isDeduction: false,
          notes: `Double-counting dicegah: Nilai Rp ${rev.toLocaleString('id-ID')} telah dihitung dari transaksi payment_orders secara atomik.`,
        });
      } else {
        externalMilestonesGrossIdr += rev;
        lineItems.push({
          id: `rev_milestone_${m.id}`,
          category: 'external_revenue_milestone',
          label: `Pendapatan Kanal: ${m.project_name || 'Karya'} (${m.platform.toUpperCase()})`,
          amountIdr: rev,
          classification: 'VERIFIED_ACTUAL',
          dataSource: `creator_milestones (ID: ${m.id})`,
          isDeduction: false,
          notes: `${(m.views_count || 0).toLocaleString('id-ID')} views terverifikasi di ${m.platform}`,
        });
      }
    }
  });

  // Total Realized Cash Gross Revenue
  const grossRevenueIdr = onPlatformOrdersGrossIdr + externalMilestonesGrossIdr;

  // ==========================================================================
  // 3. CREDIT TRANSACTIONS AUDIT & REFUND PARTITIONING
  // ==========================================================================
  const filteredTx = params.creditTransactions.filter((tx) => {
    if (selectedProjectId && tx.project_id && tx.project_id !== selectedProjectId) return false;
    return isDateWithinPeriod(tx.created_at, period);
  });

  let internalAiCreditsConsumed = 0;
  let creditRefundsCount = 0;

  filteredTx.forEach((tx) => {
    if (tx.transaction_type === 'usage') {
      internalAiCreditsConsumed += Math.abs(tx.amount);
    } else if (tx.transaction_type === 'refund') {
      creditRefundsCount += Math.abs(tx.amount);
    }
  });

  // Internal credit equivalent (Internal rate: Rp 1.000 / credit)
  const internalCreditCostEquivalentIdr = internalAiCreditsConsumed * INTERNAL_CREDIT_RATE_IDR;
  const creditRefundsEquivalentIdr = creditRefundsCount * INTERNAL_CREDIT_RATE_IDR;

  // If provider billing invoices are available, calculate actual API cost; otherwise 0
  let actualProviderCostIdr = 0;
  let hasActualProviderInvoices = false;
  if (params.providerInvoices && params.providerInvoices.length > 0) {
    hasActualProviderInvoices = true;
    params.providerInvoices.forEach((inv) => {
      actualProviderCostIdr += inv.costAmount;
    });
  }

  // Line item for internal credit usage
  if (internalCreditCostEquivalentIdr > 0) {
    lineItems.push({
      id: 'cost_ai_internal_rate',
      category: 'ai_credit_equivalent',
      label: `Nilai Kuota Kredit AI Terpakai (${internalAiCreditsConsumed.toLocaleString('id-ID')} CR)`,
      amountIdr: internalCreditCostEquivalentIdr,
      classification: 'INTERNAL_RATE_EQUIVALENT',
      dataSource: `credit_transactions (Usage Ledger: ${internalAiCreditsConsumed} CR @ Rp 1.000 tariff)`,
      isDeduction: true,
      notes: 'Biaya komputasi setara kuota internal AMF. Bukan invoice provider pihak ketiga langsung.',
    });
  }

  // Credit refunds operational item (DOES NOT DEDUCT FROM CASH PROFIT)
  if (creditRefundsCount > 0) {
    lineItems.push({
      id: 'refund_credit_quota',
      category: 'credit_refund_operation',
      label: `Restorasi Saldo Kredit Gagal (${creditRefundsCount} CR)`,
      amountIdr: creditRefundsEquivalentIdr,
      classification: 'INTERNAL_RATE_EQUIVALENT',
      dataSource: 'credit_transactions (Status: auto_refunded to user credit ledger)',
      isDeduction: false, // Does NOT reduce cash net profit
      notes: 'Kredit internal dikembalikan ke akun pengguna. Tidak memengaruhi arus kas uang tunai.',
    });
  }

  // ==========================================================================
  // 4. PLATFORM REVENUE SHARE (NON-UNIVERSAL)
  // ==========================================================================
  let platformFeesIdr = 0;
  let isPlatformFeeEstimated = false;

  if (isGrossPrePlatformCut && grossRevenueIdr > 0) {
    // Platform share is explicitly pre-split
    isPlatformFeeEstimated = true;
    platformFeesIdr = Math.round(externalMilestonesGrossIdr * 0.10); // 10% standard pre-split agreement
    lineItems.push({
      id: 'cost_platform_fee',
      category: 'platform_fee',
      label: `Potongan Bagi Hasil Platform (${platformProgram})`,
      amountIdr: platformFeesIdr,
      classification: 'ESTIMATED_BENCHMARK',
      dataSource: `Perjanjian Mitra Platform (${platformProgram} pre-split)`,
      isDeduction: true,
      notes: 'Dikenakan hanya atas pendapatan saluran eksternal sebelum bagi hasil.',
    });
  } else {
    // Net payout: platform fees already withheld by platform prior to payout
    platformFeesIdr = 0;
    lineItems.push({
      id: 'cost_platform_fee_net',
      category: 'platform_fee',
      label: 'Potongan Layanan Platform (Rp 0 - Payout Bersih)',
      amountIdr: 0,
      classification: 'VERIFIED_ACTUAL',
      dataSource: 'Pemasukan diakui sebagai pembayaran bersih (net payout); bebas potongan ganda.',
      isDeduction: true,
    });
  }

  // ==========================================================================
  // 5. HOSTING & CDN STREAMING (ESTIMATED PROJECTION)
  // ==========================================================================
  // Industry standard benchmark: Rp 25.000 per 10.000 views
  const hostingCdnCostIdr = totalViews > 0 ? Math.round((totalViews / 10000) * 25000) : 0;
  if (hostingCdnCostIdr > 0) {
    lineItems.push({
      id: 'cost_hosting_cdn',
      category: 'hosting_cdn_estimate',
      label: `Estimasi Bandwidth CDN & Storage (${totalViews.toLocaleString('id-ID')} tayangan)`,
      amountIdr: hostingCdnCostIdr,
      classification: 'ESTIMATED_PROJECTION',
      dataSource: 'Tolak Ukur Streaming CDN Industri (Rp 25.000 / 10.000 views)',
      isDeduction: true,
      notes: 'Beban estimasi proyeksi, belum diverifikasi dengan invoice Cloudflare/AWS langsung.',
    });
  }

  // ==========================================================================
  // 6. DJP LEGAL TAX CALCULATION
  // ==========================================================================
  // Active AI cost used for operational calculations:
  const aiCostDeducted = hasActualProviderInvoices ? actualProviderCostIdr : internalCreditCostEquivalentIdr;
  const totalOperatingCashCostsIdr = cashRefundsIdr + platformFeesIdr + gatewayFeesIdr + aiCostDeducted + hostingCdnCostIdr;

  let taxableBaseIdr = 0;
  let taxIdr = 0;
  let taxBasisStatus: 'CONFIRMED' | 'UNCONFIRMED_DATA_PENDING' = 'CONFIRMED';

  if (taxRegime.type === 'tax_basis_unconfirmed') {
    taxBasisStatus = 'UNCONFIRMED_DATA_PENDING';
    taxableBaseIdr = 0;
    taxIdr = 0;

  } else if (taxRegime.type === 'pph_final_umkm') {
    // PP 55/2022: 0.5% dari omzet bruto
    // Jika WP Orang Pribadi dan omzet belum tembus 500 jt, bebas pajak
    if (taxPayerCategory === 'wp_op_umkm' && !isUmkmRevenueOver500M) {
      taxableBaseIdr = 0;
      taxIdr = 0;
    } else {
      taxableBaseIdr = grossRevenueIdr;
      taxIdr = Math.round(taxableBaseIdr * 0.005);
    }

  } else if (taxRegime.type === 'ppn_11_dpp_nilai_lain') {
    // PPN PMK 131/2024: DPP adalah harga penyerahan (bukan laba bersih!)
    taxableBaseIdr = grossRevenueIdr;
    taxIdr = Math.round(taxableBaseIdr * 0.11);

  } else if (taxRegime.type === 'pph_21_freelance' || taxRegime.type === 'pph_23_jasa') {
    // PPh 21 / 23 dipotong dari penghasilan bruto jasa
    taxableBaseIdr = grossRevenueIdr;
    taxIdr = Math.round(taxableBaseIdr * (taxRegime.ratePercent / 100));

  } else if (taxRegime.type === 'non_pkp_exempt') {
    taxableBaseIdr = grossRevenueIdr;
    taxIdr = 0;

  } else {
    // Custom
    taxableBaseIdr = Math.max(grossRevenueIdr - totalOperatingCashCostsIdr, 0);
    taxIdr = Math.round(taxableBaseIdr * (taxRegime.ratePercent / 100));
  }

  lineItems.push({
    id: 'cost_tax_estimate',
    category: 'tax_estimate',
    label: `Estimasi Pajak: ${taxRegime.label}`,
    amountIdr: taxIdr,
    classification: taxBasisStatus === 'CONFIRMED' ? 'ESTIMATED_PROJECTION' : 'DATA_PENDING',
    dataSource: `${taxRegime.legalReference} (Basis: ${taxRegime.basis})`,
    isDeduction: true,
    notes: taxRegime.description,
  });

  // ==========================================================================
  // 7. TOTALS, NET PROFIT & MARGIN CALCULATIONS
  // ==========================================================================
  const totalDeductionsIdr = totalOperatingCashCostsIdr + taxIdr;
  const netProfitIdr = grossRevenueIdr - totalDeductionsIdr;
  const netProfitMarginPercent = grossRevenueIdr > 0 ? Number(((netProfitIdr / grossRevenueIdr) * 100).toFixed(1)) : 0;

  const totalInvestment = aiCostDeducted + hostingCdnCostIdr + gatewayFeesIdr + platformFeesIdr;
  const roiPercent = totalInvestment > 0 ? Number(((netProfitIdr / totalInvestment) * 100).toFixed(1)) : 0;
  const unitCostPerViewIdr = totalViews > 0 ? Number((totalDeductionsIdr / totalViews).toFixed(2)) : 0;

  const hasVerifiedActualData = (grossRevenueIdr > 0 || internalCreditCostEquivalentIdr > 0 || totalViews > 0);

  const periodLabels: Record<FinancialTimePeriod, string> = {
    all_time: 'Seluruh Waktu (All-Time)',
    last_30_days: '30 Hari Terakhir',
    last_7_days: '7 Hari Terakhir',
    by_project: selectedProjectId ? `Proyek Spesifik (ID: ${selectedProjectId.slice(0, 8)})` : 'Per Proyek',
  };

  return {
    period,
    periodLabel: periodLabels[period],
    selectedProjectId,
    generatedAt: new Date().toISOString(),
    classification: hasVerifiedActualData ? 'VERIFIED_ACTUAL' : 'ESTIMATED_PROJECTION',
    hasVerifiedActualData,
    grossRevenueIdr,
    onPlatformOrdersGrossIdr,
    externalMilestonesGrossIdr,
    pendingRevenueIdr,
    cashRefundsIdr,
    creditRefundsCount,
    creditRefundsEquivalentIdr,
    platformFeesIdr,
    platformProgram,
    isPlatformFeeEstimated,
    gatewayFeesIdr,
    isGatewayFeeEstimated: true,
    internalAiCreditsConsumed,
    internalCreditCostEquivalentIdr,
    actualProviderCostIdr,
    hasActualProviderInvoices,
    hostingCdnCostIdr,
    isHostingCdnEstimated: true,
    taxIdr,
    taxRegime,
    taxPayerCategory,
    taxableBaseIdr,
    taxBasisStatus,
    taxDisclaimer: LEGAL_TAX_DISCLAIMER,
    totalOperatingCashCostsIdr,
    totalDeductionsIdr,
    netProfitIdr,
    netProfitMarginPercent,
    roiPercent,
    lineItems,
    totalViews,
    totalPublishedFilms: filteredMilestones.length,
    settledOrdersCount,
    unitCostPerViewIdr,
  };
}

/**
 * Generate AI Business Advisor Directives based strictly on verified records.
 * Explicitly labels confidence as "Rule-Based Coverage Score" (not probability).
 */
export function generateAIBusinessAdvisorDirectives(report: ComprehensiveFinancialReport): AIBusinessAdvisorDirective[] {
  const directives: AIBusinessAdvisorDirective[] = [];

  if (!report.hasVerifiedActualData || (report.totalPublishedFilms === 0 && report.internalAiCreditsConsumed === 0)) {
    directives.push({
      id: 'adv_data_pending',
      title: 'Data Transaksi Riil Belum Cukup',
      category: 'distribution_roi',
      badge: 'DATA_PENDING',
      ruleBasedConfidenceScore: 100,
      confidenceDescription: 'Skor cakupan evaluasi aturan sistem (bukan kepastian probabilitas finansial).',
      evidenceDataSource: 'Database AMF belum mencatat transaksi terverifikasi atau rilis karya pada periode ini.',
      marketAssumptions: 'Rekomendasi memerlukan minimal 1 transaksi atau 1 milestone rilis nyata.',
      riskBoundary: 'Dilarang mengarang angka finansial tanpa basis data aktual.',
      strategicAction: 'Publikasikan film pertama Anda atau catat rilis tayangan pada tab Milestones.',
    });
    return directives;
  }

  // Directive 1: Production Cost & Credit Quota Efficiency
  if (report.totalViews > 0 && report.internalCreditCostEquivalentIdr > 0) {
    const costPerView = report.unitCostPerViewIdr;
    const isOptimal = costPerView <= 15;
    directives.push({
      id: 'adv_unit_cost',
      title: isOptimal ? 'Efisiensi Rasio Kredit per Tayangan Prima' : 'Evaluasi Pengeluaran Kredit Produksi',
      category: 'cost_efficiency',
      badge: isOptimal ? 'OPTIMAL' : 'RECOMMENDED',
      ruleBasedConfidenceScore: 92,
      confidenceDescription: 'Rule-based coverage score berdasarkan rasio biaya terpotong terhadap volume tayangan.',
      evidenceDataSource: `Total Biaya Operasional Rp ${report.totalDeductionsIdr.toLocaleString('id-ID')} dibagi ${report.totalViews.toLocaleString('id-ID')} views = Rp ${costPerView.toFixed(2)}/view. Pemakaian kuota: ${report.internalAiCreditsConsumed} CR.`,
      marketAssumptions: 'Efisiensi biaya di bawah Rp 15/view menjaga rasio keuntungan aman pada platform RPM moderat.',
      riskBoundary: 'Bila karakter visual tidak dikunci pada Gate 2 dan Gate 4, biaya komputasi dapat meningkat signifikan.',
      strategicAction: isOptimal
        ? 'Pertahankan pipeline 8-layer consistency dan approval gate untuk menjaga kestabilan efisiensi kredit.'
        : 'Manfaatkan template siap pakai dan kunci prompt karakter sebelum merender adegan berdurasi panjang.',
    });
  }

  // Directive 2: Net Margin & Deduplication Accuracy
  if (report.grossRevenueIdr > 0) {
    const isProfitable = report.netProfitIdr > 0;
    const isHighMargin = report.netProfitMarginPercent >= 50;
    directives.push({
      id: 'adv_net_margin',
      title: isHighMargin
        ? `Margin Laba Bersih Tinggi (${report.netProfitMarginPercent}%)`
        : (isProfitable ? `Laba Positif (${report.netProfitMarginPercent}% Margin)` : 'Posisi Operasional Masih Defisit'),
      category: 'monetization',
      badge: isHighMargin ? 'OPTIMAL' : (isProfitable ? 'RECOMMENDED' : 'WARNING'),
      ruleBasedConfidenceScore: 88,
      confidenceDescription: 'Rule-based coverage score berdasarkan margin laba bersih terhadap omzet.',
      evidenceDataSource: `Pendapatan Bruto Rp ${report.grossRevenueIdr.toLocaleString('id-ID')} (Orders: Rp ${report.onPlatformOrdersGrossIdr.toLocaleString('id-ID')}, Kanal: Rp ${report.externalMilestonesGrossIdr.toLocaleString('id-ID')}) dikurangi seluruh beban Rp ${report.totalDeductionsIdr.toLocaleString('id-ID')}.`,
      marketAssumptions: 'Pemisahan cash refund dan pendapatan kanal mencegah distorsi angka laba bersih.',
      riskBoundary: 'Fluktuasi RPM platform pihak ketiga dapat memengaruhi arus kas tanpa pemberitahuan sebelumnya.',
      strategicAction: isHighMargin
        ? 'Pertimbangkan reinvestasi keuntungan untuk serial web drama berbayar mandiri.'
        : 'Tinjau ulang hook 3 detik naskah untuk mendongkrak retensi audiens dan nilai RPM.',
    });
  }

  // Directive 3: DJP Legal Tax Advice
  directives.push({
    id: 'adv_tax_regime',
    title: `Analisis Estimasi Pajak: ${report.taxRegime.label}`,
    category: 'tax_optimization',
    badge: report.taxBasisStatus === 'CONFIRMED' ? 'OPTIMAL' : 'WARNING',
    ruleBasedConfidenceScore: 90,
    confidenceDescription: 'Rule-based compliance score berdasarkan kesesuaian parameter dengan regulasi DJP.',
    evidenceDataSource: report.taxBasisStatus === 'CONFIRMED'
      ? `Beban estimasi Rp ${report.taxIdr.toLocaleString('id-ID')} dihitung atas basis ${report.taxRegime.basis} (${report.taxRegime.legalReference}).`
      : 'Status basis pajak belum terkonfirmasi lengkap oleh profil pengguna.',
    marketAssumptions: 'Ketentuan perpajakan memerlukan pelaporan SPT tahunan dan kepatuhan administrasi resmi.',
    riskBoundary: 'Kesalahan pemilihan rezim pajak dapat menyebabkan kurang bayar atau sanksi administrasi perpajakan.',
    strategicAction: 'Gunakan angka ini sebagai referensi perencanaan kas dan konsultasikan dengan konsultan pajak terdaftar.',
  });

  return directives;
}
