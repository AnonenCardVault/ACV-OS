"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Check,
  CheckCircle2,
  Columns3,
  FileClock,
  FileText,
  ImagePlus,
  RefreshCcw,
  Save,
  Send,
  Tag,
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
type StagedUpdateRow = (typeof stagedListingUpdates)[number];
type DrawerMode = "generate" | "review" | "active";
type ListingDrawerItem = { kind: "draft"; row: DraftRow } | { kind: "active"; row: ActiveListing };
type DrawerTab = "Overview" | "Listing" | "Pricing" | "Photos" | "Description" | "Item Specifics" | "History";
type ListingView = "All Listings" | "BIN" | "Auctions";
type ActivePreset = "all" | "bin" | "auctions";
type Tone = "green" | "teal" | "gold" | "pink" | "purple" | "neutral";
type ListingType = "BIN" | "Auction";
type DraftColumnKey = "suggestedPrice" | "market" | "confidence" | "aiStatus" | "photoStatus" | "location" | "draftStatus" | "cost" | "category";
type ActiveColumnKey = "listingType" | "price" | "market" | "views" | "watchers" | "days" | "status" | "currentBid" | "bids" | "timeRemaining" | "quantity" | "location" | "drift";

type ActiveListing = ActiveListingRow & {
  listingType: ListingType;
  currentBid?: number;
  numberOfBids?: number;
  timeRemaining?: string;
};

const drawerTabs: DrawerTab[] = ["Overview", "Listing", "Pricing", "Photos", "Description", "Item Specifics", "History"];
const listingViews: ListingView[] = ["All Listings", "BIN", "Auctions"];

const draftDefaultColumns: DraftColumnKey[] = ["suggestedPrice", "market", "confidence", "aiStatus", "photoStatus", "location", "draftStatus"];
const draftColumnOptions: Array<{ key: DraftColumnKey; label: string }> = [
  { key: "suggestedPrice", label: "Suggested Price" },
  { key: "market", label: "Market" },
  { key: "confidence", label: "Confidence" },
  { key: "aiStatus", label: "AI Status" },
  { key: "photoStatus", label: "Photo Status" },
  { key: "location", label: "Location" },
  { key: "draftStatus", label: "Draft Status" },
  { key: "cost", label: "Cost" },
  { key: "category", label: "Category" }
];

const activeDefaultColumns: ActiveColumnKey[] = ["listingType", "price", "market", "views", "watchers", "days", "status"];
const auctionDefaultColumns: ActiveColumnKey[] = ["listingType", "currentBid", "bids", "timeRemaining", "market", "views", "watchers", "days", "status"];
const activeColumnOptions: Array<{ key: ActiveColumnKey; label: string; auctionOnly?: boolean }> = [
  { key: "listingType", label: "Listing Type" },
  { key: "price", label: "Price" },
  { key: "market", label: "Market" },
  { key: "views", label: "Views" },
  { key: "watchers", label: "Watchers" },
  { key: "days", label: "Days" },
  { key: "status", label: "Status" },
  { key: "currentBid", label: "Current Bid", auctionOnly: true },
  { key: "bids", label: "Number of Bids", auctionOnly: true },
  { key: "timeRemaining", label: "Time Remaining", auctionOnly: true },
  { key: "quantity", label: "Quantity" },
  { key: "location", label: "Location" },
  { key: "drift", label: "Drift" }
];

const activeListingMeta: Record<string, Pick<ActiveListing, "listingType" | "currentBid" | "numberOfBids" | "timeRemaining">> = {
  "ACV-NFL-000421": { listingType: "BIN" },
  "ACV-MLB-000301": { listingType: "Auction", currentBid: 42, numberOfBids: 6, timeRemaining: "2d 8h" },
  "ACV-POK-000208": { listingType: "BIN" },
  "ACV-NBA-000440": { listingType: "Auction", currentBid: 18.5, numberOfBids: 4, timeRemaining: "16h" },
  "ACV-TCG-000098": { listingType: "BIN" }
};

function pillTone(value: string): Tone {
  if (["Ready", "Generated", "Reviewed", "Active", "In sync", "Low", "BIN"].includes(value)) return "teal";
  if (["Needs Review", "Missing Back", "Review", "Review comps", "Paused", "Medium", "Auction"].includes(value)) return "gold";
  if (["Blocked", "Needs AI", "SKU drift", "Price drift", "Quantity drift", "High", "Delete"].includes(value)) return "pink";
  return "purple";
}

