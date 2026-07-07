import "server-only";

import type { CardExtractionInput, ExtractedCardFields, ExtractionFieldKey, ExtractionWarning, FieldConfidenceMap, VisionProviderResult } from "@/lib/extraction/types";
import type { VisionProvider } from "@/lib/extraction/vision-provider";

type OpenAiVisionProviderOptions = {
  apiKey: string;
  model?: string;
};

type OpenAiWarningPayload = {
  code?: unknown;
  message?: unknown;
  severity?: unknown;
  field?: unknown;
};

type OpenAiExtractionPayload = {
  cardTitle: unknown;
  playerOrCharacter: unknown;
  team: unknown;
  sportCategory: unknown;
  year: unknown;
  brand: unknown;
  setName: unknown;
  cardNumber: unknown;
  parallel: unknown;
  serialNumber: unknown;
  rookie: unknown;
  auto: unknown;
  relic: unknown;
  variation: unknown;
  grader: unknown;
  grade: unknown;
  conditionNotes: unknown;
  uncertaintyNotes: unknown;
  confidence: unknown;
  fieldConfidence: Record<string, unknown>;
  warnings: OpenAiWarningPayload[];
  suggestedTitle: unknown;
  extractionSources: unknown[];
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "cardTitle",
    "playerOrCharacter",
    "team",
    "sportCategory",
    "year",
    "brand",
    "setName",
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
  ],
  properties: {
    cardTitle: { type: ["string", "null"] },
    playerOrCharacter: { type: ["string", "null"] },
    team: { type: ["string", "null"] },
    sportCategory: { type: ["string", "null"] },
    year: { type: ["string", "null"] },
    brand: { type: ["string", "null"] },
    setName: { type: ["string", "null"] },
    cardNumber: { type: ["string", "null"] },
    parallel: { type: ["string", "null"] },
    serialNumber: { type: ["string", "null"] },
    rookie: { type: ["boolean", "null"] },
    auto: { type: ["boolean", "null"] },
    relic: { type: ["boolean", "null"] },
    variation: { type: ["boolean", "null"] },
    grader: { type: ["string", "null"] },
    grade: { type: ["string", "null"] },
    conditionNotes: { type: ["string", "null"] },
    uncertaintyNotes: { type: ["string", "null"] },
    confidence: { type: ["number", "null"], minimum: 0, maximum: 100 },
    fieldConfidence: {
      type: "object",
      additionalProperties: false,
      required: [
        "cardTitle",
        "playerOrCharacter",
        "team",
        "sportCategory",
        "year",
        "brand",
        "setName",
        "cardNumber",
        "parallel",
        "serialNumber",
        "grader",
        "grade",
        "suggestedTitle"
      ],
      properties: {
        cardTitle: { type: ["number", "null"], minimum: 0, maximum: 100 },
        playerOrCharacter: { type: ["number", "null"], minimum: 0, maximum: 100 },
        team: { type: ["number", "null"], minimum: 0, maximum: 100 },
        sportCategory: { type: ["number", "null"], minimum: 0, maximum: 100 },
        year: { type: ["number", "null"], minimum: 0, maximum: 100 },
        brand: { type: ["number", "null"], minimum: 0, maximum: 100 },
        setName: { type: ["number", "null"], minimum: 0, maximum: 100 },
        cardNumber: { type: ["number", "null"], minimum: 0, maximum: 100 },
        parallel: { type: ["number", "null"], minimum: 0, maximum: 100 },
        serialNumber: { type: ["number", "null"], minimum: 0, maximum: 100 },
        grader: { type: ["number", "null"], minimum: 0, maximum: 100 },
        grade: { type: ["number", "null"], minimum: 0, maximum: 100 },
        suggestedTitle: { type: ["number", "null"], minimum: 0, maximum: 100 }
      }
    },
    warnings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message", "severity", "field"],
        properties: {
          code: { type: ["string", "null"] },
          message: { type: ["string", "null"] },
          severity: { type: ["string", "null"], enum: ["info", "warning", "blocking", null] },
          field: { type: ["string", "null"] }
        }
      }
    },
    suggestedTitle: { type: ["string", "null"] },
    extractionSources: { type: "array", items: { type: "string" } }
  }
};

const prompt = `You are ACV OS, a careful sports card and trading card extraction assistant.
Extract visible details from the provided card images and return strict JSON only.

Rules:
- Never approve inventory. You only fill an editable review form.
- Never guess uncertain details. Use null for unknown fields.
- If a parallel is uncertain, leave the field null or include a warning.
- If card number is not visible, return null.
- If serial number is not visible, return null.
- Distinguish autograph ink from facsimile or printed signatures when possible.
- Distinguish relic, patch, or memorabilia only when visible.
- Identify graded/slabbed cards only when the slab or label is visible.
- Include warnings for anything uncertain.
- Confidence values are 0-100 and should reflect visual evidence, not optimism.`;

function clean(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function bool(value: unknown) {
  return value === true;
}

function confidence(value: unknown, fallback = 0) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(0, Math.min(100, Math.round(next)));
}

function optionalConfidence(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return confidence(value);
}

