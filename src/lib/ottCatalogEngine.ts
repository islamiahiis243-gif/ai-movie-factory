/**
 * AI Movie Factory — Phase 6: Independent OTT Catalog Engine (Milestone 2.9)
 * 
 * Architectural Invariants:
 * 1. Isolated Domain: Zero overlap with AMF Creator SaaS billing (subscriptions/credits).
 * 2. Multi-Tenant Integrity: All catalog items are bound to channel.user_id; cross-tenant linking is strictly blocked.
 * 3. Gate 5 Production Linking: Publishing requires valid Gate 5 final approved master render & video URL.
 * 4. Access Policy Modeling: Free, PPV/TVOD, SVOD Subscriber Only, Scheduled Release.
 * 5. Public Projection Security: Unapproved drafts and internal production keys are filtered from public view.
 */

import {
  OttChannel,
  OttSeries,
  OttSeason,
  OttEpisode,
  OttFilm,
  OttCastMember,
  OttAccessPolicy,
  OttPublicationStatus,
  OttMasterApprovalStatus,
  Project,
  ExportPackage,
} from '../types/database';

export interface CatalogValidationResult {
  valid: boolean;
  error?: string;
  remedyAction?: string;
}

/**
 * Validates whether a production asset has passed Gate 5 Final Approval and is eligible for catalog linking.
 */
export function validateMasterAssetForCatalog(params: {
  project?: Partial<Project>;
  masterPackage?: Partial<ExportPackage> | null;
  videoUrl?: string;
  fingerprint?: string;
}): CatalogValidationResult {
  const { project, masterPackage, videoUrl } = params;

  if (!project && !masterPackage && !videoUrl) {
    return {
      valid: false,
      error: 'Tidak ada referensi aset master produksi yang diberikan.',
      remedyAction: 'Pilih proyek yang telah menyelesaikan ekspor master di Modul 7 (Gate 5).',
    };
  }

  // Check Gate 5 Director Approval status
  const isGate5Approved =
    project?.director_approval_status === 'approved' ||
    (project as any)?.is_final_approved === true ||
    (masterPackage as any)?.approval_status === 'approved' ||
    (masterPackage as any)?.is_approved === true;

  if (!isGate5Approved) {
    return {
      valid: false,
      error: 'Aset produksi belum disetujui sutradara pada Gate 5 (Final Master Approval).',
      remedyAction: 'Buka Editing & Post-Produksi, lakukan persetujuan Gate 5 sebelum menyematkan ke katalog OTT.',
    };
  }

  const effectiveUrl = videoUrl || masterPackage?.video_url || (project as any)?.master_render_url;
  if (!effectiveUrl) {
    return {
      valid: false,
      error: 'File master video fisik (MP4/ProRes) belum tersedia di penyimpanan.',
      remedyAction: 'Jalankan ekspor master video di Modul 7 terlebih dahulu.',
    };
  }

  return { valid: true };
}

/**
 * Validates whether an episode or film is legally ready to be published to the public OTT portal.
 */
export function validateCatalogItemPublication(item: {
  title: string;
  publication_status: OttPublicationStatus;
  master_approval_status: OttMasterApprovalStatus;
  master_video_url?: string;
  runtime_seconds: number;
  thumbnail_url?: string;
  poster_url?: string;
}): CatalogValidationResult {
  if (item.publication_status === 'published') {
    if (item.master_approval_status !== 'GATE_5_APPROVED') {
      return {
        valid: false,
        error: `Item "${item.title}" ditolak publikasi: Status persetujuan master harus GATE_5_APPROVED. (Status saat ini: ${item.master_approval_status})`,
        remedyAction: 'Hubungkan master video yang telah disetujui Gate 5.',
      };
    }

    if (!item.master_video_url || item.master_video_url.trim() === '') {
      return {
        valid: false,
        error: `Item "${item.title}" ditolak publikasi: URL file master video tidak boleh kosong.`,
        remedyAction: 'Pastikan file video master tersimpan di storage dan terhubung.',
      };
    }

    if (item.runtime_seconds <= 0) {
      return {
        valid: false,
        error: `Item "${item.title}" ditolak publikasi: Durasi video harus lebih dari 0 detik.`,
        remedyAction: 'Periksa durasi master video sebelum memublikasikan.',
      };
    }

    const hasVisualArtwork = Boolean(item.thumbnail_url || item.poster_url);
    if (!hasVisualArtwork) {
      return {
        valid: false,
        error: `Item "${item.title}" ditolak publikasi: Wajib menyertakan artwork poster atau thumbnail.`,
        remedyAction: 'Unggah atau pilih cover poster/thumbnail untuk katalog.',
      };
    }
  }

  return { valid: true };
}

/**
 * Links a Gate 5 production master export to an OTT episode or film, strictly preventing cross-tenant hijacks.
 */