function confidenceLabel(value: number) {
  return formatPercent(value);
}

function aiStatus(row: DraftRow) {
  if (row.aiConfidence >= 0.9) return "High confidence";
  if (row.aiConfidence >= 0.75) return "Review";
  return "Needs AI";
}

function activePresetForView(view: ListingView): ActivePreset {
  if (view === "Auctions") return "auctions";
  if (view === "BIN") return "bin";
  return "all";
}

function activeRowsWithMeta(): ActiveListing[] {
  return activeListingRows.map((row) => ({ ...row, ...(activeListingMeta[row.sku] || { listingType: "BIN" as const }) }));
}

function stagedSku(update: StagedUpdateRow) {
  return update.item.split(" ")[0];
}

function stagedTitle(update: StagedUpdateRow) {
  return update.item.replace(`${stagedSku(update)} `, "");
}

function stagedConfidence(update: StagedUpdateRow) {
  if (update.riskLevel === "Low") return "94%";
  if (update.riskLevel === "Medium") return "82%";
  return "68%";
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
        large ? "h-72 w-full max-w-56" : "h-9 w-7"
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
  tone = "neutral",
  className
}: {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: "neutral" | "teal" | "gold" | "pink";
  className?: string;
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
              : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal",
        className
      )}
    >
      {children}
    </button>
  );
}

function ColumnToggleButton({
  label,
  checked,
  disabled,
  onClick
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 rounded-md border px-2 text-left text-[11px] font-semibold transition",
        checked ? "border-acv-teal/35 bg-acv-teal/10 text-acv-teal" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/40 hover:text-acv-teal",
        disabled && "cursor-not-allowed opacity-70"
      )}
    >
      <span className={cn("h-3 w-3 shrink-0 rounded-[3px] border", checked ? "border-acv-teal bg-acv-teal" : "border-acv-border bg-acv-panel2")} />
      <span className="truncate">{label}</span>
    </button>
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

function DetailField({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  const toneClass = tone === "green" ? "text-acv-green" : tone === "gold" ? "text-acv-gold" : tone === "pink" ? "text-acv-pink" : tone === "teal" ? "text-acv-teal" : "text-acv-text";
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</p>
      <p className={cn("mt-1 truncate text-xs font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

function ListingActionsDropdown({ onOpen }: { onOpen: (event: React.ChangeEvent<HTMLSelectElement>) => void }) {
  return (
    <select
      aria-label="Listing actions"
      defaultValue=""
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        onOpen(event);
        event.currentTarget.value = "";
      }}
      className="h-8 w-28 rounded-md border border-acv-border bg-acv-panel2 px-2 text-[11px] font-semibold text-acv-text outline-none transition hover:border-acv-teal/45"
    >
      <option value="">Actions</option>
      <option value="open">Open drawer</option>
      <option value="sku">Update SKU</option>
      <option value="price">Revise Price</option>
      <option value="comps">Review Comps</option>
      <option value="stage">Send to eBay</option>
      <option value="end">End Listing</option>
    </select>
  );
}

function DraftActionsDropdown({ onGenerate, onReview }: { onGenerate: () => void; onReview: () => void }) {
  return (
    <select
      aria-label="Draft actions"
      defaultValue=""
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        if (event.currentTarget.value === "generate") onGenerate();
        if (event.currentTarget.value === "review") onReview();
        event.currentTarget.value = "";
      }}
      className="h-8 w-32 rounded-md border border-acv-border bg-acv-panel2 px-2 text-[11px] font-semibold text-acv-text outline-none transition hover:border-acv-teal/45"
    >
      <option value="">Actions</option>
      <option value="generate">Generate Draft</option>
      <option value="review">Review Draft</option>
      <option value="approve">Approve Draft</option>
      <option value="stage">Stage to eBay</option>
    </select>
  );
}

