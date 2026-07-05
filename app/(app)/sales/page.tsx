import { Download, Receipt } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { salesRows } from "@/data/mock";
import { formatCurrency, formatPercent } from "@/lib/utils";

type SaleRow = (typeof salesRows)[number];

export default function SalesPage() {
  return (
    <>
      <PageHeader
        title="Sales"
        description="Completed sales, fees, shipping, supplies, purchase cost, net profit, ROI, and reconciliation status."
        action={<ActionButton variant="ghost" icon={<Download className="h-4 w-4" />}>Export</ActionButton>}
      />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Gross sales", "$203.49", "text-acv-gold"],
            ["Net profit", "$95.22", "text-acv-green"],
            ["Fees", "$28.32", "text-acv-pink"],
            ["Avg ROI", "100%", "text-acv-teal"]
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-acv-muted">{label}</p>
              <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <SectionCard title="Sales History" eyebrow="Reconciliation">
          <DataTable<SaleRow>
            rows={salesRows}
            getRowKey={(row) => row.id}
            columns={[
              { key: "sale", header: "Sale ID", cell: (row) => <span className="font-semibold text-acv-gold">{row.id}</span> },
              { key: "sku", header: "SKU", cell: (row) => row.sku },
              { key: "title", header: "Item Title", cell: (row) => <span className="line-clamp-1 min-w-80">{row.title}</span> },
              { key: "platform", header: "Platform", cell: (row) => row.platform },
              { key: "buyer", header: "Buyer", cell: (row) => row.buyer },
              { key: "salePrice", header: "Sale", cell: (row) => formatCurrency(row.salePrice) },
              { key: "shippingCharged", header: "Ship Chg.", cell: (row) => formatCurrency(row.shippingCharged) },
              { key: "fees", header: "Fees", cell: (row) => <span className="text-acv-pink">{formatCurrency(row.fees)}</span> },
              { key: "shippingCost", header: "Ship Cost", cell: (row) => formatCurrency(row.shippingCost) },
              { key: "suppliesCost", header: "Supplies", cell: (row) => formatCurrency(row.suppliesCost) },
              { key: "purchaseCost", header: "Cost", cell: (row) => formatCurrency(row.purchaseCost) },
              {
                key: "profit",
                header: "Net Profit",
                cell: (row) => (
                  <span className={row.netProfit >= 0 ? "font-semibold text-acv-green" : "font-semibold text-acv-pink"}>
                    {formatCurrency(row.netProfit)}
                  </span>
                )
              },
              { key: "roi", header: "ROI", cell: (row) => <span className={row.roi >= 0 ? "text-acv-green" : "text-acv-pink"}>{formatPercent(row.roi)}</span> },
              { key: "date", header: "Date Sold", cell: (row) => row.dateSold },
              { key: "receipt", header: "Receipt", cell: () => <Receipt className="h-4 w-4 text-acv-muted" /> }
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
