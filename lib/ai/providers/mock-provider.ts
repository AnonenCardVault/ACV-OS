import type { AIExtractionInput, AIProviderContext, MockProvider } from "@/lib/ai/types";
import { imageTextBlob } from "@/lib/ai/utils/fields";
import { matchMockCardProfile } from "@/lib/ai/utils/mock-card-signals";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

export class ACVMockProvider implements MockProvider {
  id = "acv-mock-provider";
  kind = "mock" as const;
  label = "ACV Mock Provider";
  version = "0.1.0";
  modelName = "acv-local-mock";
  promptVersion = "mock-fallback@1.0";
  costTier = "local" as const;
  status = "mock" as const;

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const profile = matchMockCardProfile(imageTextBlob(input.images, input.existingFields), input.categoryHint);

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
        fields: {
          cardTitle: input.existingFields?.cardTitle || "Unidentified Card",
          playerOrCharacter: input.existingFields?.playerOrCharacter || "Pending manual review",
          sportCategory: input.categoryHint || input.existingFields?.sportCategory || "Other"
        },
        fieldConfidence: {
          cardTitle: 42,
          playerOrCharacter: 35,
          sportCategory: input.categoryHint ? 58 : 38
        },
        warnings: [warning("mock_provider_generic", "Generic mock provider used", "info", undefined, this.id)],
        evidence: ["mock fallback"]
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
      fields: profile,
      fieldConfidence: {
        cardTitle: Math.min(96, profile.score),
        playerOrCharacter: Math.min(97, profile.score + 1),
        sportCategory: Math.min(96, profile.score),
        year: Math.max(78, profile.score - 8),
        brand: Math.max(78, profile.score - 8),
        set: Math.max(74, profile.score - 12),
        cardNumber: profile.cardNumber ? 84 : 35,
        parallel: profile.parallel ? 68 : 35,
        suggestedTitle: Math.min(94, profile.score)
      },
      evidence: profile.matchedSignals.map((signal) => `mock signal: ${signal}`),
      raw: { profileId: profile.id }
    });
  }
}
