export { diffExtractionResults, diffProviderMetadata, prepareImagesForExtraction, replayExtraction, runAIExtraction } from "@/lib/ai/orchestrator";
export { createDefaultAIProviders, providerEnvironmentSummary, type AIProviderEnvironment } from "@/lib/ai/providers";
export { calculateAIConfidence } from "@/lib/ai/confidence";
export { createLearningEvent, detectCorrections, MemoryLearningStore, type LearningStore } from "@/lib/ai/learning";
export type {
  AIDecision,
  AIExtractionInput,
  AIExtractionFieldDiff,
  AIExtractionLog,
  AIExtractionReplayRequest,
  AIExtractionReplayResult,
  AIExtractionResult,
  AIExtractionStatus,
  AIFieldConfidenceMap,
  AIFieldKey,
  AIImageInput,
  AIImageProcessingResult,
  AIImageRole,
  AILearningCorrection,
  AILearningEvent,
  AIProvider,
  AIProviderContext,
  AIProviderCostTier,
  AIProviderKind,
  AIProviderOutput,
  AIProviderRunMetadata,
  AIProviderStatus,
  AIWarning,
  CardSightProvider,
  ChecklistProvider,
  DecisionEngineConfig,
  ExtractedCardFields,
  GPTVisionProvider,
  MockProvider,
  OCRProvider
} from "@/lib/ai/types";
