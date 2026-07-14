import type { EbayEnvironment, EbayEnvironmentConfig } from "@/lib/ebay/integration/types";

const oauthScope = "https://api.ebay.com/oauth/api_scope";
const defaultMarketplaceId = "EBAY_US";

export function getEbayOAuthScope() {
  return oauthScope;
}

export function getEbayMarketplaceId() {
  return process.env.EBAY_MARKETPLACE_ID || defaultMarketplaceId;
}

export function getEbayEnvironmentConfig(environment: EbayEnvironment): EbayEnvironmentConfig {
  const marketplaceId = getEbayMarketplaceId();
  const productionCallsAllowed = process.env.EBAY_ALLOW_PRODUCTION_CONNECTION_TESTS === "true";

  if (environment === "production") {
    const clientId = process.env.EBAY_CLIENT_ID || "";
    const clientSecret = process.env.EBAY_CLIENT_SECRET || "";
    const missing: string[] = [];
    if (!clientId) missing.push("EBAY_CLIENT_ID");
    if (!clientSecret) missing.push("EBAY_CLIENT_SECRET");

    return {
      environment,
      label: "Production",
      clientId,
      clientSecret,
      marketplaceId,
      oauthUrl: "https://api.ebay.com/identity/v1/oauth2/token",
      browseBaseUrl: "https://api.ebay.com/buy/browse/v1",
      missing,
      configured: missing.length === 0,
      productionCallsAllowed
    };
  }

  const clientId = process.env.EBAY_SANDBOX_CLIENT_ID || "";
  const clientSecret = process.env.EBAY_SANDBOX_CLIENT_SECRET || "";
  const missing: string[] = [];
  if (!clientId) missing.push("EBAY_SANDBOX_CLIENT_ID");
  if (!clientSecret) missing.push("EBAY_SANDBOX_CLIENT_SECRET");

  return {
    environment,
    label: "Sandbox",
    clientId,
    clientSecret,
    marketplaceId,
    oauthUrl: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
    browseBaseUrl: "https://api.sandbox.ebay.com/buy/browse/v1",
    missing,
    configured: missing.length === 0,
    productionCallsAllowed
  };
}

export function parseEbayEnvironment(value: unknown): EbayEnvironment {
  return value === "production" ? "production" : "sandbox";
}

