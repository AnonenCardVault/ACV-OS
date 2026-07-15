import { NextResponse, type NextRequest } from "next/server";
import { authCookieBaseOptions, authCookieNames, getSupabaseAuthUser, isAccessTokenFresh, refreshSupabaseSession, sessionExpiresAt, type SupabasePasswordSession } from "@/lib/supabase/auth";

const publicPathPrefixes = ["/sign-in", "/privacy", "/terms", "/api/auth", "/api/ebay/marketplace-account-deletion", "/api/ebay/oauth/callback"];
const publicAssetPattern = /\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|map|txt|xml)$/i;

function isPublicPath(pathname: string) {
  return pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/acv-logo.jpeg" || publicAssetPattern.test(pathname) || publicPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function safeNextPath(request: NextRequest) {
  const path = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return path.startsWith("/sign-in") ? "/dashboard" : path;
}

function setSessionCookies(response: NextResponse, session: SupabasePasswordSession) {
  const expiresAt = sessionExpiresAt(session);
  const accessMaxAge = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
  const refreshMaxAge = 60 * 60 * 24 * 30;

  response.cookies.set(authCookieNames.accessToken, session.access_token, authCookieBaseOptions(accessMaxAge));
  response.cookies.set(authCookieNames.refreshToken, session.refresh_token, authCookieBaseOptions(refreshMaxAge));
  response.cookies.set(authCookieNames.expiresAt, String(expiresAt), authCookieBaseOptions(refreshMaxAge));
}

function clearSessionCookies(response: NextResponse) {
  for (const name of Object.values(authCookieNames)) {
    response.cookies.set(name, "", authCookieBaseOptions(0));
  }
}

function redirectToSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  const next = safeNextPath(request);
  if (next !== "/dashboard") url.searchParams.set("next", next);
  const response = NextResponse.redirect(url);
  clearSessionCookies(response);
  return response;
}

function redirectToDashboard(request: NextRequest, refreshedSession?: SupabasePasswordSession) {
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  const response = NextResponse.redirect(url);
  if (refreshedSession) setSessionCookies(response, refreshedSession);
  return response;
}

async function resolveSession(request: NextRequest) {
  const accessToken = request.cookies.get(authCookieNames.accessToken)?.value || "";
  const refreshToken = request.cookies.get(authCookieNames.refreshToken)?.value || "";
  const expiresAt = request.cookies.get(authCookieNames.expiresAt)?.value || "";

  if (accessToken && isAccessTokenFresh(expiresAt)) {
    await getSupabaseAuthUser(accessToken);
    return { authenticated: true as const, refreshedSession: undefined };
  }

  if (refreshToken) {
    const refreshedSession = await refreshSupabaseSession(refreshToken);
    return { authenticated: true as const, refreshedSession };
  }

  return { authenticated: false as const };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isSignIn = pathname === "/sign-in";
  const isPublic = isPublicPath(pathname);

  if (isPublic && !isSignIn) return NextResponse.next();

  try {
    const session = await resolveSession(request);
    if (session.authenticated) {
      if (isSignIn) return redirectToDashboard(request, session.refreshedSession);
      const response = NextResponse.next();
      if (session.refreshedSession) setSessionCookies(response, session.refreshedSession);
      return response;
    }
  } catch {
    if (isSignIn) return NextResponse.next();
    return redirectToSignIn(request);
  }

  if (isSignIn) return NextResponse.next();
  return redirectToSignIn(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
