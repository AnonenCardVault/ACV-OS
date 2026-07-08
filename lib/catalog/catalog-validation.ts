import type { AIFieldConfidenceMap, AIWarning, ExtractedCardFields } from "@/lib/ai/types";
import { catalogCategory, catalogProviderForCategory } from "@/lib/catalog/catalog-router";
import type { CatalogValidationResult } from "@/lib/catalog/types";

function warningFromCatalog(result: CatalogValidationResult): AIWarning[] {
  return result.warnings.map((warning) => ({
    code: warning.code,
    message: warning.message,
    severity: warning.severity,
    providerId: result.providerId
  }));
}

function fieldConfidenceFromCatalog(result: CatalogValidationResult): AIFieldConfidenceMap {
  if (result.status !== "matched") return {};
  return {
    playerOrCharacter: result.matchedCard?.name ? result.confidence : undefined,
    sportCategory: result.confidence,
    brand: result.confidence,
    set: result.matchedCard?.set ? result.confidence : undefined,
    cardNumber: result.matchedCard?.number ? result.confidence : undefined
  };
}

export async function validateCatalogFields(fields: ExtractedCardFields): Promise<{
  fields: ExtractedCardFields;
  validation?: CatalogValidationResult;
  warnings: AIWarning[];
  fieldConfidence: AIFieldConfidenceMap;
  confidenceAdjustment: number;
}> {
  const category = catalogCategory(fields);
  const provider = catalogProviderForCategory(category);

  if (!provider) {
    return {
      fields,
      warnings: [],
      fieldConfidence: {},
      confidenceAdjustment: 0
    };
  }

  const validation = await provider.validate({ fields });
  const nextFields = validation.status === "matched" && validation.normalizedFields ? { ...fields, ...validation.normalizedFields } : fields;
  const confidenceAdjustment = validation.status === "matched" ? 6 : validation.status === "disagreement" ? -12 : 0;

  return {
    fields: nextFields,
    validation,
    warnings: warningFromCatalog(validation),
    fieldConfidence: fieldConfidenceFromCatalog(validation),
    confidenceAdjustment
  };
}
