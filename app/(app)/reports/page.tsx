import { CalendarDays, Download, LineChart, PieChart, TrendingUp } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";

const reports = [
  ["Weekly business review", "Sales, margin, stale listings, next priorities", "Ready"],
  ["Monthly business review", "Channel profit, expenses, inventory movement", "Draft"],
  ["Inventory health", "Aging, value bands, confidence flags, locations", "Ready"],
  ["Profit by channel", "Platform-level revenue, fees, shipping, net", "Ready"],
  ["Taxes / Schedule C helper", "Categorized expense and income summary", "Draft"],
  ["Active comps health", "Cards missing recent comps or confidence", "Review"]
];

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Business performance, inventory health, channel profit, stale listing review, taxes, and comp coverage."
        action={<ActionButton variant="ghost" icon={<Download className="h-4 w-4" />}>Export report</ActionButton>}
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[1fr_380px]">
        <SectionCard title="Report Library" eyebrow="Performance">
          <div className="grid gap-3 md:grid-cols-2">
            {reports.map(([title, copy, status]) => (
              <button
                key={title}
                type="button"
                className="rounded-lg border border-acv-border bg-acv-panel2 p-4 text-left transition hover:border-acv-teal/45"
              >
                <div className="flex items-start justify-between gap-3">
                  <LineChart className="h-5 w-5 text-acv-teal" />
                  <StatusPill tone={status === "Review" ? "pink" : status === "Draft" ? "gold" : "teal"}>{status}</StatusPill>
                </div>
                <p className="mt-4 text-sm font-semibold text-acv-text">{title}</p>
                <p className="mt-2 text-xs leading-5 text-acv-muted">{copy}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Weekly Snapshot">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-acv-green" />
                <div>
                  <p className="text-sm font-semibold text-acv-green">Profit up 18%</p>
                  <p className="text-xs text-acv-muted">Driven by high-value football listings.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <PieChart className="h-5 w-5 text-acv-gold" />
                <div>
                  <p className="text-sm font-semibold text-acv-gold">42% value in football</p>
                  <p className="text-xs text-acv-muted">Pokemon and TCG are next largest segments.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-acv-pink" />
                <div>
                  <p className="text-sm font-semibold text-acv-pink">22 stale listings</p>
                  <p className="text-xs text-acv-muted">Price review recommended after 30 days.</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
