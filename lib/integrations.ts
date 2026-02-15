// Shared integration helpers for OAuth token management and sync logging.
// Only import in server-side API routes.

import { query } from "@/lib/neon";

export type Provider = "withings" | "google";
export type SyncSource = "withings" | "apple_health" | "precor" | "google_calendar";

export interface OAuthTokens {
  id: string;
  provider: Provider;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Retrieve stored OAuth tokens for a provider.
 * Returns null if not connected.
 */
export async function getOAuthTokens(provider: Provider): Promise<OAuthTokens | null> {
  const rows = await query(
    "SELECT * FROM oauth_tokens WHERE provider = $1 LIMIT 1",
    [provider]
  );
  return rows.length > 0 ? (rows[0] as OAuthTokens) : null;
}

/**
 * Store or update OAuth tokens for a provider.
 */
export async function saveOAuthTokens(
  provider: Provider,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  scopes?: string
): Promise<void> {
  await query(
    `INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scopes, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (provider)
     DO UPDATE SET access_token = $2, refresh_token = $3, expires_at = $4, scopes = $5, updated_at = NOW()`,
    [provider, accessToken, refreshToken, expiresAt.toISOString(), scopes ?? null]
  );
}

/**
 * Delete OAuth tokens for a provider (disconnect).
 */
export async function deleteOAuthTokens(provider: Provider): Promise<void> {
  await query("DELETE FROM oauth_tokens WHERE provider = $1", [provider]);
}

/**
 * Check if tokens are expired (with 5-minute buffer).
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  const expiresAt = new Date(tokens.expires_at);
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() > expiresAt.getTime() - bufferMs;
}

/**
 * Log a sync attempt.
 */
export async function logSync(
  source: SyncSource,
  status: "success" | "error",
  recordsSynced: number,
  errorMessage?: string
): Promise<void> {
  await query(
    `INSERT INTO sync_logs (source, status, records_synced, error_message)
     VALUES ($1, $2, $3, $4)`,
    [source, status, recordsSynced, errorMessage ?? null]
  );
}

/**
 * Get the last sync log for a source.
 */
export async function getLastSync(source: SyncSource) {
  const rows = await query(
    "SELECT * FROM sync_logs WHERE source = $1 ORDER BY last_sync_at DESC LIMIT 1",
    [source]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get connection status for all integrations.
 */
export async function getAllIntegrationStatuses() {
  const [tokens, syncs] = await Promise.all([
    query("SELECT provider, expires_at FROM oauth_tokens"),
    query(
      `SELECT DISTINCT ON (source) source, last_sync_at, status, records_synced
       FROM sync_logs ORDER BY source, last_sync_at DESC`
    ),
  ]);

  const tokenMap = new Map(tokens.map((t) => [t.provider, t]));
  const syncMap = new Map(syncs.map((s) => [s.source, s]));

  return {
    google: {
      connected: tokenMap.has("google"),
      lastSync: syncMap.get("google_calendar") ?? null,
    },
    withings: {
      connected: tokenMap.has("withings"),
      lastSync: syncMap.get("withings") ?? null,
    },
    apple_health: {
      connected: false, // Webhook-based, no OAuth
      lastSync: syncMap.get("apple_health") ?? null,
    },
    precor: {
      connected: false, // Manual import
      lastSync: syncMap.get("precor") ?? null,
    },
  };
}
