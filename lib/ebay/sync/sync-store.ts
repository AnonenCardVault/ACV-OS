import { insertRows, patchRows, selectRows, upsertRows } from "@/lib/supabase/client";
import type { EbaySyncType } from "@/lib/ebay/sync/types";
import type { EbayEnvironment, EbaySyncRunRow } from "@/lib/ebay/integration/types";

export async function startSyncRun({
  acvUserId,
  connectionId,
  environment,
  type
}: {
  acvUserId: string;
  connectionId: string;
  environment: EbayEnvironment;
  type: EbaySyncType;
}) {
  const [run] = await insertRows<EbaySyncRunRow>("ebay_sync_runs", [
    {
      acv_user_id: acvUserId,
      ebay_connection_id: connectionId,
      environment,
      sync_type: type,
      status: "running"
    }
  ]);
  return run;
}

export async function finishSyncRun(runId: string, values: Partial<EbaySyncRunRow> & { status: EbaySyncRunRow["status"] }) {
  const [run] = await patchRows<EbaySyncRunRow>(
    "ebay_sync_runs",
    `id=eq.${encodeURIComponent(runId)}`,
    {
      ...values,
      completed_at: new Date().toISOString()
    }
  );
  return run;
}

export async function existingKeySet(table: string, connectionId: string, environment: EbayEnvironment, column: string) {
  const rows = await selectRows<Record<string, string | null>>(
    table,
    `select=${column}&ebay_connection_id=eq.${connectionId}&environment=eq.${environment}&deleted_at=is.null`
  );
  return new Set(rows.map((row) => row[column]).filter(Boolean) as string[]);
}

export async function upsertSyncRows<T>(table: string, rows: Array<Record<string, unknown>>, conflict: string) {
  if (!rows.length) return [] as T[];
  return upsertRows<T>(table, rows, conflict);
}

