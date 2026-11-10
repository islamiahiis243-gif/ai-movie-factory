import React, { useState, useEffect, useMemo } from 'react';
import {
  Project,
  MediaAsset,
  AssetType,
  AssetSubtype,
  Character,
  SceneItem,
  MediaProviderId,
  PipelineJob,
} from '../../types/database';
import {
  fetchProjectAssets,
  createMediaAsset,
  updateMediaAsset,
  deleteMediaAsset,
  approveMediaAsset,
  rejectMediaAsset,
  fetchCharacters,
  fetchProjectScenes,
  uploadProjectAssetToBucket,
  fetchCreditTransactions,
  createPipelineJob,
  updatePipelineJob,
  fetchPipelineJobs,
  addJobLog,
} from '../../lib/supabase';
import {
  getMediaAdapter,
  getAllAvailableModels,
  MediaProviderAdapter,
} from '../../lib/mediaAdapters';
import { AssetDetailModal } from './AssetDetailModal';
import { CostPreviewModal } from './CostPreviewModal';
import { useAuth } from '../../context/AuthContext';
import { translations } from '../../lib/translations';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Coins,
  Sparkles,
  Video,
  ArrowRight,
} from 'lucide-react';

interface MediaStudioViewProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject?: (id: string) => void;
  onNavigateToEditing?: (projectId: string) => void;
  currentLang: 'id' | 'en';
}

