/**
 * Creator Business Intelligence & Financial Breakdown Engine - AI Movie Factory (SSOT Wave II - Section III.3 & TC-WF-16)
 *
 * Hardened for Milestone 2.8.3: Tax Model Separation & Calculation Correction.
 *
 * Compliance Highlights:
 * 1. Strict Revenue Deduplication: Prevents double counting between creator_milestones and payment_orders.
 * 2. Refund Partitioning: Strictly separates cash refunds (buyer refunds) from credit balance refunds (quota restores).
 * 3. AI Cost Clarity: Differentiates internal credit billing equivalent from raw provider API billing invoices.
 * 4. Realistic Hosting & CDN: Strictly marked as [ESTIMATED_PROJECTION] unless backed by provider egress invoice.
 * 5. DJP Legal Tax Model Separation (UU HPP, PP 55/2022 jo. PP 20/2026, PMK 131/2024 & PMK 11/2025):
 *    - PPh Studio: PPh Final 0.5% (PP 55/2022 jo. PP 20/2026), fasilitas Rp 500M progresif untuk WP OP, validasi subjek PP 20/2026.
 *    - PPN Penyerahan: PMK 131/2024 non-mewah 11% efektif (12% x 11/12), pemisah harga inklusif (/ 1.11), isolasi tiket lokal vs ekspor platform.
 *    - PPN adalah kewajiban titipan (tax liability), BUKAN beban pengurang laba bersih operasional.
 *    - Directional Withholding: Bukti potong klien (Kredit Pajak AMF) vs Pajak dipotong AMF ke vendor/freelancer (Kewajiban Setor).
 *    - Default aman: 'TAX_BASIS_UNCONFIRMED' bila data profil pajak belum lengkap (Pajak = Rp 0).
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
  | 'wp_op_umkm'           // Wajib Pajak Orang Pribadi (PP 55/2022 jo. PP 20/2026: 0.5% & Fasilitas Rp 500M)
  | 'pt_perorangan_umkm'   // Perseroan Perorangan 1 Orang (PP 20/2026: 0.5% selama omzet <= 4.8M)
  | 'koperasi_umkm'        // Koperasi Dalam Negeri (PP 20/2026: 0.5% selama omzet <= 4.8M)
  | 'cv_firma_pt_baru'     // CV, Firma, PT Baru (PP 20/2026: Non-eligible 0.5%, wajib Tarif Umum Ps 17)
  | 'pkp_badan'            // Pengusaha Kena Pajak (PKP) Badan Usaha (Tarif Umum Ps 17 + Wajib PPN)
  | 'non_pkp_op'           // Orang Pribadi Non-PKP / Freelancer (Bebas PPN)
  | 'custom_jurisdiction'  // Wajib Pajak Luar Negeri / Kustom
  | 'unconfirmed';         // Profil Belum Dikonfirmasi

export type TaxRegimeType = 
  | 'pph_final_umkm'        // PPh Final UMKM 0.5% (PP 55/2022 jo. PP 20/2026)
  | 'pph_badan_pasal_17'    // PPh Badan Tarif Umum 22% (Pembukuan)
  | 'pph_op_pasal_17'       // PPh Orang Pribadi Tarif Umum / NPPN
  | 'non_taxable_under_500m'// WP OP Bebas PPh (Omzet Kumulatif <= Rp 500 Juta)
  | 'ppn_11_dpp_nilai_lain' // PPN 11% Efektif (12% x 11/12 DPP Penyerahan Non-Mewah PMK 131/2024 jo. PMK 11/2025)
  | 'pph_21_freelance'      // PPh 21 Imbalan Jasa Kreatif OP (TER PP 58/2023)
  | 'pph_23_jasa'           // PPh 23 Jasa Pembuatan Konten oleh Badan Pemotong (2% Bruto)
  | 'non_pkp_exempt'        // Non-PKP (Bebas PPN)
  | 'tax_basis_unconfirmed' // Basis Pajak Belum Terkonfirmasi (Default Aman)
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
  'Kalkulasi perpajakan ini merupakan estimasi perencanaan informatif berdasarkan simulasi ketentuan DJP (UU HPP / PP 55/2022 jo. PP 20/2026 / PMK 131/2024 / PMK 11/2025) dan bukan merupakan Surat Ketetapan Pajak (SKP) atau pengganti nasihat konsultan pajak resmi.';

export const TAX_REGIME_PRESETS: Record<TaxRegimeType, TaxRegimeConfig> = {
  tax_basis_unconfirmed: {
    type: 'tax_basis_unconfirmed',
    label: 'Basis Pajak Belum Terkonfirmasi (Default)',
    ratePercent: 0.0,
    basis: 'unconfirmed',
    legalReference: 'Memerlukan Konfirmasi Profil Wajib Pajak',
    description: 'Profil wajib pajak belum lengkap. Sistem secara jujur tidak mengarang besaran pajak hingga status PKP dan bentuk badan usaha terverifikasi.',
    requiresEligibilityCheck: false,
  },
  pph_final_umkm: {
    type: 'pph_final_umkm',
    label: 'PPh Final UMKM (0.5% Omzet - PP 55/2022 jo. PP 20/2026)',
    ratePercent: 0.5,
    basis: 'gross_revenue',
    legalReference: 'PP No. 55/2022 jo. PP No. 20/2026 / UU HPP',
    description: 'Tarif PPh 0,5% dari peredaran bruto untuk WP OP, Perseroan Perorangan, dan Koperasi (omzet s.d. Rp 4,8 Milyar). WP OP berhak atas fasilitas Rp 500 juta pertama bebas pajak secara progresif.',
    requiresEligibilityCheck: true,
  },
  pph_badan_pasal_17: {
    type: 'pph_badan_pasal_17',
    label: 'PPh Badan Tarif Umum 22% (Pasal 17 UU HPP)',
    ratePercent: 22.0,
    basis: 'net_operating_profit',
    legalReference: 'Pasal 17 ayat (1) huruf b UU HPP',
    description: 'Tarif PPh Badan 22% atas penghasilan kena pajak (laba bersih) untuk CV/Firma/PT baru atau badan beromzet di atas Rp 4,8 Milyar yang menyelenggarakan pembukuan.',
    requiresEligibilityCheck: false,
  },
  pph_op_pasal_17: {
    type: 'pph_op_pasal_17',
    label: 'PPh Orang Pribadi Tarif Umum / NPPN (Pasal 17)',
    ratePercent: 15.0, // Benchmark tarif rata-rata lapisan progresif
    basis: 'net_operating_profit',
    legalReference: 'Pasal 17 ayat (1) huruf a UU HPP jo. Norma NPPN',
    description: 'Tarif progresif Pasal 17 UU PPh atas penghasilan neto orang pribadi (pembukuan atau pencatatan norma).',
    requiresEligibilityCheck: false,
  },
  non_taxable_under_500m: {
    type: 'non_taxable_under_500m',
    label: 'Fasilitas Bebas PPh (Omzet Kumulatif <= Rp 500 Juta)',
    ratePercent: 0.0,
    basis: 'gross_revenue',
    legalReference: 'Pasal 60 PP No. 55/2022 / UU HPP',
    description: 'Wajib Pajak Orang Pribadi berhak atas pembebasan PPh Final atas peredaran bruto kumulatif sampai dengan Rp 500 juta dalam satu tahun pajak.',
    requiresEligibilityCheck: true,
  },
  ppn_11_dpp_nilai_lain: {
    type: 'ppn_11_dpp_nilai_lain',
    label: 'PPN 11% Efektif Non-Mewah (12% x 11/12 - PMK 131/2024)',
    ratePercent: 11.0,
    basis: 'dpp_penyerahan',
    legalReference: 'PMK No. 131/2024 jo. PMK No. 11/2025',
    description: 'Pajak Pertambahan Nilai non-mewah dikenakan atas penyerahan JKP/BKP oleh Pengusaha Kena Pajak (PKP) dengan tarif efektif 11% (12% x 11/12 DPP Nilai Lain). Dipisahkan sebagai kewajiban titipan konsumen.',
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
    legalReference: 'Pasal 23 ayat (1) huruf c UU PPh jo. PMK 141/2015',
    description: 'Potongan PPh 23 sebesar 2% atas imbalan jasa penyiaran, pembuatan film pendek, editing, atau manajemen yang dipotong oleh pihak Badan ber-NPWP.',
    requiresEligibilityCheck: false,
  },
  non_pkp_exempt: {
    type: 'non_pkp_exempt',
    label: 'Non-PKP (Bebas PPN)',
    ratePercent: 0.0,
    basis: 'dpp_penyerahan',
    legalReference: 'PMK Batasan Pengusaha Kecil Non-PKP',
    description: 'Kreator non-PKP beromzet di bawah Rp 4,8 Milyar tidak wajib dan dilarang memungut PPN dari penonton/klien.',
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
    | 'tax_pph_studio'
    | 'tax_ppn_collected'
    | 'tax_withholding_credit'
    | 'tax_withholding_obligation'
    | 'tax_estimate';
  label: string;
  amountIdr: number;
  classification: FinancialDataClassification;
  dataSource: string;
  isDeduction: boolean;
  notes?: string;
}

/**
 * Detailed Tax Model Separation (Milestone 2.8.3)
 * Strictly separates studio income tax, VAT liability, and directional withholding taxes.
 */
