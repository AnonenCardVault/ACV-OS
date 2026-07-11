import type { MarketplaceTitleFacts } from "@/lib/marketplace-title/types";

function clean(value: unknown) {
  const text = String(value || "").trim();
  const normalized = text.toLowerCase();
  if (!text || text === "-" || normalized === "pending" || normalized === "pending manual review" || normalized === "unidentified card") return "";
  return text.replace(/\s+/g, " ");
}

function withoutDuplicateParts(parts: string[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cardNumber(value: string) {
  const text = clean(value).replace(/^#/, "");
  return text ? `#${text}` : "";
}

function includesPart(value: string, part: string) {
  const source = value.toLowerCase();
  const target = part.toLowerCase();
  return Boolean(source && target && source.includes(target));
}

function gradedLabel(facts: MarketplaceTitleFacts) {
  const grader = clean(facts.grader);
  const grade = clean(facts.grade);
  if (!grader || !grade || grader.toLowerCase() === "raw" || grade.toLowerCase() === "raw") return "";
  return `${grader} ${grade}`;
}

function trimSportsTitle(parts: string[], team: string) {
  const attempts = [
    parts,
    team ? parts.filter((part) => part !== team) : parts,
    parts.filter((part) => !part.startsWith("SN ")),
    parts.filter((part) => part !== "Relic"),
    parts.filter((part) => part !== "Auto")
  ];

  for (const attempt of attempts) {
    const title = withoutDuplicateParts(attempt).join(" ").trim();
    if (title.length <= 80) return title;
  }

  const fallback = withoutDuplicateParts(parts).join(" ").trim();
  return fallback.length <= 80 ? fallback : fallback.slice(0, 80).replace(/\s+\S*$/, "").trim();
}

export function buildSportsEbayTitle(facts: MarketplaceTitleFacts) {
  const player = clean(facts.playerOrCharacter) || clean(facts.cardTitle);
  const includeTeam = !player;
  const team = includeTeam ? clean(facts.team) : "";
  const serial = clean(facts.serialNumber);
  const catalogProduct = clean(facts.catalog?.matchedProduct);
  const catalogSubset = clean(facts.catalog?.matchedSubset);
  const setName = catalogProduct || clean(facts.setName);
  const insertOrParallel = catalogSubset || clean(facts.parallel);
  const safeParallel = insertOrParallel && !includesPart(setName, insertOrParallel) ? insertOrParallel : "";
  const parts = [
    clean(facts.year),
    clean(facts.brand),
    setName,
    safeParallel,
    player,
    team,
    facts.rookie ? "RC" : "",
    cardNumber(clean(facts.cardNumber)),
    facts.auto ? "Auto" : "",
    facts.relic ? "Relic" : "",
    serial ? `SN ${serial}` : "",
    gradedLabel(facts)
  ].filter(Boolean);
  const ebayTitle = trimSportsTitle(parts, team);
  const rawCatalogTitle = withoutDuplicateParts([clean(facts.year), clean(facts.brand), setName, safeParallel, player, cardNumber(clean(facts.cardNumber))].filter(Boolean)).join(" ").trim() || ebayTitle;
  const compactTitle = withoutDuplicateParts([clean(facts.year), clean(facts.brand), player, cardNumber(clean(facts.cardNumber))].filter(Boolean)).join(" ").trim() || ebayTitle;

  return {
    ebayTitle,
    compactTitle,
    rawCatalogTitle,
    warnings: ebayTitle.length > 80 ? ["Sports title exceeded 80 characters and was compacted."] : []
  };
}
