import { buildPokemonEbayTitle } from "@/lib/marketplace-title/providers/pokemon-title-rules";
import { buildSportsEbayTitle } from "@/lib/marketplace-title/providers/sports-title-rules";
import type { MarketplaceTitleFacts, MarketplaceTitleResult } from "@/lib/marketplace-title/types";

function clean(value: unknown) {
  return String(value || "").trim();
}

function categoryKey(facts: MarketplaceTitleFacts) {
  return [facts.sportCategory, facts.brand, facts.catalog?.providerName].map((value) => clean(value).toLowerCase()).join(" ");
}

function isPokemon(facts: MarketplaceTitleFacts) {
  const key = categoryKey(facts);
  return key.includes("pokemon") || key.includes("pokémon");
}

function isSports(facts: MarketplaceTitleFacts) {
  const key = categoryKey(facts);
  return ["baseball", "football", "basketball", "hockey", "soccer", "ufc", "racing", "wrestling"].some((category) => key.includes(category));
}

function genericTitle(facts: MarketplaceTitleFacts): MarketplaceTitleResult {
  const title = [facts.year, facts.brand, facts.setName, facts.playerOrCharacter, facts.cardNumber ? `#${facts.cardNumber.replace(/^#/, "")}` : ""]
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .trim();
  const ebayTitle = title || clean(facts.cardTitle) || "Untitled card";

  return {
    ebayTitle: ebayTitle.length <= 80 ? ebayTitle : ebayTitle.slice(0, 80).replace(/\s+\S*$/, "").trim(),
    compactTitle: ebayTitle,
    rawCatalogTitle: ebayTitle,
    provider: "generic",
    characterCount: ebayTitle.length,
    warnings: ebayTitle.length > 80 ? ["Generic title exceeded 80 characters and was compacted."] : []
  };
}

export function buildEbayMarketplaceTitle(facts: MarketplaceTitleFacts): MarketplaceTitleResult {
  if (isPokemon(facts)) {
    const result = buildPokemonEbayTitle(facts);
    return {
      ...result,
      provider: "pokemon",
      characterCount: result.ebayTitle.length
    };
  }

  if (isSports(facts)) {
    const result = buildSportsEbayTitle(facts);
    return {
      ...result,
      provider: "sports",
      characterCount: result.ebayTitle.length
    };
  }

  return genericTitle(facts);
}
