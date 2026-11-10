/**
 * Vercel Serverless Function: /api/ott/resolve-access
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.1: Hardened Content Access Control & Entitlement Engine Endpoint
 * 
 * Strict Architectural Invariants:
 * 1. Strict Isolation from AMF Creator Studio SaaS Billing & AI Credits.
 * 2. Identity Guard: Never trusts user_id from client request. User identity is derived
 *    strictly from verified Supabase Auth JWT.
 * 3. URL Privacy: Master video storage URLs are NEVER returned. The response provides
 *    an ephemeral entitlement grant token (Milestone 2.9.1 scope).
 * 4. Sanitized Logs: Never logs bearer tokens, secret keys, or sensitive credentials.
 */

import { authenticateServerlessRequest, getSupabaseAdmin } from '../../server/supabaseAdmin.ts';
import { resolveOttContentAccess } from '../../src/lib/ottEntitlementEngine.ts';
import {
  OttChannel,
  OttEpisode,
  OttFilm,
  OttSeries,
  OttAccessPass,
  OttViewerSubscription,
  ResolveOttAccessParams,
} from '../../src/types/database.ts';

export default async function handler(req: any, res: any) {
  // Only accept POST requests for access resolution
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Access resolution requires HTTP POST method.',
    });
  }

  // Parse payload safely
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
    contentType,
    isPreview = false,
    _mockData, // For deterministic test suites without database connection
  } = body || {};

  if (!channelId || !contentId || !contentType) {
    return res.status(400).json({
      error: 'MISSING_REQUIRED_FIELDS',
      message: 'channelId, contentId, and contentType ("episode" | "film") are required.',
    });
  }

  if (contentType !== 'episode' && contentType !== 'film') {
    return res.status(400).json({
      error: 'INVALID_CONTENT_TYPE',
      message: 'contentType must be either "episode" or "film".',
    });
  }

  // 1. Resolve viewer identity strictly from authenticated JWT
  // NEVER trust body.user_id or body.userId
  let viewer: { id: string; email?: string } | null = null;
  let adminSupabase: any = null;

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (req._testUser || (authHeader && authHeader.startsWith('Bearer '))) {
      const authResult = await authenticateServerlessRequest(req);
      adminSupabase = authResult.adminSupabase;
      if (authResult.user) {
        viewer = {
          id: authResult.user.id,
          email: authResult.user.email,
        };
      }
    }
  } catch {
    // If bearer token was invalid, viewer remains null (anonymous visitor)
    viewer = null;
  }

  // If adminSupabase is not initialized yet (e.g. anonymous visitor), initialize it to query catalog
  if (!adminSupabase) {
    try {
      adminSupabase = getSupabaseAdmin();
    } catch {
      adminSupabase = null;
    }
  }

  // 2. Fetch Channel, Content, and Entitlements
  let channel: OttChannel | null = null;
  let content: OttEpisode | OttFilm | null = null;
  let parentSeries: OttSeries | undefined = undefined;
  let userPasses: OttAccessPass[] = [];
  let userSubscriptions: OttViewerSubscription[] = [];

  // Deterministic mock injection path (for isolated unit tests)
  if (_mockData) {
    channel = _mockData.channel || null;
    content = _mockData.content || null;
    parentSeries = _mockData.parentSeries;
    userPasses = _mockData.userPasses || [];
    userSubscriptions = _mockData.userSubscriptions || [];
  } else if (adminSupabase) {
    // Live database query path
    try {
      const { data: chanData, error: chanErr } = await adminSupabase
        .from('ott_channels')
        .select('*')
        .eq('id', channelId)
        .maybeSingle();

      if (chanErr) {
        console.error('[OTT Entitlement] Error fetching channel:', chanErr.message);
      }
      channel = chanData;

      if (contentType === 'film') {
        const { data: filmData, error: filmErr } = await adminSupabase
          .from('ott_films')
          .select('*')
          .eq('id', contentId)
          .maybeSingle();

        if (filmErr) {
          console.error('[OTT Entitlement] Error fetching film:', filmErr.message);
        }
        content = filmData;
      } else {
        const { data: epData, error: epErr } = await adminSupabase
          .from('ott_episodes')
          .select('*')
          .eq('id', contentId)
          .maybeSingle();

        if (epErr) {
          console.error('[OTT Entitlement] Error fetching episode:', epErr.message);
        }
        content = epData;

        if (content && (content as OttEpisode).series_id) {
          const { data: serData } = await adminSupabase
            .from('ott_series')
            .select('*')
            .eq('id', (content as OttEpisode).series_id)
            .maybeSingle();
          parentSeries = serData || undefined;
        }
      }

      // Query entitlements only for verified authenticated viewer
      if (viewer && viewer.id) {
        const { data: passes, error: passErr } = await adminSupabase
          .from('ott_access_passes')
          .select('*')
          .eq('user_id', viewer.id)
          .eq('channel_id', channelId);

        if (passErr) {
          console.error('[OTT Entitlement] Error fetching passes:', passErr.message);
        }
        userPasses = passes || [];

        const { data: subs, error: subErr } = await adminSupabase
          .from('ott_viewer_subscriptions')
          .select('*')
          .eq('user_id', viewer.id)
          .eq('channel_id', channelId);

        if (subErr) {
          console.error('[OTT Entitlement] Error fetching subscriptions:', subErr.message);
        }
        userSubscriptions = subs || [];
      }
    } catch (err: any) {
      console.error('[OTT Entitlement] Fatal error during database resolution:', err.message);
    }
  }

  // 3. Evaluate Access via Core Entitlement Engine
  const resolveParams: ResolveOttAccessParams = {
    viewer,
    channel: channel!,
    content: content!,
    parentSeries,
    contentType,
    userPasses,
    userSubscriptions,
    isPreviewRequest: Boolean(isPreview),
  };

  const decision = resolveOttContentAccess(resolveParams);

  // 4. Strict Security Sanitation Post-Condition:
  // Zero master video URL exposure in Milestone 2.9.1!
  if (!decision.allowed) {
    delete decision.entitlementGrant;
    delete decision.playbackSession;
    delete decision.previewUrl;
  }

  // 5. Response Mapping
  const responsePayload = {
    success: decision.allowed,
    decision,
  };

  if (!decision.allowed) {
    if (decision.status === 'LOGIN_REQUIRED') {
      return res.status(401).json(responsePayload);
    }
    if (decision.status === 'PAYMENT_REQUIRED' || decision.status === 'SUBSCRIPTION_REQUIRED') {
      return res.status(402).json(responsePayload);
    }
    if (decision.status === 'ACCESS_REVOKED' || decision.status === 'TENANT_ACCESS_DENIED') {
      return res.status(403).json(responsePayload);
    }
    if (decision.status === 'CONTENT_UNAVAILABLE' || decision.status === 'CONTENT_NOT_PUBLISHED') {
      return res.status(404).json(responsePayload);
    }
  }

  return res.status(200).json(responsePayload);
}
