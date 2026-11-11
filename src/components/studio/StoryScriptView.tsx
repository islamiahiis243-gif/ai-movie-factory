import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Project,
  StoryConcept,
  Season,
  Episode,
  SceneItem,
  ScriptBlock,
  ScriptBlockType,
  Character,
  ScriptVersion,
  NarrativeStructure,
  MultilingualScriptTranslation,
} from '../../types/database';
import { translateScriptScene, SUPPORTED_LANGUAGES } from '../../lib/multilingualAdapters';
import {
  fetchStoryConcept,
  saveStoryConceptRecord,
  fetchSeasons,
  createSeasonRecord,
  updateSeasonRecord,
  deleteSeasonRecord,
  fetchEpisodes,
  createEpisodeRecord,
  updateEpisodeRecord,
  deleteEpisodeRecord,
  fetchScenes,
  createSceneRecord,
  updateSceneRecord,
  deleteSceneRecord,
  approveSceneScript,
  createScriptVersionRecord,
  fetchScriptVersions,
  fetchCharacters,
  supabase,
} from '../../lib/supabase';
import { SceneModal } from './SceneModal';
import {
  ScrollText,
  Layers,
  Film,
  Clapperboard,
  Plus,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
  Copy,
  Edit2,
  Trash2,
  Check,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  History,
  ShieldCheck,
  Users,
  Video,
  Music,
  FileText,
  AlertCircle,
  Globe,
} from 'lucide-react';

function parseScreenplayTextToBlocks(text: string, defaultCharName: string): ScriptBlock[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks: ScriptBlock[] = [];
  let pendingChar: string | null = null;
  let pendingParenthetical: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(CUT TO|FADE IN|FADE OUT|DISSOLVE TO|SMASH CUT):?$/i.test(line)) {
      blocks.push({
        id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'transition',
        text: line.toUpperCase(),
      });
      pendingChar = null;
      pendingParenthetical = null;
      continue;
    }
    if (/^\(.*\)$/.test(line)) {
      pendingParenthetical = line;
      continue;
    }
    if (/^[A-Z0-9\s_'-]{2,28}$/.test(line) && !line.includes('.') && i < lines.length - 1) {
      pendingChar = line;
      continue;
    }
    if (pendingChar) {
      if (pendingParenthetical) {
        blocks.push({
          id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'parenthetical',
          text: pendingParenthetical,
        });
        pendingParenthetical = null;
      }
      blocks.push({
        id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type: 'dialogue',
        character_name: pendingChar,
        text: line,
      });
      pendingChar = null;
      continue;
    }
    blocks.push({
      id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type: 'action',
      text: line,
    });
  }
  return blocks.length > 0
    ? blocks
    : [
        {
          id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'action',
          text: text.trim(),
        },
      ];
}

function generateFallbackScriptBlocks(
  objective: string,
  tone: string,
  characterName: string,
  slugline: string,
  userPrompt?: string
): { blocks: ScriptBlock[]; visualSeed: string } {
  const char = characterName || 'PENDEKAR';
  const promptContext = userPrompt ? `(${userPrompt})` : '';

  if (objective === 'dialogue') {
    return {
      blocks: [
        {
          id: `blk-${Date.now()}-1`,
          type: 'parenthetical',
          text: `(menatap tajam dengan aura ${tone.toLowerCase()}, napas teratur)`,
        },
        {
          id: `blk-${Date.now()}-2`,
          type: 'dialogue',
          character_name: char,
          text:
            userPrompt ||
            'Setiap tetes darah yang jatuh di tanah ini telah ditentukan oleh garis takdir semesta. Kita tidak akan mundur selangkah pun!',
        },
      ],
      visualSeed: `${slugline}, medium close-up of ${char}, intense facial expression, volumetric rim lighting, ${tone} atmosphere, cinematic 8k`,
    };
  }

  if (objective === 'visual_continuity') {
    return {
      blocks: [
        {
          id: `blk-${Date.now()}-1`,
          type: 'action',
          text: `Suasana ${slugline} dipenuhi kabut tipis keemasan. ${char} berdiri tegak di tengah bingkai komposisi sinematik, bayangannya memanjang di lantai batu kuno. ${promptContext}`,
        },
      ],
      visualSeed: `${slugline}, photorealistic cinematic master shot, anamorphic lens 35mm, volumetric golden rays, dust motes floating in air, ${tone} color grade, ultra-high fidelity`,
    };
  }

  if (objective === 'scene_expansion') {
    return {
      blocks: [
        {
          id: `blk-${Date.now()}-1`,
          type: 'action',
          text: `Kamera bergerak lambat menyusuri ${slugline}. Angin dingin menyapu helai jubah ${char}, menciptakan ketegangan yang pekat. ${promptContext}`,
        },
        {
          id: `blk-${Date.now()}-2`,
          type: 'parenthetical',
          text: '(berbisik lirih penuh tekad)',
        },
        {
          id: `blk-${Date.now()}-3`,
          type: 'dialogue',
          character_name: char,
          text: 'Waktunya telah tiba. Gerbang rahasia ini tidak boleh terbuka sebelum segel terakhir terpasang!',
        },
        {
          id: `blk-${Date.now()}-4`,
          type: 'action',
          text: `Dengan satu gerakan kilat, ${char} menghunus bilah pedang. Denting logam memecah keheningan di seluruh ruangan.`,
        },
      ],
      visualSeed: `${slugline}, wide dynamic action staging, ${char} drawing weapon, high contrast chiaroscuro, ${tone} mood, 8k RED Monstro camera capture`,
    };
  }

  return {
    blocks: [
      {
        id: `blk-${Date.now()}-1`,
        type: 'action',
        text: `${char} melangkah perlahan melintasi ${slugline}. ${
          userPrompt ||
          'Hembusan angin membawa percikan bara api di udara. Tatapan matanya mengunci siluet misterius di kejauhan dengan presisi mematikan.'
        }`,
      },
    ],
    visualSeed: `${slugline}, dynamic action beat, ${char} in motion, cinematic depth of field, atmospheric haze, ${tone} tone, 8k resolution`,
  };
}

interface StoryScriptViewProps {
  projects: Project[];
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenCreateProject?: () => void;
}

