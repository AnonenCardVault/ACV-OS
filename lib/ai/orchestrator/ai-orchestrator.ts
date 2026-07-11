import { calculateAIConfidence } from "@/lib/ai/confidence/confidence-engine";
import { createDefaultAIProviders } from "@/lib/ai/providers";
import { assessImageQuality } from "@/lib/ai/orchestrator/image-processing";
import { decideAfterImageProcessing, decideAfterLocalRules, decideAfterOCR, decideAfterProvider, decideGPTNeed, defaultDecisionConfig } from "@/lib/ai/orchestrator/decision-engine";
import { createExtractionLog } from "@/lib/ai/orchestrator/extraction-logger";
import type { AIDecision, AIExtractionInput, AIExtractionResult, AIFieldKey, AIImageProcessingResult, AIProvider, AIProviderContext, AIProviderOutput, AIWarning, DecisionEngineConfig, ExtractedCardFields } from "@/lib/ai/types";
import { blankCardFields, createSuggestedTitle, hasFieldValue, mergeCardFields } from "@/lib/ai/utils/fields";
import { createLearningEvent } from "@/lib/ai/learning";
import { validateCatalogFields } from "@/lib/catalog";
import { recognizeParallel } from "@/lib/parallel-recognition";

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

function clampConfidence(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

function outputPriority(kind: AIProviderOutput["providerKind"]) {
  const priority: Record<AIProviderOutput["providerKind"], number> = {
    "gpt-vision": 5,
    cardsight: 4,
    checklist: 3,
    ocr: 2,
    mock: 1
  };
  return priority[kind] || 0;
}

const gptVisibleTextFields = new Set<keyof ExtractedCardFields>(["cardNumber", "serialNumber", "conditionNotes", "uncertaintyNotes", "auto", "relic", "grader", "grade"]);
const sportsIdentityFields = new Set<keyof ExtractedCardFields>(["cardTitle", "playerOrCharacter", "team", "sportCategory", "year", "brand", "set", "cardNumber", "parallel"]);
const sportsCategories = new Set(["baseball", "football", "basketball", "hockey", "soccer", "ufc", "racing", "wrestling"]);

function providerMergeRank(output: AIProviderOutput, field: keyof ExtractedCardFields) {
  if (output.providerKind === "gpt-vision") return gptVisibleTextFields.has(field) || sportsIdentityFields.has(field) ? 92 : 72;
  if (output.providerKind === "cardsight") return gptVisibleTextFields.has(field) ? 62 : sportsIdentityFields.has(field) ? 82 : 78;
  if (output.providerKind === "checklist") return 55;
  if (output.providerKind === "ocr") return output.providerLabel.toLowerCase().includes("mock") ? 12 : 70;
  if (output.providerKind === "mock") return 8;
  return outputPriority(output.providerKind) * 10;
}

function fieldConfidence(output: AIProviderOutput, field: AIFieldKey) {
  return output.fieldConfidence[field] ?? output.fieldConfidence.overall ?? 35;
}

function chooseFieldValue(field: keyof ExtractedCardFields, input: AIExtractionInput, outputs: AIProviderOutput[]) {
  const manualValue = input.existingFields?.[field];
  if (input.confirmedFields?.includes(field) && manualValue !== undefined && (typeof manualValue === "boolean" || hasFieldValue(manualValue))) {
    return manualValue;
  }

  const candidates = outputs
    .filter((output) => output.status === "success")
    .filter((output) => Object.prototype.hasOwnProperty.call(output.fields, field))
    .map((output) => ({
      output,
      value: output.fields[field],
      confidence: fieldConfidence(output, field),
      rank: providerMergeRank(output, field)
    }))
    .filter((candidate) => typeof candidate.value === "boolean" || hasFieldValue(candidate.value));

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    const rankDelta = b.rank - a.rank;
    if (rankDelta !== 0) return rankDelta;
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

function normalizeIdentityText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeYearKey(value: unknown) {
  const text = normalizeIdentityText(value);
  const match = text.match(/\b(20\d{2})(?:\s+\d{2})?\b/);
  return match?.[1] || text;
}

function valuesConflict(field: keyof ExtractedCardFields, a: unknown, b: unknown) {
  if (!hasFieldValue(a) || !hasFieldValue(b)) return false;
  if (field === "year") return normalizeYearKey(a) !== normalizeYearKey(b);
  const left = normalizeIdentityText(a);
  const right = normalizeIdentityText(b);
  if (!left || !right) return false;
  return left !== right && !left.includes(right) && !right.includes(left);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 && part === part.toUpperCase() ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`))
    .join(" ");
}

const knownSportsProducts = [
  { brand: "Panini", set: "Select", aliases: ["panini select", "select"] },
  { brand: "Panini", set: "Prizm", aliases: ["panini prizm", "prizm"] },
  { brand: "Panini", set: "Phoenix", aliases: ["panini phoenix", "phoenix"] },
  { brand: "Panini", set: "Mosaic", aliases: ["panini mosaic", "mosaic"] },
  { brand: "Panini", set: "Donruss Optic", aliases: ["panini donruss optic", "donruss optic", "optic"] },
  { brand: "Panini", set: "Donruss", aliases: ["panini donruss", "donruss"] },
  { brand: "Topps", set: "Topps Chrome", aliases: ["topps chrome"] },
  { brand: "Topps", set: "Topps Series 1", aliases: ["topps series 1", "series 1"] },
  { brand: "Topps", set: "Topps Series 2", aliases: ["topps series 2", "series 2"] },
  { brand: "Topps", set: "Topps Update", aliases: ["topps update"] },
  { brand: "Bowman", set: "Bowman Chrome", aliases: ["bowman chrome"] },
  { brand: "Bowman", set: "Bowman", aliases: ["bowman"] }
];

const knownSportsSubsets = ["Lodestars", "Contours", "Field Level", "Club Level", "Premier Level", "Concourse", "Downtown", "Kaboom", "Color Blast", "Stained Glass"];

const knownSportsSubjects = [
  { player: "LeBron James", team: "Los Angeles Lakers", sport: "Basketball", aliases: ["lebron james", "lebron"] },
  { player: "Victor Wembanyama", team: "San Antonio Spurs", sport: "Basketball", aliases: ["victor wembanyama", "wembanyama"] },
  { player: "Drake Maye", team: "New England Patriots", sport: "Football", aliases: ["drake maye"] },
  { player: "CJ Stroud", team: "Houston Texans", sport: "Football", aliases: ["cj stroud", "c j stroud"] },
  { player: "Justin Herbert", team: "Los Angeles Chargers", sport: "Football", aliases: ["justin herbert"] },
  { player: "Shohei Ohtani", team: "Los Angeles Dodgers", sport: "Baseball", aliases: ["shohei ohtani", "ohtani"] }
];

function sportsIdentityFromText(text: string) {
  const normalized = normalizeIdentityText(text);
  const fields: Partial<ExtractedCardFields> = {};
  if (!normalized) return fields;

  const seasonMatch = text.match(/\b(20\d{2})(?:[-/](\d{2}))?\b/);
  if (seasonMatch) fields.year = seasonMatch[2] ? `${seasonMatch[1]}-${seasonMatch[2]}` : seasonMatch[1];

  const product = knownSportsProducts.find((candidate) => candidate.aliases.some((alias) => normalized.includes(alias)));
  if (product) {
    fields.brand = product.brand;
    fields.set = product.set;
  }

  const subset = knownSportsSubsets.find((candidate) => normalized.includes(normalizeIdentityText(candidate)));
  if (subset) fields.parallel = subset;

  const subject = knownSportsSubjects.find((candidate) => candidate.aliases.some((alias) => normalized.includes(alias)));
  if (subject) {
    fields.playerOrCharacter = subject.player;
    fields.team = subject.team;
    fields.sportCategory = subject.sport;
  }

  if (!hasFieldValue(fields.sportCategory)) {
    if (/\b(basketball|nba|lakers|celtics|spurs)\b/.test(normalized)) fields.sportCategory = "Basketball";
    else if (/\b(football|nfl|patriots|texans|chargers)\b/.test(normalized)) fields.sportCategory = "Football";
    else if (/\b(baseball|mlb|dodgers|yankees|ohtani)\b/.test(normalized)) fields.sportCategory = "Baseball";
  }

  const numberMatch = text.match(/(?:#|card\s*(?:no\.?|number)?\s*)\s*([A-Za-z0-9-]{1,16})/i);
  if (numberMatch?.[1]) fields.cardNumber = numberMatch[1].replace(/^#/, "");

  return fields;
}

function visualIdentityCandidates(outputs: AIProviderOutput[]) {
  return outputs
    .filter((output) => output.status === "success" && (output.providerKind === "gpt-vision" || output.providerKind === "cardsight"))
    .map((output) => {
      const text = [output.fields.cardTitle, output.fields.brand, output.fields.set, output.fields.parallel, output.fields.playerOrCharacter, output.fields.team, output.fields.sportCategory, ...output.evidence]
        .filter(hasFieldValue)
        .join(" ");
      const derived = sportsIdentityFromText(text);
      const fields = { ...output.fields, ...derived };
      const confidence = ["cardTitle", "playerOrCharacter", "sportCategory", "year", "brand", "set", "cardNumber"].reduce((total, field) => total + fieldConfidence(output, field as AIFieldKey), 0) / 7;
      const filled = Object.values(fields).filter(hasFieldValue).length;
      const rank = (output.providerKind === "gpt-vision" ? 90 : 78) + Math.min(10, filled);
      return { output, fields, confidence, rank };
    })
    .filter((candidate) => ["sportCategory", "year", "brand", "set", "playerOrCharacter", "cardNumber"].some((field) => hasFieldValue(candidate.fields[field as keyof ExtractedCardFields])))
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return b.confidence - a.confidence;
    });
}

function identityFieldLabel(field: keyof ExtractedCardFields) {
  const labels: Partial<Record<keyof ExtractedCardFields, string>> = {
    sportCategory: "Sport",
    playerOrCharacter: "Player",
    cardNumber: "Card number",
    year: "Year",
    brand: "Brand",
    set: "Set",
    parallel: "Insert/parallel"
  };
  return labels[field] || titleCase(field);
}

function enforceSportsIdentityConsistency({
  fields,
  input,
  outputs,
  catalogValidation
}: {
  fields: ExtractedCardFields;
  input: AIExtractionInput;
  outputs: AIProviderOutput[];
  catalogValidation?: AIExtractionResult["catalogValidation"];
}) {
  const candidates = visualIdentityCandidates(outputs);
  const strongest = candidates[0];
  const categoryKey = normalizeIdentityText([fields.sportCategory, fields.cardTitle, strongest?.fields.sportCategory, strongest?.fields.cardTitle].filter(Boolean).join(" "));
  const isSports = [...sportsCategories].some((category) => categoryKey.includes(category));
  const warnings: AIWarning[] = [];
  if (!isSports || !strongest) return { fields, warnings };

  const next = { ...fields };
  const confirmedFields = new Set(input.confirmedFields || []);
  const identityFields: Array<keyof ExtractedCardFields> = ["sportCategory", "year", "brand", "set", "parallel", "playerOrCharacter", "team", "cardNumber"];

  for (const field of identityFields) {
    const candidateValue = strongest.fields[field];
    if (!hasFieldValue(candidateValue) || confirmedFields.has(field)) continue;
    const currentValue = next[field];

    if (!hasFieldValue(currentValue)) {
      (next as Record<string, unknown>)[field] = candidateValue;
      continue;
    }

    if (valuesConflict(field, currentValue, candidateValue)) {
      (next as Record<string, unknown>)[field] = candidateValue;
      warnings.push({
        code: `field_conflict_${field}`,
        message: `${identityFieldLabel(field)} conflicts with visible product evidence. Kept ${strongest.output.providerLabel}: "${String(candidateValue)}" and rejected "${String(currentValue)}".`,
        severity: "warning",
        field
      });
    }
  }

  const matched = catalogValidation?.matchedCard;
  if (matched) {
    const catalogBrand = matched.brand;
    const catalogProduct = matched.product || matched.set;
    if (hasFieldValue(catalogBrand) && hasFieldValue(strongest.fields.brand) && valuesConflict("brand", catalogBrand, strongest.fields.brand)) {
      warnings.push({
        code: "field_conflict_catalog_brand",
        message: `CATALOG CANDIDATE BELONGS TO DIFFERENT PRODUCT: catalog brand "${catalogBrand}" conflicts with visible brand "${strongest.fields.brand}".`,
        severity: "warning",
        field: "brand"
      });
    }
    if (hasFieldValue(catalogProduct) && hasFieldValue(strongest.fields.set) && valuesConflict("set", catalogProduct, strongest.fields.set)) {
      warnings.push({
        code: "field_conflict_catalog_product",
        message: `CATALOG CANDIDATE BELONGS TO DIFFERENT PRODUCT: catalog product "${catalogProduct}" conflicts with visible set "${strongest.fields.set}".`,
        severity: "warning",
        field: "set"
      });
    }
    if (hasFieldValue(matched.year) && hasFieldValue(strongest.fields.year) && valuesConflict("year", matched.year, strongest.fields.year)) {
      warnings.push({
        code: "field_conflict_catalog_year",
        message: `YEAR CONFLICTS WITH CARD/CATALOG: catalog year "${matched.year}" conflicts with visible year "${strongest.fields.year}".`,
        severity: "warning",
        field: "year"
      });
    }
  }

  return { fields: next, warnings };
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

function confidenceCapFromEvidence({
  fields,
  fieldConfidence,
  warnings,
  catalogStatus,
  parallelStatus,
  parallelConfidence
}: {
  fields: ExtractedCardFields;
  fieldConfidence: Partial<Record<AIFieldKey, number>>;
  warnings: AIWarning[];
  catalogStatus?: string;
  parallelStatus?: string;
  parallelConfidence?: number;
}) {
  let cap = 99;
  const requiredFields: Array<keyof ExtractedCardFields> = ["cardTitle", "playerOrCharacter", "sportCategory", "year", "brand", "set", "cardNumber"];
  const requiredScores = requiredFields
    .filter((field) => hasFieldValue(fields[field]))
    .map((field) => fieldConfidence[field])
    .filter((value): value is number => typeof value === "number");
  const lowestRequired = requiredScores.length ? Math.min(...requiredScores) : 0;
  const hasProviderConflict = warnings.some((warning) => warning.code.startsWith("field_conflict_"));
  const hasCatalogDisagreement = catalogStatus === "disagreement" || catalogStatus === "ambiguous";
  const hasBlocking = warnings.some((warning) => warning.severity === "blocking");
  const hasParallelConflict = parallelStatus === "ambiguous" || parallelStatus === "unsupported";

  if (hasBlocking) cap = Math.min(cap, 45);
  if (hasProviderConflict || hasCatalogDisagreement) cap = Math.min(cap, 74);
  if (hasParallelConflict) cap = Math.min(cap, 78);
  if (parallelStatus === "not_found") cap = Math.min(cap, 88);
  if (typeof parallelConfidence === "number" && parallelConfidence > 0 && parallelConfidence < 60) cap = Math.min(cap, 72);
  if (lowestRequired > 0 && lowestRequired < 50) cap = Math.min(cap, 60);
  else if (lowestRequired > 0 && lowestRequired < 70) cap = Math.min(cap, 78);
  else if (requiredScores.length < 3) cap = Math.min(cap, 70);

  return cap;
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

  let fields = mergeProviderOutputs(input, context.providerOutputs);
  if (!hasFieldValue(fields.cardTitle)) {
    fields.cardTitle = createSuggestedTitle(fields) || "Unidentified Card";
  }
  const catalog = await validateCatalogFields(fields);
  fields = catalog.fields;
  const identityValidation = enforceSportsIdentityConsistency({
    fields,
    input,
    outputs: context.providerOutputs,
    catalogValidation: catalog.validation
  });
  fields = identityValidation.fields;
  const parallelRecognition = recognizeParallel({
    fields,
    images: input.images,
    providerOutputs: context.providerOutputs,
    catalogValidation: catalog.validation
  });
  if (!hasFieldValue(fields.parallel) && parallelRecognition.recommendedParallel) {
    fields = { ...fields, parallel: parallelRecognition.recommendedParallel };
  }
  const suggestedTitle = createSuggestedTitle(fields) || fields.cardTitle;
  const confidence = calculateAIConfidence({ fields, images: input.images, providerOutputs: context.providerOutputs, config });
  const fieldConfidence = {
    ...confidence.fieldConfidence,
    ...catalog.fieldConfidence,
    parallel: parallelRecognition.confidence ?? confidence.fieldConfidence.parallel
  };
  const parallelWarnings: AIWarning[] = parallelRecognition.warnings.map((message) => ({
    code: `parallel_${parallelRecognition.status}`,
    message,
    severity: parallelRecognition.status === "unsupported" || parallelRecognition.status === "ambiguous" ? "warning" : "info",
    field: "parallel"
  }));
  const warnings = dedupeWarnings(context.providerOutputs, [...confidence.warnings, ...catalog.warnings, ...identityValidation.warnings, ...parallelWarnings]);
  const adjustedOverall = Math.min(
    clampConfidence(confidence.overall + catalog.confidenceAdjustment),
    confidenceCapFromEvidence({
      fields,
      fieldConfidence,
      warnings,
      catalogStatus: catalog.validation?.status,
      parallelStatus: parallelRecognition.status,
      parallelConfidence: parallelRecognition.confidence
    })
  );
  let extractionStatus = (catalog.validation?.status === "disagreement" || catalog.validation?.status === "ambiguous") && confidence.status === "Ready to Approve" ? "Needs Review" : confidence.status;
  if ((parallelRecognition.status === "ambiguous" || parallelRecognition.status === "unsupported") && extractionStatus === "Ready to Approve") extractionStatus = "Needs Review";
  if (extractionStatus === "Ready to Approve" && adjustedOverall < config.highConfidence) extractionStatus = adjustedOverall < config.mediumConfidence ? "Needs Research" : "Needs Review";
  const learningEvent = createLearningEvent({ input, providerOutputs: context.providerOutputs });
  const log = createExtractionLog({
    runId: context.runId,
    input,
    startedAt,
    providerOutputs: context.providerOutputs,
    confidence: adjustedOverall,
    imageProcessing,
    warnings,
    finalValues: fields
  });
  logExtraction("run:final", {
    runId: context.runId,
    batchId: input.batchId,
    groupId: input.groupId,
    confidence: adjustedOverall,
    status: extractionStatus,
    finalFields: fields,
    warnings: warnings.map((item) => item.message),
    catalogValidation: catalog.validation
      ? {
          provider: catalog.validation.providerName,
          status: catalog.validation.status,
          confidence: catalog.validation.confidence,
          matchedCard: catalog.validation.matchedCard
        }
      : undefined,
    parallelRecognition,
    providersUsed: context.providerOutputs.map((output) => ({
      id: output.providerId,
      name: output.providerLabel,
      status: output.status,
      confidence: output.providerConfidence
    }))
  });

  return {
    ...fields,
    confidence: adjustedOverall,
    fieldConfidence,
    warnings,
    suggestedTitle,
    extractionStatus,
    extractionSources: context.providerOutputs.flatMap((output) => [output.providerLabel, ...output.evidence]),
    providersUsed: context.providerOutputs.map((output) => output.providerId),
    providerOutputs: context.providerOutputs,
    catalogValidation: catalog.validation,
    parallelRecognition,
    decisionTrace: context.decisionTrace as AIDecision[],
    learningEvent,
    log
  };
}
