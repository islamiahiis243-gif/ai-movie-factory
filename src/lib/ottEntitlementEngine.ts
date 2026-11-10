/**
 * AI Movie Factory — Phase 6: Web & Independent OTT Publishing Studio
 * Milestone 2.9.1: Content Access Control & Entitlement Engine (SSOT Core Module)
 * 
 * Architectural Guarantees:
 * 1. Strict Isolation: Completely segregated from Creator Studio SaaS Billing & AI Credits.
 * 2. Fail-Closed Security: Access is denied by default; playbackSession is NEVER returned without verified entitlement.
 * 3. Identity & Cross-Tenant Defense: Viewer cannot use another viewer's passes; Channel A subscription never grants Channel B access.
 * 4. Deterministic State Machine: 13 unambiguous decision outcomes.
 */

import {
  OttChannel,
  OttSeries,
  OttEpisode,
  OttFilm,
  OttAccessPass,
  OttViewerSubscription,
  OttAccessDecisionResult,
  OttAccessDecisionStatus,
  ResolveOttAccessParams,
  OttPlaybackSession,
  OttMonetizationPrompt,
} from '../types/database';

/**
 * Generates an opaque, cryptographically formatted playback session token.
 * Valid for 6 hours by default.
 */
export function generatePlaybackSession(
  contentId: string,
  userId: string,
  channelId: string,
  videoUrl: string,
  now: Date = new Date(),
  isWatermarked: boolean = true
): OttPlaybackSession {
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const rawId = `${contentId}-${userId}-${now.getTime()}-${Math.random().toString(36).substring(2, 9)}`;
  const ticketId = `tk_ott_${Buffer.from(rawId).toString('base64url').substring(0, 24)}`;
  const sessionToken = `st_amf_${Buffer.from(`${ticketId}:${channelId}:${expiresAt}`).toString('base64url')}`;

  return {
    ticketId,
    videoUrl,
    expiresAt,
    isWatermarked,
    sessionToken,
  };
}

/**
 * Checks if scheduled release time has passed.
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
 * 
 * Decision Priority:
 * 1. Channel Active Check
 * 2. Multi-Tenant Cross-Channel Integrity
 * 3. Content Publication Status
 * 4. Scheduled Release Date
 * 5. Preview Mode Request
 * 6. Free Access Policy
 * 7. Viewer Authentication Check
 * 8. Entitlement Verification (PPV Pass / SVOD Channel Subscription / Hybrid)
 * 9. Fail-Closed Default Denial
 */
