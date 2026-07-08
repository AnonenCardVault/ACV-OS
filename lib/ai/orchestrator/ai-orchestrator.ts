import { calculateAIConfidence } from "@/lib/ai/confidence/confidence-engine";
import { createDefaultAIProviders } from "@/lib/ai/providers";
import { assessImageQuality } from "@/lib/ai/orchestrator/image-processing";
import { decideAfterImageProcessing, decideAfterLocalRules, decideAfterOCR, decideAfterProvider, decideGPTNeed, defaultDecisionConfig } from "@/lib/ai/orchestrator/decision-engine";
import { createExtractionLog } from "@/lib/ai/orchestrator/extraction-logger";
import type { AIDecision, AIExtractionInput, AIExtractionResult, AIFieldKey, AIImageProcessingResult, AIProvider, AIProviderContext, AIProviderOutput, AIWarning, DecisionEngineConfig, ExtractedCardFields } from "@/lib/ai/types";
import { blankCardFields, createSuggestedTitle, hasFieldValue, mergeCardFields } from "@/lib/ai/utils/fields";
import { createLearningEvent } from "@/lib/ai/learning";

function runId() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function outputPriority(kind: AIProviderOutput["providerKind"]) {
  const priority: Record<AIProviderOutput["providerKind"], number> = {
    checklist: 5,
    "gpt-vision": 4,
    cardsight: 3,
    ocr: 2,
    mock: 1
  };
  return priority[kind] || 0;
}

function fieldConfidence(output: AIProviderOutput, field: AIFieldKey) {
  return output.fieldConfidence[field] ?? output.fieldConfidence.overall ?? 35;
}

function chooseFieldValue(field: keyof ExtractedCardFields, input: AIExtractionInput, outputs: AIProviderOutput[]) {
  const candidates = outputs
    .filter((output) => Object.prototype.hasOwnProperty.call(output.fields, field))
    .map((output) => ({
      output,
      value: output.fields[field],
      confidence: fieldConfidence(output, field)
    }))
    .filter((candidate) => typeof candidate.value === "boolean" || hasFieldValue(candidate.value));

  if (candidates.length === 0) return input.existingFields?.[field];

  candidates.sort((a, b) => {
    const confidenceDelta = b.confidence - a.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return outputPriority(b.output.providerKind) - outputPriority(a.output.providerKind);
  });

  return candidates[0].value;
}

function mergeProviderOutputs(input: AIExtractionInput, outputs: AIProviderOutput[]) {
  const base = blankCardFields();
  const fields = Object.keys(base).reduce<Partial<ExtractedCardFields>>((memo, field) => {
    const key = field as keyof ExtractedCardFields;
    const value = chooseFieldValue(key, input, outputs);
    if (value !== undefined) {
      (memo as Record<string, unknown>)[key] = value;
    }
    return memo;
  }, {});

  return mergeCardFields(input.existingFields, fields, input.categoryHint || input.existingFields?.sportCategory || "Other");
}

