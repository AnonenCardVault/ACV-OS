import type { ExtractedCardFields } from "@/lib/ai/types";

export type CatalogValidationStatus = "matched" | "not_found" | "ambiguous" | "unavailable" | "skipped" | "disagreement";

export type CatalogValidationWarning = {
  code: string;
  message: string;
  severity: "info" | "warning";
};

export type CatalogMatchedCard = {
  name?: string;
  set?: string;
  setId?: string;
  sport?: string;
  year?: string;
  brand?: string;
  product?: string;
  subset?: string | null;
  team?: string | null;
  setTotal?: number;
  printedTotal?: number;
  setReleaseDate?: string;
  number?: string;
  rarity?: string;
  supertype?: string;
  subtypes?: string[];
  types?: string[];
  artist?: string;
  officialImages?: {
    small?: string;
    large?: string;
  };
  rookie?: boolean;
  auto?: boolean;
  relic?: boolean;
  sourceUrl?: string;
  sourceName?: string;
};

export type CatalogValidationResult = {
  providerId: string;
  providerName: string;
  category: string;
  status: CatalogValidationStatus;
  confidence: number;
  matchedCard?: CatalogMatchedCard;
  candidates?: CatalogMatchedCard[];
  candidateCount?: number;
  normalizedFields?: Partial<ExtractedCardFields>;
  warnings: CatalogValidationWarning[];
  evidence: string[];
};

export type CatalogValidationInput = {
  fields: ExtractedCardFields;
};

export interface CatalogProvider {
  id: string;
  name: string;
  supports(category: string): boolean;
  validate(input: CatalogValidationInput): Promise<CatalogValidationResult>;
}