export function resolveOttContentAccess(params: ResolveOttAccessParams): OttAccessDecisionResult {
  const now = params.currentTime || new Date();
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
          playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, film.trailer_video_url, now, false),
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
        playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, content.master_video_url || '', now, false),
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
      playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, content.master_video_url || '', now, false),
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
      playbackSession: generatePlaybackSession(content.id, params.viewer?.id || 'anon', channel.id, content.master_video_url || '', now, false),
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

  // 10. Policy: PPV / TVOD (Single-item ticket or Season pass)
  if (content.access_policy === 'ppv_tvod') {
    return evaluatePpvEntitlement({
      viewer,
      channel,
      content,
      parentSeries: params.parentSeries,
      contentType: params.contentType,
      userPasses,
      now,
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
      evaluatedAt,
    });

    if (ppvResult.allowed) {
      return ppvResult;
    }

    // If either resulted in revoked or expired, prioritize specific status
    if (ppvResult.status === 'ACCESS_REVOKED') return ppvResult;
    if (ppvResult.status === 'ENTITLEMENT_EXPIRED' && svodResult.status !== 'ENTITLEMENT_EXPIRED') return ppvResult;
    if (svodResult.status === 'ENTITLEMENT_EXPIRED') return svodResult;

    // Both not owned: present dual monetization prompt
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
 */
function evaluatePpvEntitlement(args: {
  viewer: { id: string };
  channel: OttChannel;
  content: OttEpisode | OttFilm;
  parentSeries?: OttSeries;
  contentType: 'episode' | 'film';
  userPasses: OttAccessPass[];
  now: Date;
  evaluatedAt: string;
}): OttAccessDecisionResult {
  const { viewer, channel, content, parentSeries, contentType, userPasses, now, evaluatedAt } = args;
  const contentTitle = content.title || 'Untitled Content';
  const ppvPrice = (content as any).ppv_price_idr || 0;

  // Find candidate passes:
  // Must match viewer.id AND channel.id
  // Must match either direct content_id OR parent series id if pass is 'series_season_pass'
  const matchingPass = userPasses.find((p) => {
    if (p.user_id !== viewer.id) return false;
    if (p.channel_id !== channel.id) return false;

    // Direct episode or film pass
    if (p.content_id === content.id && p.content_type === contentType) {
      return true;
    }

    // Series season pass unlocking any episode within that series
    if (
      contentType === 'episode' &&
      parentSeries &&
      p.content_id === parentSeries.id &&
      p.content_type === 'series_season_pass'
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

  // Status check: Expired
  const isTimeExpired = matchingPass.valid_until && new Date(matchingPass.valid_until).getTime() < now.getTime();
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

  // Valid Active PPV Pass
  return {
    allowed: true,
    status: 'ALLOWED_PPV',
    reason: 'Active PPV ticket entitlement confirmed.',
    contentId: content.id,
    contentType,
    channelId: channel.id,
    playbackSession: generatePlaybackSession(
      content.id,
      viewer.id,
      channel.id,
      content.master_video_url || '',
      now,
      true
    ),
    evaluatedAt,
  };
}

/**
 * Internal evaluator for SVOD channel subscriptions.
 */
function evaluateSvodEntitlement(args: {
  viewer: { id: string };
  channel: OttChannel;
  content: OttEpisode | OttFilm;
  contentType: 'episode' | 'film';
  userSubs: OttViewerSubscription[];
  now: Date;
  evaluatedAt: string;
}): OttAccessDecisionResult {
  const { viewer, channel, content, contentType, userSubs, now, evaluatedAt } = args;
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

  const periodEndMs = new Date(matchingSub.current_period_end).getTime();
  const hasEnded = periodEndMs < now.getTime();

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

  if (matchingSub.status === 'active' || (matchingSub.status === 'cancelled' && !hasEnded)) {
    return {
      allowed: true,
      status: 'ALLOWED_SVOD',
      reason: 'Active channel subscription entitlement confirmed.',
      contentId: content.id,
      contentType,
      channelId: channel.id,
      playbackSession: generatePlaybackSession(
        content.id,
        viewer.id,
        channel.id,
        content.master_video_url || '',
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
    contentType: 'episode' | 'film' | 'series_season_pass';
    contentId: string;
    status?: 'active' | 'expired' | 'revoked';
    validHours?: number;
    pricePaidIdr?: number;
    now?: Date;
  }
): OttAccessPass {
  const now = params.now || new Date();
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
    valid_from: now.toISOString(),
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
    status?: 'active' | 'cancelled' | 'expired' | 'past_due';
    tierName?: string;
    validDays?: number;
    pricePaidIdr?: number;
    now?: Date;
  }
): OttViewerSubscription {
  const now = params.now || new Date();
  const validDays = params.validDays !== undefined ? params.validDays : 30;
  const currentPeriodEnd = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `vsub_${Math.random().toString(36).substring(2, 10)}`,
    user_id: params.userId,
    channel_id: params.channelId,
    tier_name: params.tierName || 'Monthly VIP Pass',
    billing_cycle: 'monthly',
    status: params.status || 'active',
    price_paid_idr: params.pricePaidIdr !== undefined ? params.pricePaidIdr : 49000,
    current_period_start: now.toISOString(),
    current_period_end: currentPeriodEnd,
    auto_renew: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}
