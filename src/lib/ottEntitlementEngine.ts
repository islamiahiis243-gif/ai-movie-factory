/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.1: Content Access Control & Entitlement Engine (SSOT Hardened Module)
 * 
 * Strict Architectural Invariants:
 * 1. Strict Domain Isolation: Completely segregated from Creator Studio SaaS Billing & AI Credits.
 * 2. Strict Entitlement vs Playback Separation: Milestone 2.9.1 decides access and grants ephemeral tickets.
 *    Raw master video Storage URLs are NEVER leaked or returned in this milestone.
 * 3. Fail-Closed Security: Access is denied by default; entitlementGrant is strictly undefined when denied.
 * 4. Granular Season Pass Verification: A Season Pass is linked to a specific season_id (never leaks across seasons).
 * 5. Deterministic Timezone Handling: True UTC epoch comparisons without session drift.
 * 6. SVOD Cancellation Grace Period: Cancelled auto-renew keeps access until current_period_end.
 */

import crypto from 'crypto';
import type {
  OttChannel,
  OttSeries,
  OttEpisode,
  OttFilm,
  OttAccessPass,
  OttViewerSubscription,
  OttAccessDecisionResult,
  OttAccessDecisionStatus,
  ResolveOttAccessParams,
  OttEntitlementGrant,
  OttEntitlementGrantPayload,
  OttPlaybackSession,
  OttMonetizationPrompt,
  OttAccessPolicy,
} from '../types/database.ts';

export {
  DEFAULT_GRANT_TTL_MS,
  getGrantSigningSecret,
  generatePseudonymousWatermark,
  maskTokenForLogging,
  generateEntitlementGrant,
  verifyEntitlementGrantToken,
  validateGrantAgainstLiveEntitlement,
} from '../../server/ottGrantSigner.ts';
export type {
  GenerateEntitlementGrantOptions,
  VerifyGrantTokenOptions,
  VerifyGrantTokenResult,
  LiveEntitlementCheckOptions,
  LiveEntitlementCheckResult,
} from '../../server/ottGrantSigner.ts';

import {
  generateEntitlementGrant,
  DEFAULT_GRANT_TTL_MS,
} from '../../server/ottGrantSigner.ts';

/**
 * Generates a playback ticket reference for client state.
 * Raw video URL is explicitly omitted (deferred to Milestone 2.9.2 streaming player session).
 */
export function generatePlaybackSession(
  contentId: string,
  userId: string,
  channelId: string,
  now: Date = new Date(),
  isWatermarked: boolean = true
): OttPlaybackSession {
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const rawId = `${contentId}-${userId}-${now.getTime()}-${Math.random().toString(36).substring(2, 9)}`;
  const ticketId = `tk_ott_${Buffer.from(rawId).toString('base64url').substring(0, 24)}`;
  const sessionToken = `st_amf_${Buffer.from(`${ticketId}:${channelId}:${expiresAt}`).toString('base64url')}`;

  return {
    ticketId,
    expiresAt,
    isWatermarked,
    sessionToken,
    // videoUrl intentionally omitted to prevent raw storage URL exposure in Milestone 2.9.1
  };
}

/**
 * Checks if scheduled release time has passed using UTC epoch milliseconds.
 */
export function isContentReleased(
  scheduledReleaseAt?: string | null,
  now: Date = new Date()
): boolean {
  if (!scheduledReleaseAt) return true;
  return new Date(scheduledReleaseAt).getTime() <= now.getTime();
}

/**
 * Evaluates OTT content access rights using the SSOT Priority Decision Matrix.
 */
