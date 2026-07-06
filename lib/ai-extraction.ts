import type { AiExtractionStatus, AiFieldConfidenceMap, IntakeImage, ProposedRecord } from "@/lib/acv-local-state";

export type ExtractCardInput = {
  images: IntakeImage[];
  imageRoles?: Array<{ id: string; role: string }>;
  categoryHint?: string;
  existingValues: ProposedRecord;
};

export type ExtractionResult = {
  status: AiExtractionStatus;
  extracted: Partial<ProposedRecord>;
  confidenceScore: number;
  fieldConfidence: AiFieldConfidenceMap;
  warnings: string[];
  suggestedTitle: string;
  extractedAt: string;
  modelLabel: string;
};

const modelLabel = "ACV local mock extractor";

function textValue(value: unknown) {
  return String(value || "").trim();
}

function hasUsableValue(value: unknown) {
  const normalized = textValue(value).toLowerCase();
  return Boolean(normalized && normalized !== "-" && normalized !== "pending" && normalized !== "pending manual review");
}

function buildSearchText(input: ExtractCardInput) {
  const fields = [
    input.categoryHint,
    input.existingValues.cardName,
    input.existingValues.playerCharacter,
    input.existingValues.team,
    input.existingValues.category,
    input.existingValues.year,
    input.existingValues.brand,
    input.existingValues.set,
    input.existingValues.parallel,
    ...input.images.flatMap((image) => [image.fileName, image.label, image.role])
  ];

  return fields.join(" ").toLowerCase();
}

function mergeDefaults(existing: ProposedRecord, extracted: Partial<ProposedRecord>) {
  return Object.fromEntries(
    Object.entries(extracted).map(([key, value]) => {
      if (typeof value === "boolean") return [key, value];
      if (typeof value === "number") return [key, value];
      return [key, hasUsableValue(value) ? value : existing[key as keyof ProposedRecord]];
    })
  ) as Partial<ProposedRecord>;
}

