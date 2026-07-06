"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Columns3,
  FileClock,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Tag,
  Upload,
  X
} from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { StatusPill } from "@/components/status-pill";
import { inventoryItems } from "@/data/mock";
import { useAcvLocalState, type ApprovedInventoryItem, type IntakeImage, type ProposedRecord } from "@/lib/acv-local-state";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type InventoryItem = (typeof inventoryItems)[number];
type ViewMode = "Listings" | "Drafts" | "Unlisted / Inactive" | "All Inventory";
type ListingSubTab = "All Listings" | "BIN" | "Auctions";
type ConfidenceBand = "Low" | "Medium" | "High";
type DataColumnKey =
  | "qty"
  | "cost"
  | "listedPrice"
  | "currentBid"
  | "marketValue"
  | "views"
  | "watchers"
  | "bids"
  | "daysListed"
  | "status"
  | "lot"
  | "soldMedian"
  | "activeLow"
  | "listingType"
  | "platform"
  | "source"
  | "confidence"
  | "drift"
  | "lastCompUpdate"
  | "lastPriceChange"
  | "promotionPct"
  | "offers"
  | "shippingMethod";
type Row = InventoryItem & {
  ops: InventoryOps;
  localImages?: IntakeImage[];
  localPrimaryImageUrl?: string;
  localNeedsImageReupload?: boolean;
  localBatch?: string;
  localGroup?: string;
  localProposed?: ProposedRecord;
};

