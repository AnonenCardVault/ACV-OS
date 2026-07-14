import { getEbayEnvironmentConfig, getEbayOAuthScope } from "@/lib/ebay/integration/config";
import type { EbayCachedApplicationToken, EbayEnvironment, EbayOAuthTokenSummary } from "@/lib/ebay/integration/types";

const tokenCache = new Map<EbayEnvironment, EbayCachedApplicationToken>();
const pendingTokenRequests = new Map<EbayEnvironment, Promise<EbayCachedApplicationToken>>();
const refreshSkewMs = 5 * 60 * 1000;
const oauthTimeoutMs = 10_000;

function devLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV eBay OAuth] ${message}`, payload || {});
  }
}

function isUsableToken(token?: EbayCachedApplicationToken) {
  return Boolean(token && token.expiresAt - refreshSkewMs > Date.now());
}

function safeErrorDetail(detail: string) {
  return detail.replace(/["']?access_token["']?\s*:\s*["'][^"']+["']/gi, '"access_token":"[redacted]"').slice(0, 600);
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

async function requestApplicationToken(environment: EbayEnvironment): Promise<EbayCachedApplicationToken> {
  const config = getEbayEnvironmentConfig(environment);
  if (!config.configured) {
    throw new Error(`Missing eBay ${config.label} credentials: ${config.missing.join(", ")}`);
  }
  if (environment === "production" && !config.productionCallsAllowed) {
    throw new Error("Production eBay connection tests are disabled for this phase.");
  }

  const scope = getEbayOAuthScope();
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", scope);

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const startedAt = Date.now();
  const response = await fetchWithTimeout(
    config.oauthUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    oauthTimeoutMs
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`eBay OAuth failed (${response.status}): ${safeErrorDetail(raw)}`);
  }

  const parsed = JSON.parse(raw) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  if (!parsed.access_token || !parsed.expires_in) {
    throw new Error("eBay OAuth response did not include a usable application token.");
  }

  const token: EbayCachedApplicationToken = {
    accessToken: parsed.access_token,
    tokenType: parsed.token_type || "Application Access Token",
    environment,
    expiresAt: Date.now() + parsed.expires_in * 1000,
    acquiredAt: new Date().toISOString(),
    scope
  };
  tokenCache.set(environment, token);
  devLog("application token acquired", {
    environment,
    latencyMs: Date.now() - startedAt,
    expiresAt: new Date(token.expiresAt).toISOString()
  });
  return token;
}

export async function getEbayApplicationToken(environment: EbayEnvironment, options: { forceRefresh?: boolean } = {}) {
  const cached = tokenCache.get(environment);
  if (!options.forceRefresh && isUsableToken(cached)) return cached as EbayCachedApplicationToken;

  const pending = pendingTokenRequests.get(environment);
  if (pending && !options.forceRefresh) return pending;

  const request = requestApplicationToken(environment).finally(() => pendingTokenRequests.delete(environment));
  pendingTokenRequests.set(environment, request);
  return request;
}

export function getEbayOAuthTokenSummary(environment: EbayEnvironment): EbayOAuthTokenSummary {
  const token = tokenCache.get(environment);
  if (!token) {
    return {
      status: "missing",
      cached: false
    };
  }

  const expiresInSeconds = Math.max(0, Math.floor((token.expiresAt - Date.now()) / 1000));
  return {
    status: isUsableToken(token) ? "valid" : "expired",
    tokenType: token.tokenType,
    acquiredAt: token.acquiredAt,
    expiresAt: new Date(token.expiresAt).toISOString(),
    expiresInSeconds,
    cached: true
  };
}

