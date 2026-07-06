import type { ReactNode } from "react";
import { Check, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react";
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

const SOLD_COMP_TARGET = 5;
const currentAsk = 129.99;
const marketEstimate = 128;
const pricingConfidence = 0.84;

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getSourceTone(source: string): "teal" | "gold" | "purple" | "neutral" {
  if (source.toLowerCase().includes("auction")) {
    return "gold";
  }

  if (source.toLowerCase().includes("manual")) {
    return "purple";
  }

  return source.toLowerCase().includes("card ladder") ? "neutral" : "teal";
}

function PricingScrollTable<T>({
  rows,
  columns,
  getRowKey,
  className
}: {
  rows: T[];
  columns: Array<PricingColumn<T>>;
  getRowKey: (row: T) => string;
  className?: string;
}) {
  return (
    <div className={cn("acv-scrollbar max-h-64 overflow-auto rounded-md border border-acv-border/70", className)}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "sticky top-0 z-10 border-b border-acv-border bg-acv-panel2 px-3 py-2 font-semibold uppercase tracking-[0.09em] text-acv-muted",
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
            <tr key={getRowKey(row)} className="group">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "border-b border-acv-border/70 px-3 py-2 align-middle text-acv-text group-hover:bg-white/[0.025]",
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

export default function PricingPage() {
  const soldPrices = pricingSoldComps.map((comp) => comp.soldPrice);
  const soldLow = Math.min(...soldPrices);
  const soldMedian = getMedian(soldPrices);
  const soldHigh = Math.max(...soldPrices);
  const sourceMix = ["eBay", "Terapeak", "Card Ladder", "COMC", "Manual"].join(" / ");

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Workbench for comps, market estimates, confidence, AI price recommendations, and approval gates."
        action={<ActionButton icon={<Check className="h-4 w-4" />}>Approve price</ActionButton>}
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[360px_1fr]">
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
              <div key={label} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs">
                <span className="text-acv-muted">{label}</span>
                <StatusPill tone={tone as "teal" | "purple" | "gold"} className="max-w-48 truncate">
                  {value}
                </StatusPill>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <SectionCard
              title="Sold Comps"
              eyebrow="Completed sales · target 5+ · mock 12-month lookback"
              action={<ActionButton variant="ghost" icon={<RefreshCcw className="h-4 w-4" />}>Refresh comps</ActionButton>}
            >
              <PricingScrollTable<SoldCompRow>
                rows={pricingSoldComps}
                getRowKey={(row) => `${row.source}-${row.title}-${row.saleDate}`}
                columns={[
                  { key: "source", header: "Source", cell: (row) => <StatusPill tone={getSourceTone(row.source)}>{row.source}</StatusPill> },
                  { key: "title", header: "Title", cell: (row) => <span className="line-clamp-1 block min-w-72 max-w-[420px]">{row.title}</span> },
                  { key: "soldPrice", header: "Sold Price", cell: (row) => <span className="font-semibold text-acv-green">{formatCurrency(row.soldPrice)}</span> },
                  { key: "saleDate", header: "Sale Date", cell: (row) => row.saleDate },
                  { key: "condition", header: "Condition", cell: (row) => row.condition },
                  { key: "confidence", header: "Confidence", cell: (row) => <span className="font-semibold text-acv-teal">{formatPercent(row.confidence)}</span> }
                ]}
              />
              {pricingSoldComps.length < SOLD_COMP_TARGET && (
                <p className="mt-3 rounded-md border border-acv-gold/30 bg-acv-gold/10 px-3 py-2 text-xs font-semibold text-acv-gold">
                  Fewer than 5 sold comps found.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Active Listings" eyebrow="Current marketplace supply · mock scan">
              <PricingScrollTable<ActiveListingRow>
                rows={pricingActiveListings}
                getRowKey={(row) => `${row.source}-${row.title}-${row.timeLeftOrAge}`}
                columns={[
                  { key: "source", header: "Source", cell: (row) => <StatusPill tone={getSourceTone(row.source)}>{row.source}</StatusPill> },
                  { key: "title", header: "Title", cell: (row) => <span className="line-clamp-1 block min-w-72 max-w-[420px]">{row.title}</span> },
                  { key: "askingPrice", header: "Asking Price", cell: (row) => <span className="font-semibold text-acv-gold">{formatCurrency(row.askingPrice)}</span> },
                  { key: "listingType", header: "Listing Type", cell: (row) => row.listingType },
                  { key: "timeLeftOrAge", header: "Time Left / Listed Age", cell: (row) => row.timeLeftOrAge },
                  { key: "condition", header: "Condition", cell: (row) => row.condition },
                  { key: "confidence", header: "Confidence", cell: (row) => <span className="font-semibold text-acv-teal">{formatPercent(row.confidence)}</span> }
                ]}
              />
            </SectionCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
        </div>
      </div>
    </>
  );
}
