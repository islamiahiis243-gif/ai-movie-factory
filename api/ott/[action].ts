/**
 * Vercel Serverless Function: /api/ott/[action]
 * AI Movie Factory — Phase 6: Independent OTT & Streaming Platform
 * Consolidated OTT Router (Hobby Zero-Cost Consolidated Router)
 * 
 * Consolidates OTT sub-routes:
 * - /api/ott/checkout -> checkoutHandler
 * - /api/ott/webhook -> webhookHandler
 * - /api/ott/playback-session -> playbackSessionHandler
 * - /api/ott/resolve-access -> resolveAccessHandler
 */

import checkoutHandler from '../../server/ott/checkoutHandler.ts';
import webhookHandler from '../../server/ott/webhookHandler.ts';
import playbackSessionHandler from '../../server/ott/playbackSessionHandler.ts';
import resolveAccessHandler from '../../server/ott/resolveAccessHandler.ts';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'checkout') {
    return checkoutHandler(req, res);
  }

  if (action === 'webhook') {
    return webhookHandler(req, res);
  }

  if (action === 'playback-session') {
    return playbackSessionHandler(req, res);
  }

  if (action === 'resolve-access') {
    return resolveAccessHandler(req, res);
  }

  return res.status(404).json({ error: `Endpoint not found: /api/ott/${action}` });
}

export {
  checkoutHandler,
  webhookHandler,
  playbackSessionHandler,
  resolveAccessHandler,
};
