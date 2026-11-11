/**
 * Handler: checkoutHandler.ts (server/ott/checkoutHandler.ts)
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.3: B2C OTT Checkout & Payment Order Creation
 */

import { authenticateServerlessRequest } from '../supabaseAdmin.ts';
import { ottCommerceEngine } from '../ottCommerceEngine.ts';

export default async function checkoutHandler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: 'Checkout requires HTTP POST method.',
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

  const {
    channelId,
    orderType,
    contentId,
    contentType,
    paymentMethod = 'qris',
    clientPrice,
    _mockViewer,
  } = body || {};

  let viewer: { id: string; email?: string } | null = null;
  if (_mockViewer && process.env.NODE_ENV !== 'production') {
    viewer = _mockViewer;
  } else {
    try {
      const authContext = await authenticateServerlessRequest(req);
      viewer = authContext.user;
    } catch (authErr: any) {
      return res.status(401).json({
        error: 'UNAUTHORIZED_VIEWER',
        message: 'Viewer must be authenticated to purchase OTT content or channel passes.',
        details: authErr.message,
      });
    }
  }

  if (!viewer?.id) {
    return res.status(401).json({
      error: 'UNAUTHORIZED_VIEWER',
      message: 'Unable to resolve viewer identity from session token.',
    });
  }

  if (!channelId || !orderType) {
    return res.status(400).json({
      error: 'INVALID_PARAMETERS',
      message: 'channelId and orderType are required.',
    });
  }

  try {
    const result = await ottCommerceEngine.createOrder({
      userId: viewer.id,
      channelId,
      orderType,
      contentId,
      contentType,
      paymentMethod,
      clientProvidedPrice: clientPrice,
      customerEmail: viewer.email,
    });

    return res.status(201).json({
      success: true,
      order: result.order,
      paymentDetails: result.paymentDetails,
    });
  } catch (err: any) {
    if (err.message?.includes('Price tampering detected')) {
      return res.status(400).json({
        error: 'PRICE_TAMPERING_DETECTED',
        message: 'Price mismatch with official database catalog.',
      });
    }

    if (err.message?.includes('not found')) {
      return res.status(404).json({
        error: 'CONTENT_NOT_FOUND',
        message: err.message,
      });
    }

    return res.status(500).json({
      error: 'CHECKOUT_FAILED',
      message: err.message || 'An unexpected error occurred during checkout initialization.',
    });
  }
}
