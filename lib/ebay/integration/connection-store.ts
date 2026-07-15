import { getEbayEnvironmentConfig } from "@/lib/ebay/integration/config";
import { decryptEbayToken, encryptEbayToken, isEbayTokenEncryptionConfigured } from "@/lib/ebay/integration/token-crypto";
import type { EbayConnectionRow, EbayEnvironment, EbayOAuthStatus, EbaySyncRunRow, EbaySyncSummary } from "@/lib/ebay/integration/types";
import { getOrCreateAcvUser, patchRows, selectRows, upsertRows } from "@/lib/supabase/client";

function nowIso() {
  return new Date().toISOString();
}

function oauthStatus(row?: EbayConnectionRow): EbayOAuthStatus | "reauthorization_required" {
  if (!row || row.connection_status === "disconnected") return "missing";
  if (row.connection_status === "reauthorization_required") return "reauthorization_required";
  if (!row.access_token_encrypted || !row.access_token_expires_at) return "missing";
  return new Date(row.access_token_expires_at).getTime() > Date.now() ? "valid" : "expired";
}

async function selectConnection(environment: EbayEnvironment) {
  const user = await getOrCreateAcvUser();
  const [row] = await selectRows<EbayConnectionRow>(
    "ebay_connections",
    `select=*&acv_user_id=eq.${user.id}&environment=eq.${environment}&deleted_at=is.null&limit=1`
  );
  return row;
}

export async function getEbayConnection(environment: EbayEnvironment) {
  return selectConnection(environment);
}

export function decryptConnectionAccessToken(row: EbayConnectionRow) {
  if (!row.access_token_encrypted) throw new Error("eBay connection is missing an access token.");
  return decryptEbayToken(row.access_token_encrypted);
}

export function decryptConnectionRefreshToken(row: EbayConnectionRow) {
  if (!row.refresh_token_encrypted) throw new Error("eBay connection is missing a refresh token.");
  return decryptEbayToken(row.refresh_token_encrypted);
}

export async function upsertEbayConnectionFromToken({
  environment,
  token,
  identity
}: {
  environment: EbayEnvironment;
  token: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    refreshTokenExpiresIn?: number;
    scopes: string[];
  };
  identity?: {
    ebayUserId?: string | null;
    ebayUsername?: string | null;
  };
}) {
  if (!isEbayTokenEncryptionConfigured()) {
    throw new Error("Token encryption is not configured. Set EBAY_TOKEN_ENCRYPTION_SECRET or ACV_TOKEN_ENCRYPTION_SECRET.");
  }

  const user = await getOrCreateAcvUser();
  const config = getEbayEnvironmentConfig(environment);
  const existing = await selectConnection(environment);
  const now = Date.now();
  const payload = {
    acv_user_id: user.id,
    environment,
    marketplace_id: config.marketplaceId,
    ebay_user_id: identity?.ebayUserId || existing?.ebay_user_id || null,
    ebay_username: identity?.ebayUsername || existing?.ebay_username || null,
    access_token_encrypted: encryptEbayToken(token.accessToken),
    refresh_token_encrypted: token.refreshToken ? encryptEbayToken(token.refreshToken) : existing?.refresh_token_encrypted || null,
    access_token_expires_at: new Date(now + token.expiresIn * 1000).toISOString(),
    refresh_token_expires_at: token.refreshTokenExpiresIn
      ? new Date(now + token.refreshTokenExpiresIn * 1000).toISOString()
      : existing?.refresh_token_expires_at || null,
    scopes: token.scopes,
    connection_status: "connected",
    last_connected_at: existing?.last_connected_at || nowIso(),
    last_refreshed_at: nowIso(),
    last_error: null
  };
  const [row] = await upsertRows<EbayConnectionRow>("ebay_connections", [payload], "acv_user_id,environment");
  return row;
}

export async function markEbayConnectionError(environment: EbayEnvironment, status: "failed" | "reauthorization_required", message: string) {
  const row = await selectConnection(environment);
  if (!row) return undefined;
  const [updated] = await patchRows<EbayConnectionRow>(
    "ebay_connections",
    `id=eq.${encodeURIComponent(row.id)}`,
    {
      connection_status: status,
      last_error: message,
      access_token_encrypted: status === "reauthorization_required" ? null : row.access_token_encrypted
    }
  );
  return updated;
}