function ListingDrawer({
  item,
  mode,
  tab,
  onTabChange,
  onClose
}: {
  item: ListingDrawerItem;
  mode: DrawerMode;
  tab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
}) {
  const isDraft = item.kind === "draft";
  const title = isDraft ? item.row.name : item.row.title;
  const category = item.row.category;
  const status = isDraft ? item.row.draftStatus : item.row.status;
  const sku = item.row.sku;
  const listingType = isDraft ? "Draft" : item.row.listingType;
  const price = isDraft ? item.row.suggestedPrice : item.row.listedPrice;
  const market = isDraft ? item.row.marketValue : item.row.marketPrice;

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm sm:left-56">
      <button type="button" aria-label="Close listing drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-5xl flex-col border-l border-acv-border bg-acv-black shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill tone={isDraft ? "gold" : "teal"}>{isDraft ? (mode === "generate" ? "Generate Draft" : "Draft Review") : "Active Listing"}</StatusPill>
              <StatusPill tone={pillTone(status)}>{status}</StatusPill>
              <StatusPill tone={pillTone(listingType)}>{listingType}</StatusPill>
            </div>
            <h2 className="truncate text-lg font-semibold text-acv-text">{title}</h2>
            <p className="mt-1 text-xs text-acv-muted">{sku}</p>
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

        <div className="border-b border-acv-border bg-acv-black px-5 py-2">
          <div className="acv-scrollbar contained-x-scroll flex gap-2 pb-1">
            {drawerTabs.map((drawerTab) => (
              <button
                key={drawerTab}
                type="button"
                onClick={() => onTabChange(drawerTab)}
                className={cn(
                  "h-8 shrink-0 rounded-md border px-3 text-[11px] font-semibold transition",
                  tab === drawerTab ? "border-acv-teal/45 bg-acv-teal/10 text-acv-teal" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
                )}
              >
                {drawerTab}
              </button>
            ))}
          </div>
        </div>

        <div className="acv-scrollbar flex-1 overflow-y-auto p-5">
          {tab === "Overview" && (
            <div className="grid min-w-0 gap-5 lg:grid-cols-[224px_1fr]">
              <div className="space-y-3">
                <CardImageTile label={title} category={category} large />
                <div className="grid grid-cols-3 gap-2">
                  {["Front", "Back", "Detail"].map((label) => (
                    <div key={label} className="rounded-md border border-acv-border bg-acv-panel2 px-2 py-2 text-center text-[11px] font-semibold text-acv-muted">
                      {label}
                    </div>
                  ))}
                </div>
              </div>
              <section className="min-w-0 rounded-lg border border-acv-border bg-acv-panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Listing Overview</p>
                  <StatusPill tone="teal">Mock workstation drawer</StatusPill>
                </div>
                <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <DetailField label="SKU" value={sku} tone="gold" />
                  <DetailField label="Title" value={title} />
                  <DetailField label="Category" value={category} />
                  <DetailField label="Listing Type" value={listingType} tone={listingType === "Auction" ? "gold" : "teal"} />
                  <DetailField label={listingType === "Auction" && !isDraft ? "Current Bid" : "Price"} value={formatCurrency(listingType === "Auction" && !isDraft ? item.row.currentBid || 0 : price)} tone="gold" />
                  <DetailField label="Market" value={formatCurrency(market)} tone="green" />
                  {!isDraft && <DetailField label="Watchers" value={item.row.watchers} tone="teal" />}
                  {!isDraft && <DetailField label="Views" value={item.row.views} />}
                  {!isDraft && item.row.listingType === "Auction" && <DetailField label="Number of Bids" value={item.row.numberOfBids ?? "-"} tone="teal" />}
                  {!isDraft && item.row.listingType === "Auction" && <DetailField label="Time Remaining" value={item.row.timeRemaining || "Mock pending"} tone="gold" />}
                  {isDraft && <DetailField label="AI Confidence" value={confidenceLabel(item.row.aiConfidence)} tone={item.row.aiConfidence >= 0.9 ? "teal" : "gold"} />}
                  {isDraft && <DetailField label="Photo Status" value={item.row.photoStatus} tone={pillTone(item.row.photoStatus)} />}
                </div>
              </section>
            </div>
          )}

          {tab === "Listing" && (
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Listing Controls</p>
              <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <DetailField label="Status" value={status} tone={pillTone(status)} />
                <DetailField label="Listing Type" value={listingType} tone={pillTone(listingType)} />
                <DetailField label="Quantity" value={isDraft ? 1 : item.row.quantity} />
                <DetailField label="Location" value={isDraft ? item.row.location : item.row.location} />
              </div>
            </section>
          )}

          {tab === "Pricing" && (
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Pricing</p>
              <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <DetailField label="Cost" value={isDraft ? formatCurrency(item.row.cost) : "Mock pending"} tone="pink" />
                <DetailField label="Price" value={formatCurrency(price)} tone="gold" />
                <DetailField label="Market" value={formatCurrency(market)} tone="green" />
                {!isDraft && <DetailField label="Active Low" value={formatCurrency(item.row.activeLow)} tone="pink" />}
                {!isDraft && <DetailField label="Sold Median" value={formatCurrency(item.row.soldMedian)} />}
              </div>
            </section>
          )}

          {tab === "Photos" && (
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Photos</p>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
                {["Front", "Back", "Closeup"].map((label) => (
                  <CardImageTile key={label} label={`${title} ${label}`} category={category} large />
                ))}
              </div>
            </section>
          )}

          {tab === "Description" && (
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Description</p>
              <p className="mt-3 rounded-md border border-acv-border bg-acv-panel2 p-3 text-sm leading-6 text-acv-text">
                {isDraft
                  ? item.row.suggestedDescription
                  : "Mock marketplace description surface. Future eBay sync will compare ACV copy against the live listing before staging revisions."}
              </p>
            </section>
          )}

          {tab === "Item Specifics" && (
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Item Specifics</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {isDraft
                  ? item.row.specifics.map((specific) => (
                      <div key={specific.label} className="flex items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs">
                        <span className="text-acv-muted">{specific.label}</span>
                        <span className="flex items-center gap-2 text-right font-semibold text-acv-text">
                          {specific.value}
                          {specific.complete ? <CheckCircle2 className="h-4 w-4 text-acv-green" /> : <AlertTriangle className="h-4 w-4 text-acv-gold" />}
                        </span>
                      </div>
                    ))
                  : ["Platform: eBay", `Category: ${category}`, `Location: ${item.row.location}`, `Drift: ${item.row.driftStatus}`].map((specific) => (
                      <div key={specific} className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs font-semibold text-acv-text">
                        {specific}
                      </div>
                    ))}
              </div>
            </section>
          )}

          {tab === "History" && (
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">History</p>
              <div className="mt-3 space-y-2">
                {["Inventory record created", isDraft ? "Draft staged" : "Listing active", "Mock sync pending"].map((entry) => (
                  <div key={entry} className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs text-acv-muted">
                    {entry}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function ListingsPage() {
  const [drawerItem, setDrawerItem] = useState<ListingDrawerItem | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("review");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("Overview");
  const [listingView, setListingView] = useState<ListingView>("All Listings");
  const [showDraftColumns, setShowDraftColumns] = useState(false);
  const [showActiveColumns, setShowActiveColumns] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<DraftColumnKey[]>(draftDefaultColumns);
  const [activeVisibleColumns, setActiveVisibleColumns] = useState<Record<ActivePreset, ActiveColumnKey[]>>({
    all: activeDefaultColumns,
    bin: activeDefaultColumns,
    auctions: auctionDefaultColumns
  });

  const activeRows = useMemo(activeRowsWithMeta, []);
  const activePreset = activePresetForView(listingView);
  const currentActiveColumns = activeVisibleColumns[activePreset];
  const visibleActiveRows = activeRows.filter((row) => listingView === "All Listings" || row.listingType === (listingView === "BIN" ? "BIN" : "Auction"));
  const selectedVisibleIds = [
    ...listingDraftQueue.map((row) => `draft:${row.sku}`),
    ...visibleActiveRows.map((row) => `active:${row.sku}`),
    ...stagedListingUpdates.map((row) => `update:${row.id}`)
  ].filter((id) => selectedIds.has(id));

  useEffect(() => {
    try {
      const draftStored = window.localStorage.getItem("acv.listings.columns.draft");
      const activeStored = window.localStorage.getItem("acv.listings.columns.active");
      if (draftStored) {
        const parsed = JSON.parse(draftStored) as DraftColumnKey[];
        if (Array.isArray(parsed)) setDraftVisibleColumns(parsed.filter((key) => draftColumnOptions.some((column) => column.key === key)));
      }
      if (activeStored) {
        const parsed = JSON.parse(activeStored) as Record<ActivePreset, ActiveColumnKey[]>;
        setActiveVisibleColumns((current) => ({
          all: Array.isArray(parsed.all) ? parsed.all.filter((key) => activeColumnOptions.some((column) => column.key === key && !column.auctionOnly)) : current.all,
          bin: Array.isArray(parsed.bin) ? parsed.bin.filter((key) => activeColumnOptions.some((column) => column.key === key && !column.auctionOnly)) : current.bin,
          auctions: Array.isArray(parsed.auctions) ? parsed.auctions.filter((key) => activeColumnOptions.some((column) => column.key === key && key !== "price")) : current.auctions
        }));
      }
    } catch {
      window.localStorage.removeItem("acv.listings.columns.draft");
      window.localStorage.removeItem("acv.listings.columns.active");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("acv.listings.columns.draft", JSON.stringify(draftVisibleColumns));
  }, [draftVisibleColumns]);

  useEffect(() => {
    window.localStorage.setItem("acv.listings.columns.active", JSON.stringify(activeVisibleColumns));
  }, [activeVisibleColumns]);

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleDraftColumn(key: DraftColumnKey) {
    setDraftVisibleColumns((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function toggleActiveColumn(key: ActiveColumnKey) {
    setActiveVisibleColumns((current) => {
      const existing = current[activePreset];
      return {
        ...current,
        [activePreset]: existing.includes(key) ? existing.filter((item) => item !== key) : [...existing, key]
      };
    });
  }

  function openDraft(row: DraftRow, mode: DrawerMode) {
    setDrawerItem({ kind: "draft", row });
    setDrawerMode(mode);
    setDrawerTab("Overview");
  }

  function openActive(row: ActiveListing) {
    setDrawerItem({ kind: "active", row });
    setDrawerMode("active");
    setDrawerTab("Overview");
  }

  const draftColumnDefinitions: Record<DraftColumnKey, { header: string; className?: string; cell: (row: DraftRow) => React.ReactNode }> = {
    suggestedPrice: { header: "Suggested Price", cell: (row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.suggestedPrice)}</span> },
    market: { header: "Market", cell: (row) => <span className="font-semibold text-acv-green">{formatCurrency(row.marketValue)}</span> },
    confidence: { header: "Confidence", cell: (row) => <span className={row.aiConfidence >= 0.9 ? "font-semibold text-acv-teal" : row.aiConfidence >= 0.75 ? "font-semibold text-acv-gold" : "font-semibold text-acv-pink"}>{confidenceLabel(row.aiConfidence)}</span> },
    aiStatus: { header: "AI Status", cell: (row) => <StatusPill tone={pillTone(aiStatus(row))}>{aiStatus(row)}</StatusPill> },
    photoStatus: { header: "Photo Status", cell: (row) => <StatusPill tone={pillTone(row.photoStatus)}>{row.photoStatus}</StatusPill> },
    location: { header: "Location", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{row.location}</span> },
    draftStatus: { header: "Draft Status", cell: (row) => <StatusPill tone={pillTone(row.draftStatus)}>{row.draftStatus}</StatusPill> },
    cost: { header: "Cost", cell: (row) => <span className="font-semibold text-acv-pink">{formatCurrency(row.cost)}</span> },
    category: { header: "Category", cell: (row) => <StatusPill tone="purple">{row.category}</StatusPill> }
  };

  const activeColumnDefinitions: Record<ActiveColumnKey, { header: string; className?: string; cell: (row: ActiveListing) => React.ReactNode }> = {
    listingType: { header: "Listing Type", cell: (row) => <StatusPill tone={pillTone(row.listingType)}>{row.listingType}</StatusPill> },
    price: { header: "Price", cell: (row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.listedPrice)}</span> },
    market: { header: "Market", cell: (row) => <span className="font-semibold text-acv-green">{formatCurrency(row.marketPrice)}</span> },
    views: { header: "Views", cell: (row) => <span className="font-semibold text-acv-text">{row.views}</span> },
    watchers: { header: "Watchers", cell: (row) => <span className="font-semibold text-acv-teal">{row.watchers}</span> },
    days: { header: "Days", cell: (row) => <span className="font-semibold text-acv-text">{row.daysListed}d</span> },
    status: { header: "Status", cell: (row) => <StatusPill tone={pillTone(row.status)}>{row.status}</StatusPill> },
    currentBid: { header: "Current Bid", cell: (row) => <span className="font-semibold text-acv-green">{row.currentBid ? formatCurrency(row.currentBid) : "-"}</span> },
    bids: { header: "Number of Bids", cell: (row) => <span className="font-semibold text-acv-text">{row.numberOfBids ?? "-"}</span> },
    timeRemaining: { header: "Time Remaining", cell: (row) => <span className="whitespace-nowrap font-semibold text-acv-gold">{row.timeRemaining || "-"}</span> },
    quantity: { header: "Qty", className: "text-center", cell: (row) => <span className="font-semibold text-acv-text">{row.quantity}</span> },
    location: { header: "Location", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{row.location}</span> },
    drift: { header: "Drift", cell: (row) => <StatusPill tone={pillTone(row.driftStatus)}>{row.driftStatus}</StatusPill> }
  };

  const draftColumns = [
    {
      key: "select",
      header: <SelectCheckbox checked={listingDraftQueue.every((row) => selectedIds.has(`draft:${row.sku}`))} label="Select all drafts" onChange={(checked) => listingDraftQueue.forEach((row) => toggleSelection(`draft:${row.sku}`, checked))} />,
      className: "sticky left-0 z-30 w-8 min-w-8 bg-acv-panel2 px-2",
      cell: (row: DraftRow) => <SelectCheckbox checked={selectedIds.has(`draft:${row.sku}`)} label={`Select ${row.sku}`} onChange={(checked) => toggleSelection(`draft:${row.sku}`, checked)} />
    },
    { key: "image", header: "Image", className: "sticky left-8 z-30 w-12 min-w-12 bg-acv-panel2 px-1.5", cell: (row: DraftRow) => <CardImageTile label={row.name} category={row.category} /> },
    { key: "sku", header: "SKU", className: "sticky left-20 z-30 w-32 min-w-32 bg-acv-panel2", cell: (row: DraftRow) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
    { key: "title", header: "Title", className: "sticky left-52 z-30 w-44 min-w-44 bg-acv-panel2 md:w-64 md:min-w-64", cell: (row: DraftRow) => <span className="line-clamp-1 font-semibold text-acv-text">{row.name}</span> },
    ...draftVisibleColumns.map((key) => ({ key, header: draftColumnDefinitions[key].header, className: draftColumnDefinitions[key].className, cell: draftColumnDefinitions[key].cell })),
    {
      key: "actions",
      header: "Actions",
      className: "sticky right-0 z-30 w-36 min-w-36 bg-acv-panel2 text-right",
      cell: (row: DraftRow) => (
        <DraftActionsDropdown onGenerate={() => openDraft(row, "generate")} onReview={() => openDraft(row, "review")} />
      )
    }
  ];

  const activeColumns = [
    {
      key: "select",
      header: <SelectCheckbox checked={visibleActiveRows.length > 0 && visibleActiveRows.every((row) => selectedIds.has(`active:${row.sku}`))} label="Select all active listings" onChange={(checked) => visibleActiveRows.forEach((row) => toggleSelection(`active:${row.sku}`, checked))} />,
      className: "sticky left-0 z-30 w-8 min-w-8 bg-acv-panel2 px-2",
      cell: (row: ActiveListing) => <SelectCheckbox checked={selectedIds.has(`active:${row.sku}`)} label={`Select ${row.sku}`} onChange={(checked) => toggleSelection(`active:${row.sku}`, checked)} />
    },
    { key: "image", header: "Image", className: "sticky left-8 z-30 w-12 min-w-12 bg-acv-panel2 px-1.5", cell: (row: ActiveListing) => <CardImageTile label={row.title} category={row.category} /> },
    { key: "sku", header: "SKU", className: "sticky left-20 z-30 w-32 min-w-32 bg-acv-panel2", cell: (row: ActiveListing) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
    { key: "title", header: "Title", className: "sticky left-52 z-30 w-44 min-w-44 bg-acv-panel2 md:w-64 md:min-w-64", cell: (row: ActiveListing) => <span className="line-clamp-1 font-semibold text-acv-text">{row.title}</span> },
    ...currentActiveColumns.map((key) => ({ key, header: activeColumnDefinitions[key].header, className: activeColumnDefinitions[key].className, cell: activeColumnDefinitions[key].cell })),
    {
      key: "actions",
      header: "Actions",
      className: "sticky right-0 z-30 w-36 min-w-36 bg-acv-panel2 text-right",
      cell: (row: ActiveListing) => (
        <ListingActionsDropdown
          onOpen={(event) => {
            event.stopPropagation();
            openActive(row);
          }}
        />
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Listings Workstation"
        description="Marketplace-focused sibling to Inventory for drafts, active listings, staged revisions, SKU updates, and future eBay sync."
        status="eBay mock"
        action={<ActionButton icon={<Send className="h-4 w-4" />}>Stage mock update</ActionButton>}
      />

      <div className="min-w-0 space-y-3 p-3 sm:p-4">
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-2">
          {[
            ["Ready Drafts", String(listingDraftQueue.filter((row) => row.draftStatus === "Ready").length), "teal"],
            ["Active Listings", String(activeRows.length), "gold"],
            ["Auctions", String(activeRows.filter((row) => row.listingType === "Auction").length), "teal"],
            ["Drift Alerts", String(activeRows.filter((row) => row.driftStatus !== "In sync").length), "pink"],
            ["Staged Updates", String(stagedListingUpdates.length), "purple"]
          ].map(([label, value, tone]) => (
            <div key={label} className="min-w-0 rounded-md border border-acv-border bg-acv-panel px-2.5 py-2">
              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</p>
              <p className={cn("mt-0.5 truncate text-sm font-bold", tone === "teal" ? "text-acv-teal" : tone === "gold" ? "text-acv-gold" : tone === "pink" ? "text-acv-pink" : "text-acv-purple")}>{value}</p>
            </div>
          ))}
        </div>

        <SectionCard
          title="Draft Builder Queue"
          eyebrow="Frozen identity columns"
          action={
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDraftColumns((current) => !current)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition",
                  showDraftColumns ? "border-acv-gold/45 bg-acv-gold/10 text-acv-gold" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-gold/45 hover:text-acv-gold"
                )}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
            </div>
          }
        >
          {showDraftColumns && (
            <div className="mb-3 rounded-md border border-acv-border bg-black/25 p-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Draft Columns</p>
                <span className="text-[11px] text-acv-muted">Checkbox, Image, SKU, Title, and Actions stay frozen</span>
              </div>
              <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
                {["Checkbox", "Image", "SKU", "Title", "Actions"].map((label) => (
                  <ColumnToggleButton key={label} label={label} checked disabled />
                ))}
                {draftColumnOptions.map(({ key, label }) => (
                  <ColumnToggleButton key={key} label={label} checked={draftVisibleColumns.includes(key)} onClick={() => toggleDraftColumn(key)} />
                ))}
              </div>
            </div>
          )}
          <DataTable<DraftRow> rows={listingDraftQueue} getRowKey={(row) => row.sku} onRowClick={(row) => openDraft(row, "review")} columns={draftColumns} />
        </SectionCard>

        <SectionCard
          title="Active Listings Monitor"
          eyebrow="Marketplace state"
          className="border-acv-teal/30"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="pink">API offline</StatusPill>
              <ActionButton variant="ghost" icon={<RefreshCcw className="h-4 w-4" />}>
                Mock sync
              </ActionButton>
            </div>
          }
        >
          <div className="mb-3 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap gap-2">
                {listingViews.map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => {
                      setListingView(view);
                      setSelectedIds(new Set());
                    }}
                    className={cn(
                      "h-8 whitespace-nowrap rounded-md border px-3 text-[11px] font-semibold transition",
                      listingView === view ? "border-acv-teal/45 bg-acv-teal/10 text-acv-teal" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowActiveColumns((current) => !current)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition",
                  showActiveColumns ? "border-acv-gold/45 bg-acv-gold/10 text-acv-gold" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-gold/45 hover:text-acv-gold"
                )}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
            </div>

            {showActiveColumns && (
              <div className="rounded-md border border-acv-border bg-black/25 p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Active Listing Columns</p>
                  <span className="text-[11px] text-acv-muted">{listingView === "Auctions" ? "Auction preset loaded" : "Auction-only columns hidden for BIN views"}</span>
                </div>
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
                  {["Checkbox", "Image", "SKU", "Title", "Actions"].map((label) => (
                    <ColumnToggleButton key={label} label={label} checked disabled />
                  ))}
                  {activeColumnOptions
                    .filter((option) => (listingView === "Auctions" ? option.key !== "price" : !option.auctionOnly))
                    .map(({ key, label }) => (
                      <ColumnToggleButton key={key} label={label} checked={currentActiveColumns.includes(key)} onClick={() => toggleActiveColumn(key)} />
                    ))}
                </div>
              </div>
            )}
          </div>

          <DataTable<ActiveListing> rows={visibleActiveRows} getRowKey={(row) => row.sku} onRowClick={openActive} columns={activeColumns} />
        </SectionCard>

        <SectionCard title="Awaiting Approval" eyebrow="Staged eBay updates">
          <DataTable<StagedUpdateRow>
            rows={stagedListingUpdates}
            getRowKey={(row) => row.id}
            columns={[
              {
                key: "select",
                header: <SelectCheckbox checked={stagedListingUpdates.every((row) => selectedIds.has(`update:${row.id}`))} label="Select all staged updates" onChange={(checked) => stagedListingUpdates.forEach((row) => toggleSelection(`update:${row.id}`, checked))} />,
                className: "w-8 min-w-8 px-2",
                cell: (row) => <SelectCheckbox checked={selectedIds.has(`update:${row.id}`)} label={`Select ${row.id}`} onChange={(checked) => toggleSelection(`update:${row.id}`, checked)} />
              },
              { key: "sku", header: "SKU", cell: (row) => <span className="font-semibold text-acv-gold">{stagedSku(row)}</span> },
              { key: "title", header: "Title", className: "min-w-56", cell: (row) => <span className="font-semibold text-acv-text">{stagedTitle(row)}</span> },
              { key: "type", header: "Update Type", cell: (row) => <StatusPill tone="purple">{row.changeType}</StatusPill> },
              { key: "current", header: "Current Value", cell: (row) => <span className="font-semibold text-acv-pink">{row.currentEbayValue}</span> },
              { key: "proposed", header: "Proposed Value", cell: (row) => <span className="font-semibold text-acv-teal">{row.acvValue}</span> },
              { key: "risk", header: "Risk", cell: (row) => <StatusPill tone={pillTone(row.riskLevel)}>{row.riskLevel}</StatusPill> },
              { key: "confidence", header: "Confidence", cell: (row) => <span className="font-semibold text-acv-text">{stagedConfidence(row)}</span> },
              {
                key: "approve",
                header: "Approve",
                cell: () => (
                  <MiniActionButton tone="teal">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </MiniActionButton>
                )
              },
              {
                key: "reject",
                header: "Reject",
                cell: () => (
                  <MiniActionButton tone="pink">
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </MiniActionButton>
                )
              }
            ]}
          />
        </SectionCard>

        <SectionCard title="Today's Workload" eyebrow="Daily listing commands">
          <div className="grid min-w-0 gap-2 text-xs md:grid-cols-4">
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
      </div>

      {selectedVisibleIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 rounded-lg border border-acv-teal/35 bg-acv-black/95 p-3 shadow-glow sm:left-60">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="teal">{selectedVisibleIds.length} selected</StatusPill>
            {["Generate Draft", "Approve Draft", "Bulk Edit", "Revise Price", "Update SKU", "Send to eBay", "End Listings"].map((action) => (
              <MiniActionButton key={action}>{action}</MiniActionButton>
            ))}
            <MiniActionButton tone="pink">
              <Archive className="h-3.5 w-3.5" />
              Delete
            </MiniActionButton>
            <MiniActionButton tone="gold" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" />
              Clear
            </MiniActionButton>
          </div>
        </div>
      )}

      {drawerItem && <ListingDrawer item={drawerItem} mode={drawerMode} tab={drawerTab} onTabChange={setDrawerTab} onClose={() => setDrawerItem(null)} />}
    </>
  );
}
