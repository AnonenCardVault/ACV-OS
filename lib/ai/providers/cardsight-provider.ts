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
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return "";
  return String(value ?? "").trim();
}

function firstValue(...values: unknown[]) {
  return values.map(cleanText).find(Boolean) || "";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function records(value: unknown) {
  if (!Array.isArray(value)) return [];
  const output: Record<string, unknown>[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (record) output.push(record);
  }
  return output;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = cleanText(value).toLowerCase();
  return ["true", "yes", "y", "1", "rc", "rookie"].includes(normalized);
}

function confidenceValue(...values: unknown[]) {
  const confidenceLabel = values.map(cleanText).find((value) => /^(high|medium|low)$/i.test(value));
  if (confidenceLabel) {
    const normalized = confidenceLabel.toLowerCase();
    if (normalized === "high") return 95;
    if (normalized === "medium") return 82;
    return 62;
  }
  const next = values.map(Number).find((value) => Number.isFinite(value));
  if (next === undefined || !Number.isFinite(next)) return 45;
  const normalized = next <= 1 ? next * 100 : next;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function endpointUrl(baseUrl: string, recognitionPath: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(recognitionPath.replace(/^\/+/, ""), base).toString();
}

function dataUrlParts(value: string) {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return undefined;
  return {
    contentType: match[1] || "image/jpeg",
    base64: Boolean(match[2]),
    body: match[3] || ""
  };
}

function blobFromDataUrl(value: string) {
  const parts = dataUrlParts(value);
  if (!parts) throw new Error("Front image data URL was invalid.");
  const binary = parts.base64 ? atob(parts.body) : decodeURIComponent(parts.body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: parts.contentType });
}

async function frontImageBlob(image: AIImageInput) {
  if (image.dataUrl?.startsWith("data:")) return blobFromDataUrl(image.dataUrl);
  const imageUrl = image.url || image.dataUrl || "";
  if (!imageUrl) throw new Error("Front image has no uploadable URL or data.");
  if (imageUrl.startsWith("blob:")) throw new Error("Front image is a browser blob URL; re-upload or use Supabase storage before CardSight extraction.");

  const response = await fetchWithTimeout(imageUrl, {}, 12000);
  if (!response.ok) throw new Error(`Front image could not be fetched for CardSight upload: ${response.status} ${response.statusText}`);
  return response.blob();
}

function candidateFromPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const detection = records(record.detections).find((item) => asRecord(item.card));
  if (detection) {
    const card = asRecord(detection.card) || {};
    return {
      ...card,
      detectionConfidence: detection.confidence,
      grading: detection.grading,
      requestId: record.requestId,
      success: record.success,
      messages: record.messages
    };
  }
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

function fieldValues(card: Record<string, unknown>) {
  const values: Record<string, string> = {};
  for (const field of records(card.fields)) {
    const key = cleanText(field.key).toLowerCase();
    const value = cleanText(field.value);
    if (key && value) values[key] = value;
  }
  return values;
}

function hasAttribute(card: Record<string, unknown>, pattern: RegExp) {
  const attributes = Array.isArray(card.attributes) ? card.attributes.map(cleanText).join(" ") : "";
  return pattern.test(attributes);
}

function normalizeCardSightResponse(payload: unknown): CardSightNormalizedResponse {
  const card = candidateFromPayload(payload);
  const fieldsMap = fieldValues(card);
  const parallelRecord = asRecord(card.parallel);
  const gradingRecord = asRecord(card.grading);
  const gradeRecord = asRecord(gradingRecord?.grade);
  const companyRecord = asRecord(gradingRecord?.company);
  const manufacturer = firstValue(nested(card, "manufacturer", "maker"), nested(card, "brand"));
  const releaseName = firstValue(nested(card, "releaseName", "release_name", "product", "product_name"));
  const setName = firstValue(nested(card, "setName", "set_name", "set"));
  const product = firstValue(releaseName, setName);
  const insert = firstValue(nested(card, "insert", "insert_name", "subset"));
  const parallel = firstValue(nested(parallelRecord || {}, "name"), nested(card, "parallel_name"), insert);
  const confidence = confidenceValue(nested(card, "detectionConfidence"), nested(card, "confidence", "score", "match_confidence"), nested(card, "probability"));
  const fields: Partial<ExtractedCardFields> = {
    playerOrCharacter: firstValue(nested(card, "name"), nested(card, "player", "player_name", "athlete"), nested(card, "character", "character_name", "subject")),
    team: firstValue(nested(card, "team", "team_name"), fieldsMap.team),
    sportCategory: firstValue(nested(card, "sport", "sport_category", "category"), fieldsMap.sport, fieldsMap.segment),
    year: firstValue(nested(card, "year", "season")),
    brand: manufacturer,
    set: product,
    parallel,
    cardNumber: firstValue(nested(card, "card_number", "cardNumber", "number")),
    rookie: booleanValue(nested(card, "rookie", "is_rookie", "rc")) || hasAttribute(card, /\b(rookie|rc)\b/i),
    auto: booleanValue(nested(card, "auto", "autograph")) || hasAttribute(card, /\b(auto|autograph)\b/i),
    relic: booleanValue(nested(card, "relic", "memorabilia", "patch")) || hasAttribute(card, /\b(relic|patch|memorabilia)\b/i),
    variation: Boolean(cleanText(nested(card, "variationOf"))) || booleanValue(nested(card, "variation", "is_variation")),
    grader: firstValue(nested(companyRecord || {}, "name")),
    grade: firstValue(nested(gradeRecord || {}, "value"), nested(gradeRecord || {}, "condition"))
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
    auto: confidenceValue(nested(card, "auto_confidence"), confidence),
    relic: confidenceValue(nested(card, "relic_confidence"), confidence),
    grader: confidenceValue(nested(gradingRecord || {}, "confidence"), fields.grader ? confidence : 0),
    grade: confidenceValue(nested(gradingRecord || {}, "confidence"), fields.grade ? confidence : 0),
    overall: confidence
  };
  const payloadRecord = asRecord(payload) || {};
  const payloadWarnings = Array.isArray(payloadRecord.warnings) ? payloadRecord.warnings.map(cleanText).filter(Boolean) : [];
  const messageWarnings = records(card.messages)
    .map((message) => cleanText(message.message))
    .filter(Boolean);
  const cardWarnings = Array.isArray(card.warnings) ? card.warnings.map(cleanText).filter(Boolean) : [];
  const warnings = [...payloadWarnings, ...messageWarnings, ...cardWarnings];
  const evidence = [
    "CardSight front-image recognition",
    cleanText(card.requestId) ? `request: ${cleanText(card.requestId)}` : "",
    fields.playerOrCharacter ? `player: ${fields.playerOrCharacter}` : "",
    fields.brand ? `brand: ${fields.brand}` : "",
    releaseName ? `release: ${releaseName}` : "",
    setName ? `set: ${setName}` : "",
    insert ? `insert: ${insert}` : "",
    fields.parallel ? `parallel: ${fields.parallel}` : "",
    fields.cardNumber ? `card number: ${fields.cardNumber}` : ""
  ].filter(Boolean);

  return {
    fields,
    fieldConfidence,
    warnings,
    evidence,
    raw: { payload, normalizedCandidate: card, releaseName, setName, insert },
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

  constructor({ apiKey, baseUrl = "https://api.cardsight.ai/v1/", recognitionPath = "identify/card", timeoutMs = 12000 }: CardSightRestProviderOptions) {
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
      const upload = new FormData();
      upload.append("image", await frontImageBlob(frontImage), frontImage.fileName || "front-card.jpg");
      const response = await fetchWithTimeout(
        endpointUrl(this.baseUrl, this.recognitionPath),
        {
          method: "POST",
          headers: {
            "X-API-Key": this.apiKey
          },
          body: upload
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
        warnings: [warning("cardsight_failed", error instanceof Error ? error.message : "CardSight failed", "warning", undefined, this.id)],
        evidence: ["CardSight REST failure; GPT may continue with current front/back images"],
        raw: {
          cardsightError: error instanceof Error ? error.message : "Unknown CardSight error",
          endpoint: endpointUrl(this.baseUrl, this.recognitionPath),
          frontImage: {
            id: frontImage.id,
            fileName: frontImage.fileName,
            role: frontImage.role
          }
        }
      });
    }
  }
}