export interface DetailedTaxBreakdown {
  taxBasisStatus: 'CONFIRMED' | 'UNCONFIRMED_DATA_PENDING';
  
  // 1. PPh Kewajiban Studio (Beban Pajak Penghasilan Usaha)
  pphStudioIdr: number;
  pphStudioRegime: TaxRegimeType;
  pphTaxableBaseIdr: number;
  pphEffectiveRatePercent: number;
  pphLegalBasis: string;
  pphDescription: string;
  isPphEligible: boolean;
  ineligibilityReason?: string;
  
  // 2. PPN Penyerahan BKP/JKP (Kewajiban Pajak Titipan Konsumen)
  isPkp: boolean;
  ppnPricingScheme: 'inclusive' | 'exclusive';
  ppnEffectiveRatePercent: number; // 11% (12% x 11/12 PMK 131/2024 jo. PMK 11/2025)
  ppnDppIdr: number;
  ppnOutputCollectedIdr: number;   // PPN Keluaran
  ppnInputCreditableIdr: number;   // PPN Masukan
  ppnNetPayableIdr: number;        // PPN Keluaran - PPN Masukan (Kewajiban Setor)
  ppnLegalBasis: string;
  ppnDescription: string;
  foreignPlatformTaxStatus: 'EXPORT_ZERO_RATED' | 'TAX_BASIS_UNCONFIRMED' | 'NOT_APPLICABLE';
  
