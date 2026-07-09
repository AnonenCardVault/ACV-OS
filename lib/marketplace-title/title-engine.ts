import { buildEbayMarketplaceTitle } from "@/lib/marketplace-title/providers/ebay-title-provider";
import type { MarketplaceTitleFacts, MarketplaceTitleResult } from "@/lib/marketplace-title/types";

export function generateMarketplaceTitles(facts: MarketplaceTitleFacts): MarketplaceTitleResult {
  return buildEbayMarketplaceTitle(facts);
}
