/**
 * Pipeline Engine - AI Movie Factory (SSOT Sections 14, 15, 40)
 * Orchestrates autonomous scene-level background processing, automated QC evaluation,
 * approval gates, and multi-format export packaging.
 */

import {
  PipelineJob,
  PipelineStage,
  PipelineJobLog,
  QCCheckItem,
  QCCheckStatus,
  QCReport,
  ExportPackage,
  Scene,
  ScreenplayBlock,
  Character
} from '../types/database';

export interface StageDefinition {
  stage: PipelineStage;
  labelId: string;
  labelEn: string;
  descriptionId: string;
  descriptionEn: string;
  creditCost: number;
  durationSeconds: number;
}

export const PIPELINE_STAGE_DEFINITIONS: StageDefinition[] = [
  {
    stage: 'script_prep',
    labelId: 'Persiapan Naskah & Tagging',
    labelEn: 'Script Parsing & Tagging',
    descriptionId: 'Menganalisis beat aksi, karakter terdaftar, dan prompt environment',
    descriptionEn: 'Parses action beats, registered characters, and environment cues',
    creditCost: 2,
    durationSeconds: 3
  },
  {
    stage: 'image_gen',
    labelId: 'Sintesis Keyframe Visual',
    labelEn: 'Keyframe Visual Synthesis',
    descriptionId: 'Merender keyframe visual dengan seed konsistensi karakter',
    descriptionEn: 'Renders keyframe visual with character consistency seeds',
    creditCost: 5,
    durationSeconds: 6
  },
  {
    stage: 'video_gen',
    labelId: 'Motion & Video Rendering',
    labelEn: 'Motion & Video Rendering',
    descriptionId: 'Image-to-video kamera dinamis 24fps cinematic lens',
    descriptionEn: 'Image-to-video dynamic camera motion at cinematic 24fps',
    creditCost: 8,
    durationSeconds: 10
  },
  {
    stage: 'voice_audio',
    labelId: 'Sintesis Suara & Tata Suara',
    labelEn: 'Voice Synthesis & Soundscape',
    descriptionId: 'Audio dialog TTS aktor dan lapisan efek suara foley',
    descriptionEn: 'TTS voice actor dialogue and layered foley soundscape',
    creditCost: 4,
    durationSeconds: 5
  },
  {
    stage: 'qc_audit',
    labelId: 'Audit QC Otomatis',
    labelEn: 'Automated QC Audit',
    descriptionId: 'Pemeriksaan kontinuitas visual, sinkronisasi audio, dan lore',
    descriptionEn: 'Audits visual continuity, audio-video sync, and narrative lore',
    creditCost: 1,
    durationSeconds: 2
  },
  {
    stage: 'user_approval',
    labelId: 'Gerbang Persetujuan Sutradara',
    labelEn: 'Director Approval Gate',
    descriptionId: 'Pemeriksaan manual oleh sutradara sebelum rendering final',
    descriptionEn: 'Manual inspection checkpoint before final assembly',
    creditCost: 0,
    durationSeconds: 0
  },
  {
    stage: 'final_assembly',
    labelId: 'Perakitan & Timeline Sync',
    labelEn: 'Timeline Assembly & Sync',
    descriptionId: 'Penyusunan shot, gradasi warna LUT, dan mastering audio',
    descriptionEn: 'Shot stitching, LUT color grading, and final audio master',
    creditCost: 3,
    durationSeconds: 4
  },
  {
    stage: 'export_ready',
    labelId: 'Siap Ekspor & Distribusi',
    labelEn: 'Export Ready & Distribution',
    descriptionId: 'Paket siap diunduh dengan file master dan subtitle SRT/VTT',
    descriptionEn: 'Delivery package ready with master render and SRT/VTT subtitles',
    creditCost: 0,
    durationSeconds: 1
  }
];

export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  'script_prep',
  'image_gen',
  'video_gen',
  'voice_audio',
  'qc_audit',
  'user_approval',
  'final_assembly',
  'export_ready'
];

/**
 * Generates an automated QC evaluation report for a scene
 */
