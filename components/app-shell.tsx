"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { navItems } from "@/data/mock";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";
import { useAcvLocalState } from "@/lib/acv-local-state";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { backendStatus } = useAcvLocalState();
  const databaseStatus =
    backendStatus.connectionState === "connected"
      ? "Connected"
      : backendStatus.connectionState === "offline"
        ? "Offline"
        : backendStatus.configured
          ? "Connecting"
          : "Local";
  const storageStatus =
    backendStatus.storageState === "connected"
      ? "Connected"
      : backendStatus.storageState === "offline"
        ? "Fallback"
        : backendStatus.configured
          ? "Connecting"
          : "Local";
  const databaseTone = backendStatus.connectionState === "connected" ? "teal" : backendStatus.configured ? "gold" : "purple";
  const storageTone = backendStatus.storageState === "connected" ? "teal" : backendStatus.configured ? "gold" : "purple";
  const lastSyncLabel = (() => {
    if (!backendStatus.lastSyncAt) return backendStatus.configured ? "Pending" : "Local";
    const date = new Date(backendStatus.lastSyncAt);
    if (Number.isNaN(date.getTime())) return backendStatus.lastSyncAt.length > 14 ? `${backendStatus.lastSyncAt.slice(0, 14)}...` : backendStatus.lastSyncAt;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  })();

  return (
    <div className="min-h-screen overflow-x-clip bg-acv-black text-acv-text">
      <div className="fixed inset-0 -z-10 command-grid bg-[radial-gradient(circle_at_20%_0%,rgba(139,63,252,0.18),transparent_32%),radial-gradient(circle_at_85%_18%,rgba(242,184,75,0.12),transparent_30%),linear-gradient(180deg,#08080b,#050507)]" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-acv-border bg-acv-black sm:block">
        <div className="flex h-full flex-col">
          <Link href="/dashboard" className="flex items-center gap-3 border-b border-acv-border px-4 py-4">
            <Image
              src="/acv-logo.jpeg"
              alt="ACV AnonenCardVault logo"
              width={52}
              height={52}
              className="h-12 w-12 rounded-md border border-acv-gold/40 object-cover"
              priority
            />
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-acv-gold">ACV OS</p>
              <p className="truncate text-xs text-acv-muted">AnonenCardVault</p>
            </div>
          </Link>
          <nav className="acv-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-md border border-transparent px-3 text-sm text-acv-muted transition",
                    active
                      ? "border-acv-purple/40 bg-acv-purple/15 text-acv-text"
                      : "hover:border-acv-border hover:bg-white/[0.03] hover:text-acv-text"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active && "text-acv-teal")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-acv-border p-3">
            <div className="rounded-lg border border-acv-border bg-acv-panel2 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">System Status</p>
                <StatusPill tone="teal">Shell</StatusPill>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  ["eBay", "Mock", "pink"],
                  ["Database", databaseStatus, databaseTone],
                  ["Storage", storageStatus, storageTone],
                  ["AI", "Mock", "purple"]
                ].map(([label, value, tone]) => (
                  <div key={label} className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2">
                    <span className="text-acv-muted">{label}</span>
                    <StatusPill tone={tone as "pink" | "purple" | "teal" | "gold"} className="w-full justify-center !whitespace-normal px-1.5 text-center text-[9px] leading-3 tracking-[0.05em]">
                      {value}
                    </StatusPill>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-acv-border pt-3">
                <div className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2 text-[11px]">
                  <span className="text-acv-muted">Sync</span>
                  <span className="min-w-0 break-words text-right font-semibold leading-4 text-acv-teal">{lastSyncLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 overflow-x-hidden sm:pl-56">
        <header className="sticky top-0 z-20 border-b border-acv-border bg-acv-black">
          <div className="flex h-14 min-w-0 items-center gap-3 px-4 md:px-5">
            <Link href="/dashboard" className="flex items-center gap-2 sm:hidden">
              <Image
                src="/acv-logo.jpeg"
                alt="ACV AnonenCardVault logo"
                width={34}
                height={34}
                className="h-8 w-8 rounded-md border border-acv-gold/40 object-cover"
              />
              <span className="text-sm font-bold text-acv-gold">ACV OS</span>
            </Link>
            <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-md border border-acv-border bg-acv-panel px-3 py-2 md:flex">
              <Search className="h-4 w-4 text-acv-muted" />
              <span className="text-xs text-acv-muted">Search SKU, player, order, or listing</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <StatusPill tone="gold">AnonenCardVault</StatusPill>
              <button
                type="button"
                title="Notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-acv-border bg-white/[0.03] text-acv-muted transition hover:text-acv-teal"
              >
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="acv-scrollbar flex gap-2 overflow-x-auto border-t border-acv-border px-4 py-2 sm:hidden">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-xs",
                    active
                      ? "border-acv-purple/50 bg-acv-purple/15 text-acv-text"
                      : "border-acv-border bg-white/[0.03] text-acv-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
