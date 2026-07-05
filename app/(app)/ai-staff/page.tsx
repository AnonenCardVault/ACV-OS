import { BrainCircuit, Play, ShieldAlert } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { aiStaff } from "@/data/mock";
import { formatPercent } from "@/lib/utils";

type StaffRow = (typeof aiStaff)[number];

const specialistRules = [
  "Never guess uncertain card information",
  "Stage AI output before source-of-truth updates",
  "Show confidence and review requirements",
  "Require confirmation for high-risk marketplace actions"
];

export default function AiStaffPage() {
  return (
    <>
      <PageHeader
        title="AI Staff"
        description="AI departments, specialist roles, input/output contracts, task queues, confidence, and review workflows."
        action={<ActionButton icon={<Play className="h-4 w-4" />}>Run mock task</ActionButton>}
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[1fr_360px]">
        <SectionCard title="Specialist Roster" eyebrow="Departments">
          <DataTable<StaffRow>
            rows={aiStaff}
            getRowKey={(row) => row.role}
            columns={[
              { key: "role", header: "Role", cell: (row) => <span className="font-semibold text-acv-text">{row.role}</span> },
              { key: "inputs", header: "Inputs", cell: () => "Inventory, images, comps, sales" },
              { key: "outputs", header: "Outputs", cell: (row) => row.output },
              { key: "queue", header: "Queue", cell: (row) => row.queue },
              { key: "confidence", header: "Confidence", cell: (row) => <span className="text-acv-green">{formatPercent(row.confidence)}</span> },
              { key: "review", header: "Review", cell: (row) => <StatusPill tone={row.status === "Review" ? "pink" : "teal"}>{row.status}</StatusPill> }
            ]}
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Operating Rules" eyebrow="Safety">
            <div className="space-y-3">
              {specialistRules.map((rule) => (
                <div key={rule} className="flex items-start gap-3 rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-acv-gold" />
                  <p className="text-xs leading-5 text-acv-muted">{rule}</p>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Task History">
            <div className="space-y-3">
              {["Priced 24 staged cards", "Flagged 7 uncertain identifications", "Built stale listing review", "Checked SKU uniqueness"].map((task) => (
                <div key={task} className="flex items-center gap-3 text-sm text-acv-text">
                  <BrainCircuit className="h-4 w-4 text-acv-teal" />
                  {task}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