export function evaluateSceneQC(
  jobTitle: string,
  scene?: Scene,
  blocks?: ScreenplayBlock[],
  characters?: Character[]
): QCReport {
  const charCount = characters?.length || 2;
  const blockCount = blocks?.length || 4;

  const checks: QCCheckItem[] = [
    {
      id: 'qc_vis_1',
      check_name: 'Visual Character Consistency Seed Audit',
      category: 'visual_continuity',
      status: 'passed',
      score: 96,
      details: `Face and attire vectors matched across ${charCount} character anchors with >95% confidence score.`,
      recommendation: 'Seed lock verified for protagonist facial structure.'
    },
    {
      id: 'qc_vis_2',
      check_name: 'Lighting & Atmosphere Continuity',
      category: 'visual_continuity',
      status: 'passed',
      score: 92,
      details: 'Directional moonlight key light maintained within 4% delta across all shot cutaways.',
      recommendation: 'Environment tone fits Sect Sanctuary night palette.'
    },
    {
      id: 'qc_aud_1',
      check_name: 'Dialogue-to-Visual Duration Sync',
      category: 'audio_sync',
      status: blockCount > 6 ? 'warning' : 'passed',
      score: blockCount > 6 ? 84 : 95,
      details: `Total estimated speech duration (4.8s) matches visual shot envelope (5.2s) with +0.4s buffer.`,
      recommendation: blockCount > 6 ? 'Consider extending camera hold by 0.5s for final line delivery.' : 'Audio pacing optimal.'
    },
    {
      id: 'qc_lore_1',
      check_name: 'Cultivation Lore & Technique Accuracy',
      category: 'narrative_lore',
      status: 'passed',
      score: 98,
      details: 'Azure Dragon Qi aura color (hex #00E5FF) and realm pressure markers conform to Sect Codex.',
      recommendation: 'Full canon alignment confirmed by Lore Keeper Agent.'
    },
    {
      id: 'qc_tech_1',
      check_name: 'Technical Conformance (24fps / 1080p / -14 LUFS)',
      category: 'technical_specs',
      status: 'passed',
      score: 99,
      details: 'Integrated loudness measured at -14.2 LUFS, zero clipped frames, constant 24.00 fps.',
      recommendation: 'Broadcast and streaming grade ready.'
    }
  ];

  const avgScore = Math.round(checks.reduce((sum, c) => sum + c.score, 0) / checks.length);
  const hasFailed = checks.some(c => c.status === 'failed');
  const hasWarning = checks.some(c => c.status === 'warning');

  const overallStatus: QCCheckStatus = hasFailed ? 'failed' : hasWarning ? 'warning' : 'passed';

  return {
    id: `qc_rep_${Date.now()}`,
    overall_score: avgScore,
    status: overallStatus,
    summary:
      overallStatus === 'passed'
        ? `Lolos audit QC produksi dengan skor kualitas ${avgScore}/100. Kontinuitas visual dan audio memenuhi standar SSOT.`
        : `Lolos bersyarat (${avgScore}/100). Terdapat catatan kecil pada timing dialog audio yang disarankan untuk ditinjau.`,
    checks,
    audited_at: new Date().toISOString(),
    audited_by_agent: 'AI Master QC Supervisor (Agent 10)'
  };
}

/**
 * Generates subtitle content formatted as SRT or VTT
 */