  // 3. Bukti Potong Diterima AMF dari Klien (Aset / Kredit Pajak Dibayar di Muka)
  withholdingTaxCreditsReceivedIdr: number; // Dipotong klien dari pembayaran ke studio
  withholdingCreditType: 'pph_23_jasa' | 'pph_21_freelance' | 'none';
  isWithholdingFinal: boolean;
  withholdingCreditNotes: string;
  
  // 4. Kewajiban Pemotongan Pajak oleh AMF saat Membayar Vendor/Freelancer (Utang Pajak)
  withholdingTaxObligationsPayableIdr: number; // Dipotong AMF dari honor pekerja
  withholdingObligationNotes: string;
  
  // 5. Total Beban Pajak Laba Rugi vs Arus Kas Keluar
  totalIncomeTaxExpenseIdr: number; // pphStudioIdr (mengurangi laba bersih kas operasional)
  totalTaxCashOutflowIdr: number;   // pphStudioIdr + ppnNetPayableIdr (pengeluaran kas)
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

  // Tax Estimation (Refactored for Milestone 2.8.3 Model Separation)
  taxIdr: number; // Legacy alias pointing strictly to pphStudioIdr (Income Tax Expense)
  taxRegime: TaxRegimeConfig;
  taxPayerCategory: TaxPayerCategory;
  taxableBaseIdr: number;
  taxBasisStatus: 'CONFIRMED' | 'UNCONFIRMED_DATA_PENDING';
  taxDisclaimer: string;
  taxBreakdown: DetailedTaxBreakdown;

  // Operating Totals & Net Results
  totalOperatingCashCostsIdr: number; // cashRefunds + platformFees + gatewayFees + aiCostUsed + hostingCdnCost
  totalDeductionsIdr: number;         // totalOperatingCashCostsIdr + taxBreakdown.pphStudioIdr
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

export interface CalculateComprehensiveFinancialReportParams {
  milestones: CreatorMilestone[];
  creditTransactions: CreditTransaction[];
  paymentOrders?: PaymentOrder[];
  providerInvoices?: ProviderBillingEntry[];
  period?: FinancialTimePeriod;
  selectedProjectId?: string;
  
  // Tax Subject Profile (PP 55/2022 jo. PP 20/2026)
  taxPayerCategory?: TaxPayerCategory;
  taxRegime?: TaxRegimeType;
  customTaxRate?: number;
  cumulativeAnnualGrossRevenue?: number; // Total omzet kumulatif tahun berjalan untuk validasi 500M & 4.8M
  isUmkmRevenueOver500M?: boolean; // legacy compatibility flag
  