export const StoryScriptView: React.FC<StoryScriptViewProps> = ({
  projects,
  onShowToast,
  onOpenCreateProject,
}) => {
  const { t } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'concept' | 'hierarchy' | 'scenes' | 'editor'>('scenes');

  // Story Concept state
  const [concept, setConcept] = useState<StoryConcept | null>(null);
  const [isSavingConcept, setIsSavingConcept] = useState(false);

  // Seasons & Episodes hierarchy
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');

  // Scenes list & Active scene
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [activeScene, setActiveScene] = useState<SceneItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Characters for tagging
  const [characters, setCharacters] = useState<Character[]>([]);

  // Modals state
  const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<SceneItem | null>(null);
  const [sceneToDelete, setSceneToDelete] = useState<SceneItem | null>(null);

  // New Season/Episode simple modals
  const [isNewSeasonModalOpen, setIsNewSeasonModalOpen] = useState(false);
  const [newSeasonTitle, setNewSeasonTitle] = useState('');
  const [newSeasonSynopsis, setNewSeasonSynopsis] = useState('');

  const [isNewEpisodeModalOpen, setIsNewEpisodeModalOpen] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpLogline, setNewEpLogline] = useState('');

  // Version snapshot modal
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [versionHistory, setVersionHistory] = useState<ScriptVersion[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Copy prompt state
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Phase 7: Multilingual Script Translation state
  const [isTranslateModalOpen, setIsTranslateModalOpen] = useState(false);
  const [targetTranslateLang, setTargetTranslateLang] = useState<'zh' | 'ja' | 'ko' | 'th' | 'ar' | 'es' | 'en'>('zh');
  const [translationResult, setTranslationResult] = useState<MultilingualScriptTranslation | null>(null);

  // AI Script Assistant State (SSOT Section 10 & Gate 1)
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [aiObjective, setAiObjective] = useState<'action' | 'dialogue' | 'visual_continuity' | 'scene_expansion'>('action');
  const [aiTone, setAiTone] = useState<string>('Cinematic Epic');
  const [aiUserPrompt, setAiUserPrompt] = useState<string>('');
  const [aiSelectedCharacter, setAiSelectedCharacter] = useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiGeneratedBlocks, setAiGeneratedBlocks] = useState<ScriptBlock[]>([]);
  const [aiGeneratedSeed, setAiGeneratedSeed] = useState<string>('');

  // Default project selection
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Load project-scoped data
  useEffect(() => {
    if (!selectedProjectId) return;
    let isMounted = true;

    const loadProjectData = async () => {
      setIsLoading(true);
      // 1. Fetch Concept
      const cRes = await fetchStoryConcept(selectedProjectId);
      if (isMounted && cRes.data) setConcept(cRes.data);

      // 2. Fetch Characters for tagging
      const charsRes = await fetchCharacters(selectedProjectId);
      if (isMounted && charsRes.data) setCharacters(charsRes.data);

      // 3. Fetch Seasons
      const sRes = await fetchSeasons(selectedProjectId);
      if (isMounted) {
        setSeasons(sRes.data);
        if (sRes.data.length > 0) {
          const firstSeasonId = sRes.data[0].id;
          setSelectedSeasonId(firstSeasonId);
          // 4. Fetch Episodes for first season
          const epRes = await fetchEpisodes(firstSeasonId, selectedProjectId);
          setEpisodes(epRes.data);
          if (epRes.data.length > 0) {
            const firstEpId = epRes.data[0].id;
            setSelectedEpisodeId(firstEpId);
            // 5. Fetch Scenes for first episode
            const scRes = await fetchScenes(firstEpId, selectedProjectId);
            setScenes(scRes.data);
            if (scRes.data.length > 0) {
              setActiveScene(scRes.data[0]);
            } else {
              setActiveScene(null);
            }
          } else {
            setSelectedEpisodeId('');
            setScenes([]);
            setActiveScene(null);
          }
        } else {
          setSelectedSeasonId('');
          setEpisodes([]);
          setSelectedEpisodeId('');
          setScenes([]);
          setActiveScene(null);
        }
        setIsLoading(false);
      }
    };

    loadProjectData();
    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  // When season changes, load episodes
  const handleSeasonChange = async (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    const epRes = await fetchEpisodes(seasonId, selectedProjectId);
    setEpisodes(epRes.data);
    if (epRes.data.length > 0) {
      const firstEpId = epRes.data[0].id;
      setSelectedEpisodeId(firstEpId);
      const scRes = await fetchScenes(firstEpId, selectedProjectId);
      setScenes(scRes.data);
      if (scRes.data.length > 0) {
        setActiveScene(scRes.data[0]);
      } else {
        setActiveScene(null);
      }
    } else {
      setSelectedEpisodeId('');
      setScenes([]);
      setActiveScene(null);
    }
  };

  // When episode changes, load scenes
  const handleEpisodeChange = async (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    const scRes = await fetchScenes(episodeId, selectedProjectId);
    setScenes(scRes.data);
    if (scRes.data.length > 0) {
      setActiveScene(scRes.data[0]);
    } else {
      setActiveScene(null);
    }
  };

  // Reload current scenes
  const reloadScenes = async () => {
    if (!selectedEpisodeId) return;
    const scRes = await fetchScenes(selectedEpisodeId, selectedProjectId);
    setScenes(scRes.data);
    if (activeScene) {
      const refreshed = scRes.data.find((s) => s.id === activeScene.id);
      if (refreshed) setActiveScene(refreshed);
    }
  };

  // Save Concept
  const handleSaveConcept = async () => {
    if (!selectedProjectId || !concept) return;
    setIsSavingConcept(true);
    const res = await saveStoryConceptRecord(selectedProjectId, concept);
    setIsSavingConcept(false);
    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      setConcept(res.data);
      onShowToast(t.storyScript.concept.savedSuccess, 'success');
    }
  };

  // Add Season
  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonTitle.trim()) return;
    const nextSeasonNum = seasons.length + 1;
    const res = await createSeasonRecord(selectedProjectId, {
      project_id: selectedProjectId,
      season_number: nextSeasonNum,
      title: newSeasonTitle,
      synopsis: newSeasonSynopsis,
      target_episodes: 12,
      status: 'in_development',
    });

    if (res.error) {
      onShowToast(res.error, 'error');
    } else if (res.season) {
      setSeasons([...seasons, res.season]);
      setSelectedSeasonId(res.season.id);
      setIsNewSeasonModalOpen(false);
      setNewSeasonTitle('');
      setNewSeasonSynopsis('');
      onShowToast(`Musim #${nextSeasonNum} berhasil ditambahkan.`, 'success');
      handleSeasonChange(res.season.id);
    }
  };

  // Add Episode
  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEpTitle.trim() || !selectedSeasonId) return;
    const nextEpNum = episodes.length + 1;
    const res = await createEpisodeRecord(selectedProjectId, {
      project_id: selectedProjectId,
      season_id: selectedSeasonId,
      episode_number: nextEpNum,
      title: newEpTitle,
      logline: newEpLogline,
      synopsis: '',
      target_runtime_minutes: 15,
      scene_count_target: 8,
      status: 'draft',
    });

    if (res.error) {
      onShowToast(res.error, 'error');
    } else if (res.episode) {
      setEpisodes([...episodes, res.episode]);
      setSelectedEpisodeId(res.episode.id);
      setIsNewEpisodeModalOpen(false);
      setNewEpTitle('');
      setNewEpLogline('');
      onShowToast(`Episode #${nextEpNum} berhasil dibuat.`, 'success');
      handleEpisodeChange(res.episode.id);
    }
  };

  // Save Scene Modal Submit
  const handleSceneModalSubmit = async (
    data: Omit<SceneItem, 'id' | 'created_at' | 'updated_at'>
  ) => {
    if (editingScene) {
      const wasApproved = editingScene.approval_status === 'approved';
      const payload: Partial<SceneItem> = {
        ...data,
      };
      if (wasApproved) {
        payload.approval_status = 'draft';
        payload.approved_at = undefined;
        payload.approved_by = undefined;
      }
      const res = await updateSceneRecord(editingScene.id, payload);
      if (res.error) {
        onShowToast(res.error, 'error');
      } else {
        if (wasApproved) {
          onShowToast('Data adegan diperbarui. Persetujuan (Gate 1) dikembalikan ke status Draft untuk ditinjau ulang.', 'info');
        } else {
          onShowToast('Data adegan berhasil diperbarui.', 'success');
        }
        setIsSceneModalOpen(false);
        setEditingScene(null);
        await reloadScenes();
      }
    } else {
      const res = await createSceneRecord(selectedProjectId, selectedEpisodeId, data);
      if (res.error) {
        onShowToast(res.error, 'error');
      } else {
        onShowToast('Adegan baru berhasil ditambahkan.', 'success');
        setIsSceneModalOpen(false);
        await reloadScenes();
        if (res.scene) {
          setActiveScene(res.scene);
        }
      }
    }
  };

  // Delete Scene
  const handleConfirmDeleteScene = async () => {
    if (!sceneToDelete) return;
    const res = await deleteSceneRecord(sceneToDelete.id);
    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      onShowToast('Adegan berhasil dihapus.', 'info');
      if (activeScene?.id === sceneToDelete.id) {
        setActiveScene(null);
      }
      setSceneToDelete(null);
      await reloadScenes();
    }
  };

  // Approve Scene Script (SSOT Section 10 & 37)
  const handleApproveScene = async (sceneId: string) => {
    const targetScene = scenes.find((s) => s.id === sceneId) || activeScene;
    const currentVer = targetScene?.versions_count || 1;
    const res = await approveSceneScript(sceneId, 'Master Director AI / Creator');
    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      // Record immutable audit trail snapshot (LOCKED_V{n}) in script_versions
      if (targetScene && targetScene.blocks && targetScene.blocks.length > 0) {
        await createScriptVersionRecord(sceneId, {
          version_number: currentVer,
          changelog_note: `LOCKED_V${currentVer} - Gate 1 Director Script Approval Checkpoint`,
          blocks: targetScene.blocks,
          created_by: 'Master Director AI / Creator',
        });
      }
      onShowToast(`Naskah adegan telah dikunci sebagai LOCKED_V${currentVer} (Gate 1 Approved & Audit Trail tercatat).`, 'success');
      await reloadScenes();
    }
  };

  // Copy Visual Continuity Prompt
  const handleCopyPrompt = () => {
    if (!activeScene?.visual_continuity_seed) return;
    navigator.clipboard.writeText(activeScene.visual_continuity_seed);
    setCopiedPrompt(true);
    onShowToast(t.storyScript.editor.copyPrompt + ' disalin ke clipboard.', 'success');
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // --- SCRIPT EDITOR BLOCK OPERATIONS ---
  const handleAddBlock = (type: ScriptBlockType) => {
    if (!activeScene) return;
    const newBlock: ScriptBlock = {
      id: `blk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      text: '',
      character_name: type === 'dialogue' ? (characters[0]?.name || 'KARAKTER') : undefined,
    };
    const updatedBlocks = [...(activeScene.blocks || []), newBlock];
    updateActiveSceneBlocks(updatedBlocks);
  };

  const handleUpdateBlock = (index: number, updates: Partial<ScriptBlock>) => {
    if (!activeScene) return;
    const updated = [...(activeScene.blocks || [])];
    updated[index] = { ...updated[index], ...updates };
    updateActiveSceneBlocks(updated);
  };

  const handleRemoveBlock = (index: number) => {
    if (!activeScene) return;
    const updated = (activeScene.blocks || []).filter((_, i) => i !== index);
    updateActiveSceneBlocks(updated);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!activeScene) return;
    const blocks = [...(activeScene.blocks || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const temp = blocks[index];
    blocks[index] = blocks[targetIdx];
    blocks[targetIdx] = temp;
    updateActiveSceneBlocks(blocks);
  };

  const updateActiveSceneBlocks = (blocks: ScriptBlock[]) => {
    if (!activeScene) return;
    setActiveScene({
      ...activeScene,
      blocks,
    });
  };

  const handleSaveActiveScript = async () => {
    if (!activeScene) return;

    const wasApproved = activeScene.approval_status === 'approved';
    const nextVer = wasApproved ? (activeScene.versions_count || 1) + 1 : activeScene.versions_count;

    const payload: Partial<SceneItem> = {
      blocks: activeScene.blocks,
      visual_continuity_seed: activeScene.visual_continuity_seed,
      camera_notes: activeScene.camera_notes,
      audio_sound_notes: activeScene.audio_sound_notes,
    };

    if (wasApproved) {
      // Invalidation Invariant: Modifying script blocks of an approved scene invalidates Gate 1
      payload.approval_status = 'draft';
      payload.approved_at = undefined;
      payload.approved_by = undefined;
      payload.versions_count = nextVer;
    }

    const res = await updateSceneRecord(activeScene.id, payload);

    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      if (wasApproved) {
        onShowToast(
          `Naskah telah diubah. Status persetujuan (Gate 1) otomatis dikembalikan ke "Draft" dan versi dinaikkan ke v${nextVer}. Memerlukan persetujuan sutradara ulang.`,
          'info'
        );
      } else {
        onShowToast('Naskah adegan berhasil disimpan.', 'success');
      }
      await reloadScenes();
    }
  };

  // Create Version Snapshot
  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScene) return;
    const nextVer = (activeScene.versions_count || 1) + 1;
    const res = await createScriptVersionRecord(activeScene.id, {
      version_number: nextVer,
      changelog_note: versionNote || 'Snapshot naskah adegan',
      blocks: activeScene.blocks,
      created_by: 'Kreator',
    });

    if (res.error) {
      onShowToast(res.error, 'error');
    } else {
      await updateSceneRecord(activeScene.id, { versions_count: nextVer });
      setActiveScene({ ...activeScene, versions_count: nextVer });
      onShowToast(`Versi #${nextVer} berhasil disimpan.`, 'success');
      setIsVersionModalOpen(false);
      setVersionNote('');
      await reloadScenes();
    }
  };

  const handleOpenVersionHistory = async () => {
    if (!activeScene) return;
    const res = await fetchScriptVersions(activeScene.id);
    setVersionHistory(res.data);
    setIsHistoryDrawerOpen(true);
  };

  const handleOpenTranslateModal = () => {
    if (!activeScene) return;
    const res = translateScriptScene(
      activeScene.title,
      activeScene.slugline,
      activeScene.blocks || [],
      targetTranslateLang
    );
    setTranslationResult(res);
    setIsTranslateModalOpen(true);
  };

  const handleRunTranslation = (lang: 'zh' | 'ja' | 'ko' | 'th' | 'ar' | 'es' | 'en') => {
    if (!activeScene) return;
    setTargetTranslateLang(lang);
    const res = translateScriptScene(
      activeScene.title,
      activeScene.slugline,
      activeScene.blocks || [],
      lang
    );
    setTranslationResult(res);
  };

  const handleApplyTranslation = () => {
    if (!activeScene || !translationResult) return;
    setActiveScene({
      ...activeScene,
      title: `${activeScene.title} (${translationResult.language.toUpperCase()})`,
      slugline: translationResult.translated_slugline,
      blocks: translationResult.translated_blocks,
    });
    setIsTranslateModalOpen(false);
    onShowToast(`Naskah berhasil dialihkan ke ${translationResult.target_language_name}!`, 'success');
  };

  // AI Script Assistant Handlers (SSOT Section 10 & Gate 1)
  const handleOpenAiAssistantModal = () => {
    if (!activeScene) {
      onShowToast('Pilih atau buat adegan terlebih dahulu sebelum menggunakan Bantuan AI.', 'error');
      return;
    }
    setAiGeneratedBlocks([]);
    setAiGeneratedSeed('');
    setAiUserPrompt('');
    setAiSelectedCharacter(characters[0]?.name || 'KARAKTER');
    setIsAiAssistantOpen(true);
  };

  const handleRunAiScriptAssist = async () => {
    if (!activeScene) return;
    setIsAiGenerating(true);

    try {
      let generatedBlocks: ScriptBlock[] | null = null;
      let generatedSeed: string | null = null;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (token) {
          const resp = await fetch('/api/ai-generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              operation: 'script_outline',
              prompt: `Adegan: ${activeScene.slugline || 'INT. KUIL KUNAL - MALAM'}\nSinopsis: ${activeScene.synopsis || 'Konfrontasi emosional di tengah hujan'}\nTujuan: ${aiObjective}\nNada: ${aiTone}\nKarakter: ${aiSelectedCharacter}\nCatatan Pengguna: ${aiUserPrompt || 'Tuliskan adegan sinematik dramatis berbobot tinggi'}`,
              projectId: selectedProjectId,
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const textOutput = data?.text || data?.data?.text || '';
            if (textOutput) {
              generatedBlocks = parseScreenplayTextToBlocks(textOutput, aiSelectedCharacter);
            }
          }
        }
      } catch (proxyErr) {
        console.warn('AI proxy fetch bypassed/failed, using deterministic fallback:', proxyErr);
      }

      // Fallback to deterministic cinematic screenplay generator if API is unavailable
      if (!generatedBlocks || generatedBlocks.length === 0) {
        const fallback = generateFallbackScriptBlocks(
          aiObjective,
          aiTone,
          aiSelectedCharacter || characters[0]?.name || 'PENDEKAR',
          activeScene.slugline || 'INT. RUANG UTAMA - MALAM',
          aiUserPrompt
        );
        generatedBlocks = fallback.blocks;
        generatedSeed = fallback.visualSeed;
      }

      setAiGeneratedBlocks(generatedBlocks);
      if (generatedSeed) setAiGeneratedSeed(generatedSeed);
      onShowToast(`Bantuan AI berhasil menghasilkan ${generatedBlocks.length} blok naskah.`, 'success');
    } catch (err: any) {
      console.error('AI Script assist error:', err);
      onShowToast(`Gagal menghasilkan naskah AI: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleApplyAiBlocks = (mode: 'append' | 'replace') => {
    if (!activeScene || aiGeneratedBlocks.length === 0) return;

    let updatedBlocks: ScriptBlock[];
    if (mode === 'replace') {
      updatedBlocks = [...aiGeneratedBlocks];
    } else {
      updatedBlocks = [...(activeScene.blocks || []), ...aiGeneratedBlocks];
    }

    const updatedScene: SceneItem = {
      ...activeScene,
      blocks: updatedBlocks,
      visual_continuity_seed: aiGeneratedSeed || activeScene.visual_continuity_seed,
    };

    setActiveScene(updatedScene);
    setIsAiAssistantOpen(false);
    onShowToast(
      mode === 'replace'
        ? 'Seluruh naskah adegan digantikan dengan hasil AI.'
        : `${aiGeneratedBlocks.length} blok naskah AI berhasil disisipkan ke naskah adegan.`,
      'success'
    );
  };

  if (projects.length === 0) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ScrollText className="w-12 h-12 text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">{t.storyScript.title}</h3>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Anda belum memiliki proyek. Buat proyek terlebih dahulu sebelum menyusun naskah dan adegan.
        </p>
        {onOpenCreateProject && (
          <button
            onClick={onOpenCreateProject}
            className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
          >
            Buat Proyek Baru
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Project Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ScrollText className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100">{t.storyScript.title}</h1>
          </div>
          <p className="text-xs text-slate-400">{t.storyScript.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t.storyScript.selectProject}</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400/50"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.genre})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary Navigation Segmented Control */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800/80 rounded-lg overflow-x-auto">
        <button
          onClick={() => setActiveTab('concept')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'concept'
              ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t.storyScript.conceptTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'hierarchy'
              ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t.storyScript.hierarchyTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('scenes')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'scenes'
              ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>{t.storyScript.sceneRosterTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clapperboard className="w-3.5 h-3.5" />
          <span>{t.storyScript.scriptEditorTab}</span>
        </button>
      </div>

      {/* --- TAB 1: STORY CONCEPT & PREMISE (SSOT Section 10) --- */}
      {activeTab === 'concept' && concept && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>{t.storyScript.concept.title}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Pondasi logline, struktur narasi (Three-Act / Kishōtenketsu), dan tema sentral film/serial.
              </p>
            </div>
            <button
              onClick={handleSaveConcept}
              disabled={isSavingConcept}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingConcept ? 'Menyimpan...' : t.storyScript.concept.saveBtn}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                {t.storyScript.concept.logline} *
              </label>
              <input
                type="text"
                value={concept.logline}
                onChange={(e) => setConcept({ ...concept, logline: e.target.value })}
                placeholder="Contoh: Seorang kaisar pedang yang dikhianati 3000 tahun silam terbangun di raga pemuda buangan..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  {t.storyScript.concept.narrativeStructure}
                </label>
                <select
                  value={concept.narrative_structure}
                  onChange={(e) =>
                    setConcept({
                      ...concept,
                      narrative_structure: e.target.value as NarrativeStructure,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50"
                >
                  <option value="three_act">{t.storyScript.structures.three_act}</option>
                  <option value="kishotenketsu">{t.storyScript.structures.kishotenketsu}</option>
                  <option value="five_act">{t.storyScript.structures.five_act}</option>
                  <option value="heros_journey">{t.storyScript.structures.heros_journey}</option>
                  <option value="danmei_tension">{t.storyScript.structures.danmei_tension}</option>
                  <option value="custom">{t.storyScript.structures.custom}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  {t.storyScript.concept.theme}
                </label>
                <input
                  type="text"
                  value={concept.theme}
                  onChange={(e) => setConcept({ ...concept, theme: e.target.value })}
                  placeholder="Contoh: Kehendak tak terpatahkan melawan takdir kosmik..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                {t.storyScript.concept.synopsis}
              </label>
              <textarea
                rows={5}
                value={concept.synopsis}
                onChange={(e) => setConcept({ ...concept, synopsis: e.target.value })}
                placeholder="Rangkuman narasi menyeluruh dari babak awal, konflik eskalasi, hingga klimaks..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  {t.storyScript.concept.toneStyle}
                </label>
                <input
                  type="text"
                  value={concept.tone_style}
                  onChange={(e) => setConcept({ ...concept, tone_style: e.target.value })}
                  placeholder="Contoh: Epik, dramatis, atmosferik mitologi Taois..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  {t.storyScript.concept.targetAudience}
                </label>
                <input
                  type="text"
                  value={concept.target_audience}
                  onChange={(e) => setConcept({ ...concept, target_audience: e.target.value })}
                  placeholder="Contoh: Penggemar Donghua, novel kultivasi Xianxia usia 16-35 tahun"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: SEASON & EPISODE HIERARCHY (SSOT Section 10 & 37) --- */}
      {activeTab === 'hierarchy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Seasons Column */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>{t.storyScript.seasons.title}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pembagian babak makro produksi ke dalam musim berjenjang.
                </p>
              </div>
              <button
                onClick={() => setIsNewSeasonModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.storyScript.seasons.addSeason}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {seasons.map((s) => {
                const isSelected = s.id === selectedSeasonId;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSeasonChange(s.id)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/10 border-amber-400/40 text-slate-100'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-amber-400 font-bold tabular-nums">
                        Musim #{s.season_number}
                      </span>
                      <span className="text-[11px] text-slate-400 capitalize">{s.status}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100 mt-1">{s.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {s.synopsis || 'Belum ada sinopsis musim.'}
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
                      Target: {s.target_episodes} Episode
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Episodes Column */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>
                    {t.storyScript.episodes.title} (
                    {seasons.find((s) => s.id === selectedSeasonId)?.title || 'Pilih Musim'})
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daftar episode tayang dalam musim yang dipilih.
                </p>
              </div>
              <button
                onClick={() => setIsNewEpisodeModalOpen(true)}
                disabled={!selectedSeasonId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.storyScript.episodes.addEpisode}</span>
              </button>
            </div>

            {episodes.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                Belum ada episode di musim ini. Buat episode pertama.
              </div>
            ) : (
              <div className="space-y-2.5">
                {episodes.map((ep) => {
                  const isSelected = ep.id === selectedEpisodeId;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => handleEpisodeChange(ep.id)}
                      className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400/10 border-amber-400/40 text-slate-100'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-amber-400 font-bold tabular-nums">
                          Episode #{ep.episode_number}
                        </span>
                        <span className="text-[11px] text-slate-400 capitalize">{ep.status}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-100 mt-1">{ep.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {ep.logline || ep.synopsis || 'Belum ada logline episode.'}
                      </p>
                      <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Durasi: {ep.target_runtime_minutes} mnt</span>
                        <span>Target: {ep.scene_count_target} Adegan</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: SCENE BREAKDOWN & ROSTER (SSOT Section 10 & 11) --- */}
      {activeTab === 'scenes' && (
        <div className="space-y-4">
          {/* Season & Episode Switcher Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Musim:</span>
                <select
                  value={selectedSeasonId}
                  onChange={(e) => handleSeasonChange(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none"
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      Musim #{s.season_number}: {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Episode:</span>
                <select
                  value={selectedEpisodeId}
                  onChange={(e) => handleEpisodeChange(e.target.value)}
                  className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none"
                >
                  {episodes.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      Ep #{ep.episode_number}: {ep.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingScene(null);
                setIsSceneModalOpen(true);
              }}
              disabled={!selectedEpisodeId}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.storyScript.scenes.addScene}</span>
            </button>
          </div>

          {/* Scenes Roster Table */}
          {scenes.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30 p-8 space-y-3">
              <Film className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t.storyScript.scenes.emptyState}
              </p>
              <button
                onClick={() => {
                  setEditingScene(null);
                  setIsSceneModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
              >
                {t.storyScript.scenes.addScene}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Gate 1 Script Approval Status Header */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white">Gate 1: Script Approval Gate</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({scenes.filter((s) => s.approval_status === 'approved').length}/{scenes.length} Adegan Disetujui)
                  </span>
                  {scenes.every((s) => s.approval_status === 'approved') && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      SSOT Terkunci
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {scenes.some((s) => s.approval_status !== 'approved') && (
                    <button
                      onClick={async () => {
                        for (const sc of scenes.filter((s) => s.approval_status !== 'approved')) {
                          await handleApproveScene(sc.id);
                        }
                        onShowToast('Seluruh adegan naskah disetujui (Gate 1 Lulus)!', 'success');
                      }}
                      className="px-2.5 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Setujui Semua Naskah (Kunci Gate 1)
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 font-medium">
                      <th className="py-2.5 px-4 w-16">No.</th>
                      <th className="py-2.5 px-4">Slugline / Header</th>
                      <th className="py-2.5 px-4">Judul & Beat Emosional</th>
                      <th className="py-2.5 px-4">Karakter Hadir</th>
                      <th className="py-2.5 px-4">Durasi</th>
                      <th className="py-2.5 px-4">Status Approval</th>
                      <th className="py-2.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {scenes.map((sc) => {
                      const isApproved = sc.approval_status === 'approved';
                      return (
                        <tr key={sc.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-amber-400 tabular-nums">
                            #{sc.scene_number}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-200 font-semibold whitespace-nowrap">
                            {sc.slugline}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-slate-100">{sc.title}</div>
                            {sc.emotional_beat && (
                              <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                Beat: {sc.emotional_beat}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-300 max-w-xs truncate">
                            {sc.characters_present && sc.characters_present.length > 0
                              ? sc.characters_present.join(', ')
                              : '—'}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-400">
                            {sc.estimated_duration_seconds}s
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {/* Unboxed Metadata with Typographic Indicator */}
                            <div className="flex items-center gap-1.5 text-[11px]">
                              {isApproved ? (
                                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{t.storyScript.scenes.approvedBadge}</span>
                                </span>
                              ) : sc.approval_status === 'in_review' ? (
                                <span className="text-amber-400 flex items-center gap-1 font-medium">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{t.storyScript.scenes.inReviewBadge}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 flex items-center gap-1">
                                  <span>{t.storyScript.scenes.draftBadge}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open Script Editor */}
                              <button
                                onClick={() => {
                                  setActiveScene(sc);
                                  setActiveTab('editor');
                                }}
                                className="px-2.5 py-1 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 border border-amber-400/20 text-[11px] font-medium rounded transition-colors cursor-pointer"
                              >
                                Buka Naskah
                              </button>

                              {/* Approve Button */}
                              {!isApproved && (
                                <button
                                  onClick={() => handleApproveScene(sc.id)}
                                  className="p-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                                  title={t.storyScript.scenes.approveAction}
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              )}

                              {/* Edit Metadata */}
                              <button
                                onClick={() => {
                                  setEditingScene(sc);
                                  setIsSceneModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                                title="Ubah Info Adegan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setSceneToDelete(sc)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Hapus Adegan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* --- TAB 4: CINEMATIC SCREENPLAY EDITOR (SSOT Section 10 & 38) --- */}
      {activeTab === 'editor' && (
        <div className="space-y-4">
          {!activeScene ? (
            <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30 p-8 space-y-3">
              <Clapperboard className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Pilih adegan dari tab "Daftar Adegan" untuk membuka dan menyusun naskah sinematik.
              </p>
              <button
                onClick={() => setActiveTab('scenes')}
                className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
              >
                Lihat Daftar Adegan
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scene Slugline & Workflow Bar */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
                      Adegan #{activeScene.scene_number}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-100 tracking-wide">
                      {activeScene.slugline}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200 mt-0.5">
                    {activeScene.title}
                  </h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                    <span>Versi #{activeScene.versions_count || 1}</span>
                    <span aria-hidden="true">·</span>
                    <span>Durasi: {activeScene.estimated_duration_seconds}s</span>
                    <span aria-hidden="true">·</span>
                    {activeScene.approval_status === 'approved' ? (
                      <span className="text-emerald-400 font-medium">Disetujui</span>
                    ) : (
                      <span className="text-amber-400 font-medium capitalize">
                        {activeScene.approval_status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Approve Checkpoint */}
                  {activeScene.approval_status !== 'approved' && (
                    <button
                      onClick={() => handleApproveScene(activeScene.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t.storyScript.scenes.approveAction}</span>
                    </button>
                  )}

                  {/* Version Snapshot */}
                  <button
                    onClick={() => setIsVersionModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t.storyScript.editor.saveNewVersion}</span>
                  </button>

                  {/* Version History */}
                  <button
                    onClick={handleOpenVersionHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{t.storyScript.editor.versionHistory}</span>
                  </button>

                  {/* Phase 2: AI Script Assistant */}
                  <button
                    onClick={handleOpenAiAssistantModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    title="Bantuan AI: Generate aksi, dialog sinematik, dan kontinuitas visual adegan"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bantuan AI</span>
                  </button>

                  {/* Phase 7: Multilingual Script Translation */}
                  <button
                    onClick={handleOpenTranslateModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    title="Adaptasi naskah ke Mandarin, Jepang, Korea, Arab, Spanyol (SSOT Section 42)"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Adaptasi Bahasa</span>
                  </button>

                  {/* Save Script */}
                  <button
                    onClick={handleSaveActiveScript}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{t.storyScript.editor.saveScript}</span>
                  </button>
                </div>
              </div>

              {/* Visual Prompt Continuity Strip */}
              {activeScene.visual_continuity_seed && (
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-400 shrink-0">Prompt Visual:</span>
                    <span className="font-mono text-[11px] text-slate-300 truncate">
                      {activeScene.visual_continuity_seed}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded transition-colors shrink-0 cursor-pointer"
                  >
                    {copiedPrompt ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-amber-400" />
                    )}
                    <span>Salin</span>
                  </button>
                </div>
              )}

              {/* Screenplay Document Sheet */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-8 space-y-6 max-w-4xl mx-auto shadow-2xl font-serif">
                {/* Screenplay Slugline Heading */}
                <div className="text-center border-b border-slate-800 pb-4">
                  <h2 className="text-sm font-mono font-bold tracking-widest text-amber-400">
                    {activeScene.slugline}
                  </h2>
                  <p className="text-xs text-slate-400 font-sans mt-1">
                    {activeScene.synopsis || '—'}
                  </p>
                </div>

                {/* Blocks List */}
                <div className="space-y-4">
                  {(!activeScene.blocks || activeScene.blocks.length === 0) ? (
                    <div className="py-8 text-center text-xs text-slate-500 font-sans">
                      Naskah adegan masih kosong. Tambahkan blok aksi atau dialog di bawah.
                    </div>
                  ) : (
                    activeScene.blocks.map((block, bIdx) => (
                      <div
                        key={block.id || bIdx}
                        className="group relative p-3 rounded-lg border border-transparent hover:border-slate-800 hover:bg-slate-900/40 transition-colors"
                      >
                        {/* Block Reorder & Delete Floating Toolbar */}
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-1 shadow-lg z-10 font-sans">
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(bIdx, 'up')}
                            disabled={bIdx === 0}
                            className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                            title="Pindah Ke Atas"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(bIdx, 'down')}
                            disabled={bIdx === activeScene.blocks.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                            title="Pindah Ke Bawah"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlock(bIdx)}
                            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                            title="Hapus Blok"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* BLOCK TYPE: ACTION */}
                        {block.type === 'action' && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-slate-500 font-sans uppercase">
                              ACTION
                            </span>
                            <textarea
                              rows={3}
                              value={block.text}
                              onChange={(e) => handleUpdateBlock(bIdx, { text: e.target.value })}
                              placeholder={t.storyScript.editor.actionPlaceholder}
                              className="w-full bg-transparent border-0 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400/30 rounded p-1 leading-relaxed resize-y font-sans"
                            />
                          </div>
                        )}

                        {/* BLOCK TYPE: DIALOGUE */}
                        {block.type === 'dialogue' && (
                          <div className="max-w-md mx-auto space-y-1.5 text-center font-sans">
                            {/* Speaker Header */}
                            <div className="flex items-center justify-center gap-2">
                              <select
                                value={block.character_name || ''}
                                onChange={(e) =>
                                  handleUpdateBlock(bIdx, { character_name: e.target.value })
                                }
                                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider focus:outline-none"
                              >
                                {characters.map((c) => (
                                  <option key={c.id} value={c.name.toUpperCase()}>
                                    {c.name.toUpperCase()}
                                  </option>
                                ))}
                                <option value="NARATOR">NARATOR</option>
                                <option value="SUARA MISTERIUS">SUARA MISTERIUS</option>
                              </select>
                            </div>

                            {/* Parenthetical Tone Note */}
                            <input
                              type="text"
                              value={block.delivery_note || ''}
                              onChange={(e) =>
                                handleUpdateBlock(bIdx, { delivery_note: e.target.value })
                              }
                              placeholder={t.storyScript.editor.deliveryPlaceholder}
                              className="w-full text-center bg-transparent border-0 text-[11px] text-slate-400 italic focus:outline-none focus:ring-1 focus:ring-amber-400/30 rounded"
                            />

                            {/* Spoken Text */}
                            <textarea
                              rows={2}
                              value={block.text}
                              onChange={(e) => handleUpdateBlock(bIdx, { text: e.target.value })}
                              placeholder={t.storyScript.editor.dialoguePlaceholder}
                              className="w-full text-center bg-transparent border-0 text-xs text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-amber-400/30 rounded leading-relaxed resize-y"
                            />
                          </div>
                        )}

                        {/* BLOCK TYPE: TRANSITION */}
                        {block.type === 'transition' && (
                          <div className="text-right font-mono text-xs text-amber-400 font-bold uppercase tracking-wider font-sans">
                            <input
                              type="text"
                              value={block.text}
                              onChange={(e) => handleUpdateBlock(bIdx, { text: e.target.value })}
                              placeholder="CUT TO:"
                              className="bg-transparent border-0 text-right focus:outline-none focus:ring-1 focus:ring-amber-400/30 rounded px-2 py-1"
                            />
                          </div>
                        )}

                        {/* BLOCK TYPE: PARENTHETICAL */}
                        {block.type === 'parenthetical' && (
                          <div className="text-center italic text-[11px] text-slate-400 font-sans">
                            <input
                              type="text"
                              value={block.text}
                              onChange={(e) => handleUpdateBlock(bIdx, { text: e.target.value })}
                              placeholder="(nada bicara/emosi)"
                              className="bg-transparent border-0 text-center focus:outline-none focus:ring-1 focus:ring-amber-400/30 rounded w-full"
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Block Toolbar */}
                <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-2 font-sans">
                  <button
                    type="button"
                    onClick={() => handleAddBlock('action')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.storyScript.editor.addAction}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBlock('dialogue')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.storyScript.editor.addDialogue}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBlock('parenthetical')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.storyScript.editor.addParenthetical}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBlock('transition')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.storyScript.editor.addTransition}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAiAssistantModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/15 to-purple-500/15 hover:from-amber-500/25 hover:to-purple-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    title="Buka asisten AI untuk generate aksi, dialog, dan beat sinematik"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bantuan AI Script</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SCENE MODAL --- */}
      <SceneModal
        isOpen={isSceneModalOpen}
        scene={editingScene}
        episodeId={selectedEpisodeId}
        projectId={selectedProjectId}
        existingScenesCount={scenes.length}
        availableCharacters={characters}
        onClose={() => {
          setIsSceneModalOpen(false);
          setEditingScene(null);
        }}
        onSubmit={handleSceneModalSubmit}
      />

      {/* --- NEW SEASON MODAL --- */}
      {isNewSeasonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Tambah Musim Baru</h3>
            <form onSubmit={handleCreateSeason} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Judul Musim *</label>
                <input
                  type="text"
                  required
                  value={newSeasonTitle}
                  onChange={(e) => setNewSeasonTitle(e.target.value)}
                  placeholder="Contoh: Musim 2: Badai di Puncak Teratai"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Sinopsis Singkat</label>
                <textarea
                  rows={3}
                  value={newSeasonSynopsis}
                  onChange={(e) => setNewSeasonSynopsis(e.target.value)}
                  placeholder="Babak perkembangan cerita di musim ini..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewSeasonModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!newSeasonTitle.trim()}
                  className="px-4 py-1.5 bg-amber-400 text-slate-950 font-semibold rounded-lg hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                >
                  Simpan Musim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NEW EPISODE MODAL --- */}
      {isNewEpisodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Tambah Episode Baru</h3>
            <form onSubmit={handleCreateEpisode} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Judul Episode *</label>
                <input
                  type="text"
                  required
                  value={newEpTitle}
                  onChange={(e) => setNewEpTitle(e.target.value)}
                  placeholder="Contoh: Episode 3: Jebakan di Jurang Gelap"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Logline Episode</label>
                <textarea
                  rows={2}
                  value={newEpLogline}
                  onChange={(e) => setNewEpLogline(e.target.value)}
                  placeholder="Satu kalimat premis adegan penggerak episode..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewEpisodeModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!newEpTitle.trim()}
                  className="px-4 py-1.5 bg-amber-400 text-slate-950 font-semibold rounded-lg hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                >
                  Simpan Episode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VERSION SNAPSHOT MODAL --- */}
      {isVersionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Simpan Snapshot Versi Naskah</h3>
            <form onSubmit={handleCreateSnapshot} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Catatan Perubahan (Changelog)</label>
                <textarea
                  rows={3}
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  placeholder={t.storyScript.editor.changelogPlaceholder}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsVersionModalOpen(false)}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-400 text-slate-950 font-semibold rounded-lg hover:bg-amber-300 cursor-pointer"
                >
                  Rekam Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VERSION HISTORY DRAWER / MODAL --- */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <span>{t.storyScript.editor.versionHistory}</span>
              </h3>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>

            {versionHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Belum ada snapshot versi terdahulu yang terekam.
              </p>
            ) : (
              <div className="space-y-3">
                {versionHistory.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400">
                        Versi #{ver.version_number}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(ver.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{ver.changelog_note}</p>
                    <div className="text-[10px] text-slate-500">
                      Jumlah Blok: {ver.blocks?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DELETE SCENE CONFIRMATION MODAL --- */}
      {sceneToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Hapus Adegan</h3>
            <p className="text-xs text-slate-400">
              {t.storyScript.confirmDeleteScene} (
              <strong className="text-slate-200">
                #{sceneToDelete.scene_number} {sceneToDelete.title}
              </strong>
              )
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSceneToDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteScene}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-500 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PHASE 7: MULTILINGUAL SCRIPT TRANSLATION MODAL --- */}
      {isTranslateModalOpen && activeScene && translationResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Adaptasi Naskah Multibahasa (Phase 7)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Konversi naskah skenario dengan penyesuaian register budaya dan honorifik.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTranslateModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Target Language Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Pilih Bahasa Target:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = targetTranslateLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleRunTranslation(lang.code as any)}
                      className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-sm shadow-indigo-950/50'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{lang.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{lang.nativeName}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cultural Notes Banner */}
            {translationResult.cultural_notes && translationResult.cultural_notes.length > 0 && (
              <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  Catatan Adaptasi Budaya & Register Skenario:
                </span>
                <ul className="text-xs text-indigo-200/90 list-disc list-inside space-y-0.5">
                  {translationResult.cultural_notes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Translation Output Preview */}
            <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-serif">
              <div className="text-center border-b border-slate-800/80 pb-2">
                <div className="text-xs font-mono font-bold text-amber-400 tracking-wider">
                  {translationResult.translated_slugline}
                </div>
                <div className="text-xs text-slate-400 font-sans mt-0.5">
                  {translationResult.translated_title}
                </div>
              </div>

              <div className="space-y-3">
                {translationResult.translated_blocks.map((b, i) => (
                  <div key={i} className="text-xs">
                    {b.type === 'action' && (
                      <p className="text-slate-300 italic font-sans leading-relaxed">{b.text}</p>
                    )}
                    {b.type === 'dialogue' && (
                      <div className="text-center space-y-0.5 font-sans">
                        <div className="font-bold text-amber-400 uppercase tracking-wider font-mono text-[11px]">
                          {b.character_name || 'TOKOH'}
                        </div>
                        <div className="text-slate-100 font-serif leading-relaxed">{b.text}</div>
                      </div>
                    )}
                    {b.type === 'parenthetical' && (
                      <p className="text-center italic text-slate-500 text-[11px] font-sans">{b.text}</p>
                    )}
                    {b.type === 'transition' && (
                      <p className="text-right font-mono text-amber-400 font-bold uppercase text-[11px] font-sans">{b.text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                Bahasa terpilih: <strong className="text-indigo-400">{translationResult.target_language_name}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTranslateModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleApplyTranslation}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-950/40"
                >
                  Terapkan ke Adegan Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- AI SCRIPT ASSISTANT MODAL (PHASE 2 / DAY 2 SPRINT) --- */}
      {isAiAssistantOpen && activeScene && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-amber-500/20 to-purple-500/20 text-amber-400 rounded-lg border border-amber-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Asisten Skenario AI (AI Script Assistant)</span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                      Gemini 2.5 Flash
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sintesis aksi sinematik, dialog karakter, dan prompt kontinuitas visual untuk {activeScene.slugline || 'Adegan Aktif'}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiAssistantOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Objective & Tone Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Tujuan Penulisan (Objective)</label>
                <select
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50"
                >
                  <option value="action">Rancang Aksi Sinematik (Action Beat)</option>
                  <option value="dialogue">Kembangkan Dialog Karakter (Dialogue Beat)</option>
                  <option value="scene_expansion">Perluasan Adegan Penuh (Action + Dialogue)</option>
                  <option value="visual_continuity">Audit & Prompt Kontinuitas Visual</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Gaya & Mood Sinematik (Tone)</label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50"
                >
                  <option value="Cinematic Epic">Cinematic Epic & Megah</option>
                  <option value="Moody Chiaroscuro Noir">Moody Chiaroscuro Noir</option>
                  <option value="Kinetic High-Octane Action">Kinetic High-Octane Action</option>
                  <option value="Emotional Dramatic Tension">Emotional Dramatic Tension</option>
                  <option value="Mystical Xianxia Qi Radiance">Mystical Xianxia Qi Radiance</option>
                </select>
              </div>
            </div>

            {/* Character Selector (if dialogue or expansion) */}
            {(aiObjective === 'dialogue' || aiObjective === 'scene_expansion') && (
              <div className="text-xs">
                <label className="block text-slate-400 font-medium mb-1">Karakter Utama Dialog</label>
                <select
                  value={aiSelectedCharacter}
                  onChange={(e) => setAiSelectedCharacter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50"
                >
                  {characters.length > 0 ? (
                    characters.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.archetype ? `(${c.archetype})` : ''}
                      </option>
                    ))
                  ) : (
                    <option value="PENDEKAR">PENDEKAR (Karakter Utama)</option>
                  )}
                </select>
              </div>
            )}

            {/* Context prompt / User guidance */}
            <div className="text-xs">
              <label className="block text-slate-400 font-medium mb-1">Instruksi Khusus / Beat Adegan (Opsional)</label>
              <textarea
                rows={2}
                value={aiUserPrompt}
                onChange={(e) => setAiUserPrompt(e.target.value)}
                placeholder="Contoh: Pertarungan pedang di atas atap kuil kuno di tengah hujan lebat..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-400/50 resize-none leading-relaxed"
              />
            </div>

            {/* Generate Trigger */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-500">
                Memotong 5 CR per outline naskah AI via 2-phase reservation.
              </div>
              <button
                type="button"
                onClick={handleRunAiScriptAssist}
                disabled={isAiGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
                <span>{isAiGenerating ? 'Menyintesis Naskah...' : 'Generate Naskah AI'}</span>
              </button>
            </div>

            {/* Generated Blocks Preview */}
            {aiGeneratedBlocks.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-800 overflow-y-auto max-h-[35vh] pr-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-white">Hasil Sintesis Skenario ({aiGeneratedBlocks.length} Blok):</span>
                  <span className="text-[11px] text-emerald-400 font-mono">✓ Siap Ditautkan</span>
                </div>

                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-serif text-xs">
                  {aiGeneratedBlocks.map((blk, idx) => (
                    <div key={blk.id || idx} className="p-2 rounded bg-slate-900/60 border border-slate-800/50 space-y-1">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-sans">
                        {blk.type} {blk.character_name ? `• ${blk.character_name}` : ''}
                      </div>
                      <div className={`text-slate-200 leading-relaxed ${blk.type === 'parenthetical' ? 'text-center italic text-slate-400' : blk.type === 'dialogue' ? 'text-center font-medium' : ''}`}>
                        {blk.text}
                      </div>
                    </div>
                  ))}

                  {aiGeneratedSeed && (
                    <div className="mt-3 p-2 rounded bg-purple-950/20 border border-purple-800/40 text-[11px] font-mono text-purple-300 space-y-1">
                      <div className="text-[9px] uppercase tracking-wider text-purple-400 font-sans font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Prompt Kontinuitas Visual Baru:</span>
                      </div>
                      <div className="break-words">{aiGeneratedSeed}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAiAssistantOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Tutup
              </button>

              {aiGeneratedBlocks.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyAiBlocks('replace')}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    title="Ganti semua blok naskah saat ini dengan hasil AI"
                  >
                    Ganti Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAiBlocks('append')}
                    className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
                    title="Tambahkan blok AI ini ke akhir naskah adegan"
                  >
                    Sisipkan ke Naskah (+{aiGeneratedBlocks.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