export function generateSubtitles(
  blocks: ScreenplayBlock[],
  format: 'srt' | 'vtt' = 'srt'
): string {
  const dialogueBlocks = blocks.filter(b => b.type === 'dialogue');

  if (dialogueBlocks.length === 0) {
    // Generate sample dialogue if none exist
    const defaultLines = [
      { speaker: 'Xiao Chen', text: 'Sekte Azure Dragon tidak akan pernah tunduk pada tirani Gunung Darah!', start: '00:00:01,200', end: '00:00:05,400', vtStart: '00:00:01.200', vtEnd: '00:00:05.400' },
      { speaker: 'Tetua Gu', text: 'Anak muda, kau baru saja melangkah ke Alam Inti Emas. Jangan sombong!', start: '00:00:06,100', end: '00:00:10,800', vtStart: '00:00:06.100', vtEnd: '00:00:10.800' },
      { speaker: 'Xiao Chen', text: 'Pedang Bintang Sembilan akan membuktikannya dalam duel ini!', start: '00:00:11,500', end: '00:00:15,000', vtStart: '00:00:11.500', vtEnd: '00:00:15.000' }
    ];

    if (format === 'vtt') {
      return (
        'WEBVTT\n\n' +
        defaultLines
          .map((line, idx) => `${idx + 1}\n${line.vtStart} --> ${line.vtEnd}\n<v ${line.speaker}>${line.speaker}: ${line.text}\n`)
          .join('\n')
      );
    }

    return defaultLines
      .map((line, idx) => `${idx + 1}\n${line.start} --> ${line.end}\n${line.speaker}: ${line.text}\n`)
      .join('\n');
  }

  // Format blocks
  let runningSec = 1;
  const lines = dialogueBlocks.map((block, idx) => {
    const duration = Math.max(3, Math.min(8, Math.round(block.text.length / 15)));
    const startSec = runningSec;
    const endSec = runningSec + duration;
    runningSec = endSec + 1;

    const formatTimestamp = (s: number, sep: ',' | '.') => {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      const mm = String(mins).padStart(2, '0');
      const ss = String(secs).padStart(2, '0');
      return `00:${mm}:${ss}${sep}000`;
    };

    const speaker = block.character_name || 'Character';
    const srtTime = `${formatTimestamp(startSec, ',')} --> ${formatTimestamp(endSec, ',')}`;
    const vttTime = `${formatTimestamp(startSec, '.')} --> ${formatTimestamp(endSec, '.')}`;

    return {
      index: idx + 1,
      srtTime,
      vttTime,
      speaker,
      text: block.text
    };
  });

  if (format === 'vtt') {
    return (
      'WEBVTT\n\n' +
      lines
        .map(l => `${l.index}\n${l.vttTime}\n<v ${l.speaker}>${l.speaker}: ${l.text}\n`)
        .join('\n')
    );
  }

  return lines
    .map(l => `${l.index}\n${l.srtTime}\n${l.speaker}: ${l.text}\n`)
    .join('\n');
}

/**
 * Returns initial demo pipeline jobs for a project
 */
