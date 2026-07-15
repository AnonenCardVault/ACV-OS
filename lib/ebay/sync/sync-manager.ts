import { getEbayConnection, markEbayConnectionError } from "@/lib/ebay/integration/connection-store";
import type { EbayEnvironment } from "@/lib/ebay/integration/types";
import { syncEbayInventoryItems } from "@/lib/ebay/sync/sync-inventory-items";
import { syncEbayOffers } from "@/lib/ebay/sync/sync-offers";
import { syncEbayOrders } from "@/lib/ebay/sync/sync-orders";
import { finishSyncRun, startSyncRun } from "@/lib/ebay/sync/sync-store";
import type { EbaySyncResult, EbaySyncType } from "@/lib/ebay/sync/types";

type SyncRunner = (environment: EbayEnvironment) => Promise<EbaySyncResult>;

const runners: Record<Exclude<EbaySyncType, "everything">, SyncRunner> = {
  inventory_items: syncEbayInventoryItems,
  offers: syncEbayOffers,
  orders: syncEbayOrders
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "eBay sync failed.";
}

function emptyFailedResult(environment: EbayEnvironment, type: EbaySyncType, message: string): EbaySyncResult {
  return {
    environment,
    type,
    status: "failed",
    pagesFetched: 0,
    recordsReceived: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsUnchanged: 0,
    recordsFailed: 1,
    warnings: [message],
    message
  };
}

async function markReauthorizationIfNeeded(environment: EbayEnvironment, message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("insufficient") || lower.includes("scope") || lower.includes("(401)") || lower.includes("(403)")) {
    await markEbayConnectionError(environment, "reauthorization_required", "eBay authorization needs to be refreshed with the required read-only seller scopes.");
  }
}

function aggregateResults(environment: EbayEnvironment, type: EbaySyncType, subResults: EbaySyncResult[]): EbaySyncResult {
  const failed = subResults.filter((result) => result.status === "failed").length;
  const partial = subResults.some((result) => result.status === "partial_success") || (failed > 0 && failed < subResults.length);
  const status = failed === subResults.length ? "failed" : partial ? "partial_success" : "completed";
  const warnings = subResults.flatMap((result) => result.warnings);

  return {
    environment,
    type,
    status,
    pagesFetched: subResults.reduce((total, result) => total + result.pagesFetched, 0),
    recordsReceived: subResults.reduce((total, result) => total + result.recordsReceived, 0),
    recordsInserted: subResults.reduce((total, result) => total + result.recordsInserted, 0),
    recordsUpdated: subResults.reduce((total, result) => total + result.recordsUpdated, 0),
    recordsUnchanged: subResults.reduce((total, result) => total + result.recordsUnchanged, 0),
    recordsFailed: subResults.reduce((total, result) => total + result.recordsFailed, 0),
    warnings,
    message:
      status === "completed"
        ? "Sandbox eBay sync completed."
        : status === "partial_success"
          ? "Sandbox eBay sync completed with warnings."
          : "Sandbox eBay sync failed.",
    subResults
  };
}

export async function runEbaySync(type: EbaySyncType, environment: EbayEnvironment = "sandbox"): Promise<EbaySyncResult> {
  if (environment !== "sandbox") {
    throw new Error("Production seller sync is disabled. This phase only supports eBay Sandbox.");
  }

  const connection = await getEbayConnection(environment);
  if (!connection || connection.connection_status !== "connected") {
    throw new Error("Connect a Sandbox eBay account before syncing.");
  }

  const run = await startSyncRun({
    acvUserId: connection.acv_user_id,
    connectionId: connection.id,
    environment,
    type
  });

  try {
    const result =
      type === "everything"
        ? aggregateResults(
            environment,
            type,
            await Promise.all(
              (["inventory_items", "offers", "orders"] as const).map(async (syncType) => {
                try {
                  return await runners[syncType](environment);
                } catch (error) {
                  const message = errorMessage(error);
                  await markReauthorizationIfNeeded(environment, message);
                  return emptyFailedResult(environment, syncType, message);
                }
              })
            )
          )
        : await runners[type](environment);

    const finishedRun = await finishSyncRun(run.id, {
      status: result.status,
      pages_fetched: result.pagesFetched,
      records_received: result.recordsReceived,
      records_inserted: result.recordsInserted,
      records_updated: result.recordsUpdated,
      records_unchanged: result.recordsUnchanged,
      records_failed: result.recordsFailed,
      warning_count: result.warnings.length,
      warnings: result.warnings,
      error_summary: result.status === "failed" ? result.message : null
    });

    return {
      ...result,
      syncRunId: finishedRun.id
    };
  } catch (error) {
    const message = errorMessage(error);
    await markReauthorizationIfNeeded(environment, message);
    await finishSyncRun(run.id, {
      status: "failed",
      records_failed: 1,
      warning_count: 1,
      warnings: [message],
      error_summary: message
    });
    return {
      ...emptyFailedResult(environment, type, message),
      syncRunId: run.id
    };
  }
}
