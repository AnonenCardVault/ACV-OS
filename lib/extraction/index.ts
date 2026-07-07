export { extractCardFromImages } from "@/lib/extraction/extraction-orchestrator";
export { brandDictionary, matchBrandDictionary, sportsBrands, sportsCategories, tcgBrands } from "@/lib/extraction/brand-dictionary";
export { matchChecklist } from "@/lib/extraction/checklist-matcher";
export { calculateExtractionConfidence } from "@/lib/extraction/confidence-engine";
export { runOcrPipeline } from "@/lib/extraction/ocr-pipeline";
export { detectSportCategory } from "@/lib/extraction/sport-detector";
export { runMockVisionFallback, type VisionProvider } from "@/lib/extraction/vision-provider";
export type {
  BrandDictionaryMatches,
  CardExtractionInput,
  ChecklistCandidate,
  ExtractedCardFields,
  ExtractionImage,
  ExtractionImageRole,
  ExtractionResult,
  ExtractionStatus,
  ExtractionWarning,
  FieldConfidenceMap,
  OcrResult,
  VisionProviderResult
} from "@/lib/extraction/types";
