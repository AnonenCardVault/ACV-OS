import { Plus, ReceiptText } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { expenses } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";

type ExpenseRow = (typeof expenses)[number];

export default function ExpensesPage() {
  return (
    <>
      <PageHeader
        title="Expenses"
        description="Business expenses, supply inventory, reorder thresholds, recurring costs, and cost-per-use assumptions."
        action={<ActionButton icon={<Plus className="h-4 w-4" />}>Log expense</ActionButton>}
      />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Month expenses", "$168.87", "text-acv-pink"],
            ["Supplies on hand", "$412.30", "text-acv-gold"],
            ["Reorder alerts", "2", "text-acv-pink"],
            ["Cost per shipped card", "$1.14", "text-acv-teal"]
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-lg border border-acv-border bg-acv-panel p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-acv-muted">{label}</p>
              <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <SectionCard title="Expense and Supply Ledger" eyebrow="Costs">
          <DataTable<ExpenseRow>
            rows={expenses}
            getRowKey={(row) => `${row.vendor}-${row.category}`}
            columns={[
              { key: "vendor", header: "Vendor", cell: (row) => <span className="font-semibold text-acv-text">{row.vendor}</span> },
              { key: "category", header: "Category", cell: (row) => row.category },
              { key: "amount", header: "Amount", cell: (row) => <span className="font-semibold text-acv-pink">{formatCurrency(row.amount)}</span> },
              { key: "cadence", header: "Cadence", cell: (row) => row.cadence },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusPill tone={row.status === "Low stock" ? "pink" : row.status === "Healthy" ? "teal" : "gold"}>{row.status}</StatusPill>
              },
              { key: "receipt", header: "Receipt", cell: () => <ReceiptText className="h-4 w-4 text-acv-muted" /> }
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
