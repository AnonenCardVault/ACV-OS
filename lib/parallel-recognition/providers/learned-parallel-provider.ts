import type { ParallelProvider, ParallelProviderResult } from "@/lib/parallel-recognition/types";
import { candidateFromEvidence } from "@/lib/parallel-recognition/evidence";
import { normalizeParallelText } from "@/lib/parallel-recognition/normalization";

function contextKey(value: unknown) {
  return normalizeParallelText(value);
}

export class LearnedParallelProvider implements ParallelProvider {
  id = "learned-parallel-provider";
  name = "Learned Parallel Provider";

  analyze(input: Parameters<ParallelProvider["analyze"]>[0]): ParallelProviderResult {
    const corrections = input.learnedCorrections || [];
    const matchingCorrections = corrections.filter((correction) => {
      const context = correction.productContext;
      if (!context) return false;
      return (
        (!context.sportCategory || contextKey(context.sportCategory) === contextKey(input.fields.sportCategory)) &&
        (!context.year || contextKey(context.year) === contextKey(input.fields.year)) &&
        (!context.brand || contextKey(context.brand) === contextKey(input.fields.brand)) &&
        (!context.set || contextKey(context.set) === contextKey(input.fields.set))
      );
    });

    const evidence = matchingCorrections.map((correction) => ({
      source: "learned" as const,
      label: "Confirmed ACV correction",
      value: correction.confirmedParallel,
      confidence: 88,
      detail: correction.originalPrediction
        ? `Prior correction changed ${correction.originalPrediction} to ${correction.confirmedParallel}.`
        : `Prior correction confirmed ${correction.confirmedParallel}.`
    }));

    return {
      providerId: this.id,
      providerName: this.name,
      candidates: evidence.map((item) => candidateFromEvidence(item)),
      evidence,
      warnings: []
    };
  }
}
