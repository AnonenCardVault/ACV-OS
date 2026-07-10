import type { PricingEvidence, PricingProvider, PricingProviderContext, UniversalCardPricingProfile } from "@/lib/pricing/types";

function isPokemonCategory(profile: UniversalCardPricingProfile) {
  const category = `${profile.sportCategory || ""} ${profile.brand || ""}`.toLowerCase();
  return category.includes("pokemon") || category.includes("pokémon");
}

export class PokemonPricingProvider implements PricingProvider {
  id = "pokemon" as const;
  name = "Pokémon Pricing Provider";

  supports(profile: UniversalCardPricingProfile) {
    return isPokemonCategory(profile);
  }

  getEvidence(context: PricingProviderContext): PricingEvidence[] {
    if (!this.supports(context.profile)) return [];

    return [
      {
        providerId: this.id,
        providerName: this.name,
        evidenceType: "catalog_stub",
        label: "Future Pokémon pricing query",
        query: context.queries.pokemonQuery,
        notes: "Provider-ready stub for future JustTCG/TCG marketplace pricing. No paid API calls are made in v1.",
        createdAt: new Date().toISOString()
      }
    ];
  }
}
