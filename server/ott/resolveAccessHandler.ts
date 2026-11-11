/**
 * Handler: resolveAccessHandler.ts (server/ott/resolveAccessHandler.ts)
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.1: Hardened Content Access Control & Entitlement Engine Endpoint
 */

import { authenticateServerlessRequest, getSupabaseAdmin } from '../supabaseAdmin.ts';
import { resolveOttContentAccess } from '../../src/lib/ottEntitlementEngine.ts';
import type {
  OttChannel,
  OttEpisode,
  OttFilm,
  OttSeries,
  OttAccessPass,
  OttViewerSubscription,
  ResolveOttAccessParams,
} from '../../src/types/database.ts';

export default async function resolveAccessHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Access resolution requires HTTP POST method.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({
        error: 'INVALID_JSON_BODY',
        message: 'Request body must be valid JSON.',
      });
    }
  }

  const {
    channelId,
    contentId,
    contentType = 'film',
    geoCountry = 'ID',
    requestedQuality = '1080p',
    currentTimeUtc = new Date().toISOString(),
    _mockViewer,
  } = body || {};

  if (!channelId || !contentId) {
    return res.status(400).json({
      error: 'MISSING_PARAMETERS',
      message: 'channelId and contentId are required.',
    });
  }

  let authenticatedViewer: any = null;
  let adminClient: any = null;

  if (_mockViewer && process.env.NODE_ENV !== 'production') {
    authenticatedViewer = _mockViewer;
    try {
      adminClient = getSupabaseAdmin();
    } catch {
      adminClient = null;
    }
  } else {
    try {
      const authContext = await authenticateServerlessRequest(req);
      authenticatedViewer = authContext.user;
      adminClient = authContext.adminSupabase;
    } catch (authErr: any) {
      authenticatedViewer = null;
      try {
        adminClient = getSupabaseAdmin();
      } catch {
        adminClient = null;
      }
    }
  }

  const viewerId = authenticatedViewer?.id || null;

  try {
    if (!adminClient) {
      adminClient = getSupabaseAdmin();
    }

    const { data: channel, error: chErr } = await adminClient
      .from('ott_channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (chErr || !channel) {
      return res.status(404).json({
        error: 'CHANNEL_NOT_FOUND',
        message: `OTT Channel with ID "${channelId}" not found.`,
      });
    }

    let film: OttFilm | null = null;
    let series: OttSeries | null = null;
    let episode: OttEpisode | null = null;

    if (contentType === 'film') {
      const { data: filmData, error: filmErr } = await adminClient
        .from('ott_films')
        .select('*')
        .eq('id', contentId)
        .single();

      if (filmErr || !filmData) {
        return res.status(404).json({
          error: 'CONTENT_NOT_FOUND',
          message: `Film with ID "${contentId}" not found in catalog.`,
        });
      }
      film = filmData as OttFilm;
    } else if (contentType === 'episode') {
      const { data: epData, error: epErr } = await adminClient
        .from('ott_episodes')
        .select('*')
        .eq('id', contentId)
        .single();

      if (epErr || !epData) {
        return res.status(404).json({
          error: 'CONTENT_NOT_FOUND',
          message: `Episode with ID "${contentId}" not found in catalog.`,
        });
      }
      episode = epData as OttEpisode;
    } else {
      return res.status(400).json({
        error: 'UNSUPPORTED_CONTENT_TYPE',
        message: `Content type "${contentType}" is not supported for playback resolution.`,
      });
    }

    let activePasses: OttAccessPass[] = [];
    let activeSubscriptions: OttViewerSubscription[] = [];

    if (viewerId) {
      const nowIso = new Date().toISOString();

      const { data: passes } = await adminClient
        .from('ott_access_passes')
        .select('*')
        .eq('user_id', viewerId)
        .eq('channel_id', channelId)
        .eq('status', 'active')
        .lte('valid_from', nowIso)
        .gt('valid_until', nowIso);

      if (passes) {
        activePasses = passes as OttAccessPass[];
      }

      const { data: subs } = await adminClient
        .from('ott_viewer_subscriptions')
        .select('*')
        .eq('user_id', viewerId)
        .eq('channel_id', channelId)
        .eq('status', 'active')
        .lte('current_period_start', nowIso)
        .gt('current_period_end', nowIso);

      if (subs) {
        activeSubscriptions = subs as OttViewerSubscription[];
      }
    }

    const resolutionParams: ResolveOttAccessParams = {
      channel: channel as OttChannel,
      content: (film || episode)!,
      series: series || undefined,
      viewerId,
      userPasses: activePasses,
      userSubscriptions: activeSubscriptions,
      currentTimeUtc,
      geoCountry,
      requestedQuality,
      signingSecret: process.env.OTT_GRANT_SIGNING_SECRET || process.env.SUPABASE_SECRET_KEY,
    };

    const accessDecision = resolveOttContentAccess(resolutionParams);

    return res.status(200).json({
      success: true,
      decision: accessDecision,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'ACCESS_RESOLUTION_FAILED',
      message: err.message || 'An unexpected error occurred during access resolution.',
    });
  }
}
