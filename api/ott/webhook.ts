/**
 * Vercel Serverless Function: /api/ott/webhook
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.3: B2C OTT Payment Gateway Webhook Handler
 * 
 * Strict Invariants:
 * 1. Midtrans SHA-512 signature validation prevents forged payment webhooks.
 * 2. Idempotent fulfillment via Postgres advisory locks prevents duplicate ticket issuance.
 * 3. Refunds automatically revoke access passes or subscriptions.
 */

import { ottCommerceEngine } from '../../server/ottCommerceEngine.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Webhook handler requires HTTP POST method.',
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

  try {
    const fulfillmentResult = await ottCommerceEngine.handleWebhook(body);
    return res.status(200).json({
      success: true,
      result: fulfillmentResult,
    });
  } catch (err: any) {
    if (err.message?.includes('INVALID_WEBHOOK_SIGNATURE')) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_SIGNATURE',
        message: 'Invalid or forged webhook signature key.',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'WEBHOOK_PROCESSING_FAILED',
      message: err.message || 'An error occurred while processing the webhook.',
    });
  }
}
