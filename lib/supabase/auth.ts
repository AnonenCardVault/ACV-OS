import { getSupabaseConfig } from "@/lib/supabase/client";

export const authCookieNames = {
  accessToken: "acv.auth.access-token",
  refreshToken: "acv.auth.refresh-token",
  expiresAt: "acv.auth.expires-at"
} as const;

export type SupabaseAuthUser = {
  id: string;
  email?: string;
};

export type SupabasePasswordSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type?: string;
  user?: SupabaseAuthUser;
};

export type AuthCheckResult =
  | { authenticated: true; session: SupabasePasswordSession; refreshed: boolean; user?: SupabaseAuthUser }
  | { authenticated: false; reason: string; clearCookies?: boolean };

export function authCookieBaseOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {})
  };
}

function authEndpoint(path: string) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    throw new Error(`Supabase configuration missing: ${config.missing.join(", ")}`);
  }
  return `${config.url}/auth/v1/${path.replace(/^\//, "")}`;
}

function authHeaders(accessToken?: string) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    throw new Error(`Supabase configuration missing: ${config.missing.join(", ")}`);
  }

  return {
    apikey: config.key,
    Authorization: `Bearer ${accessToken || config.key}`,
    "Content-Type": "application/json"
  };
}

function safeErrorMessage(prefix: string, status: number, detail: string) {
  const trimmed = detail.trim();
  try {
    const parsed = JSON.parse(trimmed) as { msg?: string; message?: string; error_description?: string; error?: string };
    return `${prefix}: ${parsed.msg || parsed.message || parsed.error_description || parsed.error || status}`;
  } catch {
    return `${prefix}: ${status}${trimmed ? ` ${trimmed.slice(0, 180)}` : ""}`;
  }
}

export function sessionExpiresAt(session: Pick<SupabasePasswordSession, "expires_at" | "expires_in">) {
  if (session.expires_at) return Number(session.expires_at) * 1000;
  return Date.now() + Math.max(0, Number(session.expires_in || 0)) * 1000;
}

export function isAccessTokenFresh(expiresAt?: string | number | null) {
  const timestamp = Number(expiresAt || 0);
  return Boolean(timestamp && timestamp - Date.now() > 60_000);
}

export async function signInWithPassword(email: string, password: string) {
  if (!email || !password) throw new Error("Email and password are required.");

  const response = await fetch(authEndpoint("token?grant_type=password"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });

  const detail = await response.text();
  if (!response.ok) {
    throw new Error(safeErrorMessage("Invalid email or password", response.status, detail));
  }

  const session = JSON.parse(detail) as SupabasePasswordSession;
  if (!session.access_token || !session.refresh_token) {
    throw new Error("Supabase Auth did not return a usable session.");
  }

  return session;
}

export async function refreshSupabaseSession(refreshToken: string) {
  if (!refreshToken) throw new Error("Missing refresh token.");

  const response = await fetch(authEndpoint("token?grant_type=refresh_token"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store"
  });

  const detail = await response.text();
  if (!response.ok) {
    throw new Error(safeErrorMessage("Session refresh failed", response.status, detail));
  }

  const session = JSON.parse(detail) as SupabasePasswordSession;
  if (!session.access_token || !session.refresh_token) {
    throw new Error("Supabase Auth did not return a refreshed session.");
  }

  return session;
}

export async function getSupabaseAuthUser(accessToken: string) {
  if (!accessToken) throw new Error("Missing access token.");

  const response = await fetch(authEndpoint("user"), {
    method: "GET",
    headers: authHeaders(accessToken),
    cache: "no-store"
  });

  const detail = await response.text();
  if (!response.ok) {
    throw new Error(safeErrorMessage("Session validation failed", response.status, detail));
  }

  return JSON.parse(detail) as SupabaseAuthUser;
}

export async function signOutSupabaseSession(accessToken?: string) {
  if (!accessToken) return;

  try {
    await fetch(authEndpoint("logout"), {
      method: "POST",
      headers: authHeaders(accessToken),
      cache: "no-store"
    });
  } catch {
    // Local cookie cleanup is enough to protect ACV OS if remote logout is unavailable.
  }
}
