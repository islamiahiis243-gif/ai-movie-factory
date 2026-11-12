/**
 * AI Movie Factory — Server-Side OTT Commerce & B2C Billing Engine
 * Milestone 2.9.3: B2C Payment / OTT Commerce (Storefront Monetization & Access Fulfillment)
 * 
 * Strict Architectural Invariants:
 * 1. Strict Isolation: Completely separate from AMF Creator SaaS Billing (payment_orders, credits).
 *    All B2C transactions for viewer tickets and channel subscriptions live exclusively in `ott_payment_orders`.
 * 2. Comprehensive Content Eligibility: Verifies channel ownership, Gate 5 approval, publication status, and access policy.
 * 3. Timing-Safe Webhook Security: Verified cryptographic SHA-512 signatures using constant-time comparison.
 * 4. Real Midtrans Snap Integration: Issues authentic Snap tokens and redirect URLs via Midtrans REST API.
 * 5. Atomic Idempotent Fulfillment: Uses PostgreSQL advisory locks to guarantee exactly-once pass issuance.
 * 6. Privilege Hardening: fulfill_ott_payment_order executable exclusively by service_role.
 */

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabaseAdmin.ts';
import type {
  OttPaymentOrder,
  OttPaymentOrderType,
  OttPaymentOrderStatus,
  OttCreatorRevenueSummary,
} from '../src/types/database.ts';

export interface CreateOttOrderInput {
  userId: string;
  channelId: string;
  orderType: OttPaymentOrderType;
  contentId?: string | null;
  contentType?: 'film' | 'episode' | 'season' | 'channel' | null;
  paymentMethod?: string;
  clientProvidedPrice?: number;
  customerEmail?: string;
  customerName?: string;
  _mockData?: {
    channel?: any;
    film?: any;
    episode?: any;
  };
}

export interface WebhookNotificationPayload {
  order_id: string;
  status_code: string;
  gross_amount: string | number;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  settlement_time?: string;
  [key: string]: any;
}

export interface FulfillOrderResult {
  success: boolean;
  status: OttPaymentOrderStatus;
  orderNumber: string;
  alreadyFulfilled?: boolean;
  passId?: string | null;
  subscriptionId?: string | null;
  grossAmount?: number;
  netCreatorAmount?: number;
  error?: string;
}

export class OttCommerceEngine {
  private serverKey: string;
  private isProduction: boolean;
  private snapBaseUrl: string;
  private isConfiguredForLiveProduction: boolean;

  constructor() {
    this.isProduction =
      process.env.VERCEL_ENV === 'production' ||
      (process.env.NODE_ENV === 'production' && process.env.ENVIRONMENT === 'production');

    const envKey = process.env.MIDTRANS_SERVER_KEY?.trim() || '';

    // Production mode strictness: Sandbox mode can NEVER be enabled in production
    if (this.isProduction && process.env.MIDTRANS_IS_SANDBOX === 'true') {
      throw new Error('MIDTRANS_CONFIG_ERROR: Sandbox mode (MIDTRANS_IS_SANDBOX=true) is strictly prohibited in production environment.');
    }

    if (this.isProduction) {
      // In production, serverKey must exist and must not be a sandbox dummy key (starting with SB-)
      this.isConfiguredForLiveProduction = Boolean(envKey && !envKey.startsWith('SB-'));
      this.serverKey = envKey;
      this.snapBaseUrl = 'https://app.midtrans.com/snap/v1';
    } else {
      // Non-production (local dev, automated preview, sandbox QA)
      this.isConfiguredForLiveProduction = false;
      this.serverKey = envKey || 'SB-Mid-server-TEST-SANDBOX-KEY';
      this.snapBaseUrl = 'https://app.sandbox.midtrans.com/snap/v1';
    }
  }

  private getDb() {
    return getSupabaseAdmin();
  }

