/**
 * Vercel Serverless Function: /api/analytics/[action]
 * AI Movie Factory — Unified Analytics Engine (Hobby Zero-Cost Consolidated Router)
 */

import syncHandler from '../../server/analytics/syncHandler.ts';
import historyHandler from '../../server/analytics/historyHandler.ts';
import syncWorkerHandler from '../../server/analytics/syncWorkerHandler.ts';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'sync') return syncHandler(req, res);
  if (action === 'history') return historyHandler(req, res);
  if (action === 'sync-worker') return syncWorkerHandler(req, res);

  return res.status(404).json({ error: 'Endpoint not found: /api/analytics/' + action });
}

export { syncHandler, historyHandler, syncWorkerHandler };
