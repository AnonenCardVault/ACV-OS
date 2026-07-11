import { patchRows, selectRows, upsertRows } from "@/lib/supabase/client";
import type { ImageRow } from "@/lib/supabase/types";

function imageDevLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV Supabase Images] ${message}`, payload || {});
  }
}

function isUniqueConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("23505") || message.includes("duplicate key value") || message.includes("images_storage_unique");
}

function storageQuery(row: Record<string, unknown>) {
  return `storage_bucket=eq.${encodeURIComponent(String(row.storage_bucket || ""))}&storage_path=eq.${encodeURIComponent(String(row.storage_path || ""))}`;
}

async function findImageByStoragePath(row: Record<string, unknown>) {
  const [existing] = await selectRows<ImageRow>("images", `select=*&${storageQuery(row)}&limit=1`);
  return existing;
}

async function upsertImageByStoragePath(row: Record<string, unknown>) {
  const [saved] = await upsertRows<ImageRow>("images", [row], "storage_bucket,storage_path");
  return saved;
}

async function saveSingleImageMetadata(row: Record<string, unknown>) {
  if (!row.storage_bucket || !row.storage_path) return null;

  try {
    const saved = await upsertImageByStoragePath(row);
    imageDevLog("image metadata upserted", {
      imageId: saved?.id,
      bucket: row.storage_bucket,
      path: row.storage_path
    });
    return saved || null;
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;

    const existing = await findImageByStoragePath(row);
    if (!existing) throw error;

    const [updated] = await patchRows<ImageRow>("images", `id=eq.${encodeURIComponent(existing.id)}`, row);
    imageDevLog("duplicate image metadata reused", {
      imageId: updated?.id || existing.id,
      bucket: row.storage_bucket,
      path: row.storage_path
    });
    return updated || existing;
  }
}

export async function saveImageMetadataRows(rows: Array<Record<string, unknown>>) {
  const saved: ImageRow[] = [];

  for (const row of rows) {
    const next = await saveSingleImageMetadata(row);
    if (next) saved.push(next);
  }

  return saved;
}
