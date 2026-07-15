import { getValidEbayUserAccessToken } from "@/lib/ebay/integration/user-token-manager";
import { ebayUserGet } from "@/lib/ebay/sync/ebay-api";
import { normalizeInventoryItem } from "@/lib/ebay/sync/normalization";
import { existingKeySet, upsertSyncRows } from "@/lib/ebay/sync/sync-store";
import type { EbaySyncResult } from "@/lib/ebay/sync/types";
import type { EbayEnvironment } from "@/lib/ebay/integration/types";

export async function syncEbayInventoryItems(environment: EbayEnvironment = "sandbox"): Promise<EbaySyncResult> {
  const { accessToken, connection } = await getValidEbayUserAccessToken(environment);
  const existing = await existingKeySet("ebay_inventory_items", connection.id, environment, "sku");
  const limit = 100;
  let offset = 0;
  let pagesFetched = 0;
  let recordsReceived = 0;
  const rows: Array<Record<string, unknown>> = [];
  const warnings: string[] = [];

  for (let page = 0; page < 50; page += 1) {
    const payload = await ebayUserGet({
      environment,
      accessToken,
      api: "inventory",
      path: "/inventory_item",
      params: { limit, offset },
      marketplaceId: connection.marketplace_id
    });
    pagesFetched += 1;
    const items = Array.isArray(payload.inventoryItems) ? payload.inventoryItems : [];
    recordsReceived += items.length;
    for (const item of items) {
      const normalized = normalizeInventoryItem(item);
      if (!normalized.sku) {
        warnings.push("Inventory item skipped because SKU was missing.");
        continue;
      }
      rows.push({
        acv_user_id: connection.acv_user_id,
        ebay_connection_id: connection.id,
        environment,
        marketplace_id: connection.marketplace_id,
        ...normalized,
        last_seen_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      });
    }
    const total = typeof payload.total === "number" ? payload.total : undefined;
    offset += limit;
    if (!items.length || (typeof total === "number" && offset >= total)) break;
  }

  await upsertSyncRows("ebay_inventory_items", rows, "ebay_connection_id,environment,sku");
  const inserted = rows.filter((row) => !existing.has(String(row.sku))).length;

  return {
    environment,
    type: "inventory_items",
    status: "completed",
    pagesFetched,
    recordsReceived,
    recordsInserted: inserted,
    recordsUpdated: rows.length - inserted,
    recordsUnchanged: 0,
    recordsFailed: warnings.length,
    warnings,
    message: `Synced ${rows.length} Sandbox eBay inventory item${rows.length === 1 ? "" : "s"}.`
  };
}

