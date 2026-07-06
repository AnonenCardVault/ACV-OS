import { AppShell } from "@/components/app-shell";
import { AcvLocalStateProvider } from "@/lib/acv-local-state";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcvLocalStateProvider>
      <AppShell>{children}</AppShell>
    </AcvLocalStateProvider>
  );
}
