import type { AIConfidenceReport, AIFieldConfidenceMap, AIFieldKey, AIProviderOutput, AIWarning, DecisionEngineConfig, ExtractedCardFields, FieldVote } from "@/lib/ai/types";
import { defaultDecisionConfig } from "@/lib/ai/orchestrator/decision-engine";
import { hasBackImage, hasFrontImage, hasFieldValue } from "@/lib/ai/utils/fields";
import type { AIImageInput } from "@/lib/ai/types";

const providerWeights: Record<string, number> = {
  ocr: 0.55,
  cardsight: 1.05,
  checklist: 0.85,
  "gpt-vision": 1.15,
  mock: 0.35
};

const keyFields: AIFieldKey[] = ["cardTitle", "playerOrCharacter", "sportCategory", "year", "brand", "set", "cardNumber"];

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function weightedAverage(votes: FieldVote[], config: DecisionEngineConfig) {
  if (votes.length === 0) return 0;
  const totals = votes.reduce(
    (memo, vote) => {
      const weight = providerWeights[vote.providerKind] || 1;
      memo.score += vote.confidence * weight;
      memo.weight += weight;
      return memo;
    },
    { score: 0, weight: 0 }
  );
  const base = totals.weight ? totals.score / totals.weight : 0;
  const uniqueValues = new Set(votes.map((vote) => normalize(vote.value)).filter(Boolean));
  const agreementBonus = uniqueValues.size <= 1 && votes.length > 1 ? config.fieldAgreementBonus : 0;
  const conflictPenalty = uniqueValues.size > 1 ? config.fieldConflictPenalty : 0;

  return Math.max(0, Math.min(100, Math.round(base + agreementBonus - conflictPenalty)));
}

function collectVotes(outputs: AIProviderOutput[]) {
  const votes: FieldVote[] = [];

  outputs.forEach((output) => {
    Object.entries(output.fields).forEach(([field, value]) => {
      const key = field as AIFieldKey;
      const confidence = output.fieldConfidence[key] ?? output.fieldConfidence.overall ?? 35;
      votes.push({
        field: key,
        value,
        confidence,
        providerId: output.providerId,
        providerKind: output.providerKind
      });
    });
  });

  return votes;
}

function conflictWarnings(votes: FieldVote[]): AIWarning[] {
  const warnings: AIWarning[] = [];
  const fields = new Set(votes.map((vote) => vote.field));

  fields.forEach((field) => {
    const fieldVotes = votes.filter((vote) => vote.field === field);
    const uniqueValues = new Set(fieldVotes.map((vote) => normalize(vote.value)).filter(Boolean));
    if (uniqueValues.size > 1) {
      warnings.push({
        code: `field_conflict_${field}`,
        message: `Providers disagree on ${field}`,
        severity: "warning",
        field
      });
    }
  });

  return warnings;
}

export function calculateAIConfidence({
  fields,
  images,
  providerOutputs,
  config = defaultDecisionConfig
}: {
  fields: ExtractedCardFields;
  images: AIImageInput[];
  providerOutputs: AIProviderOutput[];
  config?: DecisionEngineConfig;
}): AIConfidenceReport {
  const fieldVotes = collectVotes(providerOutputs);
  const fieldConfidence = Array.from(new Set(fieldVotes.map((vote) => vote.field))).reduce<AIFieldConfidenceMap>((memo, field) => {
    memo[field] = weightedAverage(fieldVotes.filter((vote) => vote.field === field), config);
    return memo;
  }, {});
  const warnings: AIWarning[] = providerOutputs.flatMap((output) => output.warnings).concat(conflictWarnings(fieldVotes));

  if (!hasFrontImage(images)) warnings.push({ code: "missing_front", message: "Missing front image", severity: "blocking" });
  if (!hasBackImage(images)) warnings.push({ code: "missing_back", message: "Back image missing", severity: "warning" });
  if (!hasFieldValue(fields.cardTitle)) warnings.push({ code: "missing_title", message: "Missing card title", severity: "blocking", field: "cardTitle" });
  if (!hasFieldValue(fields.sportCategory)) warnings.push({ code: "missing_category", message: "Missing category", severity: "blocking", field: "sportCategory" });
  if (!hasFieldValue(fields.cardNumber)) warnings.push({ code: "card_number_unconfirmed", message: "Card number not confirmed", severity: "warning", field: "cardNumber" });
  if (!hasFieldValue(fields.serialNumber)) warnings.push({ code: "serial_not_detected", message: "Serial number not detected", severity: "info", field: "serialNumber" });
  if ((fieldConfidence.parallel || 0) > 0 && (fieldConfidence.parallel || 0) < config.mediumConfidence) {
    warnings.push({ code: "parallel_uncertain", message: "Parallel uncertain", severity: "warning", field: "parallel" });
  }

  const keyScores = keyFields.map((field) => fieldConfidence[field]).filter((value): value is number => typeof value === "number");
  const overall = Math.max(35, Math.min(99, average(keyScores)));
  const blocking = warnings.some((warning) => warning.severity === "blocking");
  const conflicts = warnings.some((warning) => warning.code.startsWith("field_conflict_"));
  let status: AIConfidenceReport["status"] = "Needs Review";

  if (blocking) status = "Blocked";
  else if (overall < config.mediumConfidence || !hasFieldValue(fields.cardTitle) || !hasFieldValue(fields.sportCategory)) status = "Needs Research";
  else if (overall >= config.highConfidence && !conflicts) status = "Ready to Approve";

  if (status !== "Ready to Approve" && !warnings.some((warning) => warning.code === "manual_review")) {
    warnings.push({ code: "manual_review", message: "Manual review required", severity: "warning" });
  }

  return {
    overall,
    fieldConfidence,
    fieldVotes,
    warnings,
    status
  };
}
