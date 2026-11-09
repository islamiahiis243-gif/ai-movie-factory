/**
 * Vercel Serverless Function: /api/oauth/[action]
 * AI Movie Factory — Unified OAuth Gateway (Hobby Zero-Cost Consolidated Router)
 */

import connectHandler from '../../server/oauth/connectHandler';
import callbackHandler from '../../server/oauth/callbackHandler';
import connectionsHandler from '../../server/oauth/connectionsHandler';
import disconnectHandler from '../../server/oauth/disconnectHandler';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'connect') return connectHandler(req, res);
  if (action === 'callback') return callbackHandler(req, res);
  if (action === 'connections') return connectionsHandler(req, res);
  if (action === 'disconnect') return disconnectHandler(req, res);

  return res.status(404).json({ error: 'Endpoint not found: /api/oauth/' + action });
}

export { connectHandler, callbackHandler, connectionsHandler, disconnectHandler };
