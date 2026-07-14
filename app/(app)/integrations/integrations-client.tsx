"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, PlugZap, RefreshCw, TestTube2 } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import type { EbayConnectionStatus, EbayConnectionTestResult, EbayEnvironment, EbayEnvironmentSummary, EbayOAuthStatus } from "@/lib/ebay/integration/types";
import { cn } from "@/lib/utils";

type IntegrationsClientProps = {
  initialEbayEnvironments: EbayEnvironmentSummary[];
};

type EbayTestResponse = {
  result?: EbayConnectionTestResult;
  environments?: EbayEnvironmentSummary[];
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function connectionTone(status: EbayConnectionStatus) {
  if (status === "connected") return "teal";
  if (status === "connecting") return "gold";
  if (status === "failed") return "pink";
  return "neutral";
}

function oauthTone(status: EbayOAuthStatus) {
  if (status === "valid") return "teal";
  if (status === "expired") return "gold";
  return "pink";
}

function connectionLabel(status: EbayConnectionStatus) {
  if (status === "not_configured") return "Not Configured";
  if (status === "connecting") return "Connecting";
  if (status === "connected") return "Connected";
  return "Failed";
}

function oauthLabel(status: EbayOAuthStatus) {
  if (status === "valid") return "Valid";
  if (status === "expired") return "Expired";
  return "Missing";
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[124px_minmax(0,1fr)] items-center gap-3 rounded-md border border-acv-border bg-black/20 px-3 py-2 text-xs">
      <span className="text-acv-muted">{label}</span>
      <span className="min-w-0 break-words font-semibold text-acv-text">{value}</span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "primary",
  icon
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary";
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        tone === "primary"
          ? "border-acv-teal/40 bg-acv-teal text-black hover:bg-cyan-200"
          : "border-acv-border bg-white/[0.03] text-acv-text hover:border-acv-teal/50 hover:text-acv-teal"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IntegrationsClient({ initialEbayEnvironments }: IntegrationsClientProps) {
  const [selectedEnvironment, setSelectedEnvironment] = useState<EbayEnvironment>("sandbox");
  const [environments, setEnvironments] = useState(initialEbayEnvironments);
  const [testResult, setTestResult] = useState<EbayConnectionTestResult | null>(null);
  const [loadingAction, setLoadingAction] = useState<"test" | "refresh" | null>(null);

  const selected = useMemo(
    () => environments.find((environment) => environment.environment === selectedEnvironment) || environments[0],
    [environments, selectedEnvironment]
  );
  const sandbox = environments.find((environment) => environment.environment === "sandbox");
  const production = environments.find((environment) => environment.environment === "production");
  const productionLocked = selectedEnvironment === "production" && !selected?.productionCallsAllowed;
  const actionDisabled = Boolean(loadingAction || !selected?.configured || productionLocked);

  async function runConnectionTest(forceRefresh: boolean) {
    setLoadingAction(forceRefresh ? "refresh" : "test");
    setTestResult(null);
    try {
      const response = await fetch("/api/integrations/ebay/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: selectedEnvironment,
          forceRefresh
        })
      });
      const payload = (await response.json()) as EbayTestResponse;
      if (payload.environments) setEnvironments(payload.environments);
      if (payload.result) setTestResult(payload.result);
      if (!payload.result && !response.ok) {
        setTestResult({
          environment: selectedEnvironment,
          connectionStatus: "failed",
          oauthStatus: "missing",
          marketplaceId: selected?.marketplaceId || "EBAY_US",
          message: "Connection test failed.",
          errorCategory: "unknown"
        });
      }
    } catch (error) {
      setTestResult({
        environment: selectedEnvironment,
        connectionStatus: "failed",
        oauthStatus: selected?.oauth.status || "missing",
        marketplaceId: selected?.marketplaceId || "EBAY_US",
        message: error instanceof Error ? error.message : "Connection test failed.",
        errorCategory: "network_timeout"
      });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <SectionCard
      title="eBay"
      eyebrow="Marketplace integration"
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <StatusPill tone={sandbox?.connectionStatus === "connected" ? "teal" : sandbox?.configured ? "gold" : "pink"}>
            Sandbox {sandbox?.connectionStatus === "connected" ? "Connected" : sandbox?.configured ? "Configured" : "Missing"}
          </StatusPill>
          <StatusPill tone={production?.configured ? "gold" : "neutral"}>
            Production {production?.configured ? "Configured" : "Not Configured"}
          </StatusPill>
          <StatusPill tone="purple">Marketplace {selected?.marketplaceId || "EBAY_US"}</StatusPill>
        </div>
      }
    >
      <div className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">Environment</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {environments.map((environment) => {
                const active = selectedEnvironment === environment.environment;
                const disabledProduction = environment.environment === "production" && !environment.productionCallsAllowed;
                return (
                  <button
                    key={environment.environment}
                    type="button"
                    onClick={() => setSelectedEnvironment(environment.environment)}
                    className={cn(
                      "flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition",
                      active ? "border-acv-teal/50 bg-acv-teal/10 text-acv-text" : "border-acv-border bg-black/20 text-acv-muted hover:border-acv-purple/45"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full border", active ? "border-acv-teal bg-acv-teal" : "border-acv-muted")} />
                      <span className="font-semibold">{environment.label}</span>
                    </span>
                    {disabledProduction ? <StatusPill tone="gold">Guarded</StatusPill> : <StatusPill tone={environment.configured ? "teal" : "pink"}>{environment.configured ? "Ready" : "Missing"}</StatusPill>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <InfoRow
              label="Connection Status"
              value={<StatusPill tone={connectionTone(loadingAction ? "connecting" : selected.connectionStatus)}>{connectionLabel(loadingAction ? "connecting" : selected.connectionStatus)}</StatusPill>}
            />
            <InfoRow label="OAuth Token" value={<StatusPill tone={oauthTone(selected.oauth.status)}>{oauthLabel(selected.oauth.status)}</StatusPill>} />
            <InfoRow label="Marketplace" value={<StatusPill tone="purple">{selected.marketplaceId}</StatusPill>} />
            <InfoRow label="Last Connection Test" value={formatDate(selected.lastConnectionTestAt)} />
            <InfoRow label="Latency" value={typeof selected.lastLatencyMs === "number" ? `${selected.lastLatencyMs} ms` : "—"} />
            <InfoRow label="Token Expiration" value={formatDate(selected.oauth.expiresAt)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={loadingAction === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
              disabled={actionDisabled}
              onClick={() => runConnectionTest(false)}
            >
              {loadingAction === "test" ? "Testing" : "Test Connection"}
            </ActionButton>
            <ActionButton
              tone="secondary"
              icon={loadingAction === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              disabled={actionDisabled}
              onClick={() => runConnectionTest(true)}
            >
              {loadingAction === "refresh" ? "Refreshing" : "Refresh Token"}
            </ActionButton>
          </div>

          <div className="rounded-md border border-acv-border bg-black/20 px-3 py-2 text-xs leading-5 text-acv-muted">
            {productionLocked ? "Production is wired in the service layer but guarded so this phase cannot accidentally touch live eBay APIs." : selected.message}
          </div>

          {testResult ? (
            <div className={cn("rounded-md border px-3 py-2 text-xs leading-5", testResult.connectionStatus === "connected" ? "border-acv-teal/40 bg-acv-teal/10 text-acv-teal" : "border-acv-pink/40 bg-acv-pink/10 text-acv-pink")}>
              <p className="font-semibold">{testResult.message}</p>
              <p className="mt-1 text-acv-muted">
                {testResult.connectionStatus === "connected"
                  ? `OAuth ${oauthLabel(testResult.oauthStatus)} · ${testResult.latencyMs} ms · token expires ${formatDate(testResult.tokenExpiresAt)}`
                  : `Category: ${testResult.errorCategory || "unknown"}`}
              </p>
              {testResult.sampleItemTitle ? <p className="mt-1 break-words text-acv-muted">Sample result: {testResult.sampleItemTitle}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-md border border-acv-border bg-black/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">Future eBay Workflows</p>
                <p className="mt-1 text-xs text-acv-muted">Foundation only. No listing sync is active yet.</p>
              </div>
              <PlugZap className="h-5 w-5 text-acv-purple" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {["Inventory Sync", "Draft Sync", "Active Listings", "Sold Listings", "Pricing Engine", "Bulk Listing"].map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs text-acv-muted"
                >
                  <span className="truncate font-semibold">{item}</span>
                  <StatusPill tone="neutral">Coming Soon</StatusPill>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">Connection Flow</p>
            <div className="mt-3 space-y-2">
              {[
                ["Acquire application token", selected.oauth.status === "valid" ? "Cached" : "On demand"],
                ["Browse API test", "GET item_summary/search · limit 1"],
                ["Marketplace header", selected.marketplaceId],
                ["Production safety", selected.productionCallsAllowed ? "Enabled by env" : "Guarded"]
              ].map(([label, value]) => (
                <div key={label} className="flex min-w-0 items-center justify-between gap-3 rounded border border-acv-border bg-black/20 px-2 py-1.5 text-xs">
                  <span className="text-acv-muted">{label}</span>
                  <span className="min-w-0 break-words text-right font-semibold text-acv-text">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
            <div className="flex items-start gap-2">
              {selected.connectionStatus === "connected" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-acv-teal" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-acv-gold" />}
              <p className="text-xs leading-5 text-acv-muted">
                OAuth tokens are cached in server memory and refreshed before expiration. A page render never requests a token; only the Test Connection and Refresh Token actions do.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

