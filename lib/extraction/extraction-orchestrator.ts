import { matchBrandDictionary } from "@/lib/extraction/brand-dictionary";
import { matchChecklist } from "@/lib/extraction/checklist-matcher";
import { calculateExtractionConfidence } from "@/lib/extraction/confidence-engine";
import { runOcrPipeline } from "@/lib/extraction/ocr-pipeline";
import { runMockVisionFallback } from "@/lib/extraction/providers/mock-vision-provider";
import { detectSportCategory } from "@/lib/extraction/sport-detector";
import type { CardExtractionInput, ChecklistCandidate, ExtractedCardFields, ExtractionResult, ExtractionWarning, FieldConfidenceMap, OcrResult, VisionProviderResult } from "@/lib/extraction/types";
import type { VisionProvider } from "@/lib/extraction/vision-provider";

function clean(value: unknown) {
  return String(value || "").trim();
}

function hasValue(value: unknown) {
  const normalized = clean(value).toLowerCase();
  return Boolean(normalized && normalized !== "-" && normalized !== "pending" && normalized !== "pending manual review");
}

function createSuggestedTitle(fields: Partial<ExtractedCardFields>) {
  const parts = [
    fields.year,
    fields.brand,
    fields.set,
    fields.playerOrCharacter,
    fields.parallel,
    fields.cardNumber ? `#${String(fields.cardNumber).replace(/^#/, "")}` : "",
    fields.rookie ? "RC" : "",
    fields.auto ? "Auto" : "",
    fields.relic ? "Relic" : ""
  ];

  return parts
    .map(clean)
    .filter((part) => part && part !== "-")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function blankFields(): ExtractedCardFields {
  return {
    cardTitle: "",
    playerOrCharacter: "",
    team: "",
    sportCategory: "",
    year: "",
    brand: "",
    set: "",
    cardNumber: "",
    parallel: "",
    serialNumber: "",
    rookie: false,
    auto: false,
    relic: false,
    variation: false,
    grader: "Raw",
    grade: "Raw",
    conditionNotes: "",
    uncertaintyNotes: ""
  };
}

function fieldsFromCandidate(candidate: ChecklistCandidate): ExtractedCardFields {
  return {
    ...blankFields(),
    cardTitle: candidate.cardTitle,
    playerOrCharacter: candidate.playerOrCharacter,
    team: candidate.team,
    sportCategory: candidate.sportCategory,
    year: candidate.year,
    brand: candidate.brand,
    set: candidate.set,
    cardNumber: candidate.cardNumber,
    parallel: candidate.parallel,
    serialNumber: candidate.serialNumber || "-",
    rookie: Boolean(candidate.rookie),
    auto: Boolean(candidate.auto),
    relic: Boolean(candidate.relic),
    variation: Boolean(candidate.variation),
    conditionNotes: `Mock checklist candidate matched ${candidate.playerOrCharacter}. Confirm condition, surface, corners, and final marketplace title manually.`,
    uncertaintyNotes: candidate.score >= 90 ? "Serial number not detected in local mock extraction." : "Confirm parallel, card number, and checklist details before approval."
  };
}

function mergeFields(existing: Partial<ExtractedCardFields> | undefined, extracted: Partial<ExtractedCardFields>, sportCategory: string): ExtractedCardFields {
  const base = blankFields();
  const merged = { ...base, ...existing, ...extracted };

  return {
    ...merged,
    sportCategory: hasValue(merged.sportCategory) ? merged.sportCategory : sportCategory,
    grader: merged.grader || "Raw",
    grade: merged.grade || "Raw"
  };
}

function fieldConfidenceFromCandidate(candidate: ChecklistCandidate | undefined, categoryConfidence: number, fallback: FieldConfidenceMap = {}): FieldConfidenceMap {
  if (!candidate) return fallback;

  const strongMatch = candidate.score >= 88;
  const has = (field: string) => candidate.matchedFields.includes(field);

  return {
    cardTitle: strongMatch ? 95 : 78,
    playerOrCharacter: has("playerOrCharacter") ? 97 : 72,
    team: has("team") ? 92 : strongMatch ? 86 : 58,
    sportCategory: Math.max(categoryConfidence, strongMatch ? 94 : 72),
    year: has("year") ? 92 : strongMatch ? 88 : 56,
    brand: has("brand") ? 90 : strongMatch ? 86 : 58,
    set: has("set") ? 88 : strongMatch ? 82 : 52,
    cardNumber: has("cardNumber") ? 90 : strongMatch ? 80 : 46,
    parallel: strongMatch ? 68 : 42,
    serialNumber: 35,
    grader: 70,
    grade: 70,
    suggestedTitle: strongMatch ? 92 : 68
  };
}

function dedupeWarnings(warnings: ExtractionWarning[]) {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pipelineContext(input: CardExtractionInput): {
  ocr: OcrResult;
  dictionaryMatches: ReturnType<typeof matchBrandDictionary>;
  sport: ReturnType<typeof detectSportCategory>;
  candidates: ChecklistCandidate[];
  bestCandidate: ChecklistCandidate | undefined;
  extractionSources: string[];
} {
  const ocr = runOcrPipeline(input);
  const dictionaryMatches = matchBrandDictionary(ocr.textBlob);
  const sport = detectSportCategory({ input, detectedText: ocr.textBlob, dictionaryMatches });
  const candidates = matchChecklist({ detectedText: ocr.textBlob, categoryHint: sport.category, dictionaryMatches });
  const bestCandidate = candidates[0];
  const extractionSources = ["image roles", ...ocr.sources, "brand dictionary", "sport detector", "checklist matcher"];

  return {
    ocr,
    dictionaryMatches,
    sport,
    candidates,
    bestCandidate,
    extractionSources
  };
}

function finalizeExtraction({
  input,
  fields,
  fieldConfidence,
  candidate,
  initialWarnings,
  suggestedTitle,
  extractionSources,
  skipChecklistWarning
}: {
  input: CardExtractionInput;
  fields: ExtractedCardFields;
  fieldConfidence: FieldConfidenceMap;
  candidate?: ChecklistCandidate;
  initialWarnings?: ExtractionWarning[];
  suggestedTitle?: string;
  extractionSources: string[];
  skipChecklistWarning?: boolean;
}): ExtractionResult {
  if (!hasValue(fields.cardTitle)) {
    fields.cardTitle = createSuggestedTitle(fields) || "Unidentified Card";
  }

  const nextSuggestedTitle = clean(suggestedTitle) || createSuggestedTitle(fields) || fields.cardTitle;
  const confidence = calculateExtractionConfidence({
    fields,
    images: input.images,
    candidate,
    fieldConfidence,
    initialWarnings,
    skipChecklistWarning
  });

  return {
    ...fields,
    confidence: confidence.confidence,
    fieldConfidence: confidence.fieldConfidence,
    warnings: dedupeWarnings(confidence.warnings),
    suggestedTitle: nextSuggestedTitle,
    extractionStatus: confidence.extractionStatus,
    extractionSources
  };
}

function resultFromVisionProvider(input: CardExtractionInput, visionResult: VisionProviderResult, sportCategory: string, extractionSources: string[], candidate?: ChecklistCandidate): ExtractionResult {
  const fields = mergeFields(input.existingFields, visionResult.fields, sportCategory);

  return finalizeExtraction({
    input,
    fields,
    fieldConfidence: visionResult.fieldConfidence,
    candidate,
    initialWarnings: visionResult.warnings,
    suggestedTitle: visionResult.suggestedTitle,
    extractionSources: [...extractionSources, ...visionResult.sources],
    skipChecklistWarning: true
  });
}

export function extractCardFromImages(input: CardExtractionInput): ExtractionResult {
  const context = pipelineContext(input);
  let fields: ExtractedCardFields;
  let fieldConfidence: FieldConfidenceMap;
  let initialWarnings: ExtractionWarning[] = [];

  if (context.bestCandidate) {
    fields = mergeFields(input.existingFields, fieldsFromCandidate(context.bestCandidate), context.sport.category);
    fieldConfidence = fieldConfidenceFromCandidate(context.bestCandidate, context.sport.confidence);
  } else {
    const visionFallback = runMockVisionFallback({ ...input, categoryHint: context.sport.category });
    return resultFromVisionProvider(input, visionFallback, context.sport.category, context.extractionSources);
  }

  return finalizeExtraction({
    input,
    fields,
    fieldConfidence,
    candidate: context.bestCandidate,
    initialWarnings,
    extractionSources: context.extractionSources
  });
}

export async function extractCardFromImagesWithProvider(
  input: CardExtractionInput,
  provider: VisionProvider,
  options: { forceVisionProvider?: boolean } = {}
): Promise<ExtractionResult> {
  const context = pipelineContext(input);

  if (!options.forceVisionProvider && context.bestCandidate) {
    return extractCardFromImages(input);
  }

  const visionResult = await provider.extract({ ...input, categoryHint: context.sport.category });
  return resultFromVisionProvider(input, visionResult, context.sport.category, context.extractionSources, options.forceVisionProvider ? undefined : context.bestCandidate);
}
