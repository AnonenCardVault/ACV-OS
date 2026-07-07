import type { AIExtractionInput, AIProviderContext, CardSightProvider } from "@/lib/ai/types";
import { imageTextBlob, selectFrontImage } from "@/lib/ai/utils/fields";
import { matchMockCardProfile } from "@/lib/ai/utils/mock-card-signals";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

export class MockCardSightProvider implements CardSightProvider {
  id = "mock-cardsight";
  kind = "cardsight" as const;
  label = "Mock CardSight";
  version = "0.1.0";
  modelName = "cardsight-mock-front-image";
  promptVersion = "cardsight-front@1.0";
  costTier = "paid" as const;
  status = "mock" as const;

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const frontImage = selectFrontImage(input.images);
    const profile = matchMockCardProfile(imageTextBlob(frontImage ? [frontImage] : input.images, input.existingFields), input.categoryHint);

    if (!profile) {
      return createProviderOutput({
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        providerVersion: this.version,
        modelName: this.modelName,
        promptVersion: this.promptVersion,
        costTier: this.costTier,
        startedAt,
        warnings: [warning("cardsight_no_match", "CardSight mock did not identify the front image", "warning", undefined, this.id)],
        evidence: ["front image mock signals"],
        raw: { expectedFutureInput: "front image only" }
      });
    }

    return createProviderOutput({
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      providerVersion: this.version,
      modelName: this.modelName,
      promptVersion: this.promptVersion,
      costTier: this.costTier,
      startedAt,
      fields: {
        playerOrCharacter: profile.playerOrCharacter,
        year: profile.year,
        brand: profile.brand,
        set: profile.set,
        parallel: profile.parallel,
        sportCategory: profile.sportCategory,
        team: profile.team
      },
      fieldConfidence: {
        playerOrCharacter: Math.min(98, profile.score),
        year: Math.max(72, profile.score - 8),
        brand: Math.max(72, profile.score - 6),
        set: Math.max(68, profile.score - 10),
        parallel: profile.parallel ? Math.max(62, profile.score - 24) : 35,
        sportCategory: Math.min(96, profile.score + 2)
      },
      evidence: profile.matchedSignals.map((signal) => `front signal: ${signal}`),
      raw: {
        frontImageId: frontImage?.id,
        futureProvider: "CardSight front-image identification"
      }
    });
  }
}
