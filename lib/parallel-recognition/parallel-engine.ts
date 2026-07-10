import { CatalogParallelProvider } from "@/lib/parallel-recognition/providers/catalog-parallel-provider";
import { LearnedParallelProvider } from "@/lib/parallel-recognition/providers/learned-parallel-provider";
import { VisualParallelProvider } from "@/lib/parallel-recognition/providers/visual-parallel-provider";
import { clampParallelConfidence, mergeParallelCandidates, serialEvidenceFromFields } from "@/lib/parallel-recognition/evidence";
import { normalizeParallelLabel } from "@/lib/parallel-recognition/normalization";
import type { ParallelCandidate, ParallelRecognitionInput, ParallelRecognitionResult } from "@/lib/parallel-recognition/types";

const providers = [new VisualParallelProvider(), new CatalogParallelProvider(), new LearnedParallelProvider()];

function hasValue(value: unknown) {
  const text = String(value || "").trim();
  return Boolean(text && text !== "-" && text.toLowerCase() !== "raw");
}

function candidateWithSerialEvidence(candidate: ParallelCandidate, denominator?: number) {
  if (!denominator) return candidate;
  return {
    ...candidate,
    serialSupported: true,
    confidence: clampParallelConfidence(candidate.confidence + 4),
    evidence: [
      ...candidate.evidence,
      {
        source: "serial" as const,
        label: "Serial number",
        value: `/${denominator}`,
        confidence: 72,
        detail: `Serial denominator /${denominator} supports narrowing but cannot identify the parallel alone.`
      }
    ]
  };
}

export function recognizeParallel(input: ParallelRecognitionInput): ParallelRecognitionResult {
  const serialEvidence = serialEvidenceFromFields(input.fields);

  if (hasValue(input.userConfirmedParallel)) {
    const normalized = normalizeParallelLabel(input.userConfirmedParallel);
    return {
      status: "confirmed",
      recommendedParallel: normalized,
      normalizedParallel: normalized,
      finalConfirmedParallel: input.userConfirmedParallel,
      userConfirmed: true,
      serialEvidence,
      candidates: [],
      evidence: [
        {
          source: "user_confirmed",
          label: "Confirmed Value",
          value: input.userConfirmedParallel,
          detail: "User-confirmed value is authoritative after save or approval."
        }
      ],
      warnings: []
    };
  }

  const providerResults = providers.map((provider) => provider.analyze(input));
  const warnings = Array.from(new Set(providerResults.flatMap((result) => result.warnings)));
  const evidence = providerResults.flatMap((result) => result.evidence);
  let candidates = mergeParallelCandidates(providerResults.flatMap((result) => result.candidates));
  candidates = candidates.map((candidate) => candidateWithSerialEvidence(candidate, serialEvidence?.denominator));

  if (candidates.length === 0) {
    return {
      status: hasValue(input.fields.parallel) ? "recommended" : "not_found",
      recommendedParallel: normalizeParallelLabel(input.fields.parallel) || undefined,
      normalizedParallel: normalizeParallelLabel(input.fields.parallel) || undefined,
      rawProviderLabel: input.fields.parallel || undefined,
      confidence: hasValue(input.fields.parallel) ? 42 : undefined,
      serialEvidence,
      candidates,
      evidence,
      warnings: hasValue(input.fields.parallel) ? warnings : Array.from(new Set([...warnings, "Parallel not identified."]))
    };
  }

  const [top, second] = candidates;
  const topConfidence = clampParallelConfidence(top.confidence);
  const closeSecond = second && topConfidence - second.confidence <= 8;
  const unsupported = top.warnings.some((warning) => warning.toLowerCase().includes("does not confirm") || warning.toLowerCase().includes("not expose"));
  const status = closeSecond ? "ambiguous" : unsupported ? "unsupported" : "recommended";
  const resultWarnings = [...warnings, ...top.warnings];
  if (closeSecond) resultWarnings.push(`Multiple parallel candidates remain possible: ${top.normalizedLabel}, ${second.normalizedLabel}.`);

  return {
    status,
    recommendedParallel: top.officialCatalogLabel || top.normalizedLabel,
    rawProviderLabel: top.rawLabel,
    normalizedParallel: top.normalizedLabel,
    officialCatalogLabel: top.officialCatalogLabel,
    confidence: unsupported ? Math.min(topConfidence, 68) : closeSecond ? Math.min(topConfidence, 72) : topConfidence,
    catalogSupported: top.catalogSupported,
    serialEvidence,
    candidates,
    evidence: [...evidence, ...top.evidence],
    warnings: Array.from(new Set(resultWarnings))
  };
}
