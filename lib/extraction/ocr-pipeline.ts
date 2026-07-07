import type { CardExtractionInput, OcrResult } from "@/lib/extraction/types";

function compact(value: unknown) {
  return String(value || "").trim();
}

export function runOcrPipeline(input: CardExtractionInput): OcrResult {
  const existing = input.existingFields || {};
  const imageText = input.images.flatMap((image) => [image.fileName, image.label, image.role]).map(compact).filter(Boolean);
  const formText = [
    input.categoryHint,
    existing.cardTitle,
    existing.playerOrCharacter,
    existing.team,
    existing.sportCategory,
    existing.year,
    existing.brand,
    existing.set,
    existing.cardNumber,
    existing.parallel,
    existing.serialNumber
  ]
    .map(compact)
    .filter(Boolean);
  const detectedText = [...imageText, ...formText];

  return {
    detectedText,
    textBlob: detectedText.join(" "),
    confidence: detectedText.length > 0 ? 0.58 : 0.25,
    sources: ["filename text", "image role labels", "existing form values"]
  };
}

// Future plug-in point:
// Browser OCR, Tesseract, mobile scan OCR, or a server-side OCR worker should feed the same OcrResult shape.
