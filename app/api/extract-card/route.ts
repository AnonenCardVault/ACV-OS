import { NextResponse, type NextRequest } from "next/server";
import { extractCardFromImages, extractCardFromImagesWithProvider, type CardExtractionInput, type ExtractionImage, type ExtractionResult } from "@/lib/extraction";
import { OpenAiVisionProvider } from "@/lib/extraction/providers/openai-vision-provider";
import { logExtractionAttempt } from "@/lib/supabase/extraction-attempts";

export const runtime = "nodejs";

type ExtractCardRequest = CardExtractionInput & {
  batchId?: string;
  groupId?: string;
  frontBackOnly?: boolean;
};

const closeupRoles = new Set(["Detail / Closeup", "Serial Closeup", "Holo / Surface", "Auto Closeup", "Patch / Relic Closeup"]);

function sendableUrl(image: ExtractionImage) {
  const value = image.url || image.dataUrl || "";
  if (!value || value.startsWith("blob:")) return "";
  return value;
}

function selectImagesForCostControl(images: ExtractionImage[], frontBackOnly?: boolean) {
  const ordered = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const selected: ExtractionImage[] = [];
  const add = (image: ExtractionImage | undefined) => {
    if (!image || !sendableUrl(image) || selected.some((item) => item.id === image.id)) return;
    selected.push(image);
  };

  add(ordered.find((image) => image.role === "Front"));
  add(ordered.find((image) => image.role === "Back"));

  if (!frontBackOnly) {
    ordered.filter((image) => closeupRoles.has(String(image.role))).forEach(add);
  }

  ordered.forEach(add);
  return selected.slice(0, frontBackOnly ? 2 : 4);
}

function warningMessages(result: ExtractionResult) {
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

  const images = selectImagesForCostControl(payload.images, payload.frontBackOnly);
  if (images.length === 0) {
    return NextResponse.json({ ok: false, error: "No usable image URL or image data was available for extraction." }, { status: 400 });
  }

  const input: CardExtractionInput = {
    images,
    categoryHint: payload.categoryHint,
    existingFields: payload.existingFields
  };
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    const result = extractCardFromImages(input);
    await safeLogAttempt({
      batchId: payload.batchId,
      groupId: payload.groupId,
      provider: "mock",
      model: "ACV Extraction Engine v2",
      status: result.extractionStatus,
      confidence: result.confidence,
      warnings: warningMessages(result),
      metadata: { reason: "OPENAI_API_KEY missing", imageCount: images.length }
    });

    return NextResponse.json({
      ok: true,
      provider: "mock",
      modelLabel: "Mock AI / ACV local extraction",
      result,
      imageCount: images.length
    });
  }

  try {
    const provider = new OpenAiVisionProvider({ apiKey, model });
    const result = await extractCardFromImagesWithProvider(input, provider, { forceVisionProvider: true });
    await safeLogAttempt({
      batchId: payload.batchId,
      groupId: payload.groupId,
      provider: "openai",
      model,
      status: result.extractionStatus,
      confidence: result.confidence,
      warnings: warningMessages(result),
      metadata: { imageCount: images.length, frontBackOnly: Boolean(payload.frontBackOnly) }
    });

    return NextResponse.json({
      ok: true,
      provider: "openai",
      modelLabel: `OpenAI Vision / server-side (${model})`,
      result,
      imageCount: images.length
    });
  } catch (error) {
    await safeLogAttempt({
      batchId: payload.batchId,
      groupId: payload.groupId,
      provider: "openai",
      model,
      status: "Failed",
      warnings: [error instanceof Error ? error.message : "OpenAI extraction failed"],
      metadata: { imageCount: images.length }
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
