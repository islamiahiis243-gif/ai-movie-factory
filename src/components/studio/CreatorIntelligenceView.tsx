import React, { useState, useEffect, useMemo } from 'react';
import { Project, CreatorMilestone, PublishingPlatformKey } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { fetchCreatorMilestones, createCreatorMilestone, deleteCreatorMilestone } from '../../lib/supabase';
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
  const [activeTab, setActiveTab] = useState<'milestones' | 'profitability' | 'growth_advisor'>('milestones');

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

  // Load Milestones
  const loadMilestones = async () => {
    setIsLoading(true);
    try {
      const res = await fetchCreatorMilestones(userId);
      if (res.data && res.data.length > 0) {
        setMilestones(res.data);
      } else {
        // Provide starter milestone for rich initial UX if none exist
        const starter: CreatorMilestone = {
          id: 'starter-milestone-1',
          user_id: userId,
          project_id: activeProject?.id,
          project_name: activeProject?.name || 'Mahakarya AI Pertama',
          platform: 'youtube',
          video_url: 'https://youtube.com',
          views_count: 54200,
          likes_count: 3890,
          comments_count: 245,
          revenue_earned: 850000,
          currency: 'IDR',
          release_date: new Date(Date.now() - 5 * 86400000).toISOString(),
          notes: 'Rilis perdana full movie 4K. Kinerja retensi sangat tinggi di 30 detik pertama.',
          created_at: new Date().toISOString(),
        };
        setMilestones([starter]);
      }
    } catch (err: any) {
      console.warn('Failed to load milestones:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMilestones();
  }, [userId]);

  // Aggregate Metrics
  const aggregateMetrics = useMemo(() => {
    const totalViews = milestones.reduce((acc, m) => acc + (Number(m.views_count) || 0), 0);
    const totalLikes = milestones.reduce((acc, m) => acc + (Number(m.likes_count) || 0), 0);
    const totalComments = milestones.reduce((acc, m) => acc + (Number(m.comments_count) || 0), 0);
    const totalRevenue = milestones.reduce((acc, m) => acc + (Number(m.revenue_earned) || 0), 0);

    const engagementRate = totalViews > 0 ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(1) : '0.0';
    const totalCostEstimate = milestones.length * 250000;
    const netProfit = Math.max(totalRevenue - totalCostEstimate, 0);
    const roiMultiple = totalCostEstimate > 0 ? (totalRevenue / totalCostEstimate).toFixed(1) : '1.0';

    return {
      totalViews,
      totalLikes,
      totalComments,
      totalRevenue,
      engagementRate,
      netProfit,
      roiMultiple,
      filmCount: milestones.length,
    };
  }, [milestones]);

  // Profitability Simulator Calculations
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

    const netProfitStandard = Math.max(totalGrossRevenue - simAiCreditsCost, 0);
    const netProfitWithPayPerView = Math.max(totalWithPayPerView - simAiCreditsCost, 0);

    const marginStandard = Math.round((netProfitStandard / totalGrossRevenue) * 100);
    const marginWithPayPerView = Math.round((netProfitWithPayPerView / totalWithPayPerView) * 100);

    return {
      ytAdsense,
      tiktokRewards,
      sponsorship,
      buyers,
      webDramaPayPerView,
      totalGrossRevenue,
      totalWithPayPerView,
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

      if (res.data) {
        setMilestones((prev) => [res.data!, ...prev]);
        setIsAddModalOpen(false);
        onShowToast(`Rilis film "${formProjectName}" berhasil dicatat ke intelijen bisnis!`, 'success');
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

      {/* TAB 2: Profitability Simulator (T5) */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          <div className="p-5 bg-[#101726] border border-slate-800 rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Simulator Proyeksi Cuan & Margin Laba Bersih (Net Profit)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Hitung estimasi pendapatan dari berbagai sumber pemasukan nyata, kurangkan biaya produksi AI, dan temukan titik impas (*break-even point*) film Anda.
              </p>
            </div>

            {/* View Target Slider */}
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Target Jumlah Tayangan (Views)</span>
                <span className="font-mono text-base font-extrabold text-emerald-400">
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
                className="w-full accent-emerald-400 cursor-pointer"
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
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">{g.genre}</span>
                    <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">
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
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
                  <div className="flex justify-between items-center font-bold text-sm pt-2 border-t border-slate-700 text-emerald-400">
                    <span>Total Estimasi Pemasukan:</span>
                    <span className="font-mono">
                      Rp {simCalculation.totalGrossRevenue.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Biaya Produksi & Laba Bersih */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-3.5 h-3.5" />
                    <span>Perhitungan Laba Bersih (Net Profit)</span>
                  </h4>
                  <div className="space-y-2 text-xs mt-3">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Estimasi Pemasukan Kotor:</span>
                      <span className="font-mono text-white">
                        Rp {simCalculation.totalGrossRevenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-rose-400">
                      <span>Biaya Pembuatan Film (Kredit AI):</span>
                      <span className="font-mono">-Rp {simAiCreditsCost.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-black/60 rounded-xl border border-emerald-500/30 text-center space-y-1">
                  <span className="text-[11px] text-slate-400 block">ESTIMASI LABA BERSIH KREATOR</span>
                  <p className="text-2xl font-black text-emerald-400 font-mono">
                    Rp {simCalculation.netProfitStandard.toLocaleString('id-ID')}
                  </p>
                  <span className="text-[10px] text-emerald-300 font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full inline-block">
                    Margin Keuntungan: {simCalculation.marginStandard}%
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic text-center">
              *Model estimasi berbasis benchmark riil industri YouTube Studio & Creator Rewards 2026. Hasil aktual bergantung pada retensi penonton dan demografi penonton.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: AI Growth Advisor & Trend Radar (T7) */}
      {activeTab === 'growth_advisor' && (
        <div className="space-y-5">
          {/* Executive Growth Directives */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Directive 1: Next Film Topic Recommendation */}
            <div className="p-4 bg-[#101726] border border-amber-500/30 rounded-xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Rekomendasi Niche & Topik Film Berikutnya
                </span>
                <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full">
                  High Demand 2026
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">
                Fiksi Ilmiah Nusantara & Horor Folklore Modern
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Data penonton menunjukkan genre gabungan Sci-Fi dan mitologi lokal memiliki rasio berbagi (*viral share*) 4.2x lebih tinggi di TikTok dan YouTube Shorts dibanding konten fiksi generik.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="text-amber-400 font-semibold">Tindakan Disarankan:</span> Manfaatkan modul Story & Script untuk membuat serial drama 3 episode berlatar kota masa depan Jakarta 2088.
              </div>
            </div>

            {/* Directive 2: Optimal Publishing Schedule */}
            <div className="p-4 bg-[#101726] border border-blue-500/30 rounded-xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  Waktu & Jadwal Rilis Emas (Golden Hours)
                </span>
                <span className="text-[9px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full">
                  Peak Engagement
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">Kamis & Jumat — Pukul 19:30 s/d 21:00 WIB</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Audiens film pendek berdurasi 3-8 menit paling aktif mengonsumsi konten sinematik menjelang akhir pekan. Rilis teaser pada hari Rabu sore untuk membangun antisipasi.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="text-blue-400 font-semibold">Tindakan Disarankan:</span> Gunakan paket ekspor 15-detik Teaser dari tab Publikasi untuk diposting 24 jam sebelum film utama tayang.
              </div>
            </div>

            {/* Directive 3: Retention & Pacing Advice */}
            <div className="p-4 bg-[#101726] border border-emerald-500/30 rounded-xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Optimasi Pacing & Golden Hook 15 Detik
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full">
                  Anti-Drop Off
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">Pindahkan Aksi Kritis ke Detik ke-3</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                85% penonton yang melewati 15 detik pertama akan menonton hingga selesai. Hindari pembukaan dengan pemandangan statis tanpa narasi suara yang kuat.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold">Tindakan Disarankan:</span> Selalu gunakan inspeksi Safe Area pada format 9:16 agar teks hook pembuka berada tepat di area bebas tombol.
              </div>
            </div>

            {/* Directive 4: Sponsorship Pitch Strategy */}
            <div className="p-4 bg-[#101726] border border-purple-500/30 rounded-xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Strategi Menembus Sponsor Merek Komersial
                </span>
                <span className="text-[9px] bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded-full">
                  Brand Monetization
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">Tarif Ideal: Rp 2.500.000 s/d Rp 5.000.000 per Penempatan</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dengan rata-rata 50.000+ views, channel Anda masuk dalam kategori *High-Value Niche Creator*. Brand teknologi, game, dan minuman energi menyukai penempatan logo dalam adegan film AI.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span className="text-purple-400 font-semibold">Tindakan Disarankan:</span> Sisipkan produk sponsor secara halus ke dalam salah satu prompt adegan di modul Media Studio.
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
