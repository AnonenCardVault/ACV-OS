import { NextResponse, type NextRequest } from "next/server";
import { createDefaultAIProviders, prepareImagesForExtraction, providerEnvironmentSummary, runAIExtraction, type AIExtractionInput, type AIExtractionResult } from "@/lib/ai";
import { logExtractionAttempt } from "@/lib/supabase/extraction-attempts";

export const runtime = "nodejs";

type ExtractCardRequest = AIExtractionInput & {
  batchId?: string;
  groupId?: string;
  frontBackOnly?: boolean;
};

function warningMessages(result: AIExtractionResult) {
  return result.warnings.map((warning) => warning.message);
}

function diagnosticsEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ACV_AI_DIAGNOSTICS === "true";
}

function routeImageDiagnostics(images: AIExtractionInput["images"]) {
  return images.map((image) => ({
    id: image.id,
    fileName: image.fileName,
    role: image.role,
    order: image.order,
    hasUrl: Boolean(image.url),
    hasDataUrl: Boolean(image.dataUrl),
    needsReupload: Boolean(image.needsReupload)
  }));
}

function routeLog(label: string, payload: Record<string, unknown>) {
  if (!diagnosticsEnabled()) return;
  console.info(`[ACV AI Route] ${label}`, payload);
}

async function safeLogAttempt(args: Parameters<typeof logExtractionAttempt>[0]) {
  try {
    await logExtractionAttempt(args);
  } catch {
    // Extraction must never fail because optional metadata logging is unavailable.
  }
}

export async function POST(request: NextRequest) {
  let payload: ExtractCardRequest;

  try {
    payload = (await request.json()) as ExtractCardRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Extraction request JSON could not be read." }, { status: 400 });
  }

  if (!Array.isArray(payload.images) || payload.images.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one image is required for extraction." }, { status: 400 });
  }

  const images = prepareImagesForExtraction(payload.images, { frontBackOnly: payload.frontBackOnly, maxImages: 4 });
  if (images.length === 0) {
    return NextResponse.json({ ok: false, error: "No usable image URL or image data was available for extraction." }, { status: 400 });
  }

  const input: AIExtractionInput = {
    images,
    categoryHint: payload.categoryHint,
    existingFields: payload.existingFields,
    batchId: payload.batchId,
    groupId: payload.groupId
  };
  const providerEnv = providerEnvironmentSummary({
    cardsightApiKey: process.env.CARDSIGHT_API_KEY,
    cardsightBaseUrl: process.env.CARDSIGHT_API_BASE_URL,
    cardsightRecognitionPath: process.env.CARDSIGHT_RECOGNITION_PATH,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_EXTRACTION_MODEL || process.env.OPENAI_MODEL,
    ocrProvider: process.env.OCR_PROVIDER
  });
  const providers = createDefaultAIProviders({
    cardsightApiKey: process.env.CARDSIGHT_API_KEY,
    cardsightBaseUrl: process.env.CARDSIGHT_API_BASE_URL,
    cardsightRecognitionPath: process.env.CARDSIGHT_RECOGNITION_PATH,
    openAiApiKey: process.env.OPENAI_API_KEY,
    openAiModel: process.env.OPENAI_EXTRACTION_MODEL || process.env.OPENAI_MODEL,
    ocrProvider: process.env.OCR_PROVIDER
  });
  const modelLabel = providerEnv.openAiConfigured ? `ACV AI Orchestrator / OpenAI ${providerEnv.openAiModel}` : "ACV AI Orchestrator / mock providers";

  routeLog("request", {
    batchId: payload.batchId,
    groupId: payload.groupId,
    imageCount: images.length,
    images: routeImageDiagnostics(images),
    providerEnv,
    categoryHint: input.categoryHint || "none",
    existingFieldKeys: Object.entries(input.existingFields || {})
      .filter(([, value]) => {
        const text = String(value ?? "").trim();
        return Boolean(text && text !== "-" && text.toLowerCase() !== "raw");
      })
      .map(([key]) => key)
  });

  try {
    const result = await runAIExtraction({
      input,
      providers
    });
    await safeLogAttempt({
      batchId: payload.batchId,
      groupId: payload.groupId,
      provider: "acv-ai-orchestrator",
      model: providerEnv.openAiConfigured ? String(providerEnv.openAiModel) : "mock-provider-pipeline",
      status: result.extractionStatus,
      confidence: result.confidence,
      warnings: warningMessages(result),
      metadata: {
        imageCount: images.length,
        frontBackOnly: Boolean(payload.frontBackOnly),
        providersUsed: result.providersUsed,
        providerMetadata: result.log.providerMetadata,
        elapsedMs: result.log.elapsedMs,
        imageProcessing: result.log.imageProcessing,
        catalogValidation: result.catalogValidation,
        providerEnv
      }
    });

    routeLog("result", {
      batchId: payload.batchId,
      groupId: payload.groupId,
      confidence: result.confidence,
      status: result.extractionStatus,
      final: {
        title: result.cardTitle,
        player: result.playerOrCharacter,
        year: result.year,
        brand: result.brand,
        set: result.set,
        cardNumber: result.cardNumber,
        parallel: result.parallel
      },
      providers: result.providerOutputs.map((output) => ({
        id: output.providerId,
        name: output.providerLabel,
        status: output.status,
        confidence: output.providerConfidence,
        warnings: output.warnings.map((warning) => warning.message)
      })),
      catalogValidation: result.catalogValidation
    });

    return NextResponse.json({
      ok: true,
      provider: "acv-ai-orchestrator",
      modelLabel,
      result,
      imageCount: images.length
    });
  } catch (error) {
    await safeLogAttempt({
      batchId: payload.batchId,
      groupId: payload.groupId,
      provider: "acv-ai-orchestrator",
      model: providerEnv.openAiConfigured ? String(providerEnv.openAiModel) : "mock-provider-pipeline",
      status: "Failed",
      warnings: [error instanceof Error ? error.message : "AI orchestrator extraction failed"],
      metadata: { imageCount: images.length, providerEnv }
    });

    return NextResponse.json(
      {
        ok: false,
        error: "AI extraction failed. Manual form values were left unchanged.",
        detail: error instanceof Error ? error.message : "Unknown extraction error."
      },
      { status: 422 }
    );
  }
}
