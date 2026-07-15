import { getValidEbayUserAccessToken } from "@/lib/ebay/integration/user-token-manager";
import { ebayUserGet } from "@/lib/ebay/sync/ebay-api";
import { normalizeOffer } from "@/lib/ebay/sync/normalization";
import { existingKeySet, upsertSyncRows } from "@/lib/ebay/sync/sync-store";
import type { EbayEnvironment } from "@/lib/ebay/integration/types";
import type { EbaySyncResult } from "@/lib/ebay/sync/types";

export async function syncEbayOffers(environment: EbayEnvironment = "sandbox"): Promise<EbaySyncResult> {
  const { accessToken, connection } = await getValidEbayUserAccessToken(environment);
  const existing = await existingKeySet("ebay_offers", connection.id, environment, "offer_id");
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
      path: "/offer",
      params: { limit, offset, marketplace_id: connection.marketplace_id },
      marketplaceId: connection.marketplace_id
    });
    pagesFetched += 1;
    const offers = Array.isArray(payload.offers) ? payload.offers : [];
    recordsReceived += offers.length;
    for (const offer of offers) {
      const normalized = normalizeOffer(offer);
      if (!normalized.offer_id) {
        warnings.push("Offer skipped because offerId was missing.");
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
    if (!offers.length || (typeof total === "number" && offset >= total)) break;
  }

  await upsertSyncRows("ebay_offers", rows, "ebay_connection_id,environment,offer_id");
  const inserted = rows.filter((row) => !existing.has(String(row.offer_id))).length;

  return {
    environment,
    type: "offers",
    status: "completed",
    pagesFetched,
    recordsReceived,
    recordsInserted: inserted,
    recordsUpdated: rows.length - inserted,
    recordsUnchanged: 0,
    recordsFailed: warnings.length,
    warnings,
    message: `Synced ${rows.length} Sandbox eBay offer${rows.length === 1 ? "" : "s"}.`
  };
}