  /**
   * Helper to generate human-readable unique order numbers
   * Format: OTT-ORD-YYYYMMDD-RANDOM
   */
  public generateOrderNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `OTT-ORD-${dateStr}-${randomHex}`;
  }

  /**
   * Generate Midtrans SHA-512 signature for an order
   */
  public generateSignature(orderId: string, statusCode: string, grossAmount: string | number): string {
    const formattedAmount = typeof grossAmount === 'number' ? grossAmount.toFixed(2) : grossAmount;
    const raw = `${orderId}${statusCode}${formattedAmount}${this.serverKey}`;
    return crypto.createHash('sha512').update(raw).digest('hex');
  }

  /**
   * Constant-time timing-safe signature comparison
   */
  public verifyWebhookSignature(payload: WebhookNotificationPayload): boolean {
    if (!payload.order_id || !payload.status_code || !payload.signature_key) {
      return false;
    }

    const calculatedSig = this.generateSignature(
      payload.order_id,
      payload.status_code,
      payload.gross_amount
    );

    const rawInt = typeof payload.gross_amount === 'number'
      ? Math.round(payload.gross_amount).toString()
      : String(payload.gross_amount).split('.')[0];
    const rawIntSig = crypto.createHash('sha512').update(`${payload.order_id}${payload.status_code}${rawInt}${this.serverKey}`).digest('hex');

    const receivedSig = payload.signature_key.toLowerCase();
    const targetSig1 = calculatedSig.toLowerCase();
    const targetSig2 = rawIntSig.toLowerCase();

    const rcvBuf = Buffer.from(receivedSig, 'utf8');
    const calcBuf1 = Buffer.from(targetSig1, 'utf8');
    const calcBuf2 = Buffer.from(targetSig2, 'utf8');

    const match1 = calcBuf1.length === rcvBuf.length && crypto.timingSafeEqual(calcBuf1, rcvBuf);
    const match2 = calcBuf2.length === rcvBuf.length && crypto.timingSafeEqual(calcBuf2, rcvBuf);

    return match1 || match2;
  }

  /**
   * Create Midtrans Snap Transaction via Gateway REST API
   */
  private async createMidtransSnapTransaction(params: {
    orderNumber: string;
    grossAmount: number;
    title: string;
    contentId?: string | null;
    customerEmail?: string;
    customerName?: string;
  }): Promise<{ snapToken?: string; redirectUrl?: string; isGatewayMock?: boolean }> {
    // Fail-closed check: In production, live gateway credentials are mandatory
    if (this.isProduction && !this.isConfiguredForLiveProduction) {
      throw new Error(
        'MIDTRANS_CONFIG_ERROR: Authentic production MIDTRANS_SERVER_KEY is not configured. Checkout cannot proceed.'
      );
    }

    const authHeader = 'Basic ' + Buffer.from(this.serverKey + ':').toString('base64');

    try {
      const res = await fetch(`${this.snapBaseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: params.orderNumber,
            gross_amount: Math.round(params.grossAmount),
          },
          item_details: [
            {
              id: (params.contentId || params.orderNumber).slice(0, 50),
              price: Math.round(params.grossAmount),
              quantity: 1,
              name: params.title.slice(0, 50),
            },
          ],
          customer_details: {
            first_name: (params.customerName || 'Viewer').slice(0, 50),
            email: params.customerEmail || 'viewer@aimoviefactory.local',
          },
        }),
      });

      if (res.ok) {
        const snapData = await res.json();
        if (!snapData || !snapData.token || !snapData.redirect_url) {
          throw new Error('Midtrans API returned an invalid response structure: missing token or redirect_url');
        }
        return {
          snapToken: snapData.token,
          redirectUrl: snapData.redirect_url,
          isGatewayMock: false,
        };
      } else {
        const errText = await res.text();
        throw new Error(`Midtrans API rejected transaction with status ${res.status}: ${errText}`);
      }
    } catch (err: any) {
      const isProduction =
        process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production' ||
        process.env.ENVIRONMENT === 'production';
      const allowMock = process.env.ALLOW_MOCK_PAYMENT_GATEWAY === 'true';

      // In production or unless explicitly configured for offline tests, fail hard:
      if (isProduction || !allowMock) {
        throw new Error(`MIDTRANS_GATEWAY_ERROR: Failed to establish secure transaction with payment gateway: ${err.message}`);
      }

      // ONLY for offline local mock testing when explicitly enabled
      return {
        snapToken: `sandbox-snap-${params.orderNumber}`,
        redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${params.orderNumber}`,
        isGatewayMock: true,
      };
    }
  }

  /**
   * Create a new B2C OTT payment order with rigorous server-side catalog eligibility verification
   */
  public async createOrder(input: CreateOttOrderInput): Promise<{
    order: OttPaymentOrder;
    paymentDetails: {
      qrString?: string;
      redirectUrl?: string;
      token?: string;
      isGatewayMock?: boolean;
    };
  }> {
    if (!input.userId) throw new Error('User ID is required');
    if (!input.channelId) throw new Error('Channel ID is required');
    if (!input.orderType) throw new Error('Order type is required');

    const db = this.getDb();

    // 1. Verify Channel Status
    let channel: any = null;
    if (input._mockData?.channel) {
      channel = input._mockData.channel;
    } else {
      const { data: chData, error: chErr } = await db
        .from('ott_channels')
        .select('id, name, status, subscription_price_idr, is_subscription_enabled')
        .eq('id', input.channelId)
        .single();

      if (chErr || !chData) {
        throw new Error('Channel not found in database');
      }
      channel = chData;
    }

    if (channel.status !== 'active') {
      throw new Error(`Channel is currently not active (status: ${channel.status})`);
    }

    let verifiedPrice = 0;
    let orderTitle = 'OTT Access';

    // 2. Content Eligibility & Gate 5 Approval Checks
    if (input.orderType === 'ppv_single') {
      if (!input.contentId || !input.contentType) {
        throw new Error('Content ID and Content Type are required for PPV ticket purchase');
      }

      if (input.contentType === 'film') {
        let film: any = null;
        if (input._mockData?.film) {
          film = input._mockData.film;
        } else {
          const { data: filmData, error: filmErr } = await db
            .from('ott_films')
            .select('id, channel_id, title, ppv_price_idr, access_policy, publication_status, master_approval_status')
            .eq('id', input.contentId)
            .single();

          if (filmErr || !filmData) {
            throw new Error('Film not found in catalog');
          }
          film = filmData;
        }

        // Ownership match check
        if (film.channel_id !== input.channelId) {
          throw new Error('Cross-channel purchasing mismatch: Film does not belong to specified channel');
        }

        // Publication & Gate 5 check
        if (film.publication_status !== 'published') {
          throw new Error(`Film cannot be purchased: status is "${film.publication_status}" (must be published)`);
        }

        if (film.master_approval_status !== 'GATE_5_APPROVED') {
          throw new Error(`Film cannot be purchased: Master is unapproved (status: ${film.master_approval_status})`);
        }

        if (film.access_policy !== 'ppv_tvod' && film.access_policy !== 'hybrid_early_access') {
          throw new Error(`Film access policy "${film.access_policy}" does not permit PPV ticket purchase`);
        }

        verifiedPrice = Number(film.ppv_price_idr) || 0;
        orderTitle = `Film Ticket: ${film.title}`;
      } else if (input.contentType === 'episode') {
        const { data: ep, error: epErr } = await db
          .from('ott_episodes')
          .select('id, channel_id, title, ppv_price_idr, access_policy, publication_status, master_approval_status')
          .eq('id', input.contentId)
          .single();

        if (epErr || !ep) {
          throw new Error('Episode not found in catalog');
        }

        if (ep.channel_id !== input.channelId) {
          throw new Error('Cross-channel purchasing mismatch: Episode does not belong to specified channel');
        }

        if (ep.publication_status !== 'published') {
          throw new Error(`Episode cannot be purchased: status is "${ep.publication_status}" (must be published)`);
        }

        if (ep.master_approval_status !== 'GATE_5_APPROVED') {
          throw new Error(`Episode cannot be purchased: Master is unapproved (status: ${ep.master_approval_status})`);
        }

        if (ep.access_policy !== 'ppv_tvod' && ep.access_policy !== 'hybrid_early_access') {
          throw new Error(`Episode access policy "${ep.access_policy}" does not permit PPV ticket purchase`);
        }

        verifiedPrice = Number(ep.ppv_price_idr) || 0;
        orderTitle = `Episode Ticket: ${ep.title}`;
      } else {
        throw new Error(`Unsupported PPV content type: ${input.contentType}`);
      }
    } else if (input.orderType === 'svod_channel') {
      if (!channel.is_subscription_enabled) {
        throw new Error('Channel has not enabled SVOD subscriber memberships');
      }
      verifiedPrice = Number(channel.subscription_price_idr) || 0;
      orderTitle = `Channel Monthly Pass: ${channel.name}`;
    } else {
      throw new Error(`Unsupported order type: ${input.orderType}`);
    }

    if (verifiedPrice <= 0) {
      throw new Error('Item is currently not available for purchase (price is zero or invalid)');
    }

    // 3. Anti-Tampering Check
    if (input.clientProvidedPrice !== undefined && input.clientProvidedPrice !== null) {
      if (Math.abs(input.clientProvidedPrice - verifiedPrice) > 0.01) {
        throw new Error(`Price tampering detected: client price ${input.clientProvidedPrice} does not match catalog price ${verifiedPrice}`);
      }
    }

    const orderNumber = this.generateOrderNumber();
    const paymentMethod = input.paymentMethod || 'qris';

    // 4. Request Midtrans Snap Transaction (or generate mock transaction in simulated mode)
    const snapResult = input._mockData
      ? {
          snapToken: `sandbox-snap-${orderNumber}`,
          redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${orderNumber}`,
          isGatewayMock: true,
        }
      : await this.createMidtransSnapTransaction({
          orderNumber,
          grossAmount: verifiedPrice,
          title: orderTitle,
          contentId: input.contentId,
          customerEmail: input.customerEmail,
          customerName: input.customerName,
        });

    // 5. Insert order record into database (or return mock order in simulated test mode)
    if (input._mockData) {
      const mockOrder: OttPaymentOrder = {
        id: `ord_mock_${orderNumber}`,
        order_number: orderNumber,
        user_id: input.userId,
        channel_id: input.channelId,
        order_type: input.orderType,
        content_id: input.contentId || null,
        content_type: input.contentType || null,
        title: orderTitle,
        gross_amount: verifiedPrice,
        currency: 'IDR',
        status: 'pending',
        payment_gateway: 'midtrans',
        payment_method: paymentMethod,
        gateway_payload: {
          snap_token: snapResult.snapToken,
          redirect_url: snapResult.redirectUrl,
        },
        entitlement_fulfilled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return {
        order: mockOrder,
        paymentDetails: {
          token: snapResult.snapToken,
          redirectUrl: snapResult.redirectUrl,
          isGatewayMock: snapResult.isGatewayMock,
        },
      };
    }

    const { data: orderData, error: insertErr } = await db
      .from('ott_payment_orders')
      .insert({
        order_number: orderNumber,
        user_id: input.userId,
        channel_id: input.channelId,
        order_type: input.orderType,
        content_id: input.contentId || null,
        content_type: input.contentType || null,
        title: orderTitle,
        gross_amount: verifiedPrice,
        currency: 'IDR',
        status: 'pending',
        payment_gateway: 'midtrans',
        payment_method: paymentMethod,
        gateway_payload: {
          snap_token: snapResult.snapToken,
          redirect_url: snapResult.redirectUrl,
        },
        entitlement_fulfilled: false,
      })
      .select()
      .single();

    if (insertErr || !orderData) {
      throw new Error(`Failed to create OTT payment order: ${insertErr?.message}`);
    }

    return {
      order: orderData as OttPaymentOrder,
      paymentDetails: {
        token: snapResult.snapToken,
        redirectUrl: snapResult.redirectUrl,
        isGatewayMock: snapResult.isGatewayMock,
      },
    };
  }

  /**
   * Process Gateway Webhook Callback atomically with strict database order validation
   */
  public async handleWebhook(payload: WebhookNotificationPayload): Promise<FulfillOrderResult> {
    const isValid = this.verifyWebhookSignature(payload);
    if (!isValid) {
      throw new Error('INVALID_WEBHOOK_SIGNATURE: Forged or invalid signature key');
    }

    const orderNumber = payload.order_id;
    const transactionStatus = payload.transaction_status;
    const fraudStatus = payload.fraud_status;
    const db = this.getDb();

    // 1. Mandatory Pre-Fulfillment Verification: Fetch and validate internal order record
    const { data: dbOrder, error: orderFetchErr } = await db
      .from('ott_payment_orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderFetchErr || !dbOrder) {
      throw new Error(`ORDER_NOT_FOUND: Webhook rejected for non-existent order "${orderNumber}"`);
    }

    // 2. Gateway Identity Check
    if (dbOrder.payment_gateway !== 'midtrans') {
      throw new Error(`GATEWAY_MISMATCH: Order ${orderNumber} is registered under "${dbOrder.payment_gateway}", not midtrans`);
    }

    // 3. Gross Amount Integrity Check against internal catalog order record
    const webhookGross = Math.round(Number(payload.gross_amount) || 0);
    const dbGross = Math.round(Number(dbOrder.gross_amount) || 0);
    if (webhookGross !== dbGross) {
      throw new Error(
        `GROSS_AMOUNT_MISMATCH: Webhook gross_amount (${webhookGross}) does not match order record gross_amount (${dbGross})`
      );
    }

    // 4. Strict Currency Validation (strictly required and must be IDR)
    if (!payload.currency || payload.currency.toUpperCase() !== 'IDR') {
      throw new Error(
        `UNSUPPORTED_CURRENCY: Webhook currency is missing or invalid ("${payload.currency || 'empty'}"). AMF OTT transactions strictly require "IDR".`
      );
    }

    // 5. State Transition Guard: Do not allow finalized non-settleable orders to be transitioned to settlement/capture
    let targetStatus: OttPaymentOrderStatus = 'pending';
    if (transactionStatus === 'capture') {
      if (fraudStatus === 'challenge') {
        targetStatus = 'pending';
      } else if (fraudStatus === 'accept') {
        targetStatus = 'capture';
      }
    } else if (transactionStatus === 'settlement') {
      targetStatus = 'settlement';
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
      targetStatus = transactionStatus as OttPaymentOrderStatus;
    } else if (transactionStatus === 'refund') {
      targetStatus = 'refund';
    } else if (transactionStatus === 'partial_refund') {
      targetStatus = 'partial_refund';
    } else if (transactionStatus === 'pending') {
      targetStatus = 'pending';
    }

    if (['refund', 'cancel', 'expire'].includes(dbOrder.status) && ['settlement', 'capture'].includes(targetStatus)) {
      throw new Error(`ILLEGAL_STATE_TRANSITION: Order ${orderNumber} is already finalized as "${dbOrder.status}"`);
    }

    // Refund State Guard: Order must be settled/capture before it can be refunded
    if (targetStatus === 'refund' || targetStatus === 'partial_refund') {
      if (!['settlement', 'capture', 'partial_refund', 'refund'].includes(dbOrder.status)) {
        throw new Error(
          `ILLEGAL_STATE_TRANSITION: Cannot process refund on order "${orderNumber}" with status "${dbOrder.status}" (must be settled or partial_refund)`
        );
      }
      if (dbOrder.status === 'refund' && targetStatus === 'partial_refund') {
        throw new Error(
          `ILLEGAL_STATE_TRANSITION: Cannot process partial refund on order "${orderNumber}" that is already fully refunded`
        );
      }
    }

    const gatewayFee = Math.round(webhookGross * 0.007);
    
    // Safe numeric validation for refund_amount before database invocation
    let refundAmount: number | null = null;
    if (payload.refund_amount !== undefined && payload.refund_amount !== null) {
      const strVal = String(payload.refund_amount).trim();
      if (/^[0-9]+(\.[0-9]+)?$/.test(strVal)) {
        const parsed = Number(strVal);
        if (Number.isFinite(parsed) && parsed > 0) {
          refundAmount = parsed;
        }
      }
    }

    // Stable refund event identity from gateway
    const refundKey =
      (typeof payload.refund_id === 'string' && payload.refund_id.trim()) ||
      (typeof payload.refund_key === 'string' && payload.refund_key.trim()) ||
      (typeof payload.refund_chargeback_id === 'string' && payload.refund_chargeback_id.trim()) ||
      (typeof payload.id === 'string' && payload.id.trim()) ||
      null;

    // Call PostgreSQL atomic RPC fulfill_ott_payment_order (service_role only)
    const { data: rpcResult, error: rpcErr } = await db.rpc('fulfill_ott_payment_order', {
      p_order_number: orderNumber,
      p_gateway_transaction_id: payload.transaction_id || `tx-${Date.now()}`,
      p_status: targetStatus,
      p_gateway_payload: payload,
      p_gateway_fee: gatewayFee,
      p_refund_amount: refundAmount,
      p_refund_key: refundKey,
    });

    if (rpcErr) {
      throw new Error(`Database fulfillment RPC failed: ${rpcErr.message}`);
    }

    if (rpcResult && rpcResult.success === false) {
      throw new Error(`Database fulfillment rejected (${rpcResult.error}): ${rpcResult.message || 'Operation failed'}`);
    }

    return {
      success: rpcResult?.success ?? false,
      status: targetStatus,
      orderNumber,
      alreadyFulfilled: rpcResult?.already_fulfilled,
      passId: rpcResult?.pass_id,
      subscriptionId: rpcResult?.subscription_id,
      grossAmount: rpcResult?.gross_amount,
      netCreatorAmount: rpcResult?.net_creator_amount,
      error: rpcResult?.error,
    };
  }

  /**
   * Retrieve creator revenue analytics strictly from verified database records
   */
  public async getCreatorRevenueReport(channelId: string): Promise<OttCreatorRevenueSummary> {
    if (!channelId) throw new Error('Channel ID is required');

    const db = this.getDb();
    const { data, error } = await db.rpc('get_ott_creator_revenue_summary', {
      p_channel_id: channelId,
    });

    if (error) {
      throw new Error(`Failed to query creator revenue summary: ${error.message}`);
    }

    return data as OttCreatorRevenueSummary;
  }
}

export const ottCommerceEngine = new OttCommerceEngine();
