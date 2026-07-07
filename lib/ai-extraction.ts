import { createDefaultAIProviders, runAIExtraction, type AIExtractionResult as EngineExtractionResult, type AIImageInput as ExtractionImage, type ExtractedCardFields } from "@/lib/ai";
import type { AiExtractionStatus, AiFieldConfidenceMap, IntakeImage, ProposedRecord } from "@/lib/acv-local-state";

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
};

function proposedToExtractedFields(record: ProposedRecord): Partial<ExtractedCardFields> {
  return {
    cardTitle: record.cardName,
    playerOrCharacter: record.playerCharacter,
    team: record.team,
    sportCategory: record.category,
    year: record.year,
    brand: record.brand,
    set: record.set,
    cardNumber: record.cardNumber,
    parallel: record.parallel,
    serialNumber: record.serialNumber,
    rookie: record.rookieFlag,
    auto: record.autoFlag,
    relic: record.relicFlag,
    variation: record.variationFlag,
    grader: record.grader,
    grade: record.grade,
    conditionNotes: record.conditionNotes,
    uncertaintyNotes: record.uncertaintyNotes
  };
}

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
    extractionSources: result.extractionSources
  };
}

function engineInput(input: ExtractCardInput) {
  return {
    images: input.images.map(engineImage),
    categoryHint: input.categoryHint,
    existingFields: proposedToExtractedFields(input.existingValues)
  };
}

export async function extractCardFromImages(input: ExtractCardInput): Promise<ExtractionResult> {
  const result = await runAIExtraction({
    input: {
      ...engineInput(input),
      batchId: input.batchId,
      groupId: input.groupId
    },
    providers: createDefaultAIProviders()
  });
  return adaptEngineResult(result, input.existingValues, "ACV Extraction Engine v2 / local mock");
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
