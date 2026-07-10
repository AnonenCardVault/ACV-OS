import type { PricingEvidence, PricingProvider, PricingProviderContext, UniversalCardPricingProfile } from "@/lib/pricing/types";

export class ManualPricingProvider implements PricingProvider {
  id = "manual" as const;
  name = "Manual Pricing Provider";

  supports(_profile: UniversalCardPricingProfile) {
    return true;
  }

  getEvidence(context: PricingProviderContext): PricingEvidence[] {
    const input = context.manualInput;
    if (!input) return [];

    const createdAt = new Date().toISOString();

    return [
      {
        providerId: this.id,
        providerName: this.name,
        evidenceType: "manual_estimate",
        label: "Estimated market value",
        value: input.estimatedValue,
        notes: input.notes,
        createdAt
      },
      {
        providerId: this.id,
        providerName: this.name,
        evidenceType: "manual_estimate",
        label: "Target sale price",
        value: input.targetSalePrice,
        notes: input.notes,
        createdAt
      },
      {
        providerId: this.id,
        providerName: this.name,
        evidenceType: "manual_estimate",
        label: "Floor price",
        value: input.floorPrice,
        notes: input.notes,
        createdAt
      }
    ];
  }
}
