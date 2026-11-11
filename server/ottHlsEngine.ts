/**
 * AI Movie Factory — Server-Side OTT HLS Adaptive Bitrate Streaming & Transcoding Engine
 * Milestone 2.9.2D: HLS Adaptive Streaming & Transcoding Pipeline (Wave II SSOT Bagian IV.4)
 * 
 * Strict Architectural Invariants:
 * 1. RFC 8216 HLS Compliance: Outputs strictly valid Master Playlists (M3U8) and Variant Streams.
 * 2. Multi-Resolution Ladder: 1080p (FHD), 720p (HD), 480p (SD), 360p (Mobile/Data Saver).
 * 3. Dual Aspect Ratio Awareness: 16:9 Landscape (1920x1080) & 9:16 Vertical Drama (1080x1920).
 * 4. Backward-Compatible Fallback: Transparently falls back to HTML5 Progressive MP4 if HLS is pending.
 * 5. Atomic Lifecycle Management: Integrates with public.ott_transcoding_jobs via stored procedure.
 */

import { getSupabaseAdmin } from './supabaseAdmin.ts';
import type {
  HlsResolution,
  HlsStreamRendition,
  OttTranscodingJob,
} from '../src/types/database.ts';

export interface HlsStreamLadderConfig {
  resolution: HlsResolution;
  width16x9: number;
  height16x9: number;
  width9x16: number;
  height9x16: number;
  bandwidth: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  codecs: string;
}

export const HLS_STREAM_LADDER: HlsStreamLadderConfig[] = [
  {
    resolution: '1080p',
    width16x9: 1920,
    height16x9: 1080,
    width9x16: 1080,
    height9x16: 1920,
    bandwidth: 4800000,
    videoBitrateKbps: 4500,
    audioBitrateKbps: 192,
    codecs: 'avc1.640028,mp4a.40.2',
  },
  {
    resolution: '720p',
    width16x9: 1280,
    height16x9: 720,
    width9x16: 720,
    height9x16: 1280,
    bandwidth: 2650000,
    videoBitrateKbps: 2500,
    audioBitrateKbps: 128,
    codecs: 'avc1.4d401f,mp4a.40.2',
  },
  {
    resolution: '480p',
    width16x9: 854,
    height16x9: 480,
    width9x16: 480,
    height9x16: 854,
    bandwidth: 1300000,
    videoBitrateKbps: 1200,
    audioBitrateKbps: 96,
    codecs: 'avc1.4d401e,mp4a.40.2',
  },
  {
    resolution: '360p',
    width16x9: 640,
    height16x9: 360,
    width9x16: 360,
    height9x16: 640,
    bandwidth: 680000,
    videoBitrateKbps: 600,
    audioBitrateKbps: 64,
    codecs: 'avc1.42e01e,mp4a.40.2',
  },
];

export class OttHlsEngine {
  private getDb() {
    return getSupabaseAdmin();
  }

  /**
   * Generates standard RFC 8216 compliant HLS Master Playlist (m3u8)
   */
  public generateMasterPlaylist(params: {
    renditions: HlsStreamRendition[];
    aspectRatio?: '16:9' | '9:16';
  }): string {
    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-INDEPENDENT-SEGMENTS',
      '',
    ];

