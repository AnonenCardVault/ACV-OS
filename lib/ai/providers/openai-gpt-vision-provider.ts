import type { AIExtractionInput, AIFieldConfidenceMap, AIImageInput, AIProviderContext, GPTVisionProvider } from "@/lib/ai/types";
import { sportsCardExtractionPrompt, sportsCardFieldRules } from "@/lib/ai/prompts/sports-card";
import { createProviderOutput, warning } from "@/lib/ai/utils/provider-output";

type OpenAIGPTVisionProviderOptions = {
  apiKey: string;
  model?: string;
};

type OpenAIExtractionPayload = {
  cardTitle: string;
  playerOrCharacter: string;
  team: string;
  sportCategory: string;
  year: string;
  brand: string;
  set: string;
  cardNumber: string;
  parallel: string;
  serialNumber: string;
  rookie: boolean;
  auto: boolean;
  relic: boolean;
  variation: boolean;
  grader: string;
  grade: string;
  conditionNotes: string;
  uncertaintyNotes: string;
  confidence: number;
  fieldConfidence: Record<string, number>;
  warnings: string[];
  suggestedTitle: string;
  extractionSources: string[];
};

const fieldConfidenceKeys = [
  "cardTitle",
  "playerOrCharacter",
  "team",
  "sportCategory",
  "year",
  "brand",
  "set",
  "cardNumber",
  "parallel",
  "serialNumber",
  "rookie",
  "auto",
  "relic",
  "variation",
  "grader",
  "grade",
  "condition",
  "suggestedTitle",
  "overall"
];

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cardTitle: { type: "string" },
    playerOrCharacter: { type: "string" },
    team: { type: "string" },
    sportCategory: { type: "string" },
    year: { type: "string" },
    brand: { type: "string" },
    set: { type: "string" },
    cardNumber: { type: "string" },
    parallel: { type: "string" },
    serialNumber: { type: "string" },
    rookie: { type: "boolean" },
    auto: { type: "boolean" },
    relic: { type: "boolean" },
    variation: { type: "boolean" },
    grader: { type: "string" },
    grade: { type: "string" },
    conditionNotes: { type: "string" },
    uncertaintyNotes: { type: "string" },
    confidence: { type: "number" },
    fieldConfidence: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(fieldConfidenceKeys.map((key) => [key, { type: "number" }])),
      required: fieldConfidenceKeys
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    suggestedTitle: { type: "string" },
    extractionSources: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: [
    "cardTitle",
    "playerOrCharacter",
    "team",
    "sportCategory",
    "year",
    "brand",
    "set",
    "cardNumber",
    "parallel",
    "serialNumber",
    "rookie",
    "auto",
    "relic",
    "variation",
    "grader",
    "grade",
    "conditionNotes",
    "uncertaintyNotes",
    "confidence",
    "fieldConfidence",
    "warnings",
    "suggestedTitle",
    "extractionSources"
  ]
};

function clampConfidence(value: unknown, fallback = 45) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(0, Math.min(100, Math.round(next)));
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function imageUrl(image: AIImageInput) {
  return image.url || image.dataUrl || "";
}

function responseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  const output = Array.isArray(record.output) ? record.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? ((item as Record<string, unknown>).content as unknown[]) : [];
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const text = (contentItem as Record<string, unknown>).text;
      if (typeof text === "string") return text;
    }
  }

  return "";
}

function parseExtractionPayload(value: string): OpenAIExtractionPayload {
  const parsed = JSON.parse(value) as Partial<OpenAIExtractionPayload>;
  const fieldConfidence = fieldConfidenceKeys.reduce<Record<string, number>>((memo, key) => {
    memo[key] = clampConfidence(parsed.fieldConfidence?.[key], key === "overall" ? parsed.confidence : 45);
    return memo;
  }, {});

  return {
    cardTitle: cleanText(parsed.cardTitle),
    playerOrCharacter: cleanText(parsed.playerOrCharacter),
    team: cleanText(parsed.team),
    sportCategory: cleanText(parsed.sportCategory),
    year: cleanText(parsed.year),
    brand: cleanText(parsed.brand),
    set: cleanText(parsed.set),
    cardNumber: cleanText(parsed.cardNumber),
    parallel: cleanText(parsed.parallel),
    serialNumber: cleanText(parsed.serialNumber),
    rookie: Boolean(parsed.rookie),
    auto: Boolean(parsed.auto),
    relic: Boolean(parsed.relic),
    variation: Boolean(parsed.variation),
    grader: cleanText(parsed.grader) || "Raw",
    grade: cleanText(parsed.grade) || "Raw",
    conditionNotes: cleanText(parsed.conditionNotes),
    uncertaintyNotes: cleanText(parsed.uncertaintyNotes),
    confidence: clampConfidence(parsed.confidence),
    fieldConfidence,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(cleanText).filter(Boolean) : [],
    suggestedTitle: cleanText(parsed.suggestedTitle),
    extractionSources: Array.isArray(parsed.extractionSources) ? parsed.extractionSources.map(cleanText).filter(Boolean) : []
  };
}

