import type { AIExtractionInput, AIFieldConfidenceMap, AIImageInput, AIProviderContext, CardSightProvider, ExtractedCardFields } from "@/lib/ai/types";
import { imageTextBlob, selectFrontImage } from "@/lib/ai/utils/fields";
import { matchMockCardProfile } from "@/lib/ai/utils/mock-card-signals";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

type CardSightRestProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  recognitionPath?: string;
  timeoutMs?: number;
};

type CardSightNormalizedResponse = {
  fields: Partial<ExtractedCardFields>;
  fieldConfidence: AIFieldConfidenceMap;
  warnings: string[];
  evidence: string[];
  raw: Record<string, unknown>;
  confidence: number;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function firstValue(...values: unknown[]) {
  return values.map(cleanText).find(Boolean) || "";
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = cleanText(value).toLowerCase();
  return ["true", "yes", "y", "1", "rc", "rookie"].includes(normalized);
}

function confidenceValue(...values: unknown[]) {
  const next = values.map(Number).find((value) => Number.isFinite(value));
  if (next === undefined || !Number.isFinite(next)) return 45;
  const normalized = next <= 1 ? next * 100 : next;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function dataUrlBase64(value: string) {
  const marker = ";base64,";
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

function endpointUrl(baseUrl: string, recognitionPath: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(recognitionPath.replace(/^\/+/, ""), base).toString();
}

function frontImagePayload(image: AIImageInput) {
  const value = image.url || image.dataUrl || "";
  const isDataUrl = value.startsWith("data:");
  return {
    image_url: isDataUrl ? undefined : value,
    image_base64: isDataUrl ? dataUrlBase64(value) : undefined,
    role: "front",
    filename: image.fileName,
    image_id: image.id
  };
}

function candidateFromPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const wrappers = [record.card, record.result, record.data, record.prediction, record.recognition, record.identification];

  for (const wrapper of wrappers) {
    if (wrapper && typeof wrapper === "object" && !Array.isArray(wrapper)) return wrapper as Record<string, unknown>;
  }

  const candidates = [record.matches, record.candidates, record.results, record.predictions]
    .filter(Array.isArray)
    .flat() as unknown[];
  const firstCandidate = candidates.find((item) => item && typeof item === "object" && !Array.isArray(item));
  if (firstCandidate) return firstCandidate as Record<string, unknown>;

  return record;
}

function nested(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
}

function normalizeCardSightResponse(payload: unknown): CardSightNormalizedResponse {
  const card = candidateFromPayload(payload);
  const manufacturer = firstValue(nested(card, "manufacturer", "maker"), nested(card, "brand"));
  const product = firstValue(nested(card, "product", "product_name"), nested(card, "set", "set_name", "setName"));
  const insert = firstValue(nested(card, "insert", "insert_name", "subset"));
  const parallel = firstValue(nested(card, "parallel", "parallel_name"), insert);
  const confidence = confidenceValue(nested(card, "confidence", "score", "match_confidence"), nested(card, "probability"));
  const fields: Partial<ExtractedCardFields> = {
    playerOrCharacter: firstValue(nested(card, "player", "player_name", "athlete"), nested(card, "character", "character_name", "subject")),
    team: firstValue(nested(card, "team", "team_name")),
    sportCategory: firstValue(nested(card, "sport", "sport_category", "category")),
    year: firstValue(nested(card, "year", "season")),
    brand: manufacturer,
    set: product,
    parallel,
    cardNumber: firstValue(nested(card, "card_number", "cardNumber", "number")),
    rookie: booleanValue(nested(card, "rookie", "is_rookie", "rc"))
  };
  const fieldConfidence: AIFieldConfidenceMap = {
    playerOrCharacter: confidenceValue(nested(card, "player_confidence"), confidence),
    team: confidenceValue(nested(card, "team_confidence"), confidence),
    sportCategory: confidenceValue(nested(card, "sport_confidence", "category_confidence"), confidence),
    year: confidenceValue(nested(card, "year_confidence"), confidence),
    brand: confidenceValue(nested(card, "brand_confidence", "manufacturer_confidence"), confidence),
    set: confidenceValue(nested(card, "set_confidence", "product_confidence"), confidence),
    cardNumber: confidenceValue(nested(card, "card_number_confidence", "number_confidence"), confidence),
    parallel: confidenceValue(nested(card, "parallel_confidence", "insert_confidence"), confidence),
    rookie: confidenceValue(nested(card, "rookie_confidence"), confidence),
    overall: confidence
  };
  const payloadWarnings = Array.isArray((payload as Record<string, unknown>)?.warnings) ? ((payload as Record<string, unknown>).warnings as unknown[]).map(cleanText).filter(Boolean) : [];
  const cardWarnings = Array.isArray(card.warnings) ? card.warnings.map(cleanText).filter(Boolean) : [];
  const warnings = [...payloadWarnings, ...cardWarnings];
  const evidence = [
    "CardSight front-image recognition",
    fields.playerOrCharacter ? `player: ${fields.playerOrCharacter}` : "",
    fields.brand ? `brand: ${fields.brand}` : "",
    fields.set ? `product/set: ${fields.set}` : "",
    insert ? `insert: ${insert}` : "",
    fields.parallel ? `parallel: ${fields.parallel}` : "",
    fields.cardNumber ? `card number: ${fields.cardNumber}` : ""
  ].filter(Boolean);

  return {
    fields,
    fieldConfidence,
    warnings,
    evidence,
    raw: { payload, normalizedCandidate: card, insert },
    confidence
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class MockCardSightProvider implements CardSightProvider {
  id = "mock-cardsight";
  kind = "cardsight" as const;
  label = "Mock CardSight";
  version = "0.1.0";
  modelName = "cardsight-mock-front-image";
  promptVersion = "cardsight-front@1.0";
  costTier = "paid" as const;
  status = "mock" as const;

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const frontImage = selectFrontImage(input.images);
    const profile = matchMockCardProfile(imageTextBlob(frontImage ? [frontImage] : input.images, input.existingFields), input.categoryHint);

    if (!profile) {
      return createProviderOutput({
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        providerVersion: this.version,
        modelName: this.modelName,
        promptVersion: this.promptVersion,
        costTier: this.costTier,
        startedAt,
        warnings: [warning("cardsight_no_match", "CardSight mock did not identify the front image", "warning", undefined, this.id)],
        evidence: ["front image mock signals"],
        raw: { expectedFutureInput: "front image only" }
      });
    }

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
        playerOrCharacter: profile.playerOrCharacter,
        year: profile.year,
        brand: profile.brand,
        set: profile.set,
        parallel: profile.parallel,
        sportCategory: profile.sportCategory,
        team: profile.team
      },
      fieldConfidence: {
        playerOrCharacter: Math.min(98, profile.score),
        year: Math.max(72, profile.score - 8),
        brand: Math.max(72, profile.score - 6),
        set: Math.max(68, profile.score - 10),
        parallel: profile.parallel ? Math.max(62, profile.score - 24) : 35,
        sportCategory: Math.min(96, profile.score + 2)
      },
      evidence: profile.matchedSignals.map((signal) => `front signal: ${signal}`),
      raw: {
        frontImageId: frontImage?.id,
        futureProvider: "CardSight front-image identification"
      }
    });
  }
}

