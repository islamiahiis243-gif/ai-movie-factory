/**
 * Vercel Serverless Function: /api/pipeline/[action]
 * AI Movie Factory — Unified Pipeline Jobs Router (TC-WF-09, TC-WF-10)
 *
 * Routes:
 * - /api/pipeline/worker  -> Background processing & stale job reconciliation
 * - /api/pipeline/status  -> In-flight status & logs query
 * - /api/pipeline/retry   -> Strict 3x retry limit execution
 */

import statusHandler from '../../server/pipeline/statusHandler.ts';
import retryHandler from '../../server/pipeline/retryHandler.ts';
import workerHandler from '../../server/pipeline/workerHandler.ts';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'status') return statusHandler(req, res);
  if (action === 'retry') return retryHandler(req, res);
  if (action === 'worker') return workerHandler(req, res);

  return res.status(404).json({ error: 'Endpoint not found: /api/pipeline/' + action });
}

export { statusHandler, retryHandler, workerHandler };
