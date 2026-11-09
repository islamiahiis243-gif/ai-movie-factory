/**
 * AI MOVIE FACTORY — CREATOR OAUTH DISTRIBUTION SERVICE (T9.3)
 * Client-side interface to serverless OAuth broker and sanitized connection metadata.
 * Zero token exposure: Browser NEVER interacts with token ciphertext, IVs, or secrets.
 */

import { PlatformId, FirstWavePlatformId } from './types';

export interface CreatorConnection {
  id: string;
  platform: PlatformId;
  provider_account_id: string;
  provider_account_name: string;
  provider_avatar_url?: string;
  connection_status: 'connected' | 'needs_reauth' | 'revoked' | 'expired';
  token_expires_at?: string;
  granted_scopes: string[];
  created_at: string;
  updated_at: string;
}

export interface FetchConnectionsResponse {
  connections: CreatorConnection[];
  configuredPlatforms: Record<FirstWavePlatformId, boolean>;
  notice?: string;
}

export class OAuthDistributionService {
  /**
   * Fetches the authenticated creator's sanitized platform connections.
   */
  static async fetchConnections(accessToken: string): Promise<FetchConnectionsResponse> {
    if (!accessToken) {
      return {
        connections: [],
        configuredPlatforms: {
          youtube: false,
          tiktok: false,
          instagram: false,
          facebook: false,
        },
      };
    }

    try {
      const response = await fetch('/api/oauth/connections', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Gagal memuat status koneksi platform (${response.statusText})`);
      }

      const data = await response.json();
      return {
        connections: data.connections || [],
        configuredPlatforms: data.configuredPlatforms || {
          youtube: false,
          tiktok: false,
          instagram: false,
          facebook: false,
        },
        notice: data.notice,
      };
    } catch (err: any) {
      console.warn('OAuthDistributionService.fetchConnections warning:', err.message);
      return {
        connections: [],
        configuredPlatforms: {
          youtube: false,
          tiktok: false,
          instagram: false,
          facebook: false,
        },
      };
    }
  }

  /**
   * Initiates the secure OAuth connection sequence with CSRF protection.
   * If credentials are missing in production environment, returns an honest descriptive error.
   */
  static async initiateConnect(params: {
    platform: PlatformId;
    accessToken: string;
    returnUrl?: string;
  }): Promise<{ redirectUrl: string }> {
    const { platform, accessToken, returnUrl } = params;

    const response = await fetch('/api/oauth/connect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, returnUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 503 && data.requiredEnvVars) {
        throw new Error(
          `Integrasi API ${platform.toUpperCase()} memerlukan pengaturan kredensial developer (${data.requiredEnvVars.join(
            ', '
          )}) pada Vercel environment variables.`
        );
      }
      throw new Error(data.error || `Gagal menginisiasi otorisasi untuk ${platform}.`);
    }

    if (!data.redirectUrl) {
      throw new Error('Server tidak mengembalikan URL pengalihan otorisasi.');
    }

    return { redirectUrl: data.redirectUrl };
  }

  /**
   * Disconnects an external channel and revokes/deletes credentials from the vault.
   */
  static async disconnect(params: {
    platform: PlatformId;
    accessToken: string;
    accountId?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { platform, accessToken, accountId } = params;

    const response = await fetch('/api/oauth/disconnect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform, accountId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Gagal memutuskan sambungan akun ${platform}.`);
    }

    return {
      success: true,
      message: data.message || `Koneksi ke ${platform} berhasil diputuskan.`,
    };
  }
}
