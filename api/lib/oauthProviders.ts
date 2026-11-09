/**
 * AI MOVIE FACTORY — OAUTH PROVIDER SPECIFICATIONS & ADAPTERS (T9.3)
 * First-Wave Platforms: YouTube (Google), TikTok, Instagram (Meta), Facebook (Meta)
 * Secure, zero-dummy implementation: requires verified environment credentials.
 */

export interface OAuthProviderConfig {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  isConfigured: boolean;
  requiredEnvVars: string[];
  redirectUriPath: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
  raw: any;
}

export interface PlatformUserProfile {
  accountId: string;
  accountName: string;
  avatarUrl?: string;
  raw: any;
}

function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://ai-movie-factory.vercel.app';
}

export function getProviderConfig(platformId: string): OAuthProviderConfig {
  const baseUrl = getAppBaseUrl();
  const callbackUrl = `${baseUrl}/api/oauth/callback`;

  switch (platformId) {
    case 'youtube': {
      const clientId =
        process.env.YOUTUBE_CLIENT_ID ||
        process.env.GOOGLE_CLIENT_ID ||
        '';
      const clientSecret =
        process.env.YOUTUBE_CLIENT_SECRET ||
        process.env.GOOGLE_CLIENT_SECRET ||
        '';
      return {
        id: 'youtube',
        name: 'YouTube',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        revokeUrl: 'https://oauth2.googleapis.com/revoke',
        scopes: [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.readonly',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
        clientId,
        clientSecret,
        isConfigured: Boolean(clientId && clientSecret),
        requiredEnvVars: ['YOUTUBE_CLIENT_ID (or GOOGLE_CLIENT_ID)', 'YOUTUBE_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET)'],
        redirectUriPath: callbackUrl,
      };
    }

    case 'tiktok': {
      const clientId = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID || '';
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
      return {
        id: 'tiktok',
        name: 'TikTok',
        authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
        tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
        revokeUrl: 'https://open.tiktokapis.com/v2/oauth/revoke/',
        scopes: ['user.info.basic', 'video.publish', 'video.upload'],
        clientId,
        clientSecret,
        isConfigured: Boolean(clientId && clientSecret),
        requiredEnvVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
        redirectUriPath: callbackUrl,
      };
    }

    case 'instagram': {
      const clientId = process.env.INSTAGRAM_CLIENT_ID || process.env.META_APP_ID || '';
      const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET || process.env.META_APP_SECRET || '';
      return {
        id: 'instagram',
        name: 'Instagram (Meta)',
        authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
        scopes: [
          'instagram_basic',
          'instagram_content_publish',
          'pages_show_list',
          'pages_read_engagement',
        ],
        clientId,
        clientSecret,
        isConfigured: Boolean(clientId && clientSecret),
        requiredEnvVars: ['INSTAGRAM_CLIENT_ID (or META_APP_ID)', 'INSTAGRAM_CLIENT_SECRET (or META_APP_SECRET)'],
        redirectUriPath: callbackUrl,
      };
    }

    case 'facebook': {
      const clientId = process.env.FACEBOOK_CLIENT_ID || process.env.META_APP_ID || '';
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || process.env.META_APP_SECRET || '';
      return {
        id: 'facebook',
        name: 'Facebook (Meta)',
        authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
        scopes: [
          'pages_show_list',
          'pages_read_engagement',
          'pages_manage_posts',
          'publish_video',
        ],
        clientId,
        clientSecret,
        isConfigured: Boolean(clientId && clientSecret),
        requiredEnvVars: ['FACEBOOK_CLIENT_ID (or META_APP_ID)', 'FACEBOOK_CLIENT_SECRET (or META_APP_SECRET)'],
        redirectUriPath: callbackUrl,
      };
    }

    default:
      throw new Error(`Platform "${platformId}" is not currently supported for direct OAuth connection.`);
  }
}

/**
 * Builds the provider authorization redirect URL.
 */
export function buildAuthorizationUrl(platformId: string, state: string): string {
  const config = getProviderConfig(platformId);
  const redirectUri = config.redirectUriPath;

  const params = new URLSearchParams();

  switch (platformId) {
    case 'youtube': {
      params.append('client_id', config.clientId);
      params.append('redirect_uri', redirectUri);
      params.append('response_type', 'code');
      params.append('scope', config.scopes.join(' '));
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
      params.append('state', state);
      return `${config.authUrl}?${params.toString()}`;
    }

    case 'tiktok': {
      params.append('client_key', config.clientId);
      params.append('redirect_uri', redirectUri);
      params.append('response_type', 'code');
      params.append('scope', config.scopes.join(','));
      params.append('state', state);
      return `${config.authUrl}?${params.toString()}`;
    }

    case 'instagram':
    case 'facebook': {
      params.append('client_id', config.clientId);
      params.append('redirect_uri', redirectUri);
      params.append('response_type', 'code');
      params.append('scope', config.scopes.join(','));
      params.append('state', state);
      return `${config.authUrl}?${params.toString()}`;
    }

    default:
      throw new Error(`Unsupported platform ${platformId}`);
  }
}

/**
 * Exchanges authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  platformId: string,
  code: string
): Promise<TokenExchangeResult> {
  const config = getProviderConfig(platformId);

  if (!config.isConfigured) {
    throw new Error(`Kredensial OAuth untuk ${config.name} belum dikonfigurasi di server.`);
  }

  const redirectUri = config.redirectUriPath;

  switch (platformId) {
    case 'youtube': {
      const body = new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(`YouTube OAuth token exchange failed: ${data.error_description || data.error || response.statusText}`);
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type || 'Bearer',
        scope: data.scope,
        raw: data,
      };
    }

    case 'tiktok': {
      const body = new URLSearchParams({
        client_key: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(`TikTok OAuth exchange failed: ${data.message || data.error_description || response.statusText}`);
      }

      const tokenData = data.data || data;
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scope,
        raw: data,
      };
    }

    case 'instagram':
    case 'facebook': {
      const url = new URL(config.tokenUrl);
      url.searchParams.append('client_id', config.clientId);
      url.searchParams.append('client_secret', config.clientSecret);
      url.searchParams.append('redirect_uri', redirectUri);
      url.searchParams.append('code', code);

      const response = await fetch(url.toString(), { method: 'GET' });
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(`Meta OAuth exchange failed: ${data.error?.message || response.statusText}`);
      }

      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type || 'Bearer',
        scope: config.scopes.join(','),
        raw: data,
      };
    }

    default:
      throw new Error(`Unsupported platform: ${platformId}`);
  }
}

/**
 * Fetches user profile / channel metadata for the connected account.
 */
export async function fetchPlatformUserProfile(
  platformId: string,
  accessToken: string
): Promise<PlatformUserProfile> {
  switch (platformId) {
    case 'youtube': {
      const res = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await res.json();
      if (!res.ok || !data.items || data.items.length === 0) {
        // Fallback to basic google user profile if no public channel exists yet
        const profRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profData = await profRes.json();
        return {
          accountId: profData.id || 'google_user',
          accountName: profData.name || profData.email || 'YouTube Creator',
          avatarUrl: profData.picture,
          raw: profData,
        };
      }
      const channel = data.items[0];
      return {
        accountId: channel.id,
        accountName: channel.snippet.title,
        avatarUrl: channel.snippet.thumbnails?.default?.url,
        raw: channel,
      };
    }

    case 'tiktok': {
      const res = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await res.json();
      const user = data.data?.user || {};
      return {
        accountId: user.open_id || user.union_id || 'tiktok_creator',
        accountName: user.display_name || 'TikTok Creator',
        avatarUrl: user.avatar_url,
        raw: data,
      };
    }

    case 'instagram': {
      // Fetch user's pages and connected Instagram business account
      const res = await fetch(
        'https://graph.facebook.com/v19.0/me?fields=id,name,accounts{instagram_business_account{id,username,profile_picture_url}}',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await res.json();
      const page = data.accounts?.data?.[0];
      const ig = page?.instagram_business_account;
      if (ig) {
        return {
          accountId: ig.id,
          accountName: `@${ig.username}`,
          avatarUrl: ig.profile_picture_url,
          raw: data,
        };
      }
      return {
        accountId: data.id || 'ig_user',
        accountName: data.name ? `${data.name} (IG)` : 'Instagram Creator',
        raw: data,
      };
    }

    case 'facebook': {
      const res = await fetch(
        'https://graph.facebook.com/v19.0/me?fields=id,name,picture',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const data = await res.json();
      return {
        accountId: data.id || 'fb_user',
        accountName: data.name || 'Facebook Creator',
        avatarUrl: data.picture?.data?.url,
        raw: data,
      };
    }

    default:
      return {
        accountId: 'unknown',
        accountName: platformId,
        raw: null,
      };
  }
}
