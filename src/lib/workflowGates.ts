/**
 * AI Movie Factory - Master Workflow & Director Approval Gates Engine
 * SSOT: docs/02_app_upgrade_II/01_master_requirements_and_upgrade_blueprint.md
 *
 * Implements:
 * 1. The 5 Director Approval Gates
 * 2. Quick-Start Production Templates (Short-form 9:16, Cinematic 16:9, Micro-Series, Commercial)
 * 3. Next Best Action (Langkah Terbaik Selanjutnya) guided recommendation system
 */

import { Project, AspectRatio, OutputResolution, FrameRate, ProductionMode } from '../types/database';

export interface DirectorGate {
  id: 1 | 2 | 3 | 4 | 5;
  key: 'script' | 'world_char' | 'storyboard' | 'keyframe_image' | 'final_master';
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
  targetModule: string;
  prerequisiteDescriptionId: string;
}

export const DIRECTOR_APPROVAL_GATES: DirectorGate[] = [
  {
    id: 1,
    key: 'script',
    titleId: 'Gate 1: Script Approval',
    titleEn: 'Gate 1: Script Approval',
    descriptionId: 'Kunci naskah, dialog, dan struktur scene sebagai Single Source of Truth (SSOT).',
    descriptionEn: 'Lock screenplay, dialogue, and scene beats as Single Source of Truth (SSOT).',
    targetModule: 'story_script',
    prerequisiteDescriptionId: 'Naskah adegan lengkap & dianalisis AI.'
  },
  {
    id: 2,
    key: 'world_char',
    titleId: 'Gate 2: World & Character Approval',
    titleEn: 'Gate 2: World & Character Approval',
    descriptionId: 'Kunci identitas DNA karakter, master sheet 4-sudut, dan master lokasi.',
    descriptionEn: 'Lock character DNA profile, 4-angle master sheet, and master environment.',
    targetModule: 'character_studio',
    prerequisiteDescriptionId: 'Gate 1 (Script Approval) harus telah disetujui.'
  },
  {
    id: 3,
    key: 'storyboard',
    titleId: 'Gate 3: Storyboard Approval',
    titleEn: 'Gate 3: Storyboard Approval',
    descriptionId: 'Kunci shot list, komposisi framing kamera, dan arahan pencahayaan.',
    descriptionEn: 'Lock shot breakdown, camera framing, and lighting direction.',
    targetModule: 'storyboard',
    prerequisiteDescriptionId: 'Gate 1 & 2 harus telah disetujui.'
  },
  {
    id: 4,
    key: 'keyframe_image',
    titleId: 'Gate 4: Keyframe Image Approval',
    titleEn: 'Gate 4: Keyframe Image Approval',
    descriptionId: 'Validasi still keyframe visual sebelum kredit komputasi video dikeluarkan.',
    descriptionEn: 'Validate still visual keyframes before spending video compute credits.',
    targetModule: 'media_studio',
    prerequisiteDescriptionId: 'Gate 3 (Storyboard) harus telah disetujui.'
  },
  {
    id: 5,
    key: 'final_master',
    titleId: 'Gate 5: Final Master Approval',
    titleEn: 'Gate 5: Final Master Approval',
    descriptionId: 'Pemeriksaan assembly utuh video, audio mixing, dan subtitle sebelum ekspor master.',
    descriptionEn: 'Full review of video assembly, audio mix, and subtitles before master export.',
    targetModule: 'editing_post',
    prerequisiteDescriptionId: 'Klip video telah di-render dan lolos inspeksi QC.'
  }
];

export interface ProductionStage {
  stageNumber: number;
  code: string;
  nameId: string;
  nameEn: string;
  targetModule: string;
  gateId?: 1 | 2 | 3 | 4 | 5;
  descriptionId: string;
}

