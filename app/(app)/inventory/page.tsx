"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  FileClock,
  History,
  Layers3,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Tag,
  Upload,
  X
} from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { inventoryItems } from "@/data/mock";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type InventoryItem = (typeof inventoryItems)[number];
type ViewMode = "Listings" | "Drafts" | "Unlisted / Inactive" | "All Inventory";
type ListingSubTab = "All Listings" | "BIN" | "Auctions";
type ConfidenceBand = "Low" | "Medium" | "High";
type Row = InventoryItem & { ops: InventoryOps };

type InventoryOps = {
  playerCharacter: string;
  team: string;
  autoRelicFlags: string;
  conditionNotes: string;
  listingType: "BIN" | "Auction" | "None";
  listingStatus: string;
  views: number;
  watchers: number;
  soldMedian: number;
  activeLow: number;
  driftStatus: string;
  draftSource: "ACV Draft" | "Future eBay Draft" | "None";
  titleStatus: string;
  descriptionStatus: string;
  photoStatus: string;
  priceStatus: string;
  suggestedPrice: number;
  nextAction: string;
  compSummary: string;
  skuHistory: string[];
  lifecycleTimeline: string[];
  auditHistory: string[];
};

const views: ViewMode[] = ["Listings", "Drafts", "Unlisted / Inactive", "All Inventory"];
const listingSubTabs: ListingSubTab[] = ["All Listings", "BIN", "Auctions"];

