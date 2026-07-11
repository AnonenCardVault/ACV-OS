import { NextResponse, type NextRequest } from "next/server";
import { authCookieBaseOptions, authCookieNames, sessionExpiresAt, signInWithPassword } from "@/lib/supabase/auth";
import { getSupabaseConfig } from "@/lib/supabase/client";

function setAuthCookies(response: NextResponse, session: Awaited<ReturnType<typeof signInWithPassword>>) {
  const expiresAt = sessionExpiresAt(session);
  const accessMaxAge = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
  const refreshMaxAge = 60 * 60 * 24 * 30;

  response.cookies.set(authCookieNames.accessToken, session.access_token, authCookieBaseOptions(accessMaxAge));
  response.cookies.set(authCookieNames.refreshToken, session.refresh_token, authCookieBaseOptions(refreshMaxAge));
  response.cookies.set(authCookieNames.expiresAt, String(expiresAt), authCookieBaseOptions(refreshMaxAge));
}

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        ok: false,
        error: `Supabase configuration missing: ${config.missing.join(", ")}`
      },
      { status: 503 }
    );
  }

  let payload: { email?: string; password?: string };
  try {
    payload = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Sign-in request could not be read." }, { status: 400 });
  }

  try {
    const session = await signInWithPassword(String(payload.email || "").trim(), String(payload.password || ""));
    const response = NextResponse.json({
      ok: true,
      user: {
        id: session.user?.id,
        email: session.user?.email
      }
    });
    setAuthCookies(response, session);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not sign in."
      },
      { status: 401 }
    );
  }
}

