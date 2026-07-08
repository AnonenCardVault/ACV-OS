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

function diagnosticsEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ACV_AI_DIAGNOSTICS === "true";
}

function imageDiagnostics(images: AIExtractionInput["images"]) {
  return images.map((image) => ({
    id: image.id,
    fileName: image.fileName,
    role: image.role,
    order: image.order,
    hasUrl: Boolean(image.url),
    hasDataUrl: Boolean(image.dataUrl),
    needsReupload: Boolean(image.needsReupload)
  }));
}

function rawDiagnostics(raw: AIProviderOutput["raw"]) {
  if (!raw) return undefined;
  return {
    keys: Object.keys(raw),
    cardsightError: typeof raw.cardsightError === "string" ? raw.cardsightError : undefined,
    responseId: typeof raw.responseId === "string" ? raw.responseId : undefined,
    suggestedTitle: typeof raw.suggestedTitle === "string" ? raw.suggestedTitle : undefined,
    usage: raw.usage && typeof raw.usage === "object" ? raw.usage : undefined,
    normalizedCandidate: raw.normalizedCandidate && typeof raw.normalizedCandidate === "object" ? Object.keys(raw.normalizedCandidate as Record<string, unknown>) : undefined
  };
}

function logExtraction(label: string, payload: Record<string, unknown>) {
  if (!diagnosticsEnabled()) return;
  console.info(`[ACV AI] ${label}`, payload);
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

  if (candidates.length === 0) return undefined;

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

  return mergeCardFields({}, fields, input.categoryHint || "Other");
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
  const providerInput =
    provider.kind === "cardsight"
      ? {
          ...input,
          images: input.images.filter((image) => image.id === context.imageProcessing.frontImageId)
        }
      : input;

  logExtraction("provider:start", {
    runId: context.runId,
    providerId: provider.id,
    providerName: provider.label,
    providerStatus: provider.status,
    providerKind: provider.kind,
    images: imageDiagnostics(providerInput.images)
  });

  try {
    const output = await provider.extract(providerInput, context);
    logExtraction("provider:finish", {
      runId: context.runId,
      providerId: provider.id,
      providerName: provider.label,
      status: output.status,
      confidence: output.providerConfidence,
      fields: output.fields,
      warnings: output.warnings.map((item) => item.message),
      evidence: output.evidence.slice(0, 6),
      raw: rawDiagnostics(output.raw)
    });
    return output;
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

    const output: AIProviderOutput = {
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
    logExtraction("provider:failed", {
      runId: context.runId,
      providerId: provider.id,
      providerName: provider.label,
      error: error instanceof Error ? error.message : `${provider.label} failed`
    });
    return output;
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
  const fields = mergeCardFields({}, {}, input.categoryHint || "Other");
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
  const cardSightProviders = runOutputsByKind(providers, "cardsight");
  const gptProviders = runOutputsByKind(providers, "gpt-vision");
  const hasRealCardSight = cardSightProviders.some((provider) => provider.status === "available");
  const hasRealGpt = gptProviders.some((provider) => provider.status === "available");
  const hasLiveVisualProvider = hasRealCardSight || hasRealGpt;
  const checklistProviders = runOutputsByKind(providers, "checklist").filter((provider) => !hasLiveVisualProvider || provider.status !== "mock");

  logExtraction("run:start", {
    runId: context.runId,
    batchId: input.batchId,
    groupId: input.groupId,
    images: imageDiagnostics(input.images),
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.label,
      kind: provider.kind,
      status: provider.status,
      costTier: provider.costTier
    })),
    existingFieldKeys: Object.entries(input.existingFields || {})
      .filter(([, value]) => hasFieldValue(value))
      .map(([key]) => key)
  });

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

  for (const provider of checklistProviders) {
    upsertOutput(context, await runProvider(provider, input, context));
  }
  const localDecision = decideAfterLocalRules(context.providerOutputs, config);
  context.decisionTrace.push(localDecision);

  const shouldRunVisualIdentity = localDecision.route !== "skip-provider" || hasLiveVisualProvider;

  if (shouldRunVisualIdentity) {
    for (const provider of cardSightProviders) {
      upsertOutput(context, await runProvider(provider, input, context));
    }
    for (const provider of checklistProviders) {
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
  if (!hasStrongFields && !hasLiveVisualProvider) {
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
  logExtraction("run:final", {
    runId: context.runId,
    batchId: input.batchId,
    groupId: input.groupId,
    confidence: confidence.overall,
    status: confidence.status,
    finalFields: fields,
    warnings: warnings.map((item) => item.message),
    providersUsed: context.providerOutputs.map((output) => ({
      id: output.providerId,
      name: output.providerLabel,
      status: output.status,
      confidence: output.providerConfidence
    }))
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