export function resolveOttContentAccess(params: ResolveOttAccessParams): OttAccessDecisionResult {
  const now = params.currentTime || new Date();
  const nowMs = now.getTime();
  const evaluatedAt = now.toISOString();

  // 1. Channel Existence & Active Status
  if (!params.channel) {
    return {
      allowed: false,
      status: 'CONTENT_UNAVAILABLE',
      reason: 'Channel not found or unavailable.',
      contentId: params.content?.id || 'unknown',
      contentType: params.contentType,
      channelId: 'unknown',
      evaluatedAt,
    };
  }

  if (params.channel.status !== 'active') {
    return {
      allowed: false,
      status: 'CONTENT_UNAVAILABLE',
      reason: `Channel is currently ${params.channel.status}. Content cannot be accessed.`,
      contentId: params.content?.id || 'unknown',
      contentType: params.contentType,
      channelId: params.channel.id,
      evaluatedAt,
    };
  }

  // 2. Content Existence
  if (!params.content) {
    return {
      allowed: false,
      status: 'CONTENT_UNAVAILABLE',
      reason: 'Requested content item could not be found.',
      contentId: 'unknown',
      contentType: params.contentType,
      channelId: params.channel.id,
      evaluatedAt,
    };
  }

  const content = params.content;
  const channel = params.channel;
  const contentTitle = content.title || 'Untitled Content';

  // 3. Multi-Tenant Isolation: Content Channel vs Context Channel
  if (params.contentType === 'film') {
    const film = content as OttFilm;
    if (film.channel_id && film.channel_id !== channel.id) {
      return {
        allowed: false,
        status: 'TENANT_ACCESS_DENIED',
        reason: 'Content belongs to a different channel tenant.',
        contentId: film.id,
        contentType: 'film',
        channelId: channel.id,
        evaluatedAt,
      };
    }
  } else if (params.contentType === 'episode') {
    if (params.parentSeries && params.parentSeries.channel_id !== channel.id) {
      return {
        allowed: false,
        status: 'TENANT_ACCESS_DENIED',
        reason: 'Parent series belongs to a different channel tenant.',
        contentId: content.id,
        contentType: 'episode',
        channelId: channel.id,
        evaluatedAt,
      };
    }
  }

  // 4. Publication Status Check
  if (content.publication_status !== 'published') {
    return {
      allowed: false,
      status: 'CONTENT_NOT_PUBLISHED',
      reason: `This content has publication status "${content.publication_status}" and is not available in the public catalog.`,
      contentId: content.id,
      contentType: params.contentType,
      channelId: channel.id,
      evaluatedAt,
    };
  }

  if (params.contentType === 'episode' && params.parentSeries) {
    if (params.parentSeries.publication_status !== 'published') {
      return {
        allowed: false,
        status: 'CONTENT_NOT_PUBLISHED',
        reason: `Parent series has publication status "${params.parentSeries.publication_status}" and is not published.`,
        contentId: content.id,
        contentType: params.contentType,
        channelId: channel.id,
        evaluatedAt,
      };
    }
  }

  // 5. Scheduled Release Window Check
  if (!isContentReleased(content.scheduled_release_at, now)) {
    const releaseIso = content.scheduled_release_at ? new Date(content.scheduled_release_at).toISOString() : '';
    return {
      allowed: false,
      status: 'CONTENT_NOT_YET_AVAILABLE',
      reason: `This content is scheduled for premiere on ${releaseIso}. Access is not yet open.`,
      contentId: content.id,
      contentType: params.contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'wait_for_release',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  // 6. Explicit Preview / Trailer Request
  if (params.isPreviewRequest) {
    if (params.contentType === 'film') {
      const film = content as OttFilm;
      if (film.trailer_video_url) {
        return {
          allowed: true,
          status: 'ALLOWED_PREVIEW',
          reason: 'Trailer / preview stream authorized.',
          contentId: content.id,
          contentType: params.contentType,
          channelId: channel.id,
          previewUrl: film.trailer_video_url, // ONLY promotional trailer URL, NEVER master
          entitlementGrant: generateEntitlementGrant({
            contentId: content.id,
            contentType: params.contentType,
            viewerId: params.viewer?.id || 'anon',
            channelId: channel.id,
            accessPolicy: 'trailer_preview',
            now,
            watermarkRequired: false,
          }),
          playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, now, false),
          evaluatedAt,
        };
      }
    }
    if (content.access_policy === 'trailer_preview') {
      return {
        allowed: true,
        status: 'ALLOWED_PREVIEW',
        reason: 'Trailer / preview stream authorized.',
        contentId: content.id,
        contentType: params.contentType,
        channelId: channel.id,
        entitlementGrant: generateEntitlementGrant({
          contentId: content.id,
          contentType: params.contentType,
          viewerId: params.viewer?.id || 'anon',
          channelId: channel.id,
          accessPolicy: 'trailer_preview',
          now,
          watermarkRequired: false,
        }),
        playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, now, false),
        evaluatedAt,
      };
    }
    // If preview requested but item has no separate trailer and is paid, fall through to entitlement
  }

  // 7. Policy: Public Free Access
  if (content.access_policy === 'free') {
    return {
      allowed: true,
      status: 'ALLOWED_FREE',
      reason: 'Public free content access authorized.',
      contentId: content.id,
      contentType: params.contentType,
      channelId: channel.id,
      entitlementGrant: generateEntitlementGrant({
        contentId: content.id,
        contentType: params.contentType,
        viewerId: params.viewer?.id || 'anon',
        channelId: channel.id,
        accessPolicy: 'free',
        now,
        watermarkRequired: false,
      }),
      playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, now, false),
      evaluatedAt,
    };
  }

  // 8. Policy: Trailer Preview Mode Only
  if (content.access_policy === 'trailer_preview') {
    return {
      allowed: true,
      status: 'ALLOWED_PREVIEW',
      reason: 'Public promotional preview authorized.',
      contentId: content.id,
      contentType: params.contentType,
      channelId: channel.id,
      entitlementGrant: generateEntitlementGrant({
        contentId: content.id,
        contentType: params.contentType,
        viewerId: params.viewer?.id || 'anon',
        channelId: channel.id,
        accessPolicy: 'trailer_preview',
        now,
        watermarkRequired: false,
      }),
      playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, now, false),
      evaluatedAt,
    };
  }

  // 9. Paid Access: Enforce Viewer Authentication
  const viewer = params.viewer;
  if (!viewer || !viewer.id) {
    const prompt: OttMonetizationPrompt = {
      requiredAction: 'login',
      priceIdr: (content as any).ppv_price_idr || 0,
      currency: 'IDR',
      channelId: channel.id,
      contentTitle,
    };
    return {
      allowed: false,
      status: 'LOGIN_REQUIRED',
      reason: 'Authentication required to access premium content or verify subscription.',
      contentId: content.id,
      contentType: params.contentType,
      channelId: channel.id,
      monetizationPrompt: prompt,
      evaluatedAt,
    };
  }

  const userPasses = params.userPasses || [];
  const userSubs = params.userSubscriptions || [];

  // 10. Policy: PPV / TVOD (Single-item ticket or Granular Season pass)
  if (content.access_policy === 'ppv_tvod') {
    return evaluatePpvEntitlement({
      viewer,
      channel,
      content,
      parentSeries: params.parentSeries,
      contentType: params.contentType,
      userPasses,
      now,
      nowMs,
      evaluatedAt,
    });
  }

  // 11. Policy: SVOD Subscriber Only (Channel-wide pass)
  if (content.access_policy === 'svod_subscriber') {
    return evaluateSvodEntitlement({
      viewer,
      channel,
      content,
      contentType: params.contentType,
      userSubs,
      now,
      nowMs,
      evaluatedAt,
    });
  }

  // 12. Policy: Hybrid Early Access (SVOD Subscriber OR PPV Ticket)
  if (content.access_policy === 'hybrid_early_access') {
    // 12a. Check SVOD subscription first
    const svodResult = evaluateSvodEntitlement({
      viewer,
      channel,
      content,
      contentType: params.contentType,
      userSubs,
      now,
      nowMs,
      evaluatedAt,
    });

    if (svodResult.allowed) {
      return svodResult;
    }

    // 12b. Check PPV pass next
    const ppvResult = evaluatePpvEntitlement({
      viewer,
      channel,
      content,
      parentSeries: params.parentSeries,
      contentType: params.contentType,
      userPasses,
      now,
      nowMs,
      evaluatedAt,
    });

    if (ppvResult.allowed) {
      return ppvResult;
    }

    // Specific error priority
    if (ppvResult.status === 'ACCESS_REVOKED') return ppvResult;
    if (ppvResult.status === 'ENTITLEMENT_EXPIRED' && svodResult.status !== 'ENTITLEMENT_EXPIRED') return ppvResult;
    if (svodResult.status === 'ENTITLEMENT_EXPIRED') return svodResult;

    // Both unowned: present prompt
    return {
      allowed: false,
      status: 'PAYMENT_REQUIRED',
      reason: 'Access requires an active channel subscription or a PPV early access ticket.',
      contentId: content.id,
      contentType: params.contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'purchase_ticket',
        priceIdr: (content as any).ppv_price_idr || 0,
        currency: 'IDR',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  // 13. Fail-Closed Fallback
  return {
    allowed: false,
    status: 'CONTENT_UNAVAILABLE',
    reason: `Unknown or unhandled access policy: ${content.access_policy}. Access denied by default.`,
    contentId: content.id,
    contentType: params.contentType,
    channelId: channel.id,
    evaluatedAt,
  };
}

/**
 * Internal evaluator for PPV / TVOD entitlements.
 * Granular Season Pass: Matches content_id against season_id for episodes.
 */
function evaluatePpvEntitlement(args: {
  viewer: { id: string };
  channel: OttChannel;
  content: OttEpisode | OttFilm;
  parentSeries?: OttSeries;
  contentType: 'episode' | 'film';
  userPasses: OttAccessPass[];
  now: Date;
  nowMs: number;
  evaluatedAt: string;
}): OttAccessDecisionResult {
  const { viewer, channel, content, contentType, userPasses, now, nowMs, evaluatedAt } = args;
  const contentTitle = content.title || 'Untitled Content';
  const ppvPrice = (content as any).ppv_price_idr || 0;

  // Find candidate passes:
  // Must match viewer.id AND channel.id
  // 1. Direct item pass: content_id === content.id AND content_type === contentType
  // 2. Season pass: contentType === 'episode' AND content_type IN ('season', 'series_season_pass') AND content_id === (content as OttEpisode).season_id
  const matchingPass = userPasses.find((p) => {
    if (p.user_id !== viewer.id) return false;
    if (p.channel_id !== channel.id) return false;

    // Direct episode or film pass
    if (p.content_id === content.id && p.content_type === contentType) {
      return true;
    }

    // Granular Season pass: Matches the specific season_id of this episode
    if (
      contentType === 'episode' &&
      (p.content_type === 'season' || p.content_type === 'series_season_pass') &&
      p.content_id === (content as OttEpisode).season_id
    ) {
      return true;
    }

    return false;
  });

  if (!matchingPass) {
    return {
      allowed: false,
      status: 'PAYMENT_REQUIRED',
      reason: 'No active access pass found for this title. Ticket purchase required.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'purchase_ticket',
        priceIdr: ppvPrice,
        currency: 'IDR',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  // Status check: Revoked
  if (matchingPass.status === 'revoked') {
    return {
      allowed: false,
      status: 'ACCESS_REVOKED',
      reason: 'Your access pass for this title has been revoked.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'contact_support',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  // Time boundaries: valid_from and valid_until
  const validFromMs = new Date(matchingPass.valid_from).getTime();
  if (nowMs < validFromMs) {
    return {
      allowed: false,
      status: 'ENTITLEMENT_EXPIRED',
      reason: 'Access pass is not yet active.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      evaluatedAt,
    };
  }

  const isTimeExpired = matchingPass.valid_until && new Date(matchingPass.valid_until).getTime() <= nowMs;
  if (matchingPass.status === 'expired' || isTimeExpired) {
    return {
      allowed: false,
      status: 'ENTITLEMENT_EXPIRED',
      reason: 'Your access pass for this title has expired. Purchase a renewal pass to resume watching.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'purchase_ticket',
        priceIdr: ppvPrice,
        currency: 'IDR',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  // Valid Active PPV Pass -> Return Ephemeral Grant (NO raw master URL)
  return {
    allowed: true,
    status: 'ALLOWED_PPV',
    reason: 'Active PPV ticket entitlement confirmed.',
    contentId: content.id,
    contentType,
    channelId: channel.id,
    entitlementGrant: generateEntitlementGrant({
      contentId: content.id,
      contentType,
      viewerId: viewer.id,
      channelId: channel.id,
      accessPolicy: 'ppv_tvod',
      now,
      maxExpiryMs: matchingPass.valid_until ? new Date(matchingPass.valid_until).getTime() : undefined,
      watermarkRequired: true,
    }),
    playbackSession: generatePlaybackSession(
      content.id,
      viewer.id,
      channel.id,
      now,
      true
    ),
    evaluatedAt,
  };
}

/**
 * Internal evaluator for SVOD channel subscriptions.
 * Handles lifecycle: active, cancelled (grace period until end), expired, past_due, revoked.
 */
function evaluateSvodEntitlement(args: {
  viewer: { id: string };
  channel: OttChannel;
  content: OttEpisode | OttFilm;
  contentType: 'episode' | 'film';
  userSubs: OttViewerSubscription[];
  now: Date;
  nowMs: number;
  evaluatedAt: string;
}): OttAccessDecisionResult {
  const { viewer, channel, content, contentType, userSubs, now, nowMs, evaluatedAt } = args;
  const contentTitle = content.title || 'Untitled Content';

  const matchingSub = userSubs.find((s) => s.user_id === viewer.id && s.channel_id === channel.id);

  if (!matchingSub) {
    return {
      allowed: false,
      status: 'SUBSCRIPTION_REQUIRED',
      reason: 'An active channel subscription is required to stream this title.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'subscribe',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  // Revocation
  if (matchingSub.status === 'revoked') {
    return {
      allowed: false,
      status: 'ACCESS_REVOKED',
      reason: 'Your channel subscription access has been revoked.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'contact_support',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  const startMs = new Date(matchingSub.current_period_start).getTime();
  const endMs = new Date(matchingSub.current_period_end).getTime();

  // Period not yet started
  if (nowMs < startMs) {
    return {
      allowed: false,
      status: 'ENTITLEMENT_EXPIRED',
      reason: 'Subscription period has not commenced yet.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      evaluatedAt,
    };
  }

  // Period expired or past due
  const hasEnded = nowMs >= endMs;
  if (matchingSub.status === 'expired' || matchingSub.status === 'past_due' || hasEnded) {
    return {
      allowed: false,
      status: 'ENTITLEMENT_EXPIRED',
      reason: 'Your channel subscription has expired or is past due. Please renew your subscription.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      monetizationPrompt: {
        requiredAction: 'subscribe',
        channelId: channel.id,
        contentTitle,
      },
      evaluatedAt,
    };
  }

  // Active OR Cancelled where paid period is still valid (nowMs < endMs)
  if (matchingSub.status === 'active' || matchingSub.status === 'cancelled') {
    return {
      allowed: true,
      status: 'ALLOWED_SVOD',
      reason: matchingSub.status === 'cancelled'
        ? 'Subscription renewal cancelled, but paid access is active until end of billing cycle.'
        : 'Active channel subscription entitlement confirmed.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      entitlementGrant: generateEntitlementGrant({
        contentId: content.id,
        contentType,
        viewerId: viewer.id,
        channelId: channel.id,
        accessPolicy: 'svod_subscriber',
        now,
        maxExpiryMs: endMs,
        watermarkRequired: true,
      }),
      playbackSession: generatePlaybackSession(
        content.id,
        viewer.id,
        channel.id,
        now,
        true
      ),
      evaluatedAt,
    };
  }

  return {
    allowed: false,
    status: 'SUBSCRIPTION_REQUIRED',
    reason: `Subscription status is ${matchingSub.status}.`,
    contentId: content.id,
    contentType,
    channelId: channel.id,
    monetizationPrompt: {
      requiredAction: 'subscribe',
      channelId: channel.id,
      contentTitle,
    },
    evaluatedAt,
  };
}

/**
 * Deterministic helper to generate test access pass fixture.
 */
export function createTestOttAccessPass(
  params: {
    userId: string;
    channelId: string;
    contentType: 'episode' | 'film' | 'season' | 'series_season_pass';
    contentId: string;
    status?: 'active' | 'expired' | 'revoked';
    validHours?: number;
    pricePaidIdr?: number;
    validFrom?: string;
    now?: Date;
  }
): OttAccessPass {
  const now = params.now || new Date();
  const validFrom = params.validFrom || now.toISOString();
  const validUntil = params.validHours !== undefined
    ? new Date(now.getTime() + params.validHours * 60 * 60 * 1000).toISOString()
    : null;

  return {
    id: `pass_${Math.random().toString(36).substring(2, 10)}`,
    user_id: params.userId,
    channel_id: params.channelId,
    content_type: params.contentType,
    content_id: params.contentId,
    order_ref_id: `ott_ord_${Date.now()}`,
    price_paid_idr: params.pricePaidIdr !== undefined ? params.pricePaidIdr : 15000,
    currency: 'IDR',
    status: params.status || 'active',
    valid_from: validFrom,
    valid_until: validUntil,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/**
 * Deterministic helper to generate test viewer subscription fixture.
 */
export function createTestOttViewerSubscription(
  params: {
    userId: string;
    channelId: string;
    status?: 'active' | 'cancelled' | 'expired' | 'past_due' | 'revoked';
    tierName?: string;
    validDays?: number;
    startDaysOffset?: number;
    pricePaidIdr?: number;
    autoRenew?: boolean;
    now?: Date;
  }
): OttViewerSubscription {
  const now = params.now || new Date();
  const startOffsetDays = params.startDaysOffset !== undefined ? params.startDaysOffset : 0;
  const validDays = params.validDays !== undefined ? params.validDays : 30;

  const currentPeriodStart = new Date(now.getTime() + startOffsetDays * 24 * 60 * 60 * 1000).toISOString();
  const currentPeriodEnd = new Date(now.getTime() + (startOffsetDays + validDays) * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `vsub_${Math.random().toString(36).substring(2, 10)}`,
    user_id: params.userId,
    channel_id: params.channelId,
    tier_name: params.tierName || 'Monthly VIP Pass',
    billing_cycle: 'monthly',
    status: params.status || 'active',
    price_paid_idr: params.pricePaidIdr !== undefined ? params.pricePaidIdr : 49000,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    auto_renew: params.autoRenew !== undefined ? params.autoRenew : true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}