export const MediaStudioView: React.FC<MediaStudioViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  onNavigateToEditing,
  currentLang,
}) => {
  const t = translations[currentLang];
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  const [activeTab, setActiveTab] = useState<'library' | 'imageGen' | 'videoGen' | 'voiceGen' | 'audioGen'>('library');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Inspection Modal
  const [inspectingAsset, setInspectingAsset] = useState<MediaAsset | null>(null);

  // Pre-Generation Cost Preview State & Wallet Balance
  const { user, profile } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(profile?.credits_balance || 150);

  // In-Flight Pipeline Jobs for Background Orchestration (SSOT TC-WF-09 Tab Close Recovery)
  const [activePipelineJobs, setActivePipelineJobs] = useState<PipelineJob[]>([]);

  useEffect(() => {
    if (!activeProject) return;
    let isMounted = true;
    fetchPipelineJobs(activeProject.id).then((res) => {
      if (isMounted && res.data) {
        const inFlight = res.data.filter((j) => j.status === 'running' || j.status === 'queued');
        setActivePipelineJobs(inFlight);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeProject?.id]);
  const [costPreviewConfig, setCostPreviewConfig] = useState<{
    isOpen: boolean;
    assetType: 'image' | 'video' | 'voice' | 'audio';
    assetName: string;
    provider: string;
    model: string;
    creditCost: number;
    params: {
      durationSeconds?: number;
      aspectRatio?: string;
      resolution?: string;
      cameraMotion?: string;
    };
    sourceAsset?: MediaAsset | null;
    onConfirmCallback: (idempotencyKey: string) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const targetId = user?.id || profile?.id;
    if (targetId) {
      fetchCreditTransactions(targetId).then((res) => {
        if (!active) return;
        if (res.data && res.data.length > 0) {
          setWalletBalance(res.data[0].balance_after);
        } else {
          setWalletBalance(user ? 150 : 0);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [user?.id, profile?.id]);

  // Library Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generation Form States
  const [isGenerating, setIsGenerating] = useState(false);

  // Image Gen Form
  const [imgName, setImgName] = useState('');
  const [imgSubtype, setImgSubtype] = useState<AssetSubtype>('character_portrait');
  const [imgCharacterId, setImgCharacterId] = useState<string>('');
  const [imgSceneId, setImgSceneId] = useState<string>('');
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgNegativePrompt, setImgNegativePrompt] = useState('');
  const [imgAspectRatio, setImgAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '21:9'>('16:9');
  const [imgResolution, setImgResolution] = useState<'1080p' | '4K'>('1080p');
  const [imgModel, setImgModel] = useState('gemini-3.1-flash-lite-image');

  // Video Gen Form
  const [vidName, setVidName] = useState('');
  const [vidSubtype, setVidSubtype] = useState<AssetSubtype>('image_to_video');
  const [vidSourceAssetId, setVidSourceAssetId] = useState<string>('');
  const [vidCameraMotion, setVidCameraMotion] = useState<'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out' | 'orbital' | 'static'>('pan_right');
  const [vidMotionIntensity, setVidMotionIntensity] = useState<number>(7);
  const [vidDuration, setVidDuration] = useState<number>(5);
  const [vidPrompt, setVidPrompt] = useState('');
  const [vidModel, setVidModel] = useState('gemini-omni-1.1-flash');

  // Voice Gen Form
  const [voiceName, setVoiceName] = useState('');
  const [voiceSubtype, setVoiceSubtype] = useState<AssetSubtype>('character_dialogue');
  const [voiceCharacterId, setVoiceCharacterId] = useState<string>('');
  const [voiceText, setVoiceText] = useState('');
  const [voiceEmotion, setVoiceEmotion] = useState('determined');
  const [voiceLanguage, setVoiceLanguage] = useState('id-ID');
  const [voiceTempo, setVoiceTempo] = useState<number>(1.0);
  const [voiceModel, setVoiceModel] = useState('gemini-3.8-flash-tts');

  // Audio Gen Form
  const [audioName, setAudioName] = useState('');
  const [audioSubtype, setAudioSubtype] = useState<AssetSubtype>('background_music');
  const [audioGenre, setAudioGenre] = useState('xianxia_epic_orchestral');
  const [audioInstrumentation, setAudioInstrumentation] = useState('Guqin, Dizi, Erhu, Full Symphonic Strings');
  const [audioDuration, setAudioDuration] = useState<number>(30);
  const [audioPrompt, setAudioPrompt] = useState('');
  const [audioModel, setAudioModel] = useState('lyria-3-clip-preview');

  // Load project assets, characters, and scenes
  const loadData = async (projectId: string) => {
    setIsLoading(true);
    try {
      const [assetRes, charRes, sceneRes] = await Promise.all([
        fetchProjectAssets(projectId),
        fetchCharacters(projectId),
        fetchProjectScenes(projectId),
      ]);

      if (assetRes.data) setAssets(assetRes.data);
      if (charRes.data) setCharacters(charRes.data);
      if (sceneRes.data) setScenes(sceneRes.data);
    } catch (err) {
      console.error('Error loading media studio data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeProject) {
      loadData(activeProject.id);
    }
  }, [activeProject?.id]);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // When a character is selected in Image Gen, automatically augment the prompt with visual continuity formula
  const handleSelectCharacterInImageGen = (charId: string) => {
    setImgCharacterId(charId);
    if (!charId) return;

    const char = characters.find((c) => c.id === charId);
    if (char && char.visual_consistency_prompt) {
      if (!imgPrompt) {
        setImgPrompt(char.visual_consistency_prompt);
      } else {
        setImgPrompt((prev) => `${prev}\n\n[Character Continuity Seed: ${char.name}]: ${char.visual_consistency_prompt}`);
      }
      if (!imgName) {
        setImgName(`Potret Karakter: ${char.name}`);
      }
    }
  };

  // Actions
  const handleApprove = async (id: string) => {
    if (!activeProject) return;
    await approveMediaAsset(activeProject.id, id, 'Sutradara Utama (Creative Director)');
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, approval_status: 'approved', approved_by: 'Sutradara Utama', approved_at: new Date().toISOString() } : a))
    );
    if (inspectingAsset && inspectingAsset.id === id) {
      setInspectingAsset((prev) => prev ? { ...prev, approval_status: 'approved', approved_by: 'Sutradara Utama', approved_at: new Date().toISOString() } : null);
    }
    showNotification(t.mediaStudio.actions.approvedSuccess);
  };

  const handleReject = async (id: string) => {
    if (!activeProject) return;
    await rejectMediaAsset(activeProject.id, id);
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, approval_status: 'rejected' } : a))
    );
    if (inspectingAsset && inspectingAsset.id === id) {
      setInspectingAsset((prev) => prev ? { ...prev, approval_status: 'rejected' } : null);
    }
    showNotification(t.mediaStudio.actions.rejectedSuccess);
  };

  const handleDelete = async (id: string) => {
    if (!activeProject) return;
    if (window.confirm(currentLang === 'id' ? 'Hapus aset ini dari perpustakaan produksi?' : 'Delete this asset from production library?')) {
      await deleteMediaAsset(activeProject.id, id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (inspectingAsset && inspectingAsset.id === id) {
        setInspectingAsset(null);
      }
      showNotification(t.mediaStudio.actions.deleteSuccess);
    }
  };

  const handleUseAsVideoSource = (asset: MediaAsset) => {
    setActiveTab('videoGen');
    setVidSourceAssetId(asset.id);
    setVidName(`Video Motion: ${asset.asset_name}`);
    setVidPrompt(`Transform image still into cinematic camera tracking shot. ${asset.prompt.substring(0, 150)}...`);
  };

  // ============================================================================
  // PRE-GENERATION COST PREVIEW & IDEMPOTENCY EXECUTION (SSOT Section 10 & Gate 4)
  // ============================================================================

  // 1. Image Generation Handlers
  const handleGenerateImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !imgPrompt || isGenerating) return;
    const creditCost = imgModel === 'imagen-3.0-generate' ? 20 : 15;

    setCostPreviewConfig({
      isOpen: true,
      assetType: 'image',
      assetName: imgName || `Keyframe Gambar #${assets.length + 1}`,
      provider: 'Google Gemini / Imagen 3',
      model: imgModel,
      creditCost,
      params: {
        aspectRatio: imgAspectRatio,
        resolution: imgResolution,
      },
      onConfirmCallback: async (idempotencyKey: string) => {
        await executeImageGeneration(idempotencyKey);
      },
    });
  };

  const executeImageGeneration = async (idempotencyKey: string) => {
    setIsGenerating(true);
    const creditCost = imgModel === 'imagen-3.0-generate' ? 20 : 15;
    const now = new Date().toISOString();

    // 1. Enqueue job into Pipeline Orchestrator (SSOT TC-WF-09 & TC-WF-10)
    const { data: pipelineJob } = await createPipelineJob(activeProject.id, {
      project_id: activeProject.id,
      scene_id: imgSceneId || undefined,
      job_title: `Keyframe Still: ${imgName || `Gambar #${assets.length + 1}`} (${imgModel})`,
      current_stage: 'image_gen',
      status: 'running',
      priority: 'high',
      progress: 25,
      stages_completed: ['script_prep'],
      generated_asset_ids: [],
      credit_cost: creditCost,
      idempotency_key: idempotencyKey,
      retry_count: 0,
      max_retries: 3,
      is_approved: false,
      started_at: now,
    });

    if (pipelineJob) {
      setActivePipelineJobs((prev) => [pipelineJob, ...prev]);
      await addJobLog(pipelineJob.id, {
        job_id: pipelineJob.id,
        project_id: activeProject.id,
        stage: 'image_gen',
        level: 'info',
        message: `Memulai sintesis keyframe still gambar dengan model ${imgModel}, token: ${idempotencyKey}`,
      });
    }

    try {
      if (pipelineJob) {
        await updatePipelineJob(activeProject.id, pipelineJob.id, { progress: 60 });
      }

      const adapter = getMediaAdapter('google_gemini');
      const result = await adapter.generateMedia({
        projectId: activeProject.id,
        characterId: imgCharacterId || undefined,
        sceneId: imgSceneId || undefined,
        assetName: imgName || `Keyframe Gambar #${assets.length + 1}`,
        assetType: 'image',
        subtype: imgSubtype,
        provider: 'google_gemini',
        model: imgModel,
        prompt: imgPrompt,
        params: {
          aspect_ratio: imgAspectRatio,
          resolution: imgResolution,
          negative_prompt: imgNegativePrompt || undefined,
          seed: Math.floor(Math.random() * 999999),
          idempotency_key: idempotencyKey,
        },
      });

      const { data: newAsset } = await createMediaAsset(activeProject.id, {
        project_id: activeProject.id,
        character_id: imgCharacterId || undefined,
        scene_id: imgSceneId || undefined,
        asset_name: imgName || `Keyframe Gambar #${assets.length + 1}`,
        asset_type: 'image',
        subtype: imgSubtype,
        provider: 'google_gemini',
        model: imgModel,
        prompt: imgPrompt,
        generation_params: {
          aspect_ratio: imgAspectRatio,
          resolution: imgResolution,
          seed: result.metadata.seed,
          negative_prompt: imgNegativePrompt || undefined,
          idempotency_key: idempotencyKey,
        },
        status: 'completed',
        credit_cost: result.creditCost || creditCost,
        file_url: result.fileUrl,
        thumbnail_url: result.thumbnailUrl,
        version: 1,
        approval_status: 'draft',
      });

      if (newAsset) {
        setAssets((prev) => [newAsset, ...prev]);
        setWalletBalance((prev) => Math.max(0, prev - (result.creditCost || creditCost)));
        showNotification(t.mediaStudio.actions.generationSuccess);
        setCostPreviewConfig(null);
        setActiveTab('library');

        // Complete pipeline job
        if (pipelineJob) {
          const compTime = new Date().toISOString();
          await updatePipelineJob(activeProject.id, pipelineJob.id, {
            status: 'completed',
            progress: 100,
            completed_at: compTime,
            stages_completed: ['script_prep', 'image_gen'],
            generated_asset_ids: [newAsset.id],
          });
          await addJobLog(pipelineJob.id, {
            job_id: pipelineJob.id,
            project_id: activeProject.id,
            stage: 'image_gen',
            level: 'success',
            message: `Keyframe gambar berhasil disintesis dan didaftarkan ke Library (#${newAsset.id}).`,
          });
          setActivePipelineJobs((prev) => prev.filter((j) => j.id !== pipelineJob.id));
        }
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      showNotification(`Generasi gambar gagal: ${err.message || 'Provider error'}. Kredit Anda aman (Auto-refund berhasil).`);

      if (pipelineJob) {
        await updatePipelineJob(activeProject.id, pipelineJob.id, {
          status: 'failed',
          error_message: err.message || 'Provider synthesis error',
        });
        await addJobLog(pipelineJob.id, {
          job_id: pipelineJob.id,
          project_id: activeProject.id,
          stage: 'image_gen',
          level: 'error',
          message: `Eksekusi job keyframe gagal: ${err.message || 'Unknown error'}. Kredit dikembalikan.`,
        });
        setActivePipelineJobs((prev) => prev.map((j) => j.id === pipelineJob.id ? { ...j, status: 'failed', error_message: err.message } : j));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Video Generation Handlers (With Gate 4 Enforcement)
  const handleGenerateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !vidPrompt || isGenerating) return;

    const providerId: MediaProviderId = vidModel === 'gen3a_turbo' ? 'runway_gen3' : 'google_gemini';
    const creditCost = vidModel === 'gen3a_turbo' ? 50 : 45;
    const sourceAsset = assets.find((a) => a.id === vidSourceAssetId) || null;

    setCostPreviewConfig({
      isOpen: true,
      assetType: 'video',
      assetName: vidName || `Video Klip #${assets.length + 1}`,
      provider: providerId === 'runway_gen3' ? 'Runway Gen-3 Alpha' : 'Google Gemini / Veo',
      model: vidModel,
      creditCost,
      params: {
        durationSeconds: vidDuration,
        aspectRatio: '16:9',
        resolution: '1080p',
        cameraMotion: vidCameraMotion,
      },
      sourceAsset,
      onConfirmCallback: async (idempotencyKey: string) => {
        await executeVideoGeneration(idempotencyKey);
      },
    });
  };

  const executeVideoGeneration = async (idempotencyKey: string) => {
    setIsGenerating(true);
    const providerId: MediaProviderId = vidModel === 'gen3a_turbo' ? 'runway_gen3' : 'google_gemini';
    const sourceAsset = assets.find((a) => a.id === vidSourceAssetId);
    const cost = vidModel === 'gen3a_turbo' ? 50 : 45;
    const now = new Date().toISOString();

    // 1. Enqueue job into Pipeline Orchestrator (SSOT TC-WF-09 & TC-WF-10)
    const { data: pipelineJob } = await createPipelineJob(activeProject.id, {
      project_id: activeProject.id,
      scene_id: sourceAsset?.scene_id,
      job_title: `Render Video: ${vidName || `Klip #${assets.length + 1}`} (${vidModel})`,
      current_stage: 'video_gen',
      status: 'running',
      priority: 'high',
      progress: 20,
      stages_completed: sourceAsset ? ['image_gen'] : [],
      generated_asset_ids: [],
      credit_cost: cost,
      idempotency_key: idempotencyKey,
      retry_count: 0,
      max_retries: 3,
      is_approved: false,
      started_at: now,
    });

    if (pipelineJob) {
      setActivePipelineJobs((prev) => [pipelineJob, ...prev]);
      await addJobLog(pipelineJob.id, {
        job_id: pipelineJob.id,
        project_id: activeProject.id,
        stage: 'video_gen',
        level: 'info',
        message: `Memulai sintesis video dengan ${providerId} (${vidModel}), token: ${idempotencyKey}`,
      });
    }

    try {
      if (pipelineJob) {
        await updatePipelineJob(activeProject.id, pipelineJob.id, { progress: 55 });
      }

      const adapter = getMediaAdapter(providerId);

      const result = await adapter.generateMedia({
        projectId: activeProject.id,
        assetName: vidName || `Video Klip #${assets.length + 1}`,
        assetType: 'video',
        subtype: vidSubtype,
        provider: providerId,
        model: vidModel,
        prompt: vidPrompt,
        params: {
          aspect_ratio: '16:9',
          duration_seconds: vidDuration,
          camera_motion: vidCameraMotion,
          motion_intensity: vidMotionIntensity,
          reference_image_url: sourceAsset?.file_url,
          idempotency_key: idempotencyKey,
        },
      });

      if (pipelineJob) {
        await updatePipelineJob(activeProject.id, pipelineJob.id, { progress: 85 });
      }

      const { data: newAsset } = await createMediaAsset(activeProject.id, {
        project_id: activeProject.id,
        scene_id: sourceAsset?.scene_id,
        character_id: sourceAsset?.character_id,
        asset_name: vidName || `Video Klip #${assets.length + 1}`,
        asset_type: 'video',
        subtype: vidSubtype,
        provider: providerId,
        model: vidModel,
        prompt: vidPrompt,
        generation_params: {
          aspect_ratio: '16:9',
          duration_seconds: vidDuration,
          camera_motion: vidCameraMotion,
          motion_intensity: vidMotionIntensity,
          reference_image_url: sourceAsset?.file_url,
          idempotency_key: idempotencyKey,
        },
        status: 'completed',
        credit_cost: result.creditCost || cost,
        file_url: result.fileUrl,
        thumbnail_url: result.thumbnailUrl,
        version: 1,
        approval_status: 'draft',
      });

      if (newAsset) {
        setAssets((prev) => [newAsset, ...prev]);
        setWalletBalance((prev) => Math.max(0, prev - (result.creditCost || cost)));
        showNotification(`Video berhasil dirender! (${result.creditCost || cost} CR terpotong).`);
        setCostPreviewConfig(null);
        setActiveTab('library');

        // Complete pipeline job
        if (pipelineJob) {
          const compTime = new Date().toISOString();
          await updatePipelineJob(activeProject.id, pipelineJob.id, {
            status: 'completed',
            progress: 100,
            completed_at: compTime,
            stages_completed: ['script_prep', 'image_gen', 'video_gen'],
            generated_asset_ids: [newAsset.id],
          });
          await addJobLog(pipelineJob.id, {
            job_id: pipelineJob.id,
            project_id: activeProject.id,
            stage: 'video_gen',
            level: 'success',
            message: `Video klip berhasil disintesis dan didaftarkan ke Library Aset (#${newAsset.id}).`,
          });
          setActivePipelineJobs((prev) => prev.filter((j) => j.id !== pipelineJob.id));
        }
      }
    } catch (err: any) {
      console.error('Video generation error:', err);
      showNotification(`Generasi video gagal: ${err.message || 'Provider error'}. Kredit Anda aman dan tidak terpotong (Auto-refund berhasil).`);

      if (pipelineJob) {
        await updatePipelineJob(activeProject.id, pipelineJob.id, {
          status: 'failed',
          error_message: err.message || 'Provider synthesis error',
        });
        await addJobLog(pipelineJob.id, {
          job_id: pipelineJob.id,
          project_id: activeProject.id,
          stage: 'video_gen',
          level: 'error',
          message: `Eksekusi job gagal: ${err.message || 'Unknown error'}. Auto-refund kredit dilepaskan.`,
        });
        setActivePipelineJobs((prev) => prev.map((j) => j.id === pipelineJob.id ? { ...j, status: 'failed', error_message: err.message } : j));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Voice Generation Handlers
  const handleGenerateVoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !voiceText || isGenerating) return;
    const creditCost = voiceModel === 'eleven_multilingual_v2' ? 10 : 8;

    setCostPreviewConfig({
      isOpen: true,
      assetType: 'voice',
      assetName: voiceName || `Klip Vokal #${assets.length + 1}`,
      provider: voiceModel === 'eleven_multilingual_v2' ? 'ElevenLabs Audio' : 'Google Gemini Voice',
      model: voiceModel,
      creditCost,
      params: {
        durationSeconds: 10,
      },
      onConfirmCallback: async (idempotencyKey: string) => {
        await executeVoiceGeneration(idempotencyKey);
      },
    });
  };

  const executeVoiceGeneration = async (idempotencyKey: string) => {
    setIsGenerating(true);
    const providerId: MediaProviderId = voiceModel === 'eleven_multilingual_v2' ? 'elevenlabs' : 'google_gemini';
    const creditCost = voiceModel === 'eleven_multilingual_v2' ? 10 : 8;

    try {
      const adapter = getMediaAdapter(providerId);

      const result = await adapter.generateMedia({
        projectId: activeProject.id,
        characterId: voiceCharacterId || undefined,
        assetName: voiceName || `Klip Vokal #${assets.length + 1}`,
        assetType: 'voice',
        subtype: voiceSubtype,
        provider: providerId,
        model: voiceModel,
        prompt: voiceText,
        params: {
          language: voiceLanguage,
          tempo: voiceTempo,
          emotion_tag: voiceEmotion,
          idempotency_key: idempotencyKey,
        },
      });

      const { data: newAsset } = await createMediaAsset(activeProject.id, {
        project_id: activeProject.id,
        character_id: voiceCharacterId || undefined,
        asset_name: voiceName || `Klip Vokal #${assets.length + 1}`,
        asset_type: 'voice',
        subtype: voiceSubtype,
        provider: providerId,
        model: voiceModel,
        prompt: voiceText,
        generation_params: {
          language: voiceLanguage,
          tempo: voiceTempo,
          emotion_tag: voiceEmotion,
          idempotency_key: idempotencyKey,
        },
        status: 'completed',
        credit_cost: result.creditCost || creditCost,
        file_url: result.fileUrl,
        version: 1,
        approval_status: 'draft',
      });

      if (newAsset) {
        setAssets((prev) => [newAsset, ...prev]);
        setWalletBalance((prev) => Math.max(0, prev - (result.creditCost || creditCost)));
        showNotification(t.mediaStudio.actions.generationSuccess);
        setCostPreviewConfig(null);
        setActiveTab('library');
      }
    } catch (err: any) {
      console.error('Voice generation error:', err);
      showNotification(`Generasi vokal gagal: ${err.message || 'Provider error'}. Kredit otomatis di-refund.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Audio / Music Generation Handlers
  const handleGenerateAudio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !audioPrompt || isGenerating) return;
    const creditCost = audioModel === 'suno_v3_orchestral' ? 25 : 15;

    setCostPreviewConfig({
      isOpen: true,
      assetType: 'audio',
      assetName: audioName || `Skor Audio #${assets.length + 1}`,
      provider: audioModel === 'suno_v3_orchestral' ? 'Suno Music Studio' : 'Google Gemini Audio',
      model: audioModel,
      creditCost,
      params: {
        durationSeconds: audioDuration,
      },
      onConfirmCallback: async (idempotencyKey: string) => {
        await executeAudioGeneration(idempotencyKey);
      },
    });
  };

  const executeAudioGeneration = async (idempotencyKey: string) => {
    setIsGenerating(true);
    const providerId: MediaProviderId = audioModel === 'suno_v3_orchestral' ? 'suno_audio' : 'google_gemini';
    const creditCost = audioModel === 'suno_v3_orchestral' ? 25 : 15;

    try {
      const adapter = getMediaAdapter(providerId);

      const result = await adapter.generateMedia({
        projectId: activeProject.id,
        assetName: audioName || `Skor Audio #${assets.length + 1}`,
        assetType: 'audio',
        subtype: audioSubtype,
        provider: providerId,
        model: audioModel,
        prompt: audioPrompt,
        params: {
          duration_seconds: audioDuration,
          music_genre: audioGenre,
          instrumentation: audioInstrumentation,
          idempotency_key: idempotencyKey,
        },
      });

      const { data: newAsset } = await createMediaAsset(activeProject.id, {
        project_id: activeProject.id,
        asset_name: audioName || `Skor Audio #${assets.length + 1}`,
        asset_type: 'audio',
        subtype: audioSubtype,
        provider: providerId,
        model: audioModel,
        prompt: audioPrompt,
        generation_params: {
          duration_seconds: audioDuration,
          music_genre: audioGenre,
          instrumentation: audioInstrumentation,
          idempotency_key: idempotencyKey,
        },
        status: 'completed',
        credit_cost: result.creditCost || creditCost,
        file_url: result.fileUrl,
        version: 1,
        approval_status: 'draft',
      });

      if (newAsset) {
        setAssets((prev) => [newAsset, ...prev]);
        setWalletBalance((prev) => Math.max(0, prev - (result.creditCost || creditCost)));
        showNotification(t.mediaStudio.actions.generationSuccess);
        setCostPreviewConfig(null);
        setActiveTab('library');
      }
    } catch (err: any) {
      console.error('Audio generation error:', err);
      showNotification(`Generasi audio gagal: ${err.message || 'Provider error'}. Kredit otomatis di-refund.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (typeFilter !== 'all' && asset.asset_type !== typeFilter) return false;
      if (approvalFilter !== 'all' && asset.approval_status !== approvalFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = asset.asset_name.toLowerCase().includes(q);
        const matchesPrompt = asset.prompt.toLowerCase().includes(q);
        const matchesModel = asset.model.toLowerCase().includes(q);
        if (!matchesName && !matchesPrompt && !matchesModel) return false;
      }
      return true;
    });
  }, [assets, typeFilter, approvalFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = assets.length;
    const images = assets.filter((a) => a.asset_type === 'image').length;
    const videos = assets.filter((a) => a.asset_type === 'video').length;
    const voices = assets.filter((a) => a.asset_type === 'voice').length;
    const audios = assets.filter((a) => a.asset_type === 'audio').length;
    const approved = assets.filter((a) => a.approval_status === 'approved').length;
    const creditsUsed = assets.reduce((sum, a) => sum + (a.credit_cost || 0), 0);

    return { total, images, videos, voices, audios, approved, creditsUsed };
  }, [assets]);

  // Available image assets for Image-to-Video selection
  const imageAssets = useMemo(() => {
    return assets.filter((a) => a.asset_type === 'image');
  }, [assets]);

  if (!activeProject) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>{currentLang === 'id' ? 'Silakan buat atau pilih proyek terlebih dahulu.' : 'Please create or select a project first.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {statusMessage && (
        <div className="p-3 bg-amber-950/60 border border-amber-600/50 rounded-lg text-amber-200 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-amber-400 hover:text-amber-200 text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Header & Project Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              {t.mediaStudio.title}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {t.mediaStudio.subtitle}
          </p>
        </div>

        {/* Project Selector Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">
              {t.mediaStudio.selectProject}
            </span>
            <select
              value={activeProject.id}
              onChange={(e) => onSelectProject && onSelectProject(e.target.value)}
              className="bg-transparent text-xs text-amber-400 font-semibold focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {onNavigateToEditing && (
            <button
              onClick={() => onNavigateToEditing(activeProject.id)}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-amber-400/10 hover:from-amber-500/30 hover:to-amber-400/20 text-amber-300 border border-amber-400/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title={currentLang === 'id' ? 'Buka aset di Studio Editing & Post-Produksi' : 'Open assets in Editing & Post-Production'}
            >
              <span>✂</span>
              <span>{currentLang === 'id' ? 'Studio Editing' : 'Editing Studio'}</span>
            </button>
          )}

          <label
            className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Unggah berkas media ke Supabase Storage Bucket (project-assets)"
          >
            <span>⬆</span>
            <span>{currentLang === 'id' ? 'Unggah ke Bucket (project-assets)' : 'Upload to Bucket'}</span>
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !activeProject) return;
                setStatusMessage(`Mengunggah "${file.name}" ke bucket project-assets...`);
                const upRes = await uploadProjectAssetToBucket(activeProject.id, file, file.name);
                if (upRes.error || !upRes.url) {
                  setStatusMessage(upRes.error || 'Gagal mengunggah berkas ke bucket.');
                  return;
                }
                const detectedType: AssetType = file.type.startsWith('video/')
                  ? 'video'
                  : file.type.startsWith('audio/')
                  ? 'audio'
                  : 'image';
                const detectedSubtype: AssetSubtype =
                  detectedType === 'video'
                    ? 'text_to_video'
                    : detectedType === 'audio'
                    ? 'background_music'
                    : 'concept_art';
                await createMediaAsset(activeProject.id, {
                  project_id: activeProject.id,
                  asset_name: file.name,
                  asset_type: detectedType,
                  subtype: detectedSubtype,
                  status: 'completed',
                  approval_status: 'approved',
                  provider: 'google_gemini',
                  model: 'supabase-storage-bucket',
                  prompt: `Direct upload to bucket ${upRes.bucket}/${upRes.path}`,
                  generation_params: {
                    reference_image_url: upRes.url,
                  },
                  file_url: upRes.url,
                  thumbnail_url: detectedType === 'image' ? upRes.url : undefined,
                  version: 1,
                  credit_cost: 0,
                });
                setStatusMessage(
                  `Berkas "${file.name}" berhasil disimpan di bucket (${upRes.bucket}) dan ditambahkan ke Pustaka Aset!`
                );
                await loadData(activeProject.id);
              }}
            />
          </label>

          <button
            onClick={() => loadData(activeProject.id)}
            disabled={isLoading}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors text-xs flex items-center gap-1.5"
            title="Refresh Data"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Background Pipeline Jobs Tracker Banner (SSOT TC-WF-09 Tab Close Recovery) */}
      {activePipelineJobs.length > 0 && (
        <div className="p-4 bg-slate-900/80 border border-cyan-500/30 rounded-xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Tugas Pipeline Latar Belakang Aktif ({activePipelineJobs.length})</span>
                <span className="text-[10px] text-cyan-400 font-mono font-normal bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Pemulihan Tab Otomatis Aktif (TC-WF-09)
                </span>
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Pekerjaan tetap berjalan di server jika tab ditutup
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activePipelineJobs.map((job) => (
              <div
                key={job.id}
                className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg space-y-2 text-xs font-mono"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200 truncate">{job.job_title}</span>
                  <span className="text-cyan-400 font-bold">{job.progress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Tahap: {job.current_stage}</span>
                  <span>Biaya: {job.credit_cost} CR</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Studio Telemetry Stats Strip (Strict Anti-Pill, Monospace Values) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.mediaStudio.stats.totalAssets}
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {stats.total}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {stats.approved} {t.mediaStudio.stats.approved}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.mediaStudio.stats.images}
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {stats.images}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Keyframes & Visuals
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.mediaStudio.stats.videos}
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
            {stats.videos}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Camera Motion Clips
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.mediaStudio.stats.voiceClips}
          </div>
          <div className="text-xl font-bold font-mono text-purple-400 mt-1">
            {stats.voices}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Dialogue Tracks
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.mediaStudio.stats.audioTracks}
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {stats.audios}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            BGM & Technique SFX
          </div>
        </div>

        <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg col-span-2 sm:col-span-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            {t.mediaStudio.stats.creditsUsed}
          </div>
          <div className="text-xl font-bold font-mono text-amber-300 mt-1">
            {stats.creditsUsed}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Compute Credits
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-sm overflow-x-auto pb-1 sm:pb-0">
        <button
          onClick={() => setActiveTab('library')}
          className={`pb-2.5 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'library'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📁</span>
          <span>{t.mediaStudio.tabs.library}</span>
          <span className="text-xs font-mono text-slate-400">({assets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('imageGen')}
          className={`pb-2.5 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'imageGen'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🖼️</span>
          <span>{t.mediaStudio.tabs.imageGen}</span>
        </button>

        <button
          onClick={() => setActiveTab('videoGen')}
          className={`pb-2.5 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'videoGen'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🎥</span>
          <span>{t.mediaStudio.tabs.videoGen}</span>
        </button>

        <button
          onClick={() => setActiveTab('voiceGen')}
          className={`pb-2.5 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'voiceGen'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🎙️</span>
          <span>{t.mediaStudio.tabs.voiceGen}</span>
        </button>

        <button
          onClick={() => setActiveTab('audioGen')}
          className={`pb-2.5 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'audioGen'
              ? 'text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🎵</span>
          <span>{t.mediaStudio.tabs.audioGen}</span>
        </button>
      </div>

      {/* TAB 1: PRODUCTION ASSET LIBRARY */}
      {activeTab === 'library' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={t.mediaStudio.filters.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Type & Approval Filter Dropdowns */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none"
              >
                <option value="all">{t.mediaStudio.filters.allTypes}</option>
                <option value="image">{t.mediaStudio.filters.image}</option>
                <option value="video">{t.mediaStudio.filters.video}</option>
                <option value="voice">{t.mediaStudio.filters.voice}</option>
                <option value="audio">{t.mediaStudio.filters.audio}</option>
              </select>

              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none"
              >
                <option value="all">{t.mediaStudio.filters.allApproval}</option>
                <option value="draft">{t.mediaStudio.filters.draft}</option>
                <option value="in_review">{t.mediaStudio.filters.in_review}</option>
                <option value="approved">{t.mediaStudio.filters.approved}</option>
                <option value="rejected">{t.mediaStudio.filters.rejected}</option>
              </select>
            </div>
          </div>

          {/* Asset Cards Grid */}
          {filteredAssets.length === 0 ? (
            <div className="p-12 border border-slate-800 rounded-xl bg-slate-900/30 text-center text-slate-400 space-y-2">
              <span className="text-3xl block">📁</span>
              <p className="text-xs">
                {currentLang === 'id' ? 'Belum ada aset media yang cocok dengan filter.' : 'No media assets match current filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const isApproved = asset.approval_status === 'approved';
                const isRejected = asset.approval_status === 'rejected';

                return (
                  <div
                    key={asset.id}
                    className="p-3.5 bg-slate-900/60 border border-slate-800/90 hover:border-slate-700 rounded-xl flex flex-col justify-between transition-all group"
                  >
                    <div className="space-y-3">
                      {/* Media Thumbnail Container */}
                      <div
                        onClick={() => setInspectingAsset(asset)}
                        className="relative w-full aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 cursor-pointer flex items-center justify-center"
                      >
                        {asset.asset_type === 'image' && (
                          <img
                            src={asset.thumbnail_url || asset.file_url}
                            alt={asset.asset_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}

                        {asset.asset_type === 'video' && (
                          <div className="w-full h-full relative flex items-center justify-center">
                            <img
                              src={asset.thumbnail_url || asset.file_url}
                              alt={asset.asset_name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="w-10 h-10 rounded-full bg-cyan-500/80 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                ▶
                              </span>
                            </div>
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-mono text-cyan-300">
                              {asset.generation_params.duration_seconds || 5}s
                            </span>
                          </div>
                        )}

                        {(asset.asset_type === 'voice' || asset.asset_type === 'audio') && (
                          <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                            <span className="text-3xl mb-1">{asset.asset_type === 'voice' ? '🎙️' : '🎵'}</span>
                            <span className="text-xs font-mono text-slate-300 truncate max-w-[200px]">
                              {asset.asset_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 mt-1">
                              {asset.generation_params.duration_seconds ? `${asset.generation_params.duration_seconds}s` : 'Audio Track'}
                            </span>
                          </div>
                        )}

                        {/* Top-Right Approval Status Indicator */}
                        <div className="absolute top-2 right-2">
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded backdrop-blur-md ${
                            isApproved ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40' :
                            isRejected ? 'bg-rose-950/80 text-rose-400 border border-rose-500/40' :
                            'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                          }`}>
                            {asset.approval_status}
                          </span>
                        </div>
                      </div>

                      {/* Title & Metadata Strip */}
                      <div>
                        <h4
                          onClick={() => setInspectingAsset(asset)}
                          className="text-xs font-semibold text-slate-100 truncate cursor-pointer hover:text-amber-400 transition-colors"
                          title={asset.asset_name}
                        >
                          {asset.asset_name}
                        </h4>

                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-1">
                          <span className="uppercase text-amber-400">{asset.asset_type}</span>
                          <span>·</span>
                          <span>{asset.credit_cost} CR</span>
                          <span>·</span>
                          <span className="truncate max-w-[120px]" title={asset.model}>{asset.model}</span>
                        </div>

                        <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {asset.prompt}
                        </p>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 mt-3 border-t border-slate-900/80 flex items-center justify-between text-xs">
                      <button
                        onClick={() => setInspectingAsset(asset)}
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 font-mono"
                      >
                        <span>🔍</span>
                        <span>{t.mediaStudio.actions.viewDetails}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {!isApproved && (
                          <button
                            onClick={() => handleApprove(asset.id)}
                            className="p-1.5 bg-slate-800 hover:bg-emerald-950/60 text-slate-300 hover:text-emerald-400 rounded transition-colors"
                            title={t.mediaStudio.actions.approve}
                          >
                            ✓
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(asset.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded transition-colors"
                          title={t.mediaStudio.actions.delete}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI IMAGE SYNTHESIS */}
      {activeTab === 'imageGen' && (
        <div className="max-w-4xl p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>🖼️</span>
              {t.mediaStudio.imageStudio.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.mediaStudio.imageStudio.subtitle}
            </p>
          </div>

          <form onSubmit={handleGenerateImage} className="space-y-4 text-xs font-mono">
            {/* Asset Name & Subtype */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.imageStudio.assetName}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.mediaStudio.imageStudio.assetNamePlaceholder}
                  value={imgName}
                  onChange={(e) => setImgName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.imageStudio.subtype}
                </label>
                <select
                  value={imgSubtype}
                  onChange={(e) => setImgSubtype(e.target.value as AssetSubtype)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="character_portrait">Character Portrait</option>
                  <option value="environment_landscape">Environment Landscape</option>
                  <option value="storyboard_frame">Storyboard Panel</option>
                  <option value="concept_art">Concept Art</option>
                  <option value="poster">Movie Poster</option>
                </select>
              </div>
            </div>

            {/* Character & Scene Linkers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.imageStudio.characterRef}
                </label>
                <select
                  value={imgCharacterId}
                  onChange={(e) => handleSelectCharacterInImageGen(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">{t.mediaStudio.imageStudio.noCharacter}</option>
                  {characters.map((char) => (
                    <option key={char.id} value={char.id}>
                      {char.name} ({char.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.imageStudio.sceneRef}
                </label>
                <select
                  value={imgSceneId}
                  onChange={(e) => setImgSceneId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">{t.mediaStudio.imageStudio.noScene}</option>
                  {scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      Scene #{scene.scene_number}: {scene.title} ({scene.slugline})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div>
              <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                {t.mediaStudio.imageStudio.promptLabel}
              </label>
              <textarea
                rows={4}
                required
                placeholder={t.mediaStudio.imageStudio.promptPlaceholder}
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                {t.mediaStudio.imageStudio.negativePrompt}
              </label>
              <input
                type="text"
                placeholder={t.mediaStudio.imageStudio.negativePlaceholder}
                value={imgNegativePrompt}
                onChange={(e) => setImgNegativePrompt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Aspect Ratio, Resolution & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.imageStudio.aspectRatio}
                </label>
                <select
                  value={imgAspectRatio}
                  onChange={(e) => setImgAspectRatio(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="16:9">16:9 (Cinematic Landscape)</option>
                  <option value="9:16">9:16 (Vertical Short Drama)</option>
                  <option value="1:1">1:1 (Square Avatar)</option>
                  <option value="21:9">21:9 (Anamorphic Ultrawide)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.imageStudio.resolution}
                </label>
                <select
                  value={imgResolution}
                  onChange={(e) => setImgResolution(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="1080p">1080p Full HD</option>
                  <option value="4K">4K Ultra HD (Master Visual)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.imageStudio.providerModel}
                </label>
                <select
                  value={imgModel}
                  onChange={(e) => setImgModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="gemini-3.1-flash-lite-image">Gemini 3.1 Flash-Lite Image (15 CR)</option>
                  <option value="gemini-nano-banana-2.1">Gemini Nano Banana 2.1 (30 CR)</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <span>{isGenerating ? '⏳' : '✨'}</span>
                <span>{isGenerating ? t.mediaStudio.actions.generating : t.mediaStudio.imageStudio.generateBtn}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: VIDEO & MOTION GENERATOR */}
      {activeTab === 'videoGen' && (
        <div className="max-w-4xl p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span>🎥</span>
                {t.mediaStudio.videoStudio.title}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.mediaStudio.videoStudio.subtitle}
              </p>
            </div>

            {/* Gate 4 Indicator Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-400/10 border border-amber-400/30 rounded-lg text-amber-300 text-xs font-semibold shrink-0">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Gate 4: Keyframe Approval Guard Active</span>
            </div>
          </div>

          <form onSubmit={handleGenerateVideo} className="space-y-4 text-xs font-mono">
            {/* Asset Name & Subtype */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.videoStudio.assetName}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.mediaStudio.videoStudio.assetNamePlaceholder}
                  value={vidName}
                  onChange={(e) => setVidName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.videoStudio.subtype}
                </label>
                <select
                  value={vidSubtype}
                  onChange={(e) => setVidSubtype(e.target.value as AssetSubtype)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="image_to_video">Image-to-Video Animation (Rekomendasi Utama)</option>
                  <option value="text_to_video">Text-to-Video Synthesis</option>
                  <option value="action_sequence">Martial Arts Action Sequence</option>
                </select>
              </div>
            </div>

            {/* Source Image Selector with Gate 4 Badges */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-400 uppercase tracking-wider">
                  {t.mediaStudio.videoStudio.sourceImage}
                </label>
                <span className="text-[10px] text-slate-500">
                  Prasyarat: Keyframe harus lulus Gate 4
                </span>
              </div>
              {imageAssets.length === 0 ? (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-400 text-xs">
                  {currentLang === 'id' ? 'Belum ada gambar di perpustakaan. Sintesis gambar terlebih dahulu pada tab "Sintesis Gambar AI".' : 'No images in library. Generate an image first in Image Studio.'}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                    {imageAssets.map((img) => {
                      const isApproved = img.approval_status === 'approved';
                      const isSelected = vidSourceAssetId === img.id;
                      return (
                        <div
                          key={img.id}
                          onClick={() => setVidSourceAssetId(img.id)}
                          className={`relative aspect-video rounded overflow-hidden border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-amber-500 ring-2 ring-amber-500/50'
                              : 'border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <img src={img.thumbnail_url || img.file_url} alt={img.asset_name} className="w-full h-full object-cover" />
                          
                          {/* Gate 4 Badge Overlay */}
                          <div className="absolute top-1 right-1">
                            <span
                              className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow ${
                                isApproved
                                  ? 'bg-emerald-500/90 text-white'
                                  : 'bg-amber-500/90 text-slate-950'
                              }`}
                            >
                              {isApproved ? 'G4 APPROVED' : 'G4 PENDING'}
                            </span>
                          </div>

                          <span className="absolute bottom-1 left-1 right-1 bg-black/80 text-[9px] text-slate-200 truncate px-1 rounded">
                            {img.asset_name}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Keyframe Gate 4 Audit Bar */}
                  {vidSourceAssetId && (() => {
                    const selectedImg = imageAssets.find((a) => a.id === vidSourceAssetId);
                    if (!selectedImg) return null;
                    const isApproved = selectedImg.approval_status === 'approved';
                    return (
                      <div
                        className={`p-2.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2.5 ${
                          isApproved
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isApproved ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <span>
                            <strong>Gate 4 Status:</strong> Keyframe acuan "{selectedImg.asset_name}"{' '}
                            {isApproved ? 'telah disahkan sutradara.' : `masih berstatus '${selectedImg.approval_status}'.`}
                          </span>
                        </div>

                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleApprove(selectedImg.id)}
                            className="px-2.5 py-1 bg-amber-400 text-slate-950 text-[11px] font-bold rounded hover:bg-amber-300 transition-colors cursor-pointer"
                          >
                            Setujui Keyframe (Kunci Gate 4)
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Camera Motion & Motion Intensity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.videoStudio.cameraMotion}
                </label>
                <select
                  value={vidCameraMotion}
                  onChange={(e) => setVidCameraMotion(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="pan_right">Pan Right (Geser Kanan)</option>
                  <option value="pan_left">Pan Left (Geser Kiri)</option>
                  <option value="tilt_up">Tilt Up (Sorot Naik)</option>
                  <option value="tilt_down">Tilt Down (Sorot Turun)</option>
                  <option value="zoom_in">Zoom In (Mendekat)</option>
                  <option value="zoom_out">Zoom Out (Menjauh)</option>
                  <option value="orbital">Orbital Track (Putaran Melingkar)</option>
                  <option value="static">Static (Fokus Subjek)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-slate-400 uppercase tracking-wider">
                    {t.mediaStudio.videoStudio.motionIntensity}
                  </label>
                  <span className="text-amber-400">{vidMotionIntensity}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={vidMotionIntensity}
                  onChange={(e) => setVidMotionIntensity(Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-700 h-2 rounded cursor-pointer mt-2"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.videoStudio.duration}
                </label>
                <select
                  value={vidDuration}
                  onChange={(e) => setVidDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value={3}>3 Detik (Shot Cepat)</option>
                  <option value={5}>5 Detik (Standar Sinematik)</option>
                  <option value={8}>8 Detik (Transisi Pemandangan)</option>
                  <option value={10}>10 Detik (Shot Panjang)</option>
                </select>
              </div>
            </div>

            {/* Model Selector */}
            <div>
              <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                Model AI Video
              </label>
              <select
                value={vidModel}
                onChange={(e) => setVidModel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="gemini-omni-1.1-flash">Gemini Omni 1.1 Flash / Veo Engine (45 CR)</option>
                <option value="gen3a_turbo">Runway Gen-3 Alpha Turbo (50 CR)</option>
              </select>
            </div>

            {/* Motion Prompt */}
            <div>
              <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                {t.mediaStudio.videoStudio.promptLabel}
              </label>
              <textarea
                rows={3}
                required
                placeholder={t.mediaStudio.videoStudio.promptPlaceholder}
                value={vidPrompt}
                onChange={(e) => setVidPrompt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-400/20 disabled:opacity-50 cursor-pointer"
              >
                <span>{isGenerating ? '⏳' : '🎬'}</span>
                <span>{isGenerating ? t.mediaStudio.actions.generating : 'Konfirmasi & Estimasi Biaya (Gate 4)'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: VOICE DIRECTOR & TTS */}
      {activeTab === 'voiceGen' && (
        <div className="max-w-4xl p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>🎙️</span>
              {t.mediaStudio.voiceStudio.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.mediaStudio.voiceStudio.subtitle}
            </p>
          </div>

          <form onSubmit={handleGenerateVoice} className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.voiceStudio.assetName}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.mediaStudio.voiceStudio.assetNamePlaceholder}
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.voiceStudio.speakingCharacter}
                </label>
                <select
                  value={voiceCharacterId}
                  onChange={(e) => setVoiceCharacterId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Narator / Bebas</option>
                  {characters.map((char) => (
                    <option key={char.id} value={char.id}>
                      {char.name} ({char.voice_characteristics?.pitch_tone || 'Standard'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dialogue Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-slate-400 uppercase tracking-wider">
                  {t.mediaStudio.voiceStudio.dialogueText}
                </label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400">Emotion tags:</span>
                  <button
                    type="button"
                    onClick={() => setVoiceText((prev) => `${prev} <whisper>...</whisper>`)}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded"
                  >
                    &lt;whisper&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceText((prev) => `${prev} <laugh>...</laugh>`)}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded"
                  >
                    &lt;laugh&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceText((prev) => `${prev} <gasp>...</gasp>`)}
                    className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded"
                  >
                    &lt;gasp&gt;
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                required
                placeholder={t.mediaStudio.voiceStudio.dialoguePlaceholder}
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Language, Emotion, Tempo & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.voiceStudio.language}
                </label>
                <select
                  value={voiceLanguage}
                  onChange={(e) => setVoiceLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="id-ID">Bahasa Indonesia</option>
                  <option value="en-US">English (US)</option>
                  <option value="zh-CN">Chinese Mandarin</option>
                  <option value="ja-JP">Japanese</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.voiceStudio.emotionTag}
                </label>
                <select
                  value={voiceEmotion}
                  onChange={(e) => setVoiceEmotion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="determined">Determined / Tegas</option>
                  <option value="cold_whisper">Cold Whisper / Dingin</option>
                  <option value="furious">Furious / Marah</option>
                  <option value="gentle">Gentle / Lembut</option>
                  <option value="mysterious">Mysterious / Penuh Rahasia</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-slate-400 uppercase tracking-wider">
                    {t.mediaStudio.voiceStudio.tempo}
                  </label>
                  <span className="text-amber-400">{voiceTempo.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={voiceTempo}
                  onChange={(e) => setVoiceTempo(Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-700 h-2 rounded cursor-pointer mt-2"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  Model Voice AI
                </label>
                <select
                  value={voiceModel}
                  onChange={(e) => setVoiceModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="gemini-3.8-flash-tts">Gemini 3.8 Flash TTS (10 CR)</option>
                  <option value="gemini-3.8-flash-lite-tts">Gemini 3.8 Flash-Lite TTS (5 CR)</option>
                  <option value="eleven_multilingual_v2">Eleven Multilingual v2 (12 CR)</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <span>{isGenerating ? '⏳' : '🎙️'}</span>
                <span>{isGenerating ? t.mediaStudio.actions.generating : t.mediaStudio.voiceStudio.generateBtn}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: MUSIC & SOUND DESIGN */}
      {activeTab === 'audioGen' && (
        <div className="max-w-4xl p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>🎵</span>
              {t.mediaStudio.audioStudio.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.mediaStudio.audioStudio.subtitle}
            </p>
          </div>

          <form onSubmit={handleGenerateAudio} className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.audioStudio.assetName}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.mediaStudio.audioStudio.assetNamePlaceholder}
                  value={audioName}
                  onChange={(e) => setAudioName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.audioStudio.subtype}
                </label>
                <select
                  value={audioSubtype}
                  onChange={(e) => setAudioSubtype(e.target.value as AssetSubtype)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="background_music">Background Music (BGM)</option>
                  <option value="sound_effect">Sound Effect (SFX)</option>
                  <option value="ambient_sound">Atmospheric Ambience</option>
                </select>
              </div>
            </div>

            {/* Genre, Instrumentation, Duration & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.audioStudio.musicGenre}
                </label>
                <select
                  value={audioGenre}
                  onChange={(e) => setAudioGenre(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="xianxia_epic_orchestral">Xianxia Epic Orchestral</option>
                  <option value="guqin_flute_ethereal">Guqin & Flute Ethereal Meditative</option>
                  <option value="high_tension_duel">Martial Duel High Tension</option>
                  <option value="night_temple_ambience">Sacred Mountain Night Ambience</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  {t.mediaStudio.audioStudio.duration}
                </label>
                <select
                  value={audioDuration}
                  onChange={(e) => setAudioDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value={15}>15 Detik</option>
                  <option value={30}>30 Detik (Standard Clip)</option>
                  <option value={45}>45 Detik</option>
                  <option value={60}>60 Detik</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                  Model Audio AI
                </label>
                <select
                  value={audioModel}
                  onChange={(e) => setAudioModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="lyria-3-clip-preview">Lyria 3 Music Clip (20 CR)</option>
                  <option value="suno_v3_orchestral">Suno v3 Epic Orchestral (25 CR)</option>
                </select>
              </div>
            </div>

            {/* Prompt Description */}
            <div>
              <label className="block text-slate-400 uppercase tracking-wider mb-1.5">
                {t.mediaStudio.audioStudio.promptLabel}
              </label>
              <textarea
                rows={3}
                required
                placeholder={t.mediaStudio.audioStudio.promptPlaceholder}
                value={audioPrompt}
                onChange={(e) => setAudioPrompt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <span>{isGenerating ? '⏳' : '🎵'}</span>
                <span>{isGenerating ? t.mediaStudio.actions.generating : t.mediaStudio.audioStudio.generateBtn}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detail Inspection Modal */}
      {inspectingAsset && (
        <AssetDetailModal
          asset={inspectingAsset}
          characters={characters}
          scenes={scenes}
          isOpen={Boolean(inspectingAsset)}
          onClose={() => setInspectingAsset(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={handleDelete}
          onUseAsVideoSource={handleUseAsVideoSource}
          currentLang={currentLang}
        />
      )}

      {/* Pre-Generation Cost Preview & Gate 4 Audit Modal */}
      {costPreviewConfig && (
        <CostPreviewModal
          isOpen={costPreviewConfig.isOpen}
          onClose={() => setCostPreviewConfig(null)}
          onConfirm={costPreviewConfig.onConfirmCallback}
          assetType={costPreviewConfig.assetType}
          assetName={costPreviewConfig.assetName}
          provider={costPreviewConfig.provider}
          model={costPreviewConfig.model}
          creditCost={costPreviewConfig.creditCost}
          walletBalance={walletBalance}
          params={costPreviewConfig.params}
          sourceAsset={costPreviewConfig.sourceAsset}
          onApproveSourceAsset={(assetId) => handleApprove(assetId)}
          isGenerating={isGenerating}
        />
      )}
    </div>
  );
};
