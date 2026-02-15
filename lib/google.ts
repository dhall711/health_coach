// Google OAuth2 and Calendar helpers.
// Only import in server-side API routes.

import { google } from "googleapis";
import { getOAuthTokens, saveOAuthTokens, isTokenExpired } from "@/lib/integrations";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

function getRedirectUri() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/integrations/google/callback`;
  }
  return "http://localhost:3000/api/integrations/google/callback";
}

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }

  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

/**
 * Generate the Google OAuth authorization URL.
 */
export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

/**
 * Exchange an authorization code for tokens and store them.
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing access or refresh token from Google");
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  await saveOAuthTokens(
    "google",
    tokens.access_token,
    tokens.refresh_token,
    expiresAt,
    SCOPES.join(" ")
  );

  return tokens;
}

/**
 * Get an authenticated OAuth2 client with fresh tokens.
 */
export async function getAuthenticatedClient() {
  const tokens = await getOAuthTokens("google");
  if (!tokens) throw new Error("Google Calendar not connected");

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  // Refresh if expired
  if (isTokenExpired(tokens)) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await saveOAuthTokens(
      "google",
      credentials.access_token!,
      credentials.refresh_token || tokens.refresh_token,
      expiresAt,
      SCOPES.join(" ")
    );

    oauth2Client.setCredentials(credentials);
  }

  return oauth2Client;
}

/**
 * Get a Google Calendar API instance with authenticated client.
 */
export async function getCalendarClient() {
  const auth = await getAuthenticatedClient();
  return google.calendar({ version: "v3", auth });
}
