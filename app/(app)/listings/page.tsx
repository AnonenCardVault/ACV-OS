"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  RefreshCcw,
  Save,
  Send,
  Sparkles,
  X,
  XCircle
} from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { activeListingRows, listingDraftQueue, stagedListingUpdates } from "@/data/mock";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type DraftRow = (typeof listingDraftQueue)[number];
type ActiveListingRow = (typeof activeListingRows)[number];
type DrawerMode = "generate" | "review";

function pillTone(value: string): "green" | "teal" | "gold" | "pink" | "purple" | "neutral" {
  if (["Ready", "Generated", "Reviewed", "Active", "In sync", "Low"].includes(value)) return "teal";
  if (["Needs Review", "Missing Back", "Review", "Review comps", "Paused", "Medium"].includes(value)) return "gold";
  if (["Blocked", "Needs AI", "SKU drift", "Price drift", "Quantity drift", "High"].includes(value)) return "pink";
  return "purple";
}

function detailLabel(label: string) {
  return label.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function CardImageTile({
  label,
  category,
  large = false
}: {
  label: string;
  category: string;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col justify-between overflow-hidden rounded border border-acv-border bg-gradient-to-br from-acv-purple/35 via-acv-panel2 to-acv-gold/20 p-2",
        large ? "h-72 w-full max-w-56" : "h-12 w-9"
      )}
    >
      <span className={cn("font-bold uppercase text-acv-gold", large ? "text-xs" : "text-[8px]")}>{category.slice(0, 3)}</span>
      <span className={cn("font-semibold leading-tight text-acv-text", large ? "text-sm" : "text-[7px]")}>{large ? label : "ACV"}</span>
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-acv-teal shadow-[0_0_14px_#26d4c7]" />
    </div>
  );
}

function MiniActionButton({
  children,
  onClick,
  tone = "neutral"
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "neutral" | "teal" | "gold";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 whitespace-nowrap rounded border px-2 text-[11px] font-semibold transition",
        tone === "teal"
          ? "border-acv-teal/40 bg-acv-teal/10 text-acv-teal hover:bg-acv-teal/15"
          : tone === "gold"
            ? "border-acv-gold/35 bg-acv-gold/10 text-acv-gold hover:bg-acv-gold/15"
            : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
      )}
    >
      {children}
    </button>
  );
}

function ListingActionsDropdown() {
  return (
    <label className="relative inline-flex">
      <select
        aria-label="Listing actions"
        defaultValue=""
        className="h-8 w-32 appearance-none rounded-md border border-acv-border bg-acv-panel2 px-2 pr-7 text-[11px] font-semibold text-acv-text outline-none transition hover:border-acv-teal/45"
      >
        <option value="" disabled>
          Actions
        </option>
        <option>Edit SKU</option>
        <option>Edit Price</option>
        <option>Edit Quantity</option>
        <option>Review Comps</option>
        <option>Stage Update</option>
        <option>End Listing</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-acv-muted" />
    </label>
  );
}

