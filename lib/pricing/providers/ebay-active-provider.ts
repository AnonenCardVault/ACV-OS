import type { PricingEvidence, PricingProvider, PricingProviderContext, UniversalCardPricingProfile } from "@/lib/pricing/types";

export class EbayActiveProvider implements PricingProvider {
  id = "ebay-active" as const;
  name = "eBay Active Provider";

  supports(_profile: UniversalCardPricingProfile) {
    return true;
  }

  getEvidence(context: PricingProviderContext): PricingEvidence[] {
    return [
      {
        providerId: this.id,
        providerName: this.name,
        evidenceType: "search_query",
        label: "Future eBay active listings query",
        query: context.queries.ebayQuery,
        notes: "Provider-ready stub. No eBay API calls are made in Pricing Engine v1.",
        createdAt: new Date().toISOString()
      }
    ];
  }
}
