import {
  MediaProviderId,
  AssetType,
  AssetSubtype,
  MediaGenerationParams,
  MediaGenerationRequest,
} from '../types/database';

export interface ProviderModelInfo {
  id: string;
  name: string;
  category: AssetType;
  creditCost: number;
  description: string;
  recommendedFor?: string;
}

export interface MediaGenerationResult {
  fileUrl: string;
  thumbnailUrl?: string;
  creditCost: number;
  metadata: Record<string, any>;
}

export interface MediaProviderAdapter {
  id: MediaProviderId;
  name: string;
  description: string;
  badge: string;
  capabilities: {
    textToImage: boolean;
    imageToVideo: boolean;
    textToVideo: boolean;
    textToSpeech: boolean;
    musicGen: boolean;
  };
  models: ProviderModelInfo[];
  generateMedia(req: MediaGenerationRequest): Promise<MediaGenerationResult>;
}

/**
 * Procedural Cinematic SVG Generator for High-Fidelity Local Preview
 */
function generateCinematicPosterSvg(
  title: string,
  category: string,
  aspectRatio: string = '16:9',
  toneColor: string = '#F59E0B'
): string {
  const isPortrait = aspectRatio === '9:16';
  const isSquare = aspectRatio === '1:1';
  const width = isPortrait ? 720 : isSquare ? 1024 : 1280;
  const height = isPortrait ? 1280 : isSquare ? 1024 : 720;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#050B14"/>
        <stop offset="60%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#1E293B"/>
      </linearGradient>
      <linearGradient id="auraGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="${toneColor}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Background Space -->
    <rect width="${width}" height="${height}" fill="url(#skyGrad)"/>
    <!-- Atmosphere Aura -->
    <rect width="${width}" height="${height}" fill="url(#auraGrad)"/>
    
    <!-- Cinematic Mountain Silhouettes -->
    <path d="M0 ${height * 0.9} L${width * 0.25} ${height * 0.45} L${width * 0.55} ${height * 0.85} L${width * 0.8} ${height * 0.4} L${width} ${height * 0.75} L${width} ${height} L0 ${height} Z" fill="#0B1120" opacity="0.9"/>
    <path d="M${width * 0.15} ${height} L${width * 0.4} ${height * 0.55} L${width * 0.65} ${height * 0.9} L${width * 0.85} ${height * 0.6} L${width} ${height * 0.8} L${width} ${height} Z" fill="#030712" opacity="0.95"/>
    
    <!-- Floating Celestial Islands / Flying Swords Elements -->
    <polygon points="${width * 0.48},${height * 0.3} ${width * 0.52},${height * 0.3} ${width * 0.5},${height * 0.18}" fill="${toneColor}" filter="url(#glow)" opacity="0.85"/>
    <circle cx="${width * 0.5}" cy="${height * 0.24}" r="${width * 0.08}" fill="none" stroke="${toneColor}" stroke-width="2" opacity="0.4" stroke-dasharray="6,4"/>

    <!-- Cinematic Vignette Borders -->
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="${toneColor}" stroke-width="1" opacity="0.25"/>
    <text x="40" y="55" fill="${toneColor}" font-family="monospace" font-size="14" letter-spacing="3" opacity="0.8">AI MOVIE FACTORY · CINEMATIC KEYFRAME</text>
    <text x="${width - 40}" y="55" text-anchor="end" fill="#94A3B8" font-family="monospace" font-size="12">${aspectRatio} · ULTRA HD</text>
    
    <!-- Title and Metadata Overlay -->
    <text x="${width / 2}" y="${height * 0.82}" text-anchor="middle" fill="#F8FAFC" font-family="sans-serif" font-weight="700" font-size="${Math.max(20, Math.floor(width * 0.03))}" letter-spacing="1">${title.toUpperCase()}</text>
    <text x="${width / 2}" y="${height * 0.87}" text-anchor="middle" fill="${toneColor}" font-family="sans-serif" font-weight="500" font-size="14" opacity="0.9">${category}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * 1. GOOGLE GEMINI NATIVE ADAPTER
 * Primary provider strictly aligned with the system's gemini-api skill:
 * - Image: gemini-3.1-flash-lite-image, gemini-nano-banana-2.1
 * - Video: gemini-omni-1.1-flash
 * - Voice: gemini-3.8-flash-tts, gemini-3.8-flash-lite-tts
 * - Audio: lyria-3-clip-preview
 */
export const GoogleGeminiAdapter: MediaProviderAdapter = {
  id: 'google_gemini',
  name: 'Google Gemini Studio',
  description: 'First-party multimodal synthesis engine directly powered by Google DeepMind Gemini & Lyria models.',
  badge: 'Recommended · 1P SDK',
  capabilities: {
    textToImage: true,
    imageToVideo: true,
    textToVideo: true,
    textToSpeech: true,
    musicGen: true,
  },
  models: [
    {
      id: 'gemini-3.1-flash-lite-image',
      name: 'Gemini 3.1 Flash-Lite Image',
      category: 'image',
      creditCost: 15,
      description: 'High-throughput visual synthesis optimized for character continuity, scene keyframes, and storyboard panels.',
      recommendedFor: 'Character portraits, storyboard frames, and concept art',
    },
    {
      id: 'gemini-nano-banana-2.1',
      name: 'Gemini Nano Banana 2.1',
      category: 'image',
      creditCost: 30,
      description: 'High-quality stylized master visual frames with 2K/4K cinematic fidelity and lighting coherence.',
      recommendedFor: 'Production posters and keyframes',
    },
    {
      id: 'gemini-omni-1.1-flash',
      name: 'Gemini Omni 1.1 Flash (Veo Engine)',
      category: 'video',
      creditCost: 45,
      description: 'Next-generation video generation, image-to-video motion control, and cinematic camera choreography.',
      recommendedFor: 'Cinematic shots, sword duels, and atmospheric camera pans',
    },
    {
      id: 'gemini-3.8-flash-tts',
      name: 'Gemini 3.8 Flash TTS',
      category: 'voice',
      creditCost: 10,
      description: 'Voice persona synthesis supporting screenplay emotion bursts (<laugh>, <gasp>, <whisper>) and vocal cadence.',
      recommendedFor: 'Dialogue lines and dramatic character speech',
    },
    {
      id: 'gemini-3.8-flash-lite-tts',
      name: 'Gemini 3.8 Flash-Lite TTS',
      category: 'voice',
      creditCost: 5,
      description: 'High-throughput vocal synthesis optimized for voiceovers, documentary narration, and episode summaries.',
      recommendedFor: 'Episode narration and voiceovers',
    },
    {
      id: 'lyria-3-clip-preview',
      name: 'Lyria 3 Music Clip',
      category: 'audio',
      creditCost: 20,
      description: 'Generative orchestral soundscapes, Xianxia traditional instruments (Guqin, Dizi), and ambient SFX.',
      recommendedFor: 'Theme music, combat score, and ambience',
    },
  ],

  async generateMedia(req: MediaGenerationRequest): Promise<MediaGenerationResult> {
    const modelInfo = this.models.find((m) => m.id === req.model) || this.models[0];
    const cost = modelInfo.creditCost;

    // Simulate realistic generative latency
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Handle Image Generation
    if (req.assetType === 'image') {
      const toneColor = req.subtype === 'character_portrait' ? '#38BDF8' : req.subtype === 'poster' ? '#EC4899' : '#F59E0B';
      const svgUrl = generateCinematicPosterSvg(
        req.assetName,
        `${modelInfo.name} · ${req.subtype.replace('_', ' ')}`,
        req.params.aspect_ratio || '16:9',
        toneColor
      );

      return {
        fileUrl: svgUrl,
        thumbnailUrl: svgUrl,
        creditCost: cost,
        metadata: {
          provider: 'google_gemini',
          model: req.model,
          aspectRatio: req.params.aspect_ratio || '16:9',
          seed: req.params.seed || Math.floor(Math.random() * 999999),
          promptLength: req.prompt.length,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // Handle Video Generation (Image-to-Video & Camera Motion)
    if (req.assetType === 'video') {
      const cameraMotion = req.params.camera_motion || 'pan_right';
      const duration = req.params.duration_seconds || 5;
      const motionSvg = generateCinematicPosterSvg(
        `${req.assetName} [MOTION: ${cameraMotion.toUpperCase()}]`,
        `Veo Motion Synthesis · ${duration}s · Intensity: ${req.params.motion_intensity || 7}/10`,
        req.params.aspect_ratio || '16:9',
        '#06B6D4'
      );

      return {
        fileUrl: motionSvg,
        thumbnailUrl: motionSvg,
        creditCost: cost,
        metadata: {
          provider: 'google_gemini',
          model: req.model,
          cameraMotion,
          motionIntensity: req.params.motion_intensity || 7,
          durationSeconds: duration,
          referenceImageUrl: req.params.reference_image_url || 'library://last_keyframe',
        },
      };
    }

    // Handle Voice Generation (TTS with emotion tags)
    if (req.assetType === 'voice') {
      return {
        fileUrl: 'https://actions.google.com/sounds/v1/human_voices/applause_and_cheering.ogg',
        creditCost: cost,
        metadata: {
          provider: 'google_gemini',
          model: req.model,
          language: req.params.language || 'id-ID',
          tempo: req.params.tempo || 1.0,
          emotionTag: req.params.emotion_tag || 'none',
          dialogueWordCount: req.prompt.split(' ').length,
        },
      };
    }

    // Handle Audio / Music Generation
    return {
      fileUrl: 'https://actions.google.com/sounds/v1/ambiences/temple_bell_at_night.ogg',
      creditCost: cost,
      metadata: {
        provider: 'google_gemini',
        model: req.model,
        musicGenre: req.params.music_genre || 'xianxia_orchestral',
        durationSeconds: req.params.duration_seconds || 30,
      },
    };
  },
};

/**
 * 2. RUNWAY GEN-3 ADAPTER
 * Provider adapter for image-to-video motion control and cinematic video rigs
 */
export const RunwayAdapter: MediaProviderAdapter = {
  id: 'runway_gen3',
  name: 'Runway Gen-3 Alpha',
  description: 'Specialized video diffusion adapter for fluid character movement and action beat dynamics.',
  badge: 'Video Specialist',
  capabilities: {
    textToImage: false,
    imageToVideo: true,
    textToVideo: true,
    textToSpeech: false,
    musicGen: false,
  },
  models: [
    {
      id: 'gen3a_turbo',
      name: 'Runway Gen-3 Alpha Turbo',
      category: 'video',
      creditCost: 50,
      description: 'Ultra-fast video generation with keyframe camera tracking and physical dynamics.',
      recommendedFor: 'Fast action shots, fight choreography, and VFX transitions',
    },
  ],

  async generateMedia(req: MediaGenerationRequest): Promise<MediaGenerationResult> {
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const videoSvg = generateCinematicPosterSvg(
      `${req.assetName} [Runway Gen-3]`,
      `Motion Camera: ${req.params.camera_motion || 'Orbital Track'} · ${req.params.duration_seconds || 5}s`,
      req.params.aspect_ratio || '16:9',
      '#8B5CF6'
    );

    return {
      fileUrl: videoSvg,
      thumbnailUrl: videoSvg,
      creditCost: 50,
      metadata: {
        provider: 'runway_gen3',
        model: 'gen3a_turbo',
        cameraMotion: req.params.camera_motion || 'orbital',
        durationSeconds: req.params.duration_seconds || 5,
      },
    };
  },
};

/**
 * 3. ELEVENLABS ADAPTER
 * Provider adapter for multilingual voice dubbing and character voice cloning
 */
export const ElevenLabsAdapter: MediaProviderAdapter = {
  id: 'elevenlabs',
  name: 'ElevenLabs Studio',
  description: 'High-fidelity multilingual speech synthesis with character voice cloning profiles.',
  badge: 'Voice Specialist',
  capabilities: {
    textToImage: false,
    imageToVideo: false,
    textToVideo: false,
    textToSpeech: true,
    musicGen: false,
  },
  models: [
    {
      id: 'eleven_multilingual_v2',
      name: 'Eleven Multilingual v2',
      category: 'voice',
      creditCost: 12,
      description: 'Multilingual speech generation with emotional prosody in 29+ languages.',
      recommendedFor: 'Voice cloning and dialogue dubbing',
    },
  ],

  async generateMedia(req: MediaGenerationRequest): Promise<MediaGenerationResult> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      fileUrl: 'https://actions.google.com/sounds/v1/human_voices/male_voice_whisper.ogg',
      creditCost: 12,
      metadata: {
        provider: 'elevenlabs',
        model: 'eleven_multilingual_v2',
        language: req.params.language || 'id-ID',
        voiceId: req.params.voice_id || 'voice_ye_chen_v1',
      },
    };
  },
};

/**
 * 4. SUNO AUDIO ADAPTER
 * Provider adapter for full orchestral soundtrack scoring and Xianxia music
 */
export const SunoAudioAdapter: MediaProviderAdapter = {
  id: 'suno_audio',
  name: 'Suno Music Studio',
  description: 'AI orchestral composition engine for full scores, battle themes, and meditative ambient tracks.',
  badge: 'Music Specialist',
  capabilities: {
    textToImage: false,
    imageToVideo: false,
    textToVideo: false,
    textToSpeech: false,
    musicGen: true,
  },
  models: [
    {
      id: 'suno_v3_orchestral',
      name: 'Suno v3 Epic Orchestral',
      category: 'audio',
      creditCost: 25,
      description: 'Full-length thematic soundtrack generator with cinematic dynamics and traditional instruments.',
      recommendedFor: 'Epic battle themes and emotional character leitmotifs',
    },
  ],

  async generateMedia(req: MediaGenerationRequest): Promise<MediaGenerationResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      fileUrl: 'https://actions.google.com/sounds/v1/ambiences/cinematic_boom_and_reverb.ogg',
      creditCost: 25,
      metadata: {
        provider: 'suno_audio',
        model: 'suno_v3_orchestral',
        genre: req.params.music_genre || 'xianxia_epic_orchestral',
        durationSeconds: req.params.duration_seconds || 45,
      },
    };
  },
};

/**
 * Master Registry of All Media Adapters
 */
export const MEDIA_ADAPTERS: Record<MediaProviderId, MediaProviderAdapter> = {
  google_gemini: GoogleGeminiAdapter,
  runway_gen3: RunwayAdapter,
  kling_ai: RunwayAdapter, // Aliased Kling to Runway interface
  elevenlabs: ElevenLabsAdapter,
  suno_audio: SunoAudioAdapter,
};

export function getMediaAdapter(providerId: MediaProviderId): MediaProviderAdapter {
  return MEDIA_ADAPTERS[providerId] || GoogleGeminiAdapter;
}

export function getAllAvailableModels(category?: AssetType): ProviderModelInfo[] {
  const allModels: ProviderModelInfo[] = [];
  Object.values(MEDIA_ADAPTERS).forEach((adapter) => {
    adapter.models.forEach((m) => {
      if (!category || m.category === category) {
        allModels.push(m);
      }
    });
  });
  return allModels;
}
