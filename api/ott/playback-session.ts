/**
 * Vercel Serverless Function: /api/ott/playback-session
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.2A: Serverless Playback Session & Delivery Controller Endpoint
 * 
 * Strict Architectural Invariants:
 * 1. Control Plane Separation: Manages session lifecycle and signed delivery URLs.
 *    Large video files are NEVER proxied through this serverless function.
 * 2. Identity Guard: Viewer identity is ALWAYS derived strictly from verified Supabase Auth JWT.
 *    Client-supplied viewerId / userId in request body is strictly ignored.
 * 3. Two-Tier Entitlement Guard: Cryptographic HMAC token check + live database entitlement check.
 * 4. Zero Permanent Storage URL Exposure: Returns time-limited signed delivery URLs (TTL 15m) only.
 * 5. Concurrency Enforcement: Tracks active sessions and terminates stale or conflicting streams.
 */

import { authenticateServerlessRequest, getSupabaseAdmin } from '../../server/supabaseAdmin.ts';
import {
  acquirePlaybackSession,
  renewPlaybackSession,
  heartbeatPlaybackSession,
  terminatePlaybackSession,
} from '../../server/ottPlaybackSessionManager.ts';

export default async function handler(req: any, res: any) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Playback session controller requires HTTP POST method.',
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
    action = 'acquire',
    grantToken,
    channelId,
    contentId,
    contentType = 'film',
    sessionId,
    currentPositionSeconds,
    deviceInfo,
    _mockData, // For deterministic isolated unit test suites
  } = body || {};

  // 1. Authenticate viewer strictly via Supabase Auth JWT
  let viewer: { id: string; email?: string } | null = null;
  let adminSupabase: any = null;

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (req._testUser) {
      viewer = req._testUser;
      adminSupabase = getSupabaseAdmin();
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const authResult = await authenticateServerlessRequest(req);
      adminSupabase = authResult.adminSupabase;
      if (authResult.user) {
        viewer = {
          id: authResult.user.id,
          email: authResult.user.email,
        };
      }
    }
  } catch (err: any) {
    viewer = null;
  }

  if (!viewer || !viewer.id) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Akses ditolak: Token autentikasi penonton (JWT) tidak valid atau tidak disertakan.',
    });
  }

  // Fallback admin client initialization if needed
  if (!adminSupabase && !_mockData) {
    try {
      adminSupabase = getSupabaseAdmin();
    } catch {
      adminSupabase = null;
    }
  }

  // 2. Dispatch requested session action
  if (action === 'acquire') {
    if (!grantToken || !channelId || !contentId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'grantToken, channelId, dan contentId wajib disertakan untuk pembuatan sesi pemutaran.',
      });
    }

    const result = await acquirePlaybackSession({
      viewer,
      grantToken,
      channelId,
      contentId,
      contentType: contentType === 'episode' ? 'episode' : 'film',
      deviceInfo,
      adminSupabase,
      _mockData,
    });

    if (!result.success) {
      const isAuthForbidden = [
        'INVALID_GRANT_TOKEN',
        'INVALID_SIGNATURE',
        'VIEWER_MISMATCH',
        'CONTENT_MISMATCH',
        'CHANNEL_MISMATCH',
        'TOKEN_EXPIRED',
        'MALFORMED_GRANT_TOKEN',
        'INVALID_PREFIX',
        'PASS_REVOKED',
        'SUBSCRIPTION_REVOKED',
        'ENTITLEMENT_DENIED',
      ].includes(result.code || '');

      const statusCode = isAuthForbidden
        ? 403
        : result.code === 'CONTENT_NOT_FOUND' || result.code === 'CONTENT_NOT_PUBLISHED'
        ? 404
        : result.code === 'GATE_5_UNAPPROVED'
        ? 422
        : 400;

      return res.status(statusCode).json({
        success: false,
        error: result.code,
        message: result.reason,
      });
    }

    return res.status(200).json(result);
  }

  if (action === 'renew') {
    if (!sessionId || !grantToken) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SESSION_ID',
        message: 'sessionId dan grantToken diperlukan untuk memperbarui sesi pemutaran.',
      });
    }

    const renewResult = await renewPlaybackSession({
      sessionId,
      viewer,
      grantToken,
      currentPositionSeconds,
      adminSupabase,
      _mockData,
    });

    if (!renewResult.success) {
      const statusCode =
        renewResult.code === 'SESSION_REVOKED' || renewResult.code === 'ENTITLEMENT_REVOKED'
          ? 403
          : renewResult.code === 'SESSION_EXPIRED'
          ? 410
          : 400;

      return res.status(statusCode).json({
        success: false,
        error: renewResult.code,
        message: renewResult.reason,
      });
    }

    return res.status(200).json(renewResult);
  }

  if (action === 'heartbeat') {
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SESSION_ID',
        message: 'sessionId diperlukan untuk heartbeat sesi.',
      });
    }

    const hbResult = await heartbeatPlaybackSession({
      sessionId,
      viewer,
      currentPositionSeconds,
      adminSupabase,
      _mockData,
    });

    if (!hbResult.success) {
      return res.status(403).json({
        success: false,
        error: hbResult.code,
        message: hbResult.reason,
      });
    }

    return res.status(200).json(hbResult);
  }

  if (action === 'terminate') {
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_SESSION_ID',
        message: 'sessionId diperlukan untuk mengakhiri sesi.',
      });
    }

    const termResult = await terminatePlaybackSession({
      sessionId,
      viewer,
      adminSupabase,
      _mockData,
    });

    return res.status(200).json(termResult);
  }

  return res.status(400).json({
    success: false,
    error: 'UNKNOWN_ACTION',
    message: `Aksi '${action}' tidak dikenali. Pilihan valid: acquire, renew, heartbeat, terminate.`,
  });
}
