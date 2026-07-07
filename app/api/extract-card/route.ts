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
    openAiApiKey: process.env.OPENAI_API_KEY,
    ocrProvider: process.env.OCR_PROVIDER
  });

  try {
    const result = await runAIExtraction({
      input,
      providers: createDefaultAIProviders({
        cardsightApiKey: process.env.CARDSIGHT_API_KEY,
        openAiApiKey: process.env.OPENAI_API_KEY,
        ocrProvider: process.env.OCR_PROVIDER
      })
    });
    await safeLogAttempt({
      batchId: payload.batchId,
      groupId: payload.groupId,
      provider: "acv-ai-orchestrator",
      model: "mock-provider-pipeline",
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
        providerEnv
      }
    });

    return NextResponse.json({
      ok: true,
      provider: "acv-ai-orchestrator",
      modelLabel: "ACV AI Orchestrator / mock providers",
      result,
      imageCount: images.length
    });
  } catch (error) {
    await safeLogAttempt({
      batchId: payload.batchId,
      groupId: payload.groupId,
      provider: "acv-ai-orchestrator",
      model: "mock-provider-pipeline",
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