function suggestedTitle(record: Partial<ProposedRecord>) {
  const parts = [
    record.year,
    record.brand,
    record.set,
    record.playerCharacter,
    record.parallel,
    record.cardNumber ? `#${String(record.cardNumber).replace(/^#/, "")}` : "",
    record.rookieFlag ? "RC" : "",
    record.autoFlag ? "Auto" : "",
    record.relicFlag ? "Relic" : ""
  ];

  return parts
    .map(textValue)
    .filter((part) => part && part !== "-")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function resultStatus(confidenceScore: number, warnings: string[], hasFront: boolean): AiExtractionStatus {
  if (!hasFront) return "Failed";
  if (confidenceScore < 90 || warnings.some((warning) => /missing|mismatch|low confidence/i.test(warning))) return "Needs Review";
  return "Extracted";
}

// Future real AI boundary: replace this function body with an API call while preserving ExtractionResult.
export function extractCardFromImages(input: ExtractCardInput): ExtractionResult {
  const searchText = buildSearchText(input);
  const hasFront = input.images.some((image) => image.role === "Front");
  const hasBack = input.images.some((image) => image.role === "Back");
  const baseWarnings: string[] = [];

  if (!hasFront) baseWarnings.push("Front image missing");
  if (!hasBack) baseWarnings.push("Back image missing");

  let extracted: Partial<ProposedRecord>;
  let confidenceScore = 62;
  let fieldConfidence: AiFieldConfidenceMap = {
    cardName: 58,
    playerCharacter: 54,
    category: 62,
    year: 42,
    brand: 46,
    set: 44,
    cardNumber: 36,
    parallel: 32,
    suggestedTitle: 52
  };
  let warnings = [...baseWarnings, "Low confidence identification", "Card number not confirmed"];

  if (/drake|maye/.test(searchText)) {
    extracted = {
      cardName: "2024-25 Panini Phoenix Drake Maye Rookie #154 RC",
      playerCharacter: "Drake Maye",
      team: "New England Patriots",
      category: "Football",
      year: "2024-25",
      brand: "Panini",
      set: "Phoenix",
      cardNumber: "154",
      parallel: "Rookie",
      serialNumber: "-",
      rookieFlag: true,
      autoFlag: false,
      relicFlag: false,
      variationFlag: false,
      grader: "Raw",
      grade: "Raw",
      conditionNotes: "Mock AI found a Drake Maye football card from local filename/title context. Confirm surface and corners manually.",
      uncertaintyNotes: "Serial number not detected in mock extraction.",
      purchaseCost: input.existingValues.purchaseCost,
      quantity: input.existingValues.quantity || 1,
      acquisitionSource: input.existingValues.acquisitionSource || "Computer Upload",
      location: input.existingValues.location || "Photo Intake",
      internalNotes: input.existingValues.internalNotes
    };
    confidenceScore = 94;
    fieldConfidence = {
      cardName: 95,
      playerCharacter: 97,
      team: 92,
      category: 96,
      year: 88,
      brand: 89,
      set: 84,
      cardNumber: 82,
      parallel: 72,
      serialNumber: 45,
      suggestedTitle: 93
    };
    warnings = [...baseWarnings, "Serial number not detected"];
  } else if (/stroud|c\.?j\.?/.test(searchText)) {
    extracted = {
      cardName: "2023 Panini Prizm CJ Stroud Silver Rookie #339 RC",
      playerCharacter: "CJ Stroud",
      team: "Houston Texans",
      category: "Football",
      year: "2023",
      brand: "Panini",
      set: "Prizm",
      cardNumber: "339",
      parallel: "Silver",
      serialNumber: "-",
      rookieFlag: true,
      autoFlag: false,
      relicFlag: false,
      variationFlag: false,
      grader: "Raw",
      grade: "Raw",
      conditionNotes: "Mock AI matched CJ Stroud Prizm context. Confirm parallel from surface photo.",
      uncertaintyNotes: "Parallel confidence is medium in mock extraction.",
      purchaseCost: input.existingValues.purchaseCost,
      quantity: input.existingValues.quantity || 1,
      acquisitionSource: input.existingValues.acquisitionSource || "Computer Upload",
      location: input.existingValues.location || "Photo Intake",
      internalNotes: input.existingValues.internalNotes
    };
    confidenceScore = 96;
    fieldConfidence = {
      cardName: 96,
      playerCharacter: 98,
      team: 94,
      category: 96,
      year: 93,
      brand: 90,
      set: 88,
      cardNumber: 84,
      parallel: 74,
      suggestedTitle: 94
    };
    warnings = [...baseWarnings, "Parallel should be confirmed"];
  } else if (/ohtani|shohei/.test(searchText)) {
    extracted = {
      cardName: "2018 Topps Update Shohei Ohtani Rookie #US1 RC",
      playerCharacter: "Shohei Ohtani",
      team: "Los Angeles Angels",
      category: "Baseball",
      year: "2018",
      brand: "Topps",
      set: "Update",
      cardNumber: "US1",
      parallel: "-",
      serialNumber: "-",
      rookieFlag: true,
      autoFlag: false,
      relicFlag: false,
      variationFlag: false,
      grader: "Raw",
      grade: "Raw",
      conditionNotes: "Mock AI matched Shohei Ohtani baseball context.",
      uncertaintyNotes: "Team/year should be confirmed against the card back.",
      purchaseCost: input.existingValues.purchaseCost,
      quantity: input.existingValues.quantity || 1,
      acquisitionSource: input.existingValues.acquisitionSource || "Computer Upload",
      location: input.existingValues.location || "Photo Intake",
      internalNotes: input.existingValues.internalNotes
    };
    confidenceScore = 91;
    fieldConfidence = {
      cardName: 90,
      playerCharacter: 97,
      team: 78,
      category: 95,
      year: 82,
      brand: 80,
      set: 76,
      cardNumber: 70,
      suggestedTitle: 88
    };
    warnings = [...baseWarnings, "Team/year should be confirmed"];
  } else if (/charizard|pokemon|pok[eé]mon/.test(searchText)) {
    extracted = {
      cardName: "Pokemon Charizard Card - Set Pending",
      playerCharacter: "Charizard",
      team: "Pokemon",
      category: "Pokemon",
      year: input.existingValues.year || "-",
      brand: "Pokemon",
      set: input.existingValues.set || "Pending",
      cardNumber: input.existingValues.cardNumber || "-",
      parallel: input.existingValues.parallel || "-",
      serialNumber: "-",
      rookieFlag: false,
      autoFlag: false,
      relicFlag: false,
      variationFlag: false,
      grader: "Raw",
      grade: "Raw",
      conditionNotes: "Mock AI matched Charizard/Pokemon context. Confirm set symbol and card number.",
      uncertaintyNotes: "Set and card number need confirmation.",
      purchaseCost: input.existingValues.purchaseCost,
      quantity: input.existingValues.quantity || 1,
      acquisitionSource: input.existingValues.acquisitionSource || "Computer Upload",
      location: input.existingValues.location || "Photo Intake",
      internalNotes: input.existingValues.internalNotes
    };
    confidenceScore = 86;
    fieldConfidence = {
      cardName: 84,
      playerCharacter: 93,
      category: 94,
      brand: 80,
      set: 48,
      cardNumber: 42,
      parallel: 40,
      suggestedTitle: 78
    };
    warnings = [...baseWarnings, "Set and card number need confirmation"];
  } else {
    extracted = {
      cardName: hasUsableValue(input.existingValues.cardName) ? input.existingValues.cardName : "Unidentified Card",
      playerCharacter: hasUsableValue(input.existingValues.playerCharacter) ? input.existingValues.playerCharacter : "Pending manual review",
      team: hasUsableValue(input.existingValues.team) ? input.existingValues.team : "Pending",
      category: input.categoryHint || input.existingValues.category || "Other",
      year: input.existingValues.year || "-",
      brand: input.existingValues.brand || "-",
      set: input.existingValues.set || "-",
      cardNumber: input.existingValues.cardNumber || "-",
      parallel: input.existingValues.parallel || "-",
      serialNumber: input.existingValues.serialNumber || "-",
      rookieFlag: input.existingValues.rookieFlag,
      autoFlag: input.existingValues.autoFlag,
      relicFlag: input.existingValues.relicFlag,
      variationFlag: input.existingValues.variationFlag,
      grader: input.existingValues.grader || "Raw",
      grade: input.existingValues.grade || "Raw",
      conditionNotes: "Mock AI could not confidently identify this card. Manual review required.",
      uncertaintyNotes: "Low confidence identification. Confirm title, category, year, set, card number, and parallel.",
      purchaseCost: input.existingValues.purchaseCost,
      quantity: input.existingValues.quantity || 1,
      acquisitionSource: input.existingValues.acquisitionSource || "Computer Upload",
      location: input.existingValues.location || "Photo Intake",
      internalNotes: input.existingValues.internalNotes
    };
  }

  const mergedExtracted = mergeDefaults(input.existingValues, extracted);
  const title = suggestedTitle(mergedExtracted) || textValue(mergedExtracted.cardName) || "Unidentified Card";

  return {
    status: resultStatus(confidenceScore, warnings, hasFront),
    extracted: mergedExtracted,
    confidenceScore,
    fieldConfidence,
    warnings,
    suggestedTitle: title,
    extractedAt: new Date().toISOString(),
    modelLabel
  };
}
