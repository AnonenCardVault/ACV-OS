import { ArrowUpRight, CheckCircle2, Plus, RefreshCcw, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { aiStaff, dashboardMetrics, inventoryItems, salesRows, workflowQueues } from "@/data/mock";
import { formatCurrency, formatPercent } from "@/lib/utils";

type SaleRow = (typeof salesRows)[number];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily command center for intake, pricing, listing, sales, shipping, and profit focus."
        status="Today"
        action={<ActionButton icon={<Plus className="h-4 w-4" />}>New inventory</ActionButton>}
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone as "gold" | "green" | "pink" | "teal" | "purple"}
            />
          ))}
        </div>

        <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard
            eyebrow="Today's Priority"
            title="High-value listing flow"
            action={<StatusPill tone="teal">86 ready</StatusPill>}
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-acv-purple/35 bg-acv-purple/10 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-acv-muted">Next action</p>
                <p className="mt-2 text-lg font-semibold text-acv-text">Price top 12 unlisted cards</p>
                <p className="mt-2 text-xs leading-5 text-acv-muted">
                  Prioritize items above $50 market value with AI confidence above 80%.
                </p>
              </div>
              <div className="rounded-md border border-acv-gold/30 bg-acv-gold/10 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-acv-muted">Revenue watch</p>
                <p className="mt-2 text-lg font-semibold text-acv-gold">$1,420 stale value</p>
                <p className="mt-2 text-xs leading-5 text-acv-muted">22 listings have crossed the 30 day review mark.</p>
              </div>
              <div className="rounded-md border border-acv-teal/30 bg-acv-teal/10 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-acv-muted">Sync posture</p>
                <p className="mt-2 text-lg font-semibold text-acv-teal">Staged updates only</p>
                <p className="mt-2 text-xs leading-5 text-acv-muted">SKU, price, quantity, and drift checks are mocked.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Workflow Queues" action={<ActionButton variant="ghost" icon={<RefreshCcw className="h-4 w-4" />}>Refresh</ActionButton>}>
            <div className="grid grid-cols-2 gap-3">
              {workflowQueues.map((queue) => (
                <div key={queue.label} className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-acv-muted">{queue.label}</p>
                    <StatusPill tone={queue.status === "Pick today" ? "pink" : "purple"}>{queue.status}</StatusPill>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-acv-text">{queue.count}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <SectionCard title="Sales Snapshot" eyebrow="Profit pulse">
            <DataTable<SaleRow>
              rows={salesRows}
              getRowKey={(row) => row.id}
              columns={[
                { key: "id", header: "Sale", cell: (row) => <span className="font-semibold text-acv-gold">{row.id}</span> },
                { key: "sku", header: "SKU", cell: (row) => row.sku },
                { key: "title", header: "Item", cell: (row) => <span className="line-clamp-1 min-w-56">{row.title}</span> },
                { key: "price", header: "Sale", cell: (row) => formatCurrency(row.salePrice) },
                {
                  key: "profit",
                  header: "Net Profit",
                  cell: (row) => (
                    <span className={row.netProfit >= 0 ? "font-semibold text-acv-green" : "font-semibold text-acv-pink"}>
                      {formatCurrency(row.netProfit)}
                    </span>
                  )
                },
                {
                  key: "roi",
                  header: "ROI",
                  cell: (row) => (
                    <span className={row.roi >= 0 ? "text-acv-green" : "text-acv-pink"}>{formatPercent(row.roi)}</span>
                  )
                }
              ]}
            />
          </SectionCard>

          <div className="space-y-4">
            <SectionCard title="Inventory Health">
              <div className="space-y-3">
                {inventoryItems.slice(0, 4).map((item) => (
                  <div key={item.sku} className="flex items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-acv-text">{item.name}</p>
                      <p className="mt-1 text-xs text-acv-muted">{item.sku}</p>
                    </div>
                    <StatusPill tone={item.status === "Needs Pricing" || item.status === "Needs Review" ? "pink" : "teal"}>
                      {item.status}
                    </StatusPill>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="AI Staff Activity">
              <div className="space-y-3">
                {aiStaff.slice(0, 4).map((staff) => (
                  <div key={staff.role} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-acv-teal" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-acv-text">{staff.role}</p>
                      <p className="text-xs text-acv-muted">{staff.output}</p>
                    </div>
                    <span className="text-xs font-semibold text-acv-green">{formatPercent(staff.confidence)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard title="Quick Actions" eyebrow="Operations">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["Upload photos", "Approve pricing", "Review listing drift", "Build weekly report"].map((label) => (
              <button
                key={label}
                type="button"
                className="flex h-16 items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-4 text-left text-sm font-semibold text-acv-text transition hover:border-acv-teal/45 hover:text-acv-teal"
              >
                {label}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-acv-muted">
            <ShieldCheck className="h-4 w-4 text-acv-gold" />
            High-risk marketplace changes stay behind confirmation gates.
          </div>
        </SectionCard>
      </div>
    </>
  );
}
