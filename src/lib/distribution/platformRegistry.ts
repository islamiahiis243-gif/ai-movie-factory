/**
 * AI MOVIE FACTORY — PLATFORM CAPABILITY REGISTRY (T9.2)
 * Comprehensive registry for all 13 supported distribution channels:
 * - 4 First-Wave Priority: YouTube, TikTok, Instagram, Facebook
 * - 9 Expansion Platforms: X, LinkedIn, Pinterest, Snapchat, Threads, Telegram, Vimeo, Dailymotion, Reddit
 */

import {
  PlatformId,
  PlatformDefinition,
  PublishingMetadata,
  ContentValidationResult,
  ContentValidationIssue,
} from './types';

export const PLATFORM_REGISTRY: Record<PlatformId, PlatformDefinition> = {
  // ============================================================================
  // 1. FIRST-WAVE PRIORITY PLATFORMS
  // ============================================================================
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    category: 'video_sharing',
    color: '#EF4444',
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
    iconName: 'Youtube',
    integrationStatus: 'manual_export_available',
    capabilities: {
      supportedAspectRatios: ['16:9', '9:16'],
      supportedResolutions: ['1080p', '4K'],
      maxDurationSeconds: 43200, // 12 jam
      maxSizeBytes: 274877906944, // 256 GB
      supportsDirectPublishing: true,
      supportsManualExport: true,
      supportsScheduling: true,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: true,
      supportsSubtitles: true,
      supportsAnalytics: true,
      requiresAppApproval: false, // Kuota dasar 10.000 unit/hari aktif langsung
      accountTypeRequired: 'channel',
      oauthScopes: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
      rateLimitNote: '1.600 unit per video upload dari batas harian 10.000 unit Google Data API.',
    },
    officialDocUrl: 'https://developers.google.com/youtube/v3',
    description: {
      id: 'Distribusi video sinematik 4K horizontal (16:9) dan YouTube Shorts vertikal (9:16).',
      en: 'Distribute 4K horizontal cinematic releases (16:9) and vertical YouTube Shorts (9:16).',
    },
    manualWorkflowNotes: {
      id: 'Unduh Master Package (.mp4 4K + file .srt) dan salin paket judul serta bab (timestamps) 1-klik untuk diunggah ke YouTube Studio.',
      en: 'Download Master Package (.mp4 4K + .srt) and copy 1-click formatted title and chapters to paste in YouTube Studio.',
    },
  },

  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    category: 'short_form',
    color: '#06B6D4',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    iconName: 'Video',
    integrationStatus: 'manual_export_available',
    capabilities: {
      supportedAspectRatios: ['9:16'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 600, // 10 menit
      maxSizeBytes: 4294967296, // 4 GB
      supportsDirectPublishing: true,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: true,
      supportsThumbnailUpload: true,
      supportsSubtitles: true,
      supportsAnalytics: true,
      requiresAppApproval: true, // Butuh App Review untuk direct publish
      accountTypeRequired: 'creator',
      oauthScopes: ['video.upload', 'video.publish'],
      rateLimitNote: 'Maksimal 50 permintaan pengunggahan per akun kreator per hari.',
    },
    officialDocUrl: 'https://developers.tiktok.com/',
    description: {
      id: 'Format video vertikal 9:16 dengan Safe Area hazard protection untuk TikTok UI.',
      en: 'Vertical 9:16 format featuring Safe Area hazard protection for TikTok in-app UI.',
    },
    manualWorkflowNotes: {
      id: 'Ekspor video 9:16 reframe tengah dan salin teks caption + tagar viral untuk dipublikasikan lewat TikTok Web / App.',
      en: 'Export centered 9:16 video and copy viral captions + hashtags to publish via TikTok Web or App.',
    },
  },

  instagram: {
    id: 'instagram',
    name: 'Instagram Reels & Video',
    category: 'short_form',
    color: '#EC4899',
    badgeColor: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    iconName: 'Instagram',
    integrationStatus: 'manual_export_available',
    capabilities: {
      supportedAspectRatios: ['9:16', '4:5', '1:1'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 900, // 15 menit untuk Reels
      maxSizeBytes: 1073741824, // 1 GB
      supportsDirectPublishing: true,
      supportsManualExport: true,
      supportsScheduling: true,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: true,
      supportsSubtitles: false,
      supportsAnalytics: true,
      requiresAppApproval: true,
      accountTypeRequired: 'business_page', // Wajib akun profesional terhubung ke FB Page
      oauthScopes: ['instagram_content_publish', 'pages_read_engagement'],
      rateLimitNote: 'Batas 50 posting per 24 jam bergulir per akun Instagram profesional.',
    },
    officialDocUrl: 'https://developers.facebook.com/docs/instagram-platform/',
    description: {
      id: 'Format vertikal Reels (9:16) dan feed carousel sinematik untuk akun kreator Instagram.',
      en: 'Vertical Reels (9:16) and cinematic feed video for professional Instagram accounts.',
    },
    manualWorkflowNotes: {
      id: 'Unduh video 9:16 yang sudah diselaraskan Safe Area dan posting melalui Meta Business Suite atau Instagram App.',
      en: 'Download Safe-Area compliant 9:16 video and publish via Meta Business Suite or Instagram App.',
    },
  },

  facebook: {
    id: 'facebook',
    name: 'Facebook Video & Reels',
    category: 'social_network',
    color: '#3B82F6',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconName: 'Facebook',
    integrationStatus: 'manual_export_available',
    capabilities: {
      supportedAspectRatios: ['16:9', '9:16', '1:1'],
      supportedResolutions: ['1080p', '4K'],
      maxDurationSeconds: 14400, // 240 menit
      maxSizeBytes: 10737418240, // 10 GB
      supportsDirectPublishing: true,
      supportsManualExport: true,
      supportsScheduling: true,
      supportsDraftInboxMode: true,
      supportsThumbnailUpload: true,
      supportsSubtitles: true,
      supportsAnalytics: true,
      requiresAppApproval: true,
      accountTypeRequired: 'business_page',
      oauthScopes: ['pages_manage_posts', 'pages_read_engagement', 'publish_video'],
      rateLimitNote: 'Mengikuti alokasi kuota panggilan Meta Graph API per Halaman.',
    },
    officialDocUrl: 'https://developers.facebook.com/docs/graph-api/',
    description: {
      id: 'Publikasi video panjang (16:9) dan Facebook Reels (9:16) langsung ke Halaman Penggemar / Studio.',
      en: 'Publish long-form videos (16:9) and Facebook Reels (9:16) directly to Pages.',
    },
    manualWorkflowNotes: {
      id: 'Gunakan paket video master 1080p/4K dan posting ke Halaman Facebook Anda melalui Meta Business Suite.',
      en: 'Use master 1080p/4K video package and publish to your Facebook Page via Meta Business Suite.',
    },
  },

  // ============================================================================
  // 2. EXPANSION PLATFORMS
  // ============================================================================
  x_twitter: {
    id: 'x_twitter',
    name: 'X (Twitter)',
    category: 'social_network',
    color: '#94A3B8',
    badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    iconName: 'Twitter',
    integrationStatus: 'manual_export_available',
    capabilities: {
      supportedAspectRatios: ['16:9', '1:1', '9:16'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 140, // 140 detik reguler (hingga 2 jam untuk X Premium)
      maxSizeBytes: 536870912, // 512 MB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: false,
      supportsSubtitles: true,
      supportsAnalytics: false,
      requiresAppApproval: true,
      accountTypeRequired: 'personal',
      oauthScopes: ['tweet.write', 'media.write'],
      rateLimitNote: 'Memerlukan langganan X API Basic / Pro untuk akses media upload API v2.',
    },
    officialDocUrl: 'https://developer.x.com/en/docs',
    description: {
      id: 'Teaser klip sinematik 15-60 detik untuk memicu diskusi dan viralitas di linimasa X.',
      en: 'Fast-paced 15-60 second cinematic teasers to drive discourse on X timeline.',
    },
    manualWorkflowNotes: {
      id: 'Unduh Teaser 15 detik dari tab AI Virality dan unggah langsung ke postingan X bersama tagar yang disalin.',
      en: 'Download 15s Teaser from AI Virality tab and upload directly to an X post with copied hashtags.',
    },
  },

  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn Video',
    category: 'social_network',
    color: '#0284C7',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    iconName: 'Linkedin',
    integrationStatus: 'architecture_ready',
    capabilities: {
      supportedAspectRatios: ['16:9', '1:1', '9:16'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 600, // 10 menit
      maxSizeBytes: 5368709120, // 5 GB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: true,
      supportsSubtitles: true,
      supportsAnalytics: false,
      requiresAppApproval: true,
      accountTypeRequired: 'creator',
      oauthScopes: ['w_member_social'],
      rateLimitNote: 'Community Management API membutuhkan persetujuan program partner LinkedIn.',
    },
    officialDocUrl: 'https://learn.microsoft.com/en-us/linkedin/',
    description: {
      id: 'Showcase portofolio produksi film berbasis AI dan studi kasus teknologi audiovisual untuk jaringan profesional.',
      en: 'Showcase AI film production showreels and audiovisual case studies to a professional network.',
    },
    manualWorkflowNotes: {
      id: 'Gunakan video master 1080p horizontal dan sertakan file subtitle .srt untuk penonton profesional tanpa audio.',
      en: 'Use 1080p master video and attach .srt subtitle for sound-off professional viewers.',
    },
  },

  pinterest: {
    id: 'pinterest',
    name: 'Pinterest Video Pins',
    category: 'community',
    color: '#E11D48',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    iconName: 'Pin',
    integrationStatus: 'planned',
    capabilities: {
      supportedAspectRatios: ['9:16', '2:3', '1:1'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 900, // 15 menit
      maxSizeBytes: 2147483648, // 2 GB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: true,
      supportsSubtitles: false,
      supportsAnalytics: false,
      requiresAppApproval: true,
      accountTypeRequired: 'business_page',
      oauthScopes: ['pins:write', 'boards:read'],
    },
    officialDocUrl: 'https://developers.pinterest.com/',
    description: {
      id: 'Video pin vertikal berdaya tarik visual tinggi untuk penemuan ide visual, sinematografi, dan inspirasi seni.',
      en: 'High visual appeal vertical video pins for aesthetic cinematography and art discovery.',
    },
    manualWorkflowNotes: {
      id: 'Ekspor video format 9:16 dan pasang pin pada papan ide visual sinematik Anda.',
      en: 'Export 9:16 video and pin to your cinematic visual inspiration board.',
    },
  },

  snapchat: {
    id: 'snapchat',
    name: 'Snapchat Spotlight',
    category: 'short_form',
    color: '#FACC15',
    badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    iconName: 'Ghost',
    integrationStatus: 'planned',
    capabilities: {
      supportedAspectRatios: ['9:16'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 60,
      maxSizeBytes: 33554432, // 32 MB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: false,
      supportsSubtitles: false,
      supportsAnalytics: false,
      requiresAppApproval: true,
      accountTypeRequired: 'creator',
      oauthScopes: ['snapchat-marketing-api'],
    },
    officialDocUrl: 'https://developers.snap.com/',
    description: {
      id: 'Klip pendek vertikal berdurasi maksimal 60 detik untuk platform Spotlight Gen-Z.',
      en: 'Vertical short clips under 60 seconds optimized for Gen-Z Spotlight engagement.',
    },
    manualWorkflowNotes: {
      id: 'Gunakan klip teaser 15 detik vertikal untuk diunggah langsung ke Snapchat Spotlight.',
      en: 'Use vertical 15s teaser clip to upload directly into Snapchat Spotlight.',
    },
  },

  threads: {
    id: 'threads',
    name: 'Meta Threads',
    category: 'social_network',
    color: '#FFFFFF',
    badgeColor: 'bg-white/10 text-white border-white/20',
    iconName: 'AtSign',
    integrationStatus: 'architecture_ready',
    capabilities: {
      supportedAspectRatios: ['9:16', '16:9', '1:1'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 300, // 5 menit
      maxSizeBytes: 1073741824, // 1 GB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: false,
      supportsSubtitles: false,
      supportsAnalytics: false,
      requiresAppApproval: true,
      accountTypeRequired: 'personal',
      oauthScopes: ['threads_content_publish'],
    },
    officialDocUrl: 'https://developers.facebook.com/docs/threads/',
    description: {
      id: 'Distribusi cuplikan film dan teaser dialog sinematik ke jejaring percakapan Threads.',
      en: 'Share film sneak-peeks and dialogue teasers across Threads conversational network.',
    },
    manualWorkflowNotes: {
      id: 'Unggah cuplikan video melalui aplikasi Threads dengan melampirkan ulasan naskah dan proses kreatif.',
      en: 'Post video snippet on Threads app attaching behind-the-scenes screenplay notes.',
    },
  },

  telegram: {
    id: 'telegram',
    name: 'Telegram Channels',
    category: 'messaging',
    color: '#38BDF8',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    iconName: 'Send',
    integrationStatus: 'manual_export_available',
    capabilities: {
      supportedAspectRatios: ['16:9', '9:16'],
      supportedResolutions: ['1080p', '4K'],
      maxDurationSeconds: 7200,
      maxSizeBytes: 2147483648, // 2 GB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: true,
      supportsSubtitles: false,
      supportsAnalytics: false,
      requiresAppApproval: false,
      accountTypeRequired: 'channel',
      oauthScopes: ['bot_api'],
    },
    officialDocUrl: 'https://core.telegram.org/bots/api',
    description: {
      id: 'Distribusi video langsung ke channel siaran komunitas penggemar dan subscriber VIP.',
      en: 'Direct broadcast distribution to dedicated fan club channels and VIP subscribers.',
    },
    manualWorkflowNotes: {
      id: 'Unduh file video master dan kirimkan langsung sebagai berkas dokumen/video ke Channel Telegram Anda.',
      en: 'Download master video and send directly as uncompressed media to your Telegram Channel.',
    },
  },

  vimeo: {
    id: 'vimeo',
    name: 'Vimeo Cinema',
    category: 'video_sharing',
    color: '#1AB7EA',
    badgeColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    iconName: 'Film',
    integrationStatus: 'architecture_ready',
    capabilities: {
      supportedAspectRatios: ['16:9', '2.39:1'],
      supportedResolutions: ['1080p', '4K'],
      maxDurationSeconds: 43200,
      maxSizeBytes: 536870912000, // 500 GB (Tier bisnis)
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: true,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: true,
      supportsSubtitles: true,
      supportsAnalytics: false,
      requiresAppApproval: false,
      accountTypeRequired: 'creator',
      oauthScopes: ['upload', 'edit', 'video_files'],
    },
    officialDocUrl: 'https://developer.vimeo.com/',
    description: {
      id: 'Platform film independen berkualitas tinggi tanpa kompresi agresif, ideal untuk festival dan portofolio komersial.',
      en: 'High-fidelity cinema platform without aggressive compression, ideal for festivals and media showcase.',
    },
    manualWorkflowNotes: {
      id: 'Gunakan berkas ekspor 4K ProRes / MP4 Master bitrate tinggi untuk kualitas gambar paling murni di Vimeo.',
      en: 'Use high-bitrate 4K ProRes / MP4 Master export for pristine image fidelity on Vimeo.',
    },
  },

  dailymotion: {
    id: 'dailymotion',
    name: 'Dailymotion',
    category: 'video_sharing',
    color: '#0066DC',
    badgeColor: 'bg-blue-600/10 text-blue-400 border-blue-600/30',
    iconName: 'Tv',
    integrationStatus: 'planned',
    capabilities: {
      supportedAspectRatios: ['16:9'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 3600, // 60 menit
      maxSizeBytes: 2147483648, // 2 GB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: true,
      supportsSubtitles: true,
      supportsAnalytics: false,
      requiresAppApproval: false,
      accountTypeRequired: 'channel',
      oauthScopes: ['manage_videos'],
    },
    officialDocUrl: 'https://developers.dailymotion.com/',
    description: {
      id: 'Portal video global alternatif untuk memperluas jangkauan pemirsa di Eropa dan Asia Pasifik.',
      en: 'Global video portal expanding reach to European and Asia-Pacific viewers.',
    },
    manualWorkflowNotes: {
      id: 'Unduh video 1080p 16:9 dan unggah melalui portal studio partner Dailymotion.',
      en: 'Download 1080p 16:9 video and upload via Dailymotion Partner Studio.',
    },
  },

  reddit: {
    id: 'reddit',
    name: 'Reddit Cinema Communities',
    category: 'community',
    color: '#FF4500',
    badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    iconName: 'MessageSquare',
    integrationStatus: 'planned',
    capabilities: {
      supportedAspectRatios: ['16:9', '9:16', '1:1'],
      supportedResolutions: ['1080p'],
      maxDurationSeconds: 900, // 15 menit
      maxSizeBytes: 1073741824, // 1 GB
      supportsDirectPublishing: false,
      supportsManualExport: true,
      supportsScheduling: false,
      supportsDraftInboxMode: false,
      supportsThumbnailUpload: false,
      supportsSubtitles: false,
      supportsAnalytics: false,
      requiresAppApproval: true,
      accountTypeRequired: 'personal',
      oauthScopes: ['submit', 'read'],
    },
    officialDocUrl: 'https://www.reddit.com/dev/api/',
    description: {
      id: 'Berbagi karya ke subreddit pembuat film independen (r/filmmakers, r/artificial, r/shortfilms) untuk ulasan mendalam.',
      en: 'Share short films to enthusiast communities (r/filmmakers, r/artificial) for critical feedback.',
    },
    manualWorkflowNotes: {
      id: 'Ekspor video master dan buat postingan di subreddit yang relevan disertai deskripsi di balik layar produksi.',
      en: 'Export master video and post to appropriate subreddits including behind-the-scenes production lore.',
    },
  },
};

/**
 * Returns all 13 platforms in registry.
 */
export function getAllPlatforms(): PlatformDefinition[] {
  return Object.values(PLATFORM_REGISTRY);
}

/**
 * Returns the 4 First-Wave Priority platforms (YouTube, TikTok, Instagram, Facebook).
 */
export function getFirstWavePlatforms(): PlatformDefinition[] {
  return [
    PLATFORM_REGISTRY.youtube,
    PLATFORM_REGISTRY.tiktok,
    PLATFORM_REGISTRY.instagram,
    PLATFORM_REGISTRY.facebook,
  ];
}

/**
 * Returns the 9 Expansion platforms.
 */
export function getExpansionPlatforms(): PlatformDefinition[] {
  return [
    PLATFORM_REGISTRY.x_twitter,
    PLATFORM_REGISTRY.linkedin,
    PLATFORM_REGISTRY.pinterest,
    PLATFORM_REGISTRY.snapchat,
    PLATFORM_REGISTRY.threads,
    PLATFORM_REGISTRY.telegram,
    PLATFORM_REGISTRY.vimeo,
    PLATFORM_REGISTRY.dailymotion,
    PLATFORM_REGISTRY.reddit,
  ];
}

/**
 * Retrieve platform definition by stable ID.
 */
export function getPlatformById(id: PlatformId): PlatformDefinition | undefined {
  return PLATFORM_REGISTRY[id];
}

/**
 * Validates metadata and media specifications against platform-specific constraints.
 */
export function validateContentForPlatform(
  platformId: PlatformId,
  metadata: PublishingMetadata,
  mediaSpecs?: { durationSeconds?: number; sizeBytes?: number; aspectRatio?: string }
): ContentValidationResult {
  const platform = PLATFORM_REGISTRY[platformId];
  const issues: ContentValidationIssue[] = [];

  if (!platform) {
    return {
      isValid: false,
      issues: [{ type: 'error', field: 'platform', message: 'Platform tidak dikenal dalam registry' }],
    };
  }

  const { capabilities } = platform;

  // Title validation
  if (!metadata.title || metadata.title.trim().length === 0) {
    issues.push({
      type: 'error',
      field: 'title',
      message: 'Judul video wajib diisi untuk publikasi.',
    });
  } else if (platformId === 'youtube' && metadata.title.length > 100) {
    issues.push({
      type: 'error',
      field: 'title',
      message: `Judul YouTube melebihi batas 100 karakter (saat ini ${metadata.title.length}).`,
      suggestion: 'Persingkat judul agar tidak terpotong di hasil penelusuran.',
    });
  }

  // Aspect ratio compatibility
  if (mediaSpecs?.aspectRatio && !capabilities.supportedAspectRatios.includes(mediaSpecs.aspectRatio)) {
    issues.push({
      type: 'warning',
      field: 'aspectRatio',
      message: `Rasio aspek ${mediaSpecs.aspectRatio} bukan format optimal untuk ${platform.name}. Rekomendasi: ${capabilities.supportedAspectRatios.join(', ')}.`,
      suggestion: 'Gunakan Smart Reframe pada tab Format & Safe Area sebelum mengekspor.',
    });
  }

  // Duration validation
  if (mediaSpecs?.durationSeconds && mediaSpecs.durationSeconds > capabilities.maxDurationSeconds) {
    const maxMinutes = Math.floor(capabilities.maxDurationSeconds / 60);
    issues.push({
      type: 'error',
      field: 'duration',
      message: `Durasi video melebihi batas maksimum ${platform.name} (${maxMinutes} menit).`,
    });
  }

  // Size validation
  if (mediaSpecs?.sizeBytes && mediaSpecs.sizeBytes > capabilities.maxSizeBytes) {
    const maxMb = Math.floor(capabilities.maxSizeBytes / (1024 * 1024));
    issues.push({
      type: 'error',
      field: 'size',
      message: `Ukuran berkas melebihi batas maksimum ${platform.name} (${maxMb} MB).`,
    });
  }

  // Hashtag recommendations
  if (metadata.hashtags.length === 0) {
    issues.push({
      type: 'info',
      field: 'hashtags',
      message: `Menambahkan tagar yang relevan akan meningkatkan jangkauan penonton di ${platform.name}.`,
    });
  }

  return {
    isValid: issues.filter((i) => i.type === 'error').length === 0,
    issues,
  };
}
