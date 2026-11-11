/**
 * AI Movie Factory — Server-Side OTT Commerce & B2C Billing Engine
 * Milestone 2.9.3: B2C Payment / OTT Commerce (Storefront Monetization & Access Fulfillment)
 * 
 * Strict Architectural Invariants:
 * 1. Strict Isolation: Completely separate from AMF Creator SaaS Billing (payment_orders, credits).
 *    All B2C transactions for viewer tickets and channel subscriptions live exclusively in `ott_payment_orders`.
 * 2. Server-Side Price Verification: Never trust client-submitted prices; verified directly against catalog tables.
 * 3. Webhook Signature Security: Verified cryptographic HMAC/SHA-512 signatures before mutating order states.
 * 4. Atomic Idempotent Fulfillment: Uses PostgreSQL advisory locks to guarantee exactly-once pass issuance.
 * 5. Transparent Creator Revenue: Accurate gross, gateway fee, platform fee, and net earnings calculations.
 */

import crypto from 'crypto';
import { supabase } from '../src/lib/supabase.ts';
import { getSupabaseAdmin } from './supabaseAdmin.ts';
import {
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
  private isSandbox: boolean;

  constructor() {
    this.serverKey = process.env.MIDTRANS_SERVER_KEY || 'dummy-midtrans-server-key-dev-sandbox';
    this.isSandbox = process.env.NODE_ENV !== 'production' || process.env.MIDTRANS_IS_SANDBOX === 'true';
  }

  private getDb() {
    try {
      return getSupabaseAdmin();
    } catch {
      if (supabase) return supabase;
      throw new Error('Database client not available.');
    }
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
   * Verify inbound webhook signature
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

    const rawInt = typeof payload.gross_amount === 'number' ? Math.round(payload.gross_amount).toString() : String(payload.gross_amount).split('.')[0];
    const rawIntSig = crypto.createHash('sha512').update(`${payload.order_id}${payload.status_code}${rawInt}${this.serverKey}`).digest('hex');

    const expectedSig = payload.signature_key.toLowerCase();
    return calculatedSig.toLowerCase() === expectedSig || rawIntSig.toLowerCase() === expectedSig;
  }

  /**
   * Create a new B2C OTT payment order with server-side price validation
   */
  public async createOrder(input: CreateOttOrderInput): Promise<{
    order: OttPaymentOrder;
    paymentDetails: {
      qrString?: string;
      redirectUrl?: string;
      token?: string;
    };
  }> {
    if (!input.userId) throw new Error('User ID is required');
    if (!input.channelId) throw new Error('Channel ID is required');
    if (!input.orderType) throw new Error('Order type is required');

    const db = this.getDb();
    let verifiedPrice = 0;
    let orderTitle = 'OTT Access';

    // 1. Server-side Catalog Price Verification
    if (input.orderType === 'ppv_single') {
      if (!input.contentId || !input.contentType) {
        throw new Error('Content ID and Content Type are required for PPV purchase');
      }

      if (input.contentType === 'film') {
        const { data: film, error: filmErr } = await db
          .from('ott_films')
          .select('id, title, ppv_price_idr, access_policy, publication_status')
          .eq('id', input.contentId)
          .single();

        if (filmErr || !film) {
          throw new Error('Film not found in catalog');
        }
        verifiedPrice = Number(film.ppv_price_idr) || 0;
        orderTitle = `Film Ticket: ${film.title}`;
      } else if (input.contentType === 'episode') {
        const { data: ep, error: epErr } = await db
          .from('ott_episodes')
          .select('id, title, ppv_price_idr, access_policy, publication_status')
          .eq('id', input.contentId)
          .single();

        if (epErr || !ep) {
          throw new Error('Episode not found in catalog');
        }
        verifiedPrice = Number(ep.ppv_price_idr) || 0;
        orderTitle = `Episode Ticket: ${ep.title}`;
      } else {
        throw new Error(`Unsupported PPV content type: ${input.contentType}`);
      }
    } else if (input.orderType === 'svod_channel') {
      const { data: channel, error: chErr } = await db
        .from('ott_channels')
        .select('id, name, subscription_price_idr, is_subscription_enabled')
        .eq('id', input.channelId)
        .single();

      if (chErr || !channel) {
        throw new Error('Channel not found');
      }
      verifiedPrice = Number(channel.subscription_price_idr) || 0;
      orderTitle = `Channel Monthly Pass: ${channel.name}`;
    } else {
      throw new Error(`Unsupported order type: ${input.orderType}`);
    }

    if (verifiedPrice <= 0) {
      throw new Error('Item is currently not available for purchase (price is 0 or invalid)');
    }

    // Anti-Tampering Check: If client provided a price, verify it matches
    if (input.clientProvidedPrice !== undefined && input.clientProvidedPrice !== null) {
      if (Math.abs(input.clientProvidedPrice - verifiedPrice) > 0.01) {
        throw new Error(`Price tampering detected: client price ${input.clientProvidedPrice} does not match catalog price ${verifiedPrice}`);
      }
    }

    const orderNumber = this.generateOrderNumber();
    const paymentMethod = input.paymentMethod || 'qris';

    // 2. Insert order record into database
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
        entitlement_fulfilled: false,
      })
      .select()
      .single();

    if (insertErr || !orderData) {
      throw new Error(`Failed to create OTT payment order: ${insertErr?.message}`);
    }

    // 3. Generate Simulated / Gateway Payment Details
    const simulatedQrString = `00020101021226670016ID.CO.AMF.OTT011893600999${orderNumber}520458125303360540${verifiedPrice.toFixed(0)}5802ID5916AI MOVIE FACTORY6007JAKARTA6304`;

    return {
      order: orderData as OttPaymentOrder,
      paymentDetails: {
        qrString: simulatedQrString,
        redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${orderNumber}`,
        token: `snap-token-${orderNumber}`,
      },
    };
  }

  /**
   * Process Gateway Webhook Callback atomically
   */
  public async handleWebhook(payload: WebhookNotificationPayload): Promise<FulfillOrderResult> {
    const isValid = this.verifyWebhookSignature(payload);
    if (!isValid) {
      throw new Error('INVALID_WEBHOOK_SIGNATURE: Forged or invalid signature key');
    }

    const orderNumber = payload.order_id;
    const transactionStatus = payload.transaction_status;
    const fraudStatus = payload.fraud_status;

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
    } else if (transactionStatus === 'refund' || transactionStatus === 'partial_refund') {
      targetStatus = 'refund';
    } else if (transactionStatus === 'pending') {
      targetStatus = 'pending';
    }

    const grossNum = Number(payload.gross_amount) || 0;
    const gatewayFee = Math.round(grossNum * 0.007);
    const db = this.getDb();

    // Call PostgreSQL atomic RPC fulfill_ott_payment_order
    const { data: rpcResult, error: rpcErr } = await db.rpc('fulfill_ott_payment_order', {
      p_order_number: orderNumber,
      p_gateway_transaction_id: payload.transaction_id || `sim-tx-${Date.now()}`,
      p_status: targetStatus,
      p_gateway_payload: payload,
      p_gateway_fee: gatewayFee,
    });

    if (rpcErr) {
      throw new Error(`Database fulfillment RPC failed: ${rpcErr.message}`);
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