    for (const rendition of params.renditions) {
      const ladderItem = HLS_STREAM_LADDER.find((l) => l.resolution === rendition.resolution);
      const codecs = ladderItem?.codecs || 'avc1.4d401f,mp4a.40.2';
      
      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.width}x${rendition.height},FRAME-RATE=24.000,CODECS="${codecs}",NAME="${rendition.resolution}"`
      );
      lines.push(rendition.playlistPath);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Generates a standard media variant playlist (.m3u8) for a single resolution rendition
   */
  public generateMediaPlaylist(params: {
    resolution: HlsResolution;
    segmentCount: number;
    segmentDurationSeconds: number;
    segmentPathPrefix: string;
    totalRuntimeSeconds: number;
  }): string {
    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${Math.ceil(params.segmentDurationSeconds)}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      '',
    ];

    let remainingTime = params.totalRuntimeSeconds;
    for (let i = 0; i < params.segmentCount; i++) {
      const duration = Math.min(params.segmentDurationSeconds, remainingTime);
      lines.push(`#EXTINF:${duration.toFixed(3)},`);
      lines.push(`${params.segmentPathPrefix}/segment_${String(i).padStart(4, '0')}.ts`);
      remainingTime -= duration;
      if (remainingTime <= 0) break;
    }

    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n') + '\n';
  }

  /**
   * Computes stream renditions for content based on aspect ratio
   */
  public computeStreamRenditions(params: {
    targetResolutions?: HlsResolution[];
    aspectRatio?: '16:9' | '9:16';
    outputPrefix: string;
  }): HlsStreamRendition[] {
    const resolutions = params.targetResolutions || ['1080p', '720p', '480p', '360p'];
    const isVertical = params.aspectRatio === '9:16';

    return resolutions.map((res) => {
      const config = HLS_STREAM_LADDER.find((l) => l.resolution === res)!;
      return {
        resolution: res,
        width: isVertical ? config.width9x16 : config.width16x9,
        height: isVertical ? config.height9x16 : config.height16x9,
        bandwidth: config.bandwidth,
        videoBitrateKbps: config.videoBitrateKbps,
        audioBitrateKbps: config.audioBitrateKbps,
        playlistPath: `${params.outputPrefix}/${res}/playlist.m3u8`,
      };
    });
  }

  /**
   * Queue a new HLS transcoding job for a film or episode
   */
  public async queueTranscodingJob(params: {
    userId: string;
    channelId: string;
    contentId: string;
    contentType: 'film' | 'episode';
    sourceVideoUrl: string;
    targetResolutions?: HlsResolution[];
    aspectRatio?: '16:9' | '9:16';
  }): Promise<OttTranscodingJob> {
    const db = this.getDb();
    const targetResolutions = params.targetResolutions || ['1080p', '720p', '480p', '360p'];
    const outputPrefix = `hls/${params.contentType}s/${params.contentId}`;

    const { data: job, error: insertErr } = await db
      .from('ott_transcoding_jobs')
      .insert({
        user_id: params.userId,
        channel_id: params.channelId,
        content_id: params.contentId,
        content_type: params.contentType,
        source_video_url: params.sourceVideoUrl,
        status: 'queued',
        target_resolutions: targetResolutions,
        hls_output_prefix: outputPrefix,
        progress_percent: 0,
      })
      .select()
      .single();

    if (insertErr || !job) {
      throw new Error(`Failed to queue transcoding job: ${insertErr?.message}`);
    }

    // Update catalog item status to 'queued'
    const table = params.contentType === 'film' ? 'ott_films' : 'ott_episodes';
    await db
      .from(table)
      .update({ transcoding_status: 'queued' })
      .eq('id', params.contentId);

    return job as OttTranscodingJob;
  }

  /**
   * Complete transcoding job and publish master playlist atomically
   */
  public async completeTranscodingJob(params: {
    jobId: string;
    masterPlaylistPath: string;
    availableResolutions?: HlsResolution[];
  }): Promise<{ success: boolean; contentId: string; masterPlaylistUrl: string }> {
    const db = this.getDb();
    const resolutions = params.availableResolutions || ['1080p', '720p', '480p', '360p'];

    const { data, error } = await db.rpc('complete_ott_transcoding_job', {
      p_job_id: params.jobId,
      p_master_playlist_path: params.masterPlaylistPath,
      p_available_resolutions: resolutions,
    });

    if (error || !data || data.success === false) {
      throw new Error(`Failed to complete transcoding job: ${error?.message || data?.error}`);
    }

    return {
      success: true,
      contentId: data.content_id,
      masterPlaylistUrl: data.master_playlist_url,
    };
  }

  /**
   * Resolve playback stream capabilities (HLS vs Progressive MP4)
   */
  public resolvePlaybackMode(content: {
    hls_master_playlist_url?: string | null;
    transcoding_status?: string | null;
    available_resolutions?: string[] | null;
    master_video_url?: string | null;
  }): {
    mode: 'hls' | 'progressive';
    hlsUrl: string | null;
    resolutions: string[];
    isAdaptive: boolean;
  } {
    if (
      content.hls_master_playlist_url &&
      content.transcoding_status === 'ready'
    ) {
      return {
        mode: 'hls',
        hlsUrl: content.hls_master_playlist_url,
        resolutions: content.available_resolutions || ['1080p', '720p', '480p', '360p'],
        isAdaptive: true,
      };
    }

    // Fallback to progressive MP4
    return {
      mode: 'progressive',
      hlsUrl: null,
      resolutions: ['1080p'],
      isAdaptive: false,
    };
  }
}

export const ottHlsEngine = new OttHlsEngine();
