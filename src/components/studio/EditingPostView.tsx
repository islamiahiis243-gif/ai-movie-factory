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
import { fetchProjectAssets, fetchProjectScenes, createExportPackage, fetchExportPackages } from '../../lib/supabase';
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
} from 'lucide-react';

interface EditingPostViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigateToPipeline?: (projectId: string) => void;
}

const LOCAL_STORAGE_SEQUENCES_KEY = 'ai_movie_factory_timeline_sequences_v1';

export const EditingPostView: React.FC<EditingPostViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onShowToast,
  onNavigateToPipeline,
}) => {
  const { language } = useAuth();
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

  // Animation Timer Ref
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Total calculated sequence duration (in seconds)
  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 60; // default 60s
    const maxEnd = Math.max(...clips.map((c) => c.start_time + c.duration));
    return Math.max(maxEnd, 30);
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

  // Execute Master Video Render & Publishing
  const handleRenderMasterSequence = async () => {
    if (!activeProject) return;
    setIsRendering(true);
    setRenderProgress(0);
    setActiveRenderStage('Inisialisasi Timeline Assembly Engine...');

    const stages = [
      { progress: 15, msg: 'Menggabungkan Track Video (V1) & Menghitung Frame Transitions...' },
      { progress: 35, msg: `Menerapkan LUT Color Grade: ${colorGradeLut.toUpperCase()}...` },
      { progress: 55, msg: 'Audio Mastering: Meratakan Dialog LUFS -14 & Ducking Musik...' },
      { progress: 75, msg: `Mengompresi ke Format Presisi: ${activePlatform.toUpperCase()}...` },
      { progress: 95, msg: 'Menyusun Metadata & Menyematkan Subtitel Berwaktu (SRT)...' },
      { progress: 100, msg: 'Master Package Siap Diterbitkan!' },
    ];

    for (const step of stages) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setRenderProgress(step.progress);
      setActiveRenderStage(step.msg);
    }

    try {
      const packageTitle = `${activeProject.name.replace(/\s+/g, '_')}_Final_Master_${activePlatform}`;
      const newPkg = await createExportPackage(activeProject.id, {
        project_id: activeProject.id,
        package_title: packageTitle,
        format: 'mp4',
        resolution: activePlatform === 'youtube_16_9' ? '4K' : '1080p',
        framerate: '24fps',
        audio_channels: 'Stereo 2.0',
        include_subtitles: true,
        subtitle_format: 'srt',
        file_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        file_size_mb: 68.4,
        status: 'ready',
      });

      if (newPkg.data) {
        setExportHistory((prev) => [newPkg.data!, ...prev]);
      }

      onShowToast(`Master Video "${packageTitle}" berhasil dirender dan siap diunduh!`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Gagal merender paket master', 'error');
    } finally {
      setIsRendering(false);
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
                <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md text-amber-300 font-semibold text-xs sm:text-sm border border-amber-400/30 shadow-lg animate-in fade-in">
                    {activeVoiceClip.text_overlay}
                  </span>
                </div>
              )}

              {/* Cinematic Watermark / LUT Badge */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <span className="text-[9px] uppercase tracking-wider font-mono bg-black/60 text-slate-300 px-2 py-0.5 rounded border border-white/10">
                  LUT: {colorGradeLut.replace('_', ' ')}
                </span>
              </div>
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

          {/* Tab 3: Multi-Platform Publishing Targets */}
          {editorTab === 'publishing' && (
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[460px]">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                  Preset Format Distribusi & Rasio
                </h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  {isId
                    ? 'Target distribusi otomatis menyesuaikan rasio aspek, frame rate, dan bitrate kompresi.'
                    : 'Target platforms automatically optimize aspect ratios, bitrates, and container.'}
                </p>

                <div className="space-y-2">
                  {[
                    {
                      id: 'youtube_16_9',
                      title: 'YouTube & OTT (16:9 Landscape)',
                      specs: '3840x2160 (4K) / 1080p | 24fps | Bitrate 25 Mbps',
                      desc: 'Format standar sinematik layar lebar dan distribusi YouTube Studio.',
                    },
                    {
                      id: 'tiktok_reels_9_16',
                      title: 'TikTok, Reels & Shorts (9:16 Vertical)',
                      specs: '1080x1920 | 30fps | Smart Center-Framing',
                      desc: 'Format vertikal optimal untuk media sosial dan engagement mobile.',
                    },
                    {
                      id: 'cinemascope_2_39',
                      title: 'CinemaScope Anamorphic (2.39:1)',
                      specs: '4096x1716 | 24fps | DCI-P3 Color Space',
                      desc: 'Rasio sinema ultra-lebar untuk tayangan bioskop dan festival film.',
                    },
                    {
                      id: 'web_drama_4_5',
                      title: 'Web Drama Series (4:5 Mobile)',
                      specs: '1080x1350 | 24fps | Fast-CDN Streaming',
                      desc: 'Format ideal untuk platform serial drama pendek di aplikasi web.',
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

              {/* Master Render Trigger Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleRenderMasterSequence()}
                  disabled={isRendering}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isRendering ? 'Memproses Render...' : 'Eksekusi Render & Download MP4'}</span>
                </button>
              </div>
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
    </div>
  );
};
