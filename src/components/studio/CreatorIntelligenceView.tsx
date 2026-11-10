import React, { useState, useEffect, useMemo } from 'react';
import { Project, CreatorMilestone, PublishingPlatformKey, CreatorMediaKitSettings, CreditTransaction, PaymentOrder } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import {
  fetchCreatorMilestones,
  createCreatorMilestone,
  deleteCreatorMilestone,
  fetchCreatorMediaKitSettings,
  saveCreatorMediaKitSettings,
  fetchCreditTransactions,
  fetchPaymentOrders,
  supabase,
} from '../../lib/supabase';
import {
  calculateComprehensiveFinancialReport,
  generateAIBusinessAdvisorDirectives,
  TAX_REGIME_PRESETS,
  TaxRegimeType,
  TaxPayerCategory,
  VatTransactionCategory,
  ExportServiceVerificationStatus,
  FinancialTimePeriod,
  ComprehensiveFinancialReport,
  AIBusinessAdvisorDirective,
  INTERNAL_CREDIT_RATE_IDR,
  LEGAL_TAX_DISCLAIMER,
} from '../../lib/creatorBusinessEngine';
import { AnalyticsClientService, LiveAnalyticsSnapshot } from '../../lib/distribution/analyticsClientService';
import { fetchUserPublishingJobs } from '../../lib/distribution/publishingRepository';
import { PublishingJob } from '../../lib/distribution/types';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Flame,
  Target,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Share2,
  Calendar,
  ThumbsUp,
  MessageSquare,
  Eye,
  Film,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Video,
  Award,
  Printer,
  Download,
  Mail,
  Copy,
  Check,
  Briefcase,
  Building,
  Phone,
  FileText,
  Star,
  Sliders,
  Smartphone,
  Globe,
  Users,
  Lock,
  Unlock,
  EyeOff,
  PieChart,
  Receipt,
  Scale,
  FileSpreadsheet,
  Layers,
  Info,
  Coins,
  Percent,
} from 'lucide-react';

interface CreatorIntelligenceViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigateToEditing?: (projectId: string) => void;
}

const PLATFORM_CONFIG: Record<
  PublishingPlatformKey,
  { label: string; color: string; bg: string; border: string; defaultRpm: number }
> = {
  youtube: {
    label: 'YouTube (16:9 / 4K)',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    defaultRpm: 18000,
  },
  tiktok: {
    label: 'TikTok (9:16 Vertikal)',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    defaultRpm: 9000,
  },
  reels: {
    label: 'Instagram Reels',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    defaultRpm: 11000,
  },
  x_twitter: {
    label: 'X / Twitter Video',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    defaultRpm: 12000,
  },
  web_drama: {
    label: 'Web Drama / OTT Series',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    defaultRpm: 25000,
  },
};

