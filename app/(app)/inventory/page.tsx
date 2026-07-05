"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Edit3,
  FileClock,
  Filter,
  History,
  Plus,
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

function statusTone(status: string): "green" | "teal" | "gold" | "pink" | "purple" | "neutral" {
  if (["Listed", "Ready for Draft", "Sold"].includes(status)) return "teal";
  if (["Needs Pricing", "Needs Review"].includes(status)) return "pink";
  if (["Ready to Publish"].includes(status)) return "gold";
  return "purple";
}

function confidenceBand(confidence: number) {
  if (confidence < 0.75) return "Low";
  if (confidence < 0.9) return "Medium";
  return "High";
}

function uniqueValues(key: keyof InventoryItem) {
  return Array.from(new Set(inventoryItems.map((item) => String(item[key] || "Missing")))).sort();
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

function Field({ label, value, type = "text" }: { label: string; value: string | number; type?: string }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</span>
      <input
        type={type}
        defaultValue={value}
        className="h-9 w-full rounded-md border border-acv-border bg-acv-panel2 px-3 text-sm text-acv-text outline-none transition focus:border-acv-teal/60"
      />
    </label>
  );
}

function InventoryEditDrawer({
  item,
  onClose,
  onMockSave
}: {
  item: InventoryItem;
  onClose: () => void;
  onMockSave: (sku: string) => void;
}) {
  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm sm:left-56">
      <button type="button" aria-label="Close inventory drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-acv-border bg-acv-black shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill tone={statusTone(item.status)}>{item.status}</StatusPill>
              <StatusPill tone={confidenceBand(item.aiConfidence) === "Low" ? "pink" : confidenceBand(item.aiConfidence) === "Medium" ? "gold" : "teal"}>
                {formatPercent(item.aiConfidence)} confidence
              </StatusPill>
            </div>
            <h2 className="truncate text-lg font-semibold text-acv-text">{item.name}</h2>
            <p className="mt-1 text-xs text-acv-muted">{item.sku || "Missing SKU"}</p>
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
            <CardImageTile label={item.name} category={item.category} large />
            <div className="min-w-0 space-y-4">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Field label="SKU" value={item.sku || "Missing SKU"} />
                <Field label="Card Name" value={item.name} />
                <Field label="Category" value={item.category} />
                <Field label="Year" value={item.year} />
                <Field label="Brand / Set" value={item.brandSet} />
                <Field label="Parallel" value={item.parallel} />
                <Field label="Card #" value={item.cardNumber} />
                <Field label="Serial #" value={item.serialNumber} />
                <Field label="Status" value={item.status} />
                <Field label="Location" value={item.location || "Missing"} />
                <Field label="Purchase Cost" value={item.purchaseCost} type="number" />
                <Field label="Asking Price" value={item.askingPrice} type="number" />
                <Field label="Market Value" value={item.marketValue} type="number" />
                <Field label="Quantity" value={item.quantity} type="number" />
                <Field label="Source" value={item.source} />
                <Field label="AI Confidence" value={`${Math.round(item.aiConfidence * 100)}%`} />
              </div>
            </div>
          </div>

          <section className="mt-5 rounded-lg border border-acv-border bg-acv-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Internal Notes</p>
            <textarea
              defaultValue={item.notes}
              className="mt-3 min-h-28 w-full rounded-md border border-acv-border bg-acv-panel2 p-3 text-sm leading-6 text-acv-text outline-none transition focus:border-acv-teal/60"
            />
          </section>

          <section className="mt-4 rounded-lg border border-acv-border bg-acv-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">SKU Tools</p>
                <p className="mt-1 text-xs text-acv-muted">Mock-only controls for SKU discipline and future eBay custom label sync.</p>
              </div>
              <StatusPill tone={item.status === "Listed" ? "gold" : "purple"}>{item.status === "Listed" ? "Listed item" : "Internal only"}</StatusPill>
            </div>
            <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-3">
              <MiniActionButton tone="teal">
                <ShieldCheck className="h-3.5 w-3.5" />
                Check uniqueness
              </MiniActionButton>
              <MiniActionButton>
                <History className="h-3.5 w-3.5" />
                View history
              </MiniActionButton>
              <MiniActionButton tone={item.status === "Listed" ? "gold" : "neutral"}>
                <Send className="h-3.5 w-3.5" />
                Stage SKU to eBay
              </MiniActionButton>
            </div>
          </section>
        </div>

        <div className="grid gap-2 border-t border-acv-border bg-black/70 p-4 sm:grid-cols-5">
          <MiniActionButton tone="teal" onClick={() => onMockSave(item.sku)}>
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </MiniActionButton>
          <MiniActionButton>
            <CircleSendIcon />
            Send to Pricing
          </MiniActionButton>
          <MiniActionButton tone="gold">
            <FileClock className="h-3.5 w-3.5" />
            Send to Draft
          </MiniActionButton>
          <MiniActionButton tone="teal">
            <Tag className="h-3.5 w-3.5" />
            Mark Listed
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

function CircleSendIcon() {
  return <Send className="h-3.5 w-3.5" />;
}

export default function InventoryPage() {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [confidenceFilter, setConfidenceFilter] = useState("All");
  const [listingFilter, setListingFilter] = useState("All");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const filteredRows = useMemo(() => {
    return inventoryItems.filter((item) => {
      const haystack = `${item.sku} ${item.name} ${item.category} ${item.brandSet} ${item.parallel} ${item.cardNumber}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
      const matchesLocation = locationFilter === "All" || (item.location || "Missing") === locationFilter;
      const matchesSource = sourceFilter === "All" || item.source === sourceFilter;
      const matchesConfidence = confidenceFilter === "All" || confidenceBand(item.aiConfidence) === confidenceFilter;
      const matchesListing =
        listingFilter === "All" ||
        (listingFilter === "Listed" && item.status === "Listed") ||
        (listingFilter === "Unlisted" && item.status !== "Listed");
      const matchesReview = !needsReviewOnly || ["Needs Review", "Needs Pricing"].includes(item.status) || item.aiConfidence < 0.75;
      return matchesQuery && matchesStatus && matchesCategory && matchesLocation && matchesSource && matchesConfidence && matchesListing && matchesReview;
    });
  }, [categoryFilter, confidenceFilter, listingFilter, locationFilter, needsReviewOnly, query, sourceFilter, statusFilter]);

  const health = {
    missingSku: 0,
    duplicateSku: 1,
    missingLocation: inventoryItems.filter((item) => !item.location).length,
    missingPurchaseCost: inventoryItems.filter((item) => item.purchaseCost === 0).length,
    lowConfidence: inventoryItems.filter((item) => item.aiConfidence < 0.75).length,
    needsReview: inventoryItems.filter((item) => item.status === "Needs Review").length
  };

  const vaultValue = inventoryItems.reduce((total, item) => total + item.marketValue * item.quantity, 0);

  function mockSave(sku: string) {
    setSaveMessage(`${sku || "Inventory item"} saved locally in mock mode.`);
  }

  return (
    <>
      <PageHeader
        title="Inventory Workstation"
        description="Source-of-truth command center for cards and collectibles before pricing, drafts, listings, sales, and shipping."
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
            ["Total SKUs", String(inventoryItems.length), "text-acv-text"],
            ["Listed", String(inventoryItems.filter((item) => item.status === "Listed").length), "text-acv-teal"],
            ["Needs Review", String(inventoryItems.filter((item) => item.status === "Needs Review").length), "text-acv-pink"],
            ["Needs Pricing", String(inventoryItems.filter((item) => item.status === "Needs Pricing").length), "text-acv-pink"],
            ["Ready for Draft", String(inventoryItems.filter((item) => item.status === "Ready for Draft").length), "text-acv-gold"],
            ["Vault Value", formatCurrency(vaultValue), "text-acv-green"]
          ].map(([label, value, color]) => (
            <div key={label} className="min-w-0 rounded-lg border border-acv-border bg-acv-panel px-3 py-2.5">
              <p className="truncate text-[11px] uppercase tracking-[0.12em] text-acv-muted">{label}</p>
              <p className={cn("mt-1 truncate text-xl font-semibold", color)}>{value}</p>
            </div>
          ))}
        </div>

        <SectionCard title="Filters and Search" eyebrow="Narrow source records" action={<StatusPill tone="teal">{filteredRows.length} visible</StatusPill>}>
          <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            <label className="min-w-0 sm:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Search</span>
              <div className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-acv-border bg-acv-panel2 px-3">
                <Search className="h-4 w-4 shrink-0 text-acv-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="SKU, player, set, card #"
                  className="min-w-0 flex-1 bg-transparent text-xs text-acv-text outline-none placeholder:text-acv-muted"
                />
              </div>
            </label>
            <FilterSelect label="Status" value={statusFilter} options={["All", ...uniqueValues("status")]} onChange={setStatusFilter} />
            <FilterSelect label="Category" value={categoryFilter} options={["All", ...uniqueValues("category")]} onChange={setCategoryFilter} />
            <FilterSelect label="Location" value={locationFilter} options={["All", ...uniqueValues("location")]} onChange={setLocationFilter} />
            <FilterSelect label="Source" value={sourceFilter} options={["All", ...uniqueValues("source")]} onChange={setSourceFilter} />
            <FilterSelect label="Confidence" value={confidenceFilter} options={["All", "Low", "Medium", "High"]} onChange={setConfidenceFilter} />
            <FilterSelect label="Listed" value={listingFilter} options={["All", "Listed", "Unlisted"]} onChange={setListingFilter} />
            <label className="flex min-w-0 items-end">
              <button
                type="button"
                onClick={() => setNeedsReviewOnly((value) => !value)}
                className={cn(
                  "flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition",
                  needsReviewOnly
                    ? "border-acv-pink/45 bg-acv-pink/10 text-acv-pink"
                    : "border-acv-border bg-acv-panel2 text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal"
                )}
              >
                <Filter className="h-4 w-4" />
                Needs review
              </button>
            </label>
          </div>
        </SectionCard>

        {saveMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-acv-teal/35 bg-acv-teal/10 px-4 py-3 text-sm font-semibold text-acv-teal">
            <CheckCircle2 className="h-4 w-4" />
            {saveMessage}
          </div>
        )}

        <SectionCard title="Source of Truth Inventory Table" eyebrow="ACV-owned records" action={<StatusPill tone="gold">Mock data only</StatusPill>}>
          <DataTable<InventoryItem>
            rows={filteredRows}
            getRowKey={(row) => row.id}
            onRowClick={(row) => setSelectedItem(row)}
            columns={[
              {
                key: "image",
                header: "Image",
                cell: (row) => <CardImageTile label={row.name} category={row.category} />
              },
              { key: "sku", header: "SKU", cell: (row) => <span className="font-semibold text-acv-gold">{row.sku || "Missing"}</span> },
              { key: "name", header: "Card Name", cell: (row) => <span className="line-clamp-1 min-w-64">{row.name}</span> },
              { key: "category", header: "Category", cell: (row) => row.category },
              { key: "year", header: "Year", cell: (row) => row.year },
              { key: "brandSet", header: "Brand / Set", cell: (row) => <span className="line-clamp-1 min-w-44">{row.brandSet}</span> },
              { key: "parallel", header: "Parallel", cell: (row) => row.parallel },
              { key: "cardNumber", header: "Card #", cell: (row) => row.cardNumber },
              { key: "serialNumber", header: "Serial #", cell: (row) => row.serialNumber },
              { key: "status", header: "Status", cell: (row) => <StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill> },
              { key: "location", header: "Location", cell: (row) => <span className={row.location ? "" : "font-semibold text-acv-pink"}>{row.location || "Missing"}</span> },
              { key: "cost", header: "Cost", cell: (row) => <span className={row.purchaseCost ? "text-acv-pink" : "font-semibold text-acv-pink"}>{row.purchaseCost ? formatCurrency(row.purchaseCost) : "Missing"}</span> },
              { key: "ask", header: "Ask", cell: (row) => (row.askingPrice ? <span className="text-acv-gold">{formatCurrency(row.askingPrice)}</span> : "-") },
              { key: "market", header: "Market", cell: (row) => <span className="font-semibold text-acv-green">{formatCurrency(row.marketValue)}</span> },
              { key: "qty", header: "Qty", cell: (row) => row.quantity },
              { key: "source", header: "Source", cell: (row) => row.source },
              {
                key: "confidence",
                header: "Confidence",
                cell: (row) => (
                  <span className={row.aiConfidence < 0.75 ? "font-semibold text-acv-pink" : row.aiConfidence < 0.9 ? "text-acv-gold" : "text-acv-teal"}>
                    {formatPercent(row.aiConfidence)}
                  </span>
                )
              },
              { key: "lastUpdated", header: "Last Updated", cell: (row) => <span className="whitespace-nowrap text-acv-muted">{row.lastUpdated}</span> },
              {
                key: "actions",
                header: "Actions",
                cell: (row) => (
                  <button
                    type="button"
                    title="Edit inventory item"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedItem(row);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-acv-border text-acv-muted hover:text-acv-teal"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )
              }
            ]}
          />
        </SectionCard>

        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <SectionCard title="Inventory Health" eyebrow="Data quality">
            <div className="grid min-w-0 gap-2 text-xs">
              {[
                ["Missing SKU count", health.missingSku, "teal"],
                ["Duplicate SKU count", health.duplicateSku, "pink"],
                ["Missing location count", health.missingLocation, "pink"],
                ["Missing purchase cost count", health.missingPurchaseCost, "pink"],
                ["Low-confidence AI records", health.lowConfidence, "gold"],
                ["Cards needing review", health.needsReview, "pink"]
              ].map(([label, value, tone]) => (
                <div key={label} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <span className="truncate text-acv-muted">{label}</span>
                  <StatusPill tone={tone as "teal" | "gold" | "pink"}>{value}</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="SKU Tools" eyebrow="Discipline">
            <div className="space-y-3">
              <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                <MiniActionButton tone="teal">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Check uniqueness
                </MiniActionButton>
                <MiniActionButton>
                  <History className="h-3.5 w-3.5" />
                  View history
                </MiniActionButton>
                <MiniActionButton tone="gold">
                  <Send className="h-3.5 w-3.5" />
                  Stage SKU to eBay
                </MiniActionButton>
              </div>
              <div className="rounded-md border border-acv-border bg-acv-panel2 p-3 text-xs leading-5 text-acv-muted">
                SKU changes are logged in mock mode and future eBay custom label pushes stay behind confirmation gates.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {selectedItem && <InventoryEditDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onMockSave={mockSave} />}
    </>
  );
}