export const MASTER_WORKFLOW_STAGES: ProductionStage[] = [
  { stageNumber: 1, code: '01_project_setup', nameId: '01. Inisialisasi Proyek & Template', nameEn: 'Project Setup & Templates', targetModule: 'projects', descriptionId: 'Setup format produksi dan spesifikasi teknis.' },
  { stageNumber: 2, code: '02_story_dev', nameId: '02. Story Development', nameEn: 'Story Development', targetModule: 'story_script', descriptionId: 'Ide, logline, sinopsis, treatment, dan naskah adegan.' },
  { stageNumber: 3, code: '03_gate_1_script', nameId: '03. [Gate 1] Script Approval', nameEn: 'Gate 1: Script Approval', targetModule: 'story_script', gateId: 1, descriptionId: 'Kunci SSOT naskah dan version lock.' },
  { stageNumber: 4, code: '04a_world_builder', nameId: '04A. World Builder', nameEn: 'World Builder', targetModule: 'world_builder', descriptionId: 'Pembangunan semesta, lokasi master, dan pencahayaan atmosfer.' },
  { stageNumber: 5, code: '04b_char_studio', nameId: '04B. Character Studio', nameEn: 'Character Studio', targetModule: 'character_studio', descriptionId: 'DNA karakter, profil wajah, dan master sheet 4-sudut.' },
  { stageNumber: 6, code: '05_gate_2_world_char', nameId: '05. [Gate 2] World & Character Approval', nameEn: 'Gate 2: World & Character Approval', targetModule: 'character_studio', gateId: 2, descriptionId: 'Kunci aset master karakter dan environment.' },
  { stageNumber: 7, code: '06_storyboard', nameId: '06. Storyboard Studio', nameEn: 'Storyboard Studio', targetModule: 'storyboard', descriptionId: 'Scene breakdown, shot list, framing, dan arah kamera.' },
  { stageNumber: 8, code: '07_gate_3_storyboard', nameId: '07. [Gate 3] Storyboard Approval', nameEn: 'Gate 3: Storyboard Approval', targetModule: 'storyboard', gateId: 3, descriptionId: 'Kunci komposisi shot visual sutradara.' },
  { stageNumber: 9, code: '08_image_gen', nameId: '08. Image Generation', nameEn: 'Image Generation', targetModule: 'media_studio', descriptionId: 'Sintesis keyframe visual per shot.' },
  { stageNumber: 10, code: '09_gate_4_keyframe', nameId: '09. [Gate 4] Keyframe Approval', nameEn: 'Gate 4: Keyframe Approval', targetModule: 'media_studio', gateId: 4, descriptionId: 'Validasi still keyframe visual sebelum komputasi video.' },
  { stageNumber: 11, code: '10_video_gen', nameId: '10. Video Generation', nameEn: 'Video Generation', targetModule: 'media_studio', descriptionId: 'Motion synthesis video dari storyboard dan keyframe.' },
  { stageNumber: 12, code: '11a_voice_dialogue', nameId: '11A. Voice & Dialogue', nameEn: 'Voice & Dialogue', targetModule: 'media_studio', descriptionId: 'Karakter suara TTS, audio emosi, dan lip-sync.' },
  { stageNumber: 13, code: '11b_sound_music', nameId: '11B. Music & Sound Design', nameEn: 'Music & Sound Design', targetModule: 'media_studio', descriptionId: 'Background music sinematik dan sound effect foley.' },
  { stageNumber: 14, code: '12_quality_control', nameId: '12. Quality Control & Kontinuitas', nameEn: 'Quality Control & Continuity', targetModule: 'quality_control', descriptionId: 'Inspeksi 15 parameter QC kontinuitas multi-shot.' },
  { stageNumber: 15, code: '13_editing_post', nameId: '13. Editing & Post-Produksi', nameEn: 'Editing & Post-Production', targetModule: 'editing_post', descriptionId: 'NLE timeline assembly, multi-track sync, dan color grading.' },
  { stageNumber: 16, code: '14_gate_5_master', nameId: '14. [Gate 5] Final Master Approval', nameEn: 'Gate 5: Final Master Approval', targetModule: 'editing_post', gateId: 5, descriptionId: 'Pemeriksaan assembly utuh dan persetujuan ekspor master.' },
  { stageNumber: 17, code: '15_master_export', nameId: '15. Master Render & Export', nameEn: 'Master Render & Export', targetModule: 'editing_post', descriptionId: 'Rendering final multi-preset (H.264 MP4 / ProRes).' },
  { stageNumber: 18, code: '16_distribution_biz', nameId: '16. Distribusi, Analitik & Monetisasi', nameEn: 'Distribution & Monetization', targetModule: 'creator_intelligence', descriptionId: 'Multi-platform publishing, real analytics, dan OTT store.' },
];

export interface ProjectTemplate {
  id: string;
  nameId: string;
  nameEn: string;
  descriptionId: string;
  descriptionEn: string;
  badge: string;
  iconName: string;
  aspectRatio: AspectRatio;
  outputResolution: OutputResolution;
  frameRate: FrameRate;
  episodeDurationMinutes: number;
  episodesCount: number;
  sceneCountTarget: number;
  productionFormat: string;
  visualStyle: string;
  productionMode: ProductionMode;
}

