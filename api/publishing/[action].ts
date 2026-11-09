/**
 * Vercel Serverless Function: /api/publishing/[action]
 * AI Movie Factory — Unified Publishing Pipeline (Hobby Zero-Cost Consolidated Router)
 */

import dispatchHandler from '../lib/publishing/dispatchHandler';
import statusHandler from '../lib/publishing/statusHandler';
import cancelHandler from '../lib/publishing/cancelHandler';
import workerHandler from '../lib/publishing/workerHandler';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'dispatch') return dispatchHandler(req, res);
  if (action === 'status') return statusHandler(req, res);
  if (action === 'cancel') return cancelHandler(req, res);
  if (action === 'worker') return workerHandler(req, res);

  return res.status(404).json({ error: 'Endpoint not found: /api/publishing/' + action });
}

export { dispatchHandler, statusHandler, cancelHandler, workerHandler };
