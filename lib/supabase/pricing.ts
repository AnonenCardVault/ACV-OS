import type { PricingRecommendation } from "@/lib/pricing";
import { getOrCreateAcvUser, insertRows, patchRows, selectRows, upsertRows } from "@/lib/supabase/client";
import { insertAuditEvent } from "@/lib/supabase/cards";
import type { InventoryRow, PricingEvidenceRow, PricingRow, UniversalCardProfileRow } from "@/lib/supabase/types";

async function findProfileBySku(sku: string) {
  const user = await getOrCreateAcvUser();
  const [profile] = await selectRows<UniversalCardProfileRow>("universal_card_profiles", `select=*&user_id=eq.${user.id}&sku=eq.${encodeURIComponent(sku)}&deleted_at=is.null&limit=1`);
  return { user, profile };
}

export async function loadPricingSummaryBySku(sku: string) {
  const { user, profile } = await findProfileBySku(sku);
  if (!profile) return { pricing: null, evidence: [] as PricingEvidenceRow[] };

  const [pricing] = await selectRows<PricingRow>("pricing", `select=*&user_id=eq.${user.id}&universal_card_profile_id=eq.${profile.id}&deleted_at=is.null&limit=1`);
  let evidence: PricingEvidenceRow[] = [];

  try {
    evidence = await selectRows<PricingEvidenceRow>("pricing_evidence", `select=*&user_id=eq.${user.id}&universal_card_profile_id=eq.${profile.id}&deleted_at=is.null&order=created_at.desc&limit=12`);
  } catch {
    evidence = [];
  }

  return { pricing: pricing || null, evidence };
}

export async function savePricingRecommendation(recommendation: PricingRecommendation) {
  const { user, profile } = await findProfileBySku(recommendation.profile.sku);
  if (!profile) throw new Error(`Universal Card Profile not found for ${recommendation.profile.sku}.`);

  const [pricing] = await upsertRows<PricingRow>(
    "pricing",
    [
      {
        user_id: user.id,
        universal_card_profile_id: profile.id,
        market_value: recommendation.marketValue,
        sold_median: 0,
        active_low: 0,
        suggested_price: recommendation.targetSalePrice,
        pricing_confidence: recommendation.pricingConfidence,
        comp_summary: {
          engine: "Pricing Engine v1",
          queries: recommendation.queries,
          floorPrice: recommendation.floorPrice,
          notes: recommendation.notes,
          evidenceCount: recommendation.evidence.length
        },
        last_priced_at: recommendation.lastUpdated
      }
    ],
    "user_id,universal_card_profile_id"
  );

  await patchRows<InventoryRow>("inventory", `universal_card_profile_id=eq.${profile.id}`, {
    market_value: recommendation.marketValue,
    listed_price: recommendation.targetSalePrice,
    workflow_status: "Needs Draft"
  });

  let evidenceSaved = false;
  try {
    await insertRows<PricingEvidenceRow>(
      "pricing_evidence",
      recommendation.evidence.map((evidence) => ({
        user_id: user.id,
        universal_card_profile_id: profile.id,
        pricing_id: pricing.id,
        provider: evidence.providerName,
        evidence_type: evidence.evidenceType,
        label: evidence.label,
        value: evidence.value ?? null,
        query: evidence.query || null,
        url: null,
        notes: evidence.notes || null,
        confidence: evidence.confidence ?? null,
        evidence_payload: evidence
      }))
    );
    evidenceSaved = true;
  } catch {
    evidenceSaved = false;
  }

  await insertAuditEvent({
    profileId: profile.id,
    type: "pricing.manual_saved",
    summary: `Manual pricing saved: ${recommendation.profile.sku}`,
    payload: {
      sku: recommendation.profile.sku,
      marketValue: recommendation.marketValue,
      targetSalePrice: recommendation.targetSalePrice,
      floorPrice: recommendation.floorPrice,
      confidence: recommendation.pricingConfidence,
      evidenceSaved
    }
  });

  return { pricing, evidenceSaved };
}
