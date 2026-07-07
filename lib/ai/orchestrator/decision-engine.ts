import type { AIDecision, AIProviderOutput, DecisionEngineConfig } from "@/lib/ai/types";

export const defaultDecisionConfig: DecisionEngineConfig = {
  highConfidence: 90,
  mediumConfidence: 70,
  lowConfidence: 45,
  poorImageQuality: 45,
  localRulesSufficientConfidence: 88,
  cardSightChecklistSkipGptConfidence: 94,
  gptVerificationRequiredBelow: 90,
  fieldAgreementBonus: 6,
  fieldConflictPenalty: 18
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function decideAfterOCR(outputs: AIProviderOutput[], config: DecisionEngineConfig = defaultDecisionConfig): AIDecision {
  const ocr = outputs.find((output) => output.providerKind === "ocr");
  const scores = Object.values(ocr?.fieldConfidence || {}).filter((value): value is number => typeof value === "number");
  const confidence = average(scores);

  if (!ocr || ocr.status !== "success") {
    return { stage: "OCR Quick Pass", route: "manual-review", reason: "OCR quick pass unavailable", thresholdKey: "lowConfidence", confidence };
  }

  if (confidence < config.lowConfidence) {
    return { stage: "OCR Quick Pass", route: "run-additional-provider", reason: "OCR is weak, continue with visual providers", thresholdKey: "lowConfidence", confidence };
  }

  return { stage: "OCR Quick Pass", route: "continue", reason: "OCR gathered routing context", thresholdKey: "mediumConfidence", confidence };
}

export function decideAfterImageProcessing(qualityScore: number, config: DecisionEngineConfig = defaultDecisionConfig): AIDecision {
  if (qualityScore < config.poorImageQuality) {
    return { stage: "Image Processing", route: "retake-image", reason: "Image quality is below extraction threshold", thresholdKey: "poorImageQuality", confidence: qualityScore };
  }

  return { stage: "Image Processing", route: "continue", reason: "Images are usable for extraction", thresholdKey: "poorImageQuality", confidence: qualityScore };
}

export function decideAfterProvider(outputs: AIProviderOutput[], config: DecisionEngineConfig = defaultDecisionConfig): AIDecision {
  const scores = outputs.flatMap((output) => Object.values(output.fieldConfidence)).filter((value): value is number => typeof value === "number");
  const confidence = average(scores);
  const hasBlocking = outputs.some((output) => output.warnings.some((warning) => warning.severity === "blocking"));

  if (hasBlocking) {
    return { stage: "Provider Review", route: "blocked", reason: "A provider found a blocking issue", confidence };
  }

  if (confidence >= config.highConfidence) {
    return { stage: "Provider Review", route: "continue", reason: "Provider confidence is high", thresholdKey: "highConfidence", confidence };
  }

  if (confidence >= config.mediumConfidence) {
    return { stage: "Provider Review", route: "run-additional-provider", reason: "Medium confidence needs corroboration", thresholdKey: "mediumConfidence", confidence };
  }

  return { stage: "Provider Review", route: "manual-review", reason: "Low confidence provider output", thresholdKey: "lowConfidence", confidence };
}

export function decideAfterLocalRules(outputs: AIProviderOutput[], config: DecisionEngineConfig = defaultDecisionConfig): AIDecision {
  const localOutputs = outputs.filter((output) => output.costTier !== "paid");
  const scores = localOutputs.flatMap((output) => Object.values(output.fieldConfidence)).filter((value): value is number => typeof value === "number");
  const confidence = average(scores);
  const strongLocalValidation = localOutputs.some((output) => output.providerKind !== "ocr" && output.providerConfidence >= config.localRulesSufficientConfidence);

  if (confidence >= config.localRulesSufficientConfidence || strongLocalValidation) {
    return {
      stage: "Local Rules",
      route: "skip-provider",
      reason: "OCR and local checklist confidence are sufficient; skip paid providers",
      thresholdKey: "localRulesSufficientConfidence",
      confidence: Math.max(confidence, ...localOutputs.map((output) => output.providerConfidence))
    };
  }

  return { stage: "Local Rules", route: "run-additional-provider", reason: "Local rules need visual provider support", thresholdKey: "localRulesSufficientConfidence", confidence };
}

export function decideGPTNeed(outputs: AIProviderOutput[], config: DecisionEngineConfig = defaultDecisionConfig): AIDecision {
  const scores = outputs.flatMap((output) => Object.values(output.fieldConfidence)).filter((value): value is number => typeof value === "number");
  const confidence = average(scores);
  const hasChecklistSupport = outputs.some((output) => output.providerKind === "checklist" && output.status === "success" && output.providerConfidence >= config.mediumConfidence);
  const needsBackImageReading = outputs.some((output) => output.warnings.some((warning) => ["serial_not_detected", "card_number_unconfirmed", "parallel_uncertain"].includes(warning.code)));

  if (confidence >= config.cardSightChecklistSkipGptConfidence && hasChecklistSupport && !needsBackImageReading) {
    return { stage: "GPT Verification", route: "skip-provider", reason: "CardSight/checklist confidence exceeds GPT skip threshold", thresholdKey: "cardSightChecklistSkipGptConfidence", confidence };
  }

  if (confidence >= config.mediumConfidence && (confidence < config.gptVerificationRequiredBelow || needsBackImageReading)) {
    return { stage: "GPT Verification", route: "run-additional-provider", reason: "GPT verification needed for final mapping or back-image details", thresholdKey: "gptVerificationRequiredBelow", confidence };
  }

  if (confidence >= config.mediumConfidence) {
    return { stage: "GPT Verification", route: "run-additional-provider", reason: "Provider confidence is medium; GPT verification is allowed", thresholdKey: "mediumConfidence", confidence };
  }

  return { stage: "GPT Verification", route: "manual-review", reason: "Confidence remains too low for paid verification", thresholdKey: "mediumConfidence", confidence };
}
