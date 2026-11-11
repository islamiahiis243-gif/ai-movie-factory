import React, { useState, useMemo, useEffect } from 'react';
import {
  Tv,
  Film,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  Lock,
  Unlock,
  Eye,
  Globe,
  Share2,
  Calendar,
  Sparkles,
  ShieldCheck,
  Clapperboard,
  Tag,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Info,
  DollarSign,
  Users,
  Search,
  Filter,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  OttChannel,
  OttSeries,
  OttSeason,
  OttEpisode,
  OttFilm,
  OttCastMember,
  OttAccessPolicy,
  OttPublicationStatus,
  Project,
} from '../../types/database';
import {
  createDefaultOttChannel,
  validateCatalogItemPublication,
  linkProductionMasterToCatalogItem,
  calculateSeriesAggregation,
  projectPublicCatalogItems,
} from '../../lib/ottCatalogEngine';
import { OttPlayerModal } from '../ott/OttPlayerModal.tsx';
import { OttCheckoutModal } from '../ott/OttCheckoutModal.tsx';
import { OttPaymentOrder, OttCreatorRevenueSummary } from '../../types/database.ts';
import { supabase } from '../../lib/supabase.ts';

interface OttCatalogManagerViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onNavigateToPostPro?: (projectId?: string) => void;
}

