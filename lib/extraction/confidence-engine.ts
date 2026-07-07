import type { ChecklistCandidate, ExtractedCardFields, ExtractionImage, ExtractionStatus, ExtractionWarning, FieldConfidenceMap } from "@/lib/extraction/types";

function hasValue(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized && normalized !== "-" && normalized !== "pending" && normalized !== "pending manual review");
}

function warning(code: string, message: string, severity: ExtractionWarning["severity"], field?: ExtractionWarning["field"]): ExtractionWarning {
  return { code, message, severity, field };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function calculateExtractionConfidence({
  fields,
  images,
  candidate,
  fieldConfidence,
  initialWarnings
}: {
  fields: ExtractedCardFields;
  images: ExtractionImage[];
  candidate?: ChecklistCandidate;
  fieldConfidence: FieldConfidenceMap;
  initialWarnings?: ExtractionWarning[];
}): {
  confidence: number;
  fieldConfidence: FieldConfidenceMap;
  warnings: ExtractionWarning[];
  extractionStatus: ExtractionStatus;
} {
  const warnings = [...(initialWarnings || [])];
  const hasFront = images.some((image) => image.role === "Front");
  const hasBack = images.some((image) => image.role === "Back");

  if (!hasFront) warnings.push(warning("missing_front", "Missing front image", "blocking"));
  if (!hasBack) warnings.push(warning("missing_back", "Back image missing", "warning"));
  if (!hasValue(fields.cardTitle)) warnings.push(warning("missing_title", "Missing card title", "blocking", "cardTitle"));
  if (!hasValue(fields.sportCategory)) warnings.push(warning("missing_category", "Missing category", "blocking", "sportCategory"));
  if (!hasValue(fields.cardNumber)) warnings.push(warning("card_number_unconfirmed", "Card number not confirmed", "warning", "cardNumber"));
  if (!hasValue(fields.serialNumber)) warnings.push(warning("serial_not_detected", "Serial number not detected", "info", "serialNumber"));
  if ((fieldConfidence.parallel || 0) > 0 && (fieldConfidence.parallel || 0) < 70) warnings.push(warning("parallel_uncertain", "Parallel uncertain", "warning", "parallel"));
  if (!candidate) warnings.push(warning("checklist_not_found", "Checklist match not found", "warning"));

  const keyScores = [
    fieldConfidence.cardTitle,
    fieldConfidence.playerOrCharacter,
    fieldConfidence.sportCategory,
    fieldConfidence.year,
    fieldConfidence.brand,
    fieldConfidence.set,
    fieldConfidence.cardNumber
  ].filter((value): value is number => typeof value === "number");
  const fieldAverage = average(keyScores);
  const confidence = candidate
    ? Math.min(99, Math.max(35, Math.round(Math.max(fieldAverage, candidate.score))))
    : Math.min(99, Math.max(35, Math.round(fieldAverage * 0.72 + 45 * 0.28)));
  const hasBlockingWarning = warnings.some((item) => item.severity === "blocking");
  let extractionStatus: ExtractionStatus = "Needs Review";

  if (!hasFront || warnings.some((item) => item.code === "image_mismatch")) {
    extractionStatus = "Blocked";
  } else if (hasBlockingWarning || confidence < 70) {
    extractionStatus = "Needs Research";
  } else if (confidence >= 90 && hasValue(fields.cardTitle) && hasValue(fields.sportCategory)) {
    extractionStatus = "Ready to Approve";
  }

  if (confidence < 70 && !warnings.some((item) => item.code === "low_confidence")) {
    warnings.push(warning("low_confidence", "Low confidence identification", "warning"));
  }
  if (extractionStatus !== "Ready to Approve" && !warnings.some((item) => item.code === "manual_review")) {
    warnings.push(warning("manual_review", "Manual review required", "warning"));
  }

  return {
    confidence,
    fieldConfidence,
    warnings,
    extractionStatus
  };
}
