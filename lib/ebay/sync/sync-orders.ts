import { getValidEbayUserAccessToken } from "@/lib/ebay/integration/user-token-manager";
import { ebayUserGet } from "@/lib/ebay/sync/ebay-api";
import { normalizeOrder, normalizeOrderLine } from "@/lib/ebay/sync/normalization";
import { existingKeySet, upsertSyncRows } from "@/lib/ebay/sync/sync-store";
import { selectRows } from "@/lib/supabase/client";
import type { EbayEnvironment } from "@/lib/ebay/integration/types";
import type { EbaySyncResult } from "@/lib/ebay/sync/types";

function creationDateFilter() {
  const end = new Date();
  const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return `creationdate:[${start.toISOString()}..${end.toISOString()}]`;
}

function lineKey(row: Record<string, unknown>) {
  return `${String(row.order_id || "")}:${String(row.line_item_id || "")}`;
}

export async function syncEbayOrders(environment: EbayEnvironment = "sandbox"): Promise<EbaySyncResult> {
  const { accessToken, connection } = await getValidEbayUserAccessToken(environment);
  const existingOrders = await existingKeySet("ebay_orders", connection.id, environment, "order_id");
  const existingLineRows = await selectRows<{ order_id: string; line_item_id: string }>(
    "ebay_order_lines",
    `select=order_id,line_item_id&ebay_connection_id=eq.${connection.id}&environment=eq.${environment}&deleted_at=is.null`
  );
  const existingLines = new Set(existingLineRows.map((row) => `${row.order_id}:${row.line_item_id}`));
  const limit = 50;
  let offset = 0;
  let pagesFetched = 0;
  let recordsReceived = 0;
  const orderRows: Array<Record<string, unknown>> = [];
  const lineRows: Array<Record<string, unknown>> = [];
  const warnings: string[] = [];

  for (let page = 0; page < 50; page += 1) {
    const payload = await ebayUserGet({
      environment,
      accessToken,
      api: "fulfillment",
      path: "/order",
      params: { limit, offset, filter: creationDateFilter() },
      marketplaceId: connection.marketplace_id
    });
    pagesFetched += 1;
    const orders = Array.isArray(payload.orders) ? payload.orders : [];
    recordsReceived += orders.length;
    for (const order of orders) {
      const normalized = normalizeOrder(order);
      if (!normalized.order_id) {
        warnings.push("Order skipped because orderId was missing.");
        continue;
      }
      orderRows.push({
        acv_user_id: connection.acv_user_id,
        ebay_connection_id: connection.id,
        environment,
        marketplace_id: connection.marketplace_id,
        ...normalized,
        last_seen_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      });
      for (const line of Array.isArray(order.lineItems) ? order.lineItems : []) {
        const normalizedLine = normalizeOrderLine(order, line);
        if (!normalizedLine.line_item_id) {
          warnings.push(`Line item skipped for order ${normalized.order_id} because lineItemId was missing.`);
          continue;
        }
        lineRows.push({
          acv_user_id: connection.acv_user_id,
          ebay_connection_id: connection.id,
          ebay_order_id: null,
          environment,
          marketplace_id: connection.marketplace_id,
          ...normalizedLine,
          last_seen_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString()
        });
      }
    }
    const total = typeof payload.total === "number" ? payload.total : undefined;
    offset += limit;
    if (!orders.length || (typeof total === "number" && offset >= total)) break;
  }

  await upsertSyncRows("ebay_orders", orderRows, "ebay_connection_id,environment,order_id");
  const savedOrders = await selectRows<{ id: string; order_id: string }>(
    "ebay_orders",
    `select=id,order_id&ebay_connection_id=eq.${connection.id}&environment=eq.${environment}&deleted_at=is.null`
  );
  const orderIdToId = new Map(savedOrders.map((order) => [order.order_id, order.id]));
  const linkedLineRows: Array<Record<string, unknown>> = lineRows
    .map((row) => ({
      ...row,
      ebay_order_id: orderIdToId.get(String(row.order_id)) || null
    }))
    .filter((row) => row.ebay_order_id);
  await upsertSyncRows("ebay_order_lines", linkedLineRows, "ebay_connection_id,environment,order_id,line_item_id");
  const insertedOrders = orderRows.filter((row) => !existingOrders.has(String(row.order_id))).length;
  const insertedLines = linkedLineRows.filter((row) => !existingLines.has(lineKey(row))).length;

  return {
    environment,
    type: "orders",
    status: "completed",
    pagesFetched,
    recordsReceived: orderRows.length + linkedLineRows.length,
    recordsInserted: insertedOrders + insertedLines,
    recordsUpdated: orderRows.length + linkedLineRows.length - insertedOrders - insertedLines,
    recordsUnchanged: 0,
    recordsFailed: warnings.length,
    warnings,
    message: `Synced ${orderRows.length} Sandbox eBay order${orderRows.length === 1 ? "" : "s"} and ${linkedLineRows.length} line item${linkedLineRows.length === 1 ? "" : "s"}.`
  };
}
