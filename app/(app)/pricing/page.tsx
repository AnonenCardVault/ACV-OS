"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Check, ExternalLink, RefreshCcw, TrendingDown, TrendingUp, X } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { pricingActiveListings, pricingSoldComps } from "@/data/mock";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

type SoldCompRow = (typeof pricingSoldComps)[number];
type ActiveListingRow = (typeof pricingActiveListings)[number];
type PricingColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};
type PricingDrawerItem = { kind: "sold"; row: SoldCompRow } | { kind: "active"; row: ActiveListingRow };

const SOLD_COMP_TARGET = 5;
const currentAsk = 129.99;
const marketEstimate = 128;
const pricingConfidence = 0.84;
const dateRangeOptions = ["7 days", "14 days", "30 days", "60 days", "90 days", "180 days", "365 days", "Custom"];
const graderOptions = ["All", "Raw", "PSA", "SGC", "BGS", "CGC", "Other"];
const gradeOptions = ["All", "Raw", "10", "9.5", "9", "8.5", "8", "7", "6", "5", "Other"];
const soldSaleTypeOptions = ["All", "Auction", "Buy It Now", "Best Offer"];
const activeListingTypeOptions = ["All", "BIN", "Auction", "Best Offer"];
const priceRangeOptions = ["All", "Under Market", "Near Market", "Over Market"];
const chartRangeOptions = ["7", "14", "30", "60", "90", "180", "365"];

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getSourceTone(source: string): "teal" | "gold" | "purple" | "neutral" {
  if (source.toLowerCase().includes("manual")) {
    return "purple";
  }

  return source.toLowerCase().includes("card ladder") ? "neutral" : "teal";
}

function getRangeDays(value: string) {
  if (value === "Custom") {
    return 365;
  }

  return Number.parseInt(value, 10);
}

function getPriceRange(askingPrice: number) {
  if (askingPrice < marketEstimate * 0.95) {
    return "Under Market";
  }

  if (askingPrice > marketEstimate * 1.05) {
    return "Over Market";
  }

  return "Near Market";
}

function getGraderFromGrade(grade: string) {
  if (grade === "Raw") return "Raw";
  const grader = grade.split(" ")[0];
  if (["PSA", "SGC", "BGS", "CGC"].includes(grader)) return grader;
  return "Other";
}

function getGradeValue(grade: string) {
  if (grade === "Raw") return "Raw";
  const match = grade.match(/(10|9\.5|9|8\.5|8|7|6|5)/);
  return match?.[0] || "Other";
}

function getDrawerPrice(item: PricingDrawerItem) {
  return item.kind === "sold" ? item.row.soldPrice : item.row.askingPrice;
}

function getDrawerTiming(item: PricingDrawerItem) {
  return item.kind === "sold" ? item.row.saleDate : item.row.timeLeftOrAge;
}

function getDrawerListingType(item: PricingDrawerItem) {
  return item.kind === "sold" ? item.row.saleType : item.row.listingType;
}

function isGraded(grade: string) {
  return grade !== "Raw";
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
    <label className="flex min-w-[118px] flex-1 items-center gap-2 rounded-md border border-acv-border bg-acv-panel2 px-2 py-1.5 text-[11px] text-acv-muted">
      <span className="shrink-0 font-semibold uppercase tracking-[0.08em]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-acv-text outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-acv-panel text-acv-text">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function OpenLinkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex h-7 max-w-full items-center justify-center gap-1 rounded-md border border-acv-teal/30 bg-acv-teal/10 px-2 text-[11px] font-semibold text-acv-teal transition hover:bg-acv-teal/15"
    >
      <ExternalLink className="h-3 w-3 shrink-0" />
      <span className="truncate">Open</span>
    </button>
  );
}

