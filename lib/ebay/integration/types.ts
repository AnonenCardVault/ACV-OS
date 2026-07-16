export type EbayEnvironment = "sandbox" | "production";

export type EbayConnectionStatus = "not_configured" | "connecting" | "connected" | "failed";

export type EbayOAuthStatus = "valid" | "expired" | "missing";

export type EbayHealthBadgeTone = "teal" | "gold" | "pink" | "purple" | "neutral";

export type EbaySandboxEnvPresence = {
  EBAY_SANDBOX_CLIENT_ID: boolean;
  EBAY_SANDBOX_CLIENT_SECRET: boolean;
  EBAY_SANDBOX_RUNAME: boolean;
  EBAY_SANDBOX_REDIRECT_URI: boolean;
  EBAY_MARKETPLACE_ID: boolean;
  EBAY_TOKEN_ENCRYPTION_SECRET: boolean;
  ACV_TOKEN_ENCRYPTION_SECRET: boolean;
  TOKEN_ENCRYPTION_CONFIGURED: boolean;
};

export type EbayEnvCheckItem = {
  name: string;
  present: boolean;
  note: string;
};

export type EbayEnvironmentConfig = {
  environment: EbayEnvironment;
  label: "Sandbox" | "Production";
  clientId?: string;
  clientSecret?: string;
  marketplaceId: string;
  oauthUrl: string;
  authUrl: string;
  browseBaseUrl: string;
  sellInventoryBaseUrl: string;
  sellFulfillmentBaseUrl: string;
  identityBaseUrl: string;
  ruName: string;
  redirectUri: string;
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
  oauthConfigured: boolean;
  envChecks: EbayEnvCheckItem[];
  marketplaceId: string;
  connectionStatus: EbayConnectionStatus;
  oauth: EbayOAuthTokenSummary;
  lastConnectionTestAt?: string;
  lastLatencyMs?: number;
  message: string;
  productionCallsAllowed: boolean;
};

export type EbayConnectionRow = {
  id: string;
  acv_user_id: string;
  environment: EbayEnvironment;
  marketplace_id: string;
  ebay_user_id: string | null;
  ebay_username: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  scopes: string[] | null;
  connection_status: "connected" | "disconnected" | "reauthorization_required" | "failed";
  last_connected_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type EbaySyncRunRow = {
  id: string;
  acv_user_id: string;
  ebay_connection_id: string;
  environment: EbayEnvironment;
  sync_type: "inventory_items" | "offers" | "orders" | "everything";
  status: "running" | "completed" | "partial_success" | "failed";
  started_at: string;
  completed_at: string | null;
  pages_fetched: number;
  records_received: number;
  records_inserted: number;
  records_updated: number;
  records_unchanged: number;
  records_failed: number;
  warning_count: number;
  warnings: unknown[];
  error_summary: string | null;
};

export type EbaySyncSummary = {
  connected: boolean;
  connection?: {
    id: string;
    environment: EbayEnvironment;
    marketplaceId: string;
    ebayUserId?: string | null;
    ebayUsername?: string | null;
    status: string;
    oauthStatus: EbayOAuthStatus | "reauthorization_required";
    accessTokenExpiresAt?: string | null;
    refreshTokenExpiresAt?: string | null;
    lastConnectedAt?: string | null;
    lastRefreshedAt?: string | null;
    lastError?: string | null;
  };
  counts: {
    inventoryItems: number;
    offers: number;
    unpublishedOffers: number;
    publishedOffers: number;
    activeListings: number;
    orders: number;
    orderLines: number;
  };
  lastSync: {
    inventoryItems?: string | null;
    offers?: string | null;
    orders?: string | null;
    everything?: string | null;
  };
  latestRun?: EbaySyncRunRow;
  coverageNote: string;
};
