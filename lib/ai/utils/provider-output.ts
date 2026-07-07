import type { AIProviderCostTier, AIProviderKind, AIProviderOutput, AIWarning, ExtractedCardFields, AIFieldConfidenceMap } from "@/lib/ai/types";

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function createProviderOutput({
  providerId,
  providerKind,
  providerLabel,
  providerVersion,
  modelName,
  promptVersion,
  costTier,
  startedAt,
  fields,
  fieldConfidence,
  providerConfidence,
  warnings,
  evidence,
  raw,
  status = "success"
}: {
  providerId: string;
  providerKind: AIProviderKind;
  providerLabel: string;
  providerVersion: string;
  modelName?: string;
  promptVersion?: string;
  costTier?: AIProviderCostTier;
  startedAt: number;
  fields?: Partial<ExtractedCardFields>;
  fieldConfidence?: AIFieldConfidenceMap;
  providerConfidence?: number;
  warnings?: AIWarning[];
  evidence?: string[];
  raw?: Record<string, unknown>;
  status?: AIProviderOutput["status"];
}): AIProviderOutput {
  const defaultCostTier: Record<AIProviderKind, AIProviderCostTier> = {
    ocr: "local",
    checklist: "local",
    cardsight: "paid",
    "gpt-vision": "paid",
    mock: "local"
  };
  const nextModelName = modelName || providerLabel;
  const nextPromptVersion = promptVersion || "1.0";
  const nextCostTier = costTier || defaultCostTier[providerKind] || "local";
  const confidence = providerConfidence ?? average(Object.values(fieldConfidence || {}).filter((value): value is number => typeof value === "number"));
  const timestamp = new Date().toISOString();
  const metadata = {
    providerName: providerLabel,
    providerVersion,
    modelName: nextModelName,
    promptVersion: nextPromptVersion,
    timestamp,
    providerConfidence: confidence,
    costTier: nextCostTier
  };

  return {
    providerId,
    providerKind,
    providerLabel,
    providerVersion,
    modelName: nextModelName,
    promptVersion: nextPromptVersion,
    timestamp,
    providerConfidence: confidence,
    costTier: nextCostTier,
    status,
    elapsedMs: Date.now() - startedAt,
    fields: fields || {},
    fieldConfidence: fieldConfidence || {},
    warnings: warnings || [],
    evidence: evidence || [],
    metadata,
    raw
  };
}

export function warning(code: string, message: string, severity: AIWarning["severity"], field?: AIWarning["field"], providerId?: string): AIWarning {
  return { code, message, severity, field, providerId };
}
