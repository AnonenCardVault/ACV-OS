import { Check, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { recentComps } from "@/data/mock";
import { formatCurrency, formatPercent } from "@/lib/utils";

type CompRow = (typeof recentComps)[number];

export default function PricingPage() {
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
                <p className="text-xl font-semibold text-acv-gold">$129.99</p>
              </div>
              <div>
                <p className="text-xs text-acv-muted">Market est.</p>
                <p className="text-xl font-semibold text-acv-green">$118.00</p>
              </div>
              <div>
                <p className="text-xs text-acv-muted">Low / median / high</p>
                <p className="text-sm font-semibold text-acv-text">$102 / $122 / $148</p>
              </div>
              <div>
                <p className="text-xs text-acv-muted">Confidence</p>
                <p className="text-sm font-semibold text-acv-teal">84%</p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              ["Recommendation", "Keep price", "teal"],
              ["Source mix", "Sold + active + manual", "purple"],
              ["Last updated", "Mock timestamp", "gold"]
            ].map(([label, value, tone]) => (
              <div key={label} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs">
                <span className="text-acv-muted">{label}</span>
                <StatusPill tone={tone as "teal" | "purple" | "gold"}>{value}</StatusPill>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Recent Sales and Active Competition"
            eyebrow="Comps"
            action={<ActionButton variant="ghost" icon={<RefreshCcw className="h-4 w-4" />}>Refresh comps</ActionButton>}
          >
            <DataTable<CompRow>
              rows={recentComps}
              getRowKey={(row) => `${row.source}-${row.title}`}
              columns={[
                { key: "source", header: "Source", cell: (row) => <StatusPill tone={row.source === "Active listing" ? "gold" : "teal"}>{row.source}</StatusPill> },
                { key: "title", header: "Title", cell: (row) => <span className="line-clamp-1 min-w-72">{row.title}</span> },
                { key: "price", header: "Price", cell: (row) => <span className="font-semibold text-acv-green">{formatCurrency(row.price)}</span> },
                { key: "date", header: "Date", cell: (row) => row.date },
                { key: "confidence", header: "Confidence", cell: (row) => formatPercent(row.confidence) }
              ]}
            />
          </SectionCard>

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