type InventoryOps = {
  playerCharacter: string;
  team: string;
  autoRelicFlags: string;
  conditionNotes: string;
  lotName?: string;
  listingType: "BIN" | "Auction" | "None";
  listingStatus: string;
  platform?: string;
  views: number;
  watchers: number;
  soldMedian: number;
  activeLow: number;
  currentBid?: number;
  bids?: number;
  auctionEndDate?: string;
  lastCompUpdate?: string;
  lastPriceChange?: string;
  promotionPct?: number;
  offers?: number;
  shippingMethod?: string;
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
const defaultVisibleDataColumns: DataColumnKey[] = ["qty", "cost", "listedPrice", "marketValue", "views", "watchers", "daysListed", "status"];
const auctionVisibleDataColumns: DataColumnKey[] = ["qty", "cost", "listedPrice", "currentBid", "marketValue", "views", "watchers", "bids", "daysListed", "status"];

const optionalDataColumns: Array<{ key: DataColumnKey; label: string }> = [
  { key: "lot", label: "Lot" },
  { key: "currentBid", label: "Current bid" },
  { key: "bids", label: "Bids" },
  { key: "soldMedian", label: "Sold median comp" },
  { key: "activeLow", label: "Active low" },
  { key: "listingType", label: "Listing type" },
  { key: "platform", label: "Platform" },
  { key: "source", label: "Source" },
  { key: "confidence", label: "Confidence" },
  { key: "drift", label: "Drift" },
  { key: "lastCompUpdate", label: "Last comp update" },
  { key: "lastPriceChange", label: "Last price change" },
  { key: "promotionPct", label: "Promotion %" },
  { key: "offers", label: "Offers" },
  { key: "shippingMethod", label: "Shipping method" }
];

const opsBySku: Record<string, InventoryOps> = {
  "ACV-NFL-000421": {
    playerCharacter: "CJ Stroud",
    team: "Houston Texans",
    autoRelicFlags: "No auto / no relic",
    conditionNotes: "Clean front, minor edge review complete.",
    platform: "eBay",
    listingType: "BIN",
    listingStatus: "Active",
    views: 214,
    watchers: 18,
    soldMedian: 122.5,
    activeLow: 109.99,
    lastCompUpdate: "Jul 05",
    lastPriceChange: "Jul 03",
    promotionPct: 2,
    offers: 3,
    shippingMethod: "Standard envelope",
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
    lotName: "LOT-EBAY-US1-2018",
    platform: "eBay",
    listingType: "Auction",
    listingStatus: "Active",
    views: 88,
    watchers: 9,
    soldMedian: 67.25,
    activeLow: 59.99,
    currentBid: 42,
    bids: 6,
    auctionEndDate: "Jul 12, 8:30 PM",
    lastCompUpdate: "Jul 04",
    lastPriceChange: "Jun 29",
    promotionPct: 0,
    offers: 1,
    shippingMethod: "BMWT",
    driftStatus: "Price drift",
    draftSource: "None",
    titleStatus: "Approved",
    descriptionStatus: "Approved",
    photoStatus: "Reviewed",
    priceStatus: "Review",
    suggestedPrice: 19.99,
    nextAction: "Monitor auction",
    compSummary: "Auction started at $19.99 and is currently bid to $42.00 with 6 bids.",
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
    platform: "eBay",
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
    platform: "eBay",
    listingType: "BIN",
    listingStatus: "Paused",
    views: 301,
    watchers: 27,
    soldMedian: 179.5,
    activeLow: 169,
    lastCompUpdate: "Jul 03",
    lastPriceChange: "Jul 01",
    promotionPct: 4,
    offers: 6,
    shippingMethod: "BMWT",
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

function approvedItemToRow(item: ApprovedInventoryItem): Row {
  const purchaseCost = Number(item.proposed.purchaseCost) || 0;
  const quantity = Math.max(1, Number(item.proposed.quantity) || 1);
  const source = item.proposed.acquisitionSource || "Photo Intake";
  const location = item.proposed.location || "Photo Intake";
  const internalNotes = item.proposed.internalNotes?.trim();
  const inventoryItem: InventoryItem = {
    id: `local-${item.sku}`,
    sku: item.sku,
    name: item.proposed.cardName || "Untitled intake item",
    category: item.proposed.category || "Other",
    year: item.proposed.year || "-",
    brandSet: `${item.proposed.brand} ${item.proposed.set}`.trim() || "Pending",
    parallel: item.proposed.parallel || "-",
    cardNumber: item.proposed.cardNumber || "-",
    serialNumber: item.proposed.serialNumber || "-",
    status: "Needs Pricing",
    location,
    purchaseCost,
    askingPrice: 0,
    marketValue: 0,
    quantity,
    source,
    ebayId: "-",
    daysListed: 0,
    aiConfidence: 0.72,
    lastUpdated: item.approvedAt,
    notes:
      internalNotes ||
      (item.needsImageReupload
        ? "Approved locally from Photo Intake. Images need to be re-uploaded after refresh."
        : "Approved locally from Photo Intake. Mock item awaiting pricing.")
  };
  const baseRow = rowWithOps(inventoryItem);

  return {
    ...baseRow,
    localImages: item.images,
    localPrimaryImageUrl: item.primaryImageUrl,
    localNeedsImageReupload: item.needsImageReupload,
    localBatch: item.batch,
    localGroup: item.group,
    localProposed: item.proposed,
    ops: {
      ...baseRow.ops,
      playerCharacter: item.proposed.playerCharacter,
      team: item.proposed.team,
      autoRelicFlags: `${item.proposed.autoFlag ? "Auto" : "No auto"} / ${item.proposed.relicFlag ? "Relic" : "No relic"}`,
      conditionNotes: item.proposed.conditionNotes,
      listingStatus: "Internal",
      photoStatus: item.needsImageReupload ? "Needs Reupload" : "Reviewed",
      priceStatus: "Needs Comps",
      nextAction: "Send to pricing",
      compSummary: "Approved locally from Photo Intake. Market placeholder remains $0 until pricing comps run.",
      skuHistory: [`Assigned ${item.sku} from Photo Intake local approval`, `Batch ${item.batch} / Group ${item.group}`],
      lifecycleTimeline: ["Uploaded in Photo Intake", "Approved locally", "Needs pricing"],
      auditHistory: [`Mock approval ${item.approvedAt}`, "No database write yet"]
    }
  };
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

function CardImageTile({
  label,
  category,
  large = false,
  imageUrl,
  needsReupload
}: {
  label: string;
  category: string;
  large?: boolean;
  imageUrl?: string;
  needsReupload?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col justify-between overflow-hidden rounded border border-acv-border bg-gradient-to-br from-acv-purple/35 via-acv-panel2 to-acv-gold/20",
        large ? "h-72 w-full max-w-56 p-2" : "h-9 w-7 p-1",
        imageUrl && "bg-acv-panel2"
      )}
    >
      {imageUrl && <img src={imageUrl} alt={label} className="absolute inset-0 h-full w-full object-cover" />}
      <span className={cn("relative z-10 font-bold uppercase text-acv-gold drop-shadow", large ? "text-xs" : "text-[8px]")}>{category.slice(0, 3)}</span>
      <span className={cn("relative z-10 font-semibold leading-tight text-acv-text drop-shadow", large ? "text-sm" : "text-[7px]")}>{large ? label : "ACV"}</span>
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-acv-teal shadow-[0_0_14px_#26d4c7]" />
      {needsReupload && (
        <span className="absolute inset-x-1 bottom-1 rounded border border-acv-pink/40 bg-black/75 px-1 text-center text-[8px] font-semibold uppercase tracking-[0.08em] text-acv-pink">
          Re-upload
        </span>
      )}
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

function ToolbarSelect({
  label,
  value,
  options,
  onChange,
  className
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn("min-w-0", className)}>
      <div className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border border-acv-border bg-acv-panel2 px-2 transition hover:border-acv-teal/45">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-acv-muted">{label}:</span>
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-acv-text outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function CompactMetric({ label, value, tone }: { label: string; value: string; tone: "green" | "teal" | "gold" | "pink" | "neutral" }) {
  const toneClass = tone === "green" ? "text-acv-green" : tone === "teal" ? "text-acv-teal" : tone === "gold" ? "text-acv-gold" : tone === "pink" ? "text-acv-pink" : "text-acv-text";
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel px-2.5 py-2">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-bold", toneClass)}>{value}</p>
    </div>
  );
}

function TableControlButton({
  children,
  active,
  tone = "teal",
  onClick
}: {
  children: React.ReactNode;
  active?: boolean;
  tone?: "teal" | "gold" | "purple";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 whitespace-nowrap rounded-md border px-3 text-[11px] font-semibold transition",
        active && tone === "gold"
          ? "border-acv-gold/45 bg-acv-gold/10 text-acv-gold"
          : active
            ? "border-acv-teal/45 bg-acv-teal/10 text-acv-teal"
            : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
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
              <CardImageTile label={row.name} category={row.category} large imageUrl={row.localPrimaryImageUrl} needsReupload={row.localNeedsImageReupload} />
              <div className="grid grid-cols-3 gap-2">
                {row.localImages?.length
                  ? row.localImages.slice(0, 6).map((image) => (
                      <div key={image.id} className="overflow-hidden rounded-md border border-acv-border bg-acv-panel2">
                        {image.url || image.dataUrl ? (
                          <img src={image.url || image.dataUrl} alt={image.label} className="h-16 w-full object-cover" />
                        ) : (
                          <div className="flex h-16 items-center justify-center px-2 text-center text-[10px] font-semibold text-acv-muted">
                            {image.needsReupload ? "Re-upload" : image.role}
                          </div>
                        )}
                        <div className="truncate border-t border-acv-border px-2 py-1 text-center text-[10px] font-semibold text-acv-muted">{image.role}</div>
                      </div>
                    ))
                  : ["Front", "Back", "Crop"].map((label) => (
                      <div key={label} className="rounded-md border border-acv-border bg-acv-panel2 px-2 py-2 text-center text-[11px] font-semibold text-acv-muted">
                        {label}
                      </div>
                    ))}
              </div>
              {row.localNeedsImageReupload && (
                <div className="rounded-md border border-acv-pink/35 bg-acv-pink/10 px-3 py-2 text-xs font-semibold text-acv-pink">
                  Images need to be re-uploaded after refresh.
                </div>
              )}
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
                  {row.localProposed && <DetailField label="Grader" value={row.localProposed.grader || "Raw"} />}
                  {row.localProposed && <DetailField label="Grade" value={row.localProposed.grade || "Raw"} />}
                  <DetailField label="Auto / Relic" value={row.ops.autoRelicFlags} />
                  <DetailField label="Status" value={row.status} tone={statusTone(row.status) === "pink" ? "pink" : "teal"} />
                  <DetailField label="Location" value={row.location || "Missing"} tone={row.location ? undefined : "pink"} />
                  <DetailField label="Lot" value={lotLabel(row)} />
                  <DetailField label="Purchase Cost" value={row.purchaseCost ? formatCurrency(row.purchaseCost) : "Missing"} tone={row.purchaseCost ? "pink" : "pink"} />
                  <DetailField label={row.ops.listingType === "Auction" ? "Listed / Start Price" : "Ask / Listed"} value={row.askingPrice ? formatCurrency(row.askingPrice) : "—"} tone="gold" />
                  {row.ops.listingType === "Auction" && (
                    <>
                      <DetailField label="Current Bid" value={currentBidLabel(row)} tone="green" />
                      <DetailField label="Bids" value={bidsLabel(row)} tone="teal" />
                      <DetailField label="Auction End" value={auctionEndLabel(row)} tone="gold" />
                    </>
                  )}
                  <DetailField label="Market Value" value={formatCurrency(row.marketValue)} tone="green" />
                  <DetailField label="Quantity" value={row.quantity} />
                  <DetailField label="Source" value={row.source} />
                  {row.localBatch && <DetailField label="Intake Batch" value={row.localBatch} tone="gold" />}
                  {row.localGroup && <DetailField label="Intake Group" value={row.localGroup} tone="gold" />}
                  <DetailField label="AI Confidence" value={formatPercent(row.aiConfidence)} tone={confidenceBand(row.aiConfidence) === "Low" ? "pink" : confidenceBand(row.aiConfidence) === "Medium" ? "gold" : "teal"} />
                  <DetailField label="Listing Type" value={row.ops.listingType} tone={row.ops.listingType === "None" ? undefined : "gold"} />
                  <DetailField label="eBay Item ID" value={row.ebayId} />
                  <DetailField label="Sold Median Comp" value={formatCurrency(row.ops.soldMedian)} />
                  <DetailField label="Active Low" value={formatCurrency(row.ops.activeLow)} tone="pink" />
                  <DetailField label="Views" value={row.ops.views} />
                  <DetailField label="Watchers" value={row.ops.watchers} tone="teal" />
                  <DetailField label="Days Listed" value={row.daysListed ? `${row.daysListed} days` : "Not listed"} />
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
    <select
      aria-label={`Actions for ${row.sku}`}
      defaultValue=""
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        if (event.target.value === "details") onOpen(row);
        event.currentTarget.value = "";
      }}
      className="h-8 w-28 rounded-md border border-acv-border bg-acv-panel2 px-2 text-[11px] font-semibold text-acv-text outline-none transition hover:border-acv-teal/45"
    >
      <option value="">Actions</option>
      <option value="details">Open details</option>
      <option value="price">Edit price</option>
      <option value="location">Update location</option>
      <option value="comps">Refresh comps</option>
      <option value="stage">Stage to eBay</option>
      <option value="archive">Archive</option>
    </select>
  );
}

function lotLabel(row: Row) {
  return row.ops.lotName || "—";
}

function platformLabel(row: Row) {
  return row.ops.platform || (row.status === "Listed" || row.status === "Sold" ? "eBay" : "ACV");
}

function lastCompUpdate(row: Row) {
  return row.ops.lastCompUpdate || "Mock pending";
}

function lastPriceChange(row: Row) {
  return row.ops.lastPriceChange || "No change";
}

function promotionPct(row: Row) {
  return row.ops.promotionPct ?? 0;
}

function offersCount(row: Row) {
  return row.ops.offers ?? 0;
}

function shippingMethod(row: Row) {
  return row.ops.shippingMethod || (row.status === "Listed" ? "Standard envelope" : "Not set");
}

function currentBidLabel(row: Row) {
  return row.ops.listingType === "Auction" && typeof row.ops.currentBid === "number" ? formatCurrency(row.ops.currentBid) : "—";
}

function bidsLabel(row: Row) {
  return row.ops.listingType === "Auction" && typeof row.ops.bids === "number" ? row.ops.bids : "—";
}

function auctionEndLabel(row: Row) {
  return row.ops.listingType === "Auction" ? row.ops.auctionEndDate || "Not scheduled" : "—";
}

function needsReview(row: Row) {
  return row.status === "Needs Review" || row.aiConfidence < 0.75 || row.ops.driftStatus === "Needs review" || row.ops.driftStatus.includes("drift");
}

function marketRangeMatches(row: Row, filter: string) {
  if (filter === "All") return true;
  if (filter === "Under $50") return row.marketValue < 50;
  if (filter === "$50-$150") return row.marketValue >= 50 && row.marketValue <= 150;
  return row.marketValue > 150;
}

function listedDateMatches(row: Row, filter: string) {
  if (filter === "All") return true;
  if (filter === "Live") return row.daysListed > 0;
  if (filter === "Not listed") return row.daysListed === 0;
  return row.daysListed >= 21;
}

export default function InventoryPage() {
  const { approvedInventory } = useAcvLocalState();
  const rows = useMemo(() => [...inventoryItems.map(rowWithOps), ...approvedInventory.map(approvedItemToRow)], [approvedInventory]);
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
  const [needsReviewFilter, setNeedsReviewFilter] = useState("All");
  const [dateListedFilter, setDateListedFilter] = useState("All");
  const [marketRangeFilter, setMarketRangeFilter] = useState("All");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [enabledOptionalColumns, setEnabledOptionalColumns] = useState<Set<DataColumnKey>>(new Set());
  const [saveMessage, setSaveMessage] = useState("");

  const listedRows = rows.filter((row) => row.status === "Listed");
  const draftRows = rows.filter((row) => row.ops.draftSource !== "None");
  const unlistedRows = rows.filter((row) => row.status !== "Listed" && row.ops.draftSource === "None");

  const summary = {
    inventoryCost: rows.reduce((total, row) => total + row.purchaseCost * row.quantity, 0),
    marketValue: rows.reduce((total, row) => total + row.marketValue * row.quantity, 0),
    listedValue: listedRows.reduce((total, row) => total + row.askingPrice * row.quantity, 0),
    draftValue: draftRows.reduce((total, row) => total + row.marketValue * row.quantity, 0),
    unlistedValue: unlistedRows.reduce((total, row) => total + row.marketValue * row.quantity, 0),
    totalUnits: rows.reduce((total, row) => total + row.quantity, 0),
    activeListings: listedRows.length,
    drafts: draftRows.length,
    unlistedItems: unlistedRows.length,
    needsReview: rows.filter(needsReview).length
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
      const matchesNeedsReview = needsReviewFilter === "All" || (needsReviewFilter === "Needs Review" ? needsReview(row) : !needsReview(row));
      const matchesListedDate = listedDateMatches(row, dateListedFilter);
      const matchesMarketRange = marketRangeMatches(row, marketRangeFilter);
      return matchesQuery && matchesStatus && matchesCategory && matchesLocation && matchesListingType && matchesSource && matchesConfidence && matchesDrift && matchesNeedsReview && matchesListedDate && matchesMarketRange;
    });
  }, [categoryFilter, confidenceFilter, dateListedFilter, driftFilter, listingTypeFilter, locationFilter, marketRangeFilter, needsReviewFilter, query, sourceFilter, statusFilter, viewBaseRows]);

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

  function toggleOptionalColumn(key: DataColumnKey) {
    setEnabledOptionalColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const checkboxHeader = (
    <SelectCheckbox checked={allVisibleSelected} label="Select all visible inventory rows" onChange={toggleVisible} />
  );

  const checkboxColumn = {
    key: "select",
    header: checkboxHeader,
    className: "sticky left-0 z-30 w-8 min-w-8 bg-acv-panel2 px-2",
    cell: (row: Row) => <SelectCheckbox checked={selectedIds.has(row.id)} label={`Select ${row.sku}`} onChange={(checked) => toggleRow(row.id, checked)} />
  };

  const dataColumnDefinitions: Record<DataColumnKey, { header: string; className?: string; cell: (row: Row) => React.ReactNode }> = {
    qty: { header: "Qty", className: "text-center", cell: (row) => <span className="font-semibold text-acv-text">{row.quantity}</span> },
    cost: {
      header: "Cost",
      cell: (row) => (row.purchaseCost ? <span className="font-semibold text-acv-pink">{formatCurrency(row.purchaseCost)}</span> : <span className="text-acv-muted">—</span>)
    },
    listedPrice: {
      header: "Listed Price",
      cell: (row) => <span className={row.askingPrice ? "font-semibold text-acv-gold" : "font-semibold text-acv-muted"}>{row.askingPrice ? formatCurrency(row.askingPrice) : "—"}</span>
    },
    currentBid: {
      header: "Current Bid",
      cell: (row) => <span className={row.ops.listingType === "Auction" ? "font-semibold text-acv-green" : "text-acv-muted"}>{currentBidLabel(row)}</span>
    },
    marketValue: { header: "Market Value", cell: (row) => <span className="font-semibold text-acv-green">{formatCurrency(row.marketValue)}</span> },
    views: { header: "Views", cell: (row) => <span className="font-semibold text-acv-text">{row.ops.views}</span> },
    watchers: { header: "Watchers", cell: (row) => <span className="font-semibold text-acv-teal">{row.ops.watchers}</span> },
    bids: {
      header: "Bids",
      cell: (row) => <span className={row.ops.listingType === "Auction" ? "font-semibold text-acv-text" : "text-acv-muted"}>{bidsLabel(row)}</span>
    },
    daysListed: { header: "Days Listed", cell: (row) => <span className={row.daysListed ? "font-semibold text-acv-text" : "text-acv-muted"}>{row.daysListed ? `${row.daysListed}d` : "—"}</span> },
    status: { header: "Status", cell: (row) => <StatusPill tone={statusTone(row.ops.listingStatus)}>{row.ops.listingStatus}</StatusPill> },
    lot: { header: "Lot", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{lotLabel(row)}</span> },
    soldMedian: { header: "Sold Median Comp", cell: (row) => <span className="text-acv-text">{formatCurrency(row.ops.soldMedian)}</span> },
    activeLow: { header: "Active Low", cell: (row) => <span className="font-semibold text-acv-pink">{formatCurrency(row.ops.activeLow)}</span> },
    listingType: { header: "Listing Type", cell: (row) => <StatusPill tone={statusTone(row.ops.listingType)}>{row.ops.listingType}</StatusPill> },
    platform: { header: "Platform", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{platformLabel(row)}</span> },
    source: { header: "Source", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{row.source}</span> },
    confidence: {
      header: "Confidence",
      cell: (row) => <span className={confidenceBand(row.aiConfidence) === "Low" ? "font-semibold text-acv-pink" : confidenceBand(row.aiConfidence) === "Medium" ? "font-semibold text-acv-gold" : "font-semibold text-acv-teal"}>{formatPercent(row.aiConfidence)}</span>
    },
    drift: { header: "Drift", cell: (row) => <StatusPill tone={statusTone(row.ops.driftStatus)}>{row.ops.driftStatus}</StatusPill> },
    lastCompUpdate: { header: "Last Comp Update", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{lastCompUpdate(row)}</span> },
    lastPriceChange: { header: "Last Price Change", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{lastPriceChange(row)}</span> },
    promotionPct: { header: "Promotion %", cell: (row) => <span className="font-semibold text-acv-gold">{promotionPct(row)}%</span> },
    offers: { header: "Offers", cell: (row) => <span className="font-semibold text-acv-text">{offersCount(row)}</span> },
    shippingMethod: { header: "Shipping Method", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{shippingMethod(row)}</span> }
  };

  const defaultDataColumnKeys = viewMode === "Listings" && listingSubTab === "Auctions" ? auctionVisibleDataColumns : defaultVisibleDataColumns;

  const activeDataColumnKeys = [
    ...defaultDataColumnKeys,
    ...optionalDataColumns.filter(({ key }) => enabledOptionalColumns.has(key) && !defaultDataColumnKeys.includes(key)).map(({ key }) => key)
  ];

  const inventoryColumns = [
    checkboxColumn,
    {
      key: "thumbnail",
      header: "",
      className: "sticky left-8 z-30 w-12 min-w-12 bg-acv-panel2 px-1.5",
      cell: (row: Row) => <CardImageTile label={row.name} category={row.category} imageUrl={row.localPrimaryImageUrl} needsReupload={row.localNeedsImageReupload} />
    },
    { key: "sku", header: "SKU", className: "sticky left-20 z-30 w-32 min-w-32 bg-acv-panel2", cell: (row: Row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
    {
      key: "title",
      header: "Title",
      className: "sticky left-52 z-30 w-44 min-w-44 bg-acv-panel2 md:w-64 md:min-w-64",
      cell: (row: Row) => <span className="line-clamp-1 font-semibold text-acv-text">{row.name}</span>
    },
    ...activeDataColumnKeys.map((key) => ({
      key,
      header: dataColumnDefinitions[key].header,
      className: dataColumnDefinitions[key].className,
      cell: dataColumnDefinitions[key].cell
    })),
    { key: "actions", header: "Actions", className: "sticky right-0 z-30 w-28 min-w-28 bg-acv-panel2 text-right", cell: (row: Row) => <ActionMenu row={row} onOpen={setSelectedRow} /> }
  ];

  const activeFilterCount = [
    statusFilter,
    categoryFilter,
    locationFilter,
    listingTypeFilter,
    sourceFilter,
    confidenceFilter,
    driftFilter,
    needsReviewFilter,
    dateListedFilter,
    marketRangeFilter
  ].filter((value) => value !== "All").length + (query ? 1 : 0);

  return (
    <>
      <div className="min-w-0 space-y-2.5 p-3 sm:p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-acv-border pb-2">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusPill tone="purple">Mock data</StatusPill>
              <StatusPill tone="teal">ACV OS v1 shell</StatusPill>
            </div>
            <h1 className="truncate text-lg font-semibold text-acv-text">Inventory Workstation</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <ActionButton variant="ghost" icon={<Upload className="h-4 w-4" />}>
              Import
            </ActionButton>
            <ActionButton icon={<Plus className="h-4 w-4" />}>Create item</ActionButton>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(94px,1fr))] gap-2">
          {[
            ["Inventory Cost", formatCurrency(summary.inventoryCost), "pink"],
            ["Listed Value", formatCurrency(summary.listedValue), "teal"],
            ["Market Value", formatCurrency(summary.marketValue), "green"],
            ["Active Listings", String(summary.activeListings), "teal"],
            ["Drafts", String(summary.drafts), "gold"],
            ["Unlisted", String(summary.unlistedItems), "neutral"],
            ["Needs Review", String(summary.needsReview), "pink"]
          ].map(([label, value, tone]) => (
            <CompactMetric key={label} label={label} value={value} tone={tone as "green" | "teal" | "gold" | "pink" | "neutral"} />
          ))}
        </div>

        <section className="min-w-0 overflow-hidden rounded-lg border border-acv-border bg-acv-panel/88 shadow-glow">
          <div className="space-y-2 border-b border-acv-border bg-acv-black/45 px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap gap-2">
                {views.map((view) => (
                  <TableControlButton key={view} active={viewMode === view} onClick={() => switchView(view)}>
                    {view}
                  </TableControlButton>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeFilterCount > 0 && <StatusPill tone="gold">{activeFilterCount} filters</StatusPill>}
                <StatusPill tone="teal">{filteredRows.length} visible</StatusPill>
              </div>
            </div>

            {viewMode === "Listings" && (
              <div className="flex min-w-0 flex-wrap gap-2">
                {listingSubTabs.map((tab) => (
                  <TableControlButton
                    key={tab}
                    active={listingSubTab === tab}
                    tone="gold"
                    onClick={() => {
                      setListingSubTab(tab);
                      setSelectedIds(new Set());
                    }}
                  >
                    {tab}
                  </TableControlButton>
                ))}
              </div>
            )}

            <div className="flex min-w-0 items-center gap-2">
              <div className="acv-scrollbar contained-x-scroll flex min-w-0 flex-1 items-center gap-2 pb-1">
                <label className="w-56 shrink-0">
                  <span className="sr-only">Search inventory</span>
                  <div className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-acv-border bg-acv-panel2 px-2.5">
                    <Search className="h-3.5 w-3.5 shrink-0 text-acv-muted" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search title or SKU..."
                      className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-acv-text outline-none placeholder:text-acv-muted"
                    />
                  </div>
                </label>
                <ToolbarSelect label="Status" value={statusFilter} options={["All", ...uniqueValues([...rows.map((row) => row.status), ...rows.map((row) => row.ops.listingStatus)])]} onChange={setStatusFilter} className="w-40 shrink-0" />
                <ToolbarSelect label="Category" value={categoryFilter} options={["All", ...uniqueValues(rows.map((row) => row.category))]} onChange={setCategoryFilter} className="w-40 shrink-0" />
                <ToolbarSelect label="Location" value={locationFilter} options={["All", ...uniqueValues(rows.map((row) => row.location || "Missing"))]} onChange={setLocationFilter} className="w-40 shrink-0" />
                <ToolbarSelect label="Listing Type" value={listingTypeFilter} options={["All", "BIN", "Auction", "None"]} onChange={setListingTypeFilter} className="w-44 shrink-0" />
                <ToolbarSelect label="Source" value={sourceFilter} options={["All", ...uniqueValues(rows.map((row) => row.source))]} onChange={setSourceFilter} className="w-40 shrink-0" />
              </div>
              <button
                type="button"
                onClick={() => setShowColumnsMenu((current) => !current)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition",
                  showColumnsMenu ? "border-acv-gold/45 bg-acv-gold/10 text-acv-gold" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-gold/45 hover:text-acv-gold"
                )}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </button>
              <button
                type="button"
                onClick={() => setShowMoreFilters((current) => !current)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition",
                  showMoreFilters ? "border-acv-teal/45 bg-acv-teal/10 text-acv-teal" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                More Filters
              </button>
            </div>

            {showColumnsMenu && (
              <div className="rounded-md border border-acv-border bg-black/25 p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Visible Columns</p>
                  <span className="text-[11px] text-acv-muted">Identity + Actions stay frozen</span>
                </div>
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
                  {["Checkbox", "Thumbnail", "SKU", "Title", "Actions"].map((label) => (
                    <ColumnToggleButton key={label} label={label} checked disabled />
                  ))}
                  {defaultDataColumnKeys.map((key) => (
                    <ColumnToggleButton key={key} label={dataColumnDefinitions[key].header} checked disabled />
                  ))}
                  {optionalDataColumns
                    .filter(({ key }) => !defaultDataColumnKeys.includes(key))
                    .map(({ key, label }) => (
                      <ColumnToggleButton key={key} label={label} checked={enabledOptionalColumns.has(key)} onClick={() => toggleOptionalColumn(key)} />
                    ))}
                </div>
              </div>
            )}

            {showMoreFilters && (
              <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 rounded-md border border-acv-border bg-black/25 p-2">
                <ToolbarSelect label="Confidence" value={confidenceFilter} options={["All", "Low", "Medium", "High"]} onChange={setConfidenceFilter} />
                <ToolbarSelect label="Drift" value={driftFilter} options={["All", ...uniqueValues(rows.map((row) => row.ops.driftStatus))]} onChange={setDriftFilter} />
                <ToolbarSelect label="Needs Review" value={needsReviewFilter} options={["All", "Needs Review", "Clean"]} onChange={setNeedsReviewFilter} />
                <ToolbarSelect label="Date Listed" value={dateListedFilter} options={["All", "Live", "Not listed", "Stale 21d+"]} onChange={setDateListedFilter} />
                <ToolbarSelect label="Market Value Range" value={marketRangeFilter} options={["All", "Under $50", "$50-$150", "$150+"]} onChange={setMarketRangeFilter} />
              </div>
            )}

            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-acv-teal/35 bg-acv-teal/10 p-2">
                <StatusPill tone="teal">{selectedIds.size} selected</StatusPill>
                {["Edit Selected", "Refresh Comps", "Update Location", "Generate Drafts", "Stage to eBay"].map((action) => (
                  <MiniActionButton key={action}>{action}</MiniActionButton>
                ))}
                <MiniActionButton tone="pink">
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </MiniActionButton>
                <MiniActionButton tone="gold" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5" />
                  Clear
                </MiniActionButton>
              </div>
            )}

            {saveMessage && (
              <div className="flex items-center gap-2 rounded-md border border-acv-teal/35 bg-acv-teal/10 px-3 py-2 text-xs font-semibold text-acv-teal">
                <CheckCircle2 className="h-4 w-4" />
                {saveMessage}
              </div>
            )}
          </div>

          <DataTable<Row>
            rows={filteredRows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => setSelectedRow(row)}
            columns={inventoryColumns}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-acv-border px-3 py-2 text-[11px] text-acv-muted">
            <span>
              {filteredRows.length ? `1-${filteredRows.length} of ${filteredRows.length}` : "No records match the current controls"}
            </span>
            <span>Mock inventory data - no live eBay sync</span>
          </div>
        </section>

        <details className="min-w-0 rounded-lg border border-acv-border bg-acv-panel/60 px-3 py-2 text-xs text-acv-muted">
          <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Secondary ACV notes</summary>
          <div className="mt-3 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
              <p className="font-semibold text-acv-text">Source of Truth</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["SKU", "Purchase cost", "Location", "Internal notes", "Workflow status", "AI confidence"].map((item) => (
                  <StatusPill key={item} tone="teal">
                    {item}
                  </StatusPill>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
              <p className="font-semibold text-acv-text">Mock Mode</p>
              <p className="mt-2 leading-5">Detailed card attributes live in the drawer. Bulk actions and SKU pushes are staged mock controls only.</p>
            </div>
          </div>
        </details>
      </div>

      {selectedRow && <ItemDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} onMockSave={mockSave} />}
    </>
  );
}
