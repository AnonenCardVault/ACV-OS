import type { CatalogValidationResult } from "@/lib/catalog/types";
import type { ParallelRecognitionResult } from "@/lib/parallel-recognition/types";

export type AIImageRole =
  | "Front"
  | "Back"
  | "Detail / Closeup"
  | "Serial Closeup"
  | "Holo / Surface"
  | "Auto Closeup"
  | "Patch / Relic Closeup"
  | "Other";

export type AIImageInput = {
  id: string;
  role: AIImageRole | string;
  fileName: string;
  label?: string;
  url?: string;
  dataUrl?: string;
  order?: number;
  needsReupload?: boolean;
};

export type ExtractedCardFields = {
  cardTitle: string;
  playerOrCharacter: string;
  team: string;
  sportCategory: string;
  year: string;
  brand: string;
  set: string;
  cardNumber: string;
  parallel: string;
  serialNumber: string;
  rookie: boolean;
  auto: boolean;
  relic: boolean;
  variation: boolean;
  grader: string;
  grade: string;
  conditionNotes: string;
  uncertaintyNotes: string;
};

export type AIFieldKey = keyof ExtractedCardFields | "suggestedTitle" | "manufacturer" | "product" | "condition" | "overall";

export type AIFieldConfidenceMap = Partial<Record<AIFieldKey, number>>;

export type AIWarning = {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
  field?: AIFieldKey;
  providerId?: string;
};

export type AIExtractionStatus = "Ready to Approve" | "Needs Review" | "Needs Research" | "Blocked" | "Failed" | "Retake Image";

export type AIExtractionInput = {
  images: AIImageInput[];
  categoryHint?: string;
  existingFields?: Partial<ExtractedCardFields>;
  batchId?: string;
  groupId?: string;
};

export type AIProviderKind = "ocr" | "cardsight" | "gpt-vision" | "checklist" | "mock";

export type AIProviderStatus = "available" | "configured-disabled" | "mock" | "unavailable";

export type AIProviderCostTier = "free" | "local" | "paid";

export type AIImageQualityStatus = "good" | "usable" | "poor";

export type AIImageProcessingResult = {
  selectedImageIds: string[];
  frontImageId?: string;
  backImageId?: string;
  qualityScore: number;
  qualityStatus: AIImageQualityStatus;
  retakeRequired: boolean;
  reasons: string[];
};

export type AIProviderContext = {
  runId: string;
  startedAt: string;
  imageProcessing: AIImageProcessingResult;
  ocrText: string;
  providerOutputs: AIProviderOutput[];
  decisionTrace: AIDecision[];
};

export type AIProviderRunMetadata = {
  providerName: string;
  providerVersion: string;
  modelName: string;
  promptVersion: string;
  timestamp: string;
  providerConfidence: number;
  costTier: AIProviderCostTier;
};

export type AIProviderOutput = {
  providerId: string;
  providerKind: AIProviderKind;
  providerLabel: string;
  providerVersion: string;
  modelName: string;
  promptVersion: string;
  timestamp: string;
  providerConfidence: number;
  costTier: AIProviderCostTier;
  status: "success" | "skipped" | "failed";
  elapsedMs: number;
  fields: Partial<ExtractedCardFields>;
  fieldConfidence: AIFieldConfidenceMap;
  warnings: AIWarning[];
  evidence: string[];
  metadata: AIProviderRunMetadata;
  raw?: Record<string, unknown>;
};

export interface AIProvider {
  id: string;
  kind: AIProviderKind;
  label: string;
  version: string;
  modelName: string;
  promptVersion: string;
  costTier: AIProviderCostTier;
  status: AIProviderStatus;
  extract(input: AIExtractionInput, context: AIProviderContext): Promise<AIProviderOutput>;
}

export interface OCRProvider extends AIProvider {
  kind: "ocr";
}

export interface CardSightProvider extends AIProvider {
  kind: "cardsight";
}

export interface GPTVisionProvider extends AIProvider {
  kind: "gpt-vision";
}

export interface ChecklistProvider extends AIProvider {
  kind: "checklist";
}

export interface MockProvider extends AIProvider {
  kind: "mock";
}

export type DecisionRoute = "continue" | "run-additional-provider" | "manual-review" | "blocked" | "retake-image" | "skip-provider";

export type AIDecision = {
  stage: string;
  route: DecisionRoute;
  reason: string;
  thresholdKey?: keyof DecisionEngineConfig;
  confidence?: number;
};

export type DecisionEngineConfig = {
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  poorImageQuality: number;
  localRulesSufficientConfidence: number;
  cardSightChecklistSkipGptConfidence: number;
  gptVerificationRequiredBelow: number;
  fieldAgreementBonus: number;
  fieldConflictPenalty: number;
};

export type FieldVote = {
  field: AIFieldKey;
  value: unknown;
  confidence: number;
  providerId: string;
  providerKind: AIProviderKind;
};

export type AIConfidenceReport = {
  overall: number;
  fieldConfidence: AIFieldConfidenceMap;
  fieldVotes: FieldVote[];
  warnings: AIWarning[];
  status: AIExtractionStatus;
};

export type AILearningCorrection = {
  field: AIFieldKey;
  predictedValue: unknown;
  correctedValue: unknown;
  providerIds: string[];
  correctedAt: string;
};

export type AILearningEvent = {
  eventType: "extraction_completed" | "user_correction" | "approval" | "rejection" | "research";
  batchId?: string;
  groupId?: string;
  imageIds: string[];
  providerVersions: Record<string, string>;
  providerMetadata: Record<string, AIProviderRunMetadata>;
  corrections: AILearningCorrection[];
  createdAt: string;
};

export type AIExtractionLog = {
  runId: string;
  batchId?: string;
  groupId?: string;
  providersUsed: string[];
  elapsedMs: number;
  confidence: number;
  imageProcessing: AIImageProcessingResult;
  providerMetadata: AIProviderRunMetadata[];
  providerOutputs: AIProviderOutput[];
  warnings: AIWarning[];
  finalValues: ExtractedCardFields;
  corrections: AILearningCorrection[];
};

export type AIExtractionResult = ExtractedCardFields & {
  confidence: number;
  fieldConfidence: AIFieldConfidenceMap;
  warnings: AIWarning[];
  suggestedTitle: string;
  extractionStatus: AIExtractionStatus;
  extractionSources: string[];
  providersUsed: string[];
  providerOutputs: AIProviderOutput[];
  catalogValidation?: CatalogValidationResult;
  parallelRecognition?: ParallelRecognitionResult;
  decisionTrace: AIDecision[];
  learningEvent: AILearningEvent;
  log: AIExtractionLog;
};

export type AIExtractionReplayRequest = {
  previousResult: AIExtractionResult;
  input: AIExtractionInput;
  useNewestProviders?: boolean;
};

export type AIExtractionFieldDiff = {
  field: keyof ExtractedCardFields;
  previousValue: unknown;
  nextValue: unknown;
  previousConfidence?: number;
  nextConfidence?: number;
};

export type AIExtractionReplayResult = {
  previousResult: AIExtractionResult;
  nextResult: AIExtractionResult;
  diffs: AIExtractionFieldDiff[];
  providerChanges: Array<{
    providerId: string;
    previous?: AIProviderRunMetadata;
    next?: AIProviderRunMetadata;
  }>;
};
