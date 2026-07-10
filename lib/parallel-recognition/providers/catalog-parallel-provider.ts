import type { ParallelProvider, ParallelProviderResult } from "@/lib/parallel-recognition/types";
import { candidateFromEvidence } from "@/lib/parallel-recognition/evidence";
import { isPokemonFinishLabel, normalizeParallelLabel, parallelLabelsMatch } from "@/lib/parallel-recognition/normalization";

function raritySupportsFinish(rarity?: string, proposed?: string) {
  const rarityText = String(rarity || "").toLowerCase();
  const proposedText = String(proposed || "").toLowerCase();
  if (!proposedText) return false;
  if (proposedText.includes("reverse holo")) return rarityText.includes("holo");
  if (proposedText.includes("holo")) return rarityText.includes("holo");
  return false;
}

export class CatalogParallelProvider implements ParallelProvider {
  id = "catalog-parallel-provider";
  name = "Catalog Parallel Provider";

  analyze(input: Parameters<ParallelProvider["analyze"]>[0]): ParallelProviderResult {
    const validation = input.catalogValidation;
    const warnings: string[] = [];
    const evidence = [];
    const candidates = [];
    const proposed = normalizeParallelLabel(input.fields.parallel);

    if (!validation) {
      return {
        providerId: this.id,
        providerName: this.name,
        candidates: [],
        evidence: [],
        warnings: ["Catalog validation did not run for parallel recognition."]
      };
    }

    if (!proposed) {
      return {
        providerId: this.id,
        providerName: this.name,
        candidates: [],
        evidence: [],
        warnings: ["No proposed parallel to validate against catalog."]
      };
    }

    const matched = validation.matchedCard;
    if (validation.providerId.includes("pokemon")) {
      if (isPokemonFinishLabel(proposed) && !raritySupportsFinish(matched?.rarity, proposed)) {
        warnings.push("Pokémon catalog does not confirm this finish. Keep rarity separate from visual finish.");
      } else if (isPokemonFinishLabel(proposed) && raritySupportsFinish(matched?.rarity, proposed)) {
        const catalogEvidence = {
          source: "catalog" as const,
          label: validation.providerName,
          value: proposed,
          confidence: validation.confidence,
          detail: `Pokémon rarity supports ${proposed}: ${matched?.rarity || "catalog rarity"}`
        };
        evidence.push(catalogEvidence);
        candidates.push({ ...candidateFromEvidence(catalogEvidence), catalogSupported: true, officialCatalogLabel: proposed });
      }
    } else if (matched?.subset && parallelLabelsMatch(proposed, matched.subset)) {
      const catalogEvidence = {
        source: "catalog" as const,
        label: validation.providerName,
        value: proposed,
        confidence: validation.confidence,
        detail: `Catalog subset/insert matches ${matched.subset}`
      };
      evidence.push(catalogEvidence);
      candidates.push({ ...candidateFromEvidence(catalogEvidence), catalogSupported: true, officialCatalogLabel: matched.subset });
    } else {
      warnings.push("Catalog does not expose a definitive parallel list for this matched card yet.");
    }

    return {
      providerId: this.id,
      providerName: this.name,
      candidates,
      evidence,
      warnings
    };
  }
}
