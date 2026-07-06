"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileSearch,
  FolderOpen,
  ImagePlus,
  Layers3,
  Move,
  Save,
  Scissors,
  UploadCloud,
  X,
  XCircle
} from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";

type SourceKey = "Computer Upload" | "eBay Active Listings" | "eBay Drafts" | "Future Sources";
type ImageCountMode = "2 images/card" | "3 images/card" | "Custom" | "Auto-detect";
type ImageRole = "Front" | "Back" | "Detail / Closeup" | "Serial Closeup" | "Holo / Surface" | "Auto Closeup" | "Patch / Relic Closeup" | "Other";
type RouteStatus = "Ready to Approve" | "Review" | "Needs Research" | "Blocked";
type QueueStatus = RouteStatus | "Approved Mock" | "Rejected";
type SkuStatus = "Pending Approval" | "SKU Assigned" | "Needs Review";
type StatusTone = "green" | "teal" | "gold" | "pink" | "purple" | "neutral";

type IntakeImage = {
  id: string;
  role: ImageRole;
  label: string;
};

type ProposedRecord = {
  cardName: string;
  playerCharacter: string;
  team: string;
  category: string;
  year: string;
  brand: string;
  set: string;
  cardNumber: string;
  parallel: string;
  serialNumber: string;
  rookieFlag: boolean;
  autoFlag: boolean;
  relicFlag: boolean;
  variationFlag: boolean;
  conditionNotes: string;
  uncertaintyNotes: string;
};

type IntakeGroup = {
  id: string;
  batch: string;
  source: SourceKey;
  images: IntakeImage[];
  pairingStatus: string;
  confidence: number;
  warnings: string[];
  proposed: ProposedRecord;
};

const sourceOptions: Array<{ key: SourceKey; status: string; tone: StatusTone }> = [
  { key: "Computer Upload", status: "Available / mock", tone: "teal" },
  { key: "eBay Active Listings", status: "Planned / mock", tone: "purple" },
  { key: "eBay Drafts", status: "Planned / mock", tone: "purple" },
  { key: "Future Sources", status: "Planned / mock", tone: "gold" }
];

const imageCountModes: ImageCountMode[] = ["2 images/card", "3 images/card", "Custom", "Auto-detect"];

const imageRoles: ImageRole[] = [
  "Front",
  "Back",
  "Detail / Closeup",
  "Serial Closeup",
  "Holo / Surface",
  "Auto Closeup",
  "Patch / Relic Closeup",
  "Other"
];

const mockAssignedSkus: Record<string, string> = {
  "G-001": "ACV-NFL-000421",
  "G-002": "ACV-TCG-000143",
  "G-003": "ACV-POK-000382",
  "G-004": "ACV-MLB-000301"
};

const intakeGroups: IntakeGroup[] = [
  {
    id: "G-001",
    batch: "B-073",
    source: "Computer Upload",
    pairingStatus: "Front/back/detail paired",
    confidence: 94,
    warnings: [],
    images: [
      { id: "img-001-a", role: "Front", label: "CJ front" },
      { id: "img-001-b", role: "Back", label: "CJ back" },
      { id: "img-001-c", role: "Holo / Surface", label: "Silver surface" }
    ],
    proposed: {
      cardName: "2023 Prizm CJ Stroud Silver Rookie",
      playerCharacter: "CJ Stroud",
      team: "Houston Texans",
      category: "Football",
      year: "2023",
      brand: "Panini",
      set: "Prizm",
      cardNumber: "339",
      parallel: "Silver",
      serialNumber: "-",
      rookieFlag: true,
      autoFlag: false,
      relicFlag: false,
      variationFlag: false,
      conditionNotes: "Clean front. Minor edge review complete.",
      uncertaintyNotes: "No uncertainty flagged."
    }
  },
  {
    id: "G-002",
    batch: "B-073",
    source: "Computer Upload",
    pairingStatus: "Back image missing",
    confidence: 62,
    warnings: ["Missing back image", "Card number not confirmed"],
    images: [
      { id: "img-002-a", role: "Front", label: "Luffy front" },
      { id: "img-002-c", role: "Detail / Closeup", label: "Corner crop" }
    ],
    proposed: {
      cardName: "One Piece OP05 Manga Luffy",
      playerCharacter: "Monkey D. Luffy",
      team: "Straw Hat Crew",
      category: "TCG",
      year: "2023",
      brand: "Bandai",
      set: "One Piece OP05",
      cardNumber: "OP05-119",
      parallel: "Manga Rare",
      serialNumber: "-",
      rookieFlag: false,
      autoFlag: false,
      relicFlag: false,
      variationFlag: false,
      conditionNotes: "Needs back image and manual authenticity review.",
      uncertaintyNotes: "AI confidence is low because the back image is missing."
    }
  },
  {
    id: "G-003",
    batch: "B-072",
    source: "Computer Upload",
    pairingStatus: "Possible set variation",
    confidence: 81,
    warnings: ["Holo pattern needs review", "Condition grade not inferred"],
    images: [
      { id: "img-003-a", role: "Front", label: "Charizard front" },
      { id: "img-003-b", role: "Back", label: "Charizard back" },
      { id: "img-003-c", role: "Holo / Surface", label: "Holo closeup" }
    ],
    proposed: {
      cardName: "1999 Pokemon Base Charizard Holo",
      playerCharacter: "Charizard",
      team: "Pokemon",
      category: "Pokemon",
      year: "1999",
      brand: "Wizards of the Coast",
      set: "Pokemon Base Set",
      cardNumber: "4/102",
      parallel: "Holo",
      serialNumber: "-",
      rookieFlag: false,
      autoFlag: false,
      relicFlag: false,
      variationFlag: true,
      conditionNotes: "Back whitening visible. Needs manual condition notes.",
      uncertaintyNotes: "Verify unlimited/shadowless and holo surface."
    }
  },
  {
    id: "G-004",
    batch: "B-072",
    source: "Computer Upload",
    pairingStatus: "Front/back paired",
    confidence: 91,
    warnings: ["Serial area should be checked"],
    images: [
      { id: "img-004-a", role: "Front", label: "Ohtani front" },
      { id: "img-004-b", role: "Back", label: "Ohtani back" },
      { id: "img-004-c", role: "Serial Closeup", label: "Number crop" }
    ],
    proposed: {
      cardName: "2018 Topps Update Shohei Ohtani RC",
      playerCharacter: "Shohei Ohtani",
      team: "Los Angeles Angels",
      category: "Baseball",
      year: "2018",
      brand: "Topps",
      set: "Update",
      cardNumber: "US1",
      parallel: "Base",
      serialNumber: "-",
      rookieFlag: true,
      autoFlag: false,
      relicFlag: false,
      variationFlag: false,
      conditionNotes: "Two-image pair plus serial/detail crop staged.",
      uncertaintyNotes: "Confirm serial crop is needed before listing draft."
    }
  }
];

