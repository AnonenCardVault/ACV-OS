import { AppShell } from "@/components/app-shell";
import { AcvLocalStateProvider } from "@/lib/acv-local-state";
import { authCookieNames } from "@/lib/supabase/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const hasAccessToken = Boolean(cookieStore.get(authCookieNames.accessToken)?.value);
  const hasRefreshToken = Boolean(cookieStore.get(authCookieNames.refreshToken)?.value);

  if (!hasAccessToken && !hasRefreshToken) {
    redirect("/sign-in");
  }

  return (
    <AcvLocalStateProvider>
      <AppShell>{children}</AppShell>
    </AcvLocalStateProvider>
  );
}