const opsBySku: Record<string, InventoryOps> = {
  "ACV-NFL-000421": {
    playerCharacter: "CJ Stroud",
    team: "Houston Texans",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Clean front, minor edge review complete.",
    listingType: "BIN",
    listingStatus: "Active",
    views: 214,
    watchers: 18,
    soldMedian: 122.5,
    activeLow: 109.99,
    driftStatus: "In sync",
    draftSource: "None",
    titleStatus: "Approved",
    descriptionStatus: "Approved",
    photoStatus: "Reviewed",
    priceStatus: "Approved",
    suggestedPrice: 129.99,
    nextAction: "Monitor watchers",
    compSummary: "Median sold $122.50, active low $109.99, current ask supported by watchers.",
    skuHistory: ["Created ACV-NFL-000421", "Pushed custom label mock", "No duplicate detected"],
    lifecycleTimeline: ["Photo intake approved", "Priced", "Draft approved", "Listed"],
    auditHistory: ["Price reviewed Jul 05", "SKU validated Jul 05"]
  },
  "ACV-POK-000382": {
    playerCharacter: "Charizard",
    team: "Pokemon",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Back image and condition notes required before listing.",
    listingType: "None",
    listingStatus: "Internal",
    views: 0,
    watchers: 0,
    soldMedian: 342,
    activeLow: 318,
    driftStatus: "Not listed",
    draftSource: "None",
    titleStatus: "Needs Review",
    descriptionStatus: "Generated",
    photoStatus: "Missing Back",
    priceStatus: "Needs Comps",
    suggestedPrice: 379.99,
    nextAction: "Send to pricing",
    compSummary: "Vintage comps vary by condition. Manual condition review required.",
    skuHistory: ["Created ACV-POK-000382", "Uniqueness check passed"],
    lifecycleTimeline: ["Manual intake", "Needs pricing", "Condition review pending"],
    auditHistory: ["Condition warning added Jul 05"]
  },
  "ACV-NBA-000511": {
    playerCharacter: "Anthony Edwards",
    team: "Minnesota Timberwolves",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Photos reviewed. Ready for listing QA.",
    listingType: "None",
    listingStatus: "Draft",
    views: 0,
    watchers: 0,
    soldMedian: 48,
    activeLow: 44.99,
    driftStatus: "Draft",
    draftSource: "ACV Draft",
    titleStatus: "Generated",
    descriptionStatus: "Generated",
    photoStatus: "Reviewed",
    priceStatus: "Suggested",
    suggestedPrice: 54.99,
    nextAction: "Review draft",
    compSummary: "Market estimate $49 with a $54.99 suggested ask.",
    skuHistory: ["Created ACV-NBA-000511", "Draft queued"],
    lifecycleTimeline: ["Photo reviewed", "Price suggested", "Draft ready"],
    auditHistory: ["Draft generated Jul 05"]
  },
  "ACV-MLB-000301": {
    playerCharacter: "Shohei Ohtani",
    team: "Los Angeles Angels",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Quantity 2. Recheck both copies before relist.",
    listingType: "Auction",
    listingStatus: "Active",
    views: 88,
    watchers: 9,
    soldMedian: 67.25,
    activeLow: 59.99,
    driftStatus: "Price drift",
    draftSource: "None",
    titleStatus: "Approved",
    descriptionStatus: "Approved",
    photoStatus: "Reviewed",
    priceStatus: "Review",
    suggestedPrice: 69.99,
    nextAction: "Review comps",
    compSummary: "Listed above current median. Consider repricing after stale listing review.",
    skuHistory: ["Created ACV-MLB-000301", "Quantity changed to 2", "Price review staged"],
    lifecycleTimeline: ["Imported lot", "Priced", "Listed", "Stale review"],
    auditHistory: ["Price drift flagged Jul 04"]
  },
  "ACV-TCG-000143": {
    playerCharacter: "Monkey D. Luffy",
    team: "Straw Hat Crew",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Low confidence. Confirm card number, rarity, and condition.",
    listingType: "None",
    listingStatus: "Internal",
    views: 0,
    watchers: 0,
    soldMedian: 140,
    activeLow: 132,
    driftStatus: "Needs review",
    draftSource: "None",
    titleStatus: "Generated",
    descriptionStatus: "Needs AI",
    photoStatus: "Needs Review",
    priceStatus: "Needs Comps",
    suggestedPrice: 154.99,
    nextAction: "Review AI match",
    compSummary: "No reliable price until identification confidence improves.",
    skuHistory: ["Created ACV-TCG-000143", "AI confidence warning"],
    lifecycleTimeline: ["Trade intake", "AI staged", "Manual review pending"],
    auditHistory: ["Low confidence flagged Jul 04"]
  },
  "ACV-NFL-000612": {
    playerCharacter: "Caleb Williams",
    team: "Chicago Bears",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Clean card. Confirm team keywords before listing.",
    listingType: "None",
    listingStatus: "Draft",
    views: 0,
    watchers: 0,
    soldMedian: 62,
    activeLow: 58,
    driftStatus: "Draft",
    draftSource: "Future eBay Draft",
    titleStatus: "Generated",
    descriptionStatus: "Generated",
    photoStatus: "Reviewed",
    priceStatus: "Suggested",
    suggestedPrice: 69.99,
    nextAction: "Stage draft",
    compSummary: "Suggested ask $69.99 with active competition near $58.",
    skuHistory: ["Created ACV-NFL-000612", "Future eBay draft placeholder"],
    lifecycleTimeline: ["Manual intake", "Draft prepared"],
    auditHistory: ["Draft shell created Jul 05"]
  },
  "ACV-POK-000208": {
    playerCharacter: "Umbreon",
    team: "Pokemon",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Sold. Keep record for reconciliation and shipping.",
    listingType: "BIN",
    listingStatus: "Sold",
    views: 141,
    watchers: 15,
    soldMedian: 32.5,
    activeLow: 28.99,
    driftStatus: "Sold",
    draftSource: "None",
    titleStatus: "Approved",
    descriptionStatus: "Approved",
    photoStatus: "Reviewed",
    priceStatus: "Sold",
    suggestedPrice: 32.5,
    nextAction: "Ship order",
    compSummary: "Sold at current median.",
    skuHistory: ["Created ACV-POK-000208", "Custom label synced mock"],
    lifecycleTimeline: ["Listed", "Sold", "Shipping queue"],
    auditHistory: ["Sale reconciled Jul 05"]
  },
  "ACV-TCG-000098": {
    playerCharacter: "Elsa",
    team: "Lorcana",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Missing location. Confirm before next pick list.",
    listingType: "BIN",
    listingStatus: "Paused",
    views: 301,
    watchers: 27,
    soldMedian: 179.5,
    activeLow: 169,
    driftStatus: "Quantity drift",
    draftSource: "None",
    titleStatus: "Approved",
    descriptionStatus: "Approved",
    photoStatus: "Reviewed",
    priceStatus: "Review",
    suggestedPrice: 184.99,
    nextAction: "Fix location",
    compSummary: "High watcher count. Quantity/location drift needs review.",
    skuHistory: ["Created ACV-TCG-000098", "Location removed", "Quantity drift staged"],
    lifecycleTimeline: ["Trade intake", "Listed", "Paused for location check"],
    auditHistory: ["Location warning Jul 03"]
  },
  "ACV-NBA-000777": {
    playerCharacter: "Victor Wembanyama",
    team: "San Antonio Spurs",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Purchase cost missing. AI match needs review.",
    listingType: "None",
    listingStatus: "Internal",
    views: 0,
    watchers: 0,
    soldMedian: 55,
    activeLow: 49.99,
    driftStatus: "Needs review",
    draftSource: "None",
    titleStatus: "Needs Review",
    descriptionStatus: "Not Started",
    photoStatus: "Needs Review",
    priceStatus: "Needs Cost",
    suggestedPrice: 64.99,
    nextAction: "Add cost",
    compSummary: "Pricing blocked until purchase cost is added.",
    skuHistory: ["Created ACV-NBA-000777", "Missing cost warning"],
    lifecycleTimeline: ["Break intake", "Needs review"],
    auditHistory: ["Cost warning Jul 02"]
  },
  "ACV-MLB-000888": {
    playerCharacter: "Elly De La Cruz",
    team: "Cincinnati Reds",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Needs comps before draft.",
    listingType: "None",
    listingStatus: "Internal",
    views: 0,
    watchers: 0,
    soldMedian: 34,
    activeLow: 29.99,
    driftStatus: "Not listed",
    draftSource: "None",
    titleStatus: "Not Started",
    descriptionStatus: "Not Started",
    photoStatus: "Reviewed",
    priceStatus: "Needs Comps",
    suggestedPrice: 39.99,
    nextAction: "Send to pricing",
    compSummary: "Market value $36. Need sold comps before draft.",
    skuHistory: ["Created ACV-MLB-000888", "Pricing queue"],
    lifecycleTimeline: ["Manual intake", "Needs pricing"],
    auditHistory: ["Pricing queue Jul 01"]
  }
};

