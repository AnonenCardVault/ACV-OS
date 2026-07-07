import type { AIExtractionInput, AIProviderContext, ChecklistProvider } from "@/lib/ai/types";
import { imageTextBlob } from "@/lib/ai/utils/fields";
import { matchMockCardProfile } from "@/lib/ai/utils/mock-card-signals";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

export class MockChecklistProvider implements ChecklistProvider {
  id = "mock-checklist";
  kind = "checklist" as const;
  label = "Mock Checklist Validation";
  version = "0.1.0";
  modelName = "mock-checklist-local-candidates";
  promptVersion = "checklist-validation@1.0";
  costTier = "local" as const;
  status = "mock" as const;

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const providerText = context.providerOutputs
      .flatMap((output) => Object.values(output.fields).map(String))
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
        warnings: [warning("checklist_not_found", "Checklist match not found", "warning", undefined, this.id)],
        evidence: ["mock checklist candidates"],
        raw: { futureResponsibility: "verify set names, numbering, parallels, rookie status" }
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
        rookie: Boolean(profile.rookie)
      },
      fieldConfidence: {
        cardTitle: Math.min(98, profile.score + 2),
        playerOrCharacter: Math.min(99, profile.score + 3),
        sportCategory: Math.min(98, profile.score + 2),
        year: Math.max(76, profile.score - 6),
        brand: Math.max(78, profile.score - 4),
        set: Math.max(76, profile.score - 8),
        cardNumber: profile.cardNumber ? 92 : 35,
        parallel: profile.checklistValidations.parallel ? 100 : profile.parallel ? 72 : 35,
        rookie: profile.checklistValidations.rookie ? 100 : 70,
        suggestedTitle: Math.min(98, profile.score + 2)
      },
      evidence: ["mock checklist candidate", ...Object.entries(profile.checklistValidations).filter(([, valid]) => valid).map(([field]) => `${field} exists`)],
      raw: {
        checklistCandidateId: profile.id,
        validations: profile.checklistValidations
      }
    });
  }
}