export async function disconnectEbayConnection(environment: EbayEnvironment) {
  const row = await selectConnection(environment);
  if (!row) return undefined;
  const [updated] = await patchRows<EbayConnectionRow>(
    "ebay_connections",
    `id=eq.${encodeURIComponent(row.id)}`,
    {
      connection_status: "disconnected",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      last_error: null
    }
  );
  return updated;
}

async function rows<T>(table: string, query: string) {
  try {
    return await selectRows<T>(table, query);
  } catch {
    return [] as T[];
  }
}

function latestRunDate(runs: EbaySyncRunRow[], type: EbaySyncRunRow["sync_type"]) {
  return runs.find((run) => run.sync_type === type && run.status !== "running")?.completed_at || null;
}

function emptySyncSummary(coverageNote: string): EbaySyncSummary {
  return {
    connected: false,
    counts: {
      inventoryItems: 0,
      offers: 0,
      unpublishedOffers: 0,
      publishedOffers: 0,
      activeListings: 0,
      orders: 0,
      orderLines: 0
    },
    lastSync: {},
    coverageNote
  };
}

export async function getEbaySyncSummary(environment: EbayEnvironment = "sandbox"): Promise<EbaySyncSummary> {
  let connection: EbayConnectionRow | undefined;
  try {
    connection = await selectConnection(environment);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ACV eBay Sync] summary unavailable", {
        environment,
        message: error instanceof Error ? error.message : "Unknown Supabase error"
      });
    }
    return emptySyncSummary("eBay Sandbox sync tables are not available yet. Apply the latest Supabase migration before connecting a Sandbox seller account.");
  }
  if (!connection || connection.connection_status === "disconnected") {
    return emptySyncSummary("No Sandbox account is connected yet.");
  }

  const [inventoryItems, offers, orders, orderLines, runs] = await Promise.all([
    rows<{ id: string }>("ebay_inventory_items", `select=id&ebay_connection_id=eq.${connection.id}&environment=eq.${environment}&deleted_at=is.null`),
    rows<{ id: string; offer_status: string | null; listing_id: string | null }>("ebay_offers", `select=id,offer_status,listing_id&ebay_connection_id=eq.${connection.id}&environment=eq.${environment}&deleted_at=is.null`),
    rows<{ id: string }>("ebay_orders", `select=id&ebay_connection_id=eq.${connection.id}&environment=eq.${environment}&deleted_at=is.null`),
    rows<{ id: string }>("ebay_order_lines", `select=id&ebay_connection_id=eq.${connection.id}&environment=eq.${environment}&deleted_at=is.null`),
    rows<EbaySyncRunRow>("ebay_sync_runs", `select=*&ebay_connection_id=eq.${connection.id}&environment=eq.${environment}&deleted_at=is.null&order=started_at.desc&limit=25`)
  ]);

  const publishedOffers = offers.filter((offer) => Boolean(offer.listing_id) || String(offer.offer_status || "").toUpperCase() === "PUBLISHED").length;
  const unpublishedOffers = offers.length - publishedOffers;

  return {
    connected: true,
    connection: {
      id: connection.id,
      environment: connection.environment,
      marketplaceId: connection.marketplace_id,
      ebayUserId: connection.ebay_user_id,
      ebayUsername: connection.ebay_username,
      status: connection.connection_status,
      oauthStatus: oauthStatus(connection),
      accessTokenExpiresAt: connection.access_token_expires_at,
      refreshTokenExpiresAt: connection.refresh_token_expires_at,
      lastConnectedAt: connection.last_connected_at,
      lastRefreshedAt: connection.last_refreshed_at,
      lastError: connection.last_error
    },
    counts: {
      inventoryItems: inventoryItems.length,
      offers: offers.length,
      unpublishedOffers,
      publishedOffers,
      activeListings: offers.filter((offer) => Boolean(offer.listing_id)).length,
      orders: orders.length,
      orderLines: orderLines.length
    },
    lastSync: {
      inventoryItems: latestRunDate(runs, "inventory_items"),
      offers: latestRunDate(runs, "offers"),
      orders: latestRunDate(runs, "orders"),
      everything: latestRunDate(runs, "everything")
    },
    latestRun: runs[0],
    coverageNote: "Active Listings count is based on published Inventory API offers with listing IDs. Seller Hub drafts and legacy listings created outside the Inventory API may require a future adapter."
  };
}
