import { AlertTriangle, FileText, RefreshCcw, Send } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { listingRows } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";

type ListingRow = (typeof listingRows)[number];

export default function ListingsPage() {
  return (
    <>
      <PageHeader
        title="Listings"
        description="Draft preparation and active marketplace monitoring with staged SKU, price, quantity, title, and description updates."
        action={<ActionButton icon={<Send className="h-4 w-4" />}>Stage update</ActionButton>}
      />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard title="Draft Builder" eyebrow="Listing drafts">
            <div className="space-y-3">
              {["Title generation", "Description generation", "AEO paragraph", "Photo review", "Item specifics checklist"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-sm">
                  <span>{item}</span>
                  <StatusPill tone="purple">Draft</StatusPill>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Marketplace Drift" eyebrow="eBay placeholder">
            <div className="space-y-3">
              <div className="rounded-md border border-acv-gold/30 bg-acv-gold/10 p-3">
                <div className="flex items-center gap-2 text-acv-gold">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm font-semibold">2 staged drift checks</p>
                </div>
                <p className="mt-2 text-xs text-acv-muted">Price and SKU checks are mock-only until sync is connected.</p>
              </div>
              <ActionButton variant="ghost" icon={<RefreshCcw className="h-4 w-4" />} className="w-full">Mock sync review</ActionButton>
            </div>
          </SectionCard>

          <SectionCard title="Confirmation Gates" eyebrow="Safety">
            <div className="space-y-2 text-xs">
              {["Update SKU/custom label", "Revise price", "Revise quantity", "Revise title/description", "End listing"].map((item) => (
                <div key={item} className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-acv-muted">
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Listing Monitor" eyebrow="Active and draft listings">
          <DataTable<ListingRow>
            rows={listingRows}
            getRowKey={(row) => row.sku}
            columns={[
              { key: "sku", header: "SKU", cell: (row) => <span className="font-semibold text-acv-gold">{row.sku}</span> },
              { key: "title", header: "Title", cell: (row) => <span className="line-clamp-1 min-w-96">{row.title}</span> },
              { key: "status", header: "Status", cell: (row) => <StatusPill tone={row.status === "Active" ? "teal" : "purple"}>{row.status}</StatusPill> },
              { key: "price", header: "Price", cell: (row) => formatCurrency(row.price) },
              { key: "qty", header: "Qty", cell: (row) => row.quantity },
              { key: "watchers", header: "Watchers", cell: (row) => row.watchers },
              { key: "views", header: "Views", cell: (row) => row.views },
              {
                key: "drift",
                header: "Drift",
                cell: (row) => <StatusPill tone={row.drift === "In sync" ? "teal" : row.drift === "Price drift" ? "pink" : "gold"}>{row.drift}</StatusPill>
              },
              { key: "sync", header: "Last Sync", cell: (row) => row.lastSync },
              {
                key: "actions",
                header: "Actions",
                cell: () => <FileText className="h-4 w-4 text-acv-muted" />
              }
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
