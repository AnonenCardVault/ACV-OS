import type { AIExtractionInput, AIProviderContext, GPTVisionProvider } from "@/lib/ai/types";
import { imageTextBlob } from "@/lib/ai/utils/fields";
import { matchMockCardProfile } from "@/lib/ai/utils/mock-card-signals";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

export class MockGPTVisionProvider implements GPTVisionProvider {
  id = "mock-gpt-vision";
  kind = "gpt-vision" as const;
  label = "Mock GPT Vision";
  version = "0.1.0";
  modelName = "GPT-5.5 Mini mock";
  promptVersion = "sports-card-verification@1.0";
  costTier = "paid" as const;
  status = "mock" as const;

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const providerText = context.providerOutputs
      .flatMap((output) => [...Object.values(output.fields).map(String), ...output.evidence])
      .join(" ");
    const profile = matchMockCardProfile(`${imageTextBlob(input.images, input.existingFields)} ${providerText}`, input.categoryHint);

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
          sportCategory: input.categoryHint || input.existingFields?.sportCategory || "Other",
          grader: input.existingFields?.grader || "Raw",
          grade: input.existingFields?.grade || "Raw",
          conditionNotes: "Mock GPT Vision could not identify stronger card details.",
          uncertaintyNotes: "Manual review required. Future GPT provider will use front/back images plus OCR, CardSight, and checklist context."
        },
        fieldConfidence: {
          cardTitle: 42,
          playerOrCharacter: 35,
          sportCategory: input.categoryHint ? 58 : 38,
          suggestedTitle: 38,
          condition: 40
        },
        warnings: [warning("gpt_mock_low_confidence", "Mock GPT Vision returned low confidence", "warning", undefined, this.id)],
        evidence: ["front/back image placeholders", "provider context"],
        raw: { futureModel: "GPT-5.5 Mini front/back verification" }
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
        cardTitle: profile.cardTitle,
        playerOrCharacter: profile.playerOrCharacter,
        team: profile.team,
        sportCategory: profile.sportCategory,
        year: profile.year,
        brand: profile.brand,
        set: profile.set,
        cardNumber: profile.cardNumber,
        parallel: profile.parallel,
        serialNumber: profile.serialNumber || "",
        rookie: Boolean(profile.rookie),
        auto: Boolean(profile.auto),
        relic: Boolean(profile.relic),
        variation: Boolean(profile.variation),
        grader: input.existingFields?.grader || "Raw",
        grade: input.existingFields?.grade || "Raw",
        conditionNotes: `Mock GPT reviewed ${profile.playerOrCharacter || "the card"}. Confirm condition, surface, corners, and final marketplace title manually.`,
        uncertaintyNotes: profile.serialNumber ? "Serial number included in mock context." : "Serial number not detected. Confirm serial and card number before final approval."
      },
      fieldConfidence: {
        cardTitle: Math.min(98, profile.score + 1),
        playerOrCharacter: Math.min(98, profile.score + 2),
        team: Math.max(76, profile.score - 8),
        sportCategory: Math.min(97, profile.score + 2),
        year: Math.max(82, profile.score - 5),
        brand: Math.max(84, profile.score - 3),
        set: Math.max(80, profile.score - 7),
        cardNumber: profile.cardNumber ? 88 : 42,
        parallel: profile.parallel ? Math.max(70, profile.score - 20) : 35,
        serialNumber: profile.serialNumber ? 86 : 35,
        suggestedTitle: Math.min(96, profile.score),
        condition: 58
      },
      warnings: profile.serialNumber ? [] : [warning("serial_not_detected", "Serial number not detected", "info", "serialNumber", this.id)],
      evidence: ["front/back mock review", ...profile.matchedSignals.map((signal) => `signal: ${signal}`)],
      raw: { futureModel: "GPT-5.5 Mini", contextProviders: context.providerOutputs.map((output) => output.providerId) }
    });
  }
}
