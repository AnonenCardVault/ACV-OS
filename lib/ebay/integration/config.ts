import type { EbayEnvCheckItem, EbayEnvironment, EbayEnvironmentConfig, EbaySandboxEnvPresence } from "@/lib/ebay/integration/types";

const oauthScope = "https://api.ebay.com/oauth/api_scope";
const defaultMarketplaceId = "EBAY_US";

export function getEbayOAuthScope() {
  return oauthScope;
}

export const ebaySandboxUserScopes = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
];

export function getEbayUserScopes(environment: EbayEnvironment) {
  void environment;
  return ebaySandboxUserScopes;
}

export function getEbayMarketplaceId() {
  return process.env.EBAY_MARKETPLACE_ID || defaultMarketplaceId;
}

export function getEbaySandboxEnvPresence(): EbaySandboxEnvPresence {
  const tokenEncryption = Boolean(process.env.EBAY_TOKEN_ENCRYPTION_SECRET || process.env.ACV_TOKEN_ENCRYPTION_SECRET);
  return {
    EBAY_SANDBOX_CLIENT_ID: Boolean(process.env.EBAY_SANDBOX_CLIENT_ID),
    EBAY_SANDBOX_CLIENT_SECRET: Boolean(process.env.EBAY_SANDBOX_CLIENT_SECRET),
    EBAY_SANDBOX_RUNAME: Boolean(process.env.EBAY_SANDBOX_RUNAME),
    EBAY_SANDBOX_REDIRECT_URI: Boolean(process.env.EBAY_SANDBOX_REDIRECT_URI),
    EBAY_MARKETPLACE_ID: Boolean(process.env.EBAY_MARKETPLACE_ID),
    EBAY_TOKEN_ENCRYPTION_SECRET: Boolean(process.env.EBAY_TOKEN_ENCRYPTION_SECRET),
    ACV_TOKEN_ENCRYPTION_SECRET: Boolean(process.env.ACV_TOKEN_ENCRYPTION_SECRET),
    TOKEN_ENCRYPTION_CONFIGURED: tokenEncryption
  };
}

export function getEbaySandboxEnvChecks(): EbayEnvCheckItem[] {
  const presence = getEbaySandboxEnvPresence();
  return [
    { name: "EBAY_SANDBOX_CLIENT_ID", present: presence.EBAY_SANDBOX_CLIENT_ID, note: "Sandbox OAuth client ID" },
    { name: "EBAY_SANDBOX_CLIENT_SECRET", present: presence.EBAY_SANDBOX_CLIENT_SECRET, note: "Sandbox OAuth client secret" },
    { name: "EBAY_SANDBOX_RUNAME", present: presence.EBAY_SANDBOX_RUNAME, note: "eBay RuName used as OAuth redirect_uri" },
    { name: "EBAY_SANDBOX_REDIRECT_URI", present: presence.EBAY_SANDBOX_REDIRECT_URI, note: "ACV callback URL registered in eBay" },
    { name: "EBAY_MARKETPLACE_ID", present: presence.EBAY_MARKETPLACE_ID, note: "Marketplace header; defaults to EBAY_US if absent" },
    {
      name: "EBAY_TOKEN_ENCRYPTION_SECRET or ACV_TOKEN_ENCRYPTION_SECRET",
      present: presence.TOKEN_ENCRYPTION_CONFIGURED,
      note: "Server-only secret used to encrypt stored eBay user tokens"
    }
  ];
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
      authUrl: "https://auth.ebay.com/oauth2/authorize",
      browseBaseUrl: "https://api.ebay.com/buy/browse/v1",
      sellInventoryBaseUrl: "https://api.ebay.com/sell/inventory/v1",
      sellFulfillmentBaseUrl: "https://api.ebay.com/sell/fulfillment/v1",
      identityBaseUrl: "https://apiz.ebay.com/commerce/identity/v1",
      ruName: process.env.EBAY_RUNAME || "",
      redirectUri: process.env.EBAY_REDIRECT_URI || "",
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
    authUrl: "https://auth.sandbox.ebay.com/oauth2/authorize",
    browseBaseUrl: "https://api.sandbox.ebay.com/buy/browse/v1",
    sellInventoryBaseUrl: "https://api.sandbox.ebay.com/sell/inventory/v1",
    sellFulfillmentBaseUrl: "https://api.sandbox.ebay.com/sell/fulfillment/v1",
    identityBaseUrl: "https://apiz.sandbox.ebay.com/commerce/identity/v1",
    ruName: process.env.EBAY_SANDBOX_RUNAME || "",
    redirectUri: process.env.EBAY_SANDBOX_REDIRECT_URI || "",
    missing,
    configured: missing.length === 0,
    productionCallsAllowed
  };
}

export function parseEbayEnvironment(value: unknown): EbayEnvironment {
  return value === "production" ? "production" : "sandbox";
}