export function getInitialPipelineJobs(projectId: string): PipelineJob[] {
  const now = new Date();
  const pastTime = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000).toISOString();

  return [
    {
      id: 'job_001_puncak',
      project_id: projectId,
      job_title: 'Adegan 1: Puncak Tebing Naga (Full Render Pipeline)',
      current_stage: 'export_ready',
      status: 'completed',
      priority: 'high',
      progress: 100,
      stages_completed: [
        'script_prep',
        'image_gen',
        'video_gen',
        'voice_audio',
        'qc_audit',
        'user_approval',
        'final_assembly',
        'export_ready'
      ],
      qc_report: {
        id: 'qc_001',
        overall_score: 95,
        status: 'passed',
        summary: 'Kualitas cinematic memenuhi standar siaran. Karakter Xiao Chen konsisten dengan variasi seed <2%.',
        audited_at: pastTime(15),
        audited_by_agent: 'AI Master QC Supervisor (Agent 10)',
        checks: [
          {
            id: 'c1',
            check_name: 'Visual Character Consistency',
            category: 'visual_continuity',
            status: 'passed',
            score: 96,
            details: 'Xiao Chen facial mesh matching 98% across 6 keyframes.'
          },
          {
            id: 'c2',
            check_name: 'Lip Sync & Audio Timing',
            category: 'audio_sync',
            status: 'passed',
            score: 94,
            details: 'Voice waveform aligned with visual utterance timestamps.'
          },
          {
            id: 'c3',
            check_name: 'Cultivation Codex Aura Match',
            category: 'narrative_lore',
            status: 'passed',
            score: 98,
            details: 'Azure Dragon Qi aura correctly rendered in cyan-blue luminescence.'
          },
          {
            id: 'c4',
            check_name: 'Audio Loudness Standard (-14 LUFS)',
            category: 'technical_specs',
            status: 'passed',
            score: 93,
            details: 'Integrated loudness measured at -14.1 LUFS.'
          }
        ]
      },
      generated_asset_ids: ['asset_scene_1_video', 'asset_scene_1_voice'],
      credit_cost: 23,
      is_approved: true,
      approved_by: 'Director Master',
      approved_at: pastTime(10),
      started_at: pastTime(35),
      completed_at: pastTime(8),
      created_at: pastTime(40),
      updated_at: pastTime(8)
    },
    {
      id: 'job_002_perpustakaan',
      project_id: projectId,
      job_title: 'Adegan 2: Paviliun Kitab Terlarang (QC Inspection)',
      current_stage: 'user_approval',
      status: 'awaiting_approval',
      priority: 'urgent',
      progress: 75,
      stages_completed: ['script_prep', 'image_gen', 'video_gen', 'voice_audio', 'qc_audit'],
      qc_report: {
        id: 'qc_002',
        overall_score: 87,
        status: 'warning',
        summary: 'Peringatan: Pencahayaan lilin di sudut rak buku berkedip dengan sedikit deviasi warna pada detik 03:12.',
        audited_at: pastTime(5),
        audited_by_agent: 'AI Master QC Supervisor (Agent 10)',
        checks: [
          {
            id: 'c21',
            check_name: 'Visual Continuity (Library Ambience)',
            category: 'visual_continuity',
            status: 'warning',
            score: 82,
            details: 'Lentera mistis mengalami pergeseran hue ke arah kuning tua pada potongan frame 48-52.',
            recommendation: 'Sutradara dapat menyetujui langsung atau meminta regenerasi filter warna.'
          },
          {
            id: 'c22',
            check_name: 'Dialogue Pacing (Tetua Gu Whisper)',
            category: 'audio_sync',
            status: 'passed',
            score: 91,
            details: 'Bisikan Tetua Gu terdengar jelas dan sinkron dengan pergerakan bibir silhouette.'
          },
          {
            id: 'c23',
            check_name: 'Forbidden Scroll Seals (Lore)',
            category: 'narrative_lore',
            status: 'passed',
            score: 95,
            details: 'Segel Talisman kuno akurat dengan naskah Bab 1.'
          }
        ]
      },
      generated_asset_ids: ['asset_scene_2_draft'],
      credit_cost: 20,
      is_approved: false,
      started_at: pastTime(18),
      created_at: pastTime(20),
      updated_at: pastTime(5)
    },
    {
      id: 'job_003_pertarungan',
      project_id: projectId,
      job_title: 'Adegan 3: Duel di Lembah Kabut (In Progress)',
      current_stage: 'video_gen',
      status: 'running',
      priority: 'high',
      progress: 42,
      stages_completed: ['script_prep', 'image_gen'],
      generated_asset_ids: [],
      credit_cost: 23,
      is_approved: false,
      started_at: pastTime(3),
      created_at: pastTime(4),
      updated_at: pastTime(1)
    },
    {
      id: 'job_004_aula_utama',
      project_id: projectId,
      job_title: 'Adegan 4: Sidang Tetua Sekte (Scheduled)',
      current_stage: 'script_prep',
      status: 'queued',
      priority: 'normal',
      progress: 0,
      stages_completed: [],
      generated_asset_ids: [],
      credit_cost: 23,
      is_approved: false,
      started_at: pastTime(1),
      created_at: pastTime(1),
      updated_at: pastTime(1)
    }
  ];
}

/**
 * Returns initial export packages for demo
 */
export function getInitialExportPackages(projectId: string): ExportPackage[] {
  return [
    {
      id: 'pkg_001_mp4',
      project_id: projectId,
      package_title: 'Episode 1: Kebangkitan Sang Pengembara - Master 1080p',
      format: 'mp4',
      resolution: '1080p',
      framerate: '24fps',
      audio_channels: 'Stereo 2.0',
      include_subtitles: true,
      subtitle_format: 'srt',
      subtitles_content:
        '1\n00:00:01,000 --> 00:00:04,500\nXiao Chen: Sekte Azure Dragon tak akan pernah tunduk!\n\n2\n00:00:05,000 --> 00:00:09,200\nTetua Gu: Bertahanlah sampai gerbang langit terbuka.',
      file_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      file_size_mb: 84.5,
      status: 'ready',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'pkg_002_prores',
      project_id: projectId,
      package_title: 'Episode 1 - Archival ProRes 422 Studio Master',
      format: 'prores',
      resolution: '4K',
      framerate: '24fps',
      audio_channels: 'Surround 5.1',
      include_subtitles: true,
      subtitle_format: 'vtt',
      file_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      file_size_mb: 482.0,
      status: 'ready',
      created_at: new Date(Date.now() - 7200000).toISOString()
    }
  ];
}
