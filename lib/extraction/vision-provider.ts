import type { CardExtractionInput, VisionProviderResult } from "@/lib/extraction/types";

export interface VisionProvider {
  extract(input: CardExtractionInput): Promise<VisionProviderResult> | VisionProviderResult;
}

export function runMockVisionFallback(input: CardExtractionInput): VisionProviderResult {
  const category = input.categoryHint || input.existingFields?.sportCategory || "Other";

  return {
    fields: {
      cardTitle: input.existingFields?.cardTitle || "Unidentified Card",
      playerOrCharacter: input.existingFields?.playerOrCharacter || "Pending manual review",
      team: input.existingFields?.team || "Pending",
      sportCategory: category,
      year: input.existingFields?.year || "-",
      brand: input.existingFields?.brand || "-",
      set: input.existingFields?.set || "-",
      cardNumber: input.existingFields?.cardNumber || "-",
      parallel: input.existingFields?.parallel || "-",
      serialNumber: input.existingFields?.serialNumber || "-",
      rookie: Boolean(input.existingFields?.rookie),
      auto: Boolean(input.existingFields?.auto),
      relic: Boolean(input.existingFields?.relic),
      variation: Boolean(input.existingFields?.variation),
      grader: input.existingFields?.grader || "Raw",
      grade: input.existingFields?.grade || "Raw",
      conditionNotes: "Mock vision fallback did not identify a stronger card profile.",
      uncertaintyNotes: "Future paid vision provider can review images when OCR/rules/checklists need help."
    },
    confidence: 48,
    fieldConfidence: {
      cardTitle: 42,
      playerOrCharacter: 35,
      sportCategory: category === "Other" ? 38 : 58,
      year: 30,
      brand: 32,
      set: 30,
      cardNumber: 25,
      parallel: 20,
      suggestedTitle: 38
    },
    warnings: [{ code: "vision_fallback_mock", message: "Vision fallback mock used", severity: "info" }],
    sources: ["mock vision fallback"]
  };
}

// Paid AI providers should plug in here only after OCR, rules, and checklist matching cannot resolve the card confidently.
