import type { AIExtractionInput, AIProviderContext, OCRProvider } from "@/lib/ai/types";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

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
    const filenameMetadata = input.images.map((image) => ({
      id: image.id,
      fileName: image.fileName,
      role: image.role,
      order: image.order
    }));

    return createProviderOutput({
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      providerVersion: this.version,
      modelName: this.modelName,
      promptVersion: this.promptVersion,
      costTier: this.costTier,
      startedAt,
      fields: {},
      fieldConfidence: {},
      warnings: [warning("ocr_mock_no_visible_text", "Mock OCR does not read visible card text; filenames were ignored for identity fields", "info", undefined, this.id)],
      evidence: ["filename metadata logged for diagnostics only"],
      raw: {
        detectedText: [],
        filenameMetadata,
        imageQuality: "mock-no-visible-text",
        routingPurpose: "OCR quick pass only; not final identification."
      }
    });
  }
}
