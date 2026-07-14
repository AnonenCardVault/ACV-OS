import { getEbayEnvironmentConfig } from "@/lib/ebay/integration/config";
import { getEbayApplicationToken, getEbayOAuthTokenSummary } from "@/lib/ebay/integration/oauth-manager";
import type { EbayConnectionTestResult, EbayEnvironment, EbayEnvironmentSummary } from "@/lib/ebay/integration/types";

const connectionTestMemory = new Map<EbayEnvironment, Pick<EbayEnvironmentSummary, "connectionStatus" | "lastConnectionTestAt" | "lastLatencyMs" | "message">>();
const browseTimeoutMs = 10_000;

function classifyError(error: unknown): EbayConnectionTestResult["errorCategory"] {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Missing eBay")) return "missing_credentials";
  if (message.includes("Production eBay connection tests are disabled")) return "production_disabled";
  if (message.includes("OAuth failed (401)") || message.includes("OAuth failed (403")) return "invalid_credentials";
  if (message.includes("OAuth failed")) return "oauth_failure";
  if (message.includes("aborted") || message.includes("AbortError")) return "network_timeout";
  if (message.includes("Browse API failed")) return "api_unavailable";
  return "unknown";
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "eBay connection test failed.";
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

export function getEbayIntegrationSummaries(): EbayEnvironmentSummary[] {
  return (["sandbox", "production"] as const).map((environment) => {
    const config = getEbayEnvironmentConfig(environment);
    const oauth = getEbayOAuthTokenSummary(environment);
    const memory = connectionTestMemory.get(environment);
    const productionDisabled = environment === "production" && !config.productionCallsAllowed;
    const connectionStatus = memory?.connectionStatus || (config.configured && !productionDisabled ? "not_configured" : "not_configured");
    const message =
      memory?.message ||
      (config.configured
        ? productionDisabled
          ? "Production credentials can be configured, but production connection tests are disabled for this Sandbox phase."
          : `${config.label} credentials are configured. Run a connection test when ready.`
        : `Missing ${config.label} credentials: ${config.missing.join(", ") || "unknown"}.`);

    return {
      environment,
      label: config.label,
      configured: config.configured,
      marketplaceId: config.marketplaceId,
      connectionStatus,
      oauth,
      lastConnectionTestAt: memory?.lastConnectionTestAt,
      lastLatencyMs: memory?.lastLatencyMs,
      message,
      productionCallsAllowed: config.productionCallsAllowed
    };
  });
}

export async function testEbayConnection(environment: EbayEnvironment, options: { forceRefresh?: boolean } = {}): Promise<EbayConnectionTestResult> {
  const config = getEbayEnvironmentConfig(environment);
  const startedAt = Date.now();

  try {
    if (!config.configured) {
      throw new Error(`Missing eBay ${config.label} credentials: ${config.missing.join(", ")}`);
    }
    if (environment === "production" && !config.productionCallsAllowed) {
      throw new Error("Production eBay connection tests are disabled for this Sandbox phase.");
    }

    const token = await getEbayApplicationToken(environment, { forceRefresh: options.forceRefresh });
    const url = new URL(`${config.browseBaseUrl}/item_summary/search`);
    url.searchParams.set("q", "baseball card");
    url.searchParams.set("limit", "1");

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "X-EBAY-C-MARKETPLACE-ID": config.marketplaceId,
          Accept: "application/json"
        }
      },
      browseTimeoutMs
    );

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Browse API failed (${response.status}): ${raw.slice(0, 600)}`);
    }

    const payload = JSON.parse(raw) as {
      total?: number;
      itemSummaries?: Array<{ title?: string }>;
    };
    const latencyMs = Date.now() - startedAt;
    const lastConnectionTestAt = new Date().toISOString();
    const result: EbayConnectionTestResult = {
      environment,
      connectionStatus: "connected",
      oauthStatus: "valid",
      marketplaceId: config.marketplaceId,
      latencyMs,
      tokenExpiresAt: new Date(token.expiresAt).toISOString(),
      tokenAcquiredAt: token.acquiredAt,
      lastConnectionTestAt,
      resultCount: typeof payload.total === "number" ? payload.total : payload.itemSummaries?.length || 0,
      sampleItemTitle: payload.itemSummaries?.[0]?.title || null,
      message: `${config.label} connection test succeeded.`
    };

    connectionTestMemory.set(environment, {
      connectionStatus: "connected",
      lastConnectionTestAt,
      lastLatencyMs: latencyMs,
      message: result.message
    });

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const lastConnectionTestAt = new Date().toISOString();
    const result: EbayConnectionTestResult = {
      environment,
      connectionStatus: "failed",
      oauthStatus: getEbayOAuthTokenSummary(environment).status,
      marketplaceId: config.marketplaceId,
      latencyMs,
      lastConnectionTestAt,
      errorCategory: classifyError(error),
      message: safeMessage(error)
    };

    connectionTestMemory.set(environment, {
      connectionStatus: "failed",
      lastConnectionTestAt,
      lastLatencyMs: latencyMs,
      message: result.message
    });

    return result;
  }
}

