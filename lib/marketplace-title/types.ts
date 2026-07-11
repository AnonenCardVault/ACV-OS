export type MarketplaceKind = "ebay" | "compact" | "catalog";

export type MarketplaceTitleCatalogFacts = {
  providerName?: string;
  status?: string;
  confidence?: number;
  matchedCard?: string;
  matchedSet?: string;
  matchedProduct?: string;
  matchedSubset?: string | null;
  matchedNumber?: string;
  rarity?: string;
  setId?: string;
  setTotal?: number;
  printedTotal?: number;
  supertype?: string;
  subtypes?: string[];
  types?: string[];
};

export type MarketplaceTitleFacts = {
  cardTitle?: string;
  playerOrCharacter?: string;
  team?: string;
  sportCategory?: string;
  year?: string;
  brand?: string;
  setName?: string;
  cardNumber?: string;
  parallel?: string;
  serialNumber?: string;
  rookie?: boolean;
  auto?: boolean;
  relic?: boolean;
  variation?: boolean;
  grader?: string;
  grade?: string;
  catalog?: MarketplaceTitleCatalogFacts;
};

export type MarketplaceTitleResult = {
  ebayTitle: string;
  compactTitle: string;
  rawCatalogTitle: string;
  provider: "pokemon" | "sports" | "generic";
  characterCount: number;
  warnings: string[];
};
