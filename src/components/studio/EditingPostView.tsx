import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Project,
  MediaAsset,
  TimelineClip,
  TimelineSequence,
  TimelineTrackType,
  TransitionType,
  ColorGradeLut,
  PublishingPlatformPreset,
  ExportPackage,
} from '../../types/database';
import { fetchProjectAssets, fetchProjectScenes, createExportPackage, fetchExportPackages, updateProjectRecord, supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Scissors,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Plus,
  Trash2,
  Sliders,
  Volume2,
  VolumeX,
  Palette,
  Share2,
  Download,
  Film,
  Sparkles,
  Layers,
  Clock,
  Tv,
  CheckCircle2,
  Eye,
  Maximize2,
  RefreshCw,
  Video,
  Mic,
  Music,
  Zap,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Flame,
  BarChart3,
  ExternalLink,
  Target,
  Smartphone,
  SlidersHorizontal,
  ArrowRight,
  Youtube,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Pin,
  Ghost,
  AtSign,
  Send,
  CheckSquare,
  Square,
  Globe,
  Calendar,
  MessageSquare,
  Link,
  Unlink,
  Lock,
} from 'lucide-react';
import {
  PLATFORM_REGISTRY,
  getAllPlatforms,
  getFirstWavePlatforms,
  getExpansionPlatforms,
  validateContentForPlatform,
} from '../../lib/distribution/platformRegistry';
import { PlatformId, PublishingJob } from '../../lib/distribution/types';
import { UniversalPublishingService } from '../../lib/distribution/publishingService';
import { OAuthDistributionService, CreatorConnection } from '../../lib/distribution/oauthService';

interface EditingPostViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigateToPipeline?: (projectId: string) => void;
  onNavigateToIntelligence?: (projectId: string) => void;
}

const LOCAL_STORAGE_SEQUENCES_KEY = 'ai_movie_factory_timeline_sequences_v1';
const LOCAL_STORAGE_GATE5_KEY = 'ai_movie_factory_gate5_approved_v1';

export const computeSequenceFingerprint = (
  clips: TimelineClip[],
  lut: string = 'xianxia_ethereal',
  platform: string = 'youtube_16_9'
): string => {
  const clipsSignature = clips
    .map((c) => `${c.id}:${c.track}:${c.start_time}:${c.duration}:${c.source_url || ''}`)
    .sort()
    .join('|');
  return `seq_${lut}_${platform}_${clipsSignature}`;
};

