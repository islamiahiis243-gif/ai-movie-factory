/**
 * Handler: playbackSessionHandler.ts (server/ott/playbackSessionHandler.ts)
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.2A: Serverless Playback Session & Delivery Controller Endpoint
 */

import { authenticateServerlessRequest, getSupabaseAdmin } from '../supabaseAdmin.ts';
import {
  acquirePlaybackSession,
  renewPlaybackSession,
  heartbeatPlaybackSession,
  terminatePlaybackSession,
} from '../ottPlaybackSessionManager.ts';

export default async function playbackSessionHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Playback session controller requires HTTP POST method.',
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
    action = 'acquire',
    grantToken,
    channelId,
    contentId,
    contentType,
    playbackSessionToken,
    currentPositionSeconds,
    reason,
  } = body || {};

  const userAgent = req.headers['user-agent'] || 'Unknown-Device';
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  let authenticatedViewer: any = null;
  let adminClient: any = null;

  try {
    const authContext = await authenticateServerlessRequest(req);
    authenticatedViewer = authContext.user;
    adminClient = authContext.adminSupabase;
  } catch (authErr: any) {
    return res.status(401).json({
      error: 'UNAUTHORIZED_VIEWER',
      message: 'Viewer must be authenticated with a valid Supabase JWT to manage playback sessions.',
      details: authErr.message,
    });
  }

  const viewerId = authenticatedViewer.id;
  const viewerEmail = authenticatedViewer.email;

  try {
    if (action === 'acquire') {
      if (!grantToken || !channelId || !contentId || !contentType) {
        return res.status(400).json({
          error: 'MISSING_PARAMETERS',
          message: 'grantToken, channelId, contentId, and contentType are required for acquire.',
        });
      }

      const result = await acquirePlaybackSession({
        grantToken,
        channelId,
        contentId,
        contentType,
        viewerId,
        viewerEmail,
        ipAddress,
        userAgent,
        adminClient,
      });

      return res.status(200).json(result);
    }

    if (action === 'renew') {
      if (!playbackSessionToken) {
        return res.status(400).json({
          error: 'MISSING_PARAMETERS',
          message: 'playbackSessionToken is required for renew.',
        });
      }

      const result = await renewPlaybackSession({
        playbackSessionToken,
        viewerId,
        ipAddress,
        adminClient,
      });

      return res.status(200).json(result);
    }

    if (action === 'heartbeat') {
      if (!playbackSessionToken) {
        return res.status(400).json({
          error: 'MISSING_PARAMETERS',
          message: 'playbackSessionToken is required for heartbeat.',
        });
      }

      const result = await heartbeatPlaybackSession({
        playbackSessionToken,
        viewerId,
        currentPositionSeconds: Number(currentPositionSeconds) || 0,
        adminClient,
      });

      return res.status(200).json(result);
    }

    if (action === 'terminate') {
      if (!playbackSessionToken) {
        return res.status(400).json({
          error: 'MISSING_PARAMETERS',
          message: 'playbackSessionToken is required for terminate.',
        });
      }

      const result = await terminatePlaybackSession({
        playbackSessionToken,
        viewerId,
        reason: reason || 'user_ended',
        adminClient,
      });

      return res.status(200).json(result);
    }

    return res.status(400).json({
      error: 'INVALID_ACTION',
      message: `Unsupported playback session action: ${action}. Allowed: acquire, renew, heartbeat, terminate.`,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.code || 'SESSION_CONTROLLER_ERROR',
      message: err.message || 'An unexpected error occurred in playback session delivery controller.',
    });
  }
}
