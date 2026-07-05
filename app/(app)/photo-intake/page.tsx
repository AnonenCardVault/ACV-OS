import { Camera, CheckCircle2, ImagePlus, UploadCloud, XCircle } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";

const reviewRows = [
  { batch: "B-072", pair: "Front/back matched", proposed: "2023 Prizm CJ Stroud Silver", confidence: "94%", status: "Approve" },
  { batch: "B-072", pair: "Back missing", proposed: "One Piece OP05 Manga Luffy", confidence: "62%", status: "Needs research" },
  { batch: "B-071", pair: "Possible mismatch", proposed: "1999 Pokemon Base Charizard", confidence: "81%", status: "Review" }
];

type ReviewRow = (typeof reviewRows)[number];

export default function PhotoIntakePage() {
  return (
    <>
      <PageHeader
        title="Photo Intake"
        description="Batch upload, front/back pairing, staged AI extraction, and review queues before inventory records are created."
        action={<ActionButton icon={<ImagePlus className="h-4 w-4" />}>Add batch</ActionButton>}
      />
      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Upload Bay" eyebrow="Images">
          <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-acv-teal/35 bg-acv-teal/5 p-8 text-center">
            <UploadCloud className="h-10 w-10 text-acv-teal" />
            <p className="mt-4 text-lg font-semibold text-acv-text">Drop front and back card images</p>
            <p className="mt-2 max-w-md text-sm text-acv-muted">Mock batch intake with staged pairing and review states.</p>
            <div className="mt-5 flex gap-2">
              <ActionButton icon={<Camera className="h-4 w-4" />}>Upload photos</ActionButton>
              <ActionButton variant="ghost">Open batch</ActionButton>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {["128 photos", "61 pairs", "14 review flags"].map((item) => (
              <div key={item} className="rounded-md border border-acv-border bg-acv-panel2 p-3 text-center text-sm font-semibold text-acv-text">
                {item}
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Pairing Review" eyebrow="Front / back">
            <div className="grid gap-3 md:grid-cols-3">
              {["Front", "Back", "Proposed record"].map((label, index) => (
                <div key={label} className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <p className="mb-3 text-xs uppercase tracking-[0.12em] text-acv-muted">{label}</p>
                  <div className="flex aspect-[3/4] items-center justify-center rounded border border-acv-border bg-gradient-to-br from-acv-purple/20 via-black to-acv-gold/10 text-xs text-acv-muted">
                    {index === 2 ? "SKU pending" : "Mock image"}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="AI Extraction Stage" eyebrow="Never guess">
            <div className="grid gap-2 text-xs md:grid-cols-2">
              {[
                ["Card name", "CJ Stroud Silver Rookie"],
                ["Year / brand", "2023 Panini Prizm"],
                ["Card number", "339"],
                ["Parallel", "Silver"],
                ["Confidence", "94%"],
                ["Uncertainty", "None flagged"]
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
                  <span className="text-acv-muted">{label}</span>
                  <span className="font-semibold text-acv-text">{value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard className="xl:col-span-2" title="Review Queue" eyebrow="Staged records">
          <DataTable<ReviewRow>
            rows={reviewRows}
            getRowKey={(row) => `${row.batch}-${row.proposed}`}
            columns={[
              { key: "batch", header: "Batch", cell: (row) => <span className="font-semibold text-acv-gold">{row.batch}</span> },
              { key: "pair", header: "Pairing", cell: (row) => row.pair },
              { key: "proposed", header: "Proposed Item", cell: (row) => row.proposed },
              { key: "confidence", header: "Confidence", cell: (row) => row.confidence },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusPill tone={row.status === "Approve" ? "teal" : "pink"}>{row.status}</StatusPill>
              },
              {
                key: "actions",
                header: "Actions",
                cell: () => (
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-acv-green" />
                    <XCircle className="h-4 w-4 text-acv-pink" />
                  </div>
                )
              }
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