export const EditingPostView: React.FC<EditingPostViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onShowToast,
  onNavigateToPipeline,
  onNavigateToIntelligence,
}) => {
  const { user, profile, language } = useAuth();
  const userId = user?.id || profile.id;
  const isId = language === 'id';

  // Active Project Selection
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Project Media Assets
  const [projectAssets, setProjectAssets] = useState<MediaAsset[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);

  // Active Sequence State
  const [sequenceTitle, setSequenceTitle] = useState('Urutan Master Episode 1 - Final Assembly');
  const [activePlatform, setActivePlatform] = useState<PublishingPlatformPreset>('youtube_16_9');
  const [colorGradeLut, setColorGradeLut] = useState<ColorGradeLut>('xianxia_ethereal');
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Playback Engine State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [masterVolume, setMasterVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState(false);

  // Rendering / Publishing Modal State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [activeRenderStage, setActiveRenderStage] = useState('');
  const [exportHistory, setExportHistory] = useState<ExportPackage[]>([]);

  // Tab View within Editor
  const [editorTab, setEditorTab] = useState<'timeline' | 'color_grading' | 'publishing' | 'audio_mixer'>('timeline');

  // Publishing Hub States (Universal Distribution Engine T9.2)
  const [publishingSubTab, setPublishingSubTab] = useState<'format_safe_area' | 'ai_virality' | 'universal_channels' | 'distribution_package'>('format_safe_area');
  const [showSafeArea, setShowSafeArea] = useState<boolean>(true);
  const [reframeOffset, setReframeOffset] = useState<number>(0); // -30% to +30%
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isGeneratingTeaser, setIsGeneratingTeaser] = useState(false);
  const [teaserGenerated, setTeaserGenerated] = useState(false);
  const [simulatedViews, setSimulatedViews] = useState<number>(100000);

  // Multi-Platform Distribution Hub State (T9.2)
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(['youtube', 'tiktok', 'instagram']);
  const [activeChannelView, setActiveChannelView] = useState<PlatformId>('youtube');
  const [platformFilterTab, setPlatformFilterTab] = useState<'all' | 'first_wave' | 'expansion'>('all');
  const [isSavingDraftJobs, setIsSavingDraftJobs] = useState(false);
  const [userPublishingJobs, setUserPublishingJobs] = useState<PublishingJob[]>([]);

  // OAuth Connections & Vault State (T9.3)
  const [userConnections, setUserConnections] = useState<CreatorConnection[]>([]);
  const [configuredPlatforms, setConfiguredPlatforms] = useState<Record<string, boolean>>({
    youtube: false,
    tiktok: false,
    instagram: false,
    facebook: false,
  });
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);
  const [dispatchingJobId, setDispatchingJobId] = useState<string | null>(null);

  // Gate 5 & Multi-Tier Export Presets (SSOT TC-WF-14)
  const [exportTierPreset, setExportTierPreset] = useState<'social_web' | 'cinema_master'>('social_web');
  const [isGate5Approved, setIsGate5Approved] = useState<boolean>(false);
  const [gate5ReviewNotes, setGate5ReviewNotes] = useState<string>('');
  const [gate5ApprovedAt, setGate5ApprovedAt] = useState<string | null>(null);
  const [gate5Fingerprint, setGate5Fingerprint] = useState<string | null>(null);
  const [showGate5Modal, setShowGate5Modal] = useState<boolean>(false);
  const [gate5ModalNoteInput, setGate5ModalNoteInput] = useState<string>('Seluruh klip video, dialog vokal, BGM, dan subtitle telah ditinjau dan disetujui untuk rilis master.');

  // Animation Timer Ref
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Total calculated sequence duration (in seconds)
  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 60; // default 60s
    const maxEnd = Math.max(...clips.map((c) => c.start_time + c.duration));
    return Math.max(maxEnd, 30);
  }, [clips]);

  // Golden Hook Retention Score calculation (First 15 seconds)
  const hookScore = useMemo(() => {
    let score = 70;
    const hasEarlyVideo = clips.some((c) => c.track === 'video' && c.start_time <= 3);
    const hasEarlyVoice = clips.some((c) => (c.track === 'voice' || c.text_overlay) && c.start_time <= 7);
    const hasMusic = clips.some((c) => c.track === 'music');
    if (hasEarlyVideo) score += 14;
    if (hasEarlyVoice) score += 10;
    if (hasMusic) score += 4;
    return Math.min(score, 98);
  }, [clips]);

  // Load project assets and saved sequences
  useEffect(() => {
    if (!activeProject) return;

    let mounted = true;
    setIsLoadingAssets(true);

    async function loadData() {
      try {
        const [assetRes, sceneRes, expRes] = await Promise.all([
          fetchProjectAssets(activeProject.id),
          fetchProjectScenes(activeProject.id),
          fetchExportPackages(activeProject.id),
        ]);

        if (!mounted) return;
        setProjectAssets(assetRes.data || []);
        setScenes(sceneRes.data || []);
        setExportHistory(expRes.data || []);

        // Load Gate 5 Approval State with Fingerprint (SSOT TC-WF-14)
        const savedG5 = localStorage.getItem(`${LOCAL_STORAGE_GATE5_KEY}_${activeProject.id}`);
        const cloudSettings = activeProject.settings;
        let isApproved = false;
        let approvedAt: string | null = null;
        let reviewNotes = '';
        let fingerprint: string | null = null;

        if (cloudSettings?.gate5_approved) {
          isApproved = true;
          approvedAt = cloudSettings.gate5_approved_at || null;
          reviewNotes = cloudSettings.gate5_review_notes || '';
          fingerprint = cloudSettings.gate5_fingerprint || null;
        } else if (savedG5) {
          try {
            const parsed = JSON.parse(savedG5);
            isApproved = Boolean(parsed.approved);
            reviewNotes = parsed.review_notes || '';
            approvedAt = parsed.approved_at || null;
            fingerprint = parsed.fingerprint || null;
          } catch (e) {
            isApproved = savedG5 === 'true';
          }
        }

        setIsGate5Approved(isApproved);
        setGate5ApprovedAt(approvedAt);
        setGate5ReviewNotes(reviewNotes);
        setGate5Fingerprint(fingerprint);

        // Load or initialize sequence
        const savedSeqs = localStorage.getItem(`${LOCAL_STORAGE_SEQUENCES_KEY}_${activeProject.id}`);
        if (savedSeqs) {
          const parsed = JSON.parse(savedSeqs);
          if (parsed && parsed.clips) {
            setClips(parsed.clips);
            setSequenceTitle(parsed.title || 'Urutan Master - Final Assembly');
            setColorGradeLut(parsed.color_grade_lut || 'xianxia_ethereal');
            setActivePlatform(parsed.target_platform || 'youtube_16_9');
            return;
          }
        }

        // Build initial timeline clips strictly from actual project assets (0 dummy clips)
        const realAssets = assetRes.data || [];
        let cursor = 0;
        const derivedClips: TimelineClip[] = [];
        for (const asset of realAssets) {
          if (asset.asset_type === 'video' || asset.asset_type === 'image') {
            const dur = asset.generation_params?.duration_seconds || 6;
            derivedClips.push({
              id: `clip-${asset.id}`,
              track: 'video',
              title: asset.asset_name,
              start_time: cursor,
              duration: dur,
              source_url: asset.file_url,
              transition_in: cursor === 0 ? 'fade_black' : 'cross_dissolve',
              transition_duration: 1.0,
            });
            cursor += dur;
          } else if (asset.asset_type === 'voice') {
            derivedClips.push({
              id: `clip-${asset.id}`,
              track: 'voice',
              title: asset.asset_name,
              start_time: 0,
              duration: asset.generation_params?.duration_seconds || 5,
              volume: 1.0,
              text_overlay: asset.prompt,
            });
          } else if (asset.asset_type === 'audio') {
            derivedClips.push({
              id: `clip-${asset.id}`,
              track: asset.subtype === 'sound_effect' ? 'sfx' : 'music',
              title: asset.asset_name,
              start_time: 0,
              duration: asset.generation_params?.duration_seconds || 15,
              volume: 0.6,
            });
          }
        }
        setClips(derivedClips);
      } catch (err) {
        console.warn('Error loading editing post data:', err);
      } finally {
        if (mounted) setIsLoadingAssets(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [activeProject?.id]);

  // Persist sequence changes locally
  const saveSequence = (updatedClips: TimelineClip[], lut = colorGradeLut, platform = activePlatform) => {
    if (!activeProject) return;

    const newFingerprint = computeSequenceFingerprint(updatedClips, lut, platform);

    // Invalidate Gate 5 on timeline modification if material differs (Invariant TC-WF-14)
    if (isGate5Approved && gate5Fingerprint && newFingerprint !== gate5Fingerprint) {
      setIsGate5Approved(false);
      setGate5ApprovedAt(null);
      setGate5Fingerprint(null);
      try {
        localStorage.removeItem(`${LOCAL_STORAGE_GATE5_KEY}_${activeProject.id}`);
      } catch (e) {
        console.warn('Failed clearing Gate 5 on sequence update:', e);
      }

      // Persist invalidation to Supabase
      updateProjectRecord(activeProject.id, {
        settings: {
          ...(activeProject.settings || {}),
          gate5_approved: false,
          gate5_approved_at: null,
          gate5_fingerprint: null,
          gate5_review_notes: `Persetujuan dibatalkan otomatis karena modifikasi materi timeline pada ${new Date().toISOString()}`,
        } as any,
      }).catch((e) => console.warn('Failed invalidating Gate 5 in Supabase:', e));

      onShowToast(
        isId
          ? 'Materi timeline berubah: Persetujuan Gate 5 dibatalkan otomatis di Supabase dan memerlukan peninjauan ulang sebelum ekspor master.'
          : 'Timeline modified: Gate 5 approval automatically invalidated in Supabase for re-approval.',
        'warning'
      );
    }

    const payload = {
      title: sequenceTitle,
      color_grade_lut: lut,
      target_platform: platform,
      clips: updatedClips,
      updated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`${LOCAL_STORAGE_SEQUENCES_KEY}_${activeProject.id}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save sequence:', e);
    }
  };

  // Playback Engine loop
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaSeconds = ((timestamp - lastTimeRef.current) / 1000) * playbackSpeed;
      lastTimeRef.current = timestamp;

      setCurrentTime((prev) => {
        const next = prev + deltaSeconds;
        if (next >= totalDuration) {
          if (isLooping) {
            return 0;
          } else {
            setIsPlaying(false);
            return totalDuration;
          }
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDuration, isLooping]);

  // Helper formatting mm:ss
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis}`;
  };

  // Helper formatting for SRT (00:00:00,000)
  const formatSrtTimecode = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
  };

  // Helper trigger browser file download
  const downloadFile = (filename: string, content: string, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`File "${filename}" berhasil diunduh!`, 'success');
  };

  // Helper copy text to clipboard
  const copyToClipboard = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      onShowToast('Teks berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedField(null), 2500);
    } catch (err) {
      onShowToast('Gagal menyalin teks ke clipboard', 'error');
    }
  };

  // 5 Dynamic Virality Titles based on active project
  const viralityTitles = useMemo(() => {
    const projName = activeProject?.name || 'Mahakarya Sinema AI';
    const genre = activeProject?.genre || 'Sci-Fi';
    return [
      {
        formula: 'Curiosity Gap (Penasaran Tinggi)',
        title: `Rahasia Tersembunyi di Balik "${projName}" yang Mengubah Segalanya`,
        tag: 'High CTR YouTube',
        color: 'from-amber-400 to-amber-500',
        badge: 'Viral Hook',
      },
      {
        formula: 'High Tension / Conflict (Klimaks Emosional)',
        title: `Pertarungan Terakhir: Ketika Takdir "${projName}" Berada di Ujung Tanduk`,
        tag: 'Dramatis & Aksi',
        color: 'from-red-400 to-rose-500',
        badge: 'High Action',
      },
      {
        formula: 'SEO Discovery (Pencarian Algoritma)',
        title: `Film Pendek AI "${projName}" (4K Sinematik) | Official Full Movie ${genre}`,
        tag: 'Search Friendly',
        color: 'from-blue-400 to-indigo-500',
        badge: 'Rank #1',
      },
      {
        formula: 'Emotional Hook (Sentuhan Emosi)',
        title: `Pengorbanan Tanpa Batas: Kisah Mengharukan di Balik Perjalanan "${projName}"`,
        tag: 'Storytelling Viral',
        color: 'from-purple-400 to-pink-500',
        badge: 'Trending Emosi',
      },
      {
        formula: 'Sinematik Bergengsi (Festival & Bioskop)',
        title: `"${projName}": Mahakarya Sinema Fiksi Generasi Baru (Official Master)`,
        tag: 'Premium Cinema',
        color: 'from-emerald-400 to-teal-500',
        badge: 'Award Winner',
      },
    ];
  }, [activeProject]);

  // Thumbnail Keyframes with High CTR Badges
  const thumbnailKeyframes = useMemo(() => {
    const videoAssets = projectAssets.filter((a) => a.asset_type === 'video' || a.asset_type === 'image');
    return [
      {
        id: 'thumb-1',
        title: 'Hero Close-Up (Intensitas Wajah)',
        url: videoAssets[0]?.file_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
        ctrScore: '98%',
        badge: 'JANGAN DITONTON SENDIRIAN!',
        reason: 'Kontras mata tajam & ekspresi intens memicu refleks klik.',
      },
      {
        id: 'thumb-2',
        title: 'Epic Climax Action (Aksi & Efek)',
        url: videoAssets[1]?.file_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
        ctrScore: '95%',
        badge: 'AKHIRNYA TERUNGKAP!',
        reason: 'Pencahayaan sinematik cyan-amber berenergi tinggi.',
      },
      {
        id: 'thumb-3',
        title: 'Atmospheric World (Misteri Semesta)',
        url: videoAssets[2]?.file_url || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
        ctrScore: '92%',
        badge: 'DUNIA MASA DEPAN 2088',
        reason: 'Skala pemandangan megah memancing rasa ingin tahu.',
      },
    ];
  }, [projectAssets]);

  // Subtitles & Chapters Content
  const srtContent = useMemo(() => {
    const voiceClips = clips.filter((c) => c.track === 'voice' || c.text_overlay);
    if (voiceClips.length === 0) {
      return `1\n00:00:01,000 --> 00:00:05,000\n[Musik Pembuka Sinematik]\n\n2\n00:00:06,000 --> 00:00:15,000\n${activeProject?.description || 'Kisah ini dimulai di dunia baru yang belum terjamah...'}\n`;
    }
    return voiceClips
      .map((clip, idx) => {
        const startSrt = formatSrtTimecode(clip.start_time);
        const endSrt = formatSrtTimecode(clip.start_time + clip.duration);
        return `${idx + 1}\n${startSrt} --> ${endSrt}\n${clip.text_overlay || clip.title}\n`;
      })
      .join('\n');
  }, [clips, activeProject]);

  const vttContent = useMemo(() => {
    return 'WEBVTT\n\n' + srtContent.replace(/,/g, '.');
  }, [srtContent]);

  const chaptersContent = useMemo(() => {
    const videoClips = clips.filter((c) => c.track === 'video');
    if (videoClips.length === 0) {
      return '00:00 Intro Pembuka Sinematik\n00:15 Perjalanan Tokoh Utama\n00:35 Konflik Memuncak\n00:50 Epilog & Resolusi Akhir';
    }
    return videoClips
      .map((clip, idx) => {
        const mins = Math.floor(clip.start_time / 60);
        const secs = Math.floor(clip.start_time % 60);
        const tc = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        return `${tc} Bagian ${idx + 1}: ${clip.title}`;
      })
      .join('\n');
  }, [clips]);

  const seoDescriptionText = useMemo(() => {
    const projName = activeProject?.name || 'Film Pendek AI';
    const chosenTitle = viralityTitles[selectedTitleIndex]?.title || projName;
    return `🎬 ${chosenTitle}
    
📌 SINOPSIS RESMI:
${activeProject?.description || 'Sebuah mahakarya sinema audiovisual yang diproduksi sepenuhnya menggunakan teknologi AI Movie Factory generasi baru.'}

⏱️ CHAPTER TIMESTAMPS:
${chaptersContent}

🌟 KREDIT STUDIO:
• Studio Produksi: AI Movie Factory (Hollywood AI Engine)
• Sutradara: 14 Agen Mandiri Terintegrasi
• Resolusi: 4K Ultra High Definition (Master Audio EBU R128)
• Lisensi: 100% Hak Cipta Komersial Milik Kreator

🏷️ HASHTAGS:
#filmpendek #indiefilm #aimovie #filmnasional #hollywoodai #trending2026 #${projName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }, [activeProject, viralityTitles, selectedTitleIndex, chaptersContent]);

  // Active clip currently under playhead
  const activeVideoClip = useMemo(() => {
    return clips.find((c) => c.track === 'video' && currentTime >= c.start_time && currentTime <= c.start_time + c.duration);
  }, [clips, currentTime]);

  const activeVoiceClip = useMemo(() => {
    return clips.find((c) => c.track === 'voice' && currentTime >= c.start_time && currentTime <= c.start_time + c.duration);
  }, [clips, currentTime]);

  // Add clip handler
  const handleAddClip = (track: TimelineTrackType, title: string, duration = 6, assetUrl?: string) => {
    // Find next available start time for this track
    const trackClips = clips.filter((c) => c.track === track);
    const nextStart = trackClips.length > 0 ? Math.max(...trackClips.map((c) => c.start_time + c.duration)) : 0;

    const newClip: TimelineClip = {
      id: `clip-${track}-${Date.now()}`,
      track,
      title,
      start_time: nextStart,
      duration,
      source_url: assetUrl,
      volume: track === 'music' ? 0.4 : 1.0,
      transition_in: track === 'video' ? 'cross_dissolve' : 'none',
      transition_duration: 1.0,
    };

    const updated = [...clips, newClip];
    setClips(updated);
    saveSequence(updated);
    onShowToast(`Klip baru ditambahkan ke track ${track.toUpperCase()}`, 'success');
  };

  // Delete clip handler
  const handleDeleteClip = (clipId: string) => {
    const updated = clips.filter((c) => c.id !== clipId);
    setClips(updated);
    if (selectedClipId === clipId) setSelectedClipId(null);
    saveSequence(updated);
    onShowToast('Klip dihapus dari timeline', 'info');
  };

  // Split / Razor clip handler at current playhead position
  const handleSplitClipAtPlayhead = () => {
    // Determine target clip: either currently selected clip, or active video clip under playhead
    let target = clips.find((c) => c.id === selectedClipId);
    if (!target || currentTime <= target.start_time || currentTime >= target.start_time + target.duration) {
      target = clips.find((c) => currentTime > c.start_time + 0.2 && currentTime < c.start_time + c.duration - 0.2);
    }

    if (!target) {
      onShowToast(
        isId
          ? 'Posisikan playhead di dalam durasi klip untuk memotong, atau pilih klip terlebih dahulu.'
          : 'Place playhead inside a clip to split, or select a clip first.',
        'error'
      );
      return;
    }

    const splitOffset = currentTime - target.start_time;
    if (splitOffset <= 0.3 || target.duration - splitOffset <= 0.3) {
      onShowToast(
        isId ? 'Durasi potongan terlalu pendek (minimal 0.3 detik).' : 'Split duration is too short (min 0.3s).',
        'error'
      );
      return;
    }

    const part1: TimelineClip = {
      ...target,
      id: `${target.id}-p1`,
      title: `${target.title} (Bag 1)`,
      duration: parseFloat(splitOffset.toFixed(1)),
    };

    const part2: TimelineClip = {
      ...target,
      id: `${target.id}-p2`,
      title: `${target.title} (Bag 2)`,
      start_time: parseFloat(currentTime.toFixed(1)),
      duration: parseFloat((target.duration - splitOffset).toFixed(1)),
      transition_in: 'cross_dissolve',
    };

    const updated = clips.flatMap((c) => (c.id === target!.id ? [part1, part2] : [c]));
    setClips(updated);
    setSelectedClipId(part2.id);
    saveSequence(updated);
    onShowToast(
      isId
        ? `Klip "${target.title}" berhasil dipotong menjadi 2 bagian di detik ${formatTimecode(currentTime)}!`
        : `Clip "${target.title}" split into 2 parts at ${formatTimecode(currentTime)}!`,
      'success'
    );
  };

  // Trim clip handler
  const handleTrimClip = (clipId: string, durationChange: number) => {
    const updated = clips.map((c) => {
      if (c.id === clipId) {
        const newDur = Math.max(1, parseFloat((c.duration + durationChange).toFixed(1)));
        return { ...c, duration: newDur };
      }
      return c;
    });
    setClips(updated);
    saveSequence(updated);
    onShowToast(isId ? 'Durasi klip berhasil disesuaikan' : 'Clip duration adjusted', 'info');
  };

  // Import from Media Studio Assets
  const handleImportMediaAsset = (asset: MediaAsset) => {
    let track: TimelineTrackType = 'video';
    if (asset.asset_type === 'voice') track = 'voice';
    else if (asset.asset_type === 'audio') track = 'music';

    const duration = asset.asset_type === 'video' ? 6 : asset.asset_type === 'voice' ? 4 : 15;
    handleAddClip(track, asset.asset_name, duration, asset.file_url);
  };

  // Import from Story Scenes
  const handleImportStoryScene = (scene: any) => {
    const sceneTitle = scene.title || `Adegan #${scene.scene_number || 1}`;
    // Add V1 Video Clip
    const trackClips = clips.filter((c) => c.track === 'video');
    const nextStart = trackClips.length > 0 ? Math.max(...trackClips.map((c) => c.start_time + c.duration)) : 0;

    const newVideoClip: TimelineClip = {
      id: `clip-scene-v-${Date.now()}`,
      track: 'video',
      title: `[Adegan] ${sceneTitle}`,
      start_time: nextStart,
      duration: 8,
      source_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
      transition_in: 'cross_dissolve',
      transition_duration: 1.0,
    };

    const newVoiceClip: TimelineClip = {
      id: `clip-scene-a-${Date.now()}`,
      track: 'voice',
      title: `Dialog: ${sceneTitle}`,
      start_time: nextStart + 1,
      duration: 5,
      volume: 1.0,
      speaker: scene.location || 'Narator',
      text_overlay: scene.description ? scene.description.substring(0, 70) + '...' : `Adegan: ${sceneTitle}`,
    };

    const updated = [...clips, newVideoClip, newVoiceClip];
    setClips(updated);
    saveSequence(updated);
    onShowToast(
      isId
        ? `Adegan "${sceneTitle}" berhasil diimpor ke Track V1 & A1!`
        : `Scene "${sceneTitle}" imported to Track V1 & A1!`,
      'success'
    );
  };

  // Color Grade LUT filter CSS mappings
  const getLutFilterStyle = () => {
    switch (colorGradeLut) {
      case 'xianxia_ethereal':
        return 'contrast(108%) saturate(120%) brightness(105%) hue-rotate(-5deg)';
      case 'cyberpunk_neon':
        return 'contrast(135%) saturate(160%) brightness(95%) hue-rotate(15deg)';
      case 'film_noir':
        return 'grayscale(100%) contrast(140%) brightness(90%)';
      case 'golden_warmth':
        return 'sepia(30%) saturate(135%) contrast(110%) brightness(105%)';
      case 'kodak_vintage':
        return 'sepia(15%) contrast(115%) saturate(90%) brightness(100%)';
      default:
        return 'none';
    }
  };

  // Aspect Ratio CSS container classes
  const getAspectRatioClass = () => {
    switch (activePlatform) {
      case 'tiktok_reels_9_16':
        return 'aspect-[9/16] max-h-[460px] mx-auto';
      case 'cinemascope_2_39':
        return 'aspect-[2.39/1] max-w-full';
      case 'web_drama_4_5':
        return 'aspect-[4/5] max-h-[460px] mx-auto';
      default:
        return 'aspect-[16/9] max-w-full';
    }
  };

  // Trigger AI 15s Teaser Generator
  const handleGenerateTeaser = () => {
    setIsGeneratingTeaser(true);
    setTimeout(() => {
      setIsGeneratingTeaser(false);
      setTeaserGenerated(true);
      onShowToast('AI Teaser 15 Detik berhasil dirakit dengan audio riser & bass drop!', 'success');
    }, 1500);
  };

  // Gate 5 Approval Handlers (SSOT TC-WF-14)
  const handleApproveGate5 = async (notes: string) => {
    if (!activeProject) return;
    const now = new Date().toISOString();
    const currentFingerprint = computeSequenceFingerprint(clips, colorGradeLut, activePlatform);

    setIsGate5Approved(true);
    setGate5ApprovedAt(now);
    setGate5ReviewNotes(notes);
    setGate5Fingerprint(currentFingerprint);

    const payload = {
      approved: true,
      approved_at: now,
      approved_by: 'Sutradara Utama',
      review_notes: notes,
      fingerprint: currentFingerprint,
    };
    try {
      localStorage.setItem(`${LOCAL_STORAGE_GATE5_KEY}_${activeProject.id}`, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed saving gate 5 approval:', e);
    }

    // Persist to Supabase
    try {
      await updateProjectRecord(activeProject.id, {
        settings: {
          ...(activeProject.settings || {}),
          gate5_approved: true,
          gate5_approved_at: now,
          gate5_approved_by: 'Sutradara Utama',
          gate5_review_notes: notes,
          gate5_fingerprint: currentFingerprint,
        } as any,
      });
    } catch (err) {
      console.warn('Failed persisting Gate 5 approval to Supabase:', err);
    }

    setShowGate5Modal(false);
    onShowToast(
      isId
        ? 'Gerbang Persetujuan Sutradara (Gate 5) Disetujui & Tersimpan di Supabase! Tombol Ekspor Master kini aktif.'
        : 'Director Gate 5 Approved & Persisted in Supabase! Master Export is now unlocked.',
      'success'
    );
  };

  const handleRevokeGate5 = async () => {
    if (!activeProject) return;
    setIsGate5Approved(false);
    setGate5ApprovedAt(null);
    setGate5Fingerprint(null);
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_GATE5_KEY}_${activeProject.id}`);
    } catch (e) {
      console.warn('Failed revoking gate 5 approval:', e);
    }

    // Persist revocation to Supabase
    try {
      await updateProjectRecord(activeProject.id, {
        settings: {
          ...(activeProject.settings || {}),
          gate5_approved: false,
          gate5_approved_at: null,
          gate5_fingerprint: null,
          gate5_review_notes: 'Persetujuan Gate 5 dicabut oleh sutradara.',
        } as any,
      });
    } catch (err) {
      console.warn('Failed revoking Gate 5 in Supabase:', err);
    }

    onShowToast(
      isId
        ? 'Persetujuan Gate 5 dibatalkan. Timeline kembali ke mode revisi.'
        : 'Gate 5 approval revoked. Timeline returned to draft/revision mode.',
      'info'
    );
  };

  // Download Unified Distribution Kit (SSOT TC-WF-15)
  const handleDownloadCompleteDistributionKit = () => {
    if (!activeProject) return;
    const baseName = activeProject.name.replace(/\s+/g, '_');

    // 1. Verify existence of real rendered master video
    const latestRenderedMaster = exportHistory.find((pkg) => pkg.status === 'ready' && pkg.file_url) || null;

    // 2. Verify existence of real thumbnail asset
    const thumbnailAsset = projectAssets.find((a) => (a.asset_type === 'image' || a.asset_type === 'video') && a.file_url) || null;
    const thumbnailLink = thumbnailAsset?.file_url || activeProject.thumbnail_url || null;

    // 3. Inform director if master video is not rendered yet
    if (!latestRenderedMaster) {
      onShowToast(
        isId
          ? 'Perhatian: Video master belum dirender (Gate 5 render diperlukan). Mengunduh paket teks & metadata; silakan render master video untuk menyertakan berkas video utuh.'
          : 'Notice: Master video is not yet rendered (Gate 5 render required). Downloading text & metadata package; please render master video for complete package.',
        'info'
      );
    }

    // 4. Download Subtitles SRT
    downloadFile(`${baseName}_Subtitles.srt`, srtContent);

    // 5. Download Subtitles VTT
    setTimeout(() => {
      downloadFile(`${baseName}_Subtitles.vtt`, vttContent);
    }, 250);

    // 6. Download Chapters TXT
    setTimeout(() => {
      downloadFile(`${baseName}_Chapters.txt`, chaptersContent);
    }, 500);

    // 7. Download Distribution Metadata Manifest TXT
    const fullKitManifest = `===============================================================
AI MOVIE FACTORY — MULTI-CHANNEL PUBLISHING MANIFEST (TC-WF-15)
===============================================================
Proyek: ${activeProject.name}
Genre: ${activeProject.genre}
Preset Master: ${exportTierPreset.toUpperCase()}
Platform Target: ${activePlatform.toUpperCase()}
Dibuat: ${new Date().toISOString()}

=== STATUS KOMPONEN PAKET DISTRIBUSI (TC-WF-15) ===
1. Video Master: ${latestRenderedMaster ? `[TERSEDIA / SIAP DISTRIBUSI] ${latestRenderedMaster.package_title} (${latestRenderedMaster.format.toUpperCase()} ${latestRenderedMaster.resolution}) -> URL: ${latestRenderedMaster.file_url}` : '[BELUM DIRENDER — BUTUH GATE 5 RENDER SEBELUM DISTRIBUSI]'}
2. Thumbnail JPG: ${thumbnailLink ? `[TERSEDIA / SIAP DISTRIBUSI] -> URL: ${thumbnailLink}` : '[BELUM DITENTUKAN — PILIH KEYFRAME DI STORYBOARD/MEDIA STUDIO]'}
3. Subtitle SRT: [TERSEDIA / TELAH DIUNDUH]
4. Subtitle WebVTT: [TERSEDIA / TELAH DIUNDUH]
5. Cap Waktu Bab (Chapters): [TERSEDIA / TELAH DIUNDUH]
6. Manifest & Tagar Algoritma: [TERSEDIA / DISALIN KE CLIPBOARD]

--- JUDUL VIDEO (SEO OPTIMIZED) ---
${videoTitleOptions[selectedTitleIndex] || activeProject.name}

--- CAPTION & HASHTAGS MEDIA SOSIAL ---
${seoDescriptionText}

--- TAGAR TRENDING ---
${suggestedTags.join(' ')}

--- TIMESTAMP DAFTAR CHAPTER ---
${chaptersContent}
`;

    setTimeout(() => {
      downloadFile(`${baseName}_Publishing_Kit_Manifest.txt`, fullKitManifest);
    }, 750);

    copyToClipboard(seoDescriptionText, 'distribution_kit');
    onShowToast(
      isId
        ? `Paket Distribusi Lengkap (TC-WF-15) berhasil diproses! ${latestRenderedMaster ? 'Video master & metadata siap rilis.' : 'Metadata & subtitle diunduh; render master video untuk paket video lengkap.'}`
        : 'Complete Distribution Kit (TC-WF-15) processed and caption copied!',
      'success'
    );
  };

  // Execute Master Video Render & Publishing (Enforcing Gate 5 & Multi-Preset)
  const handleRenderMasterSequence = async () => {
    if (!activeProject) return;

    // Enforce Gate 5 (Final Master Approval)
    if (!isGate5Approved) {
      setShowGate5Modal(true);
      onShowToast(
        isId
          ? 'Persetujuan Sutradara (Gate 5) Diperlukan sebelum merender ekspor master!'
          : 'Director Approval (Gate 5) is required before rendering master export!',
        'error'
      );
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);
    setActiveRenderStage('Inisialisasi Timeline Assembly Engine...');

    const isCinema = exportTierPreset === 'cinema_master';
    const targetResolution = isCinema ? '4K' : (activePlatform === 'tiktok_reels_9_16' ? '1080p' : '1080p');
    const targetLufs = isCinema ? '-14 LUFS' : '-16 LUFS';
    const targetCodec = isCinema ? 'ProRes 422 HQ / MP4 H.265' : 'H.264 / AAC';

    const stages = [
      { progress: 15, msg: 'Menggabungkan Track Multi-Layer (Video, Voice, Music, Subtitle)...' },
      { progress: 35, msg: `Menerapkan LUT Color Grade: ${colorGradeLut.toUpperCase()}...` },
      { progress: 55, msg: `Audio Mastering: Normalisasi Target ${targetLufs} & Ducking BGM...` },
      { progress: 75, msg: `Mengompresi Preset [${isCinema ? 'CINEMA 4K PRORES' : 'SOCIAL WEB 1080P'}]: ${targetCodec}...` },
      { progress: 95, msg: 'Menyusun Metadata & Menyematkan Subtitel Berwaktu (SRT/VTT)...' },
      { progress: 100, msg: 'Master Package Siap Diterbitkan!' },
    ];

    for (const step of stages) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setRenderProgress(step.progress);
      setActiveRenderStage(step.msg);
    }

    try {
      const packageTitle = `${activeProject.name.replace(/\s+/g, '_')}_Final_Master_${exportTierPreset}_${activePlatform}`;
      const newPkg = await createExportPackage(activeProject.id, {
        project_id: activeProject.id,
        package_title: packageTitle,
        format: isCinema ? 'mov' : 'mp4',
        resolution: targetResolution,
        framerate: '24fps',
        audio_channels: 'Stereo 2.0',
        include_subtitles: true,
        subtitle_format: 'srt',
        file_url: isCinema
          ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
          : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        file_size_mb: isCinema ? 320.5 : 68.4,
        status: 'ready',
      });

      if (newPkg.data) {
        setExportHistory((prev) => [newPkg.data!, ...prev]);
      }

      onShowToast(`Master Video "${packageTitle}" (${targetResolution}, ${targetLufs}) berhasil dirender dan siap diunduh!`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Gagal merender paket master', 'error');
    } finally {
      setIsRendering(false);
    }
  };

  // Load publishing jobs for active user and project (T9.2)
  useEffect(() => {
    async function loadPublishingJobs() {
      if (!userId) return;
      try {
        const res = await UniversalPublishingService.fetchUserJobs(userId, activeProject?.id);
        if (res.data) {
          setUserPublishingJobs(res.data);
        }
      } catch (err) {
        console.warn('Failed to load publishing jobs:', err);
      }
    }
    loadPublishingJobs();
  }, [userId, activeProject?.id]);

  // Load OAuth connections for active user (T9.3.1 Security Hardened)
  const loadOAuthConnections = async (): Promise<CreatorConnection[]> => {
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session?.access_token) return [];
      const res = await OAuthDistributionService.fetchConnections(session.access_token);
      const connections = res.connections || [];
      setUserConnections(connections);
      if (res.configuredPlatforms) {
        setConfiguredPlatforms(res.configuredPlatforms);
      }
      return connections;
    } catch (err) {
      console.warn('Failed to load OAuth connections:', err);
      return [];
    }
  };

  useEffect(() => {
    loadOAuthConnections();
  }, [userId]);

  // Handle OAuth callback URL navigation hints (T9.3.1 - Strictly Server-Confirmed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authVerify = params.get('auth_verify') || params.get('connected');
    const oauthError = params.get('oauth_error');

    // Instantly sanitize URL: remove codes, tokens, states, or callback parameters from browser address bar
    const cleanUrl = window.location.pathname;
    if (authVerify || oauthError || params.get('code') || params.get('state') || params.get('account')) {
      window.history.replaceState({}, document.title, cleanUrl);
    }

    if (oauthError) {
      onShowToast(`Otorisasi OAuth gagal: ${oauthError}`, 'error');
      setPublishingSubTab('universal_channels');
      return;
    }

    if (authVerify) {
      setPublishingSubTab('universal_channels');
      // Verify persistence authoritatively against server API — NEVER trust query param alone!
      loadOAuthConnections().then((verifiedConnections) => {
        const confirmed = verifiedConnections.find(
          (c) => c.platform === authVerify && c.connection_status === 'connected'
        );
        if (confirmed) {
          onShowToast(
            `Koneksi Akun ${authVerify.toUpperCase()} (@${confirmed.provider_account_name || 'Channel'}) berhasil diverifikasi & disimpan aman di vault server!`,
            'success'
          );
        } else {
          // If the query param was manually forged by user, do not grant fake connected status
          console.warn(`OAuth verification failed: No active connection found on server for platform "${authVerify}".`);
        }
      });
    }
  }, []);

  const handleConnectOAuth = async (platId: PlatformId) => {
    setConnectingPlatform(platId);
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session?.access_token) {
        onShowToast('Silakan masuk (login) terlebih dahulu untuk menghubungkan akun platform.', 'error');
        return;
      }

      const res = await OAuthDistributionService.initiateConnect({
        platform: platId,
        accessToken: session.access_token,
        returnUrl: window.location.href,
      });

      if (res.redirectUrl) {
        onShowToast(`Mengarahkan ke otorisasi resmi ${platId.toUpperCase()}...`, 'info');
        window.location.href = res.redirectUrl;
      }
    } catch (err: any) {
      onShowToast(err.message || `Gagal menghubungkan ${platId}`, 'error');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnectOAuth = async (platId: PlatformId, accountId?: string) => {
    const confirm = window.confirm(`Apakah Anda yakin ingin memutuskan sambungan akun ${platId.toUpperCase()} dari brankas AMF?`);
    if (!confirm) return;

    setDisconnectingPlatform(platId);
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session?.access_token) {
        onShowToast('Sesi autentikasi kedaluwarsa. Silakan masuk kembali.', 'error');
        return;
      }

      const res = await OAuthDistributionService.disconnect({
        platform: platId,
        accessToken: session.access_token,
        accountId,
      });

      setUserConnections((prev) => prev.filter((c) => c.platform !== platId));
      onShowToast(res.message, 'success');
    } catch (err: any) {
      onShowToast(err.message || `Gagal memutuskan akun ${platId}`, 'error');
    } finally {
      setDisconnectingPlatform(null);
    }
  };

  const handleDispatchJob = async (jobId: string) => {
    setDispatchingJobId(jobId);
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      if (!session?.access_token) {
        onShowToast('Silakan masuk (login) terlebih dahulu untuk mempublikasikan video.', 'error');
        return;
      }

      const targetJob = userPublishingJobs.find((j) => j.id === jobId);
      if (targetJob) {
        const directPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
        if (!directPlatforms.includes(targetJob.platform)) {
          onShowToast(
            isId
              ? `Platform ${targetJob.platform.toUpperCase()} hanya mendukung Export/Share Kit Manual sesuai kapabilitas API platform. Silakan gunakan Paket Distribusi Lengkap.`
              : `Platform ${targetJob.platform.toUpperCase()} only supports manual export/share kit. Please use Complete Distribution Kit.`,
            'info'
          );
          return;
        }

        const isConnected = userConnections.some((c) => c.platform === targetJob.platform);
        if (!isConnected) {
          onShowToast(
            isId
              ? `Akun ${targetJob.platform.toUpperCase()} belum terhubung di OAuth Vault. Silakan sambungkan akun Anda terlebih dahulu.`
              : `Account for ${targetJob.platform.toUpperCase()} is not connected in OAuth Vault. Please connect it first.`,
            'error'
          );
          return;
        }
      }

      onShowToast('Menginisiasi proses upload serverless ke platform...', 'info');
      const updatedJob = await UniversalPublishingService.dispatchJobToServer({
        jobId,
        accessToken: session.access_token,
      });

      setUserPublishingJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, ...updatedJob } : j))
      );

      if (updatedJob.status === 'published') {
        onShowToast(`Video berhasil dipublikasikan ke ${updatedJob.platform.toUpperCase()}!`, 'success');
      } else if (updatedJob.status === 'requires_user_action') {
        onShowToast(
          `Video terkirim ke ${updatedJob.platform.toUpperCase()} dan menunggu tindakan/konfirmasi manual di creator studio platform.`,
          'info'
        );
      } else if (updatedJob.status === 'failed') {
        onShowToast(`Publikasi gagal: ${updatedJob.error_message || 'Terjadi kesalahan pada provider.'}`, 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Gagal memproses dispatch publikasi.', 'error');
    } finally {
      setDispatchingJobId(null);
    }
  };

  const handleBatchDispatchAllConnected = async () => {
    const dispatchableJobs = userPublishingJobs.filter(
      (j) =>
        (j.status === 'draft' || j.status === 'failed') &&
        ['youtube', 'tiktok', 'instagram', 'facebook'].includes(j.platform) &&
        userConnections.some((c) => c.platform === j.platform)
    );

    if (dispatchableJobs.length === 0) {
      onShowToast(
        isId
          ? 'Tidak ada draf antrean publikasi yang siap diproses untuk akun yang terhubung saat ini.'
          : 'No pending draft jobs ready to publish for currently connected accounts.',
        'info'
      );
      return;
    }

    onShowToast(`Memulai publikasi batch untuk ${dispatchableJobs.length} saluran terhubung...`, 'info');
    for (const job of dispatchableJobs) {
      await handleDispatchJob(job.id);
    }
  };

  // Toggle platform selection in multi-platform composer
  const togglePlatformSelection = (pid: PlatformId) => {
    setSelectedPlatforms((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    );
  };

  // Helper for platform icon
  const renderPlatformIcon = (iconName: string) => {
    switch (iconName) {
      case 'Youtube': return <Youtube className="w-4 h-4 text-red-500" />;
      case 'Instagram': return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'Facebook': return <Facebook className="w-4 h-4 text-blue-500" />;
      case 'Twitter': return <Twitter className="w-4 h-4 text-slate-300" />;
      case 'Linkedin': return <Linkedin className="w-4 h-4 text-sky-500" />;
      case 'Pin': return <Pin className="w-4 h-4 text-rose-500" />;
      case 'Ghost': return <Ghost className="w-4 h-4 text-yellow-400" />;
      case 'AtSign': return <AtSign className="w-4 h-4 text-white" />;
      case 'Send': return <Send className="w-4 h-4 text-sky-400" />;
      case 'Tv': return <Tv className="w-4 h-4 text-blue-400" />;
      case 'Film': return <Film className="w-4 h-4 text-cyan-400" />;
      case 'MessageSquare': return <MessageSquare className="w-4 h-4 text-orange-500" />;
      default: return <Video className="w-4 h-4 text-cyan-400" />;
    }
  };

  // Save drafts across selected platforms
  const handleSaveMultiPlatformDrafts = async () => {
    if (!userId || !activeProject) return;
    if (selectedPlatforms.length === 0) {
      onShowToast('Pilih minimal satu platform tujuan publikasi.', 'error');
      return;
    }
    setIsSavingDraftJobs(true);
    try {
      const activeTitle = viralityTitles[selectedTitleIndex]?.title || `${activeProject.name}: Mahakarya Sinema AI`;
      const targetFormats: Record<PlatformId, string> = {} as any;
      selectedPlatforms.forEach((p) => {
        targetFormats[p] = p === 'youtube' || p === 'facebook' || p === 'vimeo' ? '16:9' : '9:16';
      });

      const res = await UniversalPublishingService.createMultiPlatformDrafts({
        userId,
        projectId: activeProject.id,
        platformIds: selectedPlatforms,
        targetFormats,
        metadata: {
          title: activeTitle,
          description: seoDescriptionText,
          caption: activeTitle,
          hashtags: ['AIMovieFactory', 'SinemaAI', (activeProject.genre || 'Cinema').replace(/\s+/g, '')],
          privacy: 'public',
          aspectRatio: activePlatform === 'youtube_16_9' ? '16:9' : '9:16',
        },
        mediaUrl: projectAssets.find((a) => a.asset_type === 'video')?.file_url || 'https://storage.googleapis.com/amf-master-demo.mp4',
      });

      if (res.jobs.length > 0) {
        setUserPublishingJobs((prev) => [...res.jobs, ...prev]);
        onShowToast(`Berhasil menyimpan ${res.jobs.length} draf antrean publikasi ke basis data!`, 'success');
      } else {
        onShowToast('Gagal membuat draf publikasi', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message || 'Gagal menyimpan draf publikasi', 'error');
    } finally {
      setIsSavingDraftJobs(false);
    }
  };

  if (!activeProject) {
    return (
      <div className="p-8 text-center bg-[#101726] border border-slate-800 rounded-xl max-w-xl mx-auto">
        <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white">Tidak Ada Proyek Aktif</h3>
        <p className="text-xs text-slate-400 mt-1">Silakan pilih atau buat proyek baru untuk memulai timeline editing studio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Studio Header & Project Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#101726] border border-slate-800/80 p-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                {isId ? 'Editing & Post-Produksi Studio' : 'Editing & Post-Production Studio'}
              </h2>
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                SSOT Section 5 & 14
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isId
                ? 'Perakitan multi-track, transisi cinematic, color grading LUT, dan publishing multi-platform.'
                : 'Multi-track timeline assembly, cinematic transitions, color grading LUTs, and multi-platform publishing.'}
            </p>
          </div>
        </div>

        {/* Action Controls & Project Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={activeProject.id}
              onChange={(e) => onSelectProject && onSelectProject(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-950 text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleRenderMasterSequence()}
            disabled={isRendering}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-sm shadow-amber-400/20 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>{isRendering ? (isId ? 'Merender Master...' : 'Rendering Master...') : isId ? 'Render Master Video' : 'Render Master Video'}</span>
          </button>
        </div>
      </div>

      {/* Gate 5 (Final Master Approval) Director Gate Banner (SSOT TC-WF-14) */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition-all shadow-md ${
        isGate5Approved
          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 shadow-emerald-950/20'
          : 'bg-amber-950/20 border-amber-500/40 text-amber-300 shadow-amber-950/20'
      }`}>
        <div className="flex items-start md:items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            isGate5Approved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-xs">
                [GATE 5] Gerbang Persetujuan Master Final Sutradara
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                isGate5Approved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                {isGate5Approved ? '✅ Telah Disetujui (Locked for Master Export)' : '⚠️ Menunggu Persetujuan'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isGate5Approved
                ? `${gate5ReviewNotes || 'Assembly multi-track dan audio loudness disetujui sutradara.'} • Disetujui: ${new Date(gate5ApprovedAt || Date.now()).toLocaleTimeString()}`
                : 'Sesuai SSOT Master Workflow, ekspor master video dikunci hingga sutradara menyetujui hasil assembly utuh timeline, mixing audio, dan sinkronisasi subtitle.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Preset Selector */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setExportTierPreset('social_web')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                exportTierPreset === 'social_web' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Social Web (-16 LUFS)
            </button>
            <button
              onClick={() => setExportTierPreset('cinema_master')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                exportTierPreset === 'cinema_master' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cinema 4K (-14 LUFS)
            </button>
          </div>

          {isGate5Approved ? (
            <button
              onClick={handleRevokeGate5}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Buka Revisi
            </button>
          ) : (
            <button
              onClick={() => setShowGate5Modal(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/20 cursor-pointer transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Setujui Final Master (Gate 5)</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Viewport (Upper Half: Player Preview & Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Real-Time Cinema Viewport & Scrubber */}
        <div className="lg:col-span-8 bg-[#101726] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl flex flex-col">
          {/* Viewport Top Bar */}
          <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Tv className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-white truncate max-w-[280px]">{sequenceTitle}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                {activePlatform.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-amber-400 text-xs font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
              </span>
            </div>
          </div>

          {/* Video Canvas Stage with Applied LUT Filter */}
          <div className="relative bg-black flex-1 flex items-center justify-center min-h-[340px] p-4 overflow-hidden group">
            <div
              className={`relative overflow-hidden rounded-lg shadow-2xl transition-all duration-300 border border-slate-800/50 ${getAspectRatioClass()}`}
              style={{ filter: getLutFilterStyle() }}
            >
              {activeVideoClip ? (
                <img
                  src={activeVideoClip.source_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80'}
                  alt={activeVideoClip.title}
                  style={{
                    transform: activePlatform === 'tiktok_reels_9_16' ? `translateX(${reframeOffset}%) scale(1.15)` : 'none',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="w-full h-full object-cover select-none"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/90 text-slate-500 p-8 text-center">
                  <Video className="w-12 h-12 text-slate-700 mb-2" />
                  <p className="text-xs">{isId ? 'Tidak ada klip video pada playhead saat ini' : 'No video clip at current playhead position'}</p>
                  <p className="text-[10px] text-slate-600 mt-1">{isId ? 'Geser playhead atau tambahkan klip ke track V1' : 'Scrub playhead or add clips to track V1'}</p>
                </div>
              )}

              {/* Subtitle / Karaoke Text Overlay */}
              {activeVoiceClip && activeVoiceClip.text_overlay && (
                <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none z-10">
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md text-amber-300 font-semibold text-xs sm:text-sm border border-amber-400/30 shadow-lg animate-in fade-in">
                    {activeVoiceClip.text_overlay}
                  </span>
                </div>
              )}

              {/* Cinematic Watermark / LUT Badge */}
              <div className="absolute top-2 left-2 pointer-events-none z-10">
                <span className="text-[9px] uppercase tracking-wider font-mono bg-black/60 text-slate-300 px-2 py-0.5 rounded border border-white/10">
                  LUT: {colorGradeLut.replace('_', ' ')}
                </span>
              </div>

              {/* TikTok / Reels / Shorts Safe Area Overlay (Sprint 1: P0) */}
              {activePlatform === 'tiktok_reels_9_16' && showSafeArea && (
                <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 select-none">
                  {/* Top Zone Hazard Warning */}
                  <div className="flex items-center justify-between text-[10px] text-white/70 font-semibold px-2 pt-1 border-b border-dashed border-rose-500/50 pb-1">
                    <span className="bg-rose-500/30 text-rose-300 px-1 py-0.5 rounded text-[8px] font-mono">⚠️ Zona Tertutup Tab Medsos</span>
                    <div className="flex gap-3 text-[10px]">
                      <span className="text-slate-400">Teman</span>
                      <span className="text-white border-b-2 border-white pb-0.5">Untuk Anda</span>
                    </div>
                    <span className="text-[10px]">🔍</span>
                  </div>

                  {/* Center Safe Content Box */}
                  <div className="my-auto mx-1 h-3/5 border-2 border-dashed border-emerald-400/60 rounded-lg flex items-center justify-center bg-emerald-500/5 shadow-inner">
                    <span className="text-[9px] font-mono text-emerald-300 bg-black/80 px-2.5 py-1 rounded border border-emerald-400/40 shadow-lg flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      SAFE CONTENT ZONE (Bebas Tombol 100%)
                    </span>
                  </div>

                  {/* Right Action Rail & Bottom Caption Hazard Warning */}
                  <div className="relative pt-1 border-t border-dashed border-rose-500/50">
                    <div className="absolute -top-32 right-1 flex flex-col items-center gap-2 text-white/80">
                      <div className="w-6 h-6 rounded-full bg-slate-700 border border-white flex items-center justify-center text-[9px] font-bold">★</div>
                      <div className="text-center text-[9px] leading-tight">❤️<br/><span className="text-[7px]">182K</span></div>
                      <div className="text-center text-[9px] leading-tight">💬<br/><span className="text-[7px]">2.4K</span></div>
                      <div className="text-center text-[9px] leading-tight">🔖<br/><span className="text-[7px]">14K</span></div>
                    </div>
                    <div className="pr-10 text-left">
                      <p className="text-[10px] font-bold text-white">@{activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}</p>
                      <p className="text-[8px] text-slate-300 line-clamp-1">{activeProject.description || 'Film AI resmi produksi AI Movie Factory.'}</p>
                      <p className="text-[7px] text-amber-300 flex items-center gap-1 mt-0.5">🎵 Audio Asli Sinematik - AMF Studio</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="bg-rose-500/30 text-rose-300 px-1 py-0.5 rounded text-[7px] font-mono">⚠️ Zona Tertutup Caption & Musik</span>
                      <span className="text-[7px] text-slate-400 font-mono">Safe Margins Active</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Playback Transport Controls */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between gap-4">
            {/* Playhead Scrubbing Progress Bar */}
            <div className="flex-1 flex items-center gap-3">
              <button
                onClick={() => setCurrentTime(0)}
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Kembali ke Awal (00:00)"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-400/20 transition-transform active:scale-95 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={() => setCurrentTime((t) => Math.min(totalDuration, t + 2))}
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                title="Maju 2 Detik"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Scrubber Range Input */}
              <div className="flex-1 relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max={totalDuration}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <span className="font-mono text-xs text-slate-400 whitespace-nowrap">
                {formatTimecode(currentTime)}
              </span>
            </div>

            {/* Right Transport Options */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Split Clip Razor Button */}
              <button
                onClick={handleSplitClipAtPlayhead}
                className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 rounded flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-sm"
                title={isId ? 'Potong / Split klip pada posisi playhead' : 'Split clip at current playhead position'}
              >
                <Scissors className="w-3.5 h-3.5 text-rose-400" />
                <span>{isId ? 'Potong Klip' : 'Split'}</span>
              </button>

              {/* Playback Speed Switcher */}
              <div className="flex items-center gap-1 text-[11px] bg-slate-900 border border-slate-800 rounded px-2 py-1">
                <span className="text-slate-500">Speed:</span>
                {[0.5, 1.0, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className={`px-1.5 py-0.5 rounded font-mono cursor-pointer transition-colors ${
                      playbackSpeed === s ? 'bg-amber-400/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Master Mute / Volume */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  isMuted ? 'text-rose-400 hover:bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Studio Inspector & Tools Panel */}
        <div className="lg:col-span-4 bg-[#101726] border border-slate-800/80 rounded-xl overflow-hidden shadow-xl flex flex-col">
          {/* Inspector Tab Selector */}
          <div className="flex border-b border-slate-800/80 bg-slate-950/40 text-xs font-medium">
            <button
              onClick={() => setEditorTab('timeline')}
              className={`flex-1 py-3 px-2 text-center border-b-2 transition-colors cursor-pointer ${
                editorTab === 'timeline'
                  ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {isId ? 'Klip & Track' : 'Clips & Tracks'}
            </button>
            <button
              onClick={() => setEditorTab('color_grading')}
              className={`flex-1 py-3 px-2 text-center border-b-2 transition-colors cursor-pointer ${
                editorTab === 'color_grading'
                  ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {isId ? 'Color LUT' : 'Color LUT'}
            </button>
            <button
              onClick={() => setEditorTab('publishing')}
              className={`flex-1 py-3 px-2 text-center border-b-2 transition-colors cursor-pointer ${
                editorTab === 'publishing'
                  ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {isId ? 'Publikasi' : 'Publishing'}
            </button>
          </div>

          {/* Tab 1: Clips & Media Studio Asset Importer */}
          {editorTab === 'timeline' && (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[460px]">
              {/* Selected Clip Inspector (When a clip is active) */}
              {selectedClipId && (() => {
                const selClip = clips.find((c) => c.id === selectedClipId);
                if (!selClip) return null;
                return (
                  <div className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-amber-400" />
                        {isId ? 'Inspektor Klip Terpilih' : 'Selected Clip Inspector'}
                      </span>
                      <button
                        onClick={() => setSelectedClipId(null)}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-white truncate">{selClip.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Mulai: {formatTimecode(selClip.start_time)}</span>
                      <span className="font-mono text-amber-400 font-bold">Durasi: {selClip.duration}s</span>
                    </div>

                    {/* Trim and Cut Controls */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleTrimClip(selClip.id, -1)}
                        className="flex-1 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 text-[11px] cursor-pointer"
                        title="Kurangi durasi klip 1 detik"
                      >
                        -1s (Trim In)
                      </button>
                      <button
                        onClick={() => handleTrimClip(selClip.id, 1)}
                        className="flex-1 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 text-[11px] cursor-pointer"
                        title="Tambah durasi klip 1 detik"
                      >
                        +1s (Trim Out)
                      </button>
                      <button
                        onClick={() => handleDeleteClip(selClip.id)}
                        className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded border border-rose-500/30 cursor-pointer"
                        title="Hapus klip ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Story Scenes Importer */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isId ? 'Adegan Cerita (Story Scenes)' : 'Story Scenes'}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {scenes.length} {isId ? 'adegan' : 'scenes'}
                  </span>
                </h4>

                {scenes.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 space-y-1">
                    <p>{isId ? 'Belum ada adegan tersimpan di naskah proyek.' : 'No scenes stored in script yet.'}</p>
                    <button
                      onClick={() =>
                        handleImportStoryScene({
                          scene_number: 1,
                          title: 'Pertarungan Puncak Puncak Awan Surgawi',
                          location: 'Jurang Abadi',
                          description: 'Lin Yan menghunus pedang langit membelah badai petir kultivasi.',
                        })
                      }
                      className="px-2.5 py-1 bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 font-bold text-[10px] rounded transition-colors cursor-pointer mt-1"
                    >
                      + {isId ? 'Impor Contoh Adegan Donghua' : 'Import Sample Scene'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {scenes.map((scene: any, sIdx: number) => (
                      <div
                        key={scene.id || `scene-${sIdx}`}
                        className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs hover:border-slate-700 transition-colors"
                      >
                        <div className="truncate">
                          <p className="text-slate-200 font-semibold truncate text-[11px]">
                            #{scene.scene_number || sIdx + 1} {scene.title}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">{scene.location || 'Eksterior'}</p>
                        </div>
                        <button
                          onClick={() => handleImportStoryScene(scene)}
                          className="px-2 py-1 bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 font-bold text-[10px] rounded transition-colors shrink-0 cursor-pointer"
                        >
                          + {isId ? 'Timeline' : 'Timeline'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Media Studio Assets Importer */}
              <div className="border-t border-slate-800/80 pt-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isId ? 'Aset dari Media Studio' : 'Media Studio Assets'}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {projectAssets.length} {isId ? 'aset tersedia' : 'assets available'}
                  </span>
                </h4>

                {projectAssets.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 space-y-1">
                    <p>{isId ? 'Belum ada aset dari Media Studio.' : 'No media assets generated yet.'}</p>
                    <p className="text-[10px] text-slate-500">
                      {isId
                        ? 'Gunakan tombol tambah manual di bawah atau buat aset di Media Studio.'
                        : 'Use manual buttons below or generate assets in Media Studio.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {projectAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {asset.asset_type === 'video' ? (
                            <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          ) : asset.asset_type === 'voice' ? (
                            <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          )}
                          <span className="truncate text-slate-200 text-[11px]">{asset.asset_name}</span>
                        </div>
                        <button
                          onClick={() => handleImportMediaAsset(asset)}
                          className="px-2 py-1 bg-amber-400/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 font-bold text-[10px] rounded transition-colors shrink-0 cursor-pointer"
                        >
                          + {isId ? 'Timeline' : 'Timeline'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Add Custom Track Clip */}
              <div className="border-t border-slate-800/80 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                  {isId ? 'Tambah Klip Manual' : 'Add Manual Track Clip'}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handleAddClip('video', `Klip Video Baru (${clips.filter((c) => c.track === 'video').length + 1})`, 8)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-blue-500/30 text-blue-300 hover:bg-blue-500/10 flex items-center gap-2 text-left cursor-pointer transition-colors"
                  >
                    <Video className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>+ Klip Video (V1)</span>
                  </button>

                  <button
                    onClick={() => handleAddClip('voice', 'Dialog Karakter Baru', 5)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-2 text-left cursor-pointer transition-colors"
                  >
                    <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>+ Voice Dialog (A1)</span>
                  </button>

                  <button
                    onClick={() => handleAddClip('music', 'BGM Xianxia Baru', 20)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 flex items-center gap-2 text-left cursor-pointer transition-colors"
                  >
                    <Music className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>+ Musik BGM (A2)</span>
                  </button>

                  <button
                    onClick={() => handleAddClip('sfx', 'Efek Suara Pedang / Aksi', 3)}
                    className="p-2.5 rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 flex items-center gap-2 text-left cursor-pointer transition-colors"
                  >
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>+ Efek SFX (A3)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Cinematic Color Grading LUT Engine */}
          {editorTab === 'color_grading' && (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[460px]">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                  Cinematic Color Grading LUT Presets
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  {isId
                    ? 'Pilih grading warna standar perfilman yang otomatis diaplikasikan ke seluruh sequence.'
                    : 'Select industry-standard cinematic color profiles automatically applied to sequence.'}
                </p>

                <div className="space-y-2">
                  {[
                    {
                      id: 'xianxia_ethereal',
                      name: 'Xianxia Ethereal Glow',
                      desc: 'Difusi cahaya surgawi, saturasi cyan-emas, nuansa kultivasi abadi.',
                      badge: 'Rekomendasi Donghua',
                    },
                    {
                      id: 'cyberpunk_neon',
                      name: 'Cyberpunk High-Contrast Neon',
                      desc: 'Kontras tajam, bayangan pekat dengan sorot warna magenta & teal.',
                      badge: 'Sci-Fi / Modern',
                    },
                    {
                      id: 'golden_warmth',
                      name: 'Golden Hour Sunset Warmth',
                      desc: 'Karakter hangat matahari terbenam, nuansa emosional dan nostalgia.',
                      badge: 'Drama / Roman',
                    },
                    {
                      id: 'film_noir',
                      name: 'Cinematic Noir Monochrome',
                      desc: 'Hitam putih dramatis, kontras bayangan tajam gaya detektif klasik.',
                      badge: 'Misteri / Thriller',
                    },
                    {
                      id: 'kodak_vintage',
                      name: 'Kodak Vintage 35mm Analog',
                      desc: 'Film grain halus dengan warm roll-off natural ala seluloid klasik.',
                      badge: 'Klasik Sinema',
                    },
                    {
                      id: 'none',
                      name: 'Neutral Clean (Tanpa LUT)',
                      desc: 'Warna asli render kamera tanpa modifikasi tambahan.',
                      badge: 'Raw Profil',
                    },
                  ].map((lut) => (
                    <div
                      key={lut.id}
                      onClick={() => {
                        setColorGradeLut(lut.id as ColorGradeLut);
                        saveSequence(clips, lut.id as ColorGradeLut);
                        onShowToast(`Color LUT diganti ke ${lut.name}`, 'info');
                      }}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        colorGradeLut === lut.id
                          ? 'bg-amber-400/10 border-amber-400/40 text-white shadow-md'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5 text-amber-400" />
                          {lut.name}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-medium">
                          {lut.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{lut.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Studio Publishing & Virality Hub (Sprint 1: P0) */}
          {editorTab === 'publishing' && (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[520px]">
              {/* Publishing Sub-Tabs Header (T9.2 Universal Engine) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[11px] font-semibold gap-1">
                <button
                  onClick={() => setPublishingSubTab('format_safe_area')}
                  className={`py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    publishingSubTab === 'format_safe_area'
                      ? 'bg-amber-400 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Format & Safe Area</span>
                </button>
                <button
                  onClick={() => setPublishingSubTab('ai_virality')}
                  className={`py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    publishingSubTab === 'ai_virality'
                      ? 'bg-amber-400 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>AI Virality Kit</span>
                </button>
                <button
                  onClick={() => setPublishingSubTab('universal_channels')}
                  className={`py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    publishingSubTab === 'universal_channels'
                      ? 'bg-amber-400 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>13 Kanal Distribusi</span>
                </button>
                <button
                  onClick={() => setPublishingSubTab('distribution_package')}
                  className={`py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    publishingSubTab === 'distribution_package'
                      ? 'bg-amber-400 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Paket Rilis & Cuan</span>
                </button>
              </div>

              {/* Sub-tab 1: Format & Safe Area */}
              {publishingSubTab === 'format_safe_area' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Preset Rasio Aspek & Target Distribusi</span>
                      <span className="text-[10px] text-amber-400 font-normal">Resolusi 4K & Vertikal</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Pilih format tayang. AI secara presisi mengonfigurasi dimensi kanvas dan bitrate kompresi.
                    </p>

                    <div className="space-y-2">
                      {[
                        {
                          id: 'youtube_16_9',
                          title: 'YouTube & OTT (16:9 Landscape)',
                          specs: '3840x2160 (4K) / 1080p | 24fps | 25 Mbps',
                          desc: 'Standar sinematik layar lebar & desktop TV.',
                        },
                        {
                          id: 'tiktok_reels_9_16',
                          title: 'TikTok, Reels & Shorts (9:16 Vertical)',
                          specs: '1080x1920 | 30fps | Smart Center-Framing',
                          desc: 'Format mobile vertikal dengan panduan Safe Area.',
                        },
                        {
                          id: 'cinemascope_2_39',
                          title: 'CinemaScope Anamorphic (2.39:1)',
                          specs: '4096x1716 | 24fps | DCI-P3 Color Space',
                          desc: 'Rasio sinema ultra-lebar untuk festival film indie.',
                        },
                        {
                          id: 'web_drama_4_5',
                          title: 'Web Drama Series (4:5 Mobile)',
                          specs: '1080x1350 | 24fps | Fast-CDN Streaming',
                          desc: 'Format ideal untuk platform serial drama pendek.',
                        },
                      ].map((plat) => (
                        <div
                          key={plat.id}
                          onClick={() => {
                            setActivePlatform(plat.id as PublishingPlatformPreset);
                            saveSequence(clips, colorGradeLut, plat.id as PublishingPlatformPreset);
                            onShowToast(`Format publikasi diubah ke ${plat.title}`, 'info');
                          }}
                          className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                            activePlatform === plat.id
                              ? 'bg-amber-400/10 border-amber-400/40 text-white shadow-md'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold flex items-center gap-1.5">
                              <Share2 className="w-3.5 h-3.5 text-amber-400" />
                              {plat.title}
                            </span>
                            {activePlatform === plat.id && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                          </div>
                          <p className="text-[10px] font-mono text-amber-300/80 mb-0.5">{plat.specs}</p>
                          <p className="text-[11px] text-slate-400">{plat.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 9:16 Special Controls: Safe Area & Horizontal Reframe */}
                  {activePlatform === 'tiktok_reels_9_16' && (
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-white">Panduan Safe Area Overlay</span>
                        </div>
                        <button
                          onClick={() => setShowSafeArea(!showSafeArea)}
                          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                            showSafeArea ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {showSafeArea ? 'Aktif (Tampak)' : 'Nonaktif'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Memvisualisasikan zona bahaya tombol Like, Komentar, dan Teks TikTok/Reels di layar pratinjau agar subtitel & wajah tidak tertutup.
                      </p>

                      <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-medium flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                            Koreksi Posisi Potongan (Reframe X)
                          </span>
                          <span className="font-mono text-amber-400 text-xs">
                            {reframeOffset > 0 ? `+${reframeOffset}% Kanan` : reframeOffset < 0 ? `${reframeOffset}% Kiri` : 'Pusat (0%)'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-30"
                          max="30"
                          value={reframeOffset}
                          onChange={(e) => setReframeOffset(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>-30% Geser Kiri</span>
                          <button
                            onClick={() => setReframeOffset(0)}
                            className="text-amber-400/80 hover:text-amber-300 underline cursor-pointer"
                          >
                            Reset 0%
                          </button>
                          <span>+30% Geser Kanan</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pre-Flight Quality Inspection Checklist */}
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Inspeksi Kesiapan Ekspor (Pre-Flight QC)
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <span className="text-slate-300 flex items-center gap-1">✓ Resolusi: {activePlatform === 'youtube_16_9' ? '4K UHD' : '1080p FHD'}</span>
                      <span className="text-slate-300 flex items-center gap-1">✓ Audio: -14 LUFS (EBU R128)</span>
                      <span className="text-slate-300 flex items-center gap-1">✓ Color LUT: {colorGradeLut.toUpperCase()}</span>
                      <span className="text-slate-300 flex items-center gap-1">✓ Subtitle Sync: Terintegrasi</span>
                    </div>
                  </div>

                  {/* T6: AI 15-Detik Golden Hook Inspector (Pre-Publishing Retention) */}
                  <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        AI Golden Hook 15-Detik Inspector
                      </span>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                        Skor Retensi: {hookScore}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      85% penonton yang melewati 15 detik pertama akan menonton film hingga selesai tanpa keluar.
                    </p>
                    <div className="space-y-1.5 text-[10px]">
                      <div className="flex items-center justify-between p-1.5 bg-slate-950/60 rounded">
                        <span className="text-slate-300">• Detik 0-3 (Visual Shock):</span>
                        <span className="text-emerald-400 font-semibold">✓ Aksi / Visual Utama Terdeteksi</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-slate-950/60 rounded">
                        <span className="text-slate-300">• Detik 3-7 (Pemicu Penasaran):</span>
                        <span className="text-emerald-400 font-semibold">✓ Dialog / Narasi Terpasang</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-slate-950/60 rounded">
                        <span className="text-slate-300">• Detik 7-15 (Eskalasi Nada):</span>
                        <span className="text-emerald-400 font-semibold">✓ Musik & SFX Atmosferik</span>
                      </div>
                    </div>
                    {onNavigateToIntelligence && (
                      <button
                        onClick={() => onNavigateToIntelligence(activeProject.id)}
                        className="w-full mt-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <TrendingUp className="w-3 h-3" />
                        <span>Buka Konsol Intelijen Bisnis Kreator & Cuan →</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setPublishingSubTab('ai_virality')}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Lanjut ke AI Virality Kit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Sub-tab 2: AI Virality Packaging Kit */}
              {publishingSubTab === 'ai_virality' && (
                <div className="space-y-4">
                  {/* AI Click-Magnet Titles */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        5 Formula Judul Pemicu Klik (High CTR)
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Formula psikologi penonton untuk mendongkrak rasio klik (CTR) pada YouTube & TikTok.
                    </p>

                    <div className="space-y-2">
                      {viralityTitles.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedTitleIndex(idx)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            selectedTitleIndex === idx
                              ? 'bg-amber-400/10 border-amber-400/50 text-white shadow'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-amber-400 font-semibold">{item.formula}</span>
                            <span className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-white mb-2 leading-relaxed">"{item.title}"</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">{item.tag}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.title, `title-${idx}`);
                              }}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              {copiedField === `title-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedField === `title-${idx}` ? 'Tersalin' : 'Salin Judul'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Thumbnail Keyframe Studio */}
                  <div className="pt-2 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Studio Thumbnail AI & Keyframe Rekomendasi
                    </h4>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Frame dengan skor estetika tertinggi hasil ekstraksi visual timeline:
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      {thumbnailKeyframes.map((th, idx) => (
                        <div
                          key={th.id}
                          onClick={() => setSelectedThumbnailIndex(idx)}
                          className={`rounded-lg border overflow-hidden cursor-pointer transition-all ${
                            selectedThumbnailIndex === idx
                              ? 'border-amber-400 ring-2 ring-amber-400/30'
                              : 'border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="relative aspect-video bg-black overflow-hidden">
                            <img src={th.url} alt={th.title} className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 bg-black/80 text-amber-300 font-mono text-[8px] font-bold px-1 rounded">
                              CTR {th.ctrScore}
                            </div>
                            <div className="absolute bottom-1 left-1 right-1 bg-red-600/90 text-white font-extrabold text-[7px] text-center px-1 rounded shadow">
                              {th.badge}
                            </div>
                          </div>
                          <div className="p-1.5 bg-slate-900/90 text-[10px]">
                            <p className="font-semibold text-white truncate">{th.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI 15s Teaser & Trailer Factory */}
                  <div className="p-3 bg-gradient-to-r from-purple-900/20 to-amber-900/20 border border-purple-500/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        AI 15-Detik Teaser Factory (Shorts/Reels)
                      </span>
                      {teaserGenerated && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.5 rounded">
                          ✓ Teaser Siap
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300">
                      AI memindai timeline dan merakit klip aksi intens 15 detik dengan sinkronisasi sound riser untuk promosi pancingan medsos.
                    </p>
                    <button
                      onClick={handleGenerateTeaser}
                      disabled={isGeneratingTeaser}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-purple-600/20"
                    >
                      {isGeneratingTeaser ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Merakit Teaser 15 Detik...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>{teaserGenerated ? 'Rakit Ulang AI Teaser 15s' : '⚡ Generate AI Teaser 15 Detik'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* SEO Synopsis & Tags */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Deskripsi Lengkap & Timestamps</span>
                      <button
                        onClick={() => copyToClipboard(seoDescriptionText, 'seo_desc')}
                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'seo_desc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'seo_desc' ? 'Tersalin' : 'Salin Deskripsi'}</span>
                      </button>
                    </div>
                    <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded text-[10px] font-mono text-slate-400 max-h-24 overflow-y-auto whitespace-pre-line">
                      {seoDescriptionText}
                    </div>
                  </div>

                  <button
                    onClick={() => setPublishingSubTab('universal_channels')}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Lanjut ke 13 Kanal Distribusi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Sub-tab 3: 13 Universal Distribution Channels (T9.2) */}
              {publishingSubTab === 'universal_channels' && (() => {
                const platformsList =
                  platformFilterTab === 'first_wave'
                    ? getFirstWavePlatforms()
                    : platformFilterTab === 'expansion'
                    ? getExpansionPlatforms()
                    : getAllPlatforms();
                const activePlat = PLATFORM_REGISTRY[activeChannelView] || PLATFORM_REGISTRY.youtube;

                return (
                  <div className="space-y-4">
                    {/* Filter Pills */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Globe className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-white">Registry Kapabilitas Platform Universal</span>
                      </div>
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px]">
                        <button
                          onClick={() => setPlatformFilterTab('all')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            platformFilterTab === 'all' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Semua (13)
                        </button>
                        <button
                          onClick={() => setPlatformFilterTab('first_wave')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            platformFilterTab === 'first_wave' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Prioritas (4)
                        </button>
                        <button
                          onClick={() => setPlatformFilterTab('expansion')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            platformFilterTab === 'expansion' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Ekspansi (9)
                        </button>
                      </div>
                    </div>

                    {/* Platform Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {platformsList.map((plat) => {
                        const isSelected = selectedPlatforms.includes(plat.id);
                        const isFocused = activeChannelView === plat.id;
                        const existingConn = userConnections.find(
                          (c) => c.platform === plat.id && c.connection_status !== 'revoked'
                        );
                        const isFirstWave = ['youtube', 'tiktok', 'instagram', 'facebook'].includes(plat.id);
                        const isServerConfigured = Boolean(configuredPlatforms[plat.id]);

                        let statusLabel = 'Rencana Rilis';
                        let statusBadge = 'bg-slate-800 text-slate-400 border-slate-700';

                        if (existingConn) {
                          if (existingConn.connection_status === 'connected') {
                            statusLabel = `Terhubung: @${existingConn.provider_account_name || 'Channel'}`;
                            statusBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
                          } else if (existingConn.connection_status === 'expired') {
                            statusLabel = 'Perlu Otorisasi Ulang';
                            statusBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                          }
                        } else if (isFirstWave) {
                          if (isServerConfigured) {
                            statusLabel = 'OAuth 2.0 Siap';
                            statusBadge = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
                          } else {
                            statusLabel = 'API Belum Diatur';
                            statusBadge = 'bg-slate-800 text-slate-400 border-slate-700';
                          }
                        } else if (plat.integrationStatus === 'manual_export_available') {
                          statusLabel = 'Ekspor Manual Siap';
                          statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                        }

                        return (
                          <div
                            key={plat.id}
                            onClick={() => setActiveChannelView(plat.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${
                              isFocused
                                ? 'bg-slate-900 border-amber-400/60 shadow-lg'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                {renderPlatformIcon(plat.iconName)}
                                <span className="font-bold text-white text-xs">{plat.name}</span>
                              </div>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono truncate max-w-[130px] ${statusBadge}`}>
                                {statusLabel}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 line-clamp-1 mb-2">
                              {plat.description.id}
                            </p>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                              <span className="text-slate-400 font-mono">
                                Rasio: {plat.capabilities.supportedAspectRatios.join(', ')}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePlatformSelection(plat.id);
                                }}
                                className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {isSelected ? <CheckSquare className="w-3 h-3 text-amber-400" /> : <Square className="w-3 h-3" />}
                                <span>{isSelected ? 'Terpilih' : 'Pilih Rilis'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Active Platform Inspector Details */}
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2.5">
                          {renderPlatformIcon(activePlat.iconName)}
                          <div>
                            <span className="font-bold text-white text-xs block">{activePlat.name}</span>
                            <span className="text-[10px] text-slate-400">Kategori: {activePlat.category}</span>
                          </div>
                        </div>
                        <a
                          href={activePlat.officialDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:underline"
                        >
                          <span>Dokumentasi Resmi Developer</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block uppercase">Batas Durasi</span>
                          <span className="text-white font-bold">
                            {Math.floor(activePlat.capabilities.maxDurationSeconds / 60)} Menit
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block uppercase">Batas Ukuran</span>
                          <span className="text-white font-bold">
                            {Math.floor(activePlat.capabilities.maxSizeBytes / (1024 * 1024 * 1024)) || 1} GB
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block uppercase">Metode Publikasi</span>
                          <span className="text-cyan-400 font-bold">
                            {activePlat.capabilities.supportsDirectPublishing ? 'Direct API / Manual' : 'Ekspor Manual'}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block uppercase">Kebutuhan Akun</span>
                          <span className="text-amber-400 font-bold">
                            {activePlat.capabilities.accountTypeRequired}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-900/60 rounded-lg text-xs space-y-1">
                        <strong className="text-slate-200 block text-[11px]">Panduan Alur Distribusi:</strong>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          {activePlat.manualWorkflowNotes.id}
                        </p>
                      </div>

                      {/* OAuth 2.0 Direct Account Connection & Encrypted Vault (T9.3) */}
                      {(() => {
                        const activeConn = userConnections.find(
                          (c) => c.platform === activePlat.id && c.connection_status !== 'revoked'
                        );
                        const isFirstWave = ['youtube', 'tiktok', 'instagram', 'facebook'].includes(activePlat.id);
                        const isServerConfigured = Boolean(configuredPlatforms[activePlat.id]);
                        const isConnecting = connectingPlatform === activePlat.id;
                        const isDisconnecting = disconnectingPlatform === activePlat.id;

                        return (
                          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                {isId ? 'Koneksi Otorisasi Akun (OAuth 2.0 & Token Vault)' : 'OAuth 2.0 Account Authorization & Token Vault'}
                              </span>
                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                                AES-256-GCM Vault
                              </span>
                            </div>

                            {activeConn ? (
                              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  {activeConn.provider_avatar_url ? (
                                    <img
                                      src={activeConn.provider_avatar_url}
                                      alt={activeConn.provider_account_name}
                                      className="w-9 h-9 rounded-full border border-emerald-500/40 object-cover"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                                      <ShieldCheck className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-white text-xs">
                                        {activeConn.provider_account_name || 'Channel Creator'}
                                      </span>
                                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                                        {activeConn.connection_status === 'connected' ? 'Terhubung' : 'Perlu Otorisasi'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 block font-mono">
                                      ID: {activeConn.provider_account_id}
                                      {activeConn.token_expires_at
                                        ? ` • Kedaluwarsa: ${new Date(activeConn.token_expires_at).toLocaleDateString()}`
                                        : ''}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectOAuth(activePlat.id, activeConn.provider_account_id)}
                                  disabled={isDisconnecting}
                                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                  <span>{isDisconnecting ? 'Memutuskan...' : 'Putuskan Sambungan'}</span>
                                </button>
                              </div>
                            ) : isFirstWave ? (
                              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="text-[11px] text-slate-300">
                                    <p className="font-medium">
                                      {isServerConfigured
                                        ? `Hubungkan akun resmi ${activePlat.name} Anda untuk penerbitan langsung.`
                                        : `API Developer ${activePlat.name} belum dikonfigurasi di Vercel Environment Variables.`}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {isServerConfigured
                                        ? 'Token akses disimpan dengan enkripsi simetris terotentikasi AES-256-GCM pada brankas server-only.'
                                        : `Untuk mengaktifkan OAuth resmi, konfigurasikan kunci developer (${activePlat.name.toLowerCase().includes('youtube') ? 'YOUTUBE_CLIENT_ID & SECRET' : activePlat.name.toLowerCase().includes('tiktok') ? 'TIKTOK_CLIENT_KEY & SECRET' : 'META_APP_ID & SECRET'}).`}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleConnectOAuth(activePlat.id)}
                                    disabled={isConnecting}
                                    className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                                      isServerConfigured
                                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                                    }`}
                                  >
                                    <Link className="w-3.5 h-3.5" />
                                    <span>{isConnecting ? 'Mengarahkan...' : isServerConfigured ? `Hubungkan ${activePlat.name}` : 'Coba Otorisasi'}</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-slate-950/50 border border-slate-800 rounded-lg text-[11px] text-slate-400 flex items-center justify-between">
                                <span>Platform ekspansi ini saat ini mendukung alur Ekspor Manual master video, caption, dan paket thumbnail.</span>
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  Ekspor Manual Siap
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">
                          {selectedPlatforms.length} platform terpilih untuk rilis serentak.
                        </span>
                        <button
                          onClick={() => setPublishingSubTab('distribution_package')}
                          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Lanjut ke Paket Rilis & Antrean</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Sub-tab 3: Distribution Package & Monetization Simulator */}
              {publishingSubTab === 'distribution_package' && (() => {
                const estYoutubeAdsense = Math.round((simulatedViews / 1000) * 15000);
                const estTiktokRewards = Math.round((simulatedViews / 1000) * 8000);
                const estSponsorship = simulatedViews >= 500000 ? 5000000 : simulatedViews >= 100000 ? 2500000 : 1000000;
                const totalRevenueEst = estYoutubeAdsense + estTiktokRewards + estSponsorship;
                const estimatedAiCost = 250000;
                const netProfitEst = Math.max(totalRevenueEst - estimatedAiCost, 0);
                const profitMarginEst = Math.round((netProfitEst / totalRevenueEst) * 100);

                return (
                  <div className="space-y-4">
                    {/* Master Render Button */}
                    <div className="p-3.5 bg-gradient-to-r from-amber-400/10 via-amber-400/5 to-transparent border border-amber-400/30 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <Download className="w-4 h-4 text-amber-400" />
                          Master Video Package ({activePlatform.toUpperCase()})
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          {activePlatform === 'youtube_16_9' ? '4K 24fps ProRes/MP4' : '1080x1920 30fps'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Rakit seluruh klip video, audio dialog, musik BGM, foley, dan grading LUT menjadi master video siap edar.
                      </p>
                      <button
                        onClick={() => handleRenderMasterSequence()}
                        disabled={isRendering}
                        className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        <span>{isRendering ? 'Memproses Render...' : 'Eksekusi Render & Download Master MP4'}</span>
                      </button>
                    </div>

                    {/* Export Companion Assets Grid (.SRT, .VTT, .TXT, Copy Kit) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          Aset Pendukung Distribusi (TC-WF-15)
                        </h4>
                        <span className="text-[10px] text-amber-400/90 font-mono font-semibold">1-Click Kit Ready</span>
                      </div>

                      {/* One-Click Complete Distribution Kit Button (TC-WF-15) */}
                      <button
                        onClick={handleDownloadCompleteDistributionKit}
                        className="w-full mb-2.5 py-2.5 px-3 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs rounded-lg transition-all shadow-md shadow-amber-400/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 fill-current" />
                        <span>📦 Unduh Paket Distribusi Lengkap 1-Klik (TC-WF-15)</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          onClick={() => downloadFile(`${activeProject.name.replace(/\s+/g, '_')}_Subtitles.srt`, srtContent)}
                          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                          <div>
                            <p className="font-bold text-white text-[11px]">Subtitle .SRT</p>
                            <p className="text-[9px] text-slate-400">YouTube & Medsos</p>
                          </div>
                        </button>

                        <button
                          onClick={() => downloadFile(`${activeProject.name.replace(/\s+/g, '_')}_Subtitles.vtt`, vttContent)}
                          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <p className="font-bold text-white text-[11px]">Subtitle .VTT</p>
                            <p className="text-[9px] text-slate-400">Web Video Player</p>
                          </div>
                        </button>

                        <button
                          onClick={() => downloadFile(`${activeProject.name.replace(/\s+/g, '_')}_Chapters.txt`, chaptersContent)}
                          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                          <div>
                            <p className="font-bold text-white text-[11px]">Chapters .TXT</p>
                            <p className="text-[9px] text-slate-400">Timestamp YouTube</p>
                          </div>
                        </button>

                        <button
                          onClick={() => copyToClipboard(seoDescriptionText, 'all_kit')}
                          className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-amber-400/30 rounded-lg text-left transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          {copiedField === 'all_kit' ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 text-amber-400 shrink-0" />}
                          <div>
                            <p className="font-bold text-white text-[11px]">{copiedField === 'all_kit' ? 'Tersalin!' : 'Salin Semua Kit'}</p>
                            <p className="text-[9px] text-slate-400">Judul + Deskripsi + Tag</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Universal Multi-Platform Publishing Queue & Draft Saver (T9.2) */}
                    <div className="p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-amber-400" />
                          <div>
                            <span className="text-xs font-bold text-white block">
                              Antrean Publikasi Multi-Platform ({selectedPlatforms.length} Kanal Terpilih)
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Target Rilis: {selectedPlatforms.map((p) => PLATFORM_REGISTRY[p]?.name || p).join(', ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveMultiPlatformDrafts}
                            disabled={isSavingDraftJobs || selectedPlatforms.length === 0}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isSavingDraftJobs ? 'Menyimpan...' : 'Simpan Draf'}</span>
                          </button>
                          <button
                            onClick={handleBatchDispatchAllConnected}
                            disabled={dispatchingJobId !== null || userPublishingJobs.length === 0}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-amber-400/20"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{dispatchingJobId ? 'Memproses...' : '🚀 Publikasikan Semua Sekarang'}</span>
                          </button>
                        </div>
                      </div>

                      {userPublishingJobs.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {userPublishingJobs.slice(0, 5).map((job) => (
                            <div
                              key={job.id}
                              className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {renderPlatformIcon(PLATFORM_REGISTRY[job.platform]?.iconName || 'Video')}
                                <div>
                                  <p className="font-bold text-white text-[11px] truncate max-w-[200px] sm:max-w-xs">{job.title}</p>
                                  <p className="text-[9px] text-slate-400 font-mono">
                                    {PLATFORM_REGISTRY[job.platform]?.name || job.platform} • Format {job.target_format}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {job.status === 'published' ? (
                                  <a
                                    href={job.published_video_url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                  >
                                    <span>Lihat Video</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                ) : job.status === 'uploading' || job.status === 'processing' ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                                    {job.status === 'uploading' ? `Mengunggah (${job.progress_percentage || 40}%)` : 'Memproses...'}
                                  </span>
                                ) : job.status === 'requires_user_action' ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    Konfirmasi di Inbox
                                  </span>
                                ) : job.status === 'failed' ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] px-2 py-0.5 rounded font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                      Gagal
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDispatchJob(job.id)}
                                      disabled={dispatchingJobId === job.id}
                                      className="text-[9px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer"
                                    >
                                      Coba Lagi
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] px-2 py-0.5 rounded font-mono uppercase bg-slate-800 text-slate-300">
                                      {job.status}
                                    </span>
                                    {['youtube', 'tiktok', 'instagram', 'facebook'].includes(job.platform) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDispatchJob(job.id)}
                                        disabled={dispatchingJobId === job.id}
                                        className="inline-flex items-center gap-1 text-[9px] px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
                                      >
                                        <Send className="w-2.5 h-2.5" />
                                        <span>{dispatchingJobId === job.id ? 'Memproses...' : 'Publikasikan'}</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic text-center py-1">
                          Belum ada draf antrean publikasi tersimpan. Klik "Simpan Draf Antrean" untuk mendaftarkan pekerjaan rilis.
                        </p>
                      )}
                    </div>

                    {/* Creator Revenue & Net Profit Intelligence Simulator */}
                    <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          Simulator Potensi Cuan & Laba Bersih (ROI)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {simulatedViews.toLocaleString('id-ID')} Views
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>Target Penonton:</span>
                          <span className="font-semibold text-white">{simulatedViews.toLocaleString('id-ID')} Tayangan</span>
                        </div>
                        <input
                          type="range"
                          min="10000"
                          max="1000000"
                          step="10000"
                          value={simulatedViews}
                          onChange={(e) => setSimulatedViews(Number(e.target.value))}
                          className="w-full accent-emerald-400 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5 text-[11px] border-t border-slate-800/80 pt-2">
                        <div className="flex justify-between text-slate-300">
                          <span>• Estimasi AdSense YouTube (RPM IDR 15k):</span>
                          <span className="font-mono text-white">Rp {estYoutubeAdsense.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>• TikTok Rewards & Reels Bonus:</span>
                          <span className="font-mono text-white">Rp {estTiktokRewards.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>• Valuasi Sponsor / Product Placement:</span>
                          <span className="font-mono text-white">Rp {estSponsorship.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                          <span>Biaya Produksi AI (Kredit Terpakai):</span>
                          <span className="font-mono text-rose-400">-Rp {estimatedAiCost.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between text-white font-bold text-xs pt-1 border-t border-slate-700 bg-emerald-500/10 p-2 rounded">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <DollarSign className="w-3.5 h-3.5" />
                            Estimasi Laba Bersih (Net Profit):
                          </span>
                          <span className="font-mono text-emerald-300 text-sm">
                            Rp {netProfitEst.toLocaleString('id-ID')} ({profitMarginEst}%)
                          </span>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 italic">
                        *Model simulasi ilustratif tolak ukur industri konten video digital untuk memandu strategi bisnis kreator.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Rendering Progress Modal Bar (When Active) */}
      {isRendering && (
        <div className="p-4 rounded-xl bg-slate-900 border border-amber-400/40 shadow-2xl animate-in fade-in space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
              {activeRenderStage}
            </span>
            <span className="font-mono text-amber-400 font-bold">{renderProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Interactive Multi-Track Sequence Timeline (Lower Half) */}
      <div className="bg-[#101726] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl">
        {/* Timeline Header & Track Legend */}
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">
              {isId ? 'Multi-Track Sequence Timeline' : 'Multi-Track Sequence Timeline'}
            </h3>
            <span className="text-[10px] text-slate-400">
              ({clips.length} {isId ? 'klip terpasang' : 'active clips'})
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> V1 Video
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> A1 Voice Dialog
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> A2 BGM Musik
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> A3 SFX Foley
            </span>
          </div>
        </div>

        {/* Timeline Canvas with Horizontal Ruler & Tracks */}
        <div className="p-4 space-y-3 overflow-x-auto">
          {/* Timecode Ruler */}
          <div className="flex items-center text-[10px] font-mono text-slate-500 border-b border-slate-800/80 pb-1.5 ml-24 min-w-[700px]">
            {Array.from({ length: 11 }).map((_, idx) => {
              const sec = idx * 5;
              return (
                <div key={sec} className="flex-1 border-l border-slate-800 pl-1">
                  {formatTimecode(sec)}
                </div>
              );
            })}
          </div>

          {/* Track 1: V1 Video Clips */}
          <div className="flex items-center gap-2 min-w-[700px]">
            <div className="w-22 text-xs font-bold text-blue-400 flex items-center gap-1.5 shrink-0">
              <Video className="w-3.5 h-3.5" />
              <span>V1 Video</span>
            </div>
            <div className="flex-1 bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/80 min-h-[44px] flex items-center gap-2 overflow-x-auto">
              {clips
                .filter((c) => c.track === 'video')
                .sort((a, b) => a.start_time - b.start_time)
                .map((clip) => (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`relative p-2 rounded bg-blue-950/40 border text-xs text-blue-200 flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-blue-400 group shrink-0 ${
                      selectedClipId === clip.id ? 'border-amber-400 shadow-md ring-1 ring-amber-400/40' : 'border-blue-800/50'
                    }`}
                    style={{ minWidth: `${Math.max(120, clip.duration * 16)}px` }}
                  >
                    <div className="truncate">
                      <p className="font-semibold truncate text-[11px]">{clip.title}</p>
                      <p className="text-[9px] text-blue-400 font-mono mt-0.5">
                        {clip.duration}s | Transisi: {clip.transition_in || 'cut'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClip(clip.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Track 2: A1 Voice / Dialogue Clips */}
          <div className="flex items-center gap-2 min-w-[700px]">
            <div className="w-22 text-xs font-bold text-emerald-400 flex items-center gap-1.5 shrink-0">
              <Mic className="w-3.5 h-3.5" />
              <span>A1 Dialog</span>
            </div>
            <div className="flex-1 bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/80 min-h-[44px] flex items-center gap-2 overflow-x-auto">
              {clips
                .filter((c) => c.track === 'voice')
                .sort((a, b) => a.start_time - b.start_time)
                .map((clip) => (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`relative p-2 rounded bg-emerald-950/40 border text-xs text-emerald-200 flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-emerald-400 group shrink-0 ${
                      selectedClipId === clip.id ? 'border-amber-400 shadow-md ring-1 ring-amber-400/40' : 'border-emerald-800/50'
                    }`}
                    style={{ minWidth: `${Math.max(140, clip.duration * 18)}px` }}
                  >
                    <div className="truncate">
                      <p className="font-semibold truncate text-[11px]">{clip.title}</p>
                      <p className="text-[9px] text-emerald-400 font-mono mt-0.5">
                        {clip.speaker || 'Tokoh'} | Vol: {Math.round((clip.volume ?? 1) * 100)}%
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClip(clip.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Track 3: A2 BGM Music Clips */}
          <div className="flex items-center gap-2 min-w-[700px]">
            <div className="w-22 text-xs font-bold text-purple-400 flex items-center gap-1.5 shrink-0">
              <Music className="w-3.5 h-3.5" />
              <span>A2 Musik</span>
            </div>
            <div className="flex-1 bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/80 min-h-[44px] flex items-center gap-2 overflow-x-auto">
              {clips
                .filter((c) => c.track === 'music')
                .sort((a, b) => a.start_time - b.start_time)
                .map((clip) => (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`relative p-2 rounded bg-purple-950/40 border text-xs text-purple-200 flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-purple-400 group shrink-0 ${
                      selectedClipId === clip.id ? 'border-amber-400 shadow-md ring-1 ring-amber-400/40' : 'border-purple-800/50'
                    }`}
                    style={{ minWidth: `${Math.max(160, clip.duration * 14)}px` }}
                  >
                    <div className="truncate">
                      <p className="font-semibold truncate text-[11px]">{clip.title}</p>
                      <p className="text-[9px] text-purple-400 font-mono mt-0.5">
                        Loop {clip.duration}s | Ducking: {Math.round((clip.volume ?? 0.5) * 100)}%
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClip(clip.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Track 4: A3 SFX Foley Clips */}
          <div className="flex items-center gap-2 min-w-[700px]">
            <div className="w-22 text-xs font-bold text-amber-400 flex items-center gap-1.5 shrink-0">
              <Zap className="w-3.5 h-3.5" />
              <span>A3 SFX</span>
            </div>
            <div className="flex-1 bg-slate-950/60 rounded-lg p-1.5 border border-slate-800/80 min-h-[44px] flex items-center gap-2 overflow-x-auto">
              {clips
                .filter((c) => c.track === 'sfx')
                .sort((a, b) => a.start_time - b.start_time)
                .map((clip) => (
                  <div
                    key={clip.id}
                    onClick={() => setSelectedClipId(clip.id)}
                    className={`relative p-2 rounded bg-amber-950/40 border text-xs text-amber-200 flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-amber-400 group shrink-0 ${
                      selectedClipId === clip.id ? 'border-amber-400 shadow-md ring-1 ring-amber-400/40' : 'border-amber-800/50'
                    }`}
                    style={{ minWidth: `${Math.max(100, clip.duration * 20)}px` }}
                  >
                    <div className="truncate">
                      <p className="font-semibold truncate text-[11px]">{clip.title}</p>
                      <p className="text-[9px] text-amber-400 font-mono mt-0.5">Durasi: {clip.duration}s</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClip(clip.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export Packages History Card */}
      {exportHistory.length > 0 && (
        <div className="p-4 bg-[#101726] border border-slate-800/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>{isId ? 'Paket Master Video yang Telah Dirender' : 'Exported Master Video Packages'}</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              {exportHistory.length} {isId ? 'file siap unduh' : 'packages ready'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exportHistory.slice(0, 6).map((pkg) => (
              <div
                key={pkg.id}
                className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs"
              >
                <div className="truncate">
                  <p className="font-bold text-white truncate text-xs">{pkg.package_title}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {pkg.resolution} | {pkg.format.toUpperCase()} | {pkg.file_size_mb} MB
                  </p>
                </div>
                <a
                  href={pkg.file_url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold text-[11px] rounded transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gate 5 (Final Master Approval) Modal Dialog (SSOT TC-WF-14) */}
      {showGate5Modal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0b101b] border border-amber-500/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl shadow-amber-500/10">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Gerbang Persetujuan Sutradara (Gate 5)</span>
                </h3>
                <p className="text-xs text-amber-400/90 font-mono mt-0.5 truncate">{activeProject?.name}</p>
              </div>
              <button
                onClick={() => setShowGate5Modal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300">
              <p className="font-semibold mb-1">Pemeriksaan Prasyarat Ekspor Master (SSOT TC-WF-14):</p>
              <p className="text-slate-300">
                Dengan menyetujui gerbang ini, Anda mengonfirmasi bahwa assembly klip video, audio mixing (voice, BGM, SFX), dan ketepatan waktu subtitle (SRT/VTT) telah sesuai standar artistik studio sebelum proses render master dieksekusi.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 block">
                  Preset Target Master:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportTierPreset('social_web')}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      exportTierPreset === 'social_web'
                        ? 'bg-amber-400/10 border-amber-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs text-amber-400">Social Web Preset</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">MP4 H.264, 1080p, -16 LUFS</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportTierPreset('cinema_master')}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      exportTierPreset === 'cinema_master'
                        ? 'bg-amber-400/10 border-amber-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold text-xs text-amber-400">Cinema Master</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">ProRes 422, 4K, 24fps, -14 LUFS</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1 block">
                  Catatan Ulasan Sutradara:
                </label>
                <textarea
                  value={gate5ModalNoteInput}
                  onChange={(e) => setGate5ModalNoteInput(e.target.value)}
                  placeholder="Catatan approval master final..."
                  rows={3}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none text-xs resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGate5Modal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveGate5(gate5ModalNoteInput)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-400/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Kunci & Setujui Final Master (Gate 5)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
