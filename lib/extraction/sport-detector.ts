import type { BrandDictionaryMatches, CardExtractionInput, ExtractedCardFields } from "@/lib/extraction/types";

const categorySignals: Record<string, string[]> = {
  Football: ["patriots", "chargers", "texans", "drake maye", "maye", "cj stroud", "stroud", "justin herbert", "herbert", "panini", "prizm", "phoenix"],
  Baseball: ["yankees", "dodgers", "twins", "angels", "ohtani", "shohei", "topps", "bowman"],
  Basketball: ["lakers", "celtics", "wembanyama", "spurs", "doncic", "lebron"],
  Hockey: ["upper deck", "young guns", "oilers", "maple leafs"],
  Soccer: ["soccer", "fifa", "premier league", "topps chrome soccer"],
  UFC: ["ufc"],
  Racing: ["nascar", "racing"],
  Wrestling: ["wwe", "wrestling"],
  Pokemon: ["charizard", "pikachu", "pokemon"],
  TCG: ["magic", "yu-gi-oh", "one piece", "lorcana"]
};

function textFromInput(input: CardExtractionInput, detectedText: string) {
  const existing = input.existingFields;
  return [
    detectedText,
    input.categoryHint,
    existing?.cardTitle,
    existing?.playerOrCharacter,
    existing?.team,
    existing?.sportCategory,
    existing?.brand,
    existing?.set,
    ...input.images.flatMap((image) => [image.fileName, image.label, image.role])
  ]
    .join(" ")
    .toLowerCase();
}

export function detectSportCategory({
  input,
  detectedText,
  dictionaryMatches
}: {
  input: CardExtractionInput;
  detectedText: string;
  dictionaryMatches: BrandDictionaryMatches;
}): { category: string; confidence: number; reasons: string[] } {
  const text = textFromInput(input, detectedText);
  const scores = Object.entries(categorySignals).map(([category, signals]) => {
    const hits = signals.filter((signal) => text.includes(signal));
    return { category, hits, score: hits.length };
  });
  const best = scores.sort((a, b) => b.score - a.score)[0];
  const existing = input.existingFields?.sportCategory || input.categoryHint || "";

  if (best?.score > 0) {
    return {
      category: best.category,
      confidence: Math.min(96, 66 + best.score * 8),
      reasons: best.hits
    };
  }

  if (dictionaryMatches.tcgBrands.length > 0) {
    const category = dictionaryMatches.tcgBrands.includes("Pokemon") ? "Pokemon" : "TCG";
    return { category, confidence: 82, reasons: dictionaryMatches.tcgBrands };
  }

  if (dictionaryMatches.sportsCategories.length > 0) {
    return { category: dictionaryMatches.sportsCategories[0], confidence: 84, reasons: dictionaryMatches.sportsCategories };
  }

  if (existing) {
    return { category: existing, confidence: 58, reasons: ["existing form value"] };
  }

  return { category: "Other", confidence: 35, reasons: ["no category signal"] };
}

export function mergeDetectedCategory(fields: Partial<ExtractedCardFields>, category: string) {
  return { ...fields, sportCategory: fields.sportCategory || category };
}