function statusForGroup(group: IntakeGroup): RouteStatus {
  if (group.warnings.some((warning) => warning.toLowerCase().includes("missing") || warning.toLowerCase().includes("mismatch"))) return "Blocked";
  if (group.confidence >= 90) return "Ready to Approve";
  if (group.confidence >= 70) return "Review";
  return "Needs Research";
}

function toneForStatus(status: QueueStatus): StatusTone {
  if (status === "Approved Mock") return "green";
  if (status === "Ready to Approve") return "teal";
  if (status === "Review") return "gold";
  if (status === "Needs Research" || status === "Blocked" || status === "Rejected") return "pink";
  return "neutral";
}

function toneForSkuStatus(status: SkuStatus): StatusTone {
  if (status === "SKU Assigned") return "green";
  if (status === "Needs Review") return "gold";
  return "purple";
}

function confidenceTone(confidence: number): "teal" | "gold" | "pink" {
  if (confidence >= 90) return "teal";
  if (confidence >= 70) return "gold";
  return "pink";
}

function flagLabel(value: boolean) {
  return value ? "Yes" : "No";
}

function imagesPerCard(mode: ImageCountMode, customCount: number) {
  if (mode === "2 images/card") return 2;
  if (mode === "3 images/card") return 3;
  if (mode === "Custom") return customCount;
  return 2;
}

function ImagePlaceholder({
  image,
  emptyLabel,
  large = false,
  compact = false
}: {
  image?: IntakeImage;
  emptyLabel?: string;
  large?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col justify-between overflow-hidden rounded-md border border-acv-border bg-gradient-to-br from-acv-purple/30 via-acv-panel2 to-acv-gold/15",
        compact ? "h-12 w-10 p-1" : large ? "aspect-[3/4] p-3" : "h-24 p-2"
      )}
    >
      <span className={cn("truncate font-semibold uppercase tracking-[0.1em] text-acv-gold", compact ? "text-[7px]" : "text-[10px]")}>{image?.role || emptyLabel || "Empty"}</span>
      <div className="flex flex-1 items-center justify-center">
        <Camera className={cn("text-acv-muted/70", compact ? "h-3.5 w-3.5" : large ? "h-10 w-10" : "h-6 w-6")} />
      </div>
      <span className={cn("truncate font-semibold text-acv-text", compact ? "text-[7px]" : "text-[11px]")}>{compact ? "ACV" : image?.label || "Awaiting image"}</span>
      {image && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-acv-teal shadow-[0_0_14px_#26d4c7]" />}
    </div>
  );
}

function CompactMetric({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  const toneClass =
    tone === "green"
      ? "text-acv-green"
      : tone === "teal"
        ? "text-acv-teal"
        : tone === "gold"
          ? "text-acv-gold"
          : tone === "pink"
            ? "text-acv-pink"
            : "text-acv-text";
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-2.5 py-2">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-bold", toneClass)}>{value}</p>
    </div>
  );
}

