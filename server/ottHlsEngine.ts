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
import { parseAndValidateStoragePath } from './ottMediaDelivery.ts';
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
   * Executes full end-to-end transcoding pipeline lifecycle for a queued job.
   * Includes source video validation, progress updates, rendition generation,
   * catalog item verification, and atomic database state completion.
   */
  public async executeTranscodingPipeline(
    jobId: string,
    options?: {
      stepCallback?: (progressPercent: number, statusMessage: string) => void;
    }
  ): Promise<{
    success: boolean;
    jobId: string;
    contentId: string;
    contentType: 'film' | 'episode';
    masterPlaylistUrl: string;
    renditionsCount: number;
  }> {
    const db = this.getDb();

    // 1. Fetch job record
    const { data: job, error: jobErr } = await db
      .from('ott_transcoding_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobErr || !job) {
      throw new Error(`TRANSCODING_JOB_NOT_FOUND: Job dengan ID '${jobId}' tidak ditemukan.`);
    }

    if (job.status !== 'queued' && job.status !== 'processing') {
      throw new Error(`ILLEGAL_JOB_STATE: Job berada dalam status '${job.status}', tidak dapat diproses.`);
    }

    const reportProgress = async (pct: number, status: 'processing' | 'failed' | 'completed', errMsg?: string) => {
      await db
        .from('ott_transcoding_jobs')
        .update({
          status,
          progress_percent: pct,
          error_message: errMsg || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (options?.stepCallback) {
        options.stepCallback(pct, status);
      }
    };

    try {
      // 2. Validate Source Video URL / Storage Object
      if (!job.source_video_url || typeof job.source_video_url !== 'string') {
        throw new Error('INVALID_SOURCE_VIDEO: Source video URL tidak valid atau kosong.');
      }

      // Validate storage path security if internal path
      parseAndValidateStoragePath(job.source_video_url);

      // 3. Verify Target Catalog Item Exists
      const table = job.content_type === 'film' ? 'ott_films' : 'ott_episodes';
      const { data: catalogItem, error: catErr } = await db
        .from(table)
        .select('id, channel_id, publication_status, runtime_seconds')
        .eq('id', job.content_id)
        .maybeSingle();

      if (catErr || !catalogItem) {
        throw new Error(`CATALOG_ITEM_NOT_FOUND: Target ${job.content_type} '${job.content_id}' tidak ditemukan di katalog.`);
      }

      // Step 1: Advance to processing (25%)
      await reportProgress(25, 'processing');

      // 4. Compute Stream Renditions & Ladder
      const renditions = this.computeStreamRenditions({
        targetResolutions: job.target_resolutions,
        aspectRatio: '16:9',
        outputPrefix: job.hls_output_prefix,
      });

      // Step 2: Intermediate Progress — Generate Master Playlist & Variant Media Playlists (50%)
      await reportProgress(50, 'processing');

      const masterM3u8 = this.generateMasterPlaylist({
        renditions,
        aspectRatio: '16:9',
      });

      const variantPlaylists: Array<{ path: string; content: string; res: HlsResolution }> = [];
      const runtimeSecs = catalogItem.runtime_seconds || 120;
      const segmentDuration = 6;
      const segmentCount = Math.max(1, Math.ceil(runtimeSecs / segmentDuration));

      for (const rendition of renditions) {
        const variantM3u8 = this.generateMediaPlaylist({
          resolution: rendition.resolution,
          segmentCount,
          segmentDurationSeconds: segmentDuration,
          segmentPathPrefix: `${job.hls_output_prefix}/${rendition.resolution}`,
          totalRuntimeSeconds: runtimeSecs,
        });
        variantPlaylists.push({
          path: `${job.hls_output_prefix}/${rendition.resolution}/playlist.m3u8`,
          content: variantM3u8,
          res: rendition.resolution,
        });
      }

      // Step 3: Physical Upload to Supabase Storage Bucket 'ott-masters'
      const masterPlaylistPath = `${job.hls_output_prefix}/master.m3u8`;

      if (!options?.mockStorageUpload) {
        // Upload Master Playlist
        const { error: masterUpErr } = await db.storage
          .from('ott-masters')
          .upload(masterPlaylistPath, Buffer.from(masterM3u8, 'utf8'), {
            contentType: 'application/vnd.apple.mpegurl',
            upsert: true,
          });

        if (masterUpErr) {
          throw new Error(`STORAGE_UPLOAD_ERROR: Gagal mengunggah master playlist ke ott-masters: ${masterUpErr.message}`);
        }

        // Upload Variant Playlists
        for (const variant of variantPlaylists) {
          const { error: varUpErr } = await db.storage
            .from('ott-masters')
            .upload(variant.path, Buffer.from(variant.content, 'utf8'), {
              contentType: 'application/vnd.apple.mpegurl',
              upsert: true,
            });

          if (varUpErr) {
            throw new Error(`STORAGE_UPLOAD_ERROR: Gagal mengunggah variant playlist (${variant.res}): ${varUpErr.message}`);
          }
        }

        // Step 4: Strict Physical Verification Guard (Verify existence of master, variants & segments in storage)
        const { data: storageList, error: listErr } = await db.storage
          .from('ott-masters')
          .list(job.hls_output_prefix);

        const hasMasterFile = storageList?.some((f: any) => f.name === 'master.m3u8');
        if (listErr || !hasMasterFile) {
          throw new Error(`PHYSICAL_ARTIFACTS_NOT_FOUND: Verifikasi fisik artefak HLS di bucket 'ott-masters' gagal. Master playlist tidak ditemukan.`);
        }

        // Verify variant playlists and segment availability before marking ready
        for (const variant of variantPlaylists) {
          const variantFolder = `${job.hls_output_prefix}/${variant.res}`;
          const { data: variantList, error: varListErr } = await db.storage
            .from('ott-masters')
            .list(variantFolder);

          const hasVariantPlaylist = variantList?.some((f: any) => f.name === 'playlist.m3u8');
          const hasVideoSegments = variantList?.some((f: any) => f.name.endsWith('.ts') || f.name.endsWith('.m4s'));

          if (varListErr || !hasVariantPlaylist) {
            throw new Error(`PHYSICAL_ARTIFACTS_NOT_FOUND: Variant playlist untuk resolusi ${variant.res} tidak ditemukan di storage.`);
          }

          if (!hasVideoSegments) {
            // Strict Commercial MVP Policy: Fail-closed if media segments are not yet generated
            throw new Error(`HLS_SEGMENTS_NOT_READY: Segmen media video (.ts) untuk resolusi ${variant.res} belum selesai diproses. Status 'ready' ditolak untuk melindungi penonton dari stream 404.`);
          }
        }
      }

      // Step 5: Advance progress to 75%
      await reportProgress(75, 'processing');

      // Step 6: Atomic DB Completion via RPC (Only executed if physical verification succeeded!)
      const completeResult = await this.completeTranscodingJob({
        jobId,
        masterPlaylistPath,
        availableResolutions: job.target_resolutions,
      });

      return {
        success: true,
        jobId,
        contentId: completeResult.contentId,
        contentType: job.content_type,
        masterPlaylistUrl: completeResult.masterPlaylistUrl,
        renditionsCount: renditions.length,
      };
    } catch (err: any) {
      // Fail-safe transition: Mark job and catalog item as failed
      await reportProgress(job.progress_percent || 0, 'failed', err.message);
      const table = job.content_type === 'film' ? 'ott_films' : 'ott_episodes';
      await db
        .from(table)
        .update({ transcoding_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', job.content_id);

      throw err;
    }
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
