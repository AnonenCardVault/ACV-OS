import { PackageCheck, Printer, Truck } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { shippingQueue } from "@/data/mock";

type ShippingRow = (typeof shippingQueue)[number];

export default function ShippingPage() {
  return (
    <>
      <PageHeader
        title="Shipping"
        description="Picking, packing, package method recommendations, supply usage, labels, and tracking status."
        action={<ActionButton icon={<Printer className="h-4 w-4" />}>Print pick list</ActionButton>}
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[1fr_360px]">
        <SectionCard title="Shipping Queue" eyebrow="Pick and pack">
          <DataTable<ShippingRow>
            rows={shippingQueue}
            getRowKey={(row) => row.order}
            columns={[
              { key: "order", header: "Order", cell: (row) => <span className="font-semibold text-acv-gold">#{row.order}</span> },
              { key: "sku", header: "SKU", cell: (row) => row.sku },
              { key: "method", header: "Method", cell: (row) => row.method },
              { key: "package", header: "Package", cell: (row) => row.package },
              { key: "status", header: "Status", cell: (row) => <StatusPill tone={row.status === "Pick" ? "pink" : "teal"}>{row.status}</StatusPill> }
            ]}
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Method Guidance">
            <div className="space-y-3">
              {[
                ["PWE", "Low-value singles under internal threshold", "teal"],
                ["Ground Advantage", "Higher value, slabs, lots, and tracked orders", "gold"],
                ["Bubble mailer", "Default protected package path", "purple"]
              ].map(([label, copy, tone]) => (
                <div key={label} className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <StatusPill tone={tone as "teal" | "gold" | "purple"}>{label}</StatusPill>
                  <p className="mt-2 text-xs leading-5 text-acv-muted">{copy}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Supply Burn">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <PackageCheck className="h-5 w-5 text-acv-teal" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-acv-text">Toploaders</p>
                  <div className="mt-2 h-2 rounded-full bg-acv-border">
                    <div className="h-2 w-3/4 rounded-full bg-acv-teal" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-acv-gold" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-acv-text">Rigid mailers</p>
                  <div className="mt-2 h-2 rounded-full bg-acv-border">
                    <div className="h-2 w-2/5 rounded-full bg-acv-gold" />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
