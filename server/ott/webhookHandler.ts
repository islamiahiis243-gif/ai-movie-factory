/**
 * Handler: webhookHandler.ts (server/ott/webhookHandler.ts)
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.3: B2C OTT Payment Gateway Webhook Handler
 */

import { ottCommerceEngine } from '../ottCommerceEngine.ts';

export default async function webhookHandler(req: any, res: any) {
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

    if (err.message?.includes('ORDER_NOT_FOUND')) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: err.message,
      });
    }

    if (err.message?.includes('GROSS_AMOUNT_MISMATCH')) {
      return res.status(400).json({
        success: false,
        error: 'GROSS_AMOUNT_MISMATCH',
        message: err.message,
      });
    }

    if (err.message?.includes('ILLEGAL_STATE_TRANSITION')) {
      return res.status(409).json({
        success: false,
        error: 'ILLEGAL_STATE_TRANSITION',
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'WEBHOOK_PROCESSING_FAILED',
      message: err.message || 'An error occurred while processing the webhook.',
    });
  }
}
