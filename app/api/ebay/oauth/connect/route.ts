import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getEbayEnvironmentConfig, getEbayUserScopes, parseEbayEnvironment } from "@/lib/ebay/integration/config";
import {
  ebayOAuthStateCookieName,
  ebayOAuthStateCookieOptions,
  ebayOAuthStateExpiresAt,
  encodeEbayOAuthStateCookie
} from "@/lib/ebay/integration/oauth-state";
import { isEbayTokenEncryptionConfigured } from "@/lib/ebay/integration/token-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectWithError(request: NextRequest, message: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/integrations";
  url.search = "";
  url.searchParams.set("ebay_oauth", "error");
  url.searchParams.set("message", message.slice(0, 180));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const environment = parseEbayEnvironment(request.nextUrl.searchParams.get("environment"));
  const config = getEbayEnvironmentConfig(environment);

  if (environment !== "sandbox" && !config.productionCallsAllowed) {
    return redirectWithError(request, "Production eBay OAuth is disabled for this Sandbox phase.");
  }
  if (!config.configured || !config.ruName || !config.redirectUri) {
    const missing = [...config.missing];
    if (!config.ruName) missing.push(environment === "sandbox" ? "EBAY_SANDBOX_RUNAME" : "EBAY_RUNAME");
    if (!config.redirectUri) missing.push(environment === "sandbox" ? "EBAY_SANDBOX_REDIRECT_URI" : "EBAY_REDIRECT_URI");
    return redirectWithError(request, `Missing eBay ${config.label} OAuth configuration: ${missing.join(", ")}`);
  }
  if (!isEbayTokenEncryptionConfigured()) {
    return redirectWithError(request, "Missing token encryption secret: set EBAY_TOKEN_ENCRYPTION_SECRET or ACV_TOKEN_ENCRYPTION_SECRET.");
  }

  const state = randomBytes(32).toString("base64url");
  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("client_id", config.clientId || "");
  authUrl.searchParams.set("redirect_uri", config.ruName);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", getEbayUserScopes(environment).join(" "));
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(
    ebayOAuthStateCookieName,
    encodeEbayOAuthStateCookie({
      state,
      environment,
      expiresAt: ebayOAuthStateExpiresAt()
    }),
    ebayOAuthStateCookieOptions()
  );
  return response;
}
