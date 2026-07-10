import type { AIExtractionResult as EngineExtractionResult, AIImageInput as ExtractionImage } from "@/lib/ai";
import type { AiExtractionStatus, AiFieldConfidenceMap, IntakeImage, ProposedRecord } from "@/lib/acv-local-state";
import type { ParallelRecognitionResult } from "@/lib/parallel-recognition";

export type ExtractCardInput = {
  images: IntakeImage[];
  imageRoles?: Array<{ id: string; role: string }>;
  batchId?: string;
  groupId?: string;
  categoryHint?: string;
  existingValues: ProposedRecord;
};

export type ExtractionResult = {
  status: AiExtractionStatus;
  extracted: Partial<ProposedRecord>;
  confidenceScore: number;
  fieldConfidence: AiFieldConfidenceMap;
  warnings: string[];
  suggestedTitle: string;
  extractedAt: string;
  modelLabel: string;
  extractionSources: string[];
  catalogDiagnostics?: {
    providerName: string;
    status: string;
    confidence?: number;
    matchedCard?: string;
    matchedSet?: string;
    matchedNumber?: string;
    matchedTeam?: string;
    matchedProduct?: string;
    matchedSubset?: string | null;
    sourceName?: string;
    sourceUrl?: string;
    candidateCount?: number;
    rarity?: string;
    setId?: string;
    setTotal?: number;
    printedTotal?: number;
    supertype?: string;
    subtypes?: string[];
    types?: string[];
    warnings: string[];
  };
  parallelRecognition?: ParallelRecognitionResult;
  providerDiagnostics: Array<{
    providerName: string;
    status: "used" | "skipped" | "failed" | "fallback";
    reason: string;
    confidence?: number;
    mode: "live" | "mock" | "local";
    mappedFields?: Array<{ label: string; value: string }>;
  }>;
};

function engineImage(image: IntakeImage): ExtractionImage {
  return {
    id: image.id,
    role: image.role,
    fileName: image.fileName,
    label: image.label,
    url: image.publicUrl || image.url,
    dataUrl: image.dataUrl,
    order: image.order,
    needsReupload: image.needsReupload
  };
}

function engineStatusToIntakeStatus(result: EngineExtractionResult): AiExtractionStatus {
  if (result.extractionStatus === "Ready to Approve") return "Extracted";
  if (result.extractionStatus === "Blocked" || result.extractionStatus === "Failed" || result.extractionStatus === "Retake Image") return "Failed";
  return "Needs Review";
}

function engineConfidenceToIntakeMap(result: EngineExtractionResult): AiFieldConfidenceMap {
  return {
    cardName: result.fieldConfidence.cardTitle,
    playerCharacter: result.fieldConfidence.playerOrCharacter,
    team: result.fieldConfidence.team,
    category: result.fieldConfidence.sportCategory,
    year: result.fieldConfidence.year,
    brand: result.fieldConfidence.brand,
    set: result.fieldConfidence.set,
    cardNumber: result.fieldConfidence.cardNumber,
    parallel: result.fieldConfidence.parallel,
    serialNumber: result.fieldConfidence.serialNumber,
    grader: result.fieldConfidence.grader,
    grade: result.fieldConfidence.grade,
    suggestedTitle: result.fieldConfidence.suggestedTitle
  };
}

function engineResultToProposed(result: EngineExtractionResult, existing: ProposedRecord): Partial<ProposedRecord> {
  return {
    cardName: result.cardTitle,
    playerCharacter: result.playerOrCharacter,
    team: result.team,
    category: result.sportCategory,
    year: result.year,
    brand: result.brand,
    set: result.set,
    cardNumber: result.cardNumber,
    parallel: result.parallel,
    serialNumber: result.serialNumber,
    rookieFlag: result.rookie,
    autoFlag: result.auto,
    relicFlag: result.relic,
    variationFlag: result.variation,
    grader: result.grader,
    grade: result.grade,
    conditionNotes: result.conditionNotes,
    uncertaintyNotes: result.uncertaintyNotes,
    purchaseCost: existing.purchaseCost,
    quantity: existing.quantity || 1,
    acquisitionSource: existing.acquisitionSource || "Computer Upload",
    location: existing.location || "Photo Intake",
    internalNotes: existing.internalNotes
  };
}

function hasDiagnosticValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim();
  return Boolean(text && text !== "-" && text.toLowerCase() !== "raw");
}