function DraftDetailDrawer({
  draft,
  mode,
  onClose
}: {
  draft: DraftRow;
  mode: DrawerMode;
  onClose: () => void;
}) {
  const warnings = draft.warnings.length ? draft.warnings : ["No blocking warnings. Confirm final photos before staging."];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <button type="button" aria-label="Close draft drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-acv-border bg-acv-black shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill tone={mode === "generate" ? "teal" : "gold"}>{mode === "generate" ? "Generate Draft" : "Review Draft"}</StatusPill>
              <StatusPill tone={pillTone(draft.draftStatus)}>{draft.draftStatus}</StatusPill>
            </div>
            <h2 className="truncate text-lg font-semibold text-acv-text">{draft.name}</h2>
            <p className="mt-1 text-xs text-acv-muted">{draft.sku}</p>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-acv-border text-acv-muted transition hover:text-acv-teal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="acv-scrollbar flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 md:grid-cols-[224px_1fr]">
            <CardImageTile label={draft.name} category={draft.category} large />
            <div className="space-y-4">
              <div className="rounded-lg border border-acv-border bg-acv-panel p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Card Details</p>
                  <StatusPill tone="teal">{formatPercent(draft.aiConfidence)} AI confidence</StatusPill>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  {Object.entries(draft.details).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                      <span className="text-acv-muted">{detailLabel(label)}</span>
                      <span className="text-right font-semibold text-acv-text">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-acv-muted">Cost</p>
                  <p className="mt-2 text-lg font-semibold text-acv-pink">{formatCurrency(draft.cost)}</p>
                </div>
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-acv-muted">Market</p>
                  <p className="mt-2 text-lg font-semibold text-acv-green">{formatCurrency(draft.marketValue)}</p>
                </div>
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-acv-muted">Suggested</p>
                  <p className="mt-2 text-lg font-semibold text-acv-gold">{formatCurrency(draft.suggestedPrice)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Suggested Title</p>
              <p className="mt-3 rounded-md border border-acv-border bg-acv-panel2 p-3 text-sm text-acv-text">{draft.suggestedTitle}</p>
            </section>

            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Suggested Description</p>
              <p className="mt-3 rounded-md border border-acv-border bg-acv-panel2 p-3 text-sm leading-6 text-acv-text">
                {draft.suggestedDescription}
              </p>
            </section>

            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Item Specifics Checklist</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {draft.specifics.map((specific) => (
                  <div key={specific.label} className="flex items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs">
                    <span className="text-acv-muted">{specific.label}</span>
                    <span className="flex items-center gap-2 text-right font-semibold text-acv-text">
                      {specific.value}
                      {specific.complete ? <CheckCircle2 className="h-4 w-4 text-acv-green" /> : <AlertTriangle className="h-4 w-4 text-acv-gold" />}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Warnings / Missing Fields</p>
              <div className="mt-3 space-y-2">
                {warnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3 text-xs text-acv-muted">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-acv-gold" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-2 border-t border-acv-border bg-black/70 p-4 sm:grid-cols-4">
          <MiniActionButton tone="gold">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCcw className="h-3.5 w-3.5" />
              Regenerate
            </span>
          </MiniActionButton>
          <MiniActionButton>
            <span className="inline-flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </span>
          </MiniActionButton>
          <MiniActionButton tone="teal">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Approve
            </span>
          </MiniActionButton>
          <MiniActionButton tone="teal">
            <span className="inline-flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Stage to eBay
            </span>
          </MiniActionButton>
        </div>
      </aside>
    </div>
  );
}

export default function ListingsPage() {
  const [selectedDraft, setSelectedDraft] = useState<DraftRow | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("review");

  function openDraft(draft: DraftRow, mode: DrawerMode) {
    setSelectedDraft(draft);
    setDrawerMode(mode);
  }

  return (
    <>
      <PageHeader
        title="Listings Workstation"
        description="Manage draft creation, listing QA, SKU updates, price changes, quantity changes, staged revisions, and future eBay sync from one dense command view."
        status="eBay mock"
        action={<ActionButton icon={<Send className="h-4 w-4" />}>Stage mock update</ActionButton>}
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {[
            ["Ready for Draft", String(listingDraftQueue.filter((row) => row.draftStatus === "Ready").length), "text-acv-teal"],
            ["Active Listings", String(activeListingRows.length), "text-acv-gold"],
            ["Drift Alerts", String(activeListingRows.filter((row) => row.driftStatus !== "In sync").length), "text-acv-pink"],
            ["Staged Updates", String(stagedListingUpdates.length), "text-acv-purple"]
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-acv-muted">{label}</p>
              <p className={cn("mt-2 text-2xl font-semibold", color)}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <SectionCard
            title="Draft Builder Queue"
            eyebrow="Ready for listing"
            action={<StatusPill tone="teal">{listingDraftQueue.length} staged items</StatusPill>}
          >
            <DataTable<DraftRow>
              rows={listingDraftQueue}
              getRowKey={(row) => row.sku}
              columns={[
                {
                  key: "image",
                  header: "Image",
                  cell: (row) => <CardImageTile label={row.name} category={row.category} />
                },
                { key: "sku", header: "SKU", cell: (row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
                { key: "name", header: "Card Name", cell: (row) => <span className="line-clamp-1 min-w-64">{row.name}</span> },
                { key: "category", header: "Category", cell: (row) => row.category },
                { key: "location", header: "Location", cell: (row) => row.location },
                { key: "cost", header: "Cost", cell: (row) => <span className="text-acv-pink">{formatCurrency(row.cost)}</span> },
                { key: "market", header: "Market", cell: (row) => <span className="text-acv-green">{formatCurrency(row.marketValue)}</span> },
                { key: "suggested", header: "Suggested", cell: (row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.suggestedPrice)}</span> },
                {
                  key: "title",
                  header: "Title",
                  cell: (row) => <StatusPill tone={pillTone(row.titleStatus)}>{row.titleStatus}</StatusPill>
                },
                {
                  key: "description",
                  header: "Description",
                  cell: (row) => <StatusPill tone={pillTone(row.descriptionStatus)}>{row.descriptionStatus}</StatusPill>
                },
                {
                  key: "photo",
                  header: "Photo",
                  cell: (row) => <StatusPill tone={pillTone(row.photoStatus)}>{row.photoStatus}</StatusPill>
                },
                {
                  key: "draft",
                  header: "Draft",
                  cell: (row) => <StatusPill tone={pillTone(row.draftStatus)}>{row.draftStatus}</StatusPill>
                },
                {
                  key: "actions",
                  header: "Actions",
                  className: "min-w-72",
                  cell: (row) => (
                    <div className="grid grid-cols-2 gap-1.5">
                      <MiniActionButton tone="teal" onClick={() => openDraft(row, "generate")}>
                        Generate Draft
                      </MiniActionButton>
                      <MiniActionButton onClick={() => openDraft(row, "review")}>Review Draft</MiniActionButton>
                      <MiniActionButton tone="gold">Approve Draft</MiniActionButton>
                      <MiniActionButton>Stage to eBay</MiniActionButton>
                    </div>
                  )
                }
              ]}
            />
          </SectionCard>

          <SectionCard title="Staged Updates" eyebrow="Awaiting eBay push">
            <div className="space-y-3">
              {stagedListingUpdates.map((update) => (
                <div key={update.id} className="rounded-lg border border-acv-border bg-acv-panel2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={pillTone(update.riskLevel)}>{update.riskLevel} risk</StatusPill>
                        <StatusPill tone="purple">{update.changeType}</StatusPill>
                      </div>
                      <p className="mt-3 line-clamp-1 text-sm font-semibold text-acv-text">{update.item}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs">
                    <div className="rounded-md border border-acv-border bg-black/20 p-2">
                      <p className="text-acv-muted">Current eBay value</p>
                      <p className="mt-1 line-clamp-1 font-semibold text-acv-pink">{update.currentEbayValue}</p>
                    </div>
                    <div className="rounded-md border border-acv-border bg-black/20 p-2">
                      <p className="text-acv-muted">ACV value</p>
                      <p className="mt-1 line-clamp-1 font-semibold text-acv-teal">{update.acvValue}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniActionButton tone="teal">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </span>
                    </MiniActionButton>
                    <MiniActionButton>
                      <span className="inline-flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </span>
                    </MiniActionButton>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Active Listings Monitor"
          eyebrow="Marketplace state"
          action={
            <div className="hidden items-center gap-2 sm:flex">
              <StatusPill tone="pink">API offline</StatusPill>
              <ActionButton variant="ghost" icon={<RefreshCcw className="h-4 w-4" />}>
                Mock sync
              </ActionButton>
            </div>
          }
        >
          <DataTable<ActiveListingRow>
            rows={activeListingRows}
            getRowKey={(row) => row.sku}
            columns={[
              {
                key: "image",
                header: "Image",
                cell: (row) => <CardImageTile label={row.title} category={row.category} />
              },
              { key: "sku", header: "SKU", cell: (row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
              { key: "title", header: "Title", cell: (row) => <span className="line-clamp-1 min-w-96">{row.title}</span> },
              { key: "status", header: "Status", cell: (row) => <StatusPill tone={pillTone(row.status)}>{row.status}</StatusPill> },
              { key: "listed", header: "Listed", cell: (row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.listedPrice)}</span> },
              { key: "market", header: "Market", cell: (row) => <span className="text-acv-green">{formatCurrency(row.marketPrice)}</span> },
              { key: "sold", header: "Sold Median", cell: (row) => formatCurrency(row.soldMedian) },
              { key: "activeLow", header: "Active Low", cell: (row) => <span className="text-acv-pink">{formatCurrency(row.activeLow)}</span> },
              { key: "views", header: "Views", cell: (row) => row.views },
              { key: "watchers", header: "Watchers", cell: (row) => <span className="font-semibold text-acv-teal">{row.watchers}</span> },
              { key: "quantity", header: "Qty", cell: (row) => row.quantity },
              { key: "days", header: "Days", cell: (row) => row.daysListed },
              { key: "location", header: "Location", cell: (row) => row.location },
              { key: "drift", header: "Drift", cell: (row) => <StatusPill tone={pillTone(row.driftStatus)}>{row.driftStatus}</StatusPill> },
              { key: "actions", header: "Actions", cell: () => <ListingActionsDropdown /> }
            ]}
          />
        </SectionCard>

        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard title="Draft QA Rules" eyebrow="Confirmation gates">
            <div className="space-y-2 text-xs">
              {["SKU/custom label changes", "Price revisions", "Quantity revisions", "Title and description changes", "End listing actions"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <span className="text-acv-muted">{item}</span>
                  <StatusPill tone="gold">Confirm</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Listing Workload" eyebrow="Today">
            <div className="grid gap-2 text-xs">
              {[
                ["Drafts to generate", "4", "teal"],
                ["Photos needing review", "2", "gold"],
                ["Low-confidence AI drafts", "1", "pink"],
                ["Comps to refresh", "3", "purple"]
              ].map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <span className="text-acv-muted">{label}</span>
                  <StatusPill tone={tone as "teal" | "gold" | "pink" | "purple"}>{value}</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Future Sync Surface" eyebrow="Mock only">
            <div className="space-y-3 text-xs leading-5 text-acv-muted">
              <div className="flex items-start gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <FileText className="mt-0.5 h-4 w-4 text-acv-gold" />
                <span>Drafts are staged locally until eBay draft creation is added.</span>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <CircleDollarSign className="mt-0.5 h-4 w-4 text-acv-green" />
                <span>Price, SKU, and quantity updates stay behind approval gates.</span>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-acv-teal" />
                <span>AI text is draft assistance only and never writes to eBay in this shell.</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {selectedDraft && <DraftDetailDrawer draft={selectedDraft} mode={drawerMode} onClose={() => setSelectedDraft(null)} />}
    </>
  );
}
