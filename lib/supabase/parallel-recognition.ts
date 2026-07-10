import type { ApprovedInventoryItem } from "@/lib/acv-local-state";
import { getOrCreateAcvUser, insertRows } from "@/lib/supabase/client";
import type { ParallelRecognitionEventRow } from "@/lib/supabase/types";

function confidenceToStored(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
}

export async function logParallelRecognitionEvent({
  profileId,
  item
}: {
  profileId: string;
  item: ApprovedInventoryItem;
}) {
  const recognition = item.parallelRecognition;
  const confirmedParallel = item.proposed.parallel || "";
  if (!recognition && !confirmedParallel) return;

  const user = await getOrCreateAcvUser();
  await insertRows<ParallelRecognitionEventRow>("parallel_recognition_events", [
    {
      user_id: user.id,
      universal_card_profile_id: profileId,
      sku: item.sku,
      original_prediction: recognition?.rawProviderLabel || recognition?.recommendedParallel || null,
      normalized_prediction: recognition?.normalizedParallel || null,
      confirmed_parallel: confirmedParallel || null,
      recognition_status: recognition?.status || (confirmedParallel ? "confirmed" : "not_found"),
      parallel_confidence: confidenceToStored(recognition?.confidence),
      provider_outputs: {},
      evidence: recognition?.evidence || [],
      candidates: recognition?.candidates || [],
      warnings: recognition?.warnings || [],
      product_context: {
        sportCategory: item.proposed.category,
        year: item.proposed.year,
        brand: item.proposed.brand,
        set: item.proposed.set,
        cardNumber: item.proposed.cardNumber,
        playerOrCharacter: item.proposed.playerCharacter
      },
      image_refs: item.images.map((image) => ({
        id: image.supabaseImageId || image.id,
        role: image.role,
        storageBucket: image.storageBucket,
        storagePath: image.storagePath
      })),
      created_by: "acv-local-review"
    }
  ]);
}
