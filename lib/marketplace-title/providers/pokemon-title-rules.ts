import type { MarketplaceTitleFacts } from "@/lib/marketplace-title/types";

function clean(value: unknown) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  if (!text || text === "-" || normalized === "pending" || normalized === "pending manual review" || normalized === "unidentified card") return "";
  return text.replace(/\s+/g, " ");
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

function isNumeric(value: string) {
  return /^\d+$/.test(value);
}

function formatNumberPart(value: string, setTotal?: number) {
  const cleaned = clean(value).replace(/^#/, "");
  if (!cleaned) return "";
  const [leftRaw, rightRaw] = cleaned.split("/");
  const left = leftRaw.trim();
  const right = clean(rightRaw);
  const total = right || (setTotal ? String(setTotal) : "");

  if (total && isNumeric(left) && isNumeric(total)) {
    const width = Math.max(3, total.length);
    return `${left.padStart(width, "0")}/${total}`;
  }

  if (total) return `${left}/${total}`;
  return cleaned;
}

function supportedVariant(value: string) {
  const text = clean(value);
  if (!text) return "";
  const normalized = text.toLowerCase();
  const supported = ["holo", "reverse holo", "full art", "secret rare", "ultra rare"];
  return supported.some((item) => normalized.includes(item)) ? text : "";
}

function hasUltraPokemonSubtype(facts: MarketplaceTitleFacts, name: string, rarity: string) {
  const subtypeText = [...(facts.catalog?.subtypes || []), name, rarity].join(" ");
  return /(^|\s)(vmax|vstar|gx|ex|v)(\s|$)/i.test(subtypeText);
}

function marketplaceRarity(facts: MarketplaceTitleFacts, name: string) {
  const rarity = clean(facts.catalog?.rarity);
  if (!rarity) return "";

  const normalized = rarity.toLowerCase();
  const ultraSubtype = hasUltraPokemonSubtype(facts, name, rarity);
  if (ultraSubtype && normalized.includes("rare holo")) return "Ultra Rare Holo";
  if (ultraSubtype && normalized.includes("rare") && !normalized.includes("ultra rare")) return "Ultra Rare";

  return rarity.replace(/\b(VMAX|VSTAR|GX|EX|V)\b/g, "").replace(/\bex\b/g, "").replace(/\s+/g, " ").trim();
}

function trimPokemonTitle(fullParts: string[], rarity: string, variant: string) {
  const attempts = [
    fullParts,
    fullParts.filter((part) => part !== "Card"),
    fullParts.filter((part) => part !== "Pokemon" && part !== "Card"),
    fullParts.filter((part) => part !== variant),
    fullParts.filter((part) => part !== variant && part !== "Card"),
    fullParts.filter((part) => part !== variant && part !== rarity),
    fullParts.filter((part) => part !== variant && part !== rarity && part !== "Card")
  ];

  for (const parts of attempts) {
    const title = uniqueParts(parts).join(" ").trim();
    if (title.length <= 80) return title;
  }

  const fallback = uniqueParts(fullParts.filter((part) => part !== "Card")).join(" ").trim();
  return fallback.length <= 80 ? fallback : fallback.slice(0, 80).replace(/\s+\S*$/, "").trim();
}

export function buildPokemonEbayTitle(facts: MarketplaceTitleFacts) {
  const setTotal = facts.catalog?.printedTotal || facts.catalog?.setTotal;
  const name = clean(facts.catalog?.matchedCard) || clean(facts.playerOrCharacter) || clean(facts.cardTitle) || "Pokemon Card";
  const number = formatNumberPart(clean(facts.cardNumber) || clean(facts.catalog?.matchedNumber), setTotal);
  const setName = clean(facts.catalog?.matchedSet) || clean(facts.setName);
  const rarity = marketplaceRarity(facts, name);
  const candidateVariant = supportedVariant(clean(facts.parallel));
  const variant =
    candidateVariant && (!rarity || (!rarity.toLowerCase().includes(candidateVariant.toLowerCase()) && !candidateVariant.toLowerCase().includes(rarity.toLowerCase())))
      ? candidateVariant
      : "";
  const fullParts = [name, number, setName, rarity, variant, "Pokemon", "Card"].filter(Boolean);
  const ebayTitle = trimPokemonTitle(fullParts, rarity, variant);
  const rawCatalogTitle = uniqueParts([name, number, setName].filter(Boolean)).join(" ").trim() || ebayTitle;
  const compactTitle = trimPokemonTitle([name, number, setName, "Pokemon"].filter(Boolean), "", "");

  return {
    ebayTitle,
    compactTitle,
    rawCatalogTitle,
    warnings: ebayTitle.length > 80 ? ["Pokemon title exceeded 80 characters and was compacted."] : []
  };
}