export const QUICK_START_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'short_form_viral',
    nameId: 'Short-Form Viral (9:16)',
    nameEn: 'Viral Short-Form (9:16)',
    descriptionId: 'Optimal untuk TikTok, YouTube Shorts & Instagram Reels. Pacing cepat, hook 3 detik, durasi 60 detik.',
    descriptionEn: 'Optimized for TikTok, YouTube Shorts & IG Reels. Fast pacing, 3s hook, 60s runtime.',
    badge: 'Medsos / Reels',
    iconName: 'Smartphone',
    aspectRatio: '9:16',
    outputResolution: '1080p',
    frameRate: '30fps',
    episodeDurationMinutes: 1,
    episodesCount: 1,
    sceneCountTarget: 4,
    productionFormat: 'Short-form vertical video',
    visualStyle: 'Modern Cinematic Lighting, Vivid Color Contrast, High Dynamics',
    productionMode: 'ai_assisted'
  },
  {
    id: 'cinematic_drama_series',
    nameId: 'Cinematic Drama Series (16:9)',
    nameEn: 'Cinematic Drama Series (16:9)',
    descriptionId: 'Standar film sinematik horisontal 24fps. Format multi-adegan 3-5 menit untuk serial drama berkualitas tinggi.',
    descriptionEn: 'Horizontal cinematic standard at 24fps. Multi-scene 3-5m format for high-grade drama series.',
    badge: 'Cinema 24fps',
    iconName: 'Clapperboard',
    aspectRatio: '16:9',
    outputResolution: '4K',
    frameRate: '24fps',
    episodeDurationMinutes: 4,
    episodesCount: 6,
    sceneCountTarget: 16,
    productionFormat: 'Drama series',
    visualStyle: '3D Donghua Cinematic, Volumetric Lighting, Atmospheric Depth',
    productionMode: 'ai_assisted'
  },
  {
    id: 'micro_drama_ott',
    nameId: 'Micro-Drama Series OTT (9:16)',
    nameEn: 'OTT Micro-Drama Series (9:16)',
    descriptionId: 'Format serial web mandiri vertikal bergaya ReelShort / DramaBox. Pacing intens dengan cliffhanger di akhir tiap episode.',
    descriptionEn: 'Vertical web series format styled after ReelShort/DramaBox. Intense pacing with episodic cliffhangers.',
    badge: 'OTT Monetization',
    iconName: 'Tv',
    aspectRatio: '9:16',
    outputResolution: '1080p',
    frameRate: '24fps',
    episodeDurationMinutes: 2,
    episodesCount: 12,
    sceneCountTarget: 24,
    productionFormat: 'Episodic Micro-Series',
    visualStyle: 'High Fashion Drama, Expressive Character Lighting, Bold Framing',
    productionMode: 'ai_assisted'
  },
  {
    id: 'commercial_trailer',
    nameId: 'Commercial & Trailer Sinematik (16:9)',
    nameEn: 'Commercial & Cinematic Trailer (16:9)',
    descriptionId: 'Trailer teaser komersial 30 detik dengan transisi cepat, sound design dinamis, dan efek dramatis.',
    descriptionEn: '30-second commercial teaser trailer with rapid cuts, punchy sound design, and dramatic flair.',
    badge: 'Trailer 30s',
    iconName: 'Sparkles',
    aspectRatio: '16:9',
    outputResolution: '1080p',
    frameRate: '24fps',
    episodeDurationMinutes: 1,
    episodesCount: 1,
    sceneCountTarget: 6,
    productionFormat: 'Commercial / Trailer',
    visualStyle: 'High Commercial Polish, Hyper-Detailed Textures, Studio Lighting',
    productionMode: 'ai_assisted'
  }
];

export interface NextBestAction {
  stageNumber: number;
  stageName: string;
  actionTitle: string;
  actionDescription: string;
  targetTab: string;
  buttonLabel: string;
  urgency: 'low' | 'normal' | 'high' | 'action_required';
  gateStatus: {
    gate1: boolean; // Script
    gate2: boolean; // World & Character
    gate3: boolean; // Storyboard
    gate4: boolean; // Keyframe
    gate5: boolean; // Final Master
  };
}

/**
 * Calculates the exact Next Best Action (Langkah Terbaik Selanjutnya)
 * for a director based on the project's real state and gate achievements.
 */
