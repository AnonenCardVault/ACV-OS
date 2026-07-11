"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Columns3,
  Crop,
  Eye,
  FileClock,
  Plus,
  RefreshCcw,
  RotateCw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { StatusPill } from "@/components/status-pill";
import { approvedInventoryIdentity, useAcvLocalState, type ApprovedInventoryItem, type IntakeImage, type ProposedRecord } from "@/lib/acv-local-state";
import { archiveApprovedInventoryItemById, loadApprovedInventoryFromSupabase, loadArchivedApprovedInventoryFromSupabase, restoreApprovedInventoryItemById, saveApprovedInventoryItemChanges, softDeleteApprovedInventoryItemById } from "@/lib/supabase/cards";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  year: string;
  brandSet: string;
  parallel: string;
  cardNumber: string;
  serialNumber: string;
  status: string;
  location: string;
  purchaseCost: number;
  askingPrice: number | null;
  marketValue: number | null;
  quantity: number;
  source: string;
  ebayId: string;
  daysListed: number | null;
  aiConfidence: number;
  lastUpdated: string;
  notes: string;
};
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
  inventoryId?: string;
  profileId?: string;
  intakeGroupId?: string;
  recordSource?: "supabase";
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
  views: number | null;
  watchers: number | null;
  soldMedian: number | null;
  activeLow: number | null;
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
  { key: "confidence", label: "AI Confidence" },
  { key: "drift", label: "Drift" },
  { key: "lastCompUpdate", label: "Last comp update" },
  { key: "lastPriceChange", label: "Last price change" },
  { key: "promotionPct", label: "Promotion %" },
  { key: "offers", label: "Offers" },
  { key: "shippingMethod", label: "Shipping method" }
];

function defaultOps(item: InventoryItem): InventoryOps {
  return {
    playerCharacter: item.name,
    team: "-",
    autoRelicFlags: "Unconfirmed",
    conditionNotes: item.notes,
    listingType: "None",
    listingStatus: item.status,
    views: null,
    watchers: null,
    soldMedian: null,
    activeLow: null,
    driftStatus: "Not connected",
    draftSource: item.status === "Ready for Draft" ? "ACV Draft" : "None",
    titleStatus: item.status === "Ready for Draft" ? "Generated" : "Not Started",
    descriptionStatus: item.status === "Ready for Draft" ? "Generated" : "Not Started",
    photoStatus: "Reviewed",
    priceStatus: item.askingPrice ? "Approved" : "Needs Comps",
    suggestedPrice: item.askingPrice || item.marketValue || 0,
    nextAction: item.status,
    compSummary: "Pricing and marketplace data unavailable until ACV has saved pricing evidence or a connected marketplace sync.",
    skuHistory: [`Created ${item.sku}`],
    lifecycleTimeline: ["Inventory record created"],
    auditHistory: ["Supabase inventory record loaded"]
  };
}

function rowWithOps(item: InventoryItem): Row {
  return { ...item, ops: defaultOps(item) };
}

function approvedItemToRow(item: ApprovedInventoryItem): Row {
  const rowId = approvedInventoryIdentity(item);
  const purchaseCost = Number(item.proposed.purchaseCost) || 0;
  const quantity = Math.max(1, Number(item.proposed.quantity) || 1);
  const source = item.proposed.acquisitionSource || "Photo Intake";
  const location = item.proposed.location || "Photo Intake";
  const internalNotes = item.proposed.internalNotes?.trim();
  const workflowStatus = item.workflowStatus || "Needs Pricing";
  const listingType = item.listingType === "BIN" || item.listingType === "Auction" ? item.listingType : "None";
  const inventoryItem: InventoryItem = {
    id: rowId,
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
    askingPrice: item.listedPrice ?? null,
    marketValue: item.marketValue ?? null,
    quantity,
    source,
    ebayId: item.ebayItemId || "—",
    daysListed: item.daysListed ?? null,
    aiConfidence: typeof item.aiConfidence === "number" ? item.aiConfidence / 100 : 0,
    lastUpdated: item.approvedAt,
    notes:
      internalNotes ||
      (item.needsImageReupload
        ? "Approved from Photo Intake. Images need to be re-uploaded after refresh."
        : "Approved from Photo Intake. Awaiting pricing and marketplace sync.")
  };
  const baseRow = rowWithOps(inventoryItem);

  return {
    ...baseRow,
    status: workflowStatus,
    inventoryId: item.inventoryId,
    profileId: item.profileId,
    intakeGroupId: item.intakeGroupId,
    recordSource: "supabase",
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
      listingType,
      listingStatus: workflowStatus,
      views: item.views ?? null,
      watchers: item.watchers ?? null,
      photoStatus: item.needsImageReupload ? "Needs Reupload" : "Reviewed",
      priceStatus: "Needs Comps",
      nextAction: "Send to pricing",
      compSummary: item.marketValue ? `Saved market value ${formatCurrency(item.marketValue)}.` : "No saved pricing evidence yet. Market value stays unavailable until pricing is saved.",
      skuHistory: [`Assigned ${item.sku} from Photo Intake approval`, `Batch ${item.batch} / Group ${item.group}`],
      lifecycleTimeline: ["Uploaded in Photo Intake", "Approved to Supabase inventory", "Needs pricing"],
      auditHistory: item.auditHistory?.length ? item.auditHistory : [`Supabase approval ${item.approvedAt}`]
    }
  };
}

function splitBrandSet(value: string) {
  const parts = value.trim().split(/\s+/);
  return {
    brand: parts[0] || "",
    set: parts.slice(1).join(" ")
  };
}

