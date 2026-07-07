import type { AIExtractionInput, AIExtractionLog, AIImageProcessingResult, AILearningCorrection, AIProviderOutput, ExtractedCardFields, AIWarning } from "@/lib/ai/types";

export function createExtractionLog({
  runId,
  input,
  startedAt,
  providerOutputs,
  confidence,
  imageProcessing,
  warnings,
  finalValues,
  corrections = []
}: {
  runId: string;
  input: AIExtractionInput;
  startedAt: number;
  providerOutputs: AIProviderOutput[];
  confidence: number;
  imageProcessing: AIImageProcessingResult;
  warnings: AIWarning[];
  finalValues: ExtractedCardFields;
  corrections?: AILearningCorrection[];
}): AIExtractionLog {
  return {
    runId,
    batchId: input.batchId,
    groupId: input.groupId,
    providersUsed: providerOutputs.map((output) => output.providerId),
    elapsedMs: Date.now() - startedAt,
    confidence,
    imageProcessing,
    providerMetadata: providerOutputs.map((output) => output.metadata),
    providerOutputs,
    warnings,
    finalValues,
    corrections
  };
}
