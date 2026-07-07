import type { CardExtractionInput, VisionProviderResult } from "@/lib/extraction/types";

export interface VisionProvider {
  extract(input: CardExtractionInput): Promise<VisionProviderResult> | VisionProviderResult;
}

// Paid AI providers should plug in here only after OCR, rules, and checklist matching cannot resolve the card confidently.
