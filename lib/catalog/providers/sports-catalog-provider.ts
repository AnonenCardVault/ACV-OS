import type { CatalogProvider, CatalogValidationInput, CatalogValidationResult } from "@/lib/catalog/types";

const sportsCategories = new Set(["baseball", "football", "basketball"]);

export class SportsCatalogProvider implements CatalogProvider {
  id = "sports-catalog-provider";
  name = "Sports Catalog Provider";

  supports(category: string) {
    return sportsCategories.has(category.trim().toLowerCase());
  }

  async validate(input: CatalogValidationInput): Promise<CatalogValidationResult> {
    return {
      providerId: this.id,
      providerName: this.name,
      category: input.fields.sportCategory || "Sports",
      status: "unavailable",
      confidence: 0,
      warnings: [
        {
          code: "sports_catalog_unavailable",
          message: "Sports catalog validation unavailable; CardSight and GPT remain the source for sports extraction.",
          severity: "info"
        }
      ],
      evidence: ["Sports catalog provider is a no-op until a real sports checklist source is connected."]
    };
  }
}
