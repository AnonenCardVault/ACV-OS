import type { BrandDictionaryMatches } from "@/lib/extraction/types";

export const sportsBrands = [
  "Topps",
  "Bowman",
  "Panini",
  "Donruss",
  "Prizm",
  "Mosaic",
  "Select",
  "Optic",
  "Phoenix",
  "Absolute",
  "Certified",
  "National Treasures",
  "Flawless",
  "Immaculate",
  "Contenders",
  "Upper Deck",
  "Leaf",
  "Wild Card",
  "Sage"
];

export const sportsCategories = ["Baseball", "Football", "Basketball", "Hockey", "Soccer", "UFC", "Racing", "Wrestling"];

export const tcgBrands = ["Pokemon", "Magic", "Yu-Gi-Oh!", "One Piece", "Lorcana"];

export const brandDictionary = {
  sportsBrands,
  sportsCategories,
  tcgBrands
} as const;

function includesTerm(text: string, term: string) {
  return text.toLowerCase().includes(term.toLowerCase());
}

export function matchBrandDictionary(text: string): BrandDictionaryMatches {
  const sportsBrandMatches = sportsBrands.filter((term) => includesTerm(text, term));
  const sportsCategoryMatches = sportsCategories.filter((term) => includesTerm(text, term));
  const pokemonPattern = new RegExp("pok[e\\u00e9]mon", "i");
  const tcgMatches = tcgBrands.filter((term) => includesTerm(text, term) || (term === "Pokemon" && pokemonPattern.test(text)));

  return {
    sportsBrands: sportsBrandMatches,
    sportsCategories: sportsCategoryMatches,
    tcgBrands: tcgMatches,
    matchedTerms: [...sportsBrandMatches, ...sportsCategoryMatches, ...tcgMatches]
  };
}