function mappedFieldLabel(key: string) {
  const labels: Record<string, string> = {
    cardTitle: "Title",
    playerOrCharacter: "Player",
    team: "Team",
    sportCategory: "Category",
    year: "Year",
    brand: "Brand",
    set: "Set",
    cardNumber: "Card #",
    parallel: "Parallel",
    serialNumber: "Serial",
    rookie: "Rookie",
    auto: "Auto",
    relic: "Relic",
    variation: "Variation",
    grader: "Grader",
    grade: "Grade"
  };
  return labels[key] || key;
}

function providerDiagnostics(result: EngineExtractionResult): ExtractionResult["providerDiagnostics"] {
  return result.providerOutputs.map((output) => {
    const fallback = output.providerKind === "mock" || output.providerLabel.toLowerCase().includes("fallback") || output.warnings.some((item) => item.code.toLowerCase().includes("fallback"));
    const mode = output.providerLabel.toLowerCase().includes("mock") ? "mock" : output.costTier === "paid" ? "live" : "local";
    const status = output.status === "failed" ? "failed" : fallback ? "fallback" : output.status === "skipped" ? "skipped" : "used";
    const reason = output.warnings[0]?.message || output.evidence[0] || (status === "used" ? `${mode} provider completed` : "Provider did not return usable output");
    const mappedFields = Object.entries(output.fields)
      .filter(([, value]) => hasDiagnosticValue(value))
      .slice(0, 8)
      .map(([key, value]) => ({
        label: mappedFieldLabel(key),
        value: typeof value === "boolean" ? "Yes" : String(value)
      }));

    return {
      providerName: output.providerLabel,
      status,
      reason,
      confidence: output.providerConfidence || undefined,
      mode,
      mappedFields
    };
  });
}

function catalogDiagnostics(result: EngineExtractionResult): ExtractionResult["catalogDiagnostics"] {
  const validation = result.catalogValidation;
  if (!validation) return undefined;
  return {
    providerName: validation.providerName,
    status: validation.status,
    confidence: validation.confidence,
    matchedCard: validation.matchedCard?.name,
    matchedSet: validation.matchedCard?.set,
    matchedNumber: validation.matchedCard?.number,
    matchedTeam: validation.matchedCard?.team || undefined,
    matchedProduct: validation.matchedCard?.product || undefined,
    matchedSubset: validation.matchedCard?.subset,
    sourceName: validation.matchedCard?.sourceName,
    sourceUrl: validation.matchedCard?.sourceUrl,
    candidateCount: validation.candidateCount,
    rarity: validation.matchedCard?.rarity,
    setId: validation.matchedCard?.setId,
    setTotal: validation.matchedCard?.setTotal,
    printedTotal: validation.matchedCard?.printedTotal,
    supertype: validation.matchedCard?.supertype,
    subtypes: validation.matchedCard?.subtypes,
    types: validation.matchedCard?.types,
    warnings: validation.warnings.map((warning) => warning.message)
  };
}

function adaptEngineResult(result: EngineExtractionResult, existingValues: ProposedRecord, modelLabel: string): ExtractionResult {
  return {
    status: engineStatusToIntakeStatus(result),
    extracted: engineResultToProposed(result, existingValues),
    confidenceScore: result.confidence,
    fieldConfidence: engineConfidenceToIntakeMap(result),
    warnings: result.warnings.map((warning) => warning.message),
    suggestedTitle: result.suggestedTitle,
    extractedAt: new Date().toISOString(),
    modelLabel,
    extractionSources: result.extractionSources,
    catalogDiagnostics: catalogDiagnostics(result),
    parallelRecognition: result.parallelRecognition,
    providerDiagnostics: providerDiagnostics(result)
  };
}

function engineInput(input: ExtractCardInput) {
  return {
    images: input.images.map(engineImage),
    categoryHint: undefined,
    existingFields: {}
  };
}

export async function extractCardFromImages(input: ExtractCardInput): Promise<ExtractionResult> {
  return extractCardFromImagesViaApi(input);
}

export async function extractCardFromImagesViaApi(input: ExtractCardInput): Promise<ExtractionResult> {
  const response = await fetch("/api/extract-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...engineInput(input),
      batchId: input.batchId,
      groupId: input.groupId,
      frontBackOnly: false
    })
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        modelLabel?: string;
        result?: EngineExtractionResult;
        error?: string;
        detail?: string;
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.result) {
    throw new Error(payload?.error || payload?.detail || "AI extraction failed. Manual form values were left unchanged.");
  }

  return adaptEngineResult(payload.result, input.existingValues, payload.modelLabel || "ACV Extraction Engine");
}