function PricingScrollTable<T>({
  rows,
  columns,
  getRowKey,
  onRowClick,
  className
}: {
  rows: T[];
  columns: Array<PricingColumn<T>>;
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("acv-scrollbar max-h-64 overflow-x-hidden overflow-y-auto rounded-md border border-acv-border/70", className)}>
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[11px]">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "sticky top-0 z-10 overflow-hidden border-b border-acv-border bg-acv-panel2 px-2 py-2 align-bottom font-semibold uppercase leading-3 tracking-[0.07em] text-acv-muted",
                  column.className
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(event) => {
                if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
              className={cn("group", onRowClick && "cursor-pointer outline-none focus-visible:bg-white/[0.04]")}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "overflow-hidden border-b border-acv-border/70 px-2 py-2 align-middle text-acv-text group-hover:bg-white/[0.025]",
                    column.className
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PriceTrendMock() {
  const [range, setRange] = useState("30");

  return (
    <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Price trend</p>
          <p className="mt-1 text-xs text-acv-muted">Mock sparkline placeholder</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {chartRangeOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={cn(
                "h-7 rounded-md border px-2 text-[11px] font-semibold transition",
                range === option ? "border-acv-teal/50 bg-acv-teal/15 text-acv-teal" : "border-acv-border bg-white/[0.03] text-acv-muted hover:text-acv-text"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-32 rounded-md border border-acv-border/80 bg-acv-black/40 p-3">
        <svg viewBox="0 0 320 112" className="h-full w-full" role="img" aria-label={`Mock ${range} day price trend`}>
          <path d="M0 92H320" stroke="rgba(157,163,184,0.2)" />
          <path d="M0 58H320" stroke="rgba(157,163,184,0.14)" />
          <path d="M0 24H320" stroke="rgba(157,163,184,0.1)" />
          <polyline
            points="0,78 34,70 72,82 106,54 142,61 178,38 214,44 250,30 286,42 320,24"
            fill="none"
            stroke="#26d4c7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <polyline
            points="0,88 34,79 72,86 106,66 142,72 178,56 214,61 250,49 286,54 320,43"
            fill="none"
            stroke="#f2b84b"
            strokeDasharray="8 8"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
}

function PricingQuickList({
  title,
  rows,
  priceLabel
}: {
  title: string;
  rows: Array<{ title: string; price: number; meta: string }>;
  priceLabel: string;
}) {
  return (
    <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={`${title}-${row.title}-${row.meta}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border border-acv-border/70 bg-acv-black/30 px-3 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold text-acv-text">{row.title}</p>
              <p className="mt-0.5 text-[11px] text-acv-muted">{row.meta}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-acv-green">{formatCurrency(row.price)}</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-acv-muted">{priceLabel}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center rounded-md border border-acv-teal/30 bg-acv-teal/10 px-2 text-[11px] font-semibold text-acv-teal"
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingDetailDrawer({ item, onClose }: { item: PricingDrawerItem; onClose: () => void }) {
  const title = item.row.title;
  const source = item.row.source;
  const price = getDrawerPrice(item);
  const timing = getDrawerTiming(item);
  const listingType = getDrawerListingType(item);
  const grade = item.row.grade;
  const isSold = item.kind === "sold";
  const totalPrice = price + 4.99;
  const quickSoldRows = pricingSoldComps.slice(0, 4).map((row) => ({ title: row.title, price: row.soldPrice, meta: `${row.saleDate} / ${row.grade}` }));
  const quickActiveRows = pricingActiveListings.slice(0, 4).map((row) => ({ title: row.title, price: row.askingPrice, meta: `${row.timeLeftOrAge} / ${row.grade}` }));

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm sm:left-56">
      <aside className="flex h-full w-full max-w-3xl flex-col border-l border-acv-border bg-acv-panel shadow-glow">
        <div className="border-b border-acv-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={getSourceTone(source)}>{source}</StatusPill>
                <StatusPill tone={isSold ? "green" : "teal"}>{isSold ? "Sold Comp" : "Active Listing"}</StatusPill>
                <StatusPill tone="gold">{grade}</StatusPill>
              </div>
              <h2 className="mt-3 line-clamp-2 text-lg font-semibold text-acv-text">{title}</h2>
              <p className="mt-1 text-xs text-acv-muted">Pricing detail prototype / mock only</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-acv-border bg-white/[0.03] text-acv-muted transition hover:text-acv-text"
              aria-label="Close pricing detail"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="acv-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="flex aspect-[3/4] items-center justify-center rounded-md border border-acv-border bg-gradient-to-br from-acv-purple/20 via-acv-panel2 to-acv-gold/10">
                <div className="text-center">
                  <p className="text-xl font-black text-acv-gold">ACV</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-acv-muted">Image placeholder</p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-acv-teal/40 bg-acv-teal text-xs font-semibold text-black transition hover:bg-cyan-200"
              >
                <ExternalLink className="h-4 w-4" />
                Open Listing
              </button>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  [isSold ? "Sold Price" : "Asking Price", formatCurrency(price), isSold ? "text-acv-green" : "text-acv-gold"],
                  [isSold ? "Sale Date" : "Listed Age / Time Left", timing, "text-acv-text"],
                  ["Listing Type", listingType, "text-acv-text"],
                  ["Seller", "Mock seller", "text-acv-muted"],
                  ["Shipping", "$4.99 mock", "text-acv-muted"],
                  ["Total Price", formatCurrency(totalPrice), "text-acv-teal"]
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-acv-muted">{label}</p>
                    <p className={cn("mt-1 truncate text-sm font-semibold", tone)}>{value}</p>
                  </div>
                ))}
              </div>

              <PriceTrendMock />

              <div className="grid gap-4 xl:grid-cols-2">
                <PricingQuickList title="Completed sales quick list" rows={quickSoldRows} priceLabel="sold" />
                <PricingQuickList title="Active listings quick list" rows={quickActiveRows} priceLabel="ask" />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">Card details</p>
                  <div className="mt-3 grid gap-2 text-xs">
                    {[
                      ["Player", "CJ Stroud"],
                      ["Set", "2023 Panini Prizm"],
                      ["Parallel", "Silver"],
                      ["Card #", "339"],
                      ["Notes", "Placeholder for future global card drawer fields"]
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-acv-border/70 bg-acv-black/30 px-3 py-2">
                        <span className="text-acv-muted">{label}</span>
                        <span className="truncate font-semibold text-acv-text">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-acv-gold">PSA pop report</p>
                  <div className="mt-3 rounded-md border border-acv-border/70 bg-acv-black/30 px-3 py-3 text-xs leading-5 text-acv-muted">
                    {isGraded(grade)
                      ? `${grade} population placeholder. Future data can show total graded, grade-specific pop, and recent grade velocity.`
                      : "No pop report for raw cards. This space is reserved for graded cards."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function PricingPage() {
  const [soldDateRange, setSoldDateRange] = useState("90 days");
  const [soldGrader, setSoldGrader] = useState("All");
  const [soldGrade, setSoldGrade] = useState("All");
  const [soldSaleType, setSoldSaleType] = useState("All");
  const [activeGrader, setActiveGrader] = useState("All");
  const [activeGrade, setActiveGrade] = useState("All");
  const [activeListingType, setActiveListingType] = useState("All");
  const [activePriceRange, setActivePriceRange] = useState("All");
  const [drawerItem, setDrawerItem] = useState<PricingDrawerItem | null>(null);
  const soldPrices = pricingSoldComps.map((comp) => comp.soldPrice);
  const soldLow = Math.min(...soldPrices);
  const soldMedian = getMedian(soldPrices);
  const soldHigh = Math.max(...soldPrices);
  const sourceMix = ["eBay", "Card Ladder", "COMC", "Manual"].join(" / ");
  const filteredSoldComps = useMemo(
    () =>
      pricingSoldComps.filter((row) => {
        const matchesDate = row.daysAgo <= getRangeDays(soldDateRange);
        const matchesGrader = soldGrader === "All" || getGraderFromGrade(row.grade) === soldGrader;
        const matchesGrade = soldGrade === "All" || getGradeValue(row.grade) === soldGrade;
        const matchesSaleType = soldSaleType === "All" || row.saleType === soldSaleType;

        return matchesDate && matchesGrader && matchesGrade && matchesSaleType;
      }),
    [soldDateRange, soldGrader, soldGrade, soldSaleType]
  );
  const filteredActiveListings = useMemo(
    () =>
      pricingActiveListings.filter((row) => {
        const matchesGrader = activeGrader === "All" || getGraderFromGrade(row.grade) === activeGrader;
        const matchesGrade = activeGrade === "All" || getGradeValue(row.grade) === activeGrade;
        const matchesListingType = activeListingType === "All" || row.listingType === activeListingType;
        const matchesPriceRange = activePriceRange === "All" || getPriceRange(row.askingPrice) === activePriceRange;

        return matchesGrader && matchesGrade && matchesListingType && matchesPriceRange;
      }),
    [activeGrader, activeGrade, activeListingType, activePriceRange]
  );

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Workbench for comps, market estimates, confidence, AI price recommendations, and approval gates."
        action={<ActionButton icon={<Check className="h-4 w-4" />}>Approve price</ActionButton>}
      />
      <div className="grid min-w-0 gap-4 p-4 md:p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Selected Card" eyebrow="Pricing case">
            <div className="rounded-md border border-acv-border bg-gradient-to-br from-acv-purple/20 via-acv-panel2 to-acv-gold/10 p-4">
              <p className="text-lg font-semibold text-acv-text">2023 Prizm CJ Stroud Silver Rookie</p>
              <p className="mt-1 text-xs text-acv-muted">ACV-NFL-000421</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-acv-muted">Current ask</p>
                  <p className="text-xl font-semibold text-acv-gold">{formatCurrency(currentAsk)}</p>
                </div>
                <div>
                  <p className="text-xs text-acv-muted">Market est.</p>
                  <p className="text-xl font-semibold text-acv-green">{formatCurrency(marketEstimate)}</p>
                </div>
                <div>
                  <p className="text-xs text-acv-muted">Sold low / median / high</p>
                  <p className="text-sm font-semibold text-acv-text">
                    {formatCurrency(soldLow)} / {formatCurrency(soldMedian)} / {formatCurrency(soldHigh)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-acv-muted">Confidence</p>
                  <p className="text-sm font-semibold text-acv-teal">{formatPercent(pricingConfidence)}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[
                ["Recommendation", "Keep price", "teal"],
                ["Source mix", sourceMix, "purple"],
                ["Last updated", "Mock timestamp", "gold"]
              ].map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs">
                  <span className="shrink-0 text-acv-muted">{label}</span>
                  <StatusPill tone={tone as "teal" | "purple" | "gold"} className="min-w-0 max-w-48 truncate">
                    {value}
                  </StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="AI Recommendation">
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-1 h-5 w-5 text-acv-green" />
              <div>
                <p className="text-sm font-semibold text-acv-text">Hold at $129.99</p>
                <p className="mt-2 text-xs leading-5 text-acv-muted">
                  Strong watch activity and recent sold comps support the current ask.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Risk Notes">
            <div className="flex items-start gap-3">
              <TrendingDown className="mt-1 h-5 w-5 text-acv-pink" />
              <div>
                <p className="text-sm font-semibold text-acv-text">Review if no sale in 7 days</p>
                <p className="mt-2 text-xs leading-5 text-acv-muted">
                  Competition below $115 could trigger a lower-price recommendation.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard
            title="Completed Sales / Sold Comps"
            eyebrow="Completed sales / target 5+ / mock 12-month lookback"
            action={<ActionButton variant="ghost" icon={<RefreshCcw className="h-4 w-4" />}>Refresh comps</ActionButton>}
          >
            <div className="mb-3 grid gap-2 md:grid-cols-4">
              <FilterSelect label="Date Range" value={soldDateRange} options={dateRangeOptions} onChange={setSoldDateRange} />
              <FilterSelect label="Grader" value={soldGrader} options={graderOptions} onChange={setSoldGrader} />
              <FilterSelect label="Grade" value={soldGrade} options={gradeOptions} onChange={setSoldGrade} />
              <FilterSelect label="Sale Type" value={soldSaleType} options={soldSaleTypeOptions} onChange={setSoldSaleType} />
            </div>
            <PricingScrollTable<SoldCompRow>
              rows={filteredSoldComps}
              getRowKey={(row) => `${row.source}-${row.title}-${row.saleDate}`}
              onRowClick={(row) => setDrawerItem({ kind: "sold", row })}
              columns={[
                {
                  key: "source",
                  header: "Source",
                  className: "w-[12%]",
                  cell: (row) => (
                    <StatusPill tone={getSourceTone(row.source)} className="max-w-full truncate tracking-[0.04em]">
                      {row.source}
                    </StatusPill>
                  )
                },
                { key: "title", header: "Title", className: "w-[40%]", cell: (row) => <span className="block truncate">{row.title}</span> },
                {
                  key: "soldPrice",
                  header: "Sold Price",
                  className: "w-[13%]",
                  cell: (row) => <span className="block truncate font-semibold text-acv-green">{formatCurrency(row.soldPrice)}</span>
                },
                { key: "saleDate", header: "Sale Date", className: "w-[12%]", cell: (row) => <span className="block truncate">{row.saleDate}</span> },
                { key: "grade", header: "Grade", className: "w-[11%]", cell: (row) => <span className="block truncate">{row.grade}</span> },
                {
                  key: "openLink",
                  header: "Open Link",
                  className: "w-[12%]",
                  cell: (row) => <OpenLinkButton onClick={() => setDrawerItem({ kind: "sold", row })} />
                }
              ]}
            />
            {filteredSoldComps.length < SOLD_COMP_TARGET && (
              <p className="mt-3 rounded-md border border-acv-gold/30 bg-acv-gold/10 px-3 py-2 text-xs font-semibold text-acv-gold">
                Fewer than 5 sold comps found.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Active Listings" eyebrow="Current marketplace supply / mock scan">
            <div className="mb-3 grid gap-2 md:grid-cols-4">
              <FilterSelect label="Grader" value={activeGrader} options={graderOptions} onChange={setActiveGrader} />
              <FilterSelect label="Grade" value={activeGrade} options={gradeOptions} onChange={setActiveGrade} />
              <FilterSelect label="Listing Type" value={activeListingType} options={activeListingTypeOptions} onChange={setActiveListingType} />
              <FilterSelect label="Price Range" value={activePriceRange} options={priceRangeOptions} onChange={setActivePriceRange} />
            </div>
            <PricingScrollTable<ActiveListingRow>
              rows={filteredActiveListings}
              getRowKey={(row) => `${row.source}-${row.title}-${row.timeLeftOrAge}`}
              onRowClick={(row) => setDrawerItem({ kind: "active", row })}
              columns={[
                {
                  key: "source",
                  header: "Source",
                  className: "w-[12%]",
                  cell: (row) => (
                    <StatusPill tone={getSourceTone(row.source)} className="max-w-full truncate tracking-[0.04em]">
                      {row.source}
                    </StatusPill>
                  )
                },
                { key: "title", header: "Title", className: "w-[33%]", cell: (row) => <span className="block truncate">{row.title}</span> },
                {
                  key: "askingPrice",
                  header: "Asking Price",
                  className: "w-[12%]",
                  cell: (row) => <span className="block truncate font-semibold text-acv-gold">{formatCurrency(row.askingPrice)}</span>
                },
                { key: "listingType", header: "Listing Type", className: "w-[11%]", cell: (row) => <span className="block truncate">{row.listingType}</span> },
                { key: "timeLeftOrAge", header: "Time Left / Listed Age", className: "w-[15%]", cell: (row) => <span className="block truncate">{row.timeLeftOrAge}</span> },
                { key: "grade", header: "Grade", className: "w-[9%]", cell: (row) => <span className="block truncate">{row.grade}</span> },
                {
                  key: "openLink",
                  header: "Open Link",
                  className: "w-[10%]",
                  cell: (row) => <OpenLinkButton onClick={() => setDrawerItem({ kind: "active", row })} />
                }
              ]}
            />
          </SectionCard>
        </div>
      </div>
      {drawerItem && <PricingDetailDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />}
    </>
  );
}
