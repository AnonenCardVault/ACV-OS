export const ebayOAuthStateCookieName = "acv.ebay.oauth.state";

const stateMaxAgeSeconds = 10 * 60;

export type EbayOAuthStateCookie = {
  state: string;
  environment: string;
  expiresAt: number;
};

export function ebayOAuthStateCookieOptions(maxAge = stateMaxAgeSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

export function encodeEbayOAuthStateCookie(value: EbayOAuthStateCookie) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function parseEbayOAuthStateCookie(value?: string): EbayOAuthStateCookie {
  if (!value) throw new Error("Missing OAuth state cookie.");
  const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<EbayOAuthStateCookie>;
  if (!parsed.state || !parsed.environment || !parsed.expiresAt) {
    throw new Error("OAuth state cookie is malformed.");
  }
  if (parsed.expiresAt < Date.now()) {
    throw new Error("OAuth state expired. Start the Sandbox connection again.");
  }
  return {
    state: parsed.state,
    environment: parsed.environment,
    expiresAt: parsed.expiresAt
  };
}

export function ebayOAuthStateExpiresAt() {
  return Date.now() + stateMaxAgeSeconds * 1000;
}