function rowToProposed(row: Row): ProposedRecord {
  const brandSet = splitBrandSet(row.brandSet);
  return {
    cardName: row.name,
    playerCharacter: row.localProposed?.playerCharacter || row.ops.playerCharacter || row.name,
    team: row.localProposed?.team || row.ops.team || "",
    category: row.category,
    year: row.year === "-" ? "" : row.year,
    brand: row.localProposed?.brand || brandSet.brand,
    set: row.localProposed?.set || brandSet.set,
    cardNumber: row.cardNumber === "-" ? "" : row.cardNumber,
    parallel: row.parallel === "-" ? "" : row.parallel,
    serialNumber: row.serialNumber === "-" ? "" : row.serialNumber,
    rookieFlag: Boolean(row.localProposed?.rookieFlag),
    autoFlag: Boolean(row.localProposed?.autoFlag),
    relicFlag: Boolean(row.localProposed?.relicFlag),
    variationFlag: Boolean(row.localProposed?.variationFlag),
    grader: row.localProposed?.grader || "Raw",
    grade: row.localProposed?.grade || "Raw",
    conditionNotes: row.localProposed?.conditionNotes || row.ops.conditionNotes || "",
    uncertaintyNotes: row.localProposed?.uncertaintyNotes || "",
    purchaseCost: row.purchaseCost || 0,
    quantity: row.quantity || 1,
    acquisitionSource: row.localProposed?.acquisitionSource || row.source || "Inventory",
    location: row.location || "",
    internalNotes: row.localProposed?.internalNotes || row.notes || ""
  };
}

function rowToApprovedItem(row: Row, proposed: ProposedRecord, images: IntakeImage[]): ApprovedInventoryItem {
  const primary = images.find((image) => image.role === "Front") || images[0];
  return {
    inventoryId: row.inventoryId,
    profileId: row.profileId,
    intakeGroupId: row.intakeGroupId,
    sku: row.sku,
    batch: row.localBatch || "Inventory",
    group: row.localGroup || row.id,
    source: row.source as ApprovedInventoryItem["source"],
    primaryImageUrl: primary?.publicUrl || primary?.url || primary?.dataUrl || "",
    images,
    proposed,
    aiConfidence: row.aiConfidence > 0 ? row.aiConfidence * 100 : undefined,
    confirmedFields: Object.keys(proposed) as Array<keyof ProposedRecord>,
    approvedAt: row.lastUpdated || new Date().toLocaleString(),
    needsImageReupload: images.length === 0 || !primary?.url,
    auditHistory: row.ops.auditHistory,
    listedPrice: row.askingPrice,
    marketValue: row.marketValue,
    views: row.ops.views,
    watchers: row.ops.watchers,
    daysListed: row.daysListed,
    workflowStatus: row.status,
    listingType: row.ops.listingType,
    ebayItemId: row.ebayId === "—" ? null : row.ebayId
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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

function numericValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalCurrency(value: number | null | undefined, className = "font-semibold text-acv-text") {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? <span className={className}>{formatCurrency(value)}</span> : <span className="text-acv-muted">—</span>;
}

function optionalNumber(value: number | null | undefined, className = "font-semibold text-acv-text") {
  return typeof value === "number" && Number.isFinite(value) ? <span className={className}>{value}</span> : <span className="text-acv-muted">—</span>;
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
  tone = "neutral",
  disabled,
  title
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "neutral" | "teal" | "gold" | "pink";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold transition",
        tone === "teal"
          ? "border-acv-teal/40 bg-acv-teal/10 text-acv-teal hover:bg-acv-teal/15"
          : tone === "gold"
            ? "border-acv-gold/35 bg-acv-gold/10 text-acv-gold hover:bg-acv-gold/15"
            : tone === "pink"
              ? "border-acv-pink/40 bg-acv-pink/10 text-acv-pink hover:bg-acv-pink/15"
              : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal",
        disabled && "cursor-not-allowed opacity-45 hover:border-acv-border hover:text-acv-muted"
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

function EditableProfileField({
  label,
  value,
  onChange,
  multiline,
  type = "text"
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
      <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-20 w-full resize-y bg-transparent text-xs font-semibold leading-5 text-acv-text outline-none" />
      ) : (
        <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full min-w-0 bg-transparent text-xs font-semibold text-acv-text outline-none" />
      )}
    </label>
  );
}

function EditableProfileFlag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition",
        checked ? "border-acv-teal/35 bg-acv-teal/10 text-acv-teal" : "border-acv-border bg-acv-panel2 text-acv-muted hover:border-acv-teal/40 hover:text-acv-text"
      )}
    >
      <span>{label}</span>
      <span className={cn("h-3 w-3 shrink-0 rounded-[3px] border", checked ? "border-acv-teal bg-acv-teal" : "border-acv-border bg-black/20")} />
    </button>
  );
}

