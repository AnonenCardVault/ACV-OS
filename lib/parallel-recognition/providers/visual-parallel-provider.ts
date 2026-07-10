import { candidateFromEvidence, providerParallelEvidence } from "@/lib/parallel-recognition/evidence";
import { normalizeParallelLabel } from "@/lib/parallel-recognition/normalization";
import type { ParallelProvider, ParallelProviderResult } from "@/lib/parallel-recognition/types";

export class VisualParallelProvider implements ParallelProvider {
  id = "visual-parallel-provider";
  name = "Visual Parallel Provider";

  analyze(input: Parameters<ParallelProvider["analyze"]>[0]): ParallelProviderResult {
    const evidence = (input.providerOutputs || []).map(providerParallelEvidence).filter((item): item is NonNullable<typeof item> => Boolean(item));
    const roleEvidence = input.images
      .filter((image) => ["Holo / Surface", "Serial Closeup"].includes(String(image.role)))
      .map((image) => ({
        source: "visual" as const,
        label: String(image.role),
        value: image.role === "Holo / Surface" ? normalizeParallelLabel(input.fields.parallel) : undefined,
        confidence: image.role === "Holo / Surface" ? 58 : 48,
        detail: `${image.role} image is available for manual/AI review.`
      }));
    const allEvidence = [...evidence, ...roleEvidence];
    const candidates = evidence.map((item) => candidateFromEvidence(item));

    return {
      providerId: this.id,
      providerName: this.name,
      candidates,
      evidence: allEvidence,
      warnings: candidates.length === 0 ? ["No visual provider produced a parallel recommendation."] : []
    };
  }
}