function defaultOps(item: InventoryItem): InventoryOps {
  return {
    playerCharacter: item.name,
    team: "-",
    autoRelicFlags: "Unconfirmed",
    conditionNotes: item.notes,
    listingType: item.status === "Listed" ? "BIN" : "None",
    listingStatus: item.status,
    views: 0,
    watchers: 0,
    soldMedian: item.marketValue,
    activeLow: item.marketValue,
    driftStatus: item.status === "Listed" ? "In sync" : "Not listed",
    draftSource: item.status === "Ready for Draft" ? "ACV Draft" : "None",
    titleStatus: item.status === "Ready for Draft" ? "Generated" : "Not Started",
    descriptionStatus: item.status === "Ready for Draft" ? "Generated" : "Not Started",
    photoStatus: "Reviewed",
    priceStatus: item.askingPrice ? "Approved" : "Needs Comps",
    suggestedPrice: item.askingPrice || item.marketValue,
    nextAction: item.status,
    compSummary: "Mock comp summary pending.",
    skuHistory: [`Created ${item.sku}`],
    lifecycleTimeline: ["Inventory record created"],
    auditHistory: ["Mock audit placeholder"]
  };
}

function rowWithOps(item: InventoryItem): Row {
  return { ...item, ops: opsBySku[item.sku] || defaultOps(item) };
}

function statusTone(status: string): "green" | "teal" | "gold" | "pink" | "purple" | "neutral" {
  if (["Active", "Listed", "Ready for Draft", "Sold", "Approved", "Reviewed", "Generated", "In sync", "BIN"].includes(status)) return "teal";
  if (["Auction", "Draft", "Future eBay Draft", "ACV Draft", "Review", "Paused", "Suggested", "Medium"].includes(status)) return "gold";
  if (["Needs Pricing", "Needs Review", "Needs Comps", "Needs Cost", "Needs AI", "Missing Back", "Quantity drift", "Price drift", "SKU drift", "Low"].includes(status)) return "pink";
  return "purple";
}

function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence < 0.75) return "Low";
  if (confidence < 0.9) return "Medium";
  return "High";
}

function uniqueValues<T extends string>(values: T[]) {
  return Array.from(new Set(values.map((value) => value || "Missing"))).sort();
}

function CardImageTile({ label, category, large = false }: { label: string; category: string; large?: boolean }) {
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
  tone?: "neutral" | "teal" | "gold" | "pink";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold transition",
        tone === "teal"
          ? "border-acv-teal/40 bg-acv-teal/10 text-acv-teal hover:bg-acv-teal/15"
          : tone === "gold"
            ? "border-acv-gold/35 bg-acv-gold/10 text-acv-gold hover:bg-acv-gold/15"
            : tone === "pink"
              ? "border-acv-pink/40 bg-acv-pink/10 text-acv-pink hover:bg-acv-pink/15"
              : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-acv-border bg-acv-panel2 px-2 text-xs font-semibold text-acv-text outline-none transition hover:border-acv-teal/45"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectCheckbox({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border transition",
        checked ? "border-acv-teal bg-acv-teal/20 shadow-[0_0_14px_rgba(38,212,199,0.2)]" : "border-acv-border bg-acv-panel2 hover:border-acv-teal/60"
      )}
    >
      <span className={cn("h-2 w-2 rounded-[2px] transition", checked ? "bg-acv-teal" : "bg-transparent")} />
    </button>
  );
}