export class CardSightRestProvider implements CardSightProvider {
  id = "cardsight-rest";
  kind = "cardsight" as const;
  label = "CardSight REST";
  version = "1.0.0";
  modelName = "cardsight-rest-visual-recognition";
  promptVersion = "cardsight-front@1.0";
  costTier = "paid" as const;
  status = "available" as const;
  private apiKey: string;
  private baseUrl: string;
  private recognitionPath: string;
  private timeoutMs: number;
  private fallback = new MockCardSightProvider();

  constructor({ apiKey, baseUrl = "https://api.cardsight.ai/v1/", recognitionPath = "recognize", timeoutMs = 12000 }: CardSightRestProviderOptions) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.recognitionPath = recognitionPath;
    this.timeoutMs = timeoutMs;
  }

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const frontImage = selectFrontImage(input.images);

    if (!frontImage) {
      return createProviderOutput({
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        providerVersion: this.version,
        modelName: this.modelName,
        promptVersion: this.promptVersion,
        costTier: this.costTier,
        startedAt,
        status: "failed",
        warnings: [warning("cardsight_front_missing", "CardSight requires a front image and none was available", "warning", undefined, this.id)]
      });
    }

    try {
      const response = await fetchWithTimeout(
        endpointUrl(this.baseUrl, this.recognitionPath),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.apiKey
          },
          body: JSON.stringify(frontImagePayload(frontImage))
        },
        this.timeoutMs
      );
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        const detail = payload && typeof payload === "object" ? JSON.stringify(payload).slice(0, 400) : response.statusText;
        throw new Error(`CardSight request failed: ${response.status} ${detail}`);
      }
      if (!payload || typeof payload !== "object") {
        throw new Error("CardSight returned invalid JSON.");
      }

      const normalized = normalizeCardSightResponse(payload);
      return createProviderOutput({
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        providerVersion: this.version,
        modelName: this.modelName,
        promptVersion: this.promptVersion,
        costTier: this.costTier,
        startedAt,
        providerConfidence: normalized.confidence,
        fields: normalized.fields,
        fieldConfidence: normalized.fieldConfidence,
        warnings: normalized.warnings.map((message, index) => warning(`cardsight_warning_${index + 1}`, message, "warning", undefined, this.id)),
        evidence: normalized.evidence,
        raw: normalized.raw
      });
    } catch (error) {
      const fallbackOutput = await this.fallback.extract(input, context);
      return {
        ...fallbackOutput,
        providerId: this.id,
        providerLabel: "CardSight REST (mock fallback)",
        providerVersion: this.version,
        modelName: this.modelName,
        promptVersion: this.promptVersion,
        timestamp: new Date().toISOString(),
        costTier: this.costTier,
        warnings: [
          warning("cardsight_fallback", error instanceof Error ? error.message : "CardSight failed; mock CardSight fallback used", "warning", undefined, this.id),
          ...fallbackOutput.warnings
        ],
        evidence: ["CardSight fallback path", ...fallbackOutput.evidence],
        metadata: {
          ...fallbackOutput.metadata,
          providerName: "CardSight REST (mock fallback)",
          providerVersion: this.version,
          modelName: this.modelName,
          promptVersion: this.promptVersion,
          timestamp: new Date().toISOString(),
          costTier: this.costTier
        },
        raw: {
          cardsightError: error instanceof Error ? error.message : "Unknown CardSight error",
          fallbackRaw: fallbackOutput.raw
        }
      };
    }
  }
}