function providerContextSummary(context: AIProviderContext) {
  return context.providerOutputs.map((output) => ({
    provider: output.providerLabel,
    status: output.status,
    fields: output.fields,
    confidence: output.fieldConfidence,
    warnings: output.warnings.map((item) => item.message),
    evidence: output.evidence
  }));
}

function imagePromptSummary(input: AIExtractionInput) {
  return input.images.map((image) => ({
    id: image.id,
    fileName: image.fileName,
    role: image.role,
    order: image.order
  }));
}

function buildPrompt(input: AIExtractionInput, context: AIProviderContext) {
  return [
    sportsCardExtractionPrompt,
    ...sportsCardFieldRules.map((rule) => `- ${rule}`),
    "",
    "You are filling ACV OS Photo Intake's editable extraction form. AI must never approve inventory.",
    "Return strict JSON only. Use empty strings for unknown text fields. Use false for unsupported boolean flags.",
    "Never guess uncertain details. If a detail is not visible, leave it empty and add a warning.",
    "Distinguish real autograph/relic/patch from printed/facsimile only when visible.",
    "Use provider context as hints, but visible card images should win over weak filename guesses.",
    "Use only the current uploaded images in this request. Do not reuse prior extraction values or old editable-form values as card identity evidence.",
    "",
    `Category hint: ${input.categoryHint || input.existingFields?.sportCategory || "none"}`,
    `Current image files and roles: ${JSON.stringify(imagePromptSummary(input))}`,
    `Previous provider context: ${JSON.stringify(providerContextSummary(context))}`
  ].join("\n");
}

function warningSeverity(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("missing") || normalized.includes("not visible") || normalized.includes("cannot")) return "warning" as const;
  return "info" as const;
}

export class OpenAIGPTVisionProvider implements GPTVisionProvider {
  id = "openai-gpt-vision";
  kind = "gpt-vision" as const;
  label = "OpenAI GPT Vision";
  version = "1.0.0";
  modelName: string;
  promptVersion = "sports-card-verification@1.0";
  costTier = "paid" as const;
  status = "available" as const;
  private apiKey: string;

  constructor({ apiKey, model = "gpt-5.5" }: OpenAIGPTVisionProviderOptions) {
    this.apiKey = apiKey;
    this.modelName = model;
  }

  async extract(input: AIExtractionInput, context: AIProviderContext) {
    const startedAt = Date.now();
    const imageContent = input.images
      .map((image) => imageUrl(image))
      .filter(Boolean)
      .slice(0, 4)
      .map((url) => ({
        type: "input_image",
        image_url: url,
        detail: "low"
      }));

    if (imageContent.length === 0) {
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
        warnings: [warning("openai_no_images", "OpenAI GPT provider received no sendable images", "warning", undefined, this.id)]
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.modelName,
        store: false,
        max_output_tokens: 1800,
        text: {
          format: {
            type: "json_schema",
            name: "acv_card_extraction",
            strict: true,
            schema: extractionSchema
          }
        },
        input: [
          {
            role: "developer",
            content: "You extract trading card data for ACV OS and return only schema-valid JSON."
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildPrompt(input, context) }, ...imageContent]
          }
        ]
      })
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const error = payload && typeof payload === "object" ? JSON.stringify(payload).slice(0, 500) : response.statusText;
      throw new Error(`OpenAI GPT extraction failed: ${response.status} ${error}`);
    }

    const text = responseText(payload);
    if (!text) throw new Error("OpenAI GPT extraction returned no structured output.");

    const parsed = parseExtractionPayload(text);
    const fieldConfidence = parsed.fieldConfidence as AIFieldConfidenceMap;

    return createProviderOutput({
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      providerVersion: this.version,
      modelName: this.modelName,
      promptVersion: this.promptVersion,
      costTier: this.costTier,
      startedAt,
      providerConfidence: parsed.confidence,
      fields: {
        cardTitle: parsed.cardTitle,
        playerOrCharacter: parsed.playerOrCharacter,
        team: parsed.team,
        sportCategory: parsed.sportCategory,
        year: parsed.year,
        brand: parsed.brand,
        set: parsed.set,
        cardNumber: parsed.cardNumber,
        parallel: parsed.parallel,
        serialNumber: parsed.serialNumber,
        rookie: parsed.rookie,
        auto: parsed.auto,
        relic: parsed.relic,
        variation: parsed.variation,
        grader: parsed.grader,
        grade: parsed.grade,
        conditionNotes: parsed.conditionNotes,
        uncertaintyNotes: parsed.uncertaintyNotes
      },
      fieldConfidence,
      warnings: parsed.warnings.map((message, index) => warning(`openai_gpt_warning_${index + 1}`, message, warningSeverity(message), undefined, this.id)),
      evidence: ["OpenAI structured vision extraction", ...parsed.extractionSources],
      raw: {
        responseId: payload && typeof payload === "object" ? (payload as Record<string, unknown>).id : undefined,
        suggestedTitle: parsed.suggestedTitle,
        usage: payload && typeof payload === "object" ? (payload as Record<string, unknown>).usage : undefined
      }
    });
  }
}
