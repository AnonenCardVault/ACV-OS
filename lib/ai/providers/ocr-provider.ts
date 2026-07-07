import type { AIExtractionInput, AIProviderContext, OCRProvider } from "@/lib/ai/types";
import { imageTextBlob } from "@/lib/ai/utils/fields";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

function detectCardNumber(text: string) {
  const match = text.match(/(?:#|card\s*number\s*)?([A-Z]{0,3}\d{1,4}[A-Z]{0,2})/i);
  return match?.[1] || "";
}

function detectSerial(text: string) {
  const match = text.match(/\b\d{1,4}\s*\/\s*\d{1,4}\b/);
  return match?.[0]?.replace(/\s+/g, "") || "";
}

export class MockOCRProvider implements OCRProvider {
  id = "mock-ocr";
  kind = "ocr" as const;
  label = "Mock OCR Quick Pass";
  version = "0.1.0";
  modelName = "mock-ocr-local-rules";
  promptVersion = "ocr-quick-pass@1.0";
  costTier = "local" as const;
  status = "mock" as const;

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const textBlob = imageTextBlob(input.images, input.existingFields);
    const cardNumber = detectCardNumber(textBlob) || input.existingFields?.cardNumber || "";
    const serialNumber = detectSerial(textBlob) || input.existingFields?.serialNumber || "";
    const hasReadableText = textBlob.length > 0;

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
        cardNumber,
        serialNumber
      },
      fieldConfidence: {
        cardNumber: cardNumber ? 72 : 28,
        serialNumber: serialNumber ? 82 : 35
      },
      warnings: hasReadableText ? [] : [warning("ocr_no_text", "OCR quick pass found no readable text", "warning", undefined, this.id)],
      evidence: ["filenames", "image roles", "existing form values"],
      raw: {
        detectedText: textBlob ? [textBlob] : [],
        imageQuality: hasReadableText ? "mock-readable" : "mock-low-text",
        routingPurpose: "OCR quick pass only; not final identification."
      }
    });
  }
}