function fieldConfidence(value: unknown): FieldConfidenceMap {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    cardTitle: optionalConfidence(raw.cardTitle),
    playerOrCharacter: optionalConfidence(raw.playerOrCharacter),
    team: optionalConfidence(raw.team),
    sportCategory: optionalConfidence(raw.sportCategory),
    year: optionalConfidence(raw.year),
    brand: optionalConfidence(raw.brand),
    set: optionalConfidence(raw.setName),
    cardNumber: optionalConfidence(raw.cardNumber),
    parallel: optionalConfidence(raw.parallel),
    serialNumber: optionalConfidence(raw.serialNumber),
    grader: optionalConfidence(raw.grader),
    grade: optionalConfidence(raw.grade),
    suggestedTitle: optionalConfidence(raw.suggestedTitle)
  };
}

function normalizeWarning(value: OpenAiWarningPayload, index: number): ExtractionWarning {
  const severity = value.severity === "blocking" || value.severity === "warning" || value.severity === "info" ? value.severity : "warning";
  const field = clean(value.field) as ExtractionFieldKey;

  return {
    code: clean(value.code) || `openai_warning_${index + 1}`,
    message: clean(value.message) || "AI extraction warning",
    severity,
    field: field || undefined
  };
}

function normalizePayload(payload: unknown): VisionProviderResult & { suggestedTitle: string } {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI extraction returned an invalid JSON object.");
  }

  const raw = payload as OpenAiExtractionPayload;
  const fields: Partial<ExtractedCardFields> = {};
  const assignString = (key: keyof ExtractedCardFields, value: unknown) => {
    const next = clean(value);
    if (next) {
      (fields as Record<string, string>)[key] = next;
    }
  };
  const assignBoolean = (key: keyof ExtractedCardFields, value: unknown) => {
    if (typeof value === "boolean") {
      (fields as Record<string, boolean>)[key] = value;
    }
  };

  assignString("cardTitle", raw.cardTitle);
  assignString("playerOrCharacter", raw.playerOrCharacter);
  assignString("team", raw.team);
  assignString("sportCategory", raw.sportCategory);
  assignString("year", raw.year);
  assignString("brand", raw.brand);
  assignString("set", raw.setName);
  assignString("cardNumber", raw.cardNumber);
  assignString("parallel", raw.parallel);
  assignString("serialNumber", raw.serialNumber);
  assignBoolean("rookie", raw.rookie);
  assignBoolean("auto", raw.auto);
  assignBoolean("relic", raw.relic);
  assignBoolean("variation", raw.variation);
  assignString("grader", raw.grader);
  assignString("grade", raw.grade);
  assignString("conditionNotes", raw.conditionNotes);
  assignString("uncertaintyNotes", raw.uncertaintyNotes);
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map(normalizeWarning) : [];
  const sources = Array.isArray(raw.extractionSources) ? raw.extractionSources.map(clean).filter(Boolean) : [];

  return {
    fields,
    confidence: confidence(raw.confidence, 50),
    fieldConfidence: fieldConfidence(raw.fieldConfidence),
    warnings,
    suggestedTitle: clean(raw.suggestedTitle),
    sources: ["openai vision", ...sources]
  };
}

function outputText(response: unknown) {
  if (response && typeof response === "object" && typeof (response as { output_text?: unknown }).output_text === "string") {
    return (response as { output_text: string }).output_text;
  }

  const output = response && typeof response === "object" ? (response as { output?: Array<{ content?: Array<Record<string, unknown>> }> }).output : undefined;
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }

  return "";
}

function sendableImageUrl(image: CardExtractionInput["images"][number]) {
  const value = image.url || image.dataUrl || "";
  if (!value || value.startsWith("blob:")) return "";
  return value;
}

export class OpenAiVisionProvider implements VisionProvider {
  private apiKey: string;
  private model: string;

  constructor(options: OpenAiVisionProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || "gpt-4.1-mini";
  }

  async extract(input: CardExtractionInput): Promise<VisionProviderResult> {
    const images = input.images.map((image) => ({ image, imageUrl: sendableImageUrl(image) })).filter((item) => item.imageUrl);
    if (images.length === 0) {
      throw new Error("No usable image URLs or image data were available for extraction.");
    }

    const context = {
      categoryHint: input.categoryHint || null,
      existingFields: input.existingFields || {},
      imageRoles: input.images.map((image) => ({ role: image.role, fileName: image.fileName }))
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Extract this card for ACV OS Photo Intake. Context JSON:\n${JSON.stringify(context)}`
              },
              ...images.map((item) => ({
                type: "input_image",
                image_url: item.imageUrl,
                detail: "low"
              }))
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "acv_card_extraction",
            strict: true,
            schema: extractionSchema
          }
        },
        max_output_tokens: 1800
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI extraction failed: ${response.status} ${detail}`);
    }

    const body = await response.json();
    const text = outputText(body);
    if (!text) {
      throw new Error("OpenAI extraction returned no JSON text.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("OpenAI extraction JSON could not be parsed.");
    }

    const normalized = normalizePayload(parsed);
    return {
      fields: normalized.fields,
      confidence: normalized.confidence,
      fieldConfidence: normalized.fieldConfidence,
      warnings: normalized.warnings,
      suggestedTitle: normalized.suggestedTitle,
      sources: normalized.sources
    };
  }
}