export function linkProductionMasterToCatalogItem<T extends OttEpisode | OttFilm>(params: {
  targetItem: T;
  project: Project;
  requestingUserId: string;
  masterPackage?: ExportPackage | null;
  videoUrl?: string;
  fingerprint?: string;
  runtimeSeconds?: number;
  subtitleVttUrl?: string;
  chapters?: Array<{ time: number; title: string }>;
}): T {
  const { targetItem, project, requestingUserId, masterPackage, videoUrl, fingerprint, runtimeSeconds, subtitleVttUrl, chapters } = params;

  // Multi-tenant check: ensure project owner matches target item owner and requesting user
  if (project.user_id !== requestingUserId || targetItem.user_id !== requestingUserId) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk menautkan aset produksi dari studio/kreator lain (Cross-Tenant Violation).');
  }

  const validation = validateMasterAssetForCatalog({
    project,
    masterPackage,
    videoUrl,
    fingerprint,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Validasi aset master gagal.');
  }

  const effectiveVideoUrl = videoUrl || masterPackage?.video_url || (project as any).master_render_url || '';
  const effectiveFingerprint = fingerprint || (masterPackage as any)?.fingerprint || `fp_${project.id}_${Date.now()}`;
  const effectiveRuntime = runtimeSeconds || (project as any).duration_seconds || (project as any).target_duration || targetItem.runtime_seconds || 180;

  return {
    ...targetItem,
    source_project_id: project.id,
    master_export_id: masterPackage?.id || `exp_${project.id}`,
    master_video_url: effectiveVideoUrl,
    master_video_fingerprint: effectiveFingerprint,
    master_approval_status: 'GATE_5_APPROVED' as OttMasterApprovalStatus,
    runtime_seconds: effectiveRuntime,
    subtitle_vtt_url: subtitleVttUrl || (masterPackage as any)?.subtitle_url || targetItem.subtitle_vtt_url,
    chapters_json: chapters || (masterPackage as any)?.chapters || targetItem.chapters_json || [],
    publication_status: 'ready_for_catalog' as OttPublicationStatus,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Filters and sanitizes catalog items for public viewers (eliminates unapproved drafts, internal project IDs).
 */
export function projectPublicCatalogItems<T extends OttSeries | OttFilm | OttEpisode>(items: T[]): T[] {
  return items
    .filter((item) => item.publication_status === 'published')
    .map((item) => {
      // Create a clean public copy without internal production references
      const publicCopy = { ...item };
      if ('source_project_id' in publicCopy) {
        delete (publicCopy as any).source_project_id;
      }
      if ('master_export_id' in publicCopy) {
        delete (publicCopy as any).master_export_id;
      }
      return publicCopy;
    });
}

/**
 * Calculates aggregated series metrics (total episodes, total seasons, total runtime, free vs PPV count).
 */
export function calculateSeriesAggregation(series: OttSeries, seasons: OttSeason[], episodes: OttEpisode[]) {
  const seriesEpisodes = episodes.filter((ep) => ep.series_id === series.id);
  const seriesSeasons = seasons.filter((sn) => sn.series_id === series.id);

  const totalRuntimeSeconds = seriesEpisodes.reduce((acc, ep) => acc + (ep.runtime_seconds || 0), 0);
  const freeEpisodesCount = seriesEpisodes.filter((ep) => ep.access_policy === 'free').length;
  const ppvEpisodesCount = seriesEpisodes.filter((ep) => ep.access_policy === 'ppv_tvod').length;
  const publishedEpisodesCount = seriesEpisodes.filter((ep) => ep.publication_status === 'published').length;

  return {
    totalSeasonsCount: seriesSeasons.length || 1,
    totalEpisodesCount: seriesEpisodes.length,
    publishedEpisodesCount,
    draftEpisodesCount: seriesEpisodes.length - publishedEpisodesCount,
    totalRuntimeSeconds,
    totalRuntimeFormatted: `${Math.floor(totalRuntimeSeconds / 60)}m ${totalRuntimeSeconds % 60}s`,
    freeEpisodesCount,
    ppvEpisodesCount,
    isFullyPublished: seriesEpisodes.length > 0 && publishedEpisodesCount === seriesEpisodes.length,
  };
}

/**
 * Generates an initial mock/seed OTT channel and catalog for demo or offline usage.
 */
export function createDefaultOttChannel(userId: string, studioName = 'Apex Drama Studios'): OttChannel {
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '');
  const slug = studioName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return {
    id: `ott_chan_${cleanId}`,
    user_id: userId,
    name: studioName,
    slug: slug || 'my-studio-channel',
    description: 'Studio film AI independen memproduksi serial web drama vertikal dan film pendek sinematik.',
    logo_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&h=200&fit=crop',
    banner_url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=1200&h=400&fit=crop',
    website_url: `https://${slug}.amf.ott`,
    social_links: {
      youtube: 'https://youtube.com/@apexdrama',
      tiktok: 'https://tiktok.com/@apexdrama',
      instagram: 'https://instagram.com/apexdrama',
    },
    is_verified: true,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
