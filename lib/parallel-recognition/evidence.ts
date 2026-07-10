import type { AIProviderOutput, ExtractedCardFields } from "@/lib/ai/types";
import type { ParallelCandidate, ParallelEvidence, SerialParallelEvidence } from "@/lib/parallel-recognition/types";
import { normalizeParallelLabel, normalizeParallelText } from "@/lib/parallel-recognition/normalization";

export function clampParallelConfidence(value: number) {
  return Math.max(0, Math.min(99, Math.round(value)));
}

export function serialEvidenceFromFields(fields: Pick<ExtractedCardFields, "serialNumber">): SerialParallelEvidence | undefined {
  const raw = String(fields.serialNumber || "").trim();
  if (!raw) return undefined;
  const denominatorMatch = raw.match(/\/\s*(\d{1,4})\b/);
  const denominator = denominatorMatch ? Number(denominatorMatch[1]) : undefined;

  return {
    rawSerialNumber: raw,
    denominator,
    detail: denominator
      ? `Visible serial denominator /${denominator} can narrow valid parallels but is not enough by itself.`
      : "Serial number detected, but no denominator was parsed."
  };
}

export function providerParallelEvidence(output: AIProviderOutput): ParallelEvidence | undefined {
  const label = output.fields.parallel;
  const normalized = normalizeParallelLabel(label);
  if (!normalized) return undefined;

  return {
    source: output.providerKind === "cardsight" ? "cardsight" : output.providerKind === "gpt-vision" ? "gpt" : "visual",
    label: output.providerLabel,
    value: normalized,
    confidence: output.fieldConfidence.parallel ?? output.providerConfidence,
    detail: `Provider proposed ${label}`,
    providerName: output.providerLabel
  };
}

export function candidateFromEvidence(evidence: ParallelEvidence, warning?: string): ParallelCandidate {
  const normalizedLabel = normalizeParallelLabel(evidence.value);
  return {
    rawLabel: evidence.value || "",
    normalizedLabel,
    confidence: clampParallelConfidence(evidence.confidence ?? 45),
    evidence: [evidence],
    warnings: warning ? [warning] : []
  };
}

export function mergeParallelCandidates(candidates: ParallelCandidate[]) {
  const byLabel = new Map<string, ParallelCandidate>();

  for (const candidate of candidates) {
    const key = normalizeParallelText(candidate.officialCatalogLabel || candidate.normalizedLabel);
    if (!key) continue;
    const existing = byLabel.get(key);
    if (!existing) {
      byLabel.set(key, { ...candidate, evidence: [...candidate.evidence], warnings: [...candidate.warnings] });
      continue;
    }

    const evidence = [...existing.evidence, ...candidate.evidence];
    const uniqueSources = new Set(evidence.map((item) => `${item.source}:${item.value || item.detail || item.label}`));
    byLabel.set(key, {
      ...existing,
      confidence: clampParallelConfidence(Math.max(existing.confidence, candidate.confidence) + Math.min(12, uniqueSources.size * 3)),
      catalogSupported: existing.catalogSupported || candidate.catalogSupported,
      serialSupported: existing.serialSupported || candidate.serialSupported,
      officialCatalogLabel: existing.officialCatalogLabel || candidate.officialCatalogLabel,
      evidence,
      warnings: Array.from(new Set([...existing.warnings, ...candidate.warnings]))
    });
  }

  return Array.from(byLabel.values()).sort((a, b) => b.confidence - a.confidence);
}
