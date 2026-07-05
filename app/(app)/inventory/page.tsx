import { Edit3, Filter, Plus, Upload } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { inventoryItems } from "@/data/mock";
import { formatCurrency, formatPercent } from "@/lib/utils";

type InventoryItem = (typeof inventoryItems)[number];

function statusTone(status: string) {
  if (status === "Listed" || status === "Ready for Draft") return "teal";
  if (status === "Needs Pricing" || status === "Needs Review") return "pink";
  return "purple";
}

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Owned cards and collectibles with SKU discipline, source-of-truth fields, location, pricing, and workflow status."
        action={
          <div className="flex gap-2">
            <ActionButton variant="ghost" icon={<Upload className="h-4 w-4" />}>Import</ActionButton>
            <ActionButton icon={<Plus className="h-4 w-4" />}>Create item</ActionButton>
          </div>
        }
      />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Total SKUs", "1,246", "purple"],
            ["Listed", "624", "teal"],
            ["Needs Review", "42", "pink"],
            ["Vault Value", "$18,420", "gold"]
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-acv-muted">{label}</p>
              <p className={`mt-2 text-2xl font-semibold ${tone === "teal" ? "text-acv-teal" : tone === "pink" ? "text-acv-pink" : tone === "gold" ? "text-acv-gold" : "text-acv-text"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <SectionCard
          title="Inventory Table"
          eyebrow="Source of truth"
          action={<ActionButton variant="ghost" icon={<Filter className="h-4 w-4" />}>Filters</ActionButton>}
        >
          <DataTable<InventoryItem>
            rows={inventoryItems}
            getRowKey={(row) => row.sku}
            columns={[
              {
                key: "image",
                header: "Image",
                cell: (row) => (
                  <div className="flex h-12 w-9 items-center justify-center rounded border border-acv-border bg-gradient-to-br from-acv-purple/30 via-acv-panel2 to-acv-gold/20 text-[10px] font-bold text-acv-gold">
                    {row.category.slice(0, 3).toUpperCase()}
                  </div>
                )
              },
              { key: "sku", header: "SKU", cell: (row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
              { key: "name", header: "Card Name", cell: (row) => <span className="line-clamp-1 min-w-64">{row.name}</span> },
              { key: "category", header: "Category", cell: (row) => row.category },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusPill tone={statusTone(row.status) as "teal" | "pink" | "purple"}>{row.status}</StatusPill>
              },
              { key: "location", header: "Location", cell: (row) => row.location },
              { key: "cost", header: "Cost", cell: (row) => formatCurrency(row.purchaseCost) },
              { key: "ask", header: "Ask", cell: (row) => (row.askingPrice ? formatCurrency(row.askingPrice) : "-") },
              { key: "market", header: "Market", cell: (row) => <span className="text-acv-green">{formatCurrency(row.marketValue)}</span> },
              { key: "qty", header: "Qty", cell: (row) => row.quantity },
              { key: "source", header: "Source", cell: (row) => row.source },
              { key: "ebay", header: "eBay ID", cell: (row) => row.ebayId },
              { key: "days", header: "Days", cell: (row) => row.daysListed },
              { key: "ai", header: "AI Conf.", cell: (row) => formatPercent(row.aiConfidence) },
              {
                key: "actions",
                header: "Actions",
                cell: () => (
                  <button
                    type="button"
                    title="Edit inventory item"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-acv-border text-acv-muted hover:text-acv-teal"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )
              }
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
