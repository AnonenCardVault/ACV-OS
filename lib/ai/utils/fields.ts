import type { AIImageInput, ExtractedCardFields } from "@/lib/ai/types";

export function cleanValue(value: unknown) {
  return String(value || "").trim();
}

export function hasFieldValue(value: unknown) {
  const normalized = cleanValue(value).toLowerCase();
  return Boolean(normalized && normalized !== "-" && normalized !== "pending" && normalized !== "pending manual review");
}

export function blankCardFields(): ExtractedCardFields {
  return {
    cardTitle: "",
    playerOrCharacter: "",
    team: "",
    sportCategory: "",
    year: "",
    brand: "",
    set: "",
    cardNumber: "",
    parallel: "",
    serialNumber: "",
    rookie: false,
    auto: false,
    relic: false,
    variation: false,
    grader: "Raw",
    grade: "Raw",
    conditionNotes: "",
    uncertaintyNotes: ""
  };
}

export function mergeCardFields(existing: Partial<ExtractedCardFields> | undefined, extracted: Partial<ExtractedCardFields>, fallbackCategory = "Other"): ExtractedCardFields {
  const merged = { ...blankCardFields(), ...existing, ...extracted };

  return {
    ...merged,
    sportCategory: hasFieldValue(merged.sportCategory) ? merged.sportCategory : fallbackCategory,
    grader: merged.grader || "Raw",
    grade: merged.grade || "Raw"
  };
}

export function createSuggestedTitle(fields: Partial<ExtractedCardFields>) {
  return [
    fields.year,
    fields.brand,
    fields.set,
    fields.playerOrCharacter,
    fields.parallel,
    fields.cardNumber ? `#${String(fields.cardNumber).replace(/^#/, "")}` : "",
    fields.rookie ? "RC" : "",
    fields.auto ? "Auto" : "",
    fields.relic ? "Relic" : ""
  ]
    .map(cleanValue)
    .filter((part) => part && part !== "-")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function imageTextBlob(images: AIImageInput[], existingFields?: Partial<ExtractedCardFields>) {
  const imageText = images
    .map((image) => [image.fileName, image.label, image.role].map(cleanValue).join(" "))
    .join(" ");
  const fieldText = Object.values(existingFields || {}).map(cleanValue).join(" ");
  return `${imageText} ${fieldText}`.replace(/\s+/g, " ").trim();
}

export function selectFrontImage(images: AIImageInput[]) {
  const ordered = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return ordered.find((image) => image.role === "Front") || ordered[0];
}

export function hasFrontImage(images: AIImageInput[]) {
  return images.some((image) => image.role === "Front");
}

export function hasBackImage(images: AIImageInput[]) {
  return images.some((image) => image.role === "Back");
}
