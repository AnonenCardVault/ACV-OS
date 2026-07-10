import type { CatalogValidationResult } from "@/lib/catalog/types";
import type { AIImageInput, AIProviderOutput, ExtractedCardFields } from "@/lib/ai/types";

export type ParallelRecognitionStatus = "confirmed" | "recommended" | "ambiguous" | "unsupported" | "not_found" | "skipped";

export type ParallelEvidenceSource =
  | "cardsight"
  | "gpt"
  | "catalog"
  | "serial"
  | "visual"
  | "learned"
  | "user_confirmed";

export type ParallelEvidence = {
  source: ParallelEvidenceSource;
  label: string;
  value?: string;
  confidence?: number;
  detail?: string;
  providerName?: string;
};

export type SerialParallelEvidence = {
  rawSerialNumber?: string;
  denominator?: number;
  detail?: string;
};

export type ParallelCandidate = {
  rawLabel: string;
  normalizedLabel: string;
  officialCatalogLabel?: string;
  confidence: number;
  catalogSupported?: boolean;
  serialSupported?: boolean;
  evidence: ParallelEvidence[];
  warnings: string[];
};

export type LearnedParallelCorrection = {
  originalPrediction?: string;
  confirmedParallel: string;
  productContext?: {
    sportCategory?: string;
    year?: string;
    brand?: string;
    set?: string;
    cardNumber?: string;
    playerOrCharacter?: string;
  };
  providerOutputs?: Record<string, unknown>;
  imageRefs?: string[];
  correctedAt: string;
};

export type ParallelRecognitionInput = {
  fields: ExtractedCardFields;
  images: AIImageInput[];
  providerOutputs?: AIProviderOutput[];
  catalogValidation?: CatalogValidationResult;
  learnedCorrections?: LearnedParallelCorrection[];
  userConfirmedParallel?: string;
};

export type ParallelProviderResult = {
  providerId: string;
  providerName: string;
  candidates: ParallelCandidate[];
  evidence: ParallelEvidence[];
  warnings: string[];
};

export interface ParallelProvider {
  id: string;
  name: string;
  analyze(input: ParallelRecognitionInput): ParallelProviderResult;
}

export type ParallelRecognitionResult = {
  status: ParallelRecognitionStatus;
  recommendedParallel?: string;
  rawProviderLabel?: string;
  normalizedParallel?: string;
  officialCatalogLabel?: string;
  finalConfirmedParallel?: string;
  confidence?: number;
  catalogSupported?: boolean;
  userConfirmed?: boolean;
  serialEvidence?: SerialParallelEvidence;
  candidates: ParallelCandidate[];
  evidence: ParallelEvidence[];
  warnings: string[];
};
