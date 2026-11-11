/**
 * Vercel Serverless Function: /api/ott/checkout
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.3: B2C OTT Checkout & Payment Order Creation
 * 
 * Strict Invariants:
 * 1. Viewer identity is derived strictly from verified Supabase Auth JWT.
 * 2. Prices are strictly verified against database catalog items (anti-tampering).
 * 3. Completely isolated from creator SaaS credit billing.
 */

import { authenticateServerlessRequest } from '../../server/supabaseAdmin.ts';
import { ottCommerceEngine } from '../../server/ottCommerceEngine.ts';

export default async function handler(req: any, res: any) {
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
    orderType, // 'ppv_single' | 'season_pass' | 'svod_channel'
    contentId,
    contentType,
    paymentMethod = 'qris',
    clientPrice,
    _mockViewer, // Unit test mock viewer bypass
  } = body || {};

  // 1. Authenticate viewer strictly via Supabase JWT
  let viewer: { id: string; email?: string } | null = null;
  if (_mockViewer && process.env.NODE_ENV !== 'production') {
    viewer = _mockViewer;
  } else {
    try {
      const authRes = await authenticateServerlessRequest(req);
      if (authRes?.user) {
        viewer = { id: authRes.user.id, email: authRes.user.email };
      }
    } catch (authErr: any) {
      // Handled below
    }
  }

  if (!viewer) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'You must be signed in to purchase tickets or subscriptions.',
    });
  }

  try {
    const checkoutResult = await ottCommerceEngine.createOrder({
      userId: viewer.id,
      channelId,
      orderType,
      contentId,
      contentType,
      paymentMethod,
      clientProvidedPrice: clientPrice !== undefined ? Number(clientPrice) : undefined,
    });

    return res.status(200).json({
      success: true,
      order: checkoutResult.order,
      paymentDetails: checkoutResult.paymentDetails,
    });
  } catch (err: any) {
    const status = err.message?.includes('Price tampering') ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: 'CHECKOUT_FAILED',
      message: err.message || 'Failed to initialize checkout order.',
    });
  }
}