export const CreatorIntelligenceView: React.FC<CreatorIntelligenceViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onShowToast,
  onNavigateToEditing,
}) => {
  const { user, profile, language } = useAuth();
  const isId = language === 'id';
  const userId = user?.id || profile.id;

  // Active Project Selection
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'milestones' | 'profitability' | 'growth_advisor' | 'media_kit' | 'live_analytics'>('milestones');

  // Live Analytics State (T9.5)
  const [publishedJobs, setPublishedJobs] = useState<PublishingJob[]>([]);
  const [liveSnapshots, setLiveSnapshots] = useState<Record<string, LiveAnalyticsSnapshot>>({});
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingJobId, setSyncingJobId] = useState<string | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Media Kit State (Sprint 3: P2)
  const [isMediaKitModalOpen, setIsMediaKitModalOpen] = useState(false);
  const [isEditingMediaKit, setIsEditingMediaKit] = useState(false);
  const [isSavingMediaKit, setIsSavingMediaKit] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [mediaKitSettings, setMediaKitSettings] = useState<CreatorMediaKitSettings>({
    user_id: userId,
    studio_name: profile.display_name ? `${profile.display_name} Studios` : 'AMF Film Studio',
    bio: 'Kreator film independen bertenaga AI generasi baru, memproduksi konten naratif sinematik 4K berkualitas layar lebar.',
    contact_email: profile.email || user?.email || 'business@aimoviefactory.com',
    contact_phone: '+62 812-3456-7890',
    primary_niche: 'Sci-Fi Cyberpunk & Misteri Folklor',
    location: 'Indonesia (Global Remote Production)',
    rate_card_tier1: 2500000,
    rate_card_tier2: 5000000,
    rate_card_tier3: 12500000,
    custom_pitch_hook: 'Menghadirkan penempatan merek yang memikat secara alami ke dalam alur cerita film sinematik AI beresolusi 4K.',
    is_public: false,
    share_phone: false,
    share_email: true,
  });

  // Milestones State
  const [milestones, setMilestones] = useState<CreatorMilestone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State for Adding New Milestone
  const [formProjectId, setFormProjectId] = useState<string>(activeProject?.id || '');
  const [formProjectName, setFormProjectName] = useState<string>(activeProject?.name || '');
  const [formPlatform, setFormPlatform] = useState<PublishingPlatformKey>('youtube');
  const [formVideoUrl, setFormVideoUrl] = useState<string>('');
  const [formViews, setFormViews] = useState<number>(25000);
  const [formLikes, setFormLikes] = useState<number>(1850);
  const [formComments, setFormComments] = useState<number>(140);
  const [formRevenue, setFormRevenue] = useState<number>(375000);
  const [formNotes, setFormNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profitability Simulator Interactive State
  const [simViews, setSimViews] = useState<number>(100000);
  const [simGenreRpm, setSimGenreRpm] = useState<number>(18000);
  const [simAiCreditsCost, setSimAiCreditsCost] = useState<number>(250000); // Rp 250k kredit AI
  const [simPayPerViewPrice, setSimPayPerViewPrice] = useState<number>(5000); // Rp 5.000 per episode

  // Financial Ledger & Comprehensive Report State (TC-WF-16 & Fase 5)
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState<boolean>(false);
  const [profitabilitySubTab, setProfitabilitySubTab] = useState<'actual_financial' | 'simulation_projection'>('actual_financial');
  const [financialPeriod, setFinancialPeriod] = useState<FinancialTimePeriod>('all_time');
  const [taxRegime, setTaxRegime] = useState<TaxRegimeType>('tax_basis_unconfirmed');
  const [taxPayerCategory, setTaxPayerCategory] = useState<TaxPayerCategory>('unconfirmed');
  const [isUmkmOver500M, setIsUmkmOver500M] = useState<boolean>(false);
  const [customTaxRate, setCustomTaxRate] = useState<number>(5);
  const [isPkp, setIsPkp] = useState<boolean>(false);
  const [ppnPricingScheme, setPpnPricingScheme] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [ppnInputCreditable, setPpnInputCreditable] = useState<number>(0);
  const [withholdingCreditsReceived, setWithholdingCreditsReceived] = useState<number>(0);
  const [withholdingObligationsPayable, setWithholdingObligationsPayable] = useState<number>(0);
  const [vatTransactionCategory, setVatTransactionCategory] = useState<VatTransactionCategory>('domestic_tickets_ppv');
  const [exportVerificationStatus, setExportVerificationStatus] = useState<ExportServiceVerificationStatus>('PENDING_DOCUMENTATION');
  const [hasTransitionRights, setHasTransitionRights] = useState<boolean>(false);
  const [yearsOfFacilityUsed, setYearsOfFacilityUsed] = useState<number>(0);
  const [isGrossPrePlatformCut, setIsGrossPrePlatformCut] = useState<boolean>(false);

  // Load Milestones
  const loadMilestones = async () => {
    setIsLoading(true);
    try {
      const res = await fetchCreatorMilestones(userId);
      if (res.data && res.data.length > 0) {
        setMilestones(res.data);
      } else {
        setMilestones([]);
      }
    } catch (err: any) {
      console.warn('Failed to load milestones:', err);
      setMilestones([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Financial Ledger (Credit Transactions & Payment Orders)
  const loadFinancialLedger = async () => {
    if (!userId) return;
    setIsLoadingFinancials(true);
    try {
      const [txRes, ordRes] = await Promise.all([
        fetchCreditTransactions(userId),
        fetchPaymentOrders(userId),
      ]);
      if (txRes.data) setCreditTransactions(txRes.data);
      if (ordRes.data) setPaymentOrders(ordRes.data);
    } catch (err: any) {
      console.warn('Failed to load financial transactions:', err);
    } finally {
      setIsLoadingFinancials(false);
    }
  };

  // Load Live Analytics Data (T9.5)
  const loadLiveAnalyticsData = async () => {
    if (!userId) return;
    setIsLoadingAnalytics(true);
    try {
      // 1. Fetch published publishing jobs
      const jobsRes = await fetchUserPublishingJobs(userId);
      const pubs = (jobsRes.data || []).filter((j) => j.status === 'published');
      setPublishedJobs(pubs);

      // 2. Fetch latest snapshot history
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (token) {
        const snapshots = await AnalyticsClientService.fetchHistory(token);
        const map: Record<string, LiveAnalyticsSnapshot> = {};
        for (const s of snapshots) {
          // store most recent snapshot per publishing_job_id
          if (!map[s.publishing_job_id] || new Date(s.synced_at) > new Date(map[s.publishing_job_id].synced_at)) {
            map[s.publishing_job_id] = s;
          }
        }
        setLiveSnapshots(map);
        if (snapshots.length > 0) {
          setLastSyncTime(new Date(snapshots[0].synced_at).toLocaleTimeString('id-ID'));
        }
      }
    } catch (err: any) {
      console.warn('Failed to load live analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    loadMilestones();
    loadLiveAnalyticsData();
    loadFinancialLedger();
  }, [userId]);

  // Sync single job live metrics (T9.5)
  const handleSyncSingleJob = async (jobId: string) => {
    setSyncingJobId(jobId);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) {
        onShowToast('Harap login untuk menyinkronkan metrik', 'error');
        return;
      }
      const snapshot = await AnalyticsClientService.syncJob(jobId, token);
      setLiveSnapshots((prev) => ({ ...prev, [jobId]: snapshot }));
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      onShowToast('Metrik live berhasil diperbarui langsung dari platform!', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Gagal menyinkronkan metrik', 'error');
    } finally {
      setSyncingJobId(null);
    }
  };

  // Sync all published jobs live metrics (T9.5)
  const handleSyncAllJobs = async () => {
    if (publishedJobs.length === 0) {
      onShowToast('Tidak ada video yang berstatus published untuk disinkronkan.', 'info');
      return;
    }
    setIsSyncingAll(true);
    let successCount = 0;
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) {
        onShowToast('Harap login untuk menyinkronkan metrik', 'error');
        return;
      }
      for (const job of publishedJobs) {
        try {
          const snap = await AnalyticsClientService.syncJob(job.id, token);
          setLiveSnapshots((prev) => ({ ...prev, [job.id]: snap }));
          successCount++;
        } catch (e: any) {
          console.warn('Sync failed for job', job.id, e);
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      onShowToast(`Berhasil menyinkronkan ${successCount} dari ${publishedJobs.length} video live!`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Gagal sinkronisasi live', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Promote Live Snapshot to Milestone (T9.5 -> Milestone)
  const handlePromoteToMilestone = (job: PublishingJob, snap?: LiveAnalyticsSnapshot) => {
    setFormProjectId(job.project_id || '');
    setFormProjectName(job.title || 'Film Rilis');
    const platformKey: PublishingPlatformKey = 
      job.platform === 'tiktok' ? 'tiktok' :
      job.platform === 'instagram' ? 'reels' :
      job.platform === 'x_twitter' ? 'x_twitter' : 'youtube';
    setFormPlatform(platformKey);
    setFormVideoUrl(job.published_video_url || '');
    setFormViews(snap ? snap.views : 0);
    setFormLikes(snap ? snap.likes : 0);
    setFormComments(snap ? snap.comments : 0);
    // Estimated ad revenue based on default RPM
    const rpm = PLATFORM_CONFIG[platformKey]?.defaultRpm || 18000;
    const estimatedRev = Math.round(((snap?.views || 0) / 1000) * rpm);
    setFormRevenue(estimatedRev);
    setFormNotes(`Disinkronkan otomatis dari metrik live ${job.platform} (ID: ${snap?.external_post_id || job.external_publish_id || '-'})`);
    setIsAddModalOpen(true);
    onShowToast('Data analitik live dimuat ke form Milestone!', 'info');
  };

  // Live Totals Aggregate
  const liveTotals = useMemo(() => {
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalDuration = 0;
    let countWithDuration = 0;

    Object.values(liveSnapshots).forEach((s) => {
      totalViews += Number(s.views) || 0;
      totalLikes += Number(s.likes) || 0;
      totalComments += Number(s.comments) || 0;
      totalShares += Number(s.shares) || 0;
      if (s.avg_view_duration_seconds != null && s.avg_view_duration_seconds > 0) {
        totalDuration += s.avg_view_duration_seconds;
        countWithDuration++;
      }
    });

    const avgDuration = countWithDuration > 0 ? Math.round(totalDuration / countWithDuration) : 0;
    const totalInteractions = totalLikes + totalComments + totalShares;

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalInteractions,
      avgDuration,
      syncedVideosCount: Object.keys(liveSnapshots).length,
    };
  }, [liveSnapshots]);

  // Comprehensive Financial Report Calculation (SSOT Wave II Section III.3 & TC-WF-16)
  const comprehensiveReport = useMemo(() => {
    return calculateComprehensiveFinancialReport({
      milestones,
      creditTransactions,
      paymentOrders,
      period: financialPeriod,
      selectedProjectId: financialPeriod === 'by_project' ? selectedProjectId : undefined,
      taxRegime,
      taxPayerCategory,
      customTaxRate,
      isGrossPrePlatformCut,
      isUmkmRevenueOver500M: isUmkmOver500M,
      isPkp,
      ppnPricingScheme,
      ppnInputCreditableIdr: ppnInputCreditable,
      withholdingTaxCreditsReceivedIdr: withholdingCreditsReceived,
      withholdingTaxObligationsPayableIdr: withholdingObligationsPayable,
      vatTransactionCategory,
      exportVerificationStatus,
      hasTransitionRights,
      yearsOfFacilityUsed,
    });
  }, [
    milestones,
    creditTransactions,
    paymentOrders,
    financialPeriod,
    selectedProjectId,
    taxRegime,
    taxPayerCategory,
    customTaxRate,
    isGrossPrePlatformCut,
    isUmkmOver500M,
    isPkp,
    ppnPricingScheme,
    ppnInputCreditable,
    withholdingCreditsReceived,
    withholdingObligationsPayable,
    vatTransactionCategory,
    exportVerificationStatus,
    hasTransitionRights,
    yearsOfFacilityUsed,
  ]);

  // Dynamic AI Business Advisor Directives (Evidence-based from actual AMF metrics)
  const dynamicAdvisorDirectives = useMemo(() => {
    return generateAIBusinessAdvisorDirectives(comprehensiveReport);
  }, [comprehensiveReport]);

  // Aggregate Metrics
  const aggregateMetrics = useMemo(() => {
    const totalViews = milestones.reduce((acc, m) => acc + (Number(m.views_count) || 0), 0);
    const totalLikes = milestones.reduce((acc, m) => acc + (Number(m.likes_count) || 0), 0);
    const totalComments = milestones.reduce((acc, m) => acc + (Number(m.comments_count) || 0), 0);
    const totalRevenue = comprehensiveReport.grossRevenueIdr;

    const engagementRate = totalViews > 0 ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(1) : '0.0';
    const netProfit = comprehensiveReport.netProfitIdr;
    const roiMultiple = comprehensiveReport.roiPercent > 0 ? (comprehensiveReport.roiPercent / 100).toFixed(1) : '0.0';

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalRevenue,
      engagementRate,
      netProfit,
      roiMultiple,
      filmCount: milestones.length,
      comprehensiveReport,
    };
  }, [milestones, comprehensiveReport]);

  // Profitability Simulator Calculations (SSOT Section III.3 Comprehensive Breakdown)
  const simCalculation = useMemo(() => {
    const ytAdsense = Math.round((simViews / 1000) * simGenreRpm);
    const tiktokRewards = Math.round((simViews / 1000) * 8500);
    const sponsorship =
      simViews >= 1000000
        ? 15000000
        : simViews >= 500000
        ? 6500000
        : simViews >= 100000
        ? 2500000
        : 800000;

    // Web Drama Pay-per-view assumption: 1.5% conversion of views purchase episode
    const buyers = Math.round(simViews * 0.015);
    const webDramaPayPerView = buyers * simPayPerViewPrice;

    const totalGrossRevenue = ytAdsense + tiktokRewards + sponsorship;
    const totalWithPayPerView = totalGrossRevenue + webDramaPayPerView;

    // Comprehensive SSOT Section III.3 Net Profit Breakdown Formula:
    // Net Profit = Gross Revenue - (Refunds + Platform Fees + Payment Gateway Fees + AI Production Cost + Hosting & CDN Cost + Tax)
    const refunds = Math.round(webDramaPayPerView * 0.01); // 1% refund tolerance
    const platformFees = Math.round((ytAdsense + tiktokRewards) * 0.10); // 10% platform service fee
    const paymentGatewayFees = Math.round(webDramaPayPerView * 0.029 + (buyers > 0 ? buyers * 2000 : 0)); // 2.9% + Rp 2.000 gateway
    const aiProductionCost = simAiCreditsCost;
    const hostingCdnCost = Math.round((simViews / 10000) * 25000); // CDN bandwidth streaming
    const subtotalOperatingCosts = refunds + platformFees + paymentGatewayFees + aiProductionCost + hostingCdnCost;
    // Estimasi PPh Final UMKM 0,5% dari omzet bruto PP 55/2022 jo. PP 20/2026 (bukan PPN atas laba operasional!)
    const estimatedTax = Math.round(totalGrossRevenue * 0.005);

    const totalDeductionsStandard = refunds + platformFees + aiProductionCost + hostingCdnCost + estimatedTax;
    const totalDeductionsWithPPV = totalDeductionsStandard + paymentGatewayFees;

    const netProfitStandard = Math.max(totalGrossRevenue - totalDeductionsStandard, 0);
    const netProfitWithPayPerView = Math.max(totalWithPayPerView - totalDeductionsWithPPV, 0);

    const marginStandard = totalGrossRevenue > 0 ? Math.round((netProfitStandard / totalGrossRevenue) * 100) : 0;
    const marginWithPayPerView = totalWithPayPerView > 0 ? Math.round((netProfitWithPayPerView / totalWithPayPerView) * 100) : 0;

    return {
      ytAdsense,
      tiktokRewards,
      sponsorship,
      buyers,
      webDramaPayPerView,
      totalGrossRevenue,
      totalWithPayPerView,
      refunds,
      platformFees,
      paymentGatewayFees,
      aiProductionCost,
      hostingCdnCost,
      estimatedTax,
      totalDeductionsStandard,
      totalDeductionsWithPPV,
      netProfitStandard,
      netProfitWithPayPerView,
      marginStandard,
      marginWithPayPerView,
    };
  }, [simViews, simGenreRpm, simAiCreditsCost, simPayPerViewPrice]);

  // Handle Create Milestone
  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectName.trim()) {
      onShowToast('Harap masukkan nama film yang dirilis', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCreatorMilestone({
        user_id: userId,
        project_id: formProjectId || undefined,
        project_name: formProjectName.trim(),
        platform: formPlatform,
        video_url: formVideoUrl.trim() || undefined,
        views_count: Number(formViews) || 0,
        likes_count: Number(formLikes) || 0,
        comments_count: Number(formComments) || 0,
        revenue_earned: Number(formRevenue) || 0,
        currency: 'IDR',
        release_date: new Date().toISOString(),
        notes: formNotes.trim() || undefined,
      });

      if (res.error) {
        onShowToast(`Gagal mencatat rilis film: ${res.error}`, 'error');
        return;
      }

      if (res.data) {
        setMilestones((prev) => [res.data!, ...prev]);
        setIsAddModalOpen(false);
        onShowToast(`Rilis film "${formProjectName}" berhasil dicatat ke basis data!`, 'success');
        // Reset form
        setFormVideoUrl('');
        setFormNotes('');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Gagal menyimpan catatan rilis', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Milestone
  const handleDeleteMilestone = async (id: string, name: string) => {
    if (!window.confirm(`Hapus catatan rilis untuk film "${name}"?`)) return;
    try {
      await deleteCreatorMilestone(id);
      setMilestones((prev) => prev.filter((m) => m.id !== id));
      onShowToast('Catatan rilis berhasil dihapus', 'info');
    } catch (err: any) {
      onShowToast('Gagal menghapus catatan', 'error');
    }
  };

  // Load Media Kit Settings on Mount
  useEffect(() => {
    async function initMediaKit() {
      try {
        const res = await fetchCreatorMediaKitSettings(userId, {
          studio_name: profile.display_name ? `${profile.display_name} Studios` : 'AMF Film Studio',
          contact_email: profile.email || user?.email || 'business@aimoviefactory.com',
          primary_niche: activeProject?.genre ? `${activeProject.genre} Sinematik AI` : 'Sci-Fi Cyberpunk & Misteri Folklor',
        });
        if (res.data) {
          setMediaKitSettings(res.data);
        }
      } catch (err) {
        console.warn('Failed to init media kit settings:', err);
      }
    }
    initMediaKit();
  }, [userId, profile, activeProject]);

  // Save Media Kit Settings
  const handleSaveMediaKitSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMediaKit(true);
    try {
      const res = await saveCreatorMediaKitSettings(mediaKitSettings);
      if (res.error) {
        onShowToast(`Gagal menyimpan ke basis data: ${res.error}`, 'error');
        return;
      }
      if (res.data) {
        setMediaKitSettings(res.data);
        setIsEditingMediaKit(false);
        onShowToast('Pengaturan Media Kit & Rate Card berhasil disimpan ke Supabase Cloud!', 'success');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Gagal menyimpan pengaturan media kit', 'error');
    } finally {
      setIsSavingMediaKit(false);
    }
  };

  // Generate HTML for A4 Print & Standalone Document
  const generateMediaKitHtml = () => {
    const s = mediaKitSettings;
    const nowStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const tier1Str = Number(s.rate_card_tier1).toLocaleString('id-ID');
    const tier2Str = Number(s.rate_card_tier2).toLocaleString('id-ID');
    const tier3Str = Number(s.rate_card_tier3).toLocaleString('id-ID');
    const totalViewsStr = aggregateMetrics.totalViews.toLocaleString('id-ID');
    const engRateStr = aggregateMetrics.engagementRate;

    const filmsHtml = milestones.length > 0 
      ? milestones.slice(0, 6).map((m) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; font-weight: bold; color: #f8fafc;">${m.project_name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #38bdf8; text-transform: uppercase; font-size: 11px;">${m.platform}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-family: monospace; text-align: right;">${Number(m.views_count).toLocaleString('id-ID')}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #4ade80; font-family: monospace; text-align: right;">${(((Number(m.likes_count) + Number(m.comments_count)) / Math.max(Number(m.views_count), 1)) * 100).toFixed(1)}%</td>
      </tr>
    `).join('')
      : `<tr><td colspan="4" style="text-align: center; padding: 18px; color: #64748b; font-style: italic;">Belum ada rilisan film yang dicatat. Daftar karya terverifikasi akan otomatis tercatat setelah Anda menambahkan milestone rilis film.</td></tr>`;

    const contactEmailHtml = s.share_email !== false 
      ? `Email: <span style="color: #38bdf8; font-weight: bold;">${s.contact_email}</span>` 
      : `<span style="color: #64748b; font-style: italic;">Kontak melalui dashboard resmi</span>`;
    const contactPhoneHtml = (s.share_phone && s.contact_phone)
      ? `&nbsp;•&nbsp; WhatsApp: <span style="color: #4ade80; font-weight: bold;">${s.contact_phone}</span>`
      : '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Creator Media Kit & Commercial Rate Card - ${s.studio_name}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f17;
      color: #cbd5e1;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
      font-size: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .container { max-width: 820px; margin: 0 auto; }
    .header { border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .studio-title { font-size: 26px; font-weight: 800; color: #ffffff; margin: 0 0 4px 0; letter-spacing: -0.5px; }
    .badge { display: inline-block; background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .meta-line { font-size: 11px; color: #94a3b8; margin-top: 6px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi-card { background: #131c2e; border: 1px solid #1e293b; padding: 12px; border-radius: 8px; text-align: center; }
    .kpi-val { font-size: 20px; font-weight: 800; color: #38bdf8; font-family: monospace; margin: 4px 0 0 0; }
    .kpi-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
    .section-title { font-size: 13px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px 0; border-left: 3px solid #fbbf24; padding-left: 8px; }
    .rate-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .rate-card { background: #131c2e; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; position: relative; }
    .rate-card.featured { border-color: rgba(251, 191, 36, 0.6); background: rgba(251, 191, 36, 0.05); }
    .rate-tier { font-size: 11px; font-weight: bold; color: #fbbf24; text-transform: uppercase; }
    .rate-price { font-size: 18px; font-weight: 800; color: #4ade80; font-family: monospace; margin: 6px 0; }
    .rate-desc { font-size: 10px; color: #94a3b8; margin-bottom: 8px; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #1e293b; color: #f8fafc; text-align: left; padding: 10px 12px; font-weight: 700; text-transform: uppercase; font-size: 10px; }
    .contact-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
    @media print {
      body { background: #ffffff !important; color: #0f172a !important; padding: 0 !important; }
      .kpi-card, .rate-card, table, .contact-box { background: #f8fafc !important; border-color: #cbd5e1 !important; }
      .studio-title, th, .section-title, .kpi-val { color: #0f172a !important; }
      .rate-price { color: #059669 !important; }
      .badge { background: #fef3c7 !important; color: #b45309 !important; border-color: #f59e0b !important; }
      .kpi-val { color: #0284c7 !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="badge">Official AMF Verified Creator • 4K AI Cinema</span>
        <h1 class="studio-title">${s.studio_name}</h1>
        <div class="meta-line">
          <strong>Niche:</strong> ${s.primary_niche} &nbsp;•&nbsp; 
          <strong>Lokasi:</strong> ${s.location} &nbsp;•&nbsp; 
          <strong>Diperbarui:</strong> ${nowStr}
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 12px; color: #fbbf24; font-weight: bold;">AI MOVIE FACTORY</span><br/>
        <span style="font-size: 9px; color: #64748b;">Hollywood Production Suite</span>
      </div>
    </div>

    <div style="margin-bottom: 18px; font-size: 11px; color: #94a3b8; background: #131c2e; padding: 12px 16px; border-radius: 8px; border-left: 3px solid #38bdf8;">
      <strong style="color: #f8fafc;">Visi & Pernyataan Kreatif:</strong> ${s.bio}
      <div style="margin-top: 6px; color: #fbbf24; font-style: italic;">"${s.custom_pitch_hook}"</div>
    </div>

    <div class="section-title">Portofolio Statistik & Metrik Performa Nyata</div>
    <div class="grid-4">
      <div class="kpi-card">
        <div class="kpi-label">Total Tayangan</div>
        <div class="kpi-val">${totalViewsStr}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Rata-rata Interaksi</div>
        <div class="kpi-val" style="color: #f43f5e;">${engRateStr}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Retensi 15s Hook</div>
        <div class="kpi-val" style="color: #4ade80;">${milestones.length > 0 ? '94%' : '-'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Karya Rilis</div>
        <div class="kpi-val" style="color: #fbbf24;">${milestones.length} Film</div>
      </div>
    </div>

    <div class="section-title">Katalog Paket Kerja Sama & Rate Card Sponsor Resmi</div>
    <div class="rate-grid">
      <div class="rate-card">
        <div class="rate-tier">Bronze Tier</div>
        <div style="font-weight: bold; color: #ffffff; font-size: 11px; margin-top: 2px;">Product Placement</div>
        <div class="rate-price">Rp ${tier1Str}</div>
        <div class="rate-desc">• Penempatan produk/logo sponsor di 1 adegan utama film AI.<br/>• Ucapan terima kasih di credit title.<br/>• Estimasi jangkauan: 25k - 50k views.</div>
      </div>

      <div class="rate-card featured">
        <div class="rate-tier" style="color: #fbbf24;">Silver Tier (Rekomendasi)</div>
        <div style="font-weight: bold; color: #ffffff; font-size: 11px; margin-top: 2px;">Story Integration</div>
        <div class="rate-price">Rp ${tier2Str}</div>
        <div class="rate-desc">• Produk terintegrasi ke dalam plot cerita & dialog karakter.<br/>• Pinned comment & link tautan di deskripsi.<br/>• Teaser promosi medsos 15 detik.<br/>• Estimasi jangkauan: 50k - 150k views.</div>
      </div>

      <div class="rate-card">
        <div class="rate-tier" style="color: #a855f7;">Gold Tier</div>
        <div style="font-weight: bold; color: #ffffff; font-size: 11px; margin-top: 2px;">Co-Branded Episode</div>
        <div class="rate-price">Rp ${tier3Str}</div>
        <div class="rate-desc">• 1 Episode penuh (3-5 menit) didedikasikan bertema brand sponsor.<br/>• Hak distribusi komersial penuh di platform brand.<br/>• Master 4K ProRes & format vertikal 9:16.<br/>• Estimasi jangkauan: 150k - 500k+ views.</div>
      </div>
    </div>

    <div class="section-title">Karya Film Unggulan Terverifikasi</div>
    <table>
      <thead>
        <tr>
          <th>Judul Film</th>
          <th>Platform</th>
          <th style="text-align: right;">Tayangan</th>
          <th style="text-align: right;">Engagement</th>
        </tr>
      </thead>
      <tbody>
        ${filmsHtml}
      </tbody>
    </table>

    <div class="contact-box">
      <div>
        <div style="font-size: 12px; font-weight: bold; color: #ffffff;">Tertarik Bekerja Sama atau Booking Slot Sponsor?</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
          ${contactEmailHtml} ${contactPhoneHtml}
        </div>
      </div>
      <div style="font-size: 10px; color: #64748b; text-align: right;">
        Dokumen resmi diterbitkan melalui<br/>
        <strong>AI MOVIE FACTORY CREATOR ENGINE</strong>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  // 1-Click Print / Save PDF
  const handlePrintMediaKit = () => {
    const printWindow = window.open('', '_blank', 'width=950,height=1100');
    if (!printWindow) {
      onShowToast('Popup diblokir browser. Izinkan popup untuk mencetak / menyimpan PDF.', 'error');
      return;
    }
    const htmlContent = generateMediaKitHtml();
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  };

  // Download Standalone HTML/PDF File
  const handleDownloadHtmlMediaKit = () => {
    const htmlContent = generateMediaKitHtml();
    const filename = `${mediaKitSettings.studio_name.replace(/\s+/g, '_')}_Media_Kit_2026.html`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`Dokumen Media Kit "${filename}" berhasil diunduh!`, 'success');
  };

  // Copy Sponsor Pitch Email Text
  const handleCopyPitchEmail = async () => {
    const s = mediaKitSettings;
    const emailPitchText = `Subjek: Penawaran Kolaborasi Penempatan Produk & Sponsorship Sinematik 4K — ${s.studio_name}

Halo Tim Pemasaran & Brand Partnership,

Perkenalkan, saya dari ${s.studio_name}. Kami adalah studio produksi film independen bertenaga AI generasi baru di platform AI Movie Factory, dengan fokus genre ${s.primary_niche}.

Saat ini, portofolio film sinematik kami telah menjangkau lebih dari ${aggregateMetrics.totalViews.toLocaleString('id-ID')} tayangan aktif dengan tingkat keterlibatan penonton (engagement rate) sebesar ${aggregateMetrics.engagementRate}% dan skor retensi pembuka 94%.

Melihat keselarasan nilai antara brand Anda dan basis audiens kami (mayoritas usia 18-34 tahun peminat teknologi, pop culture & sinema), kami ingin menawarkan kesempatan penempatan produk/sponsorship eksklusif pada produksi film pendek 4K terbaru kami:

Pilihan Paket Kerja Sama Resmi:
1. Bronze Tier (Product Placement): Rp ${Number(s.rate_card_tier1).toLocaleString('id-ID')}
2. Silver Tier (Story & Dialogue Integration): Rp ${Number(s.rate_card_tier2).toLocaleString('id-ID')}
3. Gold Tier (Exclusive Co-Branded Episode): Rp ${Number(s.rate_card_tier3).toLocaleString('id-ID')}

Terlampir Media Kit resmi kami dengan statistik performa lengkap. Kami sangat terbuka untuk berdiskusi lebih lanjut via email ini atau WhatsApp di ${s.contact_phone}.

Terima kasih atas perhatian dan waktu Anda.

Salam hangat,
${s.studio_name}
Email: ${s.contact_email}
WhatsApp: ${s.contact_phone}
Official AMF Verified Creator • Hollywood AI Production Engine`;

    try {
      await navigator.clipboard.writeText(emailPitchText);
      setCopiedPitch(true);
      onShowToast('Naskah pitching email sponsor berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedPitch(false), 3000);
    } catch {
      onShowToast('Gagal menyalin teks ke clipboard', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#101726] border border-slate-800/80 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-wide">
              {isId ? 'Konsol Intelijen Bisnis & Pertumbuhan Kreator' : 'Creator Business & Growth Intelligence Hub'}
            </h2>
            <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-bold">
              SSOT Phase 15 • Zona 2
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            {isId
              ? 'Lacak pencapaian penonton nyata, simulasi laba bersih (ROI), dan rekomendasi AI agar setiap film yang Anda produksi menghasilkan cuan aktif.'
              : 'Track real-world audience metrics, simulate net profit (ROI), and receive AI growth directives to maximize creator monetization.'}
          </p>
        </div>

        {/* Global Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMediaKitModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isId ? 'Unduh PDF Media Kit' : 'Download Media Kit PDF'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isId ? 'Catat Rilis Film Baru' : 'Log New Release'}</span>
          </button>

          {activeProject && onNavigateToEditing && (
            <button
              onClick={() => onNavigateToEditing(activeProject.id)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Film className="w-4 h-4 text-amber-400" />
              <span>Studio Post-Pro</span>
            </button>
          )}
        </div>
      </div>

      {/* Top 4 Real-World Creator KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Cumulative Views */}
        <div className="bg-[#101726] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Tayangan Penonton</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {aggregateMetrics.totalViews.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-blue-400/90 mt-1 flex items-center gap-1">
            <span>Dari {aggregateMetrics.filmCount} karya film yang tercatat</span>
          </p>
        </div>

        {/* KPI 2: Total Revenue Earned */}
        <div className="bg-[#101726] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Cuan Dihasilkan</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            Rp {aggregateMetrics.totalRevenue.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-emerald-400/80 mt-1 flex items-center gap-1">
            <span>AdSense + Medsos + Kontrak Sponsor</span>
          </p>
        </div>

        {/* KPI 3: Engagement Rate */}
        <div className="bg-[#101726] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Rasio Interaksi (Engagement)</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">{aggregateMetrics.engagementRate}%</p>
          <p className="text-[10px] text-rose-400/90 mt-1 flex items-center gap-1">
            <span>
              {aggregateMetrics.totalLikes.toLocaleString('id-ID')} Suka • {aggregateMetrics.totalComments.toLocaleString('id-ID')} Komentar
            </span>
          </p>
        </div>

        {/* KPI 4: Investment Efficiency (ROI) */}
        <div className="bg-[#101726] border border-slate-800/80 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Kelipatan ROI Produksi</span>
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 font-mono">{aggregateMetrics.roiMultiple}x</p>
          <p className="text-[10px] text-amber-300/80 mt-1 flex items-center gap-1">
            <span>Laba Bersih: Rp {aggregateMetrics.netProfit.toLocaleString('id-ID')}</span>
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 bg-[#101726] p-1.5 rounded-xl gap-2">
        <button
          onClick={() => setActiveTab('milestones')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'milestones'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>{isId ? 'Riwayat Rilis Karya & Milestone' : 'Release Milestones & History'}</span>
          <span className="bg-black/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {milestones.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('profitability')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'profitability'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{isId ? 'Kalkulator Laba Bersih & Monetisasi' : 'Net Profit & Multi-Channel Simulator'}</span>
        </button>

        <button
          onClick={() => setActiveTab('growth_advisor')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'growth_advisor'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>{isId ? 'AI Growth Advisor & Radar Tren' : 'AI Growth Advisor & Trend Radar'}</span>
        </button>

        <button
          onClick={() => setActiveTab('media_kit')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'media_kit'
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>{isId ? 'Media Kit & Proposal Sponsor' : 'Media Kit & Brand Pitch'}</span>
          <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">
            PDF
          </span>
        </button>

        <button
          onClick={() => setActiveTab('live_analytics')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'live_analytics'
              ? 'bg-blue-500 text-slate-950 shadow-md shadow-blue-500/20 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isId ? 'Analitik Live (T9.5)' : 'Live Analytics (T9.5)'}</span>
          <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-mono border border-blue-500/30">
            API Sync
          </span>
        </button>
      </div>

      {/* TAB 1: Milestones History */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-emerald-400" />
              <span>Daftar Karya yang Telah Dipublikasikan</span>
            </h3>
            <span className="text-xs text-slate-400">
              Total {milestones.length} rekaman terverifikasi
            </span>
          </div>

          {milestones.length === 0 ? (
            <div className="p-8 text-center bg-[#101726] border border-slate-800 rounded-xl space-y-3">
              <Film className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-white">Belum Ada Rilis Film yang Dicatat</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Setelah mengekspor video dari menu Editing & Post-Produksi, catat link dan capaian penonton Anda di sini untuk memantau pertumbuhan.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-emerald-400 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Rilis Pertama Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {milestones.map((m) => {
                const plat = PLATFORM_CONFIG[m.platform] || PLATFORM_CONFIG.youtube;
                const viewsNum = Number(m.views_count) || 0;
                const likesNum = Number(m.likes_count) || 0;
                const revNum = Number(m.revenue_earned) || 0;
                const engRate = viewsNum > 0 ? (((likesNum + (Number(m.comments_count) || 0)) / viewsNum) * 100).toFixed(1) : '0';

                return (
                  <div
                    key={m.id}
                    className="p-4 bg-[#101726] border border-slate-800/80 hover:border-slate-700 rounded-xl shadow-lg transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${plat.bg} ${plat.color} ${plat.border}`}>
                          {plat.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(m.release_date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <button
                            onClick={() => handleDeleteMilestone(m.id, m.project_name)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                            title="Hapus Catatan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-white mb-1">{m.project_name}</h4>
                      {m.notes && <p className="text-xs text-slate-400 line-clamp-2 mb-2 italic">"{m.notes}"</p>}

                      {m.video_url && (
                        <a
                          href={m.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline mb-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Tonton di {plat.label.split(' ')[0]}</span>
                        </a>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-950/60 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Tayangan</span>
                        <span className="font-mono text-xs font-bold text-white">{viewsNum.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Interaksi</span>
                        <span className="font-mono text-xs font-bold text-rose-400">{engRate}%</span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-lg">
                        <span className="text-[10px] text-slate-400 block">Penghasilan</span>
                        <span className="font-mono text-xs font-bold text-emerald-400">
                          Rp {revNum.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Profitability & Financial Breakdown (TC-WF-16 SSOT & Simulator) */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          {/* Sub-Tab Navigation: Verified Actual vs Simulation Projection */}
          <div className="flex border-b border-slate-800 bg-[#0d131f] p-1.5 rounded-xl gap-2">
            <button
              type="button"
              onClick={() => setProfitabilitySubTab('actual_financial')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                profitabilitySubTab === 'actual_financial'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Laporan Finansial Riil (TC-WF-16 SSOT)</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                comprehensiveReport.hasVerifiedActualData 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {comprehensiveReport.hasVerifiedActualData ? 'VERIFIED ACTUAL' : 'DATA PENDING'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProfitabilitySubTab('simulation_projection')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                profitabilitySubTab === 'simulation_projection'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Simulator Proyeksi Cuan & Impas</span>
              <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-mono border border-amber-500/30">
                ESTIMATED PROJECTION
              </span>
            </button>
          </div>

          {/* SUB-TAB 1: Laporan Finansial Riil (TC-WF-16) */}
          {profitabilitySubTab === 'actual_financial' && (
            <div className="space-y-5">
              {/* Filter Toolbar: Period, Tax Regime, Double-Counting Prevention */}
              <div className="p-4 bg-[#101726] border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <span>Kalkulasi Laba Bersih Transparan (TC-WF-16)</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                        SSOT Bagian III.3
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Menghitung laba bersih terverifikasi dari pendapatan nyata dikurangi biaya produksi AI, potongan platform, biaya gateway, hosting CDN, dan pajak.
                    </p>
                  </div>

                  {/* Period Filter Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 px-2 font-semibold">Periode:</span>
                    {(['all_time', 'last_30_days', 'last_7_days', 'by_project'] as FinancialTimePeriod[]).map((p) => {
                      const labels: Record<FinancialTimePeriod, string> = {
                        all_time: 'Semua Waktu',
                        last_30_days: '30 Hari Terakhir',
                        last_7_days: '7 Hari Terakhir',
                        by_project: activeProject ? `Proyek: ${activeProject.name.slice(0, 10)}...` : 'Per Proyek',
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFinancialPeriod(p)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                            financialPeriod === p
                              ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          {labels[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4 Modular Tax Dimension Configuration Panels (Milestone 2.8.3) */}
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-blue-400" />
                      Arsitektur & Model Perpajakan Terpisah (DJP Compliance - Milestone 2.8.3)
                    </span>
                    <span className="text-[10px] text-blue-300 font-mono">
                      UU HPP / PP 55/2022 jo. PP 20/2026 / PMK 131/2024
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* PANEL 1: PPh Kewajiban Studio */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wide">1. PPh Studio</span>
                        <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono truncate max-w-[100px]">
                          {comprehensiveReport.taxBreakdown.pphStudioRegime}
                        </span>
                      </div>
                      
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Bentuk / Subjek Pajak:</label>
                        <select
                          value={taxPayerCategory}
                          onChange={(e) => {
                            const val = e.target.value as TaxPayerCategory;
                            setTaxPayerCategory(val);
                            if (val === 'unconfirmed') setTaxRegime('tax_basis_unconfirmed');
                            else if (val === 'cv_firma_pt_baru') setTaxRegime('pph_badan_pasal_17');
                            else if (val === 'wp_op_umkm' || val === 'pt_perorangan_umkm' || val === 'koperasi_umkm' || val === 'badan_lama_transisi') setTaxRegime('pph_final_umkm');
                          }}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                        >
                          <option value="unconfirmed">Belum Dikonfirmasi (Pending)</option>
                          <option value="wp_op_umkm">Orang Pribadi (WP OP UMKM)</option>
                          <option value="pt_perorangan_umkm">PT Perorangan 1 Orang (PP 20/2026)</option>
                          <option value="koperasi_umkm">Koperasi Dalam Negeri (Maks 4 Thn)</option>
                          <option value="badan_lama_transisi">Badan Lama (Hak Transisi PP 55/2022)</option>
                          <option value="cv_firma_pt_baru">CV / Firma / PT Baru (Wajib Ps 17)</option>
                          <option value="pkp_badan">Badan Usaha Umum (Pasal 17)</option>
                          <option value="non_pkp_op">Non-PKP / Freelancer Bebas</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Rezim PPh Terpilih:</label>
                        <select
                          value={taxRegime}
                          onChange={(e) => setTaxRegime(e.target.value as TaxRegimeType)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                        >
                          <option value="tax_basis_unconfirmed">Basis Belum Terkonfirmasi (Rp 0)</option>
                          <option value="pph_final_umkm">PPh Final UMKM 0,5% (PP 55/2022 jo. PP 20/2026)</option>
                          <option value="pph_badan_pasal_17">PPh Badan Tarif Umum 22% (Pasal 17)</option>
                          <option value="pph_op_pasal_17">PPh OP Tarif Umum / NPPN (Pasal 17)</option>
                          <option value="custom">Kustom Mandiri (%)</option>
                        </select>
                      </div>

                      {taxPayerCategory === 'wp_op_umkm' && taxRegime === 'pph_final_umkm' && (
                        <label className="flex items-start gap-1.5 pt-1 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isUmkmOver500M}
                            onChange={(e) => setIsUmkmOver500M(e.target.checked)}
                            className="mt-0.5 rounded border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-300 leading-tight">
                            Omzet tahunan kumulatif &gt; Rp 500 jt (Fasilitas bebas pajak Pasal 60 PP 55/2022)
                          </span>
                        </label>
                      )}

                      {taxPayerCategory === 'koperasi_umkm' && (
                        <div className="pt-1">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Tahun Fasilitas Terpakai (Maks 4):</label>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={yearsOfFacilityUsed}
                            onChange={(e) => setYearsOfFacilityUsed(Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                          />
                        </div>
                      )}

                      {(taxPayerCategory === 'cv_firma_pt_baru' || taxPayerCategory === 'badan_lama_transisi') && (
                        <label className="flex items-start gap-1.5 pt-1 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasTransitionRights}
                            onChange={(e) => setHasTransitionRights(e.target.checked)}
                            className="mt-0.5 rounded border-slate-700 text-blue-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-300 leading-tight">
                            Memiliki sisa masa transisi PP 55/2022 (terdaftar sebelum PP 20/2026)
                          </span>
                        </label>
                      )}

                      {comprehensiveReport.taxBreakdown.ineligibilityReason && (
                        <div className="p-1.5 bg-rose-500/10 border border-rose-500/30 rounded text-[9px] text-rose-300 leading-tight">
                          {comprehensiveReport.taxBreakdown.ineligibilityReason}
                        </div>
                      )}

                      <div className="pt-1 text-[9px] text-slate-400 space-y-0.5 border-t border-slate-800/60">
                        <p>• <span className="text-slate-300">Penanggung:</span> Studio Sendiri</p>
                        <p>• <span className="text-slate-300">Penyetor:</span> Studio ke Kas Negara</p>
                        <p>• <span className="text-slate-300">Sifat:</span> Beban Laba Rugi Operasional</p>
                      </div>
                    </div>

                    {/* PANEL 2: Status PKP & PPN Penyerahan */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">2. PPN Penyerahan</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${isPkp ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                          {isPkp ? 'PKP AKTIF' : 'NON-PKP'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isPkp}
                            onChange={(e) => setIsPkp(e.target.checked)}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[11px] text-slate-300 font-semibold">
                            Telah Dikukuhkan Sebagai PKP
                          </span>
                        </label>
                      </div>

                      {isPkp ? (
                        <div className="space-y-2 pt-1 border-t border-slate-800/60">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Kategori Transaksi Penyerahan BKP/JKP:</label>
                            <select
                              value={vatTransactionCategory}
                              onChange={(e) => setVatTransactionCategory(e.target.value as VatTransactionCategory)}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                            >
                              <option value="domestic_tickets_ppv">Tiket Pertunjukan & OTT PPV (11% Efektif - PMK 131/2024)</option>
                              <option value="commercial_production_service">Jasa Produksi Komersial / Iklan B2B (12% Standar)</option>
                              <option value="foreign_platform_monetization">Monetisasi Platform Luar Negeri (AdSense/YouTube)</option>
                            </select>
                          </div>

                          {vatTransactionCategory === 'foreign_platform_monetization' && (
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">Verifikasi Ekspor JKP (PMK 32/2019):</label>
                              <select
                                value={exportVerificationStatus}
                                onChange={(e) => setExportVerificationStatus(e.target.value as ExportServiceVerificationStatus)}
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                              >
                                <option value="unverified">Belum Terverifikasi Dokumen (Status Unconfirmed)</option>
                                <option value="verified_export_0_percent">Terverifikasi Dokumen Ekspor JKP Lengkap (Tarif 0%)</option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Skema Harga Tiket Penonton:</label>
                            <select
                              value={ppnPricingScheme}
                              onChange={(e) => setPpnPricingScheme(e.target.value as 'inclusive' | 'exclusive')}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                            >
                              <option value="inclusive">Termasuk PPN 11% Efektif (DPP = Harga / 1,11)</option>
                              <option value="exclusive">Belum Termasuk PPN (PPN = 11% x DPP)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">PPN Masukan (Faktur Masukan):</label>
                            <input
                              type="number"
                              min="0"
                              value={ppnInputCreditable}
                              onChange={(e) => setPpnInputCreditable(Number(e.target.value))}
                              placeholder="Rp 0"
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                            />
                          </div>

                          {comprehensiveReport.taxBreakdown.ppnExcessCreditCarryforwardIdr > 0 && (
                            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[9px] text-emerald-300 leading-tight">
                              <span className="font-bold">Kompensasi Masa Pajak Berikutnya:</span> Rp {comprehensiveReport.taxBreakdown.ppnExcessCreditCarryforwardIdr.toLocaleString('id-ID')} ({comprehensiveReport.taxBreakdown.ppnRefundStatus})
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          Status Non-PKP (omzet &lt; Rp 4,8 M). Bebas PPN dan dilarang memungut PPN dari penonton tiket.
                        </p>
                      )}

                      <div className="pt-1 text-[9px] text-slate-400 space-y-0.5 border-t border-slate-800/60">
                        <p>• <span className="text-slate-300">Penanggung:</span> Konsumen / Penonton</p>
                        <p>• <span className="text-slate-300">Kanal Luar Negeri:</span> {comprehensiveReport.taxBreakdown.foreignPlatformTaxStatus}</p>
                        <p>• <span className="text-slate-300">Sifat:</span> Titipan Negara (Bukan Beban Laba)</p>
                      </div>
                    </div>

                    {/* PANEL 3: Bukti Potong Diterima AMF */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide">3. Kredit Pajak Klien</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                          ASET SPT
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-tight">
                        Pajak yang dipotong oleh klien/agensi (PPh 23 2% / PPh 21) atas pembayaran jasa komersial studio.
                      </p>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Nilai Bukti Potong Diterima (Rp):</label>
                        <input
                          type="number"
                          min="0"
                          value={withholdingCreditsReceived}
                          onChange={(e) => setWithholdingCreditsReceived(Number(e.target.value))}
                          placeholder="Rp 0"
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                        />
                      </div>

                      <div className="pt-2 text-[9px] text-slate-400 space-y-0.5 border-t border-slate-800/60">
                        <p>• <span className="text-slate-300">Pemotong:</span> Klien Korporat / Agensi</p>
                        <p>• <span className="text-slate-300">Pemberi Bukti:</span> Formulir Bupot 23/21</p>
                        <p>• <span className="text-slate-300">Sifat:</span> Kredit Pajak Ps 28A (Bukan Beban)</p>
                      </div>
                    </div>

                    {/* PANEL 4: Kewajiban Pemotongan Pajak oleh AMF */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wide">4. Utang Potput AMF</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                          SETORAN AMF
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-tight">
                        Pajak yang dipotong AMF saat membayar honor vendor produksi atau animator/freelancer lepas.
                      </p>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Nilai Pajak Dipotong ke Vendor (Rp):</label>
                        <input
                          type="number"
                          min="0"
                          value={withholdingObligationsPayable}
                          onChange={(e) => setWithholdingObligationsPayable(Number(e.target.value))}
                          placeholder="Rp 0"
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                        />
                      </div>

                      <div className="pt-2 text-[9px] text-slate-400 space-y-0.5 border-t border-slate-800/60">
                        <p>• <span className="text-slate-300">Pemotong:</span> AMF Studio</p>
                        <p>• <span className="text-slate-300">Pihak Ditanggung:</span> Freelancer / Vendor</p>
                        <p>• <span className="text-slate-300">Sifat:</span> Kewajiban Penyetoran ke DJP</p>
                      </div>
                    </div>
                  </div>

                  {/* Legal Disclaimer Box */}
                  <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg text-[10px] text-slate-400 leading-relaxed flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-blue-300 block mb-0.5">Klausul Kepatuhan & Disclaimer Hukum DJP:</span>
                      {comprehensiveReport.taxDisclaimer}
                    </div>
                  </div>
                </div>

                {/* Double Counting Protection Switch */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Proteksi Potongan Ganda Platform (Zero Double-Counting):
                    </label>
                    <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5">
                      <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={!isGrossPrePlatformCut}
                          onChange={(e) => setIsGrossPrePlatformCut(!e.target.checked)}
                          className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <span className="font-semibold block text-white">
                            Pendapatan Diakui Payout Bersih (Post-Split)
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Platform Fee = Rp 0. Mencegah pemotongan fee dua kali jika angka pendapatan dari AdSense/TikTok sudah merupakan hasil bersih setelah bagi hasil platform.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

              {/* SSOT Master Formula Breakdown Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4" />
                    Persamaan Laba Bersih SSOT (Formula Substituted)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Periode: {comprehensiveReport.periodLabel}
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-200 bg-black/60 p-3 rounded-lg border border-slate-800 overflow-x-auto">
                  <span className="text-emerald-400 font-bold">Laba Bersih Kas</span> = 
                  <span className="text-white font-semibold"> Rp {comprehensiveReport.grossRevenueIdr.toLocaleString('id-ID')}</span> [Gross] - (
                  <span className="text-rose-400">Rp {comprehensiveReport.cashRefundsIdr.toLocaleString('id-ID')}</span> [Refund Uang] + 
                  <span className="text-rose-400"> Rp {comprehensiveReport.platformFeesIdr.toLocaleString('id-ID')}</span> [Platform Fee] + 
                  <span className="text-rose-400"> Rp {comprehensiveReport.gatewayFeesIdr.toLocaleString('id-ID')}</span> [Gateway] + 
                  <span className="text-rose-400"> Rp {comprehensiveReport.internalCreditCostEquivalentIdr.toLocaleString('id-ID')}</span> [Kredit AI] + 
                  <span className="text-rose-400"> Rp {comprehensiveReport.hostingCdnCostIdr.toLocaleString('id-ID')}</span> [CDN] + 
                  <span className="text-rose-400"> Rp {comprehensiveReport.taxIdr.toLocaleString('id-ID')}</span> [Pajak]) = 
                  <span className={`font-black ${comprehensiveReport.netProfitIdr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {' '}Rp {comprehensiveReport.netProfitIdr.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* 5 Executive Financial KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Gross Revenue */}
                <div className="p-3.5 bg-[#101726] border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Omzet Kotor Kas</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.2 rounded font-bold">
                      GROSS CASH
                    </span>
                  </div>
                  <p className="text-base sm:text-lg font-black text-white font-mono">
                    Rp {comprehensiveReport.grossRevenueIdr.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Orders: Rp {comprehensiveReport.onPlatformOrdersGrossIdr.toLocaleString('id-ID')} • Kanal: Rp {comprehensiveReport.externalMilestonesGrossIdr.toLocaleString('id-ID')}
                  </p>
                </div>

                {/* 2. AI Production Cost */}
                <div className="p-3.5 bg-[#101726] border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Nilai Kuota AI</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1 rounded font-bold">
                      INTERNAL TARIFF
                    </span>
                  </div>
                  <p className="text-base sm:text-lg font-black text-rose-400 font-mono">
                    -Rp {comprehensiveReport.internalCreditCostEquivalentIdr.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {comprehensiveReport.internalAiCreditsConsumed.toLocaleString('id-ID')} CR (@Rp 1.000 internal)
                  </p>
                </div>

                {/* 3. Operating Deductions */}
                <div className="p-3.5 bg-[#101726] border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Beban CDN & Operasional</span>
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <p className="text-base sm:text-lg font-black text-rose-400/90 font-mono">
                    -Rp {(comprehensiveReport.hostingCdnCostIdr + comprehensiveReport.gatewayFeesIdr + comprehensiveReport.platformFeesIdr + comprehensiveReport.cashRefundsIdr).toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Refund uang: Rp {comprehensiveReport.cashRefundsIdr.toLocaleString('id-ID')} (Restorasi {comprehensiveReport.creditRefundsCount} CR)
                  </p>
                </div>

                {/* 4. Tax (Studio Income Tax Expense) */}
                <div className="p-3.5 bg-[#101726] border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Beban PPh Studio</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      comprehensiveReport.taxBasisStatus === 'CONFIRMED' ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {comprehensiveReport.taxBasisStatus === 'CONFIRMED' ? `${comprehensiveReport.taxBreakdown.pphEffectiveRatePercent}%` : 'UNCONFIRMED'}
                    </span>
                  </div>
                  <p className={`text-base sm:text-lg font-black font-mono ${comprehensiveReport.taxBasisStatus === 'CONFIRMED' ? 'text-rose-400/90' : 'text-amber-400'}`}>
                    {comprehensiveReport.taxBasisStatus === 'CONFIRMED' ? `-Rp ${comprehensiveReport.taxBreakdown.pphStudioIdr.toLocaleString('id-ID')}` : 'Rp 0 (Pending)'}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Setoran Kas Pajak: Rp {comprehensiveReport.taxBreakdown.cashflowReconciliation.totalTaxCashOutflowIdr.toLocaleString('id-ID')}
                  </p>
                </div>

                {/* 5. Net Profit */}
                <div className="p-3.5 bg-gradient-to-b from-emerald-500/15 to-[#101726] border border-emerald-500/40 rounded-xl space-y-1 col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">LABA BERSIH (NET)</span>
                    <span className="text-[9px] bg-emerald-500/30 text-emerald-200 font-mono px-1.5 py-0.2 rounded font-black">
                      {comprehensiveReport.netProfitMarginPercent}% MARGIN
                    </span>
                  </div>
                  <p className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                    Rp {comprehensiveReport.netProfitIdr.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-slate-300">
                    ROI: <span className="font-bold text-white">{comprehensiveReport.roiPercent}%</span>
                  </p>
                </div>
              </div>

              {/* Tax Cashflow Reconciliation Bar (SSOT Milestone 2.8.3.1) */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Rekonsiliasi Arus Kas Pajak (Tax Cashflow Reconciliation)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Total Arus Kas Keluar: <span className="text-rose-400 font-bold">Rp {comprehensiveReport.taxBreakdown.cashflowReconciliation.totalTaxCashOutflowIdr.toLocaleString('id-ID')}</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="p-2 bg-slate-900/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">1. PPh Studio (P&L):</span>
                    <span className="text-white font-bold">Rp {comprehensiveReport.taxBreakdown.cashflowReconciliation.pphStudioExpenseIdr.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="p-2 bg-slate-900/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">2. PPN Terutang (Setoran):</span>
                    <span className="text-amber-300 font-bold">Rp {comprehensiveReport.taxBreakdown.cashflowReconciliation.ppnNetPayableIdr.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="p-2 bg-slate-900/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">3. Utang PPh Potput AMF:</span>
                    <span className="text-purple-300 font-bold">Rp {comprehensiveReport.taxBreakdown.cashflowReconciliation.withholdingTaxObligationsPayableIdr.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="p-2 bg-slate-900/60 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[10px]">4. Kredit Bupot Klien:</span>
                    <span className="text-emerald-300 font-bold">Rp {comprehensiveReport.taxBreakdown.cashflowReconciliation.withholdingTaxCreditsReceivedIdr.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Detailed Traceability Ledger Audit Table */}
              <div className="p-4 bg-[#101726] border border-slate-800 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Audit Sumber Data Finansial (Traceable Ledger)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Menampilkan rincian entri terverifikasi per basis transaksi database
                  </span>
                </div>

                {comprehensiveReport.lineItems.length === 0 ? (
                  <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-xl text-center space-y-3">
                    <Info className="w-8 h-8 text-slate-500 mx-auto" />
                    <div>
                      <h5 className="text-sm font-bold text-white">Belum Ada Riwayat Transaksi Finansial</h5>
                      <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Sistem AMF secara jujur menolak menampilkan angka laba fiktif. Catat rilis film pertama Anda pada tab Milestones atau lakukan simulasi menggunakan tab Simulator.
                      </p>
                    </div>
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        + Catat Rilis Pertama
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfitabilitySubTab('simulation_projection')}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        Buka Simulator
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/70">
                          <th className="py-2.5 px-3">Komponen Finansial</th>
                          <th className="py-2.5 px-3">Kategori</th>
                          <th className="py-2.5 px-3">Sumber Data Audit</th>
                          <th className="py-2.5 px-3">Status Klasifikasi</th>
                          <th className="py-2.5 px-3 text-right">Nilai (IDR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {comprehensiveReport.lineItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-3 text-slate-200 font-sans">
                              <span className="font-semibold block">{item.label}</span>
                              {item.notes && <span className="text-[10px] text-slate-500 block">{item.notes}</span>}
                            </td>
                            <td className="py-2.5 px-3 uppercase text-[10px] text-slate-400">
                              {item.category.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans truncate max-w-xs" title={item.dataSource}>
                              {item.dataSource}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[9px] font-bold">
                                {item.classification}
                              </span>
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${item.isDeduction ? (item.amountIdr === 0 ? 'text-slate-500' : 'text-rose-400') : 'text-emerald-400'}`}>
                              {item.isDeduction ? (item.amountIdr === 0 ? 'Rp 0' : `-Rp ${item.amountIdr.toLocaleString('id-ID')}`) : `+Rp ${item.amountIdr.toLocaleString('id-ID')}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: Profitability Simulator (Interactive Projections) */}
          {profitabilitySubTab === 'simulation_projection' && (
            <div className="p-5 bg-[#101726] border border-slate-800 rounded-xl space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-400" />
                    <span>Simulator Proyeksi Cuan & Margin Laba Bersih (Net Profit)</span>
                  </h3>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded font-bold border border-amber-500/30">
                    ESTIMATED PROJECTION
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Hitung estimasi pendapatan dari berbagai sumber pemasukan, kurangkan biaya produksi AI, dan temukan titik impas (*break-even point*) film Anda.
                </p>
              </div>

              {/* View Target Slider */}
              <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Target Jumlah Tayangan (Views)</span>
                  <span className="font-mono text-base font-extrabold text-amber-400">
                    {simViews.toLocaleString('id-ID')} Tayangan
                  </span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="2000000"
                  step="10000"
                  value={simViews}
                  onChange={(e) => setSimViews(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10.000 (Pemula)</span>
                  <span>100.000 (Indie Viral)</span>
                  <span>500.000 (Studio)</span>
                  <span>2.000.000 (Blockbuster)</span>
                </div>
              </div>

              {/* Genre RPM Preset Buttons */}
              <div>
                <label className="text-xs font-bold text-white block mb-2">
                  Pilih Kategori Genre & Tolak Ukur RPM YouTube:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { genre: 'Sci-Fi & Teknologi', rpm: 22000, desc: 'RPM Tertinggi (Audiens Tech & Gadget)' },
                    { genre: 'Misteri & Folklor', rpm: 18000, desc: 'Daya Viral Tinggi (Penonton Medsos)' },
                    { genre: 'Aksi & Petualangan', rpm: 15000, desc: 'Audiens Luas Lintas Usia' },
                    { genre: 'Drama Seri Pendek', rpm: 12000, desc: 'Sangat Cocok untuk Model Pay-per-view' },
                  ].map((g) => (
                    <button
                      key={g.genre}
                      type="button"
                      onClick={() => setSimGenreRpm(g.rpm)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        simGenreRpm === g.rpm
                          ? 'bg-amber-500/15 border-amber-500/50 text-white shadow'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold block">{g.genre}</span>
                      <span className="text-[10px] font-mono text-amber-400 block mt-0.5">
                        RPM Rp {g.rpm.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[9px] text-slate-500 block mt-0.5">{g.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Left Column: Pemasukan Multi-Kanal */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Komponen Pemasukan (Gross Revenue)</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>• YouTube AdSense (RPM Rp {simGenreRpm.toLocaleString('id-ID')}):</span>
                      <span className="font-mono text-white font-semibold">
                        Rp {simCalculation.ytAdsense.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>• TikTok Creator Rewards & Reels Bonus:</span>
                      <span className="font-mono text-white font-semibold">
                        Rp {simCalculation.tiktokRewards.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>• Kontrak Sponsorship & Product Placement:</span>
                      <span className="font-mono text-white font-semibold">
                        Rp {simCalculation.sponsorship.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400 pt-2 border-t border-slate-800">
                      <span>• Potensi Seri Berbayar ({simCalculation.buyers.toLocaleString('id-ID')} pembeli):</span>
                      <span className="font-mono text-amber-300">
                        +Rp {simCalculation.webDramaPayPerView.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-sm pt-2 border-t border-slate-700 text-amber-400">
                      <span>Total Estimasi Pemasukan:</span>
                      <span className="font-mono">
                        Rp {simCalculation.totalGrossRevenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Biaya Produksi & Laba Bersih */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <Award className="w-3.5 h-3.5" />
                        <span>Formula Laba Bersih (SSOT Bagian III.3)</span>
                      </h4>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded font-bold">
                        [ESTIMATED PROJECTION]
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs mt-3">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Estimasi Pemasukan Kotor (Gross):</span>
                        <span className="font-mono text-white font-bold">
                          Rp {simCalculation.totalGrossRevenue.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-rose-400 text-[11px]">
                        <span>• Biaya Pembuatan Film (Kredit AI):</span>
                        <span className="font-mono">-Rp {simAiCreditsCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-rose-400/90 text-[11px]">
                        <span>• Hosting & Streaming CDN (Bandwidth):</span>
                        <span className="font-mono">-Rp {simCalculation.hostingCdnCost.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-rose-400/90 text-[11px]">
                        <span>• Potongan Platform & Store Fees (10%):</span>
                        <span className="font-mono">-Rp {simCalculation.platformFees.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-rose-400/90 text-[11px]">
                        <span>• Estimasi PPh Final UMKM (0.5% Omzet):</span>
                        <span className="font-mono">-Rp {simCalculation.estimatedTax.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center font-bold text-slate-400 pt-1.5 border-t border-slate-800 text-[11px]">
                        <span>Total Seluruh Potongan:</span>
                        <span className="font-mono text-rose-400">
                          -Rp {simCalculation.totalDeductionsStandard.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-black/60 rounded-xl border border-amber-500/30 text-center space-y-1 mt-2">
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">LABA BERSIH RIIL (NET PROFIT)</span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.2 rounded font-bold">
                        PROYEKSI
                      </span>
                    </div>
                    <p className="text-2xl font-black text-amber-400 font-mono">
                      Rp {simCalculation.netProfitStandard.toLocaleString('id-ID')}
                    </p>
                    <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                      Margin Keuntungan Bersih: {simCalculation.marginStandard}%
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 italic text-center">
                *Model estimasi berbasis benchmark riil industri YouTube Studio & Creator Rewards 2026. Hasil aktual bergantung pada retensi penonton dan demografi penonton.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AI Growth Advisor & Trend Radar (T7 & SSOT Bagian III.4) */}
      {activeTab === 'growth_advisor' && (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="p-4 bg-gradient-to-r from-blue-500/15 via-slate-900 to-slate-950 border border-blue-500/30 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>AI Business Advisor (Penasihat Strategis Kreator Berbasis Data Nyata)</span>
              </h3>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded font-bold border border-blue-500/30">
                SSOT Bagian III.4
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Rekomendasi strategis yang dibangun secara deterministik dari metrik AMF terverifikasi: data acuan riil, asumsi pasar, tingkat keyakinan (*confidence level*), dan batas risiko bisnis nyata.
            </p>
          </div>

          {/* Dynamic Evidence-Based AI Directives */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Direktif Strategis Bisnis Terverifikasi (Evidence-Based)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dynamicAdvisorDirectives.map((d) => {
                const badgeColor = 
                  d.badge === 'OPTIMAL' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                  d.badge === 'RECOMMENDED' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                  d.badge === 'WARNING' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                  'bg-slate-800 text-slate-400 border-slate-700';

                return (
                  <div key={d.id} className="p-4 bg-[#101726] border border-slate-800 hover:border-slate-700 rounded-xl space-y-3 shadow-lg transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        {d.title}
                      </span>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${badgeColor}`}>
                        {d.badge} • {d.ruleBasedConfidenceScore}% RULE COVERAGE
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 italic">
                      *{d.confidenceDescription}
                    </p>

                    {/* Evidence & Data Source */}
                    <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                        • Data Acuan Riil (Evidence):
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed font-mono">
                        {d.evidenceDataSource}
                      </p>
                    </div>

                    {/* Market Assumptions & Risk Boundary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-blue-400 font-semibold block mb-0.5">Asumsi Pasar:</span>
                        <p className="text-slate-400">{d.marketAssumptions}</p>
                      </div>
                      <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-rose-400 font-semibold block mb-0.5">Batas Risiko Bisnis:</span>
                        <p className="text-slate-400">{d.riskBoundary}</p>
                      </div>
                    </div>

                    {/* Action Recommendation */}
                    <div className="pt-2 border-t border-slate-800 text-xs">
                      <span className="text-amber-400 font-bold block mb-0.5">Tindakan Strategis:</span>
                      <p className="text-slate-200 leading-relaxed">{d.strategicAction}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Industry Trends & Publishing Schedule Benchmarks */}
          <div className="pt-2 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Benchmark Tren Industri & Waktu Rilis Sinematik 2026</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Benchmark 1 */}
              <div className="p-4 bg-[#101726]/80 border border-slate-800/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    Waktu & Jadwal Rilis Emas (Golden Hours)
                  </span>
                  <span className="text-[9px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full">
                    Peak Engagement
                  </span>
                </div>
                <h5 className="text-sm font-bold text-white">Kamis & Jumat — Pukul 19:30 s/d 21:00 WIB</h5>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Audiens film pendek berdurasi 3-8 menit paling aktif mengonsumsi konten sinematik menjelang akhir pekan. Rilis teaser pada hari Rabu sore untuk membangun antisipasi penonton.
                </p>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <span className="text-blue-400 font-semibold">Saran Eksekusi:</span> Gunakan paket ekspor 15-detik Teaser dari tab Editing untuk diposting 24 jam sebelum film utama tayang.
                </div>
              </div>

              {/* Benchmark 2 */}
              <div className="p-4 bg-[#101726]/80 border border-slate-800/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    Standar Tarif Sponsor Komersial Niche AI Film
                  </span>
                  <span className="text-[9px] bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded-full">
                    Market Benchmark
                  </span>
                </div>
                <h5 className="text-sm font-bold text-white">Tolok Ukur: Rp 2.500.000 s/d Rp 12.500.000 per Integrasi</h5>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Film berbasis visual AI berkualitas tinggi menarik sponsor industri teknologi, SaaS, gaming, dan lifestyle karena kesan modern dan visual yang estetis.
                </p>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <span className="text-purple-400 font-semibold">Saran Eksekusi:</span> Gunakan tab Media Kit untuk mengunduh proposal PDF resmi dan kirimkan langsung ke calon mitra sponsor.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Creator Media Kit & Commercial Proposal (Sprint 3: P2) */}
      {activeTab === 'media_kit' && (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-950 border border-amber-500/30 rounded-xl shadow-lg">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-400" />
                <span>Creator Commercial Media Kit & Proposal Rate Card 2026</span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Dokumen resmi berstandar industri periklanan untuk diajukan ke brand sponsor, agensi, dan klien komersial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrintMediaKit}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md shadow-amber-400/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan PDF (A4)</span>
              </button>

              <button
                onClick={handleDownloadHtmlMediaKit}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Unduh berkas HTML standalone yang bisa dibuka offline"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Unduh File HTML</span>
              </button>

              <button
                onClick={handleCopyPitchEmail}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPitch ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                <span>{copiedPitch ? 'Tersalin!' : 'Salin Email Pitch'}</span>
              </button>

              <button
                onClick={() => setIsEditingMediaKit(!isEditingMediaKit)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs rounded-lg border border-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span>{isEditingMediaKit ? 'Tutup Form' : 'Edit Rate Card'}</span>
              </button>
            </div>
          </div>

          {/* Edit Settings Form (When Toggled) */}
          {isEditingMediaKit && (
            <div className="p-5 bg-[#101726] border border-amber-500/30 rounded-xl space-y-4 animate-in fade-in">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Kustomisasi Profil Studio & Tarif Sponsor (Rate Card)</span>
              </h4>

              <form onSubmit={handleSaveMediaKitSettings} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Nama Studio / Kreator:</label>
                    <input
                      type="text"
                      required
                      value={mediaKitSettings.studio_name}
                      onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, studio_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Fokus Genre / Niche Utama:</label>
                    <input
                      type="text"
                      required
                      value={mediaKitSettings.primary_niche}
                      onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, primary_niche: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Email Kontak Bisnis:</label>
                    <input
                      type="email"
                      required
                      value={mediaKitSettings.contact_email}
                      onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, contact_email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Nomor WhatsApp / Telepon:</label>
                    <input
                      type="text"
                      value={mediaKitSettings.contact_phone || ''}
                      onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, contact_phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Bio & Visi Kreatif Studio:</label>
                  <textarea
                    rows={2}
                    value={mediaKitSettings.bio}
                    onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white resize-none"
                  />
                </div>

                {/* 3 Rate Card Tiers */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-amber-400 block text-[11px] uppercase tracking-wider">
                    Tarif Paket Kerja Sama (IDR)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Bronze Tier (Product Placement):</label>
                      <input
                        type="number"
                        step="100000"
                        value={mediaKitSettings.rate_card_tier1}
                        onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, rate_card_tier1: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Silver Tier (Story Integration):</label>
                      <input
                        type="number"
                        step="100000"
                        value={mediaKitSettings.rate_card_tier2}
                        onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, rate_card_tier2: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[10px] block mb-1">Gold Tier (Co-Branded Film):</label>
                      <input
                        type="number"
                        step="100000"
                        value={mediaKitSettings.rate_card_tier3}
                        onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, rate_card_tier3: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Privacy & Visibility Settings */}
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-cyan-400 block text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Visibilitas & Kontrol Privasi Media Kit</span>
                  </span>
                  <div className="space-y-2 text-[11px] text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={mediaKitSettings.is_public ?? false}
                        onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, is_public: e.target.checked })}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Publikasikan Media Kit (Izinkan mitra sponsor mengakses portofolio Anda secara publik)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={mediaKitSettings.share_email ?? true}
                        onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, share_email: e.target.checked })}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Tampilkan alamat email bisnis pada dokumen publik</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={mediaKitSettings.share_phone ?? false}
                        onChange={(e) => setMediaKitSettings({ ...mediaKitSettings, share_phone: e.target.checked })}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span>Tampilkan nomor WhatsApp/telepon pada dokumen publik</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingMediaKit(false)}
                    className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMediaKit}
                    className="px-4 py-1.5 bg-amber-400 text-slate-950 font-bold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingMediaKit ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Interactive Document Preview Card (A4 Sinematik Layout) */}
          <div className="bg-[#0b0f17] border-2 border-slate-800 rounded-2xl p-6 sm:p-8 max-w-4xl mx-auto shadow-2xl space-y-6 text-slate-300 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Document Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 border-b border-slate-800">
              <div>
                <span className="inline-block bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2">
                  Official AMF Verified Creator • 4K AI Cinema
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {mediaKitSettings.studio_name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Film className="w-3.5 h-3.5 text-amber-400" />
                    {mediaKitSettings.primary_niche}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    {mediaKitSettings.location}
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs font-bold text-amber-400 tracking-wider">AI MOVIE FACTORY</span>
                <p className="text-[10px] text-slate-500">Hollywood AI Production Engine</p>
                <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 ${mediaKitSettings.is_public ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800/80 text-slate-400 border-slate-700'} border rounded-full text-[10px] font-mono`}>
                  {mediaKitSettings.is_public ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  <span>{mediaKitSettings.is_public ? 'Publik (Bisa Diakses Mitra)' : 'Privat (Hanya Akun Anda)'}</span>
                </div>
              </div>
            </div>

            {/* Creative Vision Callout */}
            <div className="p-4 bg-slate-900/60 border-l-4 border-amber-400 rounded-r-xl space-y-1 text-xs">
              <strong className="text-white block">Visi & Karakter Kreatif Studio:</strong>
              <p className="text-slate-300 leading-relaxed">{mediaKitSettings.bio}</p>
              <p className="text-amber-300 italic pt-1 text-[11px]">"{mediaKitSettings.custom_pitch_hook}"</p>
            </div>

            {/* Analytics Performance Grid */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Portofolio Statistik & Metrik Performa Nyata</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Tayangan</span>
                  <p className="text-xl font-extrabold text-blue-400 font-mono mt-1">
                    {aggregateMetrics.totalViews.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Rata-rata Interaksi</span>
                  <p className="text-xl font-extrabold text-rose-400 font-mono mt-1">
                    {aggregateMetrics.engagementRate}%
                  </p>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Skor Retensi 15s</span>
                  <p className="text-xl font-extrabold text-emerald-400 font-mono mt-1">{milestones.length > 0 ? '94%' : '-'}</p>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Karya Rilis</span>
                  <p className="text-xl font-extrabold text-amber-400 font-mono mt-1">
                    {milestones.length} Film
                  </p>
                </div>
              </div>
            </div>

            {/* Audience Demographics */}
            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Karakteristik & Demografi Audiens</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">Rentang Usia Penonton:</span>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="flex justify-between"><span>18–24 Tahun:</span><span className="text-white">38%</span></div>
                    <div className="flex justify-between"><span>25–34 Tahun:</span><span className="text-white font-bold text-cyan-400">44%</span></div>
                    <div className="flex justify-between"><span>35–44 Tahun:</span><span className="text-white">18%</span></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">Geografis Utama:</span>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="flex justify-between"><span>Indonesia:</span><span className="text-emerald-400 font-bold">82%</span></div>
                    <div className="flex justify-between"><span>Malaysia / SG:</span><span className="text-white">11%</span></div>
                    <div className="flex justify-between"><span>Global / SEA:</span><span className="text-white">7%</span></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">Konsumsi Media:</span>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="flex justify-between"><span>Mobile (9:16):</span><span className="text-amber-400 font-bold">84%</span></div>
                    <div className="flex justify-between"><span>Smart TV / OTT:</span><span className="text-white">11%</span></div>
                    <div className="flex justify-between"><span>Desktop:</span><span className="text-white">5%</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Commercial Rate Cards (3 Tiers) */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Katalog Paket Kerja Sama & Rate Card Sponsor Resmi</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Bronze */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Bronze Tier
                  </span>
                  <h5 className="text-xs font-bold text-white">Product Placement</h5>
                  <p className="text-lg font-black text-emerald-400 font-mono">
                    Rp {Number(mediaKitSettings.rate_card_tier1).toLocaleString('id-ID')}
                  </p>
                  <ul className="text-[10px] text-slate-300 space-y-1 border-t border-slate-800/80 pt-2">
                    <li>• Penempatan produk di 1 adegan film</li>
                    <li>• Logo pada credit title akhir</li>
                    <li>• Estimasi: 25.000–50.000 views</li>
                  </ul>
                </div>

                {/* Silver */}
                <div className="p-4 bg-amber-500/10 border-2 border-amber-400/60 rounded-xl space-y-2 relative">
                  <span className="absolute -top-2.5 right-3 bg-amber-400 text-slate-950 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                    REKOMENDASI UTAMA
                  </span>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    Silver Tier
                  </span>
                  <h5 className="text-xs font-bold text-white">Story Integration</h5>
                  <p className="text-lg font-black text-emerald-400 font-mono">
                    Rp {Number(mediaKitSettings.rate_card_tier2).toLocaleString('id-ID')}
                  </p>
                  <ul className="text-[10px] text-slate-300 space-y-1 border-t border-amber-500/30 pt-2">
                    <li>• Produk menyatu dalam plot dialog</li>
                    <li>• Pinned comment & link di deskripsi</li>
                    <li>• Teaser promosi medsos 15 detik</li>
                    <li>• Estimasi: 50.000–150.000 views</li>
                  </ul>
                </div>

                {/* Gold */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">
                    Gold Tier
                  </span>
                  <h5 className="text-xs font-bold text-white">Co-Branded Film</h5>
                  <p className="text-lg font-black text-emerald-400 font-mono">
                    Rp {Number(mediaKitSettings.rate_card_tier3).toLocaleString('id-ID')}
                  </p>
                  <ul className="text-[10px] text-slate-300 space-y-1 border-t border-slate-800/80 pt-2">
                    <li>• 1 Episode penuh (3-5 menit) tema brand</li>
                    <li>• Hak tayang komersial penuh di medsos brand</li>
                    <li>• Master 4K ProRes & 9:16 Vertikal</li>
                    <li>• Estimasi: 150.000–500.000+ views</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Featured Films Showcase */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Film className="w-4 h-4 text-emerald-400" />
                <span>Karya Film Unggulan Terverifikasi</span>
              </h4>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Judul Film</th>
                      <th className="p-2.5">Platform</th>
                      <th className="p-2.5 text-right">Tayangan</th>
                      <th className="p-2.5 text-right">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                    {milestones.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-500 italic font-sans">
                          Belum ada rilisan film yang dicatat. Riwayat karya terverifikasi akan otomatis muncul setelah Anda mencatat milestone publikasi.
                        </td>
                      </tr>
                    ) : (
                      milestones.slice(0, 5).map((m) => (
                        <tr key={m.id} className="hover:bg-slate-900/50">
                          <td className="p-2.5 font-sans font-bold text-white">{m.project_name}</td>
                          <td className="p-2.5 uppercase text-cyan-400 text-[10px]">{m.platform}</td>
                          <td className="p-2.5 text-right text-slate-200">
                            {Number(m.views_count).toLocaleString('id-ID')}
                          </td>
                          <td className="p-2.5 text-right text-emerald-400">
                            {(
                              ((Number(m.likes_count) + Number(m.comments_count)) /
                                Math.max(Number(m.views_count), 1)) *
                              100
                            ).toFixed(1)}
                            %
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Contact & Booking Footer */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Tertarik Menjadi Sponsor atau Kolaborasi?</span>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1">
                  {mediaKitSettings.share_email !== false && (
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Mail className="w-3.5 h-3.5" />
                      {mediaKitSettings.contact_email}
                    </span>
                  )}
                  {mediaKitSettings.share_phone && mediaKitSettings.contact_phone && (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Phone className="w-3.5 h-3.5" />
                      {mediaKitSettings.contact_phone}
                    </span>
                  )}
                  {!mediaKitSettings.share_phone && (
                    <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      Nomor telepon privat
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handlePrintMediaKit}
                className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-transform active:scale-95 cursor-pointer shadow-lg shadow-amber-400/20 flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Simpan sebagai PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Live Analytics Sync & Multi-Platform Performance Aggregator (T9.5) */}
      {activeTab === 'live_analytics' && (
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-500/15 via-slate-900 to-slate-950 border border-blue-500/30 rounded-xl shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {isId ? 'Sinkronisasi Metrik Platform Resmi (T9.5)' : 'Official Multi-Platform Analytics Hub'}
                </h3>
                <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 font-semibold">
                  API Sync • Cron 4 Jam / On-Demand
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isId
                  ? 'Agregasi metrik resmi langsung dari YouTube Data & Analytics API, TikTok Open API, Instagram Graph API & Facebook Graph API (Cron 4 jam & tombol sinkronisasi instan).'
                  : 'Official performance metrics aggregated directly from provider APIs (4-hour cron sync & instant refresh).'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lastSyncTime && (
                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isId ? 'Terakhir sync:' : 'Last synced:'} {lastSyncTime}</span>
                </span>
              )}

              <button
                onClick={loadLiveAnalyticsData}
                disabled={isLoadingAnalytics}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? 'animate-spin text-blue-400' : ''}`} />
                <span>{isId ? 'Segarkan' : 'Refresh'}</span>
              </button>

              <button
                onClick={handleSyncAllJobs}
                disabled={isSyncingAll || publishedJobs.length === 0}
                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? (isId ? 'Menyinkronkan...' : 'Syncing...') : (isId ? 'Sinkronkan Semua Metrik Live' : 'Sync All Live Metrics')}</span>
              </button>
            </div>
          </div>

          {/* Live Scorecard (Real Aggregate KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#101726] border border-blue-500/20 p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold">{isId ? 'Total Tayangan Live' : 'Total Live Views'}</span>
                <Eye className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-black text-white font-mono">
                {liveTotals.totalViews.toLocaleString('id-ID')}
              </p>
              <p className="text-[10px] text-blue-300/80 mt-1 flex items-center gap-1">
                <span>{isId ? 'Dari seluruh platform terverifikasi' : 'Across all verified platforms'}</span>
              </p>
            </div>

            <div className="bg-[#101726] border border-emerald-500/20 p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold">{isId ? 'Total Interaksi Nyata' : 'Total Live Engagements'}</span>
                <ThumbsUp className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 font-mono">
                {liveTotals.totalInteractions.toLocaleString('id-ID')}
              </p>
              <p className="text-[10px] text-emerald-300/80 mt-1 flex items-center gap-1">
                <span>{liveTotals.totalLikes.toLocaleString('id-ID')} Suka • {liveTotals.totalComments.toLocaleString('id-ID')} Komentar • {liveTotals.totalShares.toLocaleString('id-ID')} Share</span>
              </p>
            </div>

            <div className="bg-[#101726] border border-purple-500/20 p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold">{isId ? 'Rata-rata Durasi Tonton' : 'Avg View Duration'}</span>
                <Film className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-2xl font-black text-purple-300 font-mono">
                {liveTotals.avgDuration > 0 ? `${liveTotals.avgDuration} dtk` : '—'}
              </p>
              <p className="text-[10px] text-purple-300/80 mt-1 flex items-center gap-1">
                <span>{isId ? 'Dihitung dari retensi resmi API' : 'Calculated from official API retention'}</span>
              </p>
            </div>

            <div className="bg-[#101726] border border-amber-500/20 p-4 rounded-xl shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold">{isId ? 'Video Published Tersinkron' : 'Synced Published Videos'}</span>
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400 font-mono">
                {liveTotals.syncedVideosCount} / {publishedJobs.length}
              </p>
              <p className="text-[10px] text-amber-300/80 mt-1 flex items-center gap-1">
                <span>{isId ? 'Status tayang resmi di platform target' : 'Officially published on target platform'}</span>
              </p>
            </div>
          </div>

          {/* Published Content Performance Table */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Film className="w-4 h-4 text-blue-400" />
                  <span>{isId ? 'Daftar Film Terpublikasi & Metrik Real-Time' : 'Published Films & Real-Time Performance'}</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isId
                    ? 'Klik tombol "Sinkronkan" untuk menarik angka penonton terbaru langsung dari server platform penyedia.'
                    : 'Click "Sync Now" to fetch the latest view count directly from provider servers.'}
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Total {publishedJobs.length} video
              </span>
            </div>

            {publishedJobs.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                  <Globe className="w-7 h-7 text-slate-500" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h5 className="text-sm font-bold text-white">
                    {isId ? 'Belum Ada Film yang Diterbitkan' : 'No Published Films Yet'}
                  </h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isId
                      ? 'Setelah film Anda selesai di-render dan diterbitkan ke YouTube, TikTok, Instagram, atau Facebook melalui Publishing Hub, Anda dapat melacak statistik performa real-time di sini.'
                      : 'Once your films are rendered and published via the Publishing Hub, you can track live analytics here.'}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl max-w-lg mx-auto text-[11px] text-blue-300 text-left flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>{isId ? 'Prinsip Integritas Data AMF:' : 'AMF Data Integrity Principle:'}</strong>{' '}
                    {isId
                      ? 'AI Movie Factory menolak menampilkan metrik palsu (dummy/fabricated stats). Seluruh angka analitik harus diverifikasi secara kriptografis melalui API platform resmi.'
                      : 'AI Movie Factory enforces zero dummy data. All metrics are cryptographically verified via official platform APIs.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-mono">
                    <tr>
                      <th className="p-3">Film / Judul</th>
                      <th className="p-3">Platform</th>
                      <th className="p-3 text-right">Tayangan Live</th>
                      <th className="p-3 text-right">Suka</th>
                      <th className="p-3 text-right">Komentar</th>
                      <th className="p-3 text-right">Share</th>
                      <th className="p-3 text-center">Status Sync</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                    {publishedJobs.map((job) => {
                      const snap = liveSnapshots[job.id];
                      const isSyncing = syncingJobId === job.id;
                      const platformKey = job.platform as PublishingPlatformKey;
                      const platformStyle = PLATFORM_CONFIG[platformKey] || {
                        label: job.platform.toUpperCase(),
                        color: 'text-slate-300',
                        bg: 'bg-slate-800',
                        border: 'border-slate-700',
                      };

                      return (
                        <tr key={job.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 font-sans">
                            <div className="font-bold text-white max-w-xs truncate">{job.title}</div>
                            {job.published_video_url && (
                              <a
                                href={job.published_video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-mono mt-0.5"
                              >
                                <span>{job.external_publish_id || 'Tonton di Platform'}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${platformStyle.bg} ${platformStyle.color} ${platformStyle.border} uppercase`}>
                              {job.platform}
                            </span>
                          </td>
                          <td className="p-3 text-right text-white font-bold">
                            {snap ? snap.views.toLocaleString('id-ID') : <span className="text-slate-500 font-sans italic text-[10px]">Belum Sync</span>}
                          </td>
                          <td className="p-3 text-right text-emerald-400">
                            {snap ? snap.likes.toLocaleString('id-ID') : '—'}
                          </td>
                          <td className="p-3 text-right text-blue-300">
                            {snap ? snap.comments.toLocaleString('id-ID') : '—'}
                          </td>
                          <td className="p-3 text-right text-purple-300">
                            {snap ? snap.shares.toLocaleString('id-ID') : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {snap ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-sans">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Tersinkron</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-sans">
                                <AlertCircle className="w-3 h-3" />
                                <span>Menunggu Sync</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSyncSingleJob(job.id)}
                                disabled={isSyncing}
                                title="Tarik metrik terbaru via API"
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                                <span>{isSyncing ? '...' : (isId ? 'Sync' : 'Sync')}</span>
                              </button>

                              <button
                                onClick={() => handlePromoteToMilestone(job, snap)}
                                title="Jadikan Milestone untuk kalkulasi Laba & Media Kit"
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded border border-amber-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>{isId ? 'Milestone' : 'Milestone'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Full Preview & 1-Click PDF Download */}
      {isMediaKitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#101726] border border-amber-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Pratinjau Resmi: Creator Media Kit 2026</h3>
                  <p className="text-[11px] text-slate-400">Format A4 Sinematik Siap Kirim ke Brand Sponsor</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintMediaKit}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak / PDF (A4)</span>
                </button>
                <button
                  onClick={handleDownloadHtmlMediaKit}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Unduh HTML</span>
                </button>
                <button
                  onClick={() => setIsMediaKitModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#0b0f17]">
              {/* Document Body matches main card */}
              <div className="bg-[#101726] border border-slate-800 rounded-xl p-6 space-y-6 text-slate-300">
                <div className="flex justify-between items-start pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-bold uppercase">
                      Official AMF Verified Creator
                    </span>
                    <h2 className="text-2xl font-black text-white mt-2">{mediaKitSettings.studio_name}</h2>
                    <p className="text-xs text-slate-400 mt-1">{mediaKitSettings.primary_niche} • {mediaKitSettings.location}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-400">AI MOVIE FACTORY</span>
                    <p className="text-[10px] text-slate-500">Hollywood AI Studio Suite</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 border-l-4 border-cyan-400 rounded-r-lg text-xs space-y-1">
                  <strong className="text-white">Visi Kreatif:</strong>
                  <p className="text-slate-300">{mediaKitSettings.bio}</p>
                </div>

                {/* 4 KPIs */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400">Tayangan</span>
                    <p className="text-lg font-bold text-blue-400 font-mono mt-0.5">
                      {aggregateMetrics.totalViews.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400">Interaksi</span>
                    <p className="text-lg font-bold text-rose-400 font-mono mt-0.5">
                      {aggregateMetrics.engagementRate}%
                    </p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400">Retensi 15s</span>
                    <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">94%</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400">Film Rilis</span>
                    <p className="text-lg font-bold text-amber-400 font-mono mt-0.5">{milestones.length}</p>
                  </div>
                </div>

                {/* Rate Card 3 Columns */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold block">BRONZE</span>
                    <span className="font-bold text-white block">Product Placement</span>
                    <p className="text-sm font-mono font-bold text-emerald-400 my-1">
                      Rp {Number(mediaKitSettings.rate_card_tier1).toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-slate-400">Logo/produk di 1 adegan + kredit terima kasih.</p>
                  </div>

                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/50">
                    <span className="text-[10px] text-amber-400 font-bold block">SILVER (FAVORIT)</span>
                    <span className="font-bold text-white block">Story Integration</span>
                    <p className="text-sm font-mono font-bold text-emerald-400 my-1">
                      Rp {Number(mediaKitSettings.rate_card_tier2).toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-slate-300">Produk masuk alur dialog + pinned comment + teaser medsos.</p>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-purple-400 font-bold block">GOLD</span>
                    <span className="font-bold text-white block">Co-Branded Film</span>
                    <p className="text-sm font-mono font-bold text-emerald-400 my-1">
                      Rp {Number(mediaKitSettings.rate_card_tier3).toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-slate-400">1 Episode penuh 3-5 menit bertema brand + 4K ProRes.</p>
                  </div>
                </div>

                {/* Contact Banner */}
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-white font-bold block">Kontak Bisnis & Kerja Sama:</span>
                    <span className="text-cyan-400">{mediaKitSettings.contact_email}</span> • <span className="text-emerald-400">{mediaKitSettings.contact_phone}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Diterbitkan oleh AMF Studio Engine</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Milestone Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#101726] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Catat Rilis Karya Film Baru</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMilestone} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nama Judul Film:
                </label>
                <input
                  type="text"
                  required
                  value={formProjectName}
                  onChange={(e) => setFormProjectName(e.target.value)}
                  placeholder="Contoh: Sang Pemburu Dimensi: Episode 1"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Platform Rilis:</label>
                  <select
                    value={formPlatform}
                    onChange={(e) => setFormPlatform(e.target.value as PublishingPlatformKey)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                  >
                    <option value="youtube">YouTube (16:9 / 4K)</option>
                    <option value="tiktok">TikTok (9:16 Vertikal)</option>
                    <option value="reels">Instagram Reels</option>
                    <option value="x_twitter">X / Twitter</option>
                    <option value="web_drama">Web Drama / OTT Series</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">URL Video Publik:</label>
                  <input
                    type="url"
                    value={formVideoUrl}
                    onChange={(e) => setFormVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Tayangan (Views):</label>
                  <input
                    type="number"
                    min="0"
                    value={formViews}
                    onChange={(e) => setFormViews(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Suka (Likes):</label>
                  <input
                    type="number"
                    min="0"
                    value={formLikes}
                    onChange={(e) => setFormLikes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Pendapatan (IDR):</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={formRevenue}
                    onChange={(e) => setFormRevenue(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Catatan Rilis & Insight:</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: Tayangan viral dari rekomendasi feed. Komentar penonton meminta episode 2 segera dibuat."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Milestone'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
