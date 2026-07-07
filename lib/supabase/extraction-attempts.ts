import { getOrCreateAcvUser, insertRows, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ExtractionAttemptRow } from "@/lib/supabase/types";

export async function logExtractionAttempt({
  batchId,
  groupId,
  provider,
  model,
  status,
  confidence,
  warnings,
  metadata
}: {
  batchId?: string;
  groupId?: string;
  provider: string;
  model?: string;
  status: string;
  confidence?: number;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}) {
  if (!isSupabaseConfigured()) return null;

  const user = await getOrCreateAcvUser();
  const [attempt] = await insertRows<ExtractionAttemptRow>("extraction_attempts", [
    {
      user_id: user.id,
      batch_id: batchId || null,
      group_id: groupId || null,
      provider,
      model: model || null,
      status,
      confidence: typeof confidence === "number" ? confidence : null,
      warnings: warnings || [],
      metadata: metadata || {}
    }
  ]);

  return attempt;
}
