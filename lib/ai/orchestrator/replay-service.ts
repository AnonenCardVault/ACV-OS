import { runAIExtraction } from "@/lib/ai/orchestrator/ai-orchestrator";
import type { AIExtractionFieldDiff, AIExtractionReplayRequest, AIExtractionReplayResult, AIExtractionResult, ExtractedCardFields } from "@/lib/ai/types";

const replayFields: Array<keyof ExtractedCardFields> = [
  "cardTitle",
  "playerOrCharacter",
  "team",
  "sportCategory",
  "year",
  "brand",
  "set",
  "cardNumber",
  "parallel",
  "serialNumber",
  "rookie",
  "auto",
  "relic",
  "variation",
  "grader",
  "grade",
  "conditionNotes",
  "uncertaintyNotes"
];

export function diffExtractionResults(previousResult: AIExtractionResult, nextResult: AIExtractionResult): AIExtractionFieldDiff[] {
  return replayFields.flatMap((field) => {
    const previousValue = previousResult[field];
    const nextValue = nextResult[field];
    if (previousValue === nextValue) return [];

    return {
      field,
      previousValue,
      nextValue,
      previousConfidence: previousResult.fieldConfidence[field],
      nextConfidence: nextResult.fieldConfidence[field]
    };
  });
}

export function diffProviderMetadata(previousResult: AIExtractionResult, nextResult: AIExtractionResult) {
  const previousById = new Map(previousResult.log.providerMetadata.map((item) => [item.providerName, item]));
  const nextById = new Map(nextResult.log.providerMetadata.map((item) => [item.providerName, item]));
  const providerIds = Array.from(new Set([...previousById.keys(), ...nextById.keys()]));

  return providerIds.flatMap((providerId) => {
    const previous = previousById.get(providerId);
    const next = nextById.get(providerId);
    if (
      previous?.providerVersion === next?.providerVersion &&
      previous?.modelName === next?.modelName &&
      previous?.promptVersion === next?.promptVersion
    ) {
      return [];
    }

    return {
      providerId,
      previous,
      next
    };
  });
}

export async function replayExtraction(request: AIExtractionReplayRequest): Promise<AIExtractionReplayResult> {
  const nextResult = await runAIExtraction({ input: request.input });

  return {
    previousResult: request.previousResult,
    nextResult,
    diffs: diffExtractionResults(request.previousResult, nextResult),
    providerChanges: diffProviderMetadata(request.previousResult, nextResult)
  };
}
