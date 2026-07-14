export type EbayEnvironment = "sandbox" | "production";

export type EbayConnectionStatus = "not_configured" | "connecting" | "connected" | "failed";

export type EbayOAuthStatus = "valid" | "expired" | "missing";

export type EbayHealthBadgeTone = "teal" | "gold" | "pink" | "purple" | "neutral";

export type EbayEnvironmentConfig = {
  environment: EbayEnvironment;
  label: "Sandbox" | "Production";
  clientId?: string;
  clientSecret?: string;
  marketplaceId: string;
  oauthUrl: string;
  browseBaseUrl: string;
  missing: string[];
  configured: boolean;
  productionCallsAllowed: boolean;
};

export type EbayCachedApplicationToken = {
  accessToken: string;
  tokenType: string;
  environment: EbayEnvironment;
  expiresAt: number;
  acquiredAt: string;
  scope: string;
};

export type EbayOAuthTokenSummary = {
  status: EbayOAuthStatus;
  tokenType?: string;
  acquiredAt?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  cached: boolean;
};

export type EbayConnectionTestResult = {
  environment: EbayEnvironment;
  connectionStatus: EbayConnectionStatus;
  oauthStatus: EbayOAuthStatus;
  marketplaceId: string;
  latencyMs?: number;
  tokenExpiresAt?: string;
  tokenAcquiredAt?: string;
  lastConnectionTestAt?: string;
  resultCount?: number;
  sampleItemTitle?: string | null;
  errorCategory?: "missing_credentials" | "invalid_credentials" | "network_timeout" | "oauth_failure" | "api_unavailable" | "production_disabled" | "unknown";
  message: string;
};

export type EbayEnvironmentSummary = {
  environment: EbayEnvironment;
  label: string;
  configured: boolean;
  marketplaceId: string;
  connectionStatus: EbayConnectionStatus;
  oauth: EbayOAuthTokenSummary;
  lastConnectionTestAt?: string;
  lastLatencyMs?: number;
  message: string;
  productionCallsAllowed: boolean;
};

