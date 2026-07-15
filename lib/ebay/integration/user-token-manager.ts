import { getEbayEnvironmentConfig, getEbayUserScopes } from "@/lib/ebay/integration/config";
import {
  decryptConnectionAccessToken,
  decryptConnectionRefreshToken,
  getEbayConnection,
  markEbayConnectionError,
  upsertEbayConnectionFromToken
} from "@/lib/ebay/integration/connection-store";
import type { EbayConnectionRow, EbayEnvironment } from "@/lib/ebay/integration/types";

const refreshSkewMs = 5 * 60 * 1000;
const tokenTimeoutMs = 12_000;
const pendingRefreshes = new Map<string, Promise<{ accessToken: string; connection: EbayConnectionRow }>>();

function basicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseTokenResponse(raw: string) {
  const parsed = JSON.parse(raw) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!parsed.access_token || !parsed.expires_in) {
    throw new Error("eBay did not return a usable user access token.");
  }
  return parsed;
}

function safeOauthError(status: number, raw: string) {
  return `eBay user OAuth failed (${status}): ${raw.replace(/access_token|refresh_token/gi, "[redacted]").slice(0, 600)}`;
}

export async function exchangeEbayAuthorizationCode({
  environment,
  code
}: {
  environment: EbayEnvironment;
  code: string;
}) {
  const config = getEbayEnvironmentConfig(environment);
  if (!config.configured || !config.ruName) {
    throw new Error(`Missing eBay ${config.label} OAuth configuration.`);
  }
  if (environment === "production" && !config.productionCallsAllowed) {
    throw new Error("Production user OAuth is disabled for this Sandbox phase.");
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", config.ruName);

  const response = await fetchWithTimeout(
    config.oauthUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(config.clientId || "", config.clientSecret || "")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    tokenTimeoutMs
  );
  const raw = await response.text();
  if (!response.ok) throw new Error(safeOauthError(response.status, raw));

  const token = parseTokenResponse(raw);
  return {
    accessToken: token.access_token as string,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in as number,
    refreshTokenExpiresIn: token.refresh_token_expires_in,
    scopes: token.scope?.split(/\s+/).filter(Boolean) || getEbayUserScopes(environment)
  };
}

export async function refreshEbayUserToken(environment: EbayEnvironment, connection?: EbayConnectionRow) {
  const row = connection || (await getEbayConnection(environment));
  if (!row?.refresh_token_encrypted) {
    await markEbayConnectionError(environment, "reauthorization_required", "Missing eBay refresh token. Reauthorization required.");
    throw new Error("Missing eBay refresh token. Reauthorization required.");
  }

  const pendingKey = row.id;
  const pending = pendingRefreshes.get(pendingKey);
  if (pending) return pending;

  const request = (async () => {
    const config = getEbayEnvironmentConfig(environment);
    const refreshToken = decryptConnectionRefreshToken(row);
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refreshToken);
    body.set("scope", getEbayUserScopes(environment).join(" "));

    const response = await fetchWithTimeout(
      config.oauthUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth(config.clientId || "", config.clientSecret || "")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      },
      tokenTimeoutMs
    );
    const raw = await response.text();
    if (!response.ok) {
      await markEbayConnectionError(environment, "reauthorization_required", safeOauthError(response.status, raw));
      throw new Error(safeOauthError(response.status, raw));
    }

    const token = parseTokenResponse(raw);
    const updated = await upsertEbayConnectionFromToken({
      environment,
      token: {
        accessToken: token.access_token as string,
        expiresIn: token.expires_in as number,
        scopes: token.scope?.split(/\s+/).filter(Boolean) || row.scopes || getEbayUserScopes(environment)
      },
      identity: {
        ebayUserId: row.ebay_user_id,
        ebayUsername: row.ebay_username
      }
    });
    return { accessToken: token.access_token as string, connection: updated };
  })().finally(() => pendingRefreshes.delete(pendingKey));

  pendingRefreshes.set(pendingKey, request);
  return request;
}

export async function getValidEbayUserAccessToken(environment: EbayEnvironment = "sandbox") {
  const row = await getEbayConnection(environment);
  if (!row || row.connection_status !== "connected") {
    throw new Error("eBay Sandbox account is not connected.");
  }
  if (!row.access_token_encrypted || !row.access_token_expires_at) {
    return refreshEbayUserToken(environment, row);
  }
  if (new Date(row.access_token_expires_at).getTime() - refreshSkewMs <= Date.now()) {
    return refreshEbayUserToken(environment, row);
  }

  return {
    accessToken: decryptConnectionAccessToken(row),
    connection: row
  };
}

export async function fetchEbayIdentity(environment: EbayEnvironment, accessToken: string) {
  const config = getEbayEnvironmentConfig(environment);
  try {
    const response = await fetchWithTimeout(
      `${config.identityBaseUrl}/user/`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        }
      },
      8_000
    );
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { userId?: string; username?: string; userName?: string };
    return {
      ebayUserId: payload.userId || null,
      ebayUsername: payload.username || payload.userName || null
    };
  } catch {
    return undefined;
  }
}