export function computeNextBestAction(
  project: Project | null,
  context?: {
    sceneCount?: number;
    approvedSceneCount?: number;
    characterCount?: number;
    storyboardShotCount?: number;
    renderedVideoCount?: number;
  }
): NextBestAction {
  if (!project) {
    return {
      stageNumber: 1,
      stageName: '01. Inisialisasi Proyek',
      actionTitle: 'Buat Proyek Film Pertama Anda',
      actionDescription: 'Gunakan template siap pakai (Shorts 9:16 atau Sinema 16:9) untuk memulai pabrik film Anda dalam 1 klik.',
      targetTab: 'projects',
      buttonLabel: 'Pilih Template Proyek',
      urgency: 'action_required',
      gateStatus: { gate1: false, gate2: false, gate3: false, gate4: false, gate5: false }
    };
  }

  const scenes = context?.sceneCount ?? 0;
  const approvedScenes = context?.approvedSceneCount ?? 0;
  const chars = context?.characterCount ?? 0;
  const shots = context?.storyboardShotCount ?? 0;
  const videos = context?.renderedVideoCount ?? 0;

  // Gate flags
  const gate1 = approvedScenes > 0;
  const gate2 = gate1 && chars > 0;
  const gate3 = gate2 && shots > 0;
  const gate4 = gate3 && shots > 0;
  const gate5 = gate4 && videos > 0;

  // Step 1: No scenes written yet
  if (scenes === 0) {
    return {
      stageNumber: 2,
      stageName: '02. Story Development',
      actionTitle: 'Tulis & Generate Naskah Pertama',
      actionDescription: 'Biarkan Scriptwriter Agent menyusun struktur naskah adegan sinematik berbasis ide cerita Anda.',
      targetTab: 'story_script',
      buttonLabel: 'Buka Cerita & Naskah',
      urgency: 'action_required',
      gateStatus: { gate1, gate2, gate3, gate4, gate5 }
    };
  }

  // Step 2: Scenes exist but not approved (Gate 1 pending)
  if (!gate1) {
    return {
      stageNumber: 3,
      stageName: '03. [Gate 1] Script Approval',
      actionTitle: 'Tinjau & Setujui Naskah (Gate 1)',
      actionDescription: 'Kunci naskah sebagai Single Source of Truth sebelum melangkah ke perancangan karakter dan storyboard.',
      targetTab: 'story_script',
      buttonLabel: 'Setujui Naskah di Studio',
      urgency: 'high',
      gateStatus: { gate1, gate2, gate3, gate4, gate5 }
    };
  }

  // Step 3: Naskah approved, but characters not created (Gate 2 pending)
  if (!gate2) {
    return {
      stageNumber: 4,
      stageName: '04. [Gate 2] Character Studio & World Builder',
      actionTitle: 'Kunci Karakter & Master Lokasi (Gate 2)',
      actionDescription: 'Tentukan DNA identitas karakter dan master reference sheet agar wajah tidak berubah di seluruh klip.',
      targetTab: 'character_studio',
      buttonLabel: 'Bangun Karakter di Character Studio',
      urgency: 'normal',
      gateStatus: { gate1, gate2, gate3, gate4, gate5 }
    };
  }

  // Step 4: Characters locked, but storyboard empty (Gate 3 pending)
  if (!gate3) {
    return {
      stageNumber: 6,
      stageName: '06. [Gate 3] Storyboard Studio',
      actionTitle: 'Rancang Storyboard & Shot List (Gate 3)',
      actionDescription: 'Pecah naskah yang telah disetujui menjadi shot breakdown teknis dengan sudut kamera dan framing visual.',
      targetTab: 'storyboard',
      buttonLabel: 'Rancang Shot di Storyboard',
      urgency: 'normal',
      gateStatus: { gate1, gate2, gate3, gate4, gate5 }
    };
  }

  // Step 5: Storyboard ready, generate keyframes and video
  if (!gate5) {
    return {
      stageNumber: 8,
      stageName: '08. Media Studio & Video Synthesis',
      actionTitle: 'Render Keyframe & Video Riil (Gate 4)',
      actionDescription: 'Generate keyframe visual terverifikasi dan ubah menjadi motion video 24fps melalui provider AI riil.',
      targetTab: 'media_studio',
      buttonLabel: 'Buka Media Studio',
      urgency: 'normal',
      gateStatus: { gate1, gate2, gate3, gate4, gate5 }
    };
  }

  // Step 6: Post-production, assembly, and final export
  return {
    stageNumber: 13,
    stageName: '13. [Gate 5] Editing & Post-Produksi',
    actionTitle: 'Perakitan Timeline & Master Ekspor (Gate 5)',
    actionDescription: 'Rangkai klip di NLE timeline, sinkronkan subtitle SRT/VTT, seimbangkan audio loudness, dan ekspor master final.',
    targetTab: 'editing_post',
    buttonLabel: 'Buka Editing & Timeline',
    urgency: 'low',
    gateStatus: { gate1, gate2, gate3, gate4, gate5 }
  };
}