function MiniButton({
  children,
  icon,
  tone = "neutral",
  onClick,
  className
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "teal" | "gold" | "pink";
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold transition",
        tone === "teal"
          ? "border-acv-teal/40 bg-acv-teal/10 text-acv-teal hover:bg-acv-teal/15"
          : tone === "gold"
            ? "border-acv-gold/35 bg-acv-gold/10 text-acv-gold hover:bg-acv-gold/15"
            : tone === "pink"
              ? "border-acv-pink/40 bg-acv-pink/10 text-acv-pink hover:bg-acv-pink/15"
              : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function FieldRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: StatusTone }) {
  const toneClass =
    tone === "green"
      ? "text-acv-green"
      : tone === "teal"
        ? "text-acv-teal"
        : tone === "gold"
          ? "text-acv-gold"
          : tone === "pink"
            ? "text-acv-pink"
            : "text-acv-text";
  return (
    <div className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</p>
      <p className={cn("mt-1 truncate text-xs font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

function SelectCheckbox({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border transition",
        checked ? "border-acv-teal bg-acv-teal/20 shadow-[0_0_14px_rgba(38,212,199,0.2)]" : "border-acv-border bg-acv-panel2 hover:border-acv-teal/60"
      )}
    >
      <span className={cn("h-2 w-2 rounded-[2px] transition", checked ? "bg-acv-teal" : "bg-transparent")} />
    </button>
  );
}

function DecisionSummaryItem({ state, children }: { state: "ready" | "warning" | "blocked"; children: React.ReactNode }) {
  const Icon = state === "ready" ? CheckCircle2 : state === "warning" ? AlertTriangle : XCircle;
  const toneClass = state === "ready" ? "text-acv-teal" : state === "warning" ? "text-acv-gold" : "text-acv-pink";

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
      <Icon className={cn("h-4 w-4 shrink-0", toneClass)} />
      <span className="truncate text-xs font-semibold text-acv-text">{children}</span>
    </div>
  );
}

function ApprovalDecisionCard({
  group,
  routeStatus,
  onApprove,
  onResearch,
  onReject
}: {
  group: IntakeGroup;
  routeStatus: RouteStatus;
  onApprove: (id: string) => void;
  onResearch: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const missingImage = group.warnings.find((warning) => warning.toLowerCase().includes("missing"));
  const completeRecord = group.warnings.length === 0;
  const readyForApproval = routeStatus === "Ready to Approve";

  return (
    <section className="mt-5 rounded-lg border border-acv-border bg-acv-panel/95 p-4 shadow-glow">
      <div className="mb-4 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Approval Decision</p>
        <p className="mt-1 text-xs text-acv-muted">This is the final review before an item becomes inventory.</p>
      </div>

      <div className="mb-4 rounded-lg border border-acv-border bg-black/20 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Decision Summary</p>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <DecisionSummaryItem state={missingImage ? "blocked" : "ready"}>{missingImage || "Images paired"}</DecisionSummaryItem>
          <DecisionSummaryItem state={group.confidence >= 90 ? "ready" : "warning"}>AI confidence: {group.confidence}%</DecisionSummaryItem>
          <DecisionSummaryItem state={completeRecord ? "ready" : "warning"}>{completeRecord ? "Required fields complete" : group.warnings[0]}</DecisionSummaryItem>
          <DecisionSummaryItem state={readyForApproval ? "ready" : "warning"}>{readyForApproval ? "Ready for SKU assignment" : "SKU assignment needs review"}</DecisionSummaryItem>
          <DecisionSummaryItem state={readyForApproval ? "ready" : "warning"}>{readyForApproval ? "Ready for Inventory" : "Inventory approval paused"}</DecisionSummaryItem>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniButton tone="teal" icon={<Save className="h-4 w-4" />} className="h-11 w-full text-xs">
          Save Group
        </MiniButton>
        <MiniButton tone="gold" icon={<ArrowLeftRight className="h-4 w-4" />} className="h-11 w-full text-xs">
          Swap Front/Back
        </MiniButton>
        <MiniButton tone="teal" icon={<BadgeCheck className="h-4 w-4" />} className="h-11 w-full text-xs" onClick={() => onApprove(group.id)}>
          Approve to Inventory
        </MiniButton>
        <MiniButton icon={<FileSearch className="h-4 w-4" />} className="h-11 w-full text-xs" onClick={() => onResearch(group.id)}>
          Send to Research
        </MiniButton>
        <MiniButton tone="pink" icon={<XCircle className="h-4 w-4" />} className="h-11 w-full text-xs" onClick={() => onReject(group.id)}>
          Reject Group
        </MiniButton>
      </div>
    </section>
  );
}

function ReviewDrawer({
  group,
  skuStatus,
  assignedSku,
  onClose,
  onApprove,
  onResearch,
  onReject
}: {
  group: IntakeGroup;
  skuStatus: SkuStatus;
  assignedSku: string;
  onClose: () => void;
  onApprove: (id: string) => void;
  onResearch: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const routeStatus = statusForGroup(group);
  const skuDisplay = skuStatus === "SKU Assigned" ? `${assignedSku} mock` : "Pending Approval";
  const drawerSkuTone = skuStatus === "SKU Assigned" ? "green" : "purple";

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm sm:left-56">
      <button type="button" aria-label="Close intake review drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-5xl flex-col border-l border-acv-border bg-acv-black shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusPill tone="purple">Batch: {group.batch}</StatusPill>
              <StatusPill tone="gold">Group: {group.id}</StatusPill>
              <StatusPill tone={drawerSkuTone}>SKU: {skuDisplay}</StatusPill>
              <StatusPill tone={toneForStatus(routeStatus)}>{routeStatus}</StatusPill>
              <StatusPill tone={confidenceTone(group.confidence)}>{group.confidence}% confidence</StatusPill>
            </div>
            <h2 className="truncate text-lg font-semibold text-acv-text">{group.proposed.cardName}</h2>
            <p className="mt-1 text-xs text-acv-muted">Temporary intake references only - permanent SKU assignment happens after approval.</p>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-acv-border text-acv-muted transition hover:text-acv-teal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="acv-scrollbar min-h-0 flex-1 overflow-y-auto p-5 pb-8">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <section className="min-w-0 rounded-lg border border-acv-border bg-acv-panel p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">Group Images</p>
                    <p className="mt-1 text-xs text-acv-muted">Role controls are staged for future approved image ordering.</p>
                  </div>
                  <StatusPill tone="teal">{group.images.length} images</StatusPill>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {group.images.map((image) => (
                    <div key={image.id} className="min-w-0 space-y-2">
                      <ImagePlaceholder image={image} large />
                      <select
                        aria-label={`Role for ${image.label}`}
                        defaultValue={image.role}
                        className="h-8 w-full rounded-md border border-acv-border bg-acv-panel2 px-2 text-xs font-semibold text-acv-text outline-none"
                      >
                        {imageRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-acv-border bg-acv-panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">AI Extraction Review</p>
                    <p className="mt-1 text-xs text-acv-muted">Proposed inventory record remains staged until approved.</p>
                  </div>
                  <StatusPill tone={toneForStatus(routeStatus)}>{routeStatus}</StatusPill>
                </div>
                <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <FieldRow label="Proposed card" value={group.proposed.cardName} tone="gold" />
                  <FieldRow label="Player / Character" value={group.proposed.playerCharacter} />
                  <FieldRow label="Team" value={group.proposed.team} />
                  <FieldRow label="Sport / Category" value={group.proposed.category} />
                  <FieldRow label="Year" value={group.proposed.year} />
                  <FieldRow label="Brand" value={group.proposed.brand} />
                  <FieldRow label="Set" value={group.proposed.set} />
                  <FieldRow label="Card Number" value={group.proposed.cardNumber} />
                  <FieldRow label="Parallel" value={group.proposed.parallel} />
                  <FieldRow label="Serial Number" value={group.proposed.serialNumber} />
                  <FieldRow label="Rookie" value={flagLabel(group.proposed.rookieFlag)} tone={group.proposed.rookieFlag ? "teal" : undefined} />
                  <FieldRow label="Auto" value={flagLabel(group.proposed.autoFlag)} />
                  <FieldRow label="Relic" value={flagLabel(group.proposed.relicFlag)} />
                  <FieldRow label="Variation" value={flagLabel(group.proposed.variationFlag)} tone={group.proposed.variationFlag ? "gold" : undefined} />
                  <FieldRow label="Confidence" value={`${group.confidence}%`} tone={confidenceTone(group.confidence)} />
                </div>
                <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
                  <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Condition Notes</p>
                    <p className="mt-2 text-xs leading-5 text-acv-text">{group.proposed.conditionNotes}</p>
                  </div>
                  <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Uncertainty Notes</p>
                    <p className="mt-2 text-xs leading-5 text-acv-text">{group.proposed.uncertaintyNotes}</p>
                  </div>
                </div>
                {group.warnings.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.warnings.map((warning) => (
                      <StatusPill key={warning} tone="pink">
                        {warning}
                      </StatusPill>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <ApprovalDecisionCard group={group} routeStatus={routeStatus} onApprove={onApprove} onResearch={onResearch} onReject={onReject} />
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function PhotoIntakePage() {
  const [activeSource, setActiveSource] = useState<SourceKey>("Computer Upload");
  const [batchName, setBatchName] = useState("July Intake - Breaks + Singles");
  const [imageCountMode, setImageCountMode] = useState<ImageCountMode>("2 images/card");
  const [customImageCount, setCustomImageCount] = useState(4);
  const [autoPair, setAutoPair] = useState(true);
  const [aiPairingCheck, setAiPairingCheck] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState("G-001");
  const [drawerGroup, setDrawerGroup] = useState<IntakeGroup | null>(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [researchIds, setResearchIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  const visibleGroups = useMemo(() => intakeGroups.filter((group) => group.source === activeSource || activeSource !== "Computer Upload"), [activeSource]);
  const selectedGroup = visibleGroups.find((group) => group.id === selectedGroupId) || visibleGroups[0] || intakeGroups[0];
  const totalPhotos = 128;
  const perCard = imagesPerCard(imageCountMode, customImageCount);
  const estimatedCards = imageCountMode === "Auto-detect" ? 43 : Math.floor(totalPhotos / perCard);
  const pairedGroups = intakeGroups.filter((group) => statusForGroup(group) !== "Blocked").length;
  const reviewFlags = intakeGroups.reduce((total, group) => total + group.warnings.length, 0);
  const readyToApprove = intakeGroups.filter((group) => statusForGroup(group) === "Ready to Approve" && !approvedIds.has(group.id)).length;

  const allQueueSelected = visibleGroups.length > 0 && visibleGroups.every((group) => selectedQueueIds.has(group.id));

  function queueStatus(group: IntakeGroup): QueueStatus {
    if (approvedIds.has(group.id)) return "Approved Mock";
    if (rejectedIds.has(group.id)) return "Rejected";
    if (researchIds.has(group.id)) return "Needs Research";
    return statusForGroup(group);
  }

  function skuStatusForGroup(group: IntakeGroup): SkuStatus {
    if (approvedIds.has(group.id)) return "SKU Assigned";
    if (rejectedIds.has(group.id) || researchIds.has(group.id) || statusForGroup(group) !== "Ready to Approve") return "Needs Review";
    return "Pending Approval";
  }

  function assignedSkuForGroup(group: IntakeGroup) {
    return mockAssignedSkus[group.id] || "ACV-NFL-000421";
  }

  function setQueueSelection(id: string, checked: boolean) {
    setSelectedQueueIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setAllQueueSelection(checked: boolean) {
    setSelectedQueueIds((current) => {
      const next = new Set(current);
      visibleGroups.forEach((group) => {
        if (checked) next.add(group.id);
        else next.delete(group.id);
      });
      return next;
    });
  }

  function approveGroup(id: string) {
    setApprovedIds((current) => new Set(current).add(id));
    setResearchIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setRejectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function sendToResearch(id: string) {
    setResearchIds((current) => new Set(current).add(id));
    setApprovedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function rejectGroup(id: string) {
    setRejectedIds((current) => new Set(current).add(id));
    setApprovedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function openGroup(group: IntakeGroup) {
    setSelectedGroupId(group.id);
    setDrawerGroup(group);
  }

  return (
    <>
      <PageHeader
        title="Photo Intake Workstation"
        description="Images to batch grouping, pairing review, AI extraction review, and staged approval into inventory."
        action={
          <>
            <ActionButton variant="ghost" icon={<FolderOpen className="h-4 w-4" />}>
              Open batch
            </ActionButton>
            <ActionButton icon={<ImagePlus className="h-4 w-4" />}>New intake</ActionButton>
          </>
        }
      />

      <div className="min-w-0 space-y-3 p-3 sm:p-4">
        <SectionCard title="Intake Source" eyebrow="Images -> Batch -> Grouping -> Pairing Review -> AI Extraction Review -> Approve to Inventory">
          <div className="acv-scrollbar contained-x-scroll flex min-w-0 gap-2 pb-1">
            {sourceOptions.map((source) => (
              <button
                key={source.key}
                type="button"
                onClick={() => setActiveSource(source.key)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-left transition",
                  activeSource === source.key ? "border-acv-teal/50 bg-acv-teal/10 text-acv-teal" : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/40 hover:text-acv-text"
                )}
              >
                <UploadCloud className="h-4 w-4" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{source.key}</span>
                  <span className="block text-[10px] text-acv-muted">{source.status}</span>
                </span>
                <StatusPill tone={source.tone}>{source.key === "Computer Upload" ? "Now" : "Mock"}</StatusPill>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs leading-5 text-acv-muted">
            <span className="font-semibold text-acv-gold">ID note:</span> Batch and Group IDs are temporary intake references. Permanent ACV SKUs are assigned only after approval into inventory.
          </div>
        </SectionCard>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="Batch Setup" eyebrow="Grouping controls">
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Batch name</span>
                <input
                  value={batchName}
                  onChange={(event) => setBatchName(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-acv-border bg-acv-panel2 px-3 text-xs font-semibold text-acv-text outline-none transition focus:border-acv-teal/60"
                />
              </label>
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Images per card</span>
                <select
                  value={imageCountMode}
                  onChange={(event) => setImageCountMode(event.target.value as ImageCountMode)}
                  className="mt-1 h-9 w-full rounded-md border border-acv-border bg-acv-panel2 px-3 text-xs font-semibold text-acv-text outline-none transition focus:border-acv-teal/60"
                >
                  {imageCountModes.map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Custom count</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={customImageCount}
                  onChange={(event) => setCustomImageCount(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
                  disabled={imageCountMode !== "Custom"}
                  className="mt-1 h-9 w-full rounded-md border border-acv-border bg-acv-panel2 px-3 text-xs font-semibold text-acv-text outline-none transition disabled:opacity-45 focus:border-acv-teal/60"
                />
              </label>
              <div className="grid min-w-0 gap-2">
                {[
                  ["Auto-pair by upload order", autoPair, setAutoPair],
                  ["AI pairing check", aiPairingCheck, setAiPairingCheck]
                ].map(([label, value, setter]) => (
                  <button
                    key={label as string}
                    type="button"
                    onClick={() => (setter as (value: boolean) => void)(!(value as boolean))}
                    className="flex h-9 items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 text-xs font-semibold text-acv-text transition hover:border-acv-teal/45"
                  >
                    <span>{label as string}</span>
                    <span className={cn("h-4 w-8 rounded-full border p-0.5 transition", value ? "border-acv-teal bg-acv-teal/20" : "border-acv-border bg-black/30")}>
                      <span className={cn("block h-2.5 w-2.5 rounded-full transition", value ? "translate-x-4 bg-acv-teal" : "bg-acv-muted")} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid min-w-0 gap-2 text-xs md:grid-cols-3">
              <div className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-acv-muted">80 images at 2/card = <span className="font-semibold text-acv-teal">40 cards</span></div>
              <div className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-acv-muted">15 images at 3/card = <span className="font-semibold text-acv-gold">5 cards</span></div>
              <div className="rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-acv-muted">Custom supports <span className="font-semibold text-acv-text">up to 10 images/card</span></div>
            </div>
          </SectionCard>

          <SectionCard title="Upload Zone" eyebrow="Computer Upload mock">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[1fr_220px]">
              <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-acv-teal/35 bg-acv-teal/5 p-5 text-center">
                <UploadCloud className="h-9 w-9 text-acv-teal" />
                <p className="mt-3 text-base font-semibold text-acv-text">Drag and drop card photos</p>
                <p className="mt-1 max-w-lg text-xs leading-5 text-acv-muted">Mock upload bay for front, back, closeup, serial, surface, auto, patch, relic, and other image roles.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <ActionButton icon={<Camera className="h-4 w-4" />}>Upload photos</ActionButton>
                  <ActionButton variant="ghost" icon={<FolderOpen className="h-4 w-4" />}>
                    Open batch
                  </ActionButton>
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-acv-border bg-acv-panel2 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Supported roles</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {imageRoles.map((role) => (
                    <StatusPill key={role} tone={role === "Front" || role === "Back" ? "teal" : "purple"}>
                      {role}
                    </StatusPill>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-2">
          <CompactMetric label="Total photos" value={String(totalPhotos)} tone="teal" />
          <CompactMetric label="Estimated cards" value={imageCountMode === "Auto-detect" ? "~43" : String(estimatedCards)} tone="gold" />
          <CompactMetric label="Paired groups" value={String(pairedGroups)} tone="green" />
          <CompactMetric label="Review flags" value={String(reviewFlags)} tone="pink" />
          <CompactMetric label="Ready to approve" value={String(readyToApprove)} tone="teal" />
        </div>

        <div className="grid min-w-0 gap-3 2xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard title="Grouping / Pairing Review" eyebrow={batchName}>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {visibleGroups.map((group) => {
                const routeStatus = statusForGroup(group);
                const isSelected = selectedGroup.id === group.id;
                return (
                  <article
                    key={group.id}
                    className={cn(
                      "min-w-0 rounded-lg border bg-acv-panel2 p-3 transition",
                      isSelected ? "border-acv-teal/55 shadow-[0_0_0_1px_rgba(38,212,199,0.18)]" : "border-acv-border hover:border-acv-purple/55"
                    )}
                  >
                    <button type="button" onClick={() => setSelectedGroupId(group.id)} className="block w-full min-w-0 text-left">
                      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap gap-1.5">
                            <StatusPill tone="purple">Batch: {group.batch}</StatusPill>
                            <StatusPill tone="gold">Group: {group.id}</StatusPill>
                          </div>
                          <p className="truncate text-xs font-semibold text-acv-text">{group.pairingStatus}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          <StatusPill tone={toneForStatus(routeStatus)}>{routeStatus}</StatusPill>
                          <StatusPill tone={confidenceTone(group.confidence)}>{group.confidence}%</StatusPill>
                        </div>
                      </div>
                      <div className="grid min-w-0 grid-cols-3 gap-2">
                        <ImagePlaceholder image={group.images.find((image) => image.role === "Front")} emptyLabel="Front" />
                        <ImagePlaceholder image={group.images.find((image) => image.role === "Back")} emptyLabel="Back" />
                        <ImagePlaceholder image={group.images.find((image) => !["Front", "Back"].includes(image.role))} emptyLabel="Closeup" />
                      </div>
                    </button>
                    {group.warnings.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {group.warnings.map((warning) => (
                          <StatusPill key={warning} tone="pink">
                            {warning}
                          </StatusPill>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MiniButton icon={<ArrowLeftRight className="h-3.5 w-3.5" />}>Swap front/back</MiniButton>
                      <MiniButton>Set as front</MiniButton>
                      <MiniButton>Set as back</MiniButton>
                      <MiniButton icon={<ImagePlus className="h-3.5 w-3.5" />}>Add closeup</MiniButton>
                      <MiniButton icon={<Move className="h-3.5 w-3.5" />}>Move image</MiniButton>
                      <MiniButton icon={<Scissors className="h-3.5 w-3.5" />}>Split group</MiniButton>
                      <MiniButton icon={<Layers3 className="h-3.5 w-3.5" />}>Merge group</MiniButton>
                      <MiniButton tone="teal" icon={<FileSearch className="h-3.5 w-3.5" />} onClick={() => openGroup(group)}>
                        Review group
                      </MiniButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </SectionCard>

          <div className="min-w-0 space-y-3">
            <SectionCard title="AI Extraction Review" eyebrow={selectedGroup.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <StatusPill tone={toneForStatus(statusForGroup(selectedGroup))}>{statusForGroup(selectedGroup)}</StatusPill>
                <StatusPill tone={confidenceTone(selectedGroup.confidence)}>{selectedGroup.confidence}% confidence</StatusPill>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <FieldRow label="Proposed card name" value={selectedGroup.proposed.cardName} tone="gold" />
                <FieldRow label="Player / Character" value={selectedGroup.proposed.playerCharacter} />
                <FieldRow label="Team" value={selectedGroup.proposed.team} />
                <FieldRow label="Sport / Category" value={selectedGroup.proposed.category} />
                <FieldRow label="Year" value={selectedGroup.proposed.year} />
                <FieldRow label="Brand" value={selectedGroup.proposed.brand} />
                <FieldRow label="Set" value={selectedGroup.proposed.set} />
                <FieldRow label="Card Number" value={selectedGroup.proposed.cardNumber} />
                <FieldRow label="Parallel" value={selectedGroup.proposed.parallel} />
                <FieldRow label="Serial Number" value={selectedGroup.proposed.serialNumber} />
                <FieldRow label="Rookie Flag" value={flagLabel(selectedGroup.proposed.rookieFlag)} tone={selectedGroup.proposed.rookieFlag ? "teal" : undefined} />
                <FieldRow label="Auto Flag" value={flagLabel(selectedGroup.proposed.autoFlag)} />
                <FieldRow label="Relic Flag" value={flagLabel(selectedGroup.proposed.relicFlag)} />
                <FieldRow label="Variation Flag" value={flagLabel(selectedGroup.proposed.variationFlag)} tone={selectedGroup.proposed.variationFlag ? "gold" : undefined} />
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3 text-xs leading-5 text-acv-text">
                  <span className="font-semibold text-acv-muted">Condition notes: </span>
                  {selectedGroup.proposed.conditionNotes}
                </div>
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3 text-xs leading-5 text-acv-text">
                  <span className="font-semibold text-acv-muted">Uncertainty notes: </span>
                  {selectedGroup.proposed.uncertaintyNotes}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Image Role Model" eyebrow="Future inventory + listing rules">
              <div className="space-y-2 text-xs leading-5 text-acv-muted">
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <span className="font-semibold text-acv-teal">Inventory primary:</span> only the approved Front image becomes the table thumbnail.
                </div>
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <span className="font-semibold text-acv-gold">Card drawer:</span> all approved images display in the saved role order.
                </div>
                <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
                  <span className="font-semibold text-acv-purple">Listing drafts:</span> all approved images can be staged for marketplace listings later.
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard
          title="Approval Queue"
          eyebrow="Staged records - mock only"
          action={
            selectedQueueIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="teal">{selectedQueueIds.size} selected</StatusPill>
                <MiniButton tone="teal" onClick={() => selectedQueueIds.forEach(approveGroup)}>
                  Approve selected
                </MiniButton>
                <MiniButton onClick={() => setSelectedQueueIds(new Set())}>Clear</MiniButton>
              </div>
            ) : null
          }
        >
          <DataTable<IntakeGroup>
            rows={visibleGroups}
            getRowKey={(group) => group.id}
            onRowClick={openGroup}
            columns={[
              {
                key: "select",
                header: <SelectCheckbox checked={allQueueSelected} label="Select all staged records" onChange={setAllQueueSelection} />,
                className: "w-8 min-w-8 px-2",
                cell: (group) => <SelectCheckbox checked={selectedQueueIds.has(group.id)} label={`Select ${group.id}`} onChange={(checked) => setQueueSelection(group.id, checked)} />
              },
              { key: "batch", header: "Batch", cell: (group) => <span className="font-semibold text-acv-gold">{group.batch}</span> },
              { key: "group", header: "Group", cell: (group) => <span className="font-semibold text-acv-text">{group.id}</span> },
              {
                key: "skuStatus",
                header: "SKU Status",
                className: "min-w-44",
                cell: (group) => {
                  const status = skuStatusForGroup(group);
                  return (
                    <div className="space-y-1">
                      <StatusPill tone={toneForSkuStatus(status)}>{status}</StatusPill>
                      {status === "SKU Assigned" && <p className="text-[11px] font-semibold text-acv-green">{assignedSkuForGroup(group)} mock</p>}
                    </div>
                  );
                }
              },
              {
                key: "front",
                header: "Front",
                cell: (group) => <ImagePlaceholder image={group.images.find((image) => image.role === "Front")} emptyLabel="Front" compact />
              },
              { key: "item", header: "Proposed Item", className: "min-w-56", cell: (group) => <span className="font-semibold text-acv-text">{group.proposed.cardName}</span> },
              { key: "category", header: "Category", cell: (group) => <StatusPill tone="purple">{group.proposed.category}</StatusPill> },
              { key: "confidence", header: "Confidence", cell: (group) => <span className={cn("font-semibold", group.confidence >= 90 ? "text-acv-teal" : group.confidence >= 70 ? "text-acv-gold" : "text-acv-pink")}>{group.confidence}%</span> },
              { key: "status", header: "Status", cell: (group) => <StatusPill tone={toneForStatus(queueStatus(group))}>{queueStatus(group)}</StatusPill> },
              {
                key: "warnings",
                header: "Warnings",
                className: "min-w-44",
                cell: (group) =>
                  group.warnings.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {group.warnings.slice(0, 2).map((warning) => (
                        <StatusPill key={warning} tone="pink">
                          {warning}
                        </StatusPill>
                      ))}
                    </div>
                  ) : (
                    <span className="font-semibold text-acv-teal">None</span>
                  )
              },
              {
                key: "actions",
                header: "Actions",
                className: "min-w-80",
                cell: (group) => (
                  <div className="flex flex-wrap gap-2">
                    <MiniButton
                      tone="teal"
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        approveGroup(group.id);
                      }}
                    >
                      Approve to Inventory
                    </MiniButton>
                    <MiniButton
                      icon={<FileSearch className="h-3.5 w-3.5" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        sendToResearch(group.id);
                      }}
                    >
                      Needs Research
                    </MiniButton>
                    <MiniButton
                      tone="pink"
                      icon={<XCircle className="h-3.5 w-3.5" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        rejectGroup(group.id);
                      }}
                    >
                      Reject
                    </MiniButton>
                    <MiniButton
                      tone="gold"
                      icon={<FileSearch className="h-3.5 w-3.5" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openGroup(group);
                      }}
                    >
                      Open Review
                    </MiniButton>
                  </div>
                )
              }
            ]}
          />
          {approvedIds.size > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-acv-green/35 bg-acv-green/10 px-3 py-2 text-xs font-semibold text-acv-green">
              <CheckCircle2 className="h-4 w-4" />
              {approvedIds.size} record{approvedIds.size === 1 ? "" : "s"} approved locally. SKU would be assigned during approval: {Array.from(approvedIds)
                .map((id) => mockAssignedSkus[id] || "ACV-NFL-000421")
                .join(", ")}. Mock only, not permanent yet.
            </div>
          )}
        </SectionCard>

        <SectionCard title="Routing Rules" eyebrow="Mock AI status logic">
          <div className="grid min-w-0 gap-2 text-xs md:grid-cols-4">
            <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
              <StatusPill tone="teal">90%+</StatusPill>
              <p className="mt-2 text-acv-muted">Ready to Approve</p>
            </div>
            <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
              <StatusPill tone="gold">70-89%</StatusPill>
              <p className="mt-2 text-acv-muted">Review</p>
            </div>
            <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
              <StatusPill tone="pink">Under 70%</StatusPill>
              <p className="mt-2 text-acv-muted">Needs Research</p>
            </div>
            <div className="rounded-md border border-acv-border bg-acv-panel2 p-3">
              <StatusPill tone="pink">Missing / mismatch</StatusPill>
              <p className="mt-2 text-acv-muted">Blocked until images are fixed</p>
            </div>
          </div>
        </SectionCard>
      </div>

      {drawerGroup && (
        <ReviewDrawer
          group={drawerGroup}
          skuStatus={skuStatusForGroup(drawerGroup)}
          assignedSku={assignedSkuForGroup(drawerGroup)}
          onClose={() => setDrawerGroup(null)}
          onApprove={(id) => {
            approveGroup(id);
            setDrawerGroup(null);
          }}
          onResearch={(id) => {
            sendToResearch(id);
            setDrawerGroup(null);
          }}
          onReject={(id) => {
            rejectGroup(id);
            setDrawerGroup(null);
          }}
        />
      )}
    </>
  );
}
