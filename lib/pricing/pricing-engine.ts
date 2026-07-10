import { EbayActiveProvider } from "@/lib/pricing/providers/ebay-active-provider";
import { ManualPricingProvider } from "@/lib/pricing/providers/manual-pricing-provider";
import { PokemonPricingProvider } from "@/lib/pricing/providers/pokemon-pricing-provider";
import type { ManualPricingInput, PricingProvider, PricingRecommendation, PricingSearchQueries, UniversalCardPricingProfile } from "@/lib/pricing/types";

const providers: PricingProvider[] = [new ManualPricingProvider(), new EbayActiveProvider(), new PokemonPricingProvider()];

function clean(value: unknown) {
  const text = String(value || "").trim();
  if (!text || text === "-" || text.toLowerCase() === "raw") return "";
  return text.replace(/\s+/g, " ");
}

function cardNumber(value?: string) {
  const text = clean(value);
  if (!text) return "";
  return text.startsWith("#") ? text : `#${text}`;
}

function uniqueParts(parts: string[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPokemonProfile(profile: UniversalCardPricingProfile) {
  const category = `${profile.sportCategory || ""} ${profile.brand || ""}`.toLowerCase();
  return category.includes("pokemon") || category.includes("pokémon");
}

function titleFallback(profile: UniversalCardPricingProfile) {
  return clean(profile.cardTitle) || clean(profile.playerOrCharacter) || clean(profile.sku);
}

function sportsQuery(profile: UniversalCardPricingProfile) {
  return uniqueParts([
    clean(profile.year),
    clean(profile.brand),
    clean(profile.setName),
    clean(profile.playerOrCharacter) || clean(profile.cardTitle),
    clean(profile.team),
    clean(profile.parallel),
    cardNumber(profile.cardNumber),
    profile.rookie ? "RC" : "",
    profile.auto ? "Auto" : "",
    profile.relic ? "Relic" : "",
    clean(profile.serialNumber),
    clean(profile.grader),
    clean(profile.grade)
  ]).join(" ");
}

function pokemonQuery(profile: UniversalCardPricingProfile) {
  return uniqueParts([
    clean(profile.playerOrCharacter) || clean(profile.cardTitle),
    cardNumber(profile.cardNumber),
    clean(profile.setName),
    clean(profile.parallel),
    clean(profile.grade),
    "Pokemon Card"
  ]).join(" ");
}

export function generatePricingSearchQueries(profile: UniversalCardPricingProfile): PricingSearchQueries {
  const compactQuery = uniqueParts([
    titleFallback(profile),
    cardNumber(profile.cardNumber),
    clean(profile.parallel)
  ]).join(" ");
  const sports = sportsQuery(profile);
  const pokemon = pokemonQuery(profile);
  const baseQuery = isPokemonProfile(profile) ? pokemon : sports || compactQuery;

  return {
    sportsQuery: sports || compactQuery,
    pokemonQuery: pokemon || compactQuery,
    ebayQuery: uniqueParts([baseQuery, "sold completed active"]).join(" "),
    compactQuery
  };
}

export function buildPricingRecommendation(profile: UniversalCardPricingProfile, manualInput?: ManualPricingInput): PricingRecommendation {
  const queries = generatePricingSearchQueries(profile);
  const context = { profile, queries, manualInput };
  const evidence = providers.flatMap((provider) => (provider.supports(profile) ? provider.getEvidence(context) : []));
  const marketValue = manualInput?.estimatedValue || 0;
  const targetSalePrice = manualInput?.targetSalePrice || marketValue;
  const floorPrice = manualInput?.floorPrice || 0;
  const manualValues = [manualInput?.estimatedValue, manualInput?.targetSalePrice, manualInput?.floorPrice].filter((value) => Number(value) > 0).length;
  const noteBonus = manualInput?.notes?.trim() ? 8 : 0;
  const providerBonus = evidence.filter((item) => item.evidenceType !== "manual_estimate").length > 0 ? 10 : 0;
  const pricingConfidence = Math.min(86, manualValues > 0 ? 38 + manualValues * 10 + noteBonus + providerBonus : providerBonus);

  return {
    profile,
    queries,
    marketValue,
    targetSalePrice,
    floorPrice,
    pricingConfidence,
    lastUpdated: new Date().toISOString(),
    evidence,
    notes: [
      "Pricing Engine v1 generated query/evidence scaffolding only.",
      "Manual values are operator-entered and require review before marketplace changes."
    ]
  };
}
