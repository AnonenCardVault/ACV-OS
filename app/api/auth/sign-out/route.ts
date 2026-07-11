import { NextResponse, type NextRequest } from "next/server";
import { authCookieBaseOptions, authCookieNames, signOutSupabaseSession } from "@/lib/supabase/auth";

function clearAuthCookies(response: NextResponse) {
  for (const name of Object.values(authCookieNames)) {
    response.cookies.set(name, "", authCookieBaseOptions(0));
  }
}

export async function POST(request: NextRequest) {
  await signOutSupabaseSession(request.cookies.get(authCookieNames.accessToken)?.value);
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}

