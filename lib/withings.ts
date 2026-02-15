// Withings OAuth2 and API helpers.
// Only import in server-side API routes.

import { getOAuthTokens, saveOAuthTokens, isTokenExpired } from "@/lib/integrations";

const WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2";
const WITHINGS_TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2";
const WITHINGS_MEASURE_URL = "https://wbsapi.withings.net/measure";

function getRedirectUri() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/withings/callback`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/integrations/withings/callback`;
  }
  return "http://localhost:3000/api/integrations/withings/callback";
}

/**
 * Generate the Withings OAuth authorization URL.
 */
export function getWithingsAuthUrl(): string {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  if (!clientId) throw new Error("WITHINGS_CLIENT_ID must be set");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: "user.metrics",
    state: "withings_auth",
  });

  return `${WITHINGS_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeWithingsCode(code: string) {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({
    action: "requesttoken",
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getRedirectUri(),
  });

  const res = await fetch(WITHINGS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();

  if (data.status !== 0 || !data.body) {
    throw new Error(`Withings token error: ${JSON.stringify(data)}`);
  }

  const { access_token, refresh_token, expires_in } = data.body;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  await saveOAuthTokens("withings", access_token, refresh_token, expiresAt, "user.metrics");

  return data.body;
}

/**
 * Refresh Withings tokens if expired and return a valid access token.
 */
export async function getWithingsAccessToken(): Promise<string> {
  const tokens = await getOAuthTokens("withings");
  if (!tokens) throw new Error("Withings not connected");

  if (!isTokenExpired(tokens)) {
    return tokens.access_token;
  }

  // Refresh
  const clientId = process.env.WITHINGS_CLIENT_ID;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({
    action: "requesttoken",
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
  });

  const res = await fetch(WITHINGS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();

  if (data.status !== 0 || !data.body) {
    throw new Error(`Withings refresh error: ${JSON.stringify(data)}`);
  }

  const { access_token, refresh_token, expires_in } = data.body;
  const expiresAt = new Date(Date.now() + expires_in * 1000);

  await saveOAuthTokens("withings", access_token, refresh_token, expiresAt, "user.metrics");

  return access_token;
}

/**
 * Fetch weight measurements from Withings.
 * Returns array of { timestamp, weight_lbs, body_fat_pct }
 */
export async function fetchWithingsWeightData(startDate: Date, endDate: Date) {
  const accessToken = await getWithingsAccessToken();

  const body = new URLSearchParams({
    action: "getmeas",
    meastype: "1,6", // 1=weight, 6=body fat %
    category: "1", // Real measures (not user objectives)
    startdate: Math.floor(startDate.getTime() / 1000).toString(),
    enddate: Math.floor(endDate.getTime() / 1000).toString(),
  });

  const res = await fetch(WITHINGS_MEASURE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${accessToken}`,
    },
    body: body.toString(),
  });

  const data = await res.json();

  if (data.status !== 0 || !data.body) {
    throw new Error(`Withings measure error: ${JSON.stringify(data)}`);
  }

  const measureGroups = data.body.measuregrps || [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return measureGroups.map((grp: any) => {
    const timestamp = new Date(grp.date * 1000).toISOString();
    let weightKg: number | null = null;
    let bodyFatPct: number | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of grp.measures || []) {
      const value = m.value * Math.pow(10, m.unit);
      if (m.type === 1) weightKg = value; // Weight in kg
      if (m.type === 6) bodyFatPct = value; // Body fat %
    }

    return {
      timestamp,
      weight_lbs: weightKg ? Math.round(weightKg * 2.20462 * 10) / 10 : null,
      body_fat_pct: bodyFatPct ? Math.round(bodyFatPct * 10) / 10 : null,
    };
  }).filter((m: { weight_lbs: number | null }) => m.weight_lbs !== null);
}
