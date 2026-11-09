/**
 * Vercel Serverless Function: /api/credits/[action]
 * AI Movie Factory — Unified Credit Operations (Hobby Zero-Cost Consolidated Router)
 */

import balanceHandler from '../../server/credits/balanceHandler';
import transactionHandler from '../../server/credits/transactionHandler';

export default async function handler(req: any, res: any) {
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const action = req.query?.action || urlPath.split('/').pop();

  if (action === 'balance') {
    return balanceHandler(req, res);
  }

  if (action === 'transaction' || req.method === 'POST') {
    return transactionHandler(req, res);
  }

  return res.status(404).json({ error: 'Endpoint not found: /api/credits/' + action });
}

export { balanceHandler, transactionHandler };