function ItemDetailDrawer({
  row,
  onClose,
  onSave,
  onArchive,
  onDelete,
  onComingSoon
}: {
  row: Row;
  onClose: () => void;
  onSave: (row: Row, proposed: ProposedRecord, images: IntakeImage[], removedImageIds: string[]) => void | Promise<void>;
  onArchive: (row: Row) => void;
  onDelete: (row: Row) => void;
  onComingSoon: (label: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<ProposedRecord>(() => rowToProposed(row));
  const [draftImages, setDraftImages] = useState<IntakeImage[]>(() => row.localImages || []);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [viewerImage, setViewerImage] = useState<IntakeImage | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [imageMessage, setImageMessage] = useState("");
  const primaryDraftImage = draftImages.find((image) => image.role === "Front") || draftImages[0];

  useEffect(() => {
    setDraft(rowToProposed(row));
    setDraftImages(row.localImages || []);
    setRemovedImageIds([]);
    setViewerImage(null);
    setReplaceTargetId(null);
    setImageMessage("");
  }, [row]);

  function updateDraft<K extends keyof ProposedRecord>(key: K, value: ProposedRecord[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setImageRole(imageId: string, role: IntakeImage["role"]) {
    setDraftImages((current) =>
      current.map((image) => {
        if (image.id === imageId) return { ...image, role };
        if (role === "Front" && image.role === "Front") return { ...image, role: "Detail / Closeup" };
        if (role === "Back" && image.role === "Back") return { ...image, role: "Detail / Closeup" };
        return image;
      })
    );
    setImageMessage(`${role} image staged. Click Save Changes to persist image role changes.`);
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setDraftImages((current) => {
      const index = current.findIndex((image) => image.id === imageId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((image, order) => ({ ...image, order }));
    });
    setImageMessage("Image order staged. Click Save Changes to persist the new order.");
  }

  function removeImage(image: IntakeImage) {
    if (!window.confirm(`Remove ${image.fileName || image.role} from this Universal Card Profile? The image record will be archived on save.`)) return;
    setRemovedImageIds((current) => (image.supabaseImageId ? Array.from(new Set([...current, image.supabaseImageId])) : current));
    setDraftImages((current) => {
      const next = current.filter((item) => item.id !== image.id);
      if (image.role === "Front" && next.length > 0 && !next.some((item) => item.role === "Front")) {
        return next.map((item, index) => (index === 0 ? { ...item, role: "Front", order: index } : { ...item, order: index }));
      }
      return next.map((item, index) => ({ ...item, order: index }));
    });
    setImageMessage(
      image.role === "Front"
        ? `${image.fileName || image.role} removed. The first remaining image will become Front if needed. Click Save Changes to persist.`
        : `${image.fileName || image.role} removed. Click Save Changes to archive the image record.`
    );
  }

  async function handleReplacement(file: File | undefined) {
    if (!file || !replaceTargetId) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setDraftImages((current) =>
        current.map((image) =>
          image.id === replaceTargetId
            ? {
                ...image,
                label: file.name,
                fileName: file.name,
                url: dataUrl,
                dataUrl,
                publicUrl: undefined,
                storageBucket: "inventory-images",
                storagePath: undefined,
                needsReupload: false
              }
            : image
        )
      );
      setImageMessage(`${file.name} staged. Click Save Changes to upload and persist the replacement.`);
    } catch {
      setImageMessage("Could not read that image file. Try another JPG, PNG, WEBP, or HEIC file.");
    } finally {
      setReplaceTargetId(null);
    }
  }

  function resetDraft() {
    setDraft(rowToProposed(row));
    setDraftImages(row.localImages || []);
    setRemovedImageIds([]);
    setImageMessage("");
  }

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm sm:left-56">
      <button type="button" aria-label="Close item detail drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-4xl flex-col border-l border-acv-border bg-acv-black shadow-glow">
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(event) => {
            void handleReplacement(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill>
              <StatusPill tone={statusTone(row.ops.listingType)}>{row.ops.listingType === "None" ? "No live listing" : row.ops.listingType}</StatusPill>
              <StatusPill tone={statusTone(confidenceBand(row.aiConfidence))}>{formatPercent(row.aiConfidence)} AI</StatusPill>
            </div>
            <h2 className="truncate text-lg font-semibold text-acv-text">{draft.cardName || row.name}</h2>
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
              <button type="button" className="block w-full text-left" onClick={() => primaryDraftImage && setViewerImage(primaryDraftImage)}>
                <CardImageTile label={draft.cardName || row.name} category={draft.category || row.category} large imageUrl={primaryDraftImage?.url || primaryDraftImage?.dataUrl || row.localPrimaryImageUrl} needsReupload={row.localNeedsImageReupload} />
              </button>
              <div className="space-y-2">
                {draftImages.length ? (
                  draftImages.map((image, index) => (
                    <div key={image.id} className="rounded-md border border-acv-border bg-acv-panel2 p-2">
                      <button type="button" className="block w-full overflow-hidden rounded border border-acv-border bg-black/20" onClick={() => setViewerImage(image)}>
                        {image.url || image.dataUrl ? (
                          <img src={image.url || image.dataUrl} alt={image.label} className="h-24 w-full object-cover" />
                        ) : (
                          <div className="flex h-24 items-center justify-center px-2 text-center text-[10px] font-semibold text-acv-muted">{image.needsReupload ? "Re-upload" : image.role}</div>
                        )}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusPill tone={image.role === "Front" ? "teal" : image.role === "Back" ? "gold" : "purple"}>{image.role}</StatusPill>
                        <MiniActionButton tone="teal" onClick={() => setViewerImage(image)}>
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </MiniActionButton>
                        <MiniActionButton onClick={() => setImageRole(image.id, "Front")}>Set Front</MiniActionButton>
                        <MiniActionButton onClick={() => setImageRole(image.id, "Back")}>Set Back</MiniActionButton>
                        <MiniActionButton
                          onClick={() => {
                            setReplaceTargetId(image.id);
                            fileInputRef.current?.click();
                          }}
                        >
                          Replace
                        </MiniActionButton>
                        <MiniActionButton disabled title="Coming soon">
                          <Crop className="h-3.5 w-3.5" />
                          Crop
                        </MiniActionButton>
                        <MiniActionButton disabled title="Coming soon">
                          <RotateCw className="h-3.5 w-3.5" />
                          Rotate
                        </MiniActionButton>
                        <MiniActionButton tone="pink" onClick={() => removeImage(image)}>
                          Remove
                        </MiniActionButton>
                        <MiniActionButton disabled={index === 0} title={index === 0 ? "Already first image" : undefined} onClick={() => moveImage(image.id, -1)}>
                          Up
                        </MiniActionButton>
                        <MiniActionButton disabled={index === draftImages.length - 1} title={index === draftImages.length - 1 ? "Already last image" : undefined} onClick={() => moveImage(image.id, 1)}>
                          Down
                        </MiniActionButton>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-3 text-center text-xs font-semibold text-acv-muted">No images attached. Replace/add image controls coming soon.</div>
                )}
              </div>
              {imageMessage && (
                <div className="rounded-md border border-acv-teal/35 bg-acv-teal/10 px-3 py-2 text-xs font-semibold text-acv-teal">
                  {imageMessage}
                </div>
              )}
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
                  <EditableProfileField label="Card / Title" value={draft.cardName} onChange={(value) => updateDraft("cardName", value)} />
                  <EditableProfileField label="Category" value={draft.category} onChange={(value) => updateDraft("category", value)} />
                  <EditableProfileField label="Year" value={draft.year} onChange={(value) => updateDraft("year", value)} />
                  <EditableProfileField label="Brand" value={draft.brand} onChange={(value) => updateDraft("brand", value)} />
                  <EditableProfileField label="Set" value={draft.set} onChange={(value) => updateDraft("set", value)} />
                  <EditableProfileField label="Player / Character" value={draft.playerCharacter} onChange={(value) => updateDraft("playerCharacter", value)} />
                  <EditableProfileField label="Team" value={draft.team} onChange={(value) => updateDraft("team", value)} />
                  <EditableProfileField label="Card Number" value={draft.cardNumber} onChange={(value) => updateDraft("cardNumber", value)} />
                  <EditableProfileField label="Parallel" value={draft.parallel} onChange={(value) => updateDraft("parallel", value)} />
                  <EditableProfileField label="Serial Number" value={draft.serialNumber} onChange={(value) => updateDraft("serialNumber", value)} />
                  <EditableProfileField label="Grader" value={draft.grader || "Raw"} onChange={(value) => updateDraft("grader", value)} />
                  <EditableProfileField label="Grade" value={draft.grade || "Raw"} onChange={(value) => updateDraft("grade", value)} />
                  <EditableProfileFlag label="Rookie" checked={draft.rookieFlag} onChange={(value) => updateDraft("rookieFlag", value)} />
                  <EditableProfileFlag label="Auto" checked={draft.autoFlag} onChange={(value) => updateDraft("autoFlag", value)} />
                  <EditableProfileFlag label="Relic" checked={draft.relicFlag} onChange={(value) => updateDraft("relicFlag", value)} />
                  <EditableProfileFlag label="Variation" checked={draft.variationFlag} onChange={(value) => updateDraft("variationFlag", value)} />
                  <DetailField label="Status" value={row.status} tone={statusTone(row.status) === "pink" ? "pink" : "teal"} />
                  <EditableProfileField label="Location" value={draft.location} onChange={(value) => updateDraft("location", value)} />
                  <DetailField label="Lot" value={lotLabel(row)} />
                  <EditableProfileField label="Purchase Cost" type="number" value={draft.purchaseCost} onChange={(value) => updateDraft("purchaseCost", Number(value) || 0)} />
                  <DetailField label={row.ops.listingType === "Auction" ? "Listed / Start Price" : "Ask / Listed"} value={optionalCurrency(row.askingPrice, "font-semibold text-acv-gold")} tone="gold" />
                  {row.ops.listingType === "Auction" && (
                    <>
                      <DetailField label="Current Bid" value={currentBidLabel(row)} tone="green" />
                      <DetailField label="Bids" value={bidsLabel(row)} tone="teal" />
                      <DetailField label="Auction End" value={auctionEndLabel(row)} tone="gold" />
                    </>
                  )}
                  <DetailField label="Market Value" value={optionalCurrency(row.marketValue, "font-semibold text-acv-green")} tone="green" />
                  <EditableProfileField label="Quantity" type="number" value={draft.quantity} onChange={(value) => updateDraft("quantity", Math.max(1, Number(value) || 1))} />
                  <EditableProfileField label="Source" value={draft.acquisitionSource} onChange={(value) => updateDraft("acquisitionSource", value)} />
                  {row.localBatch && <DetailField label="Intake Batch" value={row.localBatch} tone="gold" />}
                  {row.localGroup && <DetailField label="Intake Group" value={row.localGroup} tone="gold" />}
                  <DetailField label="AI Confidence" value={formatPercent(row.aiConfidence)} tone={confidenceBand(row.aiConfidence) === "Low" ? "pink" : confidenceBand(row.aiConfidence) === "Medium" ? "gold" : "teal"} />
                  <DetailField label="Listing Type" value={row.ops.listingType} tone={row.ops.listingType === "None" ? undefined : "gold"} />
                  <DetailField label="eBay Item ID" value={row.ebayId} />
                  <DetailField label="Sold Median Comp" value={optionalCurrency(row.ops.soldMedian)} />
                  <DetailField label="Active Low" value={optionalCurrency(row.ops.activeLow, "font-semibold text-acv-pink")} tone="pink" />
                  <DetailField label="Views" value={optionalNumber(row.ops.views)} />
                  <DetailField label="Watchers" value={optionalNumber(row.ops.watchers, "font-semibold text-acv-teal")} tone="teal" />
                  <DetailField label="Days Listed" value={typeof row.daysListed === "number" ? `${row.daysListed} days` : "Not listed"} />
                  <DetailField label="Comp Summary" value={row.ops.compSummary} tone="teal" />
                </div>
              </section>
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Condition Notes</p>
              <EditableProfileField label="Condition Notes" value={draft.conditionNotes} multiline onChange={(value) => updateDraft("conditionNotes", value)} />
            </section>
            <section className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Internal Notes</p>
              <EditableProfileField label="Internal Notes" value={draft.internalNotes} multiline onChange={(value) => updateDraft("internalNotes", value)} />
              <div className="mt-3">
                <EditableProfileField label="Uncertainty Notes" value={draft.uncertaintyNotes} multiline onChange={(value) => updateDraft("uncertaintyNotes", value)} />
              </div>
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

        <div className="grid gap-2 border-t border-acv-border bg-black/70 p-4 sm:grid-cols-3 xl:grid-cols-7">
          <MiniActionButton tone="teal" onClick={() => void onSave(row, draft, draftImages, removedImageIds)}>
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </MiniActionButton>
          <MiniActionButton tone="gold" onClick={resetDraft}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Cancel / Revert
          </MiniActionButton>
          <MiniActionButton disabled title="Coming soon">
            <RefreshCcw className="h-3.5 w-3.5" />
            Send to Pricing
          </MiniActionButton>
          <MiniActionButton tone="gold" disabled title="Coming soon">
            <FileClock className="h-3.5 w-3.5" />
            Generate Draft
          </MiniActionButton>
          <MiniActionButton tone="teal" disabled title="Coming soon">
            <Tag className="h-3.5 w-3.5" />
            Stage Listing
          </MiniActionButton>
          <MiniActionButton tone="gold" disabled title="Coming soon">
            <Send className="h-3.5 w-3.5" />
            Push SKU to eBay
          </MiniActionButton>
          <MiniActionButton tone="pink" onClick={() => onArchive(row)}>
            <Archive className="h-3.5 w-3.5" />
            Archive
          </MiniActionButton>
          <MiniActionButton tone="pink" onClick={() => onDelete(row)}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </MiniActionButton>
        </div>
      </aside>
      {viewerImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
          <button type="button" aria-label="Close image viewer" className="absolute inset-0 cursor-default" onClick={() => setViewerImage(null)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg border border-acv-border bg-acv-black p-3 shadow-glow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-gold">{viewerImage.role}</p>
                <p className="truncate text-sm font-semibold text-acv-text">{viewerImage.fileName || viewerImage.label}</p>
              </div>
              <button type="button" title="Close" onClick={() => setViewerImage(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-acv-border text-acv-muted hover:text-acv-teal">
                <X className="h-4 w-4" />
              </button>
            </div>
            {viewerImage.url || viewerImage.dataUrl ? (
              <img src={viewerImage.url || viewerImage.dataUrl} alt={viewerImage.label} className="max-h-[78vh] w-full object-contain" />
            ) : (
              <div className="flex h-96 items-center justify-center text-sm font-semibold text-acv-muted">Image needs to be re-uploaded.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionMenu({ row, onOpen, onArchive }: { row: Row; onOpen: (row: Row) => void; onArchive: (row: Row) => void }) {
  return (
    <select
      aria-label={`Actions for ${row.sku}`}
      defaultValue=""
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        event.stopPropagation();
        if (event.target.value === "details") onOpen(row);
        if (event.target.value === "archive") onArchive(row);
        event.currentTarget.value = "";
      }}
      className="h-8 w-28 rounded-md border border-acv-border bg-acv-panel2 px-2 text-[11px] font-semibold text-acv-text outline-none transition hover:border-acv-teal/45"
    >
      <option value="">Actions</option>
      <option value="details">Open details</option>
      <option value="price" disabled>Edit price - coming soon</option>
      <option value="location" disabled>Update location - coming soon</option>
      <option value="comps" disabled>Refresh comps - coming soon</option>
      <option value="stage" disabled>Stage to eBay - coming soon</option>
      <option value="archive">Archive</option>
    </select>
  );
}

function lotLabel(row: Row) {
  return row.ops.lotName || "—";
}

function platformLabel(row: Row) {
  return row.ops.platform || "ACV";
}

function lastCompUpdate(row: Row) {
  return row.ops.lastCompUpdate || "—";
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
  return row.ops.shippingMethod || "Not set";
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
  const marketValue = row.marketValue;
  if (typeof marketValue !== "number" || !Number.isFinite(marketValue) || marketValue <= 0) return false;
  if (filter === "Under $50") return marketValue < 50;
  if (filter === "$50-$150") return marketValue >= 50 && marketValue <= 150;
  return marketValue > 150;
}

function listedDateMatches(row: Row, filter: string) {
  if (filter === "All") return true;
  if (filter === "Live") return typeof row.daysListed === "number";
  if (filter === "Not listed") return typeof row.daysListed !== "number";
  return typeof row.daysListed === "number" && row.daysListed >= 21;
}

export default function InventoryPage() {
  const { backendStatus, refreshBackendHealth } = useAcvLocalState();
  const inventoryRequestIdRef = useRef(0);
  const [inventoryRecords, setInventoryRecords] = useState<ApprovedInventoryItem[]>([]);
  const [archivedRecords, setArchivedRecords] = useState<ApprovedInventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryRetrying, setInventoryRetrying] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("All Inventory");
  const rows = useMemo(() => {
    const inactiveIds = new Set([...Array.from(archivedIds), ...Array.from(deletedIds)]);
    return inventoryRecords.map(approvedItemToRow).filter((row) => !inactiveIds.has(row.id));
  }, [archivedIds, deletedIds, inventoryRecords]);
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

  const loadInventoryRecords = useCallback(async () => {
    const requestId = ++inventoryRequestIdRef.current;
    const [active, archived] = await Promise.all([loadApprovedInventoryFromSupabase(), loadArchivedApprovedInventoryFromSupabase()]);

    if (requestId !== inventoryRequestIdRef.current) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[ACV Inventory] stale inventory response ignored", { requestId, latest: inventoryRequestIdRef.current });
      }
      return false;
    }

    setInventoryRecords(active);
    setArchivedRecords(archived);
    setArchivedIds(new Set());
    setDeletedIds(new Set());

    if (process.env.NODE_ENV !== "production") {
      console.info("[ACV Inventory] Supabase inventory loaded", { activeRows: active.length, archivedRows: archived.length });
    }

    return true;
  }, []);

  const refreshInventory = useCallback(async () => {
    if (backendStatus.connectionState === "checking") {
      setInventoryRecords([]);
      setArchivedRecords([]);
      setInventoryLoading(true);
      setInventoryError("");
      return;
    }

    if (backendStatus.connectionState !== "connected") {
      setInventoryRecords([]);
      setArchivedRecords([]);
      setInventoryLoading(false);
      setInventoryError(
        backendStatus.connectionState === "misconfigured"
          ? backendStatus.databaseMessage || "Supabase configuration missing."
          : backendStatus.databaseMessage || "Inventory unavailable. Supabase database is not connected."
      );
      return;
    }

    setInventoryLoading(true);
    setInventoryError("");
    try {
      await loadInventoryRecords();
    } catch (error) {
      console.error("[ACV Inventory] Supabase inventory load failed", error);
      setInventoryRecords([]);
      setArchivedRecords([]);
      setInventoryError(error instanceof Error ? error.message : "Inventory unavailable. Supabase inventory could not be loaded.");
    } finally {
      setInventoryLoading(false);
    }
  }, [backendStatus.connectionState, backendStatus.databaseMessage, loadInventoryRecords]);

  const retryInventory = useCallback(async () => {
    if (inventoryRetrying) return;
    setInventoryRetrying(true);
    setInventoryLoading(true);
    setInventoryError("");

    let lastMessage = "Inventory unavailable. Retry did not complete.";

    try {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (process.env.NODE_ENV !== "production") {
          console.info("[ACV Inventory] retry attempt", { attempt });
        }

        const status = await refreshBackendHealth();
        if (status.connectionState === "connected") {
          try {
            await loadInventoryRecords();
            setInventoryError("");
            return;
          } catch (error) {
            lastMessage = error instanceof Error ? error.message : "Supabase inventory query failed.";
          }
        } else {
          lastMessage = status.databaseMessage || status.message || "Supabase database is not connected.";
        }

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
        }
      }

      setInventoryRecords([]);
      setArchivedRecords([]);
      setInventoryError(lastMessage);
    } finally {
      setInventoryLoading(false);
      setInventoryRetrying(false);
    }
  }, [inventoryRetrying, loadInventoryRecords, refreshBackendHealth]);

  useEffect(() => {
    if (inventoryRetrying) return;
    void refreshInventory();
  }, [inventoryRetrying, refreshInventory]);

  useEffect(() => {
    if (selectedRow && !rows.some((row) => row.id === selectedRow.id)) {
      setSelectedRow(null);
    }
  }, [rows, selectedRow]);

  const listedRows = rows.filter((row) => row.status === "Listed");
  const draftRows = rows.filter((row) => row.ops.draftSource !== "None");
  const unlistedRows = rows.filter((row) => row.status !== "Listed" && row.ops.draftSource === "None");

  const summary = {
    inventoryCost: rows.reduce((total, row) => total + row.purchaseCost * row.quantity, 0),
    marketValue: rows.reduce((total, row) => total + numericValue(row.marketValue) * row.quantity, 0),
    listedValue: listedRows.reduce((total, row) => total + numericValue(row.askingPrice) * row.quantity, 0),
    draftValue: draftRows.reduce((total, row) => total + numericValue(row.marketValue) * row.quantity, 0),
    unlistedValue: unlistedRows.reduce((total, row) => total + numericValue(row.marketValue) * row.quantity, 0),
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

  async function saveInventoryChanges(row: Row, proposed: ProposedRecord, images: IntakeImage[], removedImageIds: string[]) {
    const nextImages = images.map((image, order) => ({ ...image, order }));
    const nextItem = rowToApprovedItem(row, proposed, nextImages);
    if (backendStatus.connectionState !== "connected" || !row.inventoryId) {
      setSaveMessage(`${row.sku} could not be saved because Supabase inventory is unavailable.`);
      return;
    }

    try {
      await saveApprovedInventoryItemChanges(nextItem, removedImageIds);
      await refreshInventory();
      setSaveMessage(`${row.sku} saved to Supabase inventory.`);
    } catch (error) {
      console.error("[ACV Inventory] Save failed", error);
      setSaveMessage(`${row.sku} could not be saved to Supabase. No cached inventory row was written.`);
    }

    setSelectedRow(null);
  }

  async function archiveInventoryRow(row: Row, requireConfirmation = true) {
    if (requireConfirmation && !window.confirm(`Archive inventory record ${row.id} (${row.sku})? It will leave active Inventory views but remain recoverable as a soft-deleted record where Supabase supports it.`)) return;
    if (backendStatus.connectionState !== "connected" || !row.inventoryId) {
      setSaveMessage(`${row.sku} could not be archived because Supabase inventory is unavailable.`);
      return;
    }
    setArchivedIds((current) => new Set(current).add(row.id));
    setSelectedRow(null);

    try {
      await archiveApprovedInventoryItemById(row.inventoryId);
      await refreshInventory();
      setSaveMessage(`${row.sku} archived (${row.id}).`);
    } catch (error) {
      console.error("[ACV Inventory] Archive failed", error);
      setArchivedIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      setSaveMessage(`${row.sku} could not be archived in Supabase.`);
    }
  }

  async function deleteInventoryRow(row: Row, options: { requireConfirmation?: boolean; archiveImages?: boolean } = {}) {
    const requireConfirmation = options.requireConfirmation ?? true;
    if (requireConfirmation && !window.confirm(`Remove inventory record ${row.id} (${row.sku}) from active Inventory? ACV will use a safe soft delete/archive path and will not permanently delete images by default.`)) return;
    if (backendStatus.connectionState !== "connected" || !row.inventoryId) {
      setSaveMessage(`${row.sku} could not be deleted because Supabase inventory is unavailable.`);
      return;
    }
    const archiveImages = options.archiveImages ?? window.confirm("Also archive image records for this item? Choose Cancel to keep image records recoverable.");
    setDeletedIds((current) => new Set(current).add(row.id));
    setSelectedRow(null);

    try {
      await softDeleteApprovedInventoryItemById(row.inventoryId, archiveImages);
      await refreshInventory();
      setSaveMessage(`${row.sku} safely removed from active Inventory (${row.id}).`);
    } catch (error) {
      console.error("[ACV Inventory] Delete failed", error);
      setDeletedIds((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
      setSaveMessage(`${row.sku} could not be removed in Supabase.`);
    }
  }

  async function restoreArchivedItem(item: ApprovedInventoryItem) {
    const rowId = approvedInventoryIdentity(item);
    if (!item.inventoryId) {
      setSaveMessage(`${item.sku} cannot be restored because it is missing a Supabase inventory record ID.`);
      return;
    }

    try {
      await restoreApprovedInventoryItemById(item.inventoryId);
      setArchivedIds((current) => {
        const next = new Set(current);
        next.delete(rowId);
        return next;
      });
      await refreshInventory();
      setSaveMessage(`${item.sku} restored to active inventory.`);
    } catch (error) {
      console.error("[ACV Inventory] Restore failed", error);
      setSaveMessage(`${item.sku} could not be restored in Supabase.`);
    }
  }

  async function archiveSelectedRows() {
    const selectedRows = rows.filter((row) => selectedIds.has(row.id));
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Archive ${selectedRows.length} selected inventory record${selectedRows.length === 1 ? "" : "s"}?`)) return;
    for (const row of selectedRows) {
      await archiveInventoryRow(row, false);
    }
    setSelectedIds(new Set());
    setSaveMessage(`${selectedRows.length} selected inventory record${selectedRows.length === 1 ? "" : "s"} archived.`);
  }

  async function deleteSelectedRows() {
    const selectedRows = rows.filter((row) => selectedIds.has(row.id));
    if (selectedRows.length === 0) return;
    if (!window.confirm(`Delete/remove ${selectedRows.length} selected inventory record${selectedRows.length === 1 ? "" : "s"}? This uses the safe soft-delete path.`)) return;
    const archiveImages = window.confirm("Also archive image records where safe? Choose Cancel to keep image records recoverable.");
    for (const row of selectedRows) {
      await deleteInventoryRow(row, { requireConfirmation: false, archiveImages });
    }
    setSelectedIds(new Set());
    setSaveMessage(`${selectedRows.length} selected inventory record${selectedRows.length === 1 ? "" : "s"} removed.`);
  }

  function showComingSoon(label: string) {
    setSaveMessage(`${label} is coming soon. No changes were made.`);
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
      cell: (row) => optionalCurrency(row.askingPrice, "font-semibold text-acv-gold")
    },
    currentBid: {
      header: "Current Bid",
      cell: (row) => <span className={row.ops.listingType === "Auction" ? "font-semibold text-acv-green" : "text-acv-muted"}>{currentBidLabel(row)}</span>
    },
    marketValue: { header: "Market Value", cell: (row) => optionalCurrency(row.marketValue, "font-semibold text-acv-green") },
    views: {
      header: "Views",
      cell: (row) => optionalNumber(row.ops.views, "font-semibold text-acv-text")
    },
    watchers: {
      header: "Watchers",
      cell: (row) => optionalNumber(row.ops.watchers, "font-semibold text-acv-teal")
    },
    bids: {
      header: "Bids",
      cell: (row) => <span className={row.ops.listingType === "Auction" ? "font-semibold text-acv-text" : "text-acv-muted"}>{bidsLabel(row)}</span>
    },
    daysListed: { header: "Days Listed", cell: (row) => <span className={row.daysListed ? "font-semibold text-acv-text" : "text-acv-muted"}>{row.daysListed ? `${row.daysListed}d` : "—"}</span> },
    status: { header: "Status", cell: (row) => <StatusPill tone={statusTone(row.ops.listingStatus)}>{row.ops.listingStatus}</StatusPill> },
    lot: { header: "Lot", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{lotLabel(row)}</span> },
    soldMedian: { header: "Sold Median Comp", cell: (row) => optionalCurrency(row.ops.soldMedian, "text-acv-text") },
    activeLow: { header: "Active Low", cell: (row) => optionalCurrency(row.ops.activeLow, "font-semibold text-acv-pink") },
    listingType: { header: "Listing Type", cell: (row) => <StatusPill tone={statusTone(row.ops.listingType)}>{row.ops.listingType}</StatusPill> },
    platform: { header: "Platform", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{platformLabel(row)}</span> },
    source: { header: "Source", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{row.source}</span> },
    confidence: {
      header: "AI Confidence",
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
    { key: "actions", header: "Actions", className: "sticky right-0 z-30 w-28 min-w-28 bg-acv-panel2 text-right", cell: (row: Row) => <ActionMenu row={row} onOpen={setSelectedRow} onArchive={archiveInventoryRow} /> }
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
  const inventorySourceLabel =
    backendStatus.connectionState === "connected"
      ? "Supabase inventory"
      : backendStatus.connectionState === "checking"
        ? "Checking Supabase"
        : backendStatus.connectionState === "misconfigured"
          ? "Config missing"
          : "Inventory unavailable";
  const inventorySourceTone = backendStatus.connectionState === "connected" ? "teal" : backendStatus.connectionState === "checking" || backendStatus.connectionState === "degraded" ? "gold" : "pink";

  return (
    <>
      <div className="min-w-0 space-y-2.5 p-3 sm:p-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-acv-border pb-2">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <StatusPill tone={inventorySourceTone}>
                {inventorySourceLabel}
              </StatusPill>
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
                <ToolbarSelect label="AI Confidence" value={confidenceFilter} options={["All", "Low", "Medium", "High"]} onChange={setConfidenceFilter} />
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
                <MiniActionButton tone="pink" onClick={() => void archiveSelectedRows()}>
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </MiniActionButton>
                <MiniActionButton tone="pink" onClick={() => void deleteSelectedRows()}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
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

          {inventoryLoading ? (
            <div className="flex min-h-64 items-center justify-center px-4 py-10">
              <div className="rounded-lg border border-acv-border bg-acv-panel2 px-5 py-4 text-center">
                <p className="text-sm font-semibold text-acv-text">Loading Supabase inventory...</p>
                <p className="mt-1 text-xs text-acv-muted">ACV is reading live inventory records.</p>
              </div>
            </div>
          ) : inventoryError ? (
            <div className="flex min-h-64 items-center justify-center px-4 py-10">
              <div className="max-w-lg rounded-lg border border-acv-pink/35 bg-acv-pink/10 px-5 py-4 text-center">
                <p className="text-sm font-semibold text-acv-pink">Inventory unavailable</p>
                <p className="mt-2 text-xs leading-5 text-acv-text">{inventoryError}</p>
                <button
                  type="button"
                  onClick={() => void retryInventory()}
                  disabled={inventoryRetrying}
                  className={cn(
                    "mt-4 inline-flex h-9 items-center justify-center rounded-md border border-acv-teal/45 bg-acv-teal/10 px-4 text-xs font-semibold text-acv-teal transition hover:bg-acv-teal/15",
                    inventoryRetrying && "cursor-not-allowed opacity-60"
                  )}
                >
                  {inventoryRetrying ? "Retrying..." : "Retry"}
                </button>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center px-4 py-12">
              <div className="max-w-lg rounded-lg border border-acv-border bg-acv-panel2 px-6 py-5 text-center shadow-glow">
                <p className="text-base font-semibold text-acv-text">No inventory yet</p>
                <p className="mt-2 text-sm leading-6 text-acv-muted">Approve a card from Photo Intake to create your first inventory record.</p>
                <a
                  href="/photo-intake"
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-acv-teal/45 bg-acv-teal px-4 text-xs font-bold text-black transition hover:bg-acv-teal/90"
                >
                  Go to Photo Intake
                </a>
              </div>
            </div>
          ) : (
            <DataTable<Row>
              rows={filteredRows}
              getRowKey={(row) => row.id}
              onRowClick={(row) => setSelectedRow(row)}
              columns={inventoryColumns}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-acv-border px-3 py-2 text-[11px] text-acv-muted">
            <span>
              {rows.length === 0 ? "0 live records" : filteredRows.length ? `1-${filteredRows.length} of ${filteredRows.length}` : "No records match the current controls"}
            </span>
            <span>{backendStatus.connectionState === "connected" ? "Supabase inventory · marketplace columns available after eBay sync" : inventorySourceLabel}</span>
          </div>
        </section>

        {archivedRecords.length > 0 && (
          <details className="min-w-0 rounded-lg border border-acv-border bg-acv-panel/70 px-3 py-2 text-xs text-acv-muted">
            <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">
              Archived Inventory ({archivedRecords.length})
            </summary>
            <div className="mt-3 space-y-2">
              {archivedRecords.map((item) => (
                <div key={approvedInventoryIdentity(item)} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-acv-text">{item.proposed.cardName || item.sku}</p>
                    <p className="mt-0.5 truncate text-[11px] text-acv-muted">{item.sku} · {item.inventoryId || "Missing record ID"}</p>
                  </div>
                  <MiniActionButton tone="teal" onClick={() => void restoreArchivedItem(item)}>
                    Restore
                  </MiniActionButton>
                </div>
              ))}
            </div>
          </details>
        )}

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
              <p className="font-semibold text-acv-text">{backendStatus.connectionState === "connected" ? "Supabase Mode" : inventorySourceLabel}</p>
              <p className="mt-2 leading-5">Detailed card attributes live in the drawer. Marketplace sync columns stay unavailable until connected data is saved.</p>
            </div>
          </div>
        </details>
      </div>

      {selectedRow && (
        <ItemDetailDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onSave={saveInventoryChanges}
          onArchive={archiveInventoryRow}
          onDelete={deleteInventoryRow}
          onComingSoon={showComingSoon}
        />
      )}
    </>
  );
}
