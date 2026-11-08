import React, { useState, useEffect } from 'react';
import { 
  Clapperboard, 
  Camera, 
  Film, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Eye, 
  Layers, 
  Video, 
  Play, 
  ArrowRight, 
  Sliders,
  Copy,
  Check,
  Download,
  Share2,
  RefreshCw,
  Sun,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Project, SceneItem, Character } from '../../types/database';
import { fetchProjectScenes, fetchCharacters, updateSceneRecord } from '../../lib/supabase';

interface StoryboardShot {
  id: string;
  shot_number: number;
  shot_type: 'wide_establishing' | 'medium_shot' | 'over_the_shoulder' | 'close_up' | 'extreme_close_up' | 'dutch_angle';
  camera_movement: 'static' | 'pan' | 'tilt' | 'dolly_track' | 'crane_boom' | 'handheld';
  focal_length: string;
  framing_description: string;
  character_blocking: string;
  lighting_mood: string;
  visual_prompt: string;
  thumbnail_url?: string;
  status: 'draft' | 'approved' | 'render_ready';
  duration_seconds: number;
}

interface StoryboardViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onNavigateToMediaStudio?: (projectId: string) => void;
  onNavigateToPipeline?: (projectId: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const SHOT_TYPE_CONFIG: Record<StoryboardShot['shot_type'], { label: string; focal: string; icon: any }> = {
  wide_establishing: { label: 'Wide Establishing Shot', focal: '24mm Lens (f/2.8)', icon: Film },
  medium_shot: { label: 'Medium Character Shot', focal: '50mm Lens (f/1.8)', icon: Camera },
  over_the_shoulder: { label: 'Over-The-Shoulder (OTS)', focal: '85mm Lens (f/2.0)', icon: Layers },
  close_up: { label: 'Close-Up Emotional Beat', focal: '105mm Lens (f/1.4)', icon: Eye },
  extreme_close_up: { label: 'Extreme Close-Up (Detail)', focal: 'Macro 100mm (f/2.8)', icon: Maximize2 },
  dutch_angle: { label: 'Dutch Angle Dynamic Action', focal: '35mm Lens (f/2.0)', icon: Video }
};

const CAMERA_MOVEMENT_LABELS: Record<StoryboardShot['camera_movement'], string> = {
  static: 'Static Locked-Off Cam',
  pan: 'Horizontal Pan Tracking',
  tilt: 'Vertical Tilt Up/Down',
  dolly_track: 'Smooth Dolly Push-In / Track',
  crane_boom: 'Dramatic Crane Overhead Boom',
  handheld: 'Kinetic Organic Handheld Shake'
};

const LIGHTING_MOODS = [
  'Volumetric Golden Hour Sunbeams',
  'Moody High-Contrast Chiaroscuro Noir',
  'Bioluminescent Cyberpunk Neon Glow',
  'Mystical Taoist Spiritual Qi Radiance',
  'Overcast Diffused Soft Daylight',
  'Cold Moonlight with Deep Blue Shadows'
];

export const StoryboardView: React.FC<StoryboardViewProps> = ({
  projects,
  selectedProjectId: initialProjectId,
  onSelectProject,
  onNavigateToMediaStudio,
  onNavigateToPipeline,
  onShowToast,
}) => {
  const { t, language } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || projects[0]?.id || ''
  );
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Active scene's generated or cached shots
  const [shots, setShots] = useState<StoryboardShot[]>([]);
  const [selectedShot, setSelectedShot] = useState<StoryboardShot | null>(null);
  const [isGeneratingShots, setIsGeneratingShots] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Modal for new/custom shot
  const [isShotModalOpen, setIsShotModalOpen] = useState(false);
  const [editingShot, setEditingShot] = useState<StoryboardShot | null>(null);

  // Sync external prop
  useEffect(() => {
    if (initialProjectId && initialProjectId !== selectedProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Load scenes and characters when selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      const [scenesRes, charsRes] = await Promise.all([
        fetchProjectScenes(selectedProjectId),
        fetchCharacters(selectedProjectId)
      ]);

      if (!isMounted) return;
      setScenes(scenesRes.data);
      setCharacters(charsRes.data);

      if (scenesRes.data.length > 0) {
        const firstScene = scenesRes.data[0];
        setSelectedSceneId(firstScene.id);
        generateInitialShotsForScene(firstScene, charsRes.data);
      } else {
        setSelectedSceneId('');
        setShots([]);
      }
      setIsLoading(false);
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  // Handle scene selection switch
  const handleSelectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const targetScene = scenes.find(s => s.id === sceneId);
    if (targetScene) {
      generateInitialShotsForScene(targetScene, characters);
    }
  };

  // Shot generator based on scene blocks & characters
  const generateInitialShotsForScene = (scene: SceneItem, chars: Character[]) => {
    const presentChars = chars.filter(c => scene.characters_present?.includes(c.name) || scene.character_ids?.includes(c.id));
    const heroName = presentChars[0]?.name || 'Protagonist';
    const visualSeed = scene.visual_continuity_seed || 'Cinematic master shot, 8k resolution, photorealistic film grain';

    const defaultShots: StoryboardShot[] = [
      {
        id: `shot-${scene.id}-1`,
        shot_number: 1,
        shot_type: 'wide_establishing',
        camera_movement: 'dolly_track',
        focal_length: '24mm Lens (f/2.8)',
        framing_description: `Establishing shot of ${scene.location_name || 'the sacred ancient grounds'}. Environment sets the spatial scale and atmosphere.`,
        character_blocking: `${heroName} enters frame left, taking in the panoramic grandeur of the surroundings.`,
        lighting_mood: scene.time_of_day === 'NIGHT' ? 'Cold Moonlight with Deep Blue Shadows' : 'Volumetric Golden Hour Sunbeams',
        visual_prompt: `${visualSeed}, wide establishing camera angle, ultra-wide 24mm anamorphic lens, grand cinematic composition, atmospheric depth haze`,
        status: 'approved',
        duration_seconds: 4.5
      },
      {
        id: `shot-${scene.id}-2`,
        shot_number: 2,
        shot_type: 'medium_shot',
        camera_movement: 'static',
        focal_length: '50mm Lens (f/1.8)',
        framing_description: `Medium waist-up framing on ${heroName}. Clear visibility of signature robes and determined expression.`,
        character_blocking: `${heroName} halts firmly at center, spiritual energy beginning to swirl subtly around fingertips.`,
        lighting_mood: 'Mystical Taoist Spiritual Qi Radiance',
        visual_prompt: `${visualSeed}, medium shot waist-up portrait of ${heroName}, 50mm prime lens, shallow depth of field, subtle spiritual aura particles, crisp facial focus`,
        status: 'approved',
        duration_seconds: 3.5
      },
      {
        id: `shot-${scene.id}-3`,
        shot_number: 3,
        shot_type: 'over_the_shoulder',
        camera_movement: 'pan',
        focal_length: '85mm Lens (f/2.0)',
        framing_description: `Over-the-shoulder perspective framing the confrontation or dramatic discovery ahead.`,
        character_blocking: `${heroName}'s shoulder in blurred foreground while the focal subject emerges sharp in the background.`,
        lighting_mood: 'Moody High-Contrast Chiaroscuro Noir',
        visual_prompt: `${visualSeed}, cinematic over-the-shoulder shot, 85mm portrait telephoto lens, beautiful bokeh, tension-filled dramatic eye-line`,
        status: 'draft',
        duration_seconds: 4.0
      },
      {
        id: `shot-${scene.id}-4`,
        shot_number: 4,
        shot_type: 'close_up',
        camera_movement: 'dolly_track',
        focal_length: '105mm Lens (f/1.4)',
        framing_description: `Tight emotional close-up on ${heroName}'s eyes as pivotal realization occurs.`,
        character_blocking: `Micro-expressions of resolve and intense emotional focus. Camera slow push-in.`,
        lighting_mood: 'Volumetric Golden Hour Sunbeams',
        visual_prompt: `${visualSeed}, intense cinematic close-up shot, 105mm macro lens, high-fidelity catchlight in eyes, photorealistic skin texture, dramatic cinematic lighting`,
        status: 'render_ready',
        duration_seconds: 3.0
      }
    ];

    setShots(defaultShots);
    setSelectedShot(defaultShots[0]);
  };

  const handleCopyPrompt = (prompt: string, shotId: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPromptId(shotId);
    setTimeout(() => setCopiedPromptId(null), 2000);
    onShowToast('Prompt visual storyboard berhasil disalin ke clipboard.', 'success');
  };

  const handleApproveShot = (shotId: string) => {
    setShots(prev => prev.map(s => s.id === shotId ? { ...s, status: 'approved' } : s));
    onShowToast('Shot storyboard disetujui untuk produksi!', 'success');
  };

  const handleToggleRenderReady = (shotId: string) => {
    setShots(prev => prev.map(s => s.id === shotId ? { 
      ...s, 
      status: s.status === 'render_ready' ? 'approved' : 'render_ready' 
    } : s));
    onShowToast('Status shot diperbarui.', 'info');
  };

  const activeScene = scenes.find(s => s.id === selectedSceneId);
  const currentProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Clapperboard className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Storyboard Studio & Shot List Director
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
              Phase 8 Verified
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Perancangan komposisi visual, sudut kamera, pemblokiran karakter, dan kontinuitas bingkai adegan.
          </p>
        </div>

        {/* Project Selector & Direct Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Proyek:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                if (onSelectProject) onSelectProject(e.target.value);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {onNavigateToMediaStudio && (
            <button
              onClick={() => onNavigateToMediaStudio(selectedProjectId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-700/50 text-purple-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Media Studio</span>
            </button>
          )}

          {onNavigateToPipeline && (
            <button
              onClick={() => onNavigateToPipeline(selectedProjectId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Pipeline QC</span>
            </button>
          )}
        </div>
      </div>

      {/* Scene Selector Strip */}
      {scenes.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-400" />
              <span>Pilih Adegan untuk Storyboard ({scenes.length} Adegan Terdaftar)</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Format: {currentProject?.settings?.aspect_ratio || '16:9'} · {currentProject?.settings?.frame_rate || '24fps'}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {scenes.map((s) => {
              const isSelected = s.id === selectedSceneId;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectScene(s.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30 shadow-sm'
                      : 'bg-slate-950/50 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="font-mono font-bold text-[11px] opacity-80">#{s.scene_number}</span>
                  <span className="truncate max-w-[140px]">{s.title || s.slugline}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Storyboard Grid: Shot List & Active Shot Inspector */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-500 font-mono text-sm">
          Memuat lembar storyboard adegan...
        </div>
      ) : scenes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
          <Clapperboard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Belum Ada Adegan di Proyek Ini</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Buka modul <strong>Cerita & Naskah</strong> untuk menambahkan adegan pertama, lalu kembali ke Storyboard Studio untuk merancang shot visualnya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Shot List Cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Daftar Shot Komposisi Kamera</span>
                  <span className="text-xs font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                    {shots.length} Shots
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeScene ? `${activeScene.slugline} (${activeScene.int_ext} · ${activeScene.time_of_day})` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const newShot: StoryboardShot = {
                      id: `shot-${Date.now()}`,
                      shot_number: shots.length + 1,
                      shot_type: 'close_up',
                      camera_movement: 'dolly_track',
                      focal_length: '85mm Lens (f/1.8)',
                      framing_description: 'Custom dramatic framing shot.',
                      character_blocking: 'Characters positioned according to action beat.',
                      lighting_mood: 'Moody High-Contrast Chiaroscuro Noir',
                      visual_prompt: `${activeScene?.visual_continuity_seed || 'Cinematic shot'}, 8k resolution, photorealistic`,
                      status: 'draft',
                      duration_seconds: 3.0
                    };
                    setShots(prev => [...prev, newShot]);
                    setSelectedShot(newShot);
                    onShowToast('Shot baru berhasil ditambahkan.', 'success');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tambah Shot</span>
                </button>
              </div>
            </div>

            {/* Shots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {shots.map((shot) => {
                const isSelected = selectedShot?.id === shot.id;
                const typeConfig = SHOT_TYPE_CONFIG[shot.shot_type] || SHOT_TYPE_CONFIG.medium_shot;
                const TypeIcon = typeConfig.icon;

                return (
                  <div
                    key={shot.id}
                    onClick={() => setSelectedShot(shot)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-[#121B2F] border-amber-400/60 shadow-lg shadow-amber-400/5'
                        : 'bg-[#101726] border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Shot Card Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          SHOT #{shot.shot_number}
                        </span>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          shot.status === 'render_ready'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : shot.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {shot.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Mock Frame Visual Aspect Preview */}
                      <div className="w-full aspect-video bg-slate-950 rounded-lg border border-slate-800/80 relative overflow-hidden flex items-center justify-center mb-3 group-hover:border-slate-700">
                        {/* Film Grid Crosshair */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20 border border-slate-700">
                          <div className="border-r border-b border-slate-700" />
                          <div className="border-r border-b border-slate-700" />
                          <div className="border-b border-slate-700" />
                          <div className="border-r border-b border-slate-700" />
                          <div className="border-r border-b border-slate-700" />
                          <div className="border-b border-slate-700" />
                          <div className="border-r border-slate-700" />
                          <div className="border-r border-slate-700" />
                          <div />
                        </div>

                        <div className="text-center p-3 relative z-10">
                          <TypeIcon className="w-6 h-6 text-slate-600 mx-auto mb-1 group-hover:text-amber-400 transition-colors" />
                          <div className="text-[11px] font-bold text-slate-300">{typeConfig.label}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{typeConfig.focal}</div>
                        </div>

                        <div className="absolute bottom-2 right-2 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                          {shot.duration_seconds}s
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-200 line-clamp-2">
                          {shot.framing_description}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {shot.character_blocking}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Camera className="w-3 h-3 text-amber-400" />
                        <span>{CAMERA_MOVEMENT_LABELS[shot.camera_movement]}</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPrompt(shot.visual_prompt, shot.id);
                        }}
                        className="text-slate-500 hover:text-amber-400 p-1"
                        title="Salin Prompt Shot"
                      >
                        {copiedPromptId === shot.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 1 Col: Shot Detail Inspector & Prompt Generator */}
          {selectedShot ? (
            <div className="p-5 rounded-xl bg-[#101726] border border-slate-800/80 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Detail Shot #{selectedShot.shot_number}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {selectedShot.status !== 'approved' && (
                    <button
                      onClick={() => handleApproveShot(selectedShot.id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Setujui</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleRenderReady(selectedShot.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-xs font-medium hover:bg-purple-500/20"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Render Ready</span>
                  </button>
                </div>
              </div>

              {/* Shot Parameters */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-medium block mb-1">Tipe Sudut Pengambilan (Camera Angle)</label>
                  <select
                    value={selectedShot.shot_type}
                    onChange={(e) => {
                      const newType = e.target.value as StoryboardShot['shot_type'];
                      setShots(prev => prev.map(s => s.id === selectedShot.id ? { 
                        ...s, 
                        shot_type: newType, 
                        focal_length: SHOT_TYPE_CONFIG[newType].focal 
                      } : s));
                      setSelectedShot({ 
                        ...selectedShot, 
                        shot_type: newType, 
                        focal_length: SHOT_TYPE_CONFIG[newType].focal 
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50"
                  >
                    {Object.entries(SHOT_TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label} — {v.focal}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Pergerakan Kamera (Camera Motion)</label>
                  <select
                    value={selectedShot.camera_movement}
                    onChange={(e) => {
                      const newMov = e.target.value as StoryboardShot['camera_movement'];
                      setShots(prev => prev.map(s => s.id === selectedShot.id ? { ...s, camera_movement: newMov } : s));
                      setSelectedShot({ ...selectedShot, camera_movement: newMov });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50"
                  >
                    {Object.entries(CAMERA_MOVEMENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Tata Cahaya & Mood (Lighting Tone)</label>
                  <select
                    value={selectedShot.lighting_mood}
                    onChange={(e) => {
                      const newMood = e.target.value;
                      setShots(prev => prev.map(s => s.id === selectedShot.id ? { ...s, lighting_mood: newMood } : s));
                      setSelectedShot({ ...selectedShot, lighting_mood: newMood });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50"
                  >
                    {LIGHTING_MOODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Deskripsi Komposisi Framing</label>
                  <textarea
                    rows={2}
                    value={selectedShot.framing_description}
                    onChange={(e) => {
                      const val = e.target.value;
                      setShots(prev => prev.map(s => s.id === selectedShot.id ? { ...s, framing_description: val } : s));
                      setSelectedShot({ ...selectedShot, framing_description: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50 leading-relaxed resize-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Pemblokiran Karakter (Actor Staging)</label>
                  <textarea
                    rows={2}
                    value={selectedShot.character_blocking}
                    onChange={(e) => {
                      const val = e.target.value;
                      setShots(prev => prev.map(s => s.id === selectedShot.id ? { ...s, character_blocking: val } : s));
                      setSelectedShot({ ...selectedShot, character_blocking: val });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50 leading-relaxed resize-none"
                  />
                </div>
              </div>

              {/* Prompt Visual Synthesis Block */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Visual Continuity Seed Prompt</span>
                  </span>
                  <button
                    onClick={() => handleCopyPrompt(selectedShot.visual_prompt, selectedShot.id)}
                    className="text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedPromptId === selectedShot.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>Salin</span>
                  </button>
                </div>

                <p className="text-[11px] font-mono text-slate-300 leading-relaxed break-words bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                  {selectedShot.visual_prompt}
                </p>

                <div className="text-[10px] text-slate-500">
                  Prompt ini siap disuntikkan ke <strong>Media Studio (gemini-3.1-flash-lite-image)</strong> untuk menghasilkan visual keyframe shot yang konsisten.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-[#101726] border border-slate-800/80 text-slate-500 text-xs">
              Pilih shot di sebelah kiri untuk melihat dan menyunting detail framing kamera.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
