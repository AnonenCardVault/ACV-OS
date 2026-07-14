import Image from "next/image";
import { AlertTriangle, Database, FileSearch, ListChecks, Palette, Save, ShieldCheck, Store } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { getCatalogHealthSummary, type CatalogCount, type CatalogDiagnosticsSummary, type CatalogHealthSummary, type CatalogHealthStatus } from "@/lib/catalog/catalog-health";
import { getEbayDeletionComplianceSummary } from "@/lib/ebay/notifications/notification-store";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, style: "percent" });

function formatNumber(value?: number) {
  return numberFormatter.format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function statusTone(status: CatalogHealthStatus) {
  if (status === "available") return "teal";
  if (status === "error") return "pink";
  return "gold";
}

function statusLabel(status: CatalogHealthStatus) {
  if (status === "available") return "Available";
  if (status === "error") return "Error";
  return "Missing";
}

function CatalogStatusCard({
  title,
  status,
  primary,
  secondary,
  icon
}: {
  title: string;
  status: CatalogHealthStatus;
  primary: string;
  secondary: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-acv-teal">{icon}</span>
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{title}</p>
        </div>
        <StatusPill tone={statusTone(status)} className="shrink-0">
          {statusLabel(status)}
        </StatusPill>
      </div>
      <p className="mt-3 truncate text-lg font-semibold text-acv-text">{primary}</p>
      <p className="mt-1 min-h-4 break-words text-xs text-acv-muted">{secondary}</p>
    </div>
  );
}

function CountList({ title, items, empty = "No count data available." }: { title: string; items: CatalogCount[]; empty?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{title}</p>
      <div className="mt-3 max-h-60 space-y-1 overflow-y-auto pr-1 acv-scrollbar">
        {items.length ? (
          items.map((item) => (
            <div key={`${title}-${item.label}`} className="flex min-w-0 items-center justify-between gap-3 rounded border border-acv-border/70 bg-black/20 px-2 py-1.5 text-xs">
              <span className="min-w-0 break-words text-acv-text">{item.label}</span>
              <span className="shrink-0 font-semibold text-acv-teal">{formatNumber(item.count)}</span>
            </div>
          ))
        ) : (
          <p className="rounded border border-acv-border/70 bg-black/20 px-2 py-2 text-xs text-acv-muted">{empty}</p>
        )}
      </div>
    </div>
  );
}

function DiagnosticsGrid({ diagnostics }: { diagnostics?: CatalogDiagnosticsSummary }) {
  const items = [
    ["Rows found", diagnostics?.rowsFound],
    ["Accepted", diagnostics?.rowsAccepted],
    ["Rejected", diagnostics?.rowsRejected],
    ["Duplicates", diagnostics?.duplicateCount],
    ["Navigation removed", diagnostics?.navigationRowsRemoved],
    ["Acceptance", diagnostics?.acceptanceRate]
  ] as const;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</p>
          <p className="mt-1 text-sm font-semibold text-acv-text">
            {label === "Acceptance" && typeof value === "number" ? percentFormatter.format(value) : typeof value === "number" ? formatNumber(value) : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

function CatalogHealthPanel({ health }: { health: CatalogHealthSummary }) {
  const sports = health.sports;
  const pokemon = health.pokemon;

  return (
    <SectionCard
      title="Catalog Health"
      eyebrow="Read-only coverage"
      action={<StatusPill tone="purple">Server summary</StatusPill>}
    >
      <div className="space-y-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <CatalogStatusCard
            title="Pokémon catalog"
            status={pokemon.status}
            primary={`${formatNumber(pokemon.cardCount)} cards`}
            secondary={`${formatNumber(pokemon.setCount)} sets · ${pokemon.message || `Updated ${formatDate(pokemon.lastUpdated)}`}`}
            icon={<Database className="h-4 w-4" />}
          />
          <CatalogStatusCard
            title="Sports catalog"
            status={sports.status}
            primary={`${formatNumber(sports.totalRows)} rows`}
            secondary={sports.message || `Generated ${formatDate(sports.generatedAt)}`}
            icon={<ListChecks className="h-4 w-4" />}
          />
          <CatalogStatusCard
            title="Sports index"
            status={sports.index.status}
            primary={`${formatNumber(sports.index.indexedRecordCount)} indexed`}
            secondary={sports.index.message || `${formatNumber(sports.index.bucketCount)} buckets · ${formatDate(sports.index.generatedAt)}`}
            icon={<Database className="h-4 w-4" />}
          />
          <CatalogStatusCard
            title="Targets"
            status={sports.missingTargetCount ? "error" : "available"}
            primary={`${formatNumber(sports.discoveredTargetCount)} discovered`}
            secondary={`${formatNumber(sports.enabledTargetCount)} enabled · ${formatNumber(sports.approvedUrlCount)} approved URLs`}
            icon={<FileSearch className="h-4 w-4" />}
          />
          <CatalogStatusCard
            title="Latest import"
            status={sports.latestImportLogAt ? "available" : "missing"}
            primary={formatDate(sports.latestImportLogAt)}
            secondary={`Checked ${formatDate(health.checkedAt)}`}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
        </div>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
          <CountList title="Counts by sport" items={sports.countsBySport} />
          <CountList title="Counts by year" items={sports.countsByYear} />
          <CountList title="Top brand / product" items={sports.countsByBrandProduct} />
        </div>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 rounded-md border border-acv-border bg-black/20 p-3">
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Parser Diagnostics</p>
                <p className="mt-1 text-xs text-acv-muted">Imported checklist parsing quality from the latest local artifacts.</p>
              </div>
              <StatusPill tone="teal" className="shrink-0">
                Read only
              </StatusPill>
            </div>
            <DiagnosticsGrid diagnostics={sports.diagnostics} />
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <CountList title="Accepted rows by provider" items={sports.diagnostics?.providers || []} />
              <CountList title="Top validation failures" items={sports.diagnostics?.validationFailures || []} empty="No validation failures found." />
            </div>
          </div>

          <div className="min-w-0 rounded-md border border-acv-border bg-black/20 p-3">
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-acv-gold" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Missing / Failed Targets</p>
                <p className="mt-1 text-xs text-acv-muted">Latest import issues, if a local log is available.</p>
              </div>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1 acv-scrollbar">
              {sports.failedTargets.length ? (
                sports.failedTargets.map((target, index) => (
                  <div key={`${target.targetId || "target"}-${index}`} className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-2 text-xs">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <StatusPill tone="gold" className="max-w-full whitespace-normal break-words text-left leading-tight">
                        {target.sourceName || "Unknown source"}
                      </StatusPill>
                      <span className="min-w-0 break-words font-semibold text-acv-text">{target.targetId || "Unknown target"}</span>
                    </div>
                    <p className="mt-2 break-words text-acv-muted">{target.error}</p>
                    {target.sourceUrl ? <p className="mt-1 break-all text-[11px] text-acv-muted/80">{target.sourceUrl}</p> : null}
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs text-acv-muted">No failed checklist targets were found in the latest local import log.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

async function EbayCompliancePanel() {
  const summary = await getEbayDeletionComplianceSummary();
  const tone = summary.status === "Misconfigured" || summary.status === "Error" ? "pink" : summary.status === "Ready" ? "teal" : "gold";

  return (
    <SectionCard
      title="eBay Account Deletion"
      eyebrow="Marketplace compliance"
      action={<StatusPill tone={tone}>{summary.status}</StatusPill>}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Endpoint configured</p>
          <p className="mt-2 text-sm font-semibold text-acv-text">{summary.configured ? "Yes" : "No"}</p>
        </div>
        <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3 md:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Endpoint URL</p>
          <p className="mt-2 break-all text-xs font-semibold text-acv-text">{summary.endpointUrl}</p>
        </div>
        <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Last notification</p>
          <p className="mt-2 text-sm font-semibold text-acv-text">{formatDate(summary.lastNotificationAt || undefined)}</p>
        </div>
        <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Last processed</p>
          <p className="mt-2 text-sm font-semibold text-acv-text">{formatDate(summary.lastSuccessfulProcessingAt || undefined)}</p>
        </div>
        <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Last challenge</p>
          <p className="mt-2 text-sm font-semibold text-acv-text">{formatDate(summary.lastChallengeAt || undefined)}</p>
        </div>
      </div>
      <p className="mt-3 rounded-md border border-acv-border bg-black/20 px-3 py-2 text-xs text-acv-muted">
        {summary.message}
      </p>
    </SectionCard>
  );
}

export default async function SettingsPage() {
  const catalogHealth = await getCatalogHealthSummary();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Branding, source-of-truth rules, workflow statuses, locations, team preferences, and future integration readiness."
        action={<ActionButton icon={<Save className="h-4 w-4" />}>Save settings</ActionButton>}
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[380px_1fr]">
        <SectionCard title="Brand Identity" eyebrow="AnonenCardVault">
          <div className="flex items-center gap-4">
            <Image
              src="/acv-logo.jpeg"
              alt="ACV AnonenCardVault logo"
              width={108}
              height={108}
              className="h-24 w-24 rounded-lg border border-acv-gold/40 object-cover"
            />
            <div>
              <p className="text-lg font-semibold text-acv-text">ACV OS</p>
              <p className="text-sm text-acv-muted">AnonenCardVault</p>
              <div className="mt-3 flex gap-2">
                <StatusPill tone="purple">Purple</StatusPill>
                <StatusPill tone="gold">Gold</StatusPill>
                <StatusPill tone="teal">Teal</StatusPill>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Source of Truth" eyebrow="Business rules">
            <div className="space-y-2 text-xs">
              {["SKU", "Inventory record", "Purchase cost", "Location", "Internal notes", "AI confidence", "Workflow status"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <span className="text-acv-muted">{item}</span>
                  <StatusPill tone="teal">ACV owns</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Integration Readiness" eyebrow="Future layers">
            <div className="space-y-3">
              {[
                ["Supabase auth/database", "Planned"],
                ["Object storage for images", "Planned"],
                ["eBay sync", "Offline"],
                ["AI image recognition", "Offline"],
                ["Payment/domain work", "Offline"]
              ].map(([label, status]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs">
                  <span className="text-acv-muted">{label}</span>
                  <StatusPill tone={status === "Offline" ? "pink" : "purple"}>{status}</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Workflow Statuses">
            <div className="flex flex-wrap gap-2">
              {["Needs Review", "Needs Pricing", "Ready for Draft", "Ready to Publish", "Listed", "Sold", "Completed", "Archived"].map((status) => (
                <StatusPill key={status} tone={status.startsWith("Needs") ? "pink" : status === "Listed" ? "teal" : "purple"}>
                  {status}
                </StatusPill>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Theme Controls">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <Palette className="h-5 w-5 text-acv-purple" />
                <div>
                  <p className="text-sm font-semibold text-acv-text">Dark command center</p>
                  <p className="text-xs text-acv-muted">Charcoal panels, thin borders, compact density.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <Store className="h-5 w-5 text-acv-gold" />
                <div>
                  <p className="text-sm font-semibold text-acv-text">Brand-forward shell</p>
                  <p className="text-xs text-acv-muted">ACV logo and AnonenCardVault naming stay visible.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <ShieldCheck className="h-5 w-5 text-acv-teal" />
                <div>
                  <p className="text-sm font-semibold text-acv-text">Confirmation gates</p>
                  <p className="text-xs text-acv-muted">Marketplace changes remain staged for approval.</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EbayCompliancePanel />
      </div>
      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <CatalogHealthPanel health={catalogHealth} />
      </div>
    </>
  );
}