  // PPN Parameters (PMK 131/2024 & PMK 11/2025)
  isPkp?: boolean;
  ppnPricingScheme?: 'inclusive' | 'exclusive'; // default: 'inclusive'
  ppnInputCreditableIdr?: number; // PPN Masukan yang dapat dikreditkan
  isExportServiceVerified?: boolean; // True jika ada dokumen ekspor jasa (tarif 0%)
  
  // Directional Withholding Taxes
  withholdingTaxCreditsReceivedIdr?: number; // Bukti potong PPh 23 / 21 dari klien (Kredit Pajak AMF)
  withholdingCreditType?: 'pph_23_jasa' | 'pph_21_freelance' | 'none';
  withholdingTaxObligationsPayableIdr?: number; // PPh 21/23 yang dipotong AMF saat bayar vendor/freelancer
  
  // Platform & Deduplication
  isGrossPrePlatformCut?: boolean;
  platformProgram?: string;
}

/**
 * Compute Comprehensive Financial Report with strict deduplication, tax model separation, and partitioned refunds.
 */
export function calculateComprehensiveFinancialReport(
  params: CalculateComprehensiveFinancialReportParams
): ComprehensiveFinancialReport {
  const period = params.period || 'all_time';
  const selectedProjectId = params.selectedProjectId;
  const isGrossPrePlatformCut = Boolean(params.isGrossPrePlatformCut);
  const platformProgram = params.platformProgram || (isGrossPrePlatformCut ? 'pre_split_partner_program' : 'direct_net_payout');

  // Default Taxpayer Profile: If not explicitly supplied, defaults safely to unconfirmed!
  const taxPayerCategory: TaxPayerCategory = params.taxPayerCategory || 'unconfirmed';
  const chosenRegimeKey: TaxRegimeType = params.taxRegime || (taxPayerCategory === 'unconfirmed' ? 'tax_basis_unconfirmed' : 'tax_basis_unconfirmed');
  
  const taxPreset = TAX_REGIME_PRESETS[chosenRegimeKey] || TAX_REGIME_PRESETS.tax_basis_unconfirmed;
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

  // Operating Cash Costs before taxes
  const aiCostDeducted = hasActualProviderInvoices ? actualProviderCostIdr : internalCreditCostEquivalentIdr;
  const totalOperatingCashCostsIdr = cashRefundsIdr + platformFeesIdr + gatewayFeesIdr + aiCostDeducted + hostingCdnCostIdr;

  // ==========================================================================
  // 6. DETAILED TAX MODEL SEPARATION (Milestone 2.8.3)
  // ==========================================================================
  // A. PPh Studio Calculation
  let pphStudioIdr = 0;
  let pphStudioRegime: TaxRegimeType = chosenRegimeKey;
  let pphTaxableBaseIdr = 0;
  let pphEffectiveRatePercent = 0;
  let pphLegalBasis = taxPreset.legalReference;
  let pphDescription = taxPreset.description;
  let isPphEligible = true;
  let ineligibilityReason: string | undefined = undefined;
  let taxBasisStatus: 'CONFIRMED' | 'UNCONFIRMED_DATA_PENDING' = 'CONFIRMED';

  // Determine Cumulative Annual Gross Revenue
  const cumulativeAnnualGrossRevenue = params.cumulativeAnnualGrossRevenue !== undefined
    ? params.cumulativeAnnualGrossRevenue
    : grossRevenueIdr;

  // Validate PP 55/2022 jo. PP 20/2026 Eligibility & Calculation
  if (chosenRegimeKey === 'tax_basis_unconfirmed' || taxPayerCategory === 'unconfirmed') {
    taxBasisStatus = 'UNCONFIRMED_DATA_PENDING';
    pphStudioIdr = 0;
    pphTaxableBaseIdr = 0;
    pphStudioRegime = 'tax_basis_unconfirmed';
    pphLegalBasis = 'Memerlukan Konfirmasi Profil Wajib Pajak';
    pphDescription = 'Profil perpajakan belum lengkap. Sistem tidak mengarang nilai pajak sebelum status terkonfirmasi.';

  } else if (chosenRegimeKey === 'pph_final_umkm') {
    // 1. Check omzet limit (Rp 4.8 Miliar)
    if (cumulativeAnnualGrossRevenue > 4_800_000_000) {
      isPphEligible = false;
      ineligibilityReason = 'Omzet kumulatif melampaui batas Rp 4,8 Miliar. Wajib menyelenggarakan pembukuan tarif umum Pasal 17.';
      pphTaxableBaseIdr = Math.max(0, grossRevenueIdr - totalOperatingCashCostsIdr);
      pphEffectiveRatePercent = 22.0;
      pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.22);
      pphLegalBasis = 'Pasal 17 UU HPP (Pembukuan Badan/OP)';

    } else if (taxPayerCategory === 'cv_firma_pt_baru') {
      // 2. PP 20/2026: CV, Firma, PT baru TIDAK LAGI eligible PPh Final 0.5%
      isPphEligible = false;
      ineligibilityReason = 'Berdasarkan PP 20/2026, CV, Firma, dan PT yang baru terdaftar tidak lagi memenuhi syarat PPh Final 0,5% dan wajib menggunakan tarif umum Pasal 17.';
      pphTaxableBaseIdr = Math.max(0, grossRevenueIdr - totalOperatingCashCostsIdr);
      pphEffectiveRatePercent = 22.0;
      pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.22);
      pphLegalBasis = 'PP No. 20/2026 jo. Pasal 17 UU HPP';

    } else if (taxPayerCategory === 'wp_op_umkm') {
      // 3. WP Orang Pribadi: Fasilitas Rp 500 Juta progresif tahunan (Pasal 60 PP 55/2022)
      // Only the portion above Rp 500M is subject to 0.5%
      if (params.isUmkmRevenueOver500M === false) {
        pphTaxableBaseIdr = 0;
        pphStudioIdr = 0;
        pphStudioRegime = 'non_taxable_under_500m';
        pphLegalBasis = 'Pasal 60 PP No. 55/2022 (Fasilitas Bebas PPh s.d. Rp 500 Juta)';
        pphDescription = 'Peredaran bruto kumulatif di bawah Rp 500 juta dalam 1 tahun pajak bebas PPh Final.';
      } else if (params.cumulativeAnnualGrossRevenue !== undefined) {
        if (params.cumulativeAnnualGrossRevenue <= 500_000_000) {
          pphTaxableBaseIdr = 0;
          pphStudioIdr = 0;
          pphStudioRegime = 'non_taxable_under_500m';
          pphLegalBasis = 'Pasal 60 PP No. 55/2022 (Fasilitas Bebas PPh s.d. Rp 500 Juta)';
          pphDescription = 'Peredaran bruto kumulatif di bawah Rp 500 juta dalam 1 tahun pajak bebas PPh Final.';
        } else {
          // Hanya bagian omzet kumulatif di atas Rp 500 juta
          pphTaxableBaseIdr = Math.min(params.cumulativeAnnualGrossRevenue - 500_000_000, grossRevenueIdr);
          pphEffectiveRatePercent = 0.5;
          pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.005);
          pphLegalBasis = 'PP No. 55/2022 jo. PP No. 20/2026 (0.5% Omzet di atas Rp 500 Juta)';
          pphDescription = `Pajak dihitung progresif 0,5% atas selisih omzet di atas Rp 500 juta (Dasar Pengenaan: Rp ${pphTaxableBaseIdr.toLocaleString('id-ID')}).`;
        }
      } else {
        // Fallback when user asserts omzet > 500M without specifying exact annual cumulative figure
        pphTaxableBaseIdr = grossRevenueIdr;
        pphEffectiveRatePercent = 0.5;
        pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.005);
        pphLegalBasis = 'PP No. 55/2022 jo. PP No. 20/2026 (0.5% Omzet Bruto)';
        pphDescription = 'Tarif 0,5% PPh Final UMKM dikenakan atas omzet bruto setelah melampaui fasilitas Rp 500 juta.';
      }

    } else if (taxPayerCategory === 'pt_perorangan_umkm' || taxPayerCategory === 'koperasi_umkm') {
      // 4. PT Perorangan 1 orang & Koperasi per PP 20/2026 eligible 0.5% (tanpa fasilitas 500M WP OP)
      pphTaxableBaseIdr = grossRevenueIdr;
      pphEffectiveRatePercent = 0.5;
      pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.005);
      pphLegalBasis = 'PP No. 20/2026 (0.5% Omzet Bruto Koperasi & PT Perorangan)';

    } else {
      // Other categories fallback
      pphTaxableBaseIdr = grossRevenueIdr;
      pphEffectiveRatePercent = 0.5;
      pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.005);
    }

  } else if (chosenRegimeKey === 'pph_badan_pasal_17') {
    pphTaxableBaseIdr = Math.max(0, grossRevenueIdr - totalOperatingCashCostsIdr);
    pphEffectiveRatePercent = 22.0;
    pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.22);

  } else if (chosenRegimeKey === 'pph_op_pasal_17') {
    pphTaxableBaseIdr = Math.max(0, grossRevenueIdr - totalOperatingCashCostsIdr);
    pphEffectiveRatePercent = 15.0;
    pphStudioIdr = Math.round(pphTaxableBaseIdr * 0.15);

  } else if (chosenRegimeKey === 'non_taxable_under_500m') {
    pphTaxableBaseIdr = 0;
    pphStudioIdr = 0;

  } else if (chosenRegimeKey === 'ppn_11_dpp_nilai_lain') {
    // If caller explicitly asked for PPN preset as regime, studio income tax remains unconfirmed or separate
    pphTaxableBaseIdr = 0;
    pphStudioIdr = 0;

  } else if (chosenRegimeKey === 'pph_21_freelance' || chosenRegimeKey === 'pph_23_jasa') {
    // If caller explicitly asked for withholding preset, studio income tax remains unconfirmed
    pphTaxableBaseIdr = 0;
    pphStudioIdr = 0;

  } else if (chosenRegimeKey === 'non_pkp_exempt') {
    pphTaxableBaseIdr = grossRevenueIdr;
    pphStudioIdr = 0;

  } else {
    // Custom
    pphTaxableBaseIdr = Math.max(grossRevenueIdr - totalOperatingCashCostsIdr, 0);
    pphEffectiveRatePercent = taxRegime.ratePercent;
    pphStudioIdr = Math.round(pphTaxableBaseIdr * (taxRegime.ratePercent / 100));
  }

  // Record Studio Income Tax Line Item
  if (pphStudioIdr > 0) {
    lineItems.push({
      id: 'cost_tax_pph_studio',
      category: 'tax_pph_studio',
      label: `Beban PPh Studio (${pphStudioRegime}): Rp ${pphStudioIdr.toLocaleString('id-ID')}`,
      amountIdr: pphStudioIdr,
      classification: taxBasisStatus === 'CONFIRMED' ? 'ESTIMATED_PROJECTION' : 'DATA_PENDING',
      dataSource: pphLegalBasis,
      isDeduction: true,
      notes: pphDescription,
    });
  }

  // ==========================================================================
  // B. PPN Penyerahan BKP/JKP (PMK 131/2024 & PMK 11/2025)
  // ==========================================================================
  const isPkp = params.isPkp === true || taxPayerCategory === 'pkp_badan';
  const ppnPricingScheme = params.ppnPricingScheme || 'inclusive';
  const ppnEffectiveRatePercent = 11.0; // 12% x 11/12 non-mewah
  let ppnDppIdr = 0;
  let ppnOutputCollectedIdr = 0;
  const ppnInputCreditableIdr = params.ppnInputCreditableIdr || 0;
  let foreignPlatformTaxStatus: 'EXPORT_ZERO_RATED' | 'TAX_BASIS_UNCONFIRMED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';

  if (!isPkp) {
    // Non-PKP: Dilarang memungut PPN
    ppnDppIdr = 0;
    ppnOutputCollectedIdr = 0;

  } else {
    // PKP: Penyerahan tiket lokal dalam negeri (onPlatformOrdersGrossIdr)
    if (onPlatformOrdersGrossIdr > 0) {
      if (ppnPricingScheme === 'inclusive') {
        // Harga tiket sudah termasuk PPN efektif 11%: DPP = Harga / 1.11
        ppnDppIdr = Math.round(onPlatformOrdersGrossIdr / 1.11);
        ppnOutputCollectedIdr = onPlatformOrdersGrossIdr - ppnDppIdr;
      } else {
        // Harga tiket eksklusif PPN: DPP = Harga, PPN = 11% x DPP
        ppnDppIdr = onPlatformOrdersGrossIdr;
        ppnOutputCollectedIdr = Math.round(ppnDppIdr * 0.11);
      }
    }

    // Pendapatan kanal eksternal/global (AdSense Google Asia Pacific, TikTok Rewards)
    if (externalMilestonesGrossIdr > 0) {
      if (params.isExportServiceVerified) {
        foreignPlatformTaxStatus = 'EXPORT_ZERO_RATED'; // Ekspor Jasa Kena Pajak 0% PMK 32/2019
      } else {
        foreignPlatformTaxStatus = 'TAX_BASIS_UNCONFIRMED'; // Pending verifikasi perjanjian ekspor
      }
    }
  }

  // Net PPN Payable (PPN Keluaran - PPN Masukan)
  const ppnNetPayableIdr = Math.max(0, ppnOutputCollectedIdr - ppnInputCreditableIdr);

  // Line item for PPN Keluaran (Titipan Konsumen - TIDAK memotong laba kas operasional)
  if (ppnOutputCollectedIdr > 0) {
    lineItems.push({
      id: 'tax_ppn_collected_line',
      category: 'tax_ppn_collected',
      label: `PPN Keluaran 11% Efektif Dipungut (${ppnPricingScheme}): Rp ${ppnOutputCollectedIdr.toLocaleString('id-ID')}`,
      amountIdr: ppnOutputCollectedIdr,
      classification: 'ESTIMATED_PROJECTION',
      dataSource: 'PMK No. 131/2024 jo. PMK No. 11/2025 (DPP Nilai Lain 11/12)',
      isDeduction: false, // TIDAK memotong laba operasional studio
      notes: `Kewajiban titipan konsumen atas penjualan tiket domestik. Masukan: Rp ${ppnInputCreditableIdr.toLocaleString('id-ID')}, Net Setor: Rp ${ppnNetPayableIdr.toLocaleString('id-ID')}.`,
    });
  }

  // ==========================================================================
  // C. Directional Withholding Taxes (PPh 21 & PPh 23)
  // ==========================================================================
  // 1. Bukti Potong Diterima AMF dari Klien (Aset / Kredit Pajak Dibayar di Muka)
  let withholdingTaxCreditsReceivedIdr = params.withholdingTaxCreditsReceivedIdr || 0;
  let withholdingCreditType = params.withholdingCreditType || 'none';
  let isWithholdingFinal = false;

  // If caller specified pph_23_jasa or pph_21_freelance in taxRegime, calculate withholding credit on gross
  if (chosenRegimeKey === 'pph_23_jasa') {
    withholdingCreditType = 'pph_23_jasa';
    withholdingTaxCreditsReceivedIdr = Math.round(grossRevenueIdr * 0.02);
  } else if (chosenRegimeKey === 'pph_21_freelance') {
    withholdingCreditType = 'pph_21_freelance';
    withholdingTaxCreditsReceivedIdr = Math.round(grossRevenueIdr * 0.025);
  }

  if (withholdingTaxCreditsReceivedIdr > 0) {
    lineItems.push({
      id: 'tax_withholding_credit_line',
      category: 'tax_withholding_credit',
      label: `Kredit Pajak / Bukti Potong Klien (${withholdingCreditType.toUpperCase()}): Rp ${withholdingTaxCreditsReceivedIdr.toLocaleString('id-ID')}`,
      amountIdr: withholdingTaxCreditsReceivedIdr,
      classification: 'VERIFIED_ACTUAL',
      dataSource: 'Bukti Potong PPh Pasal 23/21 dari Klien (Kredit Pajak Ps 28A UU PPh)',
      isDeduction: false, // BUKAN beban pengurang laba operasional!
      notes: 'Uang muka pajak yang dapat dikreditkan pada SPT Tahunan. Bukan beban operasional yang hangus.',
    });
  }

  // 2. Kewajiban Pemotongan Pajak oleh AMF saat Membayar Vendor/Freelancer (Utang Pajak)
  const withholdingTaxObligationsPayableIdr = params.withholdingTaxObligationsPayableIdr || 0;
  if (withholdingTaxObligationsPayableIdr > 0) {
    lineItems.push({
      id: 'tax_withholding_obligation_line',
      category: 'tax_withholding_obligation',
      label: `Kewajiban Setor Potput Vendor/Freelancer: Rp ${withholdingTaxObligationsPayableIdr.toLocaleString('id-ID')}`,
      amountIdr: withholdingTaxObligationsPayableIdr,
      classification: 'ESTIMATED_BENCHMARK',
      dataSource: 'Kewajiban Pemotongan PPh 21/23 atas Pembayaran Jasa Pihak Ketiga',
      isDeduction: false, // Dipotong dari honor pekerja, disetor ke kas negara
      notes: 'Pajak dipotong dari honor pihak ketiga dan wajib disetorkan AMF ke kas negara atas nama vendor.',
    });
  }

  // ==========================================================================
  // D. Tax Breakdown Assembly
  // ==========================================================================
  const taxBreakdown: DetailedTaxBreakdown = {
    taxBasisStatus,
    pphStudioIdr,
    pphStudioRegime,
    pphTaxableBaseIdr,
    pphEffectiveRatePercent,
    pphLegalBasis,
    pphDescription,
    isPphEligible,
    ineligibilityReason,
    isPkp,
    ppnPricingScheme,
    ppnEffectiveRatePercent,
    ppnDppIdr,
    ppnOutputCollectedIdr,
    ppnInputCreditableIdr,
    ppnNetPayableIdr,
    ppnLegalBasis: 'PMK No. 131/2024 jo. PMK No. 11/2025',
    ppnDescription: isPkp 
      ? `PPN Non-Mewah 11% Efektif (${ppnPricingScheme}). PPN Keluaran: Rp ${ppnOutputCollectedIdr.toLocaleString('id-ID')}, Net Setor: Rp ${ppnNetPayableIdr.toLocaleString('id-ID')}`
      : 'Non-PKP: Bebas PPN (Dilarang memungut PPN dari pembeli)',
    foreignPlatformTaxStatus,
    withholdingTaxCreditsReceivedIdr,
    withholdingCreditType,
    isWithholdingFinal,
    withholdingCreditNotes: withholdingTaxCreditsReceivedIdr > 0
      ? 'Kredit Pajak Dibayar di Muka (dapat dikreditkan di SPT Tahunan)'
      : 'Tidak ada kredit potput',
    withholdingTaxObligationsPayableIdr,
    withholdingObligationNotes: withholdingTaxObligationsPayableIdr > 0
      ? 'Kewajiban penyetoran atas pemotongan honor pihak ketiga'
      : 'Tidak ada kewajiban pemotongan',
    totalIncomeTaxExpenseIdr: pphStudioIdr,
    totalTaxCashOutflowIdr: pphStudioIdr + ppnNetPayableIdr,
  };

  // ==========================================================================
  // 7. TOTALS, NET PROFIT & MARGIN CALCULATIONS
  // ==========================================================================
  // Net Operating Cash Profit strictly deducts studio PPh expense, NOT VAT liability or tax credit!
  const totalDeductionsIdr = totalOperatingCashCostsIdr + pphStudioIdr;
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
    taxIdr: pphStudioIdr, // Strictly points to Studio Income Tax Expense!
    taxRegime,
    taxPayerCategory,
    taxableBaseIdr: pphTaxableBaseIdr,
    taxBasisStatus,
    taxDisclaimer: LEGAL_TAX_DISCLAIMER,
    taxBreakdown,
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

  // Directive 3: DJP Legal Tax Advice (Refactored for Model Separation)
  const tb = report.taxBreakdown;
  directives.push({
    id: 'adv_tax_regime',
    title: tb.taxBasisStatus === 'CONFIRMED'
      ? `Model Perpajakan Terkonfirmasi (${tb.pphStudioRegime})`
      : 'Profil Perpajakan Belum Dikonfirmasi (Pending)',
    category: 'tax_optimization',
    badge: tb.taxBasisStatus === 'CONFIRMED' ? 'OPTIMAL' : 'WARNING',
    ruleBasedConfidenceScore: 90,
    confidenceDescription: 'Rule-based compliance score berdasarkan pemisahan PPh studio, PPN penyerahan, dan kredit potput.',
    evidenceDataSource: tb.taxBasisStatus === 'CONFIRMED'
      ? `PPh Studio: Rp ${tb.pphStudioIdr.toLocaleString('id-ID')} (${tb.pphLegalBasis}). PPN Dipungut: Rp ${tb.ppnOutputCollectedIdr.toLocaleString('id-ID')}. Kredit Potput: Rp ${tb.withholdingTaxCreditsReceivedIdr.toLocaleString('id-ID')}.`
      : 'Status basis pajak belum dikonfirmasi oleh pengguna (Pajak Rp 0 untuk menghindari kepastian sepihak).',
    marketAssumptions: 'Ketentuan perpajakan memerlukan pelaporan SPT tahunan dan kepatuhan administrasi resmi.',
    riskBoundary: 'Kesalahan pemilihan rezim pajak dapat menyebabkan kurang bayar atau sanksi administrasi perpajakan.',
    strategicAction: 'Gunakan angka ini sebagai referensi perencanaan kas dan konsultasikan dengan konsultan pajak terdaftar.',
  });

  return directives;
}