export const OttCatalogManagerView: React.FC<OttCatalogManagerViewProps> = ({
  projects,
  selectedProjectId,
  onShowToast,
  onNavigateToPostPro,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id || 'demo_creator_user';

  // Sub-navigation tab
  const [activeCatalogTab, setActiveCatalogTab] = useState<'series' | 'films' | 'link_master' | 'preview_portal' | 'commerce'>('series');

  // OTT B2C Commerce State
  const [commerceSummary, setCommerceSummary] = useState<OttCreatorRevenueSummary>({
    channel_id: '',
    gross_revenue_idr: 0,
    gateway_fees_idr: 0,
    platform_fees_idr: 0,
    net_creator_earnings_idr: 0,
    settled_orders_count: 0,
    active_subscribers_count: 0,
    ppv_tickets_sold_count: 0,
    data_mode: 'VERIFIED_ACTUAL',
  });
  const [recentOrders, setRecentOrders] = useState<OttPaymentOrder[]>([]);
  const [isLoadingCommerce, setIsLoadingCommerce] = useState(false);
  const [testCheckout, setTestCheckout] = useState<{
    isOpen: boolean;
    title: string;
    priceIdr: number;
    contentId?: string;
    contentType?: 'film' | 'episode' | 'season' | 'channel';
    orderType: 'ppv_single' | 'season_pass' | 'svod_channel';
  }>({
    isOpen: false,
    title: '',
    priceIdr: 0,
    orderType: 'ppv_single',
  });

  // OTT Channel state
  const [channel, setChannel] = useState<OttChannel>(() => {
    const saved = localStorage.getItem(`amf_ott_channel_${currentUserId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return createDefaultOttChannel(currentUserId, 'Apex Cyberpunk Originals');
  });

  // Series state
  const [seriesList, setSeriesList] = useState<OttSeries[]>(() => {
    const saved = localStorage.getItem(`amf_ott_series_${currentUserId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'ser-cyber-01',
        channel_id: channel.id,
        user_id: currentUserId,
        title: 'Chronicles of Neo-Jakarta: Season 1',
        slug: 'chronicles-neo-jakarta',
        synopsis: 'Serial web drama vertikal 9:16 mengisahkan detektif sibernetik memburu hacker AI di Jakarta tahun 2088.',
        content_format: 'short_form_vertical_9_16',
        genres: ['Cyberpunk', 'Sci-Fi', 'Thriller'],
        tags: ['Web Drama', 'Cliffhanger', '9:16'],
        poster_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&h=750&fit=crop',
        backdrop_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&h=600&fit=crop',
        total_seasons_count: 1,
        total_episodes_count: 3,
        maturity_rating: '17+',
        default_access_policy: 'ppv_tvod',
        publication_status: 'published',
        featured: true,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  });

  // Seasons state
  const [seasonsList, setSeasonsList] = useState<OttSeason[]>(() => {
    return [
      {
        id: 'sn-cyber-01',
        series_id: 'ser-cyber-01',
        season_number: 1,
        title: 'Musim 1: Inisiasi Kode Merah',
        synopsis: 'Langkah awal penyelidikan jaringan sindikat augmentasi ilegal.',
        episodes_count: 3,
        publication_status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  });

  // Episodes state
  const [episodesList, setEpisodesList] = useState<OttEpisode[]>(() => {
    const saved = localStorage.getItem(`amf_ott_episodes_${currentUserId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'ep-cyber-01',
        series_id: 'ser-cyber-01',
        season_id: 'sn-cyber-01',
        user_id: currentUserId,
        episode_number: 1,
        title: 'Episode 1: Glitch di Sudut Glodok',
        slug: 'ep-1-glitch-glodok',
        synopsis: 'Penyelidikan bermula saat seorang cyborg misterius meninggalkan jejak memori terenkripsi.',
        runtime_seconds: 180,
        thumbnail_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
        access_policy: 'free',
        ppv_price_idr: 0,
        publication_status: 'published',
        published_at: new Date(Date.now() - 86400000 * 3).toISOString(),
        master_approval_status: 'GATE_5_APPROVED',
        master_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        master_video_fingerprint: 'fp_gate5_ep01_verified',
        subtitle_vtt_url: 'https://example.com/subs/ep1.vtt',
        chapters_json: [
          { time: 0, title: 'Opening Glodok 2088' },
          { time: 60, title: 'Temuan Chip Memori' },
          { time: 140, title: 'Cliffhanger Penyerbuan' },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ep-cyber-02',
        series_id: 'ser-cyber-01',
        season_id: 'sn-cyber-01',
        user_id: currentUserId,
        episode_number: 2,
        title: 'Episode 2: Pasar Gelap Menara Thamrin',
        slug: 'ep-2-pasar-gelap-thamrin',
        synopsis: 'Perburuan mengarah ke lantai 90 menara terbengkalai tempat perdagangan avatar palsu berlangsung.',
        runtime_seconds: 195,
        thumbnail_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=450&fit=crop',
        access_policy: 'ppv_tvod',
        ppv_price_idr: 5000,
        publication_status: 'published',
        published_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        master_approval_status: 'GATE_5_APPROVED',
        master_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        master_video_fingerprint: 'fp_gate5_ep02_verified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ep-cyber-03',
        series_id: 'ser-cyber-01',
        season_id: 'sn-cyber-01',
        user_id: currentUserId,
        episode_number: 3,
        title: 'Episode 3: Pengkhianatan di Ruang Server',
        slug: 'ep-3-pengkhianatan-server',
        synopsis: 'Identitas dalang sebenarnya terungkap di pusat data bawah tanah Monas.',
        runtime_seconds: 210,
        thumbnail_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=450&fit=crop',
        access_policy: 'ppv_tvod',
        ppv_price_idr: 5000,
        publication_status: 'draft_catalog',
        master_approval_status: 'GATE_5_APPROVED',
        master_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        master_video_fingerprint: 'fp_gate5_ep03_verified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  });

  // Standalone films state
  const [filmsList, setFilmsList] = useState<OttFilm[]>(() => {
    const saved = localStorage.getItem(`amf_ott_films_${currentUserId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return [
      {
        id: 'flm-cyber-premiere',
        channel_id: channel.id,
        user_id: currentUserId,
        title: 'The Cyber Alchemist: Origins (Extended Cut)',
        slug: 'cyber-alchemist-origins',
        logline: 'Perjalanan alkemis digital mengubah kode menjadi energi kehidupan.',
        synopsis: 'Film pendek sinematik 16:9 4K yang memenangkan seleksi film independen virtual.',
        runtime_seconds: 960, // 16 minutes
        aspect_ratio: '16:9',
        genres: ['Sci-Fi', 'Mystery', 'Drama'],
        tags: ['Festival Cut', 'Direct Premiere', 'ProRes 4K'],
        poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&h=750&fit=crop',
        backdrop_url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1200&h=600&fit=crop',
        trailer_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        access_policy: 'ppv_tvod',
        ppv_price_idr: 15000,
        publication_status: 'published',
        published_at: new Date(Date.now() - 86400000 * 4).toISOString(),
        master_approval_status: 'GATE_5_APPROVED',
        master_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        master_video_fingerprint: 'fp_gate5_film01_verified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  });

  // Selected series for inspector
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('ser-cyber-01');
  const selectedSeries = useMemo(() => {
    return seriesList.find((s) => s.id === selectedSeriesId) || seriesList[0];
  }, [seriesList, selectedSeriesId]);

  // Persist locally
  useEffect(() => {
    localStorage.setItem(`amf_ott_channel_${currentUserId}`, JSON.stringify(channel));
  }, [channel, currentUserId]);

  useEffect(() => {
    localStorage.setItem(`amf_ott_series_${currentUserId}`, JSON.stringify(seriesList));
  }, [seriesList, currentUserId]);

  useEffect(() => {
    localStorage.setItem(`amf_ott_episodes_${currentUserId}`, JSON.stringify(episodesList));
  }, [episodesList, currentUserId]);

  useEffect(() => {
    localStorage.setItem(`amf_ott_films_${currentUserId}`, JSON.stringify(filmsList));
  }, [filmsList, currentUserId]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filtered series
  const filteredSeries = useMemo(() => {
    return seriesList.filter((s) => {
      const matchSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.synopsis && s.synopsis.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus = statusFilter === 'all' || s.publication_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [seriesList, searchQuery, statusFilter]);

  // Filtered films
  const filteredFilms = useMemo(() => {
    return filmsList.filter((f) => {
      const matchSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.synopsis && f.synopsis.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchStatus = statusFilter === 'all' || f.publication_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [filmsList, searchQuery, statusFilter]);

  // Quick stats
  const catalogStats = useMemo(() => {
    const totalPublishedSeries = seriesList.filter((s) => s.publication_status === 'published').length;
    const totalPublishedFilms = filmsList.filter((f) => f.publication_status === 'published').length;
    const totalEpisodes = episodesList.length;
    const publishedEpisodes = episodesList.filter((e) => e.publication_status === 'published').length;
    const freeEpisodes = episodesList.filter((e) => e.access_policy === 'free').length;
    const ppvEpisodes = episodesList.filter((e) => e.access_policy === 'ppv_tvod').length;

    return {
      totalPublishedSeries,
      totalPublishedFilms,
      totalEpisodes,
      publishedEpisodes,
      freeEpisodes,
      ppvEpisodes,
    };
  }, [seriesList, filmsList, episodesList]);

  // Fetch Commerce Data from Supabase
  const loadCommerceData = async () => {
    if (!channel?.id || !supabase) return;
    setIsLoadingCommerce(true);
    try {
      // 1. Fetch summary from RPC
      const { data: summaryData, error: summaryErr } = await supabase.rpc('get_ott_creator_revenue_summary', {
        p_channel_id: channel.id,
      });

      if (!summaryErr && summaryData) {
        setCommerceSummary(summaryData as OttCreatorRevenueSummary);
      }

      // 2. Fetch recent orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from('ott_payment_orders')
        .select('*')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!ordersErr && ordersData) {
        setRecentOrders(ordersData as OttPaymentOrder[]);
      }
    } catch (err) {
      console.error('Failed to load commerce data:', err);
    } finally {
      setIsLoadingCommerce(false);
    }
  };

  useEffect(() => {
    if (activeCatalogTab === 'commerce') {
      loadCommerceData();
    }
  }, [activeCatalogTab, channel?.id]);

  // Player modal state
  const [playerModal, setPlayerModal] = useState<{
    isOpen: boolean;
    contentId: string;
    contentType: 'film' | 'episode';
    channelId: string;
    grantToken: string;
    title: string;
    posterUrl?: string;
    aspectRatio?: '16:9' | '9:16';
  }>({
    isOpen: false,
    contentId: '',
    contentType: 'film',
    channelId: '',
    grantToken: '',
    title: '',
  });

  const handleLaunchPlayback = (
    contentId: string,
    contentType: 'film' | 'episode',
    title: string,
    posterUrl?: string,
    aspectRatio: '16:9' | '9:16' = '16:9'
  ) => {
    setPlayerModal({
      isOpen: true,
      contentId,
      contentType,
      channelId: channel.id,
      grantToken: 'preview_sample_grant_token',
      title,
      posterUrl,
      aspectRatio,
    });
  };

  // Toggle Publication status for an Episode
  const handleToggleEpisodePublication = (episodeId: string) => {
    setEpisodesList((prev) =>
      prev.map((ep) => {
        if (ep.id !== episodeId) return ep;
        const newStatus: OttPublicationStatus = ep.publication_status === 'published' ? 'draft_catalog' : 'published';
        
        // Validation check
        const validation = validateCatalogItemPublication({
          title: ep.title,
          publication_status: newStatus,
          master_approval_status: ep.master_approval_status,
          master_video_url: ep.master_video_url,
          runtime_seconds: ep.runtime_seconds,
          thumbnail_url: ep.thumbnail_url,
        });

        if (!validation.valid) {
          if (onShowToast) onShowToast(validation.error || 'Gagal memublikasikan item.', 'error');
          return ep;
        }

        if (onShowToast) {
          onShowToast(
            newStatus === 'published'
              ? `Episode "${ep.title}" berhasil dipublikasikan ke katalog OTT!`
              : `Episode "${ep.title}" dikembalikan ke status Draft.`,
            'success'
          );
        }

        return {
          ...ep,
          publication_status: newStatus,
          published_at: newStatus === 'published' ? new Date().toISOString() : ep.published_at,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  // Toggle Publication status for a Film
  const handleToggleFilmPublication = (filmId: string) => {
    setFilmsList((prev) =>
      prev.map((f) => {
        if (f.id !== filmId) return f;
        const newStatus: OttPublicationStatus = f.publication_status === 'published' ? 'draft_catalog' : 'published';
        
        const validation = validateCatalogItemPublication({
          title: f.title,
          publication_status: newStatus,
          master_approval_status: f.master_approval_status,
          master_video_url: f.master_video_url,
          runtime_seconds: f.runtime_seconds,
          poster_url: f.poster_url,
        });

        if (!validation.valid) {
          if (onShowToast) onShowToast(validation.error || 'Gagal memublikasikan film.', 'error');
          return f;
        }

        if (onShowToast) {
          onShowToast(
            newStatus === 'published'
              ? `Film "${f.title}" berhasil dipublikasikan ke etalase OTT!`
              : `Film "${f.title}" ditarik ke status Draft.`,
            'success'
          );
        }

        return {
          ...f,
          publication_status: newStatus,
          published_at: newStatus === 'published' ? new Date().toISOString() : f.published_at,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  // Link Production Master Modal State
  const [selectedProjectForLink, setSelectedProjectForLink] = useState<string>(projects[0]?.id || '');
  const [targetCatalogType, setTargetCatalogType] = useState<'episode' | 'film'>('episode');
  const [targetEpisodeId, setTargetEpisodeId] = useState<string>(episodesList[0]?.id || '');

  const handleExecuteMasterLink = () => {
    const proj = projects.find((p) => p.id === selectedProjectForLink);
    if (!proj) {
      if (onShowToast) onShowToast('Pilih proyek produksi yang valid terlebih dahulu.', 'error');
      return;
    }

    try {
      if (targetCatalogType === 'episode') {
        const ep = episodesList.find((e) => e.id === targetEpisodeId);
        if (!ep) {
          if (onShowToast) onShowToast('Episode target tidak ditemukan.', 'error');
          return;
        }

        // Link production master
        const updatedEp = linkProductionMasterToCatalogItem({
          targetItem: ep,
          project: proj,
          requestingUserId: currentUserId,
          videoUrl: (proj as any).master_render_url || 'https://storage.googleapis.com/amf-renders/master_gate5_verified.mp4',
          fingerprint: `fp_gate5_${proj.id.slice(0, 8)}`,
          runtimeSeconds: (proj as any).duration_seconds || 180,
        });

        setEpisodesList((prev) => prev.map((e) => (e.id === ep.id ? updatedEp : e)));
        if (onShowToast) {
          onShowToast(`Aset Master Gate 5 dari proyek "${proj.name}" berhasil ditautkan ke ${ep.title}!`, 'success');
        }
      } else {
        // Link to Film
        const flm = filmsList[0];
        if (!flm) {
          if (onShowToast) onShowToast('Tidak ada film standalone untuk ditautkan.', 'error');
          return;
        }

        const updatedFlm = linkProductionMasterToCatalogItem({
          targetItem: flm,
          project: proj,
          requestingUserId: currentUserId,
          videoUrl: (proj as any).master_render_url || 'https://storage.googleapis.com/amf-renders/master_gate5_film.mp4',
          fingerprint: `fp_gate5_film_${proj.id.slice(0, 8)}`,
          runtimeSeconds: 960,
        });

        setFilmsList((prev) => prev.map((f) => (f.id === flm.id ? updatedFlm : f)));
        if (onShowToast) {
          onShowToast(`Aset Master Gate 5 berhasil ditautkan ke film "${flm.title}"!`, 'success');
        }
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Gagal menautkan master.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Studio Channel Identity */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#101726] to-slate-900 border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={channel.logo_url}
                alt={channel.name}
                className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-400/40 shadow-lg"
              />
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-0.5 rounded-full ring-2 ring-slate-900">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{channel.name}</h1>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold uppercase">
                  OTT Channel Terverifikasi
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl line-clamp-1">{channel.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 font-mono">
                <span className="text-slate-300">ID: @{channel.slug}</span>
                <span>•</span>
                <span className="text-emerald-400">{channel.website_url}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto text-center font-mono">
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Serial Aktif</span>
              <span className="text-base font-black text-white">{catalogStats.totalPublishedSeries}</span>
            </div>
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Episode Terbit</span>
              <span className="text-base font-black text-emerald-400">{catalogStats.publishedEpisodes}</span>
            </div>
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">PPV / Berbayar</span>
              <span className="text-base font-black text-amber-400">{catalogStats.ppvEpisodes}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveCatalogTab('series')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeCatalogTab === 'series'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clapperboard className="w-4 h-4" />
            <span>Serial & Web Drama ({seriesList.length})</span>
          </button>

          <button
            onClick={() => setActiveCatalogTab('films')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeCatalogTab === 'films'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Film Standalone ({filmsList.length})</span>
          </button>

          <button
            onClick={() => setActiveCatalogTab('link_master')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeCatalogTab === 'link_master'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Integrasi Master Gate 5</span>
          </button>

          <button
            onClick={() => setActiveCatalogTab('preview_portal')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeCatalogTab === 'preview_portal'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>Preview Etalase Publik</span>
          </button>

          <button
            onClick={() => setActiveCatalogTab('commerce')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeCatalogTab === 'commerce'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>Monetisasi & Transaksi OTT</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul tayangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="published">Tayang (Published)</option>
            <option value="draft_catalog">Draf (Draft)</option>
          </select>
        </div>
      </div>

      {/* 3. TAB 1: SERIAL & WEB DRAMA */}
      {activeCatalogTab === 'series' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Series List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Daftar Serial Web Drama</span>
              </h3>
            </div>

            <div className="space-y-3">
              {filteredSeries.map((s) => {
                const isSelected = s.id === selectedSeriesId;
                const agg = calculateSeriesAggregation(s, seasonsList, episodesList);
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSeriesId(s.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex gap-3 ${
                      isSelected
                        ? 'bg-slate-900/90 border-emerald-500/50 shadow-lg ring-1 ring-emerald-500/20'
                        : 'bg-[#101726]/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <img
                      src={s.poster_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&h=300&fit=crop'}
                      alt={s.title}
                      className="w-16 h-24 rounded-lg object-cover shrink-0 border border-slate-800 shadow"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
                          {s.content_format === 'short_form_vertical_9_16' ? '9:16 Vertikal' : '16:9 Sinematik'}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            s.publication_status === 'published'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {s.publication_status.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate mt-0.5">{s.title}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{s.synopsis}</p>
                      
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-mono">
                        <span>{agg.totalEpisodesCount} Episode</span>
                        <span>•</span>
                        <span>{agg.totalRuntimeFormatted}</span>
                        <span>•</span>
                        <span className="text-amber-400">{s.maturity_rating}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Episodes & Master Asset Inspector */}
          <div className="lg:col-span-2 space-y-4">
            {selectedSeries ? (
              <div className="bg-[#101726] border border-slate-800 rounded-2xl p-5 space-y-5">
                {/* Series Banner Details */}
                <div className="flex flex-col sm:flex-row gap-4 items-start pb-4 border-b border-slate-800/80">
                  <img
                    src={selectedSeries.backdrop_url || selectedSeries.poster_url}
                    alt={selectedSeries.title}
                    className="w-full sm:w-44 h-28 rounded-xl object-cover border border-slate-800 shadow-md"
                  />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
                        Detail Serial & Musim
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Slug: <code className="text-slate-300">/{selectedSeries.slug}</code>
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-white">{selectedSeries.title}</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedSeries.synopsis}</p>
                    
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {selectedSeries.genres.map((g) => (
                        <span key={g} className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] text-slate-300">
                          {g}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">
                        Default: {selectedSeries.default_access_policy === 'ppv_tvod' ? 'PPV / Tiket' : 'Gratis'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Episodes List in Selected Series */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Tv className="w-4 h-4 text-emerald-400" />
                      <span>Episode Musim 1 ({episodesList.filter((e) => e.series_id === selectedSeries.id).length})</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Klik toggle untuk memublikasikan ke etalase penonton
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {episodesList
                      .filter((e) => e.series_id === selectedSeries.id)
                      .map((ep) => {
                        const isPublished = ep.publication_status === 'published';
                        const isGate5Approved = ep.master_approval_status === 'GATE_5_APPROVED';
                        return (
                          <div
                            key={ep.id}
                            className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <img
                                  src={ep.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=120&fit=crop'}
                                  alt={ep.title}
                                  className="w-20 h-12 rounded-lg object-cover border border-slate-800"
                                />
                                <span className="absolute bottom-1 right-1 bg-black/80 text-white font-mono text-[9px] px-1 rounded">
                                  {Math.floor(ep.runtime_seconds / 60)}:{(ep.runtime_seconds % 60).toString().padStart(2, '0')}
                                </span>
                              </div>

                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                    EPISODE {ep.episode_number}
                                  </span>
                                  <span
                                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                                      ep.access_policy === 'free'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-amber-500/20 text-amber-300'
                                    }`}
                                  >
                                    {ep.access_policy === 'free' ? 'GRATIS' : `PPV Rp ${ep.ppv_price_idr.toLocaleString('id-ID')}`}
                                  </span>
                                </div>
                                <h5 className="text-xs font-bold text-white truncate">{ep.title}</h5>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono truncate">
                                  <span className={isGate5Approved ? 'text-emerald-400' : 'text-amber-400'}>
                                    {isGate5Approved ? '✓ Gate 5 Master Terverifikasi' : '⚠ Gate 5 Pending'}
                                  </span>
                                  <span>•</span>
                                  <span className="truncate">{ep.master_video_fingerprint || 'Belum ada fingerprint'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Publish Status Toggle Guard */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                onClick={() => handleToggleEpisodePublication(ep.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isPublished
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
                                }`}
                              >
                                {isPublished ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>TAYANG (PUBLISHED)</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                    <span>TERBITKAN</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-[#101726] border border-slate-800 rounded-2xl text-slate-500 text-xs">
                Pilih serial untuk melihat daftar episode dan aset master.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: STANDALONE CINEMATIC FILMS */}
      {activeCatalogTab === 'films' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-emerald-400" />
              <span>Daftar Film Mandiri (Standalone Feature / Short Films)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFilms.map((film) => {
              const isPublished = film.publication_status === 'published';
              const isGate5Approved = film.master_approval_status === 'GATE_5_APPROVED';
              return (
                <div
                  key={film.id}
                  className="bg-[#101726] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 hover:border-slate-700 transition-colors"
                >
                  <img
                    src={film.poster_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=450&fit=crop'}
                    alt={film.title}
                    className="w-full sm:w-28 h-40 rounded-xl object-cover shrink-0 border border-slate-800 shadow-md"
                  />
                  <div className="space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
                          {film.aspect_ratio} Cinema Cut
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isPublished
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {film.publication_status.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">{film.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{film.synopsis}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-500 font-mono">
                        <span>Durasi: {Math.floor(film.runtime_seconds / 60)} menit</span>
                        <span>•</span>
                        <span className="text-amber-300">PPV Tiket: Rp {film.ppv_price_idr.toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-mono ${isGate5Approved ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isGate5Approved ? '✓ Gate 5 Master Siap' : '⚠ Belum Ada Master'}
                      </span>
                      <button
                        onClick={() => handleToggleFilmPublication(film.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                          isPublished
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {isPublished ? 'PUBLISHED' : 'TERBITKAN'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: INTEGRASI MASTER PRODUKSI (GATE 5 LINKER) */}
      {activeCatalogTab === 'link_master' && (
        <div className="bg-[#101726] border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Tautkan Hasil Produksi AI Movie Factory ke Katalog OTT
            </span>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Pilih proyek produksi yang telah melewati persetujuan sutradara di Gate 5 (Final Master Export) untuk
              dijadikan sumber media episode serial atau film standalone tanpa menduplikasi file video.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
            {/* Step 1: Select Source Project */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                1. Pilih Proyek Produksi (Gate 5 Final Approved):
              </label>
              <select
                value={selectedProjectForLink}
                onChange={(e) => setSelectedProjectForLink(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.director_approval_status === 'approved' ? 'Gate 5 APPROVED' : 'Draft'})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                Hanya proyek berstatus persetujuan Gate 5 yang memenuhi syarat validasi publikasi.
              </p>
            </div>

            {/* Step 2: Select Target Catalog Destination */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                2. Target Penempatan Katalog:
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTargetCatalogType('episode')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    targetCatalogType === 'episode'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  Episode Serial
                </button>
                <button
                  type="button"
                  onClick={() => setTargetCatalogType('film')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    targetCatalogType === 'film'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  Film Standalone
                </button>
              </div>

              {targetCatalogType === 'episode' && (
                <div className="pt-1">
                  <select
                    value={targetEpisodeId}
                    onChange={(e) => setTargetEpisodeId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {episodesList.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.title} (Ep. {ep.episode_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleExecuteMasterLink}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verifikasi & Tautkan Aset Master</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. TAB 4: PREVIEW ETALASE PUBLIK (STOREFRONT SIMULATION) */}
      {activeCatalogTab === 'preview_portal' && (
        <div className="space-y-6">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span>
                <strong>Pratinjau Etalase Penonton:</strong> Menampilkan hanya konten yang berstatus <code className="text-white font-mono">PUBLISHED</code>. Konten draf tidak akan terlihat oleh publik.
              </span>
            </div>
            <span className="text-[10px] font-mono bg-indigo-500/20 px-2 py-0.5 rounded">
              PUBLIC VIEWPORT
            </span>
          </div>

          {/* Hero Carousel Preview */}
          <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-end p-6">
            <img
              src="https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1600&h=800&fit=crop"
              alt="Hero Preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            
            <div className="relative z-10 space-y-2 max-w-xl">
              <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-wider uppercase bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                SERIAL TERPOPULER
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Chronicles of Neo-Jakarta
              </h2>
              <p className="text-xs text-slate-300 line-clamp-2">
                Penyelidikan detektif sibernetik memburu hacker AI di Jakarta tahun 2088. Tonton episode pertama gratis!
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => {
                    const ep1 = episodesList.find((e) => e.series_id === 'ser-cyber-01' && e.episode_number === 1);
                    handleLaunchPlayback(
                      ep1?.id || 'ep-cyber-01-s1e1',
                      'episode',
                      ep1?.title || 'Chronicles of Neo-Jakarta: Episode 1',
                      ep1?.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
                      '16:9'
                    );
                  }}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 hover:bg-emerald-400 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tonton Ep 1 (Gratis)</span>
                </button>
                <button className="px-4 py-2 bg-slate-900/80 text-white font-bold rounded-xl text-xs border border-slate-700 hover:bg-slate-800 cursor-pointer">
                  <span>Lihat Seluruh Episode</span>
                </button>
              </div>
            </div>
          </div>

          {/* Public Trays */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Film className="w-4 h-4 text-emerald-400" />
              <span>Katalog Film & Serial Siap Tonton</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {projectPublicCatalogItems(seriesList).map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    const firstEp = episodesList.find((e) => e.series_id === s.id);
                    handleLaunchPlayback(
                      firstEp?.id || s.id,
                      'episode',
                      s.title,
                      s.poster_url,
                      s.content_format === 'short_form_vertical_9_16' ? '9:16' : '16:9'
                    );
                  }}
                  className="group relative rounded-xl overflow-hidden border border-slate-800 bg-[#101726] cursor-pointer hover:border-emerald-500/50 transition-colors"
                >
                  <img
                    src={s.poster_url}
                    alt={s.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-2.5 space-y-1">
                    <span className="text-[9px] font-mono text-emerald-400 block font-bold">
                      {s.content_format === 'short_form_vertical_9_16' ? '9:16 Drama' : '16:9'}
                    </span>
                    <h5 className="text-xs font-bold text-white truncate">{s.title}</h5>
                    <p className="text-[10px] text-slate-400 truncate">{s.genres.join(', ')}</p>
                  </div>
                </div>
              ))}

              {projectPublicCatalogItems(filmsList).map((f) => (
                <div
                  key={f.id}
                  onClick={() => {
                    handleLaunchPlayback(
                      f.id,
                      'film',
                      f.title,
                      f.poster_url,
                      '16:9'
                    );
                  }}
                  className="group relative rounded-xl overflow-hidden border border-slate-800 bg-[#101726] cursor-pointer hover:border-amber-500/50 transition-colors"
                >
                  <img
                    src={f.poster_url}
                    alt={f.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-2.5 space-y-1">
                    <span className="text-[9px] font-mono text-amber-400 block font-bold">
                      PPV Rp {f.ppv_price_idr.toLocaleString('id-ID')}
                    </span>
                    <h5 className="text-xs font-bold text-white truncate">{f.title}</h5>
                    <p className="text-[10px] text-slate-400 truncate">{f.genres.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 5: MONETISASI & TRANSAKSI OTT (Milestone 2.9.3) */}
      {activeCatalogTab === 'commerce' && (
        <div className="space-y-6">
          {/* Header & Verification Indicator */}
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {commerceSummary.data_mode}
                </span>
                <span className="text-xs text-slate-400">Pemisahan Mutlak dari Saldo SaaS Kreator</span>
              </div>
              <h3 className="text-base font-bold text-white">Laporan Keuangan & Penjualan Tiket OTT</h3>
              <p className="text-xs text-slate-400">
                Pencatatan real-time penjualan tiket pay-per-view (TVOD) dan langganan bulanan channel (SVOD).
              </p>
            </div>
            <button
              onClick={loadCommerceData}
              disabled={isLoadingCommerce}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <span>{isLoadingCommerce ? 'Memperbarui...' : 'Segarkan Data'}</span>
            </button>
          </div>

          {/* Revenue Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">Total Gross Penjualan</span>
              <span className="text-xl font-bold font-mono text-white">
                Rp {commerceSummary.gross_revenue_idr.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-slate-500 block">Seluruh order terbayar</span>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">Biaya Gateway (Midtrans/QRIS)</span>
              <span className="text-xl font-bold font-mono text-slate-300">
                Rp {commerceSummary.gateway_fees_idr.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-slate-500 block">~0.7% MDR standar transaksi</span>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">Biaya Platform AMF (10%)</span>
              <span className="text-xl font-bold font-mono text-slate-300">
                Rp {commerceSummary.platform_fees_idr.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-slate-500 block">Infrastruktur & Delivery CDN</span>
            </div>

            <div className="p-4 bg-slate-900/90 border border-emerald-500/30 rounded-xl space-y-1 bg-emerald-500/5">
              <span className="text-[11px] font-medium text-emerald-400 block">Pendapatan Bersih Kreator</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                Rp {commerceSummary.net_creator_earnings_idr.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-emerald-500/70 block">100% Hak pencairan kreator</span>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Pesanan Berhasil</p>
                <p className="text-lg font-bold font-mono text-white">{commerceSummary.settled_orders_count}</p>
              </div>
              <DollarSign className="w-6 h-6 text-indigo-400 opacity-60" />
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Tiket PPV Terjual</p>
                <p className="text-lg font-bold font-mono text-white">{commerceSummary.ppv_tickets_sold_count}</p>
              </div>
              <Film className="w-6 h-6 text-amber-400 opacity-60" />
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Pelanggan Aktif (SVOD)</p>
                <p className="text-lg font-bold font-mono text-white">{commerceSummary.active_subscribers_count}</p>
              </div>
              <Users className="w-6 h-6 text-emerald-400 opacity-60" />
            </div>
          </div>

          {/* Pricing Policy & Test Sandbox Checkout */}
          <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white">Konfigurasi Tarif & Sandbox Checkout Tester</h4>
                <p className="text-xs text-slate-400">
                  Uji langsung pengalaman checkout penonton menggunakan QRIS / Sandbox simulator.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const firstFilm = filmsList[0];
                    setTestCheckout({
                      isOpen: true,
                      title: firstFilm?.title || 'Film Standalone',
                      priceIdr: firstFilm?.ppv_price_idr || 15000,
                      contentId: firstFilm?.id,
                      contentType: 'film',
                      orderType: 'ppv_single',
                    });
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Uji Checkout Tiket Film (PPV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTestCheckout({
                      isOpen: true,
                      title: `Langganan Channel: ${channel.name}`,
                      priceIdr: channel.subscription_price_idr || 39000,
                      channelId: channel.id,
                      orderType: 'svod_channel',
                    } as any);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Uji Checkout Langganan (SVOD)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Transactions Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Riwayat Transaksi Penonton ({recentOrders.length})
              </h4>
              <span className="text-[11px] text-slate-500">Live Supabase ott_payment_orders</span>
            </div>

            {recentOrders.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <DollarSign className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">Belum ada transaksi di channel ini.</p>
                <p className="text-[11px] text-slate-500">
                  Gunakan tombol uji checkout di atas untuk melakukan simulasi transaksi pertama.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">No. Pesanan</th>
                      <th className="py-2.5 px-4">Item / Tayangan</th>
                      <th className="py-2.5 px-4">Tipe</th>
                      <th className="py-2.5 px-4">Nominal</th>
                      <th className="py-2.5 px-4">Net Kreator</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4 font-mono font-medium text-white">{ord.order_number}</td>
                        <td className="py-2.5 px-4 text-slate-300 font-semibold">{ord.title}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                            {ord.order_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-white">
                          Rp {Number(ord.gross_amount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">
                          Rp {Number(ord.net_creator_amount).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              ord.status === 'settlement' || ord.status === 'capture'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : ord.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-[11px] font-mono">
                          {new Date(ord.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
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

      {/* Standalone Test Checkout Modal */}
      <OttCheckoutModal
        isOpen={testCheckout.isOpen}
        onClose={() => setTestCheckout((prev) => ({ ...prev, isOpen: false }))}
        channelId={channel.id}
        orderType={testCheckout.orderType}
        contentId={testCheckout.contentId}
        contentType={testCheckout.contentType}
        title={testCheckout.title}
        priceIdr={testCheckout.priceIdr}
        onPaymentSuccess={() => {
          loadCommerceData();
          if (onShowToast) {
            onShowToast('Transaksi berhasil dan hak akses aktif secara instan!', 'success');
          }
        }}
      />

      {/* Player Modal */}
      <OttPlayerModal
        isOpen={playerModal.isOpen}
        onClose={() => setPlayerModal((prev) => ({ ...prev, isOpen: false }))}
        contentId={playerModal.contentId}
        contentType={playerModal.contentType}
        channelId={playerModal.channelId}
        grantToken={playerModal.grantToken}
        title={playerModal.title}
        posterUrl={playerModal.posterUrl}
        aspectRatio={playerModal.aspectRatio}
      />
    </div>
  );
};
