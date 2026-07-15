import { NextResponse, type NextRequest } from "next/server";
import { parseEbayEnvironment } from "@/lib/ebay/integration/config";
import { upsertEbayConnectionFromToken } from "@/lib/ebay/integration/connection-store";
import { ebayOAuthStateCookieName, ebayOAuthStateCookieOptions, parseEbayOAuthStateCookie } from "@/lib/ebay/integration/oauth-state";
import { exchangeEbayAuthorizationCode, fetchEbayIdentity } from "@/lib/ebay/integration/user-token-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectToIntegrations(request: NextRequest, status: "connected" | "error", message?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/integrations";
  url.search = "";
  url.searchParams.set("ebay_oauth", status);
  if (message) url.searchParams.set("message", message.slice(0, 180));
  const response = NextResponse.redirect(url);
  response.cookies.set(ebayOAuthStateCookieName, "", ebayOAuthStateCookieOptions(0));
  return response;
}

export async function GET(request: NextRequest) {
  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectToIntegrations(request, "error", `eBay authorization declined: ${oauthError}`);
  }

  try {
    const stateCookie = parseEbayOAuthStateCookie(request.cookies.get(ebayOAuthStateCookieName)?.value);
    const state = request.nextUrl.searchParams.get("state") || "";
    const code = request.nextUrl.searchParams.get("code") || "";
    if (!state || state !== stateCookie.state) throw new Error("OAuth state mismatch. Connection was rejected.");
    if (!code) throw new Error("Missing eBay authorization code.");

    const environment = parseEbayEnvironment(stateCookie.environment);
    if (environment !== "sandbox") {
      throw new Error("Production user OAuth is disabled for this Sandbox phase.");
    }

    const token = await exchangeEbayAuthorizationCode({ environment, code });
    const identity = await fetchEbayIdentity(environment, token.accessToken);
    await upsertEbayConnectionFromToken({ environment, token, identity });

    return redirectToIntegrations(request, "connected", "Sandbox account connected.");
  } catch (error) {
    return redirectToIntegrations(request, "error", error instanceof Error ? error.message : "eBay OAuth callback failed.");
  }
}
