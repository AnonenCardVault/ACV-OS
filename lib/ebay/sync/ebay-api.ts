import { getEbayEnvironmentConfig } from "@/lib/ebay/integration/config";
import type { EbayEnvironment } from "@/lib/ebay/integration/types";

const apiTimeoutMs = 15_000;

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function ebayUserGet({
  environment,
  accessToken,
  api,
  path,
  params,
  marketplaceId
}: {
  environment: EbayEnvironment;
  accessToken: string;
  api: "inventory" | "fulfillment";
  path: string;
  params?: Record<string, string | number | undefined>;
  marketplaceId: string;
}) {
  const config = getEbayEnvironmentConfig(environment);
  const base = api === "inventory" ? config.sellInventoryBaseUrl : config.sellFulfillmentBaseUrl;
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const startedAt = Date.now();
  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId
    }
  });
  const raw = await response.text();
  if (process.env.NODE_ENV !== "production") {
    console.info("[ACV eBay Sync] request", {
      environment,
      api,
      path,
      status: response.status,
      latencyMs: Date.now() - startedAt
    });
  }
  if (!response.ok) {
    throw new Error(`eBay ${api} API failed (${response.status}): ${raw.slice(0, 800)}`);
  }
  return raw ? JSON.parse(raw) : {};
}

