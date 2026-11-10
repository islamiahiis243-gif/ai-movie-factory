/**
 * Vercel Serverless Function: /api/ott/[action]
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Router for OTT endpoints
 */

import resolveAccessHandler from './resolve-access.ts';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'resolve-access' || action === 'access') {
    return resolveAccessHandler(req, res);
  }

  return res.status(404).json({ error: 'Endpoint not found: /api/ott/' + action });
}

export { resolveAccessHandler };
