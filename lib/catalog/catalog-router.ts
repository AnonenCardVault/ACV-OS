import type { CatalogProvider } from "@/lib/catalog/types";
import { PokemonCatalogProvider, SportsCatalogProvider } from "@/lib/catalog/providers";

const providers: CatalogProvider[] = [new PokemonCatalogProvider(), new SportsCatalogProvider()];

function normalizeCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function catalogCategory(fields: { sportCategory?: string; brand?: string; set?: string; cardTitle?: string; playerOrCharacter?: string }) {
  const haystack = [fields.sportCategory, fields.brand, fields.set, fields.cardTitle, fields.playerOrCharacter].map((value) => normalizeCategory(String(value || ""))).join(" ");

  if (/\bpokemon\b/.test(haystack) || /\bpokémon\b/.test(haystack)) return "Pokemon";
  if (/\bfootball\b/.test(haystack)) return "Football";
  if (/\bbaseball\b/.test(haystack)) return "Baseball";
  if (/\bbasketball\b/.test(haystack)) return "Basketball";
  return fields.sportCategory || "";
}

export function catalogProviderForCategory(category: string) {
  return providers.find((provider) => provider.supports(category));
}