function DetailField({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "green" | "gold" | "pink" | "teal" }) {
  const toneClass = tone === "green" ? "text-acv-green" : tone === "gold" ? "text-acv-gold" : tone === "pink" ? "text-acv-pink" : tone === "teal" ? "text-acv-teal" : "text-acv-text";
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

function ItemDetailDrawer({
  row,
  onClose,
  onMockSave
}: {
  row: Row;
  onClose: () => void;
  onMockSave: (sku: string) => void;
}) {
  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm sm:left-56">
      <button type="button" aria-label="Close item detail drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-4xl flex-col border-l border-acv-border bg-acv-black shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
              <StatusPill tone={statusTone(row.ops.listingType)}>{row.ops.listingType === "None" ? "No live listing" : row.ops.listingType}</StatusPill>
              <StatusPill tone={statusTone(confidenceBand(row.aiConfidence))}>{formatPercent(row.aiConfidence)} confidence</StatusPill>
            </div>
            <h2 className="truncate text-lg font-semibold text-acv-text">{row.name}</h2>
            <p className="mt-1 text-xs text-acv-muted">{row.sku}</p>
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
          <div className="grid min-w-0 gap-5 lg:grid-cols-[224px_1fr]">
            <div className="space-y-3">
              <CardImageTile label={row.name} category={row.category} large />
              <div className="grid grid-cols-3 gap-2">
                {["Front", "Back", "Crop"].map((label) => (
                  <div key={label} className="rounded-md border border-acv-border bg-acv-panel2 px-2 py-2 text-center text-[11px] font-semibold text-acv-muted">
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Source Record</p>
                  <StatusPill tone="teal">ACV owns record</StatusPill>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <DetailField label="SKU" value={row.sku} tone="gold" />
                  <DetailField label="Card / Title" value={row.name} />
                  <DetailField label="Category" value={row.category} />
                  <DetailField label="Year" value={row.year} />
                  <DetailField label="Brand / Set" value={row.brandSet} />
                  <DetailField label="Player / Character" value={row.ops.playerCharacter} />
                  <DetailField label="Team" value={row.ops.team} />
                  <DetailField label="Card Number" value={row.cardNumber} />
                  <DetailField label="Parallel" value={row.parallel} />
                  <DetailField label="Serial Number" value={row.serialNumber} />
                  <DetailField label="Auto / Relic" value={row.ops.autoRelicFlags} />
                  <DetailField label="Status" value={row.status} tone={statusTone(row.status) === "pink" ? "pink" : "teal"} />
                  <DetailField label="Location" value={row.location || "Missing"} tone={row.location ? undefined : "pink"} />
                  <DetailField label="Purchase Cost" value={row.purchaseCost ? formatCurrency(row.purchaseCost) : "Missing"} tone={row.purchaseCost ? "pink" : "pink"} />
                  <DetailField label="Ask / Listed" value={row.askingPrice ? formatCurrency(row.askingPrice) : "-"} tone="gold" />
                  <DetailField label="Market Value" value={formatCurrency(row.marketValue)} tone="green" />
                  <DetailField label="Quantity" value={row.quantity} />
                  <DetailField label="Source" value={row.source} />
                  <DetailField label="AI Confidence" value={formatPercent(row.aiConfidence)} tone={confidenceBand(row.aiConfidence) === "Low" ? "pink" : confidenceBand(row.aiConfidence) === "Medium" ? "gold" : "teal"} />
                  <DetailField label="Listing Type" value={row.ops.listingType} tone={row.ops.listingType === "None" ? undefined : "gold"} />
                  <DetailField label="eBay Item ID" value={row.ebayId} />
                  <DetailField label="Comp Summary" value={row.ops.compSummary} tone="teal" />
                </div>
              </section>
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Condition Notes</p>
              <p className="mt-3 rounded-md border border-acv-border bg-acv-panel2 p-3 text-sm leading-6 text-acv-text">{row.ops.conditionNotes}</p>
            </section>
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Internal Notes</p>
              <textarea
                defaultValue={row.notes}
                className="mt-3 min-h-24 w-full rounded-md border border-acv-border bg-acv-panel2 p-3 text-sm leading-6 text-acv-text outline-none transition focus:border-acv-teal/60"
              />
            </section>
          </div>

          <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">SKU History</p>
              <div className="mt-3 space-y-2">
                {row.ops.skuHistory.map((entry) => (
                  <div key={entry} className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs text-acv-muted">
                    {entry}
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Lifecycle Timeline</p>
              <div className="mt-3 space-y-2">
                {row.ops.lifecycleTimeline.map((entry) => (
                  <div key={entry} className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs text-acv-muted">
                    {entry}
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Audit History</p>
              <div className="mt-3 space-y-2">
                {row.ops.auditHistory.map((entry) => (
                  <div key={entry} className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs text-acv-muted">
                    {entry}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-2 border-t border-acv-border bg-black/70 p-4 sm:grid-cols-3 xl:grid-cols-6">
          <MiniActionButton tone="teal" onClick={() => onMockSave(row.sku)}>
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </MiniActionButton>
          <MiniActionButton>
            <RefreshCcw className="h-3.5 w-3.5" />
            Send to Pricing
          </MiniActionButton>
          <MiniActionButton tone="gold">
            <FileClock className="h-3.5 w-3.5" />
            Generate Draft
          </MiniActionButton>
          <MiniActionButton tone="teal">
            <Tag className="h-3.5 w-3.5" />
            Stage Listing
          </MiniActionButton>
          <MiniActionButton tone="gold">
            <Send className="h-3.5 w-3.5" />
            Push SKU to eBay
          </MiniActionButton>
          <MiniActionButton tone="pink">
            <Archive className="h-3.5 w-3.5" />
            Archive
          </MiniActionButton>
        </div>
      </aside>
    </div>
  );
}

function ActionMenu({ row, onOpen }: { row: Row; onOpen: (row: Row) => void }) {
  return (
    <button
      type="button"
      title="Open item details"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(row);
      }}
      className="inline-flex h-8 items-center justify-center rounded-md border border-acv-border px-2.5 text-[11px] font-semibold text-acv-muted transition hover:border-acv-teal/45 hover:text-acv-teal"
    >
      Details
    </button>
  );
}

export default function InventoryPage() {
  const rows = useMemo(() => inventoryItems.map(rowWithOps), []);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Listings");
  const [listingSubTab, setListingSubTab] = useState<ListingSubTab>("All Listings");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [listingTypeFilter, setListingTypeFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [confidenceFilter, setConfidenceFilter] = useState("All");
  const [driftFilter, setDriftFilter] = useState("All");
  const [saveMessage, setSaveMessage] = useState("");

  const listedRows = rows.filter((row) => row.status === "Listed");
  const draftRows = rows.filter((row) => row.ops.draftSource !== "None");
  const unlistedRows = rows.filter((row) => row.status !== "Listed" && row.ops.draftSource === "None");

  const summary = {
    totalValue: rows.reduce((total, row) => total + row.marketValue * row.quantity, 0),
    listedValue: listedRows.reduce((total, row) => total + row.marketValue * row.quantity, 0),
    draftValue: draftRows.reduce((total, row) => total + row.marketValue * row.quantity, 0),
    unlistedValue: unlistedRows.reduce((total, row) => total + row.marketValue * row.quantity, 0),
    activeListings: listedRows.length,
    drafts: draftRows.length,
    unlistedItems: unlistedRows.length,
    needsReview: rows.filter((row) => row.status === "Needs Review" || row.aiConfidence < 0.75).length
  };

  const viewBaseRows = useMemo(() => {
    if (viewMode === "Listings") {
      return listedRows.filter((row) => listingSubTab === "All Listings" || row.ops.listingType === (listingSubTab === "BIN" ? "BIN" : "Auction"));
    }
    if (viewMode === "Drafts") return draftRows;
    if (viewMode === "Unlisted / Inactive") return unlistedRows;
    return rows;
  }, [draftRows, listedRows, listingSubTab, rows, unlistedRows, viewMode]);

  const filteredRows = useMemo(() => {
    return viewBaseRows.filter((row) => {
      const haystack = `${row.sku} ${row.name} ${row.category} ${row.brandSet} ${row.ops.playerCharacter} ${row.ops.team}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "All" || row.status === statusFilter || row.ops.listingStatus === statusFilter;
      const matchesCategory = categoryFilter === "All" || row.category === categoryFilter;
      const matchesLocation = locationFilter === "All" || (row.location || "Missing") === locationFilter;
      const matchesListingType = listingTypeFilter === "All" || row.ops.listingType === listingTypeFilter;
      const matchesSource = sourceFilter === "All" || row.source === sourceFilter;
      const matchesConfidence = confidenceFilter === "All" || confidenceBand(row.aiConfidence) === confidenceFilter;
      const matchesDrift = driftFilter === "All" || row.ops.driftStatus === driftFilter;
      return matchesQuery && matchesStatus && matchesCategory && matchesLocation && matchesListingType && matchesSource && matchesConfidence && matchesDrift;
    });
  }, [categoryFilter, confidenceFilter, driftFilter, listingTypeFilter, locationFilter, query, sourceFilter, statusFilter, viewBaseRows]);

  const visibleIds = filteredRows.map((row) => row.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = filteredRows.length > 0 && selectedVisibleCount === filteredRows.length;

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  function switchView(nextView: ViewMode) {
    setViewMode(nextView);
    setSelectedIds(new Set());
  }

  function mockSave(sku: string) {
    setSaveMessage(`${sku || "Inventory item"} saved locally in mock mode.`);
  }

  const checkboxHeader = (
    <SelectCheckbox checked={allVisibleSelected} label="Select all visible inventory rows" onChange={toggleVisible} />
  );

  const checkboxColumn = {
    key: "select",
    header: checkboxHeader,
    cell: (row: Row) => <SelectCheckbox checked={selectedIds.has(row.id)} label={`Select ${row.sku}`} onChange={(checked) => toggleRow(row.id, checked)} />
  };

  const listingColumns = [
    checkboxColumn,
    { key: "image", header: "Image", cell: (row: Row) => <CardImageTile label={row.name} category={row.category} /> },
    { key: "sku", header: "SKU", cell: (row: Row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
    { key: "name", header: "Title / Card Name", cell: (row: Row) => <span className="line-clamp-1 min-w-72">{row.name}</span> },
    { key: "listingType", header: "Listing Type", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.listingType)}>{row.ops.listingType}</StatusPill> },
    { key: "status", header: "Status", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.listingStatus)}>{row.ops.listingStatus}</StatusPill> },
    { key: "listedPrice", header: "Listed Price", cell: (row: Row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.askingPrice)}</span> },
    { key: "market", header: "Market Value", cell: (row: Row) => <span className="font-semibold text-acv-green">{formatCurrency(row.marketValue)}</span> },
    { key: "soldMedian", header: "Sold Median", cell: (row: Row) => formatCurrency(row.ops.soldMedian) },
    { key: "activeLow", header: "Active Low", cell: (row: Row) => <span className="text-acv-pink">{formatCurrency(row.ops.activeLow)}</span> },
    { key: "views", header: "Views", cell: (row: Row) => row.ops.views },
    { key: "watchers", header: "Watchers", cell: (row: Row) => <span className="font-semibold text-acv-teal">{row.ops.watchers}</span> },
    { key: "qty", header: "Qty", cell: (row: Row) => row.quantity },
    { key: "days", header: "Days Listed", cell: (row: Row) => row.daysListed },
    { key: "location", header: "Location", cell: (row: Row) => row.location || <span className="font-semibold text-acv-pink">Missing</span> },
    { key: "drift", header: "Drift", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.driftStatus)}>{row.ops.driftStatus}</StatusPill> },
    { key: "actions", header: "Actions", cell: (row: Row) => <ActionMenu row={row} onOpen={setSelectedRow} /> }
  ];

  const draftColumns = [
    checkboxColumn,
    { key: "image", header: "Image", cell: (row: Row) => <CardImageTile label={row.name} category={row.category} /> },
    { key: "sku", header: "SKU", cell: (row: Row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
    { key: "name", header: "Card Name", cell: (row: Row) => <span className="line-clamp-1 min-w-72">{row.name}</span> },
    { key: "draftSource", header: "Draft Source", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.draftSource)}>{row.ops.draftSource}</StatusPill> },
    { key: "titleStatus", header: "Title", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.titleStatus)}>{row.ops.titleStatus}</StatusPill> },
    { key: "descriptionStatus", header: "Description", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.descriptionStatus)}>{row.ops.descriptionStatus}</StatusPill> },
    { key: "photoStatus", header: "Photo", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.photoStatus)}>{row.ops.photoStatus}</StatusPill> },
    { key: "priceStatus", header: "Price", cell: (row: Row) => <StatusPill tone={statusTone(row.ops.priceStatus)}>{row.ops.priceStatus}</StatusPill> },
    { key: "suggestedPrice", header: "Suggested Price", cell: (row: Row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.ops.suggestedPrice)}</span> },
    { key: "lastUpdated", header: "Last Updated", cell: (row: Row) => <span className="whitespace-nowrap text-acv-muted">{row.lastUpdated}</span> },
    { key: "actions", header: "Actions", cell: (row: Row) => <ActionMenu row={row} onOpen={setSelectedRow} /> }
  ];

  const unlistedColumns = [
    checkboxColumn,
    { key: "image", header: "Image", cell: (row: Row) => <CardImageTile label={row.name} category={row.category} /> },
    { key: "sku", header: "SKU", cell: (row: Row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
    { key: "name", header: "Card Name", cell: (row: Row) => <span className="line-clamp-1 min-w-72">{row.name}</span> },
    { key: "category", header: "Category", cell: (row: Row) => row.category },
    { key: "status", header: "Status", cell: (row: Row) => <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill> },
    { key: "location", header: "Location", cell: (row: Row) => row.location || <span className="font-semibold text-acv-pink">Missing</span> },
    { key: "cost", header: "Cost", cell: (row: Row) => (row.purchaseCost ? <span className="text-acv-pink">{formatCurrency(row.purchaseCost)}</span> : <span className="font-semibold text-acv-pink">Missing</span>) },
    { key: "market", header: "Market Value", cell: (row: Row) => <span className="font-semibold text-acv-green">{formatCurrency(row.marketValue)}</span> },
    { key: "suggested", header: "Suggested Price", cell: (row: Row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.ops.suggestedPrice)}</span> },
    { key: "confidence", header: "Confidence", cell: (row: Row) => <span className={confidenceBand(row.aiConfidence) === "Low" ? "font-semibold text-acv-pink" : confidenceBand(row.aiConfidence) === "Medium" ? "text-acv-gold" : "text-acv-teal"}>{formatPercent(row.aiConfidence)}</span> },
    { key: "nextAction", header: "Next Action", cell: (row: Row) => <span className="whitespace-nowrap text-acv-muted">{row.ops.nextAction}</span> },
    { key: "actions", header: "Actions", cell: (row: Row) => <ActionMenu row={row} onOpen={setSelectedRow} /> }
  ];

  const allColumns = [
    checkboxColumn,
    { key: "image", header: "Image", cell: (row: Row) => <CardImageTile label={row.name} category={row.category} /> },
    { key: "sku", header: "SKU", cell: (row: Row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
    { key: "name", header: "Card Name", cell: (row: Row) => <span className="line-clamp-1 min-w-72">{row.name}</span> },
    { key: "category", header: "Category", cell: (row: Row) => row.category },
    { key: "status", header: "Status", cell: (row: Row) => <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill> },
    { key: "location", header: "Location", cell: (row: Row) => row.location || <span className="font-semibold text-acv-pink">Missing</span> },
    { key: "cost", header: "Cost", cell: (row: Row) => (row.purchaseCost ? <span className="text-acv-pink">{formatCurrency(row.purchaseCost)}</span> : <span className="font-semibold text-acv-pink">Missing</span>) },
    { key: "ask", header: "Ask / Listed", cell: (row: Row) => (row.askingPrice ? <span className="text-acv-gold">{formatCurrency(row.askingPrice)}</span> : "-") },
    { key: "market", header: "Market Value", cell: (row: Row) => <span className="font-semibold text-acv-green">{formatCurrency(row.marketValue)}</span> },
    { key: "qty", header: "Qty", cell: (row: Row) => row.quantity },
    { key: "source", header: "Source", cell: (row: Row) => row.source },
    { key: "confidence", header: "Confidence", cell: (row: Row) => <span className={confidenceBand(row.aiConfidence) === "Low" ? "font-semibold text-acv-pink" : confidenceBand(row.aiConfidence) === "Medium" ? "text-acv-gold" : "text-acv-teal"}>{formatPercent(row.aiConfidence)}</span> },
    { key: "actions", header: "Actions", cell: (row: Row) => <ActionMenu row={row} onOpen={setSelectedRow} /> }
  ];

  const columns = viewMode === "Listings" ? listingColumns : viewMode === "Drafts" ? draftColumns : viewMode === "Unlisted / Inactive" ? unlistedColumns : allColumns;

  return (
    <>
      <PageHeader
        title="Inventory Workstation"
        description="Operational source-of-truth views for live listings, drafts, unlisted inventory, and complete ACV records."
        action={
          <>
            <ActionButton variant="ghost" icon={<Upload className="h-4 w-4" />}>
              Import
            </ActionButton>
            <ActionButton icon={<Plus className="h-4 w-4" />}>Create item</ActionButton>
          </>
        }
      />

      <div className="min-w-0 space-y-4 p-3 sm:p-4 md:p-5">
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(138px,1fr))] gap-3">
          {[
            ["Total inventory value", formatCurrency(summary.totalValue), "text-acv-green"],
            ["Listed value", formatCurrency(summary.listedValue), "text-acv-teal"],
            ["Draft value", formatCurrency(summary.draftValue), "text-acv-gold"],
            ["Unlisted value", formatCurrency(summary.unlistedValue), "text-acv-text"],
            ["Active listings", String(summary.activeListings), "text-acv-teal"],
            ["Drafts", String(summary.drafts), "text-acv-gold"],
            ["Unlisted items", String(summary.unlistedItems), "text-acv-muted"],
            ["Needs review", String(summary.needsReview), "text-acv-pink"]
          ].map(([label, value, color]) => (
            <div key={label} className="min-w-0 rounded-lg border border-acv-border bg-acv-panel px-3 py-2.5">
              <p className="truncate text-[11px] uppercase tracking-[0.12em] text-acv-muted">{label}</p>
              <p className={cn("mt-1 truncate text-xl font-semibold", color)}>{value}</p>
            </div>
          ))}
        </div>

        <SectionCard title="Inventory Views" eyebrow="Operational lanes" action={<StatusPill tone="teal">{filteredRows.length} visible</StatusPill>}>
          <div className="flex min-w-0 flex-wrap gap-2">
            {views.map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => switchView(view)}
                className={cn(
                  "h-9 rounded-md border px-3 text-xs font-semibold transition",
                  viewMode === view ? "border-acv-teal/45 bg-acv-teal/10 text-acv-teal" : "border-acv-border bg-acv-panel2 text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
                )}
              >
                {view}
              </button>
            ))}
          </div>

          {viewMode === "Listings" && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-acv-border pt-3">
              {listingSubTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setListingSubTab(tab);
                    setSelectedIds(new Set());
                  }}
                  className={cn(
                    "h-8 rounded-md border px-3 text-[11px] font-semibold transition",
                    listingSubTab === tab ? "border-acv-gold/45 bg-acv-gold/10 text-acv-gold" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-gold/40 hover:text-acv-gold"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Filters" eyebrow="Fast narrowing">
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            <label className="min-w-0 sm:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Search</span>
              <div className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-acv-border bg-acv-panel2 px-3">
                <Search className="h-4 w-4 shrink-0 text-acv-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="SKU, player, set, team"
                  className="min-w-0 flex-1 bg-transparent text-xs text-acv-text outline-none placeholder:text-acv-muted"
                />
              </div>
            </label>
            <FilterSelect label="Status" value={statusFilter} options={["All", ...uniqueValues(rows.map((row) => row.status)), ...uniqueValues(rows.map((row) => row.ops.listingStatus))]} onChange={setStatusFilter} />
            <FilterSelect label="Category" value={categoryFilter} options={["All", ...uniqueValues(rows.map((row) => row.category))]} onChange={setCategoryFilter} />
            <FilterSelect label="Location" value={locationFilter} options={["All", ...uniqueValues(rows.map((row) => row.location || "Missing"))]} onChange={setLocationFilter} />
            <FilterSelect label="Listing Type" value={listingTypeFilter} options={["All", "BIN", "Auction", "None"]} onChange={setListingTypeFilter} />
            <FilterSelect label="Source" value={sourceFilter} options={["All", ...uniqueValues(rows.map((row) => row.source))]} onChange={setSourceFilter} />
            <FilterSelect label="Confidence" value={confidenceFilter} options={["All", "Low", "Medium", "High"]} onChange={setConfidenceFilter} />
            <FilterSelect label="Drift" value={driftFilter} options={["All", ...uniqueValues(rows.map((row) => row.ops.driftStatus))]} onChange={setDriftFilter} />
          </div>
        </SectionCard>

        {selectedIds.size > 0 && (
          <div className="sticky top-14 z-10 rounded-lg border border-acv-teal/35 bg-acv-panel2 p-3 shadow-glow">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="teal">{selectedIds.size} selected</StatusPill>
              {["Edit selected", "Update location", "Refresh comps", "Send to pricing", "Generate drafts", "Stage to eBay"].map((action) => (
                <MiniActionButton key={action}>{action}</MiniActionButton>
              ))}
              <MiniActionButton tone="pink">
                <Archive className="h-3.5 w-3.5" />
                Archive
              </MiniActionButton>
              <MiniActionButton tone="gold" onClick={() => setSelectedIds(new Set())}>
                <X className="h-3.5 w-3.5" />
                Clear selection
              </MiniActionButton>
            </div>
          </div>
        )}

        {saveMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-acv-teal/35 bg-acv-teal/10 px-4 py-3 text-sm font-semibold text-acv-teal">
            <CheckCircle2 className="h-4 w-4" />
            {saveMessage}
          </div>
        )}

        <SectionCard
          title={viewMode === "Listings" ? "Listings Inventory" : viewMode === "Drafts" ? "Draft Inventory" : viewMode === "Unlisted / Inactive" ? "Unlisted / Inactive Inventory" : "All Inventory"}
          eyebrow="Clean operational table"
          action={<StatusPill tone={viewMode === "Listings" ? "teal" : viewMode === "Drafts" ? "gold" : "purple"}>{viewMode}</StatusPill>}
        >
          <DataTable<Row>
            rows={filteredRows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => setSelectedRow(row)}
            columns={columns}
          />
        </SectionCard>

        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <SectionCard title="Source of Truth Rules" eyebrow="ACV-owned">
            <div className="space-y-2 text-xs">
              {["SKU", "Purchase cost", "Location", "Internal notes", "Workflow status", "AI confidence"].map((item) => (
                <div key={item} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <span className="truncate text-acv-muted">{item}</span>
                  <StatusPill tone="teal">ACV owns</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Operational Notes" eyebrow="Mock only">
            <div className="space-y-3 text-xs leading-5 text-acv-muted">
              <div className="flex items-start gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <Layers3 className="mt-0.5 h-4 w-4 text-acv-gold" />
                <span>Detailed card attributes live in the drawer so the tables stay clean.</span>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-acv-teal" />
                <span>Bulk actions and SKU pushes are staged mock controls only.</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {selectedRow && <ItemDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} onMockSave={mockSave} />}
    </>
  );
}