function dedupeWarnings(outputs: AIProviderOutput[], confidenceWarnings: AIExtractionResult["warnings"]) {
  const warnings = [...outputs.flatMap((output) => output.warnings), ...confidenceWarnings];
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function runProvider(provider: AIProvider, input: AIExtractionInput, context: AIProviderContext): Promise<AIProviderOutput> {
  try {
    const providerInput =
      provider.kind === "cardsight"
        ? {
            ...input,
            images: input.images.filter((image) => image.id === context.imageProcessing.frontImageId)
          }
        : input;

    return await provider.extract(providerInput, context);
  } catch (error) {
    const timestamp = new Date().toISOString();
    const metadata = {
      providerName: provider.label,
      providerVersion: provider.version,
      modelName: provider.modelName,
      promptVersion: provider.promptVersion,
      timestamp,
      providerConfidence: 0,
      costTier: provider.costTier
    };

    return {
      providerId: provider.id,
      providerKind: provider.kind,
      providerLabel: provider.label,
      providerVersion: provider.version,
      modelName: provider.modelName,
      promptVersion: provider.promptVersion,
      timestamp,
      providerConfidence: 0,
      costTier: provider.costTier,
      status: "failed",
      elapsedMs: 0,
      fields: {},
      fieldConfidence: {},
      warnings: [
        {
          code: `${provider.id}_failed`,
          message: error instanceof Error ? error.message : `${provider.label} failed`,
          severity: "warning",
          providerId: provider.id
        }
      ],
      evidence: [],
      metadata
    };
  }
}

function upsertOutput(context: AIProviderContext, output: AIProviderOutput) {
  const index = context.providerOutputs.findIndex((item) => item.providerId === output.providerId);
  if (index >= 0) {
    context.providerOutputs[index] = output;
    return;
  }
  context.providerOutputs.push(output);
}

function runOutputsByKind(providers: AIProvider[], kind: AIProvider["kind"]) {
  return providers.filter((provider) => provider.kind === kind);
}

function retakeResult({
  input,
  startedAt,
  imageProcessing,
  decisionTrace
}: {
  input: AIExtractionInput;
  startedAt: number;
  imageProcessing: AIImageProcessingResult;
  decisionTrace: AIDecision[];
}): AIExtractionResult {
  const fields = mergeCardFields(input.existingFields, {}, input.categoryHint || input.existingFields?.sportCategory || "Other");
  const warnings: AIWarning[] = [
    {
      code: "retake_image_required",
      message: imageProcessing.reasons.join("; ") || "Retake image required",
      severity: "blocking"
    }
  ];
  const learningEvent = createLearningEvent({ input, providerOutputs: [] });
  const log = createExtractionLog({
    runId: runId(),
    input,
    startedAt,
    providerOutputs: [],
    confidence: imageProcessing.qualityScore,
    imageProcessing,
    warnings,
    finalValues: fields
  });

  return {
    ...fields,
    confidence: imageProcessing.qualityScore,
    fieldConfidence: {},
    warnings,
    suggestedTitle: createSuggestedTitle(fields) || fields.cardTitle || "Retake Image",
    extractionStatus: "Retake Image",
    extractionSources: ["Image Processing"],
    providersUsed: [],
    providerOutputs: [],
    decisionTrace,
    learningEvent,
    log
  };
}

export async function runAIExtraction({
  input,
  providers = createDefaultAIProviders(),
  config = defaultDecisionConfig
}: {
  input: AIExtractionInput;
  providers?: AIProvider[];
  config?: DecisionEngineConfig;
}): Promise<AIExtractionResult> {
  const startedAt = Date.now();
  const imageProcessing = assessImageQuality(input.images);
  const context: AIProviderContext = {
    runId: runId(),
    startedAt: new Date(startedAt).toISOString(),
    imageProcessing,
    ocrText: "",
    providerOutputs: [],
    decisionTrace: []
  };
  const imageDecision = decideAfterImageProcessing(imageProcessing.qualityScore, config);
  context.decisionTrace.push(imageDecision);

  if (imageDecision.route === "retake-image") {
    return retakeResult({ input, startedAt, imageProcessing, decisionTrace: context.decisionTrace });
  }

  for (const provider of runOutputsByKind(providers, "ocr")) {
    const output = await runProvider(provider, input, context);
    upsertOutput(context, output);
    const detectedText = output.raw?.detectedText;
    if (Array.isArray(detectedText)) context.ocrText = detectedText.map(String).join(" ");
  }
  context.decisionTrace.push(decideAfterOCR(context.providerOutputs, config));

  for (const provider of runOutputsByKind(providers, "checklist")) {
    upsertOutput(context, await runProvider(provider, input, context));
  }
  const localDecision = decideAfterLocalRules(context.providerOutputs, config);
  context.decisionTrace.push(localDecision);

  const cardSightProviders = runOutputsByKind(providers, "cardsight");
  const gptProviders = runOutputsByKind(providers, "gpt-vision");
  const hasRealCardSight = cardSightProviders.some((provider) => provider.status === "available");
  const hasRealGpt = gptProviders.some((provider) => provider.status === "available");
  const shouldRunVisualIdentity = localDecision.route !== "skip-provider" || hasRealCardSight;

  if (shouldRunVisualIdentity) {
    for (const provider of cardSightProviders) {
      upsertOutput(context, await runProvider(provider, input, context));
    }
    for (const provider of runOutputsByKind(providers, "checklist")) {
      upsertOutput(context, await runProvider(provider, input, context));
    }
    context.decisionTrace.push(decideAfterProvider(context.providerOutputs, config));

    const gptDecision = decideGPTNeed(context.providerOutputs, config);
    context.decisionTrace.push(gptDecision);
    if (gptDecision.route === "run-additional-provider" || hasRealGpt) {
      for (const provider of gptProviders) {
        upsertOutput(context, await runProvider(provider, input, context));
      }
    }
  } else {
    context.decisionTrace.push({
      stage: "GPT Verification",
      route: "skip-provider",
      reason: "Local rules met threshold; GPT verification skipped for cost control",
      thresholdKey: "localRulesSufficientConfidence",
      confidence: localDecision.confidence
    });
  }

  const hasStrongFields = context.providerOutputs.some((output) => hasFieldValue(output.fields.cardTitle) || hasFieldValue(output.fields.playerOrCharacter));
  if (!hasStrongFields) {
    for (const provider of runOutputsByKind(providers, "mock")) {
      upsertOutput(context, await runProvider(provider, input, context));
    }
  }

  const fields = mergeProviderOutputs(input, context.providerOutputs);
  if (!hasFieldValue(fields.cardTitle)) {
    fields.cardTitle = createSuggestedTitle(fields) || "Unidentified Card";
  }
  const suggestedTitle = createSuggestedTitle(fields) || fields.cardTitle;
  const confidence = calculateAIConfidence({ fields, images: input.images, providerOutputs: context.providerOutputs, config });
  const warnings = dedupeWarnings(context.providerOutputs, confidence.warnings);
  const learningEvent = createLearningEvent({ input, providerOutputs: context.providerOutputs });
  const log = createExtractionLog({
    runId: context.runId,
    input,
    startedAt,
    providerOutputs: context.providerOutputs,
    confidence: confidence.overall,
    imageProcessing,
    warnings,
    finalValues: fields
  });

  return {
    ...fields,
    confidence: confidence.overall,
    fieldConfidence: confidence.fieldConfidence,
    warnings,
    suggestedTitle,
    extractionStatus: confidence.status,
    extractionSources: context.providerOutputs.flatMap((output) => [output.providerLabel, ...output.evidence]),
    providersUsed: context.providerOutputs.map((output) => output.providerId),
    providerOutputs: context.providerOutputs,
    decisionTrace: context.decisionTrace as AIDecision[],
    learningEvent,
    log
  };
}
