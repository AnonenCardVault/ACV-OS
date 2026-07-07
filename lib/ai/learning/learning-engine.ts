import type { AIExtractionInput, AILearningCorrection, AILearningEvent, AIProviderOutput, ExtractedCardFields } from "@/lib/ai/types";

export function createLearningEvent({
  input,
  providerOutputs,
  corrections = [],
  eventType = "extraction_completed"
}: {
  input: AIExtractionInput;
  providerOutputs: AIProviderOutput[];
  corrections?: AILearningCorrection[];
  eventType?: AILearningEvent["eventType"];
}): AILearningEvent {
  return {
    eventType,
    batchId: input.batchId,
    groupId: input.groupId,
    imageIds: input.images.map((image) => image.id),
    providerVersions: Object.fromEntries(providerOutputs.map((output) => [output.providerId, output.providerVersion])),
    providerMetadata: Object.fromEntries(providerOutputs.map((output) => [output.providerId, output.metadata])),
    corrections,
    createdAt: new Date().toISOString()
  };
}

export function detectCorrections({
  predicted,
  corrected,
  providerOutputs
}: {
  predicted: Partial<ExtractedCardFields>;
  corrected: Partial<ExtractedCardFields>;
  providerOutputs: AIProviderOutput[];
}): AILearningCorrection[] {
  return Object.keys(corrected).flatMap((field) => {
    const key = field as keyof ExtractedCardFields;
    if (predicted[key] === corrected[key]) return [];

    return {
      field: key,
      predictedValue: predicted[key],
      correctedValue: corrected[key],
      providerIds: providerOutputs.filter((output) => Object.prototype.hasOwnProperty.call(output.fields, key)).map((output) => output.providerId),
      correctedAt: new Date().toISOString()
    };
  });
}
