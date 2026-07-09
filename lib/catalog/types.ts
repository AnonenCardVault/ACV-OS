import type { ExtractedCardFields } from "@/lib/ai/types";

export type CatalogValidationStatus = "matched" | "not_found" | "unavailable" | "skipped" | "disagreement";

export type CatalogValidationWarning = {
  code: string;
  message: string;
  severity: "info" | "warning";
};

export type CatalogMatchedCard = {
  name?: string;
  set?: string;
  setId?: string;
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
};

export type CatalogValidationResult = {
  providerId: string;
  providerName: string;
  category: string;
  status: CatalogValidationStatus;
  confidence: number;
  matchedCard?: CatalogMatchedCard;
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
