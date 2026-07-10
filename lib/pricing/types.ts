export type PricingProviderId = "manual" | "ebay-active" | "pokemon";

export type UniversalCardPricingProfile = {
  sku: string;
  cardTitle: string;
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
  grader?: string;
  grade?: string;
};

export type PricingSearchQueries = {
  sportsQuery: string;
  pokemonQuery: string;
  ebayQuery: string;
  compactQuery: string;
};

export type ManualPricingInput = {
  estimatedValue: number;
  targetSalePrice: number;
  floorPrice: number;
  notes: string;
};

export type PricingEvidence = {
  providerId: PricingProviderId;
  providerName: string;
  evidenceType: "manual_estimate" | "search_query" | "active_listing_stub" | "catalog_stub";
  label: string;
  value?: number;
  query?: string;
  notes?: string;
  confidence?: number;
  createdAt: string;
};

export type PricingRecommendation = {
  profile: UniversalCardPricingProfile;
  queries: PricingSearchQueries;
  marketValue: number;
  targetSalePrice: number;
  floorPrice: number;
  pricingConfidence: number;
  lastUpdated: string;
  evidence: PricingEvidence[];
  notes: string[];
};

export type PricingProviderContext = {
  profile: UniversalCardPricingProfile;
  queries: PricingSearchQueries;
  manualInput?: ManualPricingInput;
};

export interface PricingProvider {
  id: PricingProviderId;
  name: string;
  supports(profile: UniversalCardPricingProfile): boolean;
  getEvidence(context: PricingProviderContext): PricingEvidence[];
}
