/**
 * Vercel Serverless Function: /api/ott/[action]
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Router for OTT endpoints
 */

import resolveAccessHandler from './resolve-access.ts';
import playbackSessionHandler from './playback-session.ts';
import checkoutHandler from './checkout.ts';
import webhookHandler from './webhook.ts';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'resolve-access' || action === 'access') {
    return resolveAccessHandler(req, res);
  }

  if (action === 'playback-session' || action === 'session') {
    return playbackSessionHandler(req, res);
  }

  if (action === 'checkout') {
    return checkoutHandler(req, res);
  }

  if (action === 'webhook') {
    return webhookHandler(req, res);
  }

  return res.status(404).json({ error: 'Endpoint not found: /api/ott/' + action });
}

export { resolveAccessHandler, playbackSessionHandler, checkoutHandler, webhookHandler };
