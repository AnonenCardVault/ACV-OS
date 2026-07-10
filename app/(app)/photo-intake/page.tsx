"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardCopy,
  Eraser,
  FileSearch,
  FolderOpen,
  ImagePlus,
  Layers3,
  Move,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  UploadCloud,
  X,
  XCircle
} from "lucide-react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { extractCardFromImagesViaApi } from "@/lib/ai-extraction";
import { compactApprovedInventoryItemForCache, compactIntakeImageForCache, compactUploadedImageForCache, useAcvLocalState, type BatchHistoryEntry } from "@/lib/acv-local-state";
import { generateMarketplaceTitles, type MarketplaceTitleCatalogFacts, type MarketplaceTitleResult } from "@/lib/marketplace-title";
import type { ParallelRecognitionResult } from "@/lib/parallel-recognition";
import { cn } from "@/lib/utils";

type SourceKey = "Computer Upload" | "eBay Active Listings" | "eBay Drafts" | "Google Drive" | "Dropbox" | "Mobile Camera Upload" | "Scanner" | "Shared Team Uploads" | "Future Sources";
type ImageCountMode = "2 images/card" | "3 images/card" | "Custom" | "Auto-detect";
type ImageRole = "Front" | "Back" | "Detail / Closeup" | "Serial Closeup" | "Holo / Surface" | "Auto Closeup" | "Patch / Relic Closeup" | "Other";
type RouteStatus = "Ready to Approve" | "Review" | "Needs Research" | "Blocked";
type QueueStatus = RouteStatus | "Approved Local" | "Rejected";
type SkuStatus = "Pending Approval" | "SKU Assigned" | "Needs Review";
type StatusTone = "green" | "teal" | "gold" | "pink" | "purple" | "neutral";
type AiExtractionStatus = "Not Run" | "Extracted" | "Needs Review" | "Failed" | "Cleared";

type UploadedImage = {
  id: string;
  fileName: string;
  url: string;
  dataUrl?: string;
  type: string;
  order: number;
  needsReupload?: boolean;
  storageBucket?: string;
  storagePath?: string;
  publicUrl?: string;
  supabaseImageId?: string;
};

type IntakeImage = {
  id: string;
  role: ImageRole;
  label: string;
  fileName: string;
  url: string;
  dataUrl?: string;
  uploadId?: string;
  order: number;
  needsReupload?: boolean;
  storageBucket?: string;
  storagePath?: string;
  publicUrl?: string;
  supabaseImageId?: string;
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
  grader: string;
  grade: string;
  conditionNotes: string;
  uncertaintyNotes: string;
  purchaseCost: number;
  quantity: number;
  acquisitionSource: string;
  location: string;
  internalNotes: string;
};

type AiFieldConfidenceMap = Partial<Record<keyof ProposedRecord | "suggestedTitle", number>>;

type AiProviderDiagnostic = {
  providerName: string;
  status: "used" | "skipped" | "failed" | "fallback";
  reason: string;
  confidence?: number;
  mode: "live" | "mock" | "local";
  mappedFields?: Array<{ label: string; value: string }>;
};

type CatalogDiagnostic = {
  providerName: string;
  status: string;
  confidence?: number;
  matchedCard?: string;
  matchedSet?: string;
  matchedNumber?: string;
  matchedTeam?: string;
  matchedProduct?: string;
  matchedSubset?: string | null;
  sourceName?: string;
  sourceUrl?: string;
  candidateCount?: number;
  rarity?: string;
  setId?: string;
  setTotal?: number;
  printedTotal?: number;
  supertype?: string;
  subtypes?: string[];
  types?: string[];
  warnings: string[];
};

type AiExtractionSnapshot = {
  status: AiExtractionStatus;
  extracted?: Partial<ProposedRecord>;
  fieldConfidence: AiFieldConfidenceMap;
  warnings: string[];
  suggestedTitle: string;
  extractedAt?: string;
  confidenceScore?: number;
  modelLabel?: string;
  extractionSources?: string[];
  catalogDiagnostics?: CatalogDiagnostic;
  providerDiagnostics?: AiProviderDiagnostic[];
  parallelRecognition?: ParallelRecognitionResult;
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
  confirmedFields?: Array<keyof ProposedRecord>;
  aiExtraction?: AiExtractionSnapshot;
};

const sourceOptions: Array<{ key: SourceKey; status: string; tone: StatusTone }> = [
  { key: "Computer Upload", status: "Available / mock", tone: "teal" },
  { key: "eBay Active Listings", status: "Planned / mock", tone: "purple" },
  { key: "eBay Drafts", status: "Planned / mock", tone: "purple" },
  { key: "Google Drive", status: "Future source", tone: "purple" },
  { key: "Dropbox", status: "Future source", tone: "purple" },
  { key: "Mobile Camera Upload", status: "Future source", tone: "gold" },
  { key: "Scanner", status: "Future source", tone: "gold" },
  { key: "Shared Team Uploads", status: "Future source", tone: "gold" },
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

const categoryOptions = ["Football", "Baseball", "Basketball", "Pokemon", "TCG", "Soccer", "Hockey", "Other"];
const graderOptions = ["Raw", "PSA", "SGC", "BGS", "CGC", "Other"];
const gradeOptions = ["Raw", "10", "9.5", "9", "8.5", "8", "7", "6", "5", "Other"];
const acquisitionSourceOptions = ["Computer Upload", "Card Show", "Break", "eBay Import", "Trade", "Personal Collection", "Other"];
const wrappedWarningPillClass = "max-w-full min-w-0 !whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] text-left leading-4 tracking-[0.04em]";

function defaultAiExtraction(): AiExtractionSnapshot {
  return {
    status: "Not Run",
    extracted: undefined,
    fieldConfidence: {},
    warnings: [],
    suggestedTitle: ""
  };
}

const skuCategoryCodes: Record<string, string> = {
  Football: "NFL",
  Baseball: "MLB",
  Basketball: "NBA",
  Pokemon: "POK",
  TCG: "TCG",
  Soccer: "SOC",
  Hockey: "NHL"
};

function defaultRoleForImage(index: number, total: number, mode: ImageCountMode): ImageRole {
  if (mode === "3 images/card") {
    if (index === 0) return "Front";
    if (index === 1) return "Detail / Closeup";
    if (index === 2) return "Back";
  }

  if (mode === "Custom") {
    if (index === 0) return "Front";
    if (total > 1 && index === total - 1) return "Back";
    return "Detail / Closeup";
  }

  if (index === 0) return "Front";
  if (index === 1) return "Back";
  return "Detail / Closeup";
}

function defaultProposedRecord(groupNumber: number): ProposedRecord {
  return {
    cardName: `Unidentified Card ${groupNumber}`,
    playerCharacter: "",
    team: "",
    category: "Other",
    year: "",
    brand: "",
    set: "",
    cardNumber: "",
    parallel: "",
    serialNumber: "",
    rookieFlag: false,
    autoFlag: false,
    relicFlag: false,
    variationFlag: false,
    grader: "Raw",
    grade: "Raw",
    conditionNotes: "Local record generated from uploaded images. No OCR or AI has run yet.",
    uncertaintyNotes: "Review card identity, set, and numbering before approval.",
    purchaseCost: 0,
    quantity: 1,
    acquisitionSource: "Computer Upload",
    location: "Photo Intake",
    internalNotes: ""
  };
}

function safeImages(group?: Partial<IntakeGroup> | null) {
  return Array.isArray(group?.images) ? group.images : [];
}

function safeWarnings(group?: Partial<IntakeGroup> | null) {
  return Array.isArray(group?.warnings) ? group.warnings : [];
}

function safeProposed(group?: Partial<IntakeGroup> | null): ProposedRecord {
  return {
    ...defaultProposedRecord(0),
    ...(group?.proposed || {})
  };
}

function safeConfidence(group?: Partial<IntakeGroup> | null) {
  return Number.isFinite(group?.confidence) ? Number(group?.confidence) : 0;
}

function logIntakeDev(message: string, payload?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV Photo Intake] ${message}`, payload || "");
  }
}

function logIntakeException(action: string, error: unknown, context: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[ACV Photo Intake] ${action} failed`, {
      ...context,
      error,
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

function pairingStatusForGroup(group: IntakeGroup) {
  const images = safeImages(group);
  const hasFront = images.some((image) => image.role === "Front");
  const hasBack = images.some((image) => image.role === "Back");
  const hasDetail = images.some((image) => !["Front", "Back"].includes(image.role));

  if (!hasFront) return "Front image missing";
  if (!hasBack) return "Back image missing";
  if (hasDetail) return "Front/back/detail paired";
  return "Front/back paired";
}

function warningsForGroup(group?: IntakeGroup | null) {
  const images = safeImages(group);
  const warnings = new Set(safeWarnings(group));
  group?.aiExtraction?.warnings?.forEach((warning) => warnings.add(warning));
  if (!images.some((image) => image.role === "Front")) warnings.add("Missing front image");
  if (!images.some((image) => image.role === "Back")) warnings.add("Missing back image");
  return Array.from(warnings);
}

function baseWarningsForReadiness(group?: IntakeGroup | null) {
  const images = safeImages(group);
  const warnings = new Set(safeWarnings(group));
  if (!images.some((image) => image.role === "Front")) warnings.add("Missing front image");
  if (!images.some((image) => image.role === "Back")) warnings.add("Missing back image");
  return Array.from(warnings);
}

function aiStatusForGroup(group?: IntakeGroup | null): AiExtractionStatus {
  return group?.aiExtraction?.status || "Not Run";
}

function toneForAiStatus(status: AiExtractionStatus): StatusTone {
  if (status === "Extracted") return "teal";
  if (status === "Needs Review") return "gold";
  if (status === "Failed") return "pink";
  if (status === "Cleared") return "neutral";
  return "purple";
}

function toneForProviderDiagnostic(status: AiProviderDiagnostic["status"]): StatusTone {
  if (status === "used") return "teal";
  if (status === "fallback" || status === "skipped") return "gold";
  if (status === "failed") return "pink";
  return "neutral";
}

function toneForProviderMode(mode: AiProviderDiagnostic["mode"]): StatusTone {
  if (mode === "live") return "green";
  if (mode === "mock") return "purple";
  return "neutral";
}

function toneForCatalogStatus(status: string): StatusTone {
  if (status === "matched") return "teal";
  if (status === "disagreement" || status === "not_found") return "gold";
  if (status === "unavailable") return "neutral";
  return "purple";
}

function fieldConfidenceLabel(key: string) {
  const labels: Record<string, string> = {
    cardName: "Title",
    playerCharacter: "Player",
    team: "Team",
    category: "Category",
    year: "Year",
    brand: "Brand",
    set: "Set",
    cardNumber: "Card #",
    parallel: "Parallel",
    serialNumber: "Serial",
    suggestedTitle: "Suggested title"
  };

  return labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function hasFieldValue(value: string | number | undefined | null) {
  if (typeof value === "number") return Number.isFinite(value);
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized && normalized !== "-" && normalized !== "pending");
}

function hasUncertaintyNote(group?: IntakeGroup | null) {
  return hasFieldValue(safeProposed(group).uncertaintyNotes);
}

function readinessIssuesForGroup(group?: IntakeGroup | null) {
  const images = safeImages(group);
  const proposed = safeProposed(group);
  const warnings = baseWarningsForReadiness(group);
  const issues: string[] = [];
  const hasFront = images.some((image) => image.role === "Front");
  const hasMismatch = warnings.some((warning) => warning.toLowerCase().includes("mismatch"));
  const hasBrandOrSet = hasFieldValue(proposed.brand) || hasFieldValue(proposed.set);
  const uncertainty = hasUncertaintyNote(group);

  if (!hasFront) issues.push("Missing front image");
  if (hasMismatch) issues.push("Image mismatch flag");
  if (!hasFieldValue(proposed.cardName)) issues.push("Card title missing");
  if (!hasFieldValue(proposed.category)) issues.push("Category missing");
  if (!hasFieldValue(proposed.year) && !uncertainty) issues.push("Year missing");
  if (!hasBrandOrSet && !uncertainty) issues.push("Brand or set missing");
  if (aiStatusForGroup(group) === "Failed") issues.push("AI extraction failed");
  warnings
    .filter((warning) => !issues.includes(warning))
    .forEach((warning) => issues.push(warning));

  return issues;
}

function buildGroupsFromUploads({
  uploadedImages,
  batchId,
  mode,
  customCount
}: {
  uploadedImages: UploadedImage[];
  batchId: string;
  mode: ImageCountMode;
  customCount: number;
}) {
  const perCard = imagesPerCard(mode, customCount);
  const groups: IntakeGroup[] = [];

  for (let index = 0; index < uploadedImages.length; index += perCard) {
    const chunk = uploadedImages.slice(index, index + perCard);
    const groupNumber = groups.length + 1;
    const groupId = `G-${String(groupNumber).padStart(3, "0")}`;
    const warnings: string[] = [];

    if (chunk.length < perCard) warnings.push(`Incomplete group: expected ${perCard} image${perCard === 1 ? "" : "s"}`);
    if (mode === "Auto-detect") warnings.push("Auto-detect mock mode used 2 images/card");

    const images = chunk.map((image, imageIndex) => ({
      id: `${groupId}-${image.id}`,
      role: defaultRoleForImage(imageIndex, chunk.length, mode),
      label: image.fileName,
      fileName: image.fileName,
      url: image.url || image.dataUrl || "",
      dataUrl: image.dataUrl,
      uploadId: image.id,
      order: image.order,
      needsReupload: image.needsReupload
    }));

    const draftGroup: IntakeGroup = {
      id: groupId,
      batch: batchId,
      source: "Computer Upload",
      pairingStatus: "Pending pairing",
      confidence: mode === "Auto-detect" ? 76 : chunk.length === perCard ? 92 : 68,
      warnings,
      images,
      proposed: defaultProposedRecord(groupNumber),
      aiExtraction: defaultAiExtraction()
    };

    groups.push({ ...draftGroup, pairingStatus: pairingStatusForGroup(draftGroup) });
  }

  return groups;
}

function statusForGroup(group?: IntakeGroup | null): RouteStatus {
  const warnings = warningsForGroup(group);
  const images = safeImages(group);
  const proposed = safeProposed(group);
  const hasFront = images.some((image) => image.role === "Front");
  if (!hasFront || warnings.some((warning) => warning.toLowerCase().includes("mismatch"))) return "Blocked";
  if (!hasFieldValue(proposed.cardName) || !hasFieldValue(proposed.category)) return "Needs Research";
  if (readinessIssuesForGroup(group).length > 0) return "Review";
  return "Ready to Approve";
}

function toneForStatus(status: QueueStatus): StatusTone {
  if (status === "Approved Local") return "green";
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

function marketplaceCatalogFacts(catalog?: CatalogDiagnostic): MarketplaceTitleCatalogFacts | undefined {
  if (!catalog) return undefined;
  return {
    providerName: catalog.providerName,
    status: catalog.status,
    confidence: catalog.confidence,
    matchedCard: catalog.matchedCard,
    matchedSet: catalog.matchedSet,
    matchedNumber: catalog.matchedNumber,
    rarity: catalog.rarity,
    setId: catalog.setId,
    setTotal: catalog.setTotal,
    printedTotal: catalog.printedTotal,
    supertype: catalog.supertype,
    subtypes: catalog.subtypes,
    types: catalog.types
  };
}

function marketplaceTitleForRecord(record: ProposedRecord, catalog?: CatalogDiagnostic): MarketplaceTitleResult {
  return generateMarketplaceTitles({
    cardTitle: record.cardName,
    playerOrCharacter: record.playerCharacter,
    team: record.team,
    sportCategory: record.category,
    year: record.year,
    brand: record.brand,
    setName: record.set,
    cardNumber: record.cardNumber,
    parallel: record.parallel,
    serialNumber: record.serialNumber,
    rookie: record.rookieFlag,
    auto: record.autoFlag,
    relic: record.relicFlag,
    variation: record.variationFlag,
    grader: record.grader,
    grade: record.grade,
    catalog: marketplaceCatalogFacts(catalog)
  });
}

function imagesPerCard(mode: ImageCountMode, customCount: number) {
  if (mode === "2 images/card") return 2;
  if (mode === "3 images/card") return 3;
  if (mode === "Custom") return customCount;
  return 2;
}

function formatBatchDate(value: string, format: "short" | "long" = "short") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: format === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
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
        compact ? "h-12 w-10 p-1" : large ? "aspect-[3/4] p-3" : "h-24 p-2",
        (image?.url || image?.dataUrl) && "bg-acv-panel2"
      )}
    >
      {image?.url || image?.dataUrl ? (
        <img src={image.url || image.dataUrl} alt={image.label} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera className={cn("text-acv-muted/70", compact ? "h-3.5 w-3.5" : large ? "h-10 w-10" : "h-6 w-6")} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-1.5">
        <span className={cn("block truncate font-semibold uppercase tracking-[0.1em] text-acv-gold", compact ? "text-[7px]" : "text-[10px]")}>{image?.role || emptyLabel || "Empty"}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5">
        <span className={cn("block truncate font-semibold text-acv-text", compact ? "text-[7px]" : "text-[11px]")}>{compact ? "ACV" : image?.label || "Awaiting image"}</span>
      </div>
      {image && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-acv-teal shadow-[0_0_14px_#26d4c7]" />}
      {image?.needsReupload && (
        <span className="absolute left-1.5 top-6 rounded border border-acv-pink/40 bg-black/75 px-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-acv-pink">
          Re-upload
        </span>
      )}
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
  disabled,
  className
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "teal" | "gold" | "pink";
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold transition",
        tone === "teal"
          ? "border-acv-teal/40 bg-acv-teal/10 text-acv-teal hover:bg-acv-teal/15"
          : tone === "gold"
            ? "border-acv-gold/35 bg-acv-gold/10 text-acv-gold hover:bg-acv-gold/15"
            : tone === "pink"
              ? "border-acv-pink/40 bg-acv-pink/10 text-acv-pink hover:bg-acv-pink/15"
              : "border-acv-border bg-white/[0.03] text-acv-muted hover:border-acv-teal/45 hover:text-acv-teal",
        disabled && "cursor-not-allowed opacity-45 hover:border-acv-border hover:text-acv-muted",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-acv-border bg-white/[0.03] px-2.5 text-[11px] font-semibold text-acv-muted transition hover:border-acv-teal/45 hover:text-acv-text"
    >
      <span>{label}</span>
      <span className={cn("relative h-5 w-9 rounded-full border transition", checked ? "border-acv-teal/50 bg-acv-teal/25" : "border-acv-border bg-acv-panel2")}>
        <span className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition", checked ? "left-4 bg-acv-teal shadow-[0_0_12px_rgba(38,212,199,0.35)]" : "left-0.5 bg-acv-muted")} />
      </span>
    </button>
  );
}

function AlertRow({ tone = "gold", children }: { tone?: "gold" | "pink" | "neutral"; children: React.ReactNode }) {
  const toneClass =
    tone === "pink"
      ? "border-acv-pink/30 bg-acv-pink/10 text-acv-pink"
      : tone === "gold"
        ? "border-acv-gold/35 bg-acv-gold/10 text-acv-gold"
        : "border-acv-border bg-white/[0.03] text-acv-muted";

  return <div className={cn("w-full min-w-0 rounded-md border px-2.5 py-2 text-[11px] font-semibold leading-5 normal-case tracking-normal [overflow-wrap:anywhere] [word-break:break-word]", toneClass)}>{children}</div>;
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

function ParallelRecognitionPanel({
  recognition,
  finalParallel,
  confirmedFields
}: {
  recognition?: ParallelRecognitionResult;
  finalParallel: string;
  confirmedFields?: Array<keyof ProposedRecord>;
}) {
  const parallelConfirmed = Boolean(finalParallel && confirmedFields?.includes("parallel"));
  const confidence = typeof recognition?.confidence === "number" ? `${recognition.confidence}%` : parallelConfirmed ? "Confirmed" : "Not scored";
  const recommended = recognition?.recommendedParallel || finalParallel || "No recommendation";
  const evidence = recognition?.evidence || [];
  const candidates = recognition?.candidates || [];
  const warnings = recognition?.warnings || [];

  return (
    <div className="mt-3 rounded-lg border border-acv-border bg-acv-panel2 p-3">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Parallel Recognition</p>
          <p className="mt-1 text-[11px] leading-5 text-acv-muted">AI recommends a parallel from provider, catalog, serial, and correction evidence. Final Parallel stays editable.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone={parallelConfirmed ? "green" : recognition?.status === "ambiguous" || recognition?.status === "unsupported" ? "gold" : recognition?.status === "not_found" ? "neutral" : "teal"}>
            {parallelConfirmed ? "Confirmed Value" : recognition?.status ? recognition.status.replace("_", " ") : "Not Run"}
          </StatusPill>
          <StatusPill tone={parallelConfirmed ? "green" : recognition?.confidence && recognition.confidence >= 80 ? "teal" : recognition?.confidence && recognition.confidence >= 60 ? "gold" : "purple"}>
            {confidence}
          </StatusPill>
        </div>
      </div>

      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <AlertRow tone="neutral">Recommended Parallel: {recommended}</AlertRow>
        <AlertRow tone="neutral">Final Parallel: {finalParallel || "Blank until confirmed"}</AlertRow>
        {recognition?.serialEvidence?.detail && <AlertRow tone="neutral">{recognition.serialEvidence.detail}</AlertRow>}
        {recognition?.catalogSupported !== undefined && <AlertRow tone={recognition.catalogSupported ? "neutral" : "gold"}>{recognition.catalogSupported ? "Catalog supports recommendation" : "Catalog support not confirmed"}</AlertRow>}
      </div>

      {candidates.length > 0 && (
        <div className="mt-3 min-w-0 rounded-md border border-acv-border bg-black/20 p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Candidate Parallels</p>
          <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
            {candidates.slice(0, 4).map((candidate) => (
              <AlertRow key={`${candidate.normalizedLabel}-${candidate.confidence}`} tone={candidate.catalogSupported ? "neutral" : candidate.warnings.length ? "gold" : "neutral"}>
                {candidate.officialCatalogLabel || candidate.normalizedLabel} • {candidate.confidence}%
              </AlertRow>
            ))}
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="mt-3 min-w-0 rounded-md border border-acv-border bg-black/20 p-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Evidence Summary</p>
          <div className="grid min-w-0 gap-1.5">
            {evidence.slice(0, 6).map((item, index) => (
              <AlertRow key={`${item.source}-${item.value || item.detail || index}`} tone="neutral">
                {item.label}: {item.value || item.detail || "Evidence captured"}{item.confidence !== undefined ? ` (${item.confidence}%)` : ""}
              </AlertRow>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mt-3 grid min-w-0 gap-2">
          {warnings.map((warning) => (
            <AlertRow key={warning} tone="gold">
              {warning}
            </AlertRow>
          ))}
        </div>
      )}
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
      <span className="min-w-0 text-xs font-semibold leading-4 text-acv-text [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

function ApprovalDecisionCard({
  group,
  routeStatus,
  isApproved,
  isRejected
}: {
  group: IntakeGroup;
  routeStatus: RouteStatus;
  isApproved: boolean;
  isRejected: boolean;
}) {
  const warnings = warningsForGroup(group);
  const readinessIssues = readinessIssuesForGroup(group);
  const aiConfidence = group.aiExtraction?.confidenceScore;
  const missingFront = warnings.find((warning) => warning.toLowerCase().includes("front"));
  const missingImage = warnings.find((warning) => warning.toLowerCase().includes("missing"));
  const requiredIssue = readinessIssues.find((issue) => !issue.toLowerCase().includes("confidence") && !issue.toLowerCase().includes("front") && !issue.toLowerCase().includes("back"));
  const completeRecord = readinessIssues.length === 0;
  const readyForApproval = routeStatus === "Ready to Approve";

  return (
    <section className="mt-5 rounded-lg border border-acv-border bg-acv-panel/95 p-4 shadow-glow">
      <div className="mb-4 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Approval Decision</p>
        <p className="mt-1 text-xs text-acv-muted">This is the final review before an item becomes inventory.</p>
      </div>

      <div className="mb-4 rounded-lg border border-acv-border bg-black/20 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Decision Summary</p>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <DecisionSummaryItem state={missingFront ? "blocked" : missingImage ? "warning" : "ready"}>{missingImage || "Images paired"}</DecisionSummaryItem>
          <DecisionSummaryItem state={safeConfidence(group) >= 90 ? "ready" : "warning"}>Pairing check: {safeConfidence(group)}%</DecisionSummaryItem>
          <DecisionSummaryItem state={aiConfidence === undefined ? "warning" : aiConfidence >= 90 ? "ready" : aiConfidence >= 70 ? "warning" : "blocked"}>{aiConfidence === undefined ? "AI confidence: Not run" : `AI confidence: ${aiConfidence}%`}</DecisionSummaryItem>
          <DecisionSummaryItem state={completeRecord ? "ready" : "warning"}>{completeRecord ? "Required fields complete" : requiredIssue || readinessIssues[0] || "Review recommended"}</DecisionSummaryItem>
          <DecisionSummaryItem state={isApproved ? "ready" : readyForApproval ? "ready" : "warning"}>{isApproved ? "SKU assigned" : readyForApproval ? "Ready for SKU assignment" : "SKU assignment needs review"}</DecisionSummaryItem>
          <DecisionSummaryItem state={isRejected ? "blocked" : isApproved ? "ready" : readyForApproval ? "ready" : "warning"}>{isRejected ? "Rejected from inventory" : isApproved ? "Inventory item created" : readyForApproval ? "Ready for Inventory" : "Inventory approval paused"}</DecisionSummaryItem>
        </div>
      </div>
    </section>
  );
}

function StickyApprovalBar({
  group,
  isApproved,
  isRejected,
  isProcessing,
  onSave,
  onSwapFrontBack,
  onApprove,
  onResearch,
  onReject,
  onUndoReject
}: {
  group: IntakeGroup;
  isApproved: boolean;
  isRejected: boolean;
  isProcessing?: boolean;
  onSave: (id: string) => void;
  onSwapFrontBack: (id: string) => void;
  onApprove: (id: string) => void | Promise<void>;
  onResearch: (id: string) => void | Promise<void>;
  onReject: (id: string) => void | Promise<void>;
  onUndoReject: (id: string) => void;
}) {
  const disabled = Boolean(isProcessing);

  return (
    <div className="shrink-0 border-t border-acv-border bg-acv-black/95 px-4 py-3 shadow-[0_-16px_30px_rgba(0,0,0,0.35)]">
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniButton tone="teal" icon={<Save className="h-4 w-4" />} className="h-11 w-full text-xs" disabled={disabled} onClick={() => onSave(group.id)}>
          Save Group
        </MiniButton>
        <MiniButton tone="gold" icon={<ArrowLeftRight className="h-4 w-4" />} className="h-11 w-full text-xs" disabled={disabled} onClick={() => onSwapFrontBack(group.id)}>
          Swap Front/Back
        </MiniButton>
        <MiniButton tone="teal" icon={<BadgeCheck className="h-4 w-4" />} className="h-11 w-full text-xs" disabled={disabled || isApproved || isRejected} onClick={() => onApprove(group.id)}>
          {isProcessing ? "Working..." : isApproved ? "Approved" : "Approve to Inventory"}
        </MiniButton>
        <MiniButton icon={<FileSearch className="h-4 w-4" />} className="h-11 w-full text-xs" disabled={disabled || isApproved || isRejected} onClick={() => onResearch(group.id)}>
          Send to Research
        </MiniButton>
        <MiniButton tone="pink" icon={<XCircle className="h-4 w-4" />} className="h-11 w-full text-xs" disabled={disabled} onClick={() => (isRejected ? onUndoReject(group.id) : onReject(group.id))}>
          {isRejected ? "Undo Reject" : "Reject Group"}
        </MiniButton>
      </div>
    </div>
  );
}

class ReviewDrawerErrorBoundary extends Component<
  {
    children: React.ReactNode;
    context: Record<string, unknown>;
    onClose: () => void;
    onRefresh: () => void;
  },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logIntakeException("review drawer render", error, {
      ...this.props.context,
      componentStack: info.componentStack
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm sm:left-56">
        <button type="button" aria-label="Close intake review drawer" className="absolute inset-0 cursor-default" onClick={this.props.onClose} />
        <aside className="relative z-10 flex h-full w-full max-w-5xl flex-col border-l border-acv-border bg-acv-black shadow-glow">
          <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-pink">Review Recovery</p>
              <h2 className="truncate text-lg font-semibold text-acv-text">Photo Intake review hit a render snag</h2>
              <p className="mt-1 text-xs text-acv-muted">The intake action was contained so ACV OS can keep running.</p>
            </div>
            <button
              type="button"
              title="Close"
              onClick={this.props.onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-acv-border text-acv-muted transition hover:text-acv-teal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-start p-5">
            <div className="w-full rounded-lg border border-acv-border bg-acv-panel p-4">
              <AlertRow tone="pink">The review drawer could not render this group state. Close review or refresh the intake selection to continue.</AlertRow>
              {process.env.NODE_ENV !== "production" && (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-acv-border bg-black/30 p-3 text-[11px] leading-5 text-acv-muted">
                  {this.state.error.message}
                </pre>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <MiniButton tone="teal" onClick={this.props.onClose}>Close Review</MiniButton>
                <MiniButton icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={this.props.onRefresh}>Refresh Intake</MiniButton>
              </div>
            </div>
          </div>
        </aside>
      </div>
    );
  }
}

function EditableField({
  label,
  value,
  onChange,
  tone,
  multiline = false,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tone?: StatusTone;
  multiline?: boolean;
  type?: "text" | "number";
}) {
  const toneClass =
    tone === "gold"
      ? "focus:border-acv-gold/70"
      : tone === "teal"
        ? "focus:border-acv-teal/70"
        : tone === "pink"
          ? "focus:border-acv-pink/70"
          : "focus:border-acv-teal/60";

  return (
    <label className={cn("min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2", multiline && "sm:col-span-2 xl:col-span-3")}>
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className={cn("mt-1 w-full resize-none bg-transparent text-xs font-semibold leading-5 text-acv-text outline-none transition", toneClass)}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn("mt-1 w-full min-w-0 bg-transparent text-xs font-semibold text-acv-text outline-none transition", toneClass)}
        />
      )}
    </label>
  );
}

function EditableNumberField({
  label,
  value,
  onChange,
  min,
  tone
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  tone?: StatusTone;
}) {
  return (
    <EditableField
      label={label}
      type="number"
      value={Number.isFinite(value) ? String(value) : "0"}
      tone={tone}
      onChange={(nextValue) => onChange(Math.max(min ?? Number.NEGATIVE_INFINITY, Number(nextValue) || 0))}
    />
  );
}

function EditableSelectField({
  label,
  value,
  options,
  onChange,
  tone
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  tone?: StatusTone;
}) {
  const toneClass =
    tone === "gold"
      ? "focus:border-acv-gold/70"
      : tone === "teal"
        ? "focus:border-acv-teal/70"
        : tone === "pink"
          ? "focus:border-acv-pink/70"
          : "focus:border-acv-teal/60";

  return (
    <label className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2">
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">{label}</span>
      <select
        value={value || options[0]}
        onChange={(event) => onChange(event.target.value)}
        className={cn("mt-1 w-full min-w-0 bg-transparent text-xs font-semibold text-acv-text outline-none transition", toneClass)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditableFlag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs font-semibold text-acv-text transition hover:border-acv-teal/50"
    >
      <span className="truncate">{label}</span>
      <StatusPill tone={checked ? "teal" : "neutral"}>{checked ? "Yes" : "No"}</StatusPill>
    </button>
  );
}

function ReviewDrawer({
  group,
  skuStatus,
  assignedSku,
  isApproved,
  isRejected,
  isResearch,
  isExtracting,
  isProcessingAction,
  onClose,
  onSave,
  onSwapFrontBack,
  onRoleChange,
  onSetImageRole,
  onMoveImage,
  onUpdateProposed,
  onRunExtraction,
  onClearExtraction,
  onApplyAiSuggestion,
  onApplySuggestedTitle,
  onApprove,
  onResearch,
  onReject,
  onUndoReject
}: {
  group: IntakeGroup;
  skuStatus: SkuStatus;
  assignedSku: string;
  isApproved: boolean;
  isRejected: boolean;
  isResearch: boolean;
  isExtracting: boolean;
  isProcessingAction?: boolean;
  onClose: () => void;
  onSave: (id: string) => void;
  onSwapFrontBack: (id: string) => void;
  onRoleChange: (groupId: string, imageId: string, role: ImageRole) => void;
  onSetImageRole: (groupId: string, imageId: string, role: ImageRole) => void;
  onMoveImage: (groupId: string, imageId: string, direction: -1 | 1) => void;
  onUpdateProposed: <K extends keyof ProposedRecord>(groupId: string, key: K, value: ProposedRecord[K]) => void;
  onRunExtraction: (groupId: string) => void | Promise<void>;
  onClearExtraction: (groupId: string) => void;
  onApplyAiSuggestion: (groupId: string) => void;
  onApplySuggestedTitle: (groupId: string, title: string) => void;
  onApprove: (id: string) => void | Promise<void>;
  onResearch: (id: string) => void | Promise<void>;
  onReject: (id: string) => void | Promise<void>;
  onUndoReject: (id: string) => void;
}) {
  const [showAiWarnings, setShowAiWarnings] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const groupImages = safeImages(group);
  const proposed = safeProposed(group);
  const pairingConfidence = safeConfidence(group);
  const routeStatus: RouteStatus = isRejected ? "Blocked" : isResearch ? "Needs Research" : statusForGroup(group);
  const skuDisplay = skuStatus === "SKU Assigned" ? `${assignedSku} mock` : "Pending Approval";
  const drawerSkuTone = skuStatus === "SKU Assigned" ? "green" : "purple";
  const warnings = warningsForGroup(group);
  const readinessIssues = readinessIssuesForGroup(group);
  const aiStatus = aiStatusForGroup(group);
  const aiWarnings = group.aiExtraction?.warnings || [];
  const catalogDiagnostics = group.aiExtraction?.catalogDiagnostics;
  const providerDiagnostics = group.aiExtraction?.providerDiagnostics || [];
  const fieldConfidence = group.aiExtraction?.fieldConfidence || {};
  const fieldConfidenceEntries = Object.entries(fieldConfidence).filter(([, value]) => typeof value === "number");
  const confirmedFieldEntries = (group.confirmedFields || []).map((field) => fieldConfidenceLabel(String(field))).slice(0, 12);
  const needsReviewEntries = readinessIssues.slice(0, 8);
  const marketplaceTitle = marketplaceTitleForRecord(proposed, catalogDiagnostics);
  const recommendedEbayTitle = marketplaceTitle.ebayTitle;
  const hasAiSuggestion = Boolean(group.aiExtraction?.extracted || group.aiExtraction?.suggestedTitle);
  const aiProviderLabel = group.aiExtraction?.modelLabel ? "ACV AI Orchestrator" : "Ready";

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
              <StatusPill tone={confidenceTone(pairingConfidence)}>Pairing {pairingConfidence}%</StatusPill>
              <StatusPill tone={toneForAiStatus(aiStatus)}>AI: {aiStatus}</StatusPill>
            </div>
            <h2 className="truncate text-lg font-semibold text-acv-text">{proposed.cardName}</h2>
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
          <div className="acv-scrollbar min-h-0 flex-1 overflow-y-auto p-5 pb-28">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <section className="min-w-0 rounded-lg border border-acv-border bg-acv-panel p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">Group Images</p>
                    <p className="mt-1 text-xs text-acv-muted">Role controls are staged for future approved image ordering.</p>
                  </div>
                  <StatusPill tone="teal">{groupImages.length} images</StatusPill>
                </div>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {groupImages.map((image, imageIndex) => (
                    <div key={image.id} className="min-w-0 space-y-2">
                      <ImagePlaceholder image={image} large />
                      <select
                        aria-label={`Role for ${image.label}`}
                        value={image.role}
                        onChange={(event) => onRoleChange(group.id, image.id, event.target.value as ImageRole)}
                        className="h-8 w-full rounded-md border border-acv-border bg-acv-panel2 px-2 text-xs font-semibold text-acv-text outline-none"
                      >
                        {imageRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <MiniButton onClick={() => onSetImageRole(group.id, image.id, "Front")}>Set Front</MiniButton>
                        <MiniButton onClick={() => onSetImageRole(group.id, image.id, "Back")}>Set Back</MiniButton>
                        <MiniButton onClick={() => onMoveImage(group.id, image.id, -1)} className={imageIndex === 0 ? "opacity-45" : undefined}>
                          Move Up
                        </MiniButton>
                        <MiniButton onClick={() => onMoveImage(group.id, image.id, 1)} className={imageIndex === groupImages.length - 1 ? "opacity-45" : undefined}>
                          Move Down
                        </MiniButton>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-acv-border bg-acv-panel p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">Manual / AI Extraction Form</p>
                    <p className="mt-1 text-xs text-acv-muted">AI will eventually pre-fill this exact form. For now, edit it manually before approval.</p>
                  </div>
                  <StatusPill tone={toneForStatus(routeStatus)}>{routeStatus}</StatusPill>
                </div>

                <div className="mb-3 rounded-lg border border-acv-border bg-acv-panel2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneForAiStatus(aiStatus)}>AI Extraction: {aiStatus}</StatusPill>
                        {(aiStatus === "Extracted" || aiStatus === "Needs Review") && <StatusPill tone="teal">{aiProviderLabel}</StatusPill>}
                        {group.aiExtraction?.confidenceScore !== undefined && <StatusPill tone={confidenceTone(group.aiExtraction.confidenceScore)}>AI {group.aiExtraction.confidenceScore}%</StatusPill>}
                        <StatusPill tone={confidenceTone(pairingConfidence)}>Pairing {pairingConfidence}%</StatusPill>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-acv-muted">
                        Extraction runs only when clicked, fills this editable form, and never approves inventory automatically.
                      </p>
                    </div>
                    <div className="flex min-w-0 shrink-0 flex-wrap justify-end gap-2">
                      <MiniButton tone="teal" icon={<Sparkles className="h-3.5 w-3.5" />} disabled={isExtracting} onClick={() => onRunExtraction(group.id)}>
                        {isExtracting ? "Running..." : aiStatus === "Extracted" || aiStatus === "Needs Review" ? "Re-run Extraction" : "Run AI Extraction"}
                      </MiniButton>
                      <MiniButton icon={<RefreshCw className="h-3.5 w-3.5" />} disabled={!hasAiSuggestion} onClick={() => onApplyAiSuggestion(group.id)}>
                        Apply AI Suggestion
                      </MiniButton>
                      <MiniButton tone="pink" icon={<Eraser className="h-3.5 w-3.5" />} disabled={aiStatus === "Not Run"} onClick={() => onClearExtraction(group.id)}>
                        Clear Extraction
                      </MiniButton>
                    </div>
                  </div>
                </div>

                <div className="mb-3 rounded-lg border border-acv-border bg-acv-panel2 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Recommended eBay Title</p>
                      <p className="mt-1 truncate text-sm font-semibold text-acv-text">{recommendedEbayTitle}</p>
                      <p className="mt-1 text-[11px] text-acv-muted">
                        {marketplaceTitle.characterCount}/80 chars • {marketplaceTitle.provider === "pokemon" ? "Pokemon rules" : marketplaceTitle.provider === "sports" ? "Sports rules" : "Generic rules"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <MiniButton
                        tone="teal"
                        onClick={() => {
                          onApplySuggestedTitle(group.id, recommendedEbayTitle);
                        }}
                      >
                        Apply Suggested Title
                      </MiniButton>
                      <MiniButton
                        icon={<ClipboardCopy className="h-3.5 w-3.5" />}
                        onClick={() => {
                          window.navigator.clipboard?.writeText(recommendedEbayTitle);
                        }}
                      >
                        Copy
                      </MiniButton>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <EditableField label="Card title / display name" value={proposed.cardName} tone="gold" onChange={(value) => onUpdateProposed(group.id, "cardName", value)} />
                  <EditableField label="Player / Character" value={proposed.playerCharacter} onChange={(value) => onUpdateProposed(group.id, "playerCharacter", value)} />
                  <EditableField label="Team" value={proposed.team} onChange={(value) => onUpdateProposed(group.id, "team", value)} />
                  <EditableSelectField label="Sport / Category" value={proposed.category} options={categoryOptions} onChange={(value) => onUpdateProposed(group.id, "category", value)} />
                  <EditableField label="Year" value={proposed.year} onChange={(value) => onUpdateProposed(group.id, "year", value)} />
                  <EditableField label="Brand" value={proposed.brand} onChange={(value) => onUpdateProposed(group.id, "brand", value)} />
                  <EditableField label="Set" value={proposed.set} onChange={(value) => onUpdateProposed(group.id, "set", value)} />
                  <EditableField label="Card Number" value={proposed.cardNumber} onChange={(value) => onUpdateProposed(group.id, "cardNumber", value)} />
                  <EditableField label="Parallel" value={proposed.parallel} onChange={(value) => onUpdateProposed(group.id, "parallel", value)} />
                  <EditableField label="Serial Number" value={proposed.serialNumber} onChange={(value) => onUpdateProposed(group.id, "serialNumber", value)} />
                  <EditableSelectField label="Grader" value={proposed.grader || "Raw"} options={graderOptions} onChange={(value) => onUpdateProposed(group.id, "grader", value)} />
                  <EditableSelectField label="Grade" value={proposed.grade || "Raw"} options={gradeOptions} onChange={(value) => onUpdateProposed(group.id, "grade", value)} />
                  <EditableFlag label="Rookie" checked={proposed.rookieFlag} onChange={(value) => onUpdateProposed(group.id, "rookieFlag", value)} />
                  <EditableFlag label="Auto" checked={proposed.autoFlag} onChange={(value) => onUpdateProposed(group.id, "autoFlag", value)} />
                  <EditableFlag label="Relic" checked={proposed.relicFlag} onChange={(value) => onUpdateProposed(group.id, "relicFlag", value)} />
                  <EditableFlag label="Variation" checked={proposed.variationFlag} onChange={(value) => onUpdateProposed(group.id, "variationFlag", value)} />
                  <EditableNumberField label="Purchase Cost" value={proposed.purchaseCost ?? 0} min={0} tone="pink" onChange={(value) => onUpdateProposed(group.id, "purchaseCost", value)} />
                  <EditableNumberField label="Quantity" value={proposed.quantity || 1} min={1} onChange={(value) => onUpdateProposed(group.id, "quantity", Math.max(1, Math.round(value)))} />
                  <EditableSelectField label="Source / Acquisition Source" value={proposed.acquisitionSource || "Computer Upload"} options={acquisitionSourceOptions} onChange={(value) => onUpdateProposed(group.id, "acquisitionSource", value)} />
                  <EditableField label="Location Placeholder" value={proposed.location || ""} onChange={(value) => onUpdateProposed(group.id, "location", value)} />
                  <EditableField label="Condition Notes" value={proposed.conditionNotes} multiline onChange={(value) => onUpdateProposed(group.id, "conditionNotes", value)} />
                  <EditableField label="Uncertainty Notes" value={proposed.uncertaintyNotes} multiline onChange={(value) => onUpdateProposed(group.id, "uncertaintyNotes", value)} />
                  <EditableField label="Internal Notes" value={proposed.internalNotes || ""} multiline onChange={(value) => onUpdateProposed(group.id, "internalNotes", value)} />
                </div>
                <ParallelRecognitionPanel recognition={group.aiExtraction?.parallelRecognition} finalParallel={proposed.parallel} confirmedFields={group.confirmedFields} />
                <div className="mt-3 rounded-lg border border-acv-border bg-acv-panel2 p-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Warnings</p>
                      <p className="mt-1 text-[11px] text-acv-muted">AI and readiness warnings stay reviewable without taking over the form.</p>
                    </div>
                    <ToggleSwitch label="Warnings" checked={showAiWarnings} onChange={setShowAiWarnings} />
                  </div>
                  {showAiWarnings && (
                    <div className="mt-3 grid min-w-0 gap-2">
                      {Array.from(new Set([...aiWarnings, ...readinessIssues, ...warnings])).length > 0 ? (
                        Array.from(new Set([...aiWarnings, ...readinessIssues, ...warnings])).map((issue) => (
                          <AlertRow key={issue} tone={issue.toLowerCase().includes("confidence") ? "gold" : issue.toLowerCase().includes("missing") || issue.toLowerCase().includes("blocked") ? "pink" : "gold"}>
                            {issue}
                          </AlertRow>
                        ))
                      ) : (
                        <AlertRow tone="neutral">No active warnings.</AlertRow>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 rounded-lg border border-acv-border bg-acv-panel2 p-3">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Diagnostics</p>
                      <p className="mt-1 text-[11px] text-acv-muted">Provider, field confidence, and catalog details for development review.</p>
                    </div>
                    <ToggleSwitch label="Diagnostics" checked={showDiagnostics} onChange={setShowDiagnostics} />
                  </div>
                  {showDiagnostics && (
                    <div className="mt-3 grid min-w-0 gap-3">
                      {fieldConfidenceEntries.length > 0 && (
                        <div className="min-w-0 rounded-md border border-acv-border bg-black/20 p-2">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Field Confidence</p>
                          <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
                            {group.aiExtraction?.confidenceScore !== undefined && (
                              <AlertRow tone="neutral">AI Extraction Confidence: {group.aiExtraction.confidenceScore}%</AlertRow>
                            )}
                            {fieldConfidenceEntries.slice(0, 12).map(([key, value]) => (
                              <div key={key} className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 px-2 py-1.5 text-[11px] font-semibold leading-4 text-acv-text">
                                <span className="text-acv-muted">{fieldConfidenceLabel(key)}:</span> <span className={cn(Number(value) >= 90 ? "text-acv-teal" : Number(value) >= 70 ? "text-acv-gold" : "text-acv-pink")}>{value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(confirmedFieldEntries.length > 0 || needsReviewEntries.length > 0) && (
                        <div className="min-w-0 rounded-md border border-acv-border bg-black/20 p-2">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Confirmed / Needs Review</p>
                          <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
                            {confirmedFieldEntries.length > 0 ? (
                              <AlertRow tone="neutral">Confirmed fields: {confirmedFieldEntries.join(", ")}</AlertRow>
                            ) : (
                              <AlertRow tone="neutral">Confirmed fields appear after manual edits are saved or approved.</AlertRow>
                            )}
                            {needsReviewEntries.length > 0 ? (
                              <AlertRow tone="gold">Needs review: {needsReviewEntries.join(", ")}</AlertRow>
                            ) : (
                              <AlertRow tone="neutral">No required fields are currently missing.</AlertRow>
                            )}
                          </div>
                        </div>
                      )}

                      {catalogDiagnostics && (
                        <div className="min-w-0 rounded-md border border-acv-border bg-black/20 p-2">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Catalog Validation</p>
                          <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
                            <AlertRow tone="neutral">{catalogDiagnostics.providerName}: {catalogDiagnostics.status.replace("_", " ")}</AlertRow>
                            {catalogDiagnostics.confidence !== undefined && <AlertRow tone="neutral">Confidence: {catalogDiagnostics.confidence}%</AlertRow>}
                            {catalogDiagnostics.matchedCard && <AlertRow tone="neutral">Card: {catalogDiagnostics.matchedCard}</AlertRow>}
                            {catalogDiagnostics.matchedSet && <AlertRow tone="neutral">Set: {catalogDiagnostics.matchedSet}</AlertRow>}
                            {catalogDiagnostics.matchedNumber && <AlertRow tone="neutral">Number: #{catalogDiagnostics.matchedNumber}</AlertRow>}
                            {catalogDiagnostics.matchedTeam && <AlertRow tone="neutral">Team: {catalogDiagnostics.matchedTeam}</AlertRow>}
                            {catalogDiagnostics.matchedProduct && <AlertRow tone="neutral">Product: {catalogDiagnostics.matchedProduct}</AlertRow>}
                            {catalogDiagnostics.matchedSubset && <AlertRow tone="neutral">Subset: {catalogDiagnostics.matchedSubset}</AlertRow>}
                            {catalogDiagnostics.candidateCount !== undefined && <AlertRow tone="neutral">Candidates: {catalogDiagnostics.candidateCount}</AlertRow>}
                            {catalogDiagnostics.sourceName && <AlertRow tone="neutral">Source: {catalogDiagnostics.sourceName}</AlertRow>}
                            {catalogDiagnostics.rarity && <AlertRow tone="neutral">Rarity: {catalogDiagnostics.rarity}</AlertRow>}
                          </div>
                          {catalogDiagnostics.warnings.length > 0 && (
                            <div className="mt-2 grid min-w-0 gap-2">
                              {catalogDiagnostics.warnings.map((warning) => (
                                <AlertRow key={warning} tone={warning.toLowerCase().includes("unavailable") ? "neutral" : "gold"}>
                                  {warning}
                                </AlertRow>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {providerDiagnostics.length > 0 && (
                        <div className="min-w-0 rounded-md border border-acv-border bg-black/20 p-2">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-acv-muted">Provider Diagnostics</p>
                          <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                            {providerDiagnostics.map((diagnostic) => (
                              <div key={`${diagnostic.providerName}-${diagnostic.status}`} className="min-w-0 rounded-md border border-acv-border bg-acv-panel2 p-2">
                                <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
                                  <AlertRow tone="neutral">{diagnostic.providerName}: {diagnostic.status}</AlertRow>
                                  <AlertRow tone="neutral">Mode: {diagnostic.mode}</AlertRow>
                                  {diagnostic.confidence !== undefined && <AlertRow tone="neutral">Confidence: {diagnostic.confidence}%</AlertRow>}
                                </div>
                                <p className="mt-2 break-words text-[11px] leading-5 text-acv-muted">{diagnostic.reason}</p>
                                {diagnostic.mappedFields && diagnostic.mappedFields.length > 0 && (
                                  <div className="mt-2 grid min-w-0 gap-1.5 sm:grid-cols-2">
                                    {diagnostic.mappedFields.map((field) => (
                                      <AlertRow key={`${diagnostic.providerName}-${field.label}-${field.value}`} tone="neutral">
                                        {field.label}: {field.value}
                                      </AlertRow>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <ApprovalDecisionCard
              group={group}
              routeStatus={routeStatus}
              isApproved={isApproved}
              isRejected={isRejected}
            />
          </div>
          <StickyApprovalBar
            group={group}
            isApproved={isApproved}
            isRejected={isRejected}
            onSave={onSave}
            onSwapFrontBack={onSwapFrontBack}
            onApprove={onApprove}
            onResearch={onResearch}
            onReject={onReject}
            onUndoReject={onUndoReject}
            isProcessing={isProcessingAction}
          />
        </div>
      </aside>
    </div>
  );
}

function toneForBatchStatus(status: string): StatusTone {
  if (status === "Complete" || status === "Completed") return "green";
  if (status === "Reviewing" || status === "In Review") return "teal";
  if (status === "Needs Research") return "gold";
  if (status === "Rejected") return "pink";
  return "neutral";
}

function BatchMetadataStrip({
  batchName,
  batchId,
  source,
  createdAt,
  totalCards,
  status
}: {
  batchName: string;
  batchId: string;
  source: SourceKey;
  createdAt: string;
  totalCards: number;
  status: string;
}) {
  return (
    <section className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-2 rounded-lg border border-acv-border bg-acv-panel px-3 py-3">
      <FieldRow label="Batch" value={batchName || "Untitled Batch"} tone="gold" />
      <FieldRow label="Batch ID" value={batchId} tone="purple" />
      <FieldRow label="Source" value={source} tone="teal" />
      <FieldRow label="Created" value={formatBatchDate(createdAt, "long")} />
      <FieldRow label="Cards" value={totalCards} tone="teal" />
      <FieldRow label="Status" value={status} tone={toneForBatchStatus(status)} />
    </section>
  );
}

function BatchHistoryModal({
  currentBatch,
  batches,
  onClose,
  onRestore
}: {
  currentBatch: BatchHistoryEntry;
  batches: BatchHistoryEntry[];
  onClose: () => void;
  onRestore: (batch: BatchHistoryEntry) => void;
}) {
  const historyRows = [currentBatch, ...batches.filter((batch) => batch.batchId !== currentBatch.batchId)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Close batch history" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative z-10 flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-acv-border bg-acv-black shadow-glow">
        <div className="flex items-center justify-between gap-3 border-b border-acv-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-acv-gold">Batch Library</p>
            <h2 className="truncate text-lg font-semibold text-acv-text">Batch History</h2>
            <p className="mt-1 text-xs text-acv-muted">Restore a local intake session exactly where it left off. Mock browser state only.</p>
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

        <div className="acv-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-acv-panel2">
                <tr className="text-[10px] uppercase tracking-[0.12em] text-acv-muted">
                  <th className="border-b border-acv-border px-3 py-2">Batch</th>
                  <th className="border-b border-acv-border px-3 py-2">Created</th>
                  <th className="border-b border-acv-border px-3 py-2">Source</th>
                  <th className="border-b border-acv-border px-3 py-2">Cards</th>
                  <th className="border-b border-acv-border px-3 py-2">Status</th>
                  <th className="border-b border-acv-border px-3 py-2">Approved</th>
                  <th className="border-b border-acv-border px-3 py-2">Rejected</th>
                  <th className="border-b border-acv-border px-3 py-2">Remaining</th>
                  <th className="border-b border-acv-border px-3 py-2">Last Opened</th>
                  <th className="border-b border-acv-border px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((batch) => (
                  <tr key={batch.batchId} className="border-b border-acv-border transition hover:bg-white/[0.03]">
                    <td className="border-b border-acv-border px-3 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-acv-text">{batch.batchName || "Untitled Batch"}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-acv-gold">{batch.batchId}</p>
                      </div>
                    </td>
                    <td className="border-b border-acv-border px-3 py-3 text-acv-muted">{formatBatchDate(batch.createdDate)}</td>
                    <td className="border-b border-acv-border px-3 py-3 text-acv-muted">{batch.source}</td>
                    <td className="border-b border-acv-border px-3 py-3 font-semibold text-acv-text">{batch.cardCount}</td>
                    <td className="border-b border-acv-border px-3 py-3">
                      <StatusPill tone={toneForBatchStatus(batch.status)}>{batch.status}</StatusPill>
                    </td>
                    <td className="border-b border-acv-border px-3 py-3 font-semibold text-acv-green">{batch.approved}</td>
                    <td className="border-b border-acv-border px-3 py-3 font-semibold text-acv-pink">{batch.rejected}</td>
                    <td className="border-b border-acv-border px-3 py-3 font-semibold text-acv-gold">{batch.remaining}</td>
                    <td className="border-b border-acv-border px-3 py-3 text-acv-muted">{batch.lastOpened}</td>
                    <td className="border-b border-acv-border px-3 py-3 text-right">
                      <MiniButton tone={batch.batchId === currentBatch.batchId ? "teal" : "neutral"} onClick={() => onRestore(batch)}>
                        {batch.batchId === currentBatch.batchId ? "Current" : "Restore"}
                      </MiniButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function PhotoIntakePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSource, setActiveSource] = useState<SourceKey>("Computer Upload");
  const [showBatchHistory, setShowBatchHistory] = useState(false);
  const [extractingGroupId, setExtractingGroupId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<{ type: "approve" | "reject" | "research"; groupId: string } | null>(null);
  const {
    batchNumber,
    batchName,
    setBatchName,
    batchCreatedAt,
    imageCountMode,
    setImageCountMode,
    customImageCount,
    setCustomImageCount,
    autoPair,
    setAutoPair,
    aiPairingCheck,
    setAiPairingCheck,
    uploadedImages,
    setUploadedImages,
    groups,
    setGroups,
    selectedGroupId,
    setSelectedGroupId,
    drawerGroupId,
    setDrawerGroupId,
    selectedQueueIds,
    setSelectedQueueIds,
    approvedIds,
    setApprovedIds,
    researchIds,
    setResearchIds,
    rejectedIds,
    setRejectedIds,
    assignedSkus,
    setAssignedSkus,
    approvedInventory,
    setApprovedInventory,
    batchHistory,
    setBatchHistory,
    statusMessage,
    setStatusMessage,
    backendStatus,
    skuCounterRef,
    addUploadedFiles,
    clearIntakeState,
    restoreBatch,
    saveBatchSnapshotToBackend,
    approveGroupToBackend,
    updateGroupStatusInBackend
  } = useAcvLocalState();
  const batchId = `B-${String(batchNumber).padStart(3, "0")}`;

  const visibleGroups = useMemo(() => (activeSource === "Computer Upload" ? groups : []), [activeSource, groups]);
  const processedIds = useMemo(() => new Set([...Array.from(approvedIds), ...Array.from(rejectedIds)]), [approvedIds, rejectedIds]);
  const activeReviewGroups = useMemo(() => visibleGroups.filter((group) => !processedIds.has(group.id)), [processedIds, visibleGroups]);
  const selectedGroup = activeReviewGroups.find((group) => group.id === selectedGroupId) || activeReviewGroups[0] || null;
  const drawerGroup = drawerGroupId ? groups.find((group) => group.id === drawerGroupId) || null : null;
  const totalPhotos = uploadedImages.length;
  const perCard = imagesPerCard(imageCountMode, customImageCount);
  const estimatedCards = totalPhotos === 0 ? 0 : Math.ceil(totalPhotos / perCard);
  const pairedGroups = groups.filter((group) => statusForGroup(group) !== "Blocked").length;
  const reviewFlags = groups.reduce((total, group) => total + warningsForGroup(group).length, 0);
  const readyToApprove = activeReviewGroups.filter((group) => statusForGroup(group) === "Ready to Approve").length;
  const batchStatus = visibleGroups.length === 0 ? "Empty" : activeReviewGroups.length === 0 ? "Complete" : "Reviewing";
  const currentBatchEntry = useMemo<BatchHistoryEntry>(
    () => ({
      batchId,
      batchName: batchName || "Untitled Batch",
      createdDate: batchCreatedAt,
      source: activeSource,
      cardCount: visibleGroups.length,
      status: batchStatus,
      approved: approvedIds.size,
      rejected: rejectedIds.size,
      remaining: activeReviewGroups.length,
      lastOpened: new Date().toLocaleString(),
      uploadedImages,
      groups,
      selectedGroupId: selectedGroup?.id || selectedGroupId,
      approvedIds: Array.from(approvedIds),
      researchIds: Array.from(researchIds),
      rejectedIds: Array.from(rejectedIds),
      assignedSkus
    }),
    [
      activeReviewGroups.length,
      activeSource,
      approvedIds,
      assignedSkus,
      batchCreatedAt,
      batchId,
      batchName,
      batchStatus,
      groups,
      rejectedIds,
      researchIds,
      selectedGroup?.id,
      selectedGroupId,
      uploadedImages,
      visibleGroups.length
    ]
  );

  const allQueueSelected = activeReviewGroups.length > 0 && activeReviewGroups.every((group) => selectedQueueIds.has(group.id));

  useEffect(() => {
    if (backendStatus.connectionState !== "connected" || currentBatchEntry.groups.length === 0) return;
    const timeout = window.setTimeout(() => {
      void saveBatchSnapshotToBackend(currentBatchEntry);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [backendStatus.connectionState, currentBatchEntry, saveBatchSnapshotToBackend]);

  useEffect(() => {
    if (!drawerGroupId) return;
    const groupStillExists = groups.some((group) => group.id === drawerGroupId);
    if (!groupStillExists || approvedIds.has(drawerGroupId) || rejectedIds.has(drawerGroupId)) {
      logIntakeDev("Closing stale review drawer", {
        batchId,
        drawerGroupId,
        groupStillExists,
        approved: approvedIds.has(drawerGroupId),
        rejected: rejectedIds.has(drawerGroupId)
      });
      setDrawerGroupId(null);
    }
  }, [approvedIds, batchId, drawerGroupId, groups, rejectedIds, setDrawerGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    if (activeReviewGroups.some((group) => group.id === selectedGroupId)) return;
    setSelectedGroupId(activeReviewGroups[0]?.id || "");
  }, [activeReviewGroups, selectedGroupId, setSelectedGroupId]);

  function queueStatus(group: IntakeGroup): QueueStatus {
    if (approvedIds.has(group.id)) return "Approved Local";
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
    return assignedSkus[group.id] || "Pending Approval";
  }

  function buildMockSku(group: IntakeGroup, sequence: number) {
    const proposed = safeProposed(group);
    const code = skuCategoryCodes[proposed.category] || proposed.category.slice(0, 3).toUpperCase() || "GEN";
    return `ACV-${code}-${String(sequence).padStart(6, "0")}`;
  }

  function resetWorkflowForGroups(nextGroups: IntakeGroup[]) {
    setGroups(nextGroups);
    setSelectedGroupId(nextGroups[0]?.id || "");
    setDrawerGroupId(null);
    setSelectedQueueIds(new Set());
    setApprovedIds(new Set());
    setResearchIds(new Set());
    setRejectedIds(new Set());
    setAssignedSkus({});
  }

  function regroupImages(images: UploadedImage[], mode: ImageCountMode, customCount: number) {
    const nextGroups = buildGroupsFromUploads({ uploadedImages: images, batchId, mode, customCount });
    resetWorkflowForGroups(nextGroups);
    return nextGroups;
  }

  function handleFiles(files: FileList | File[]) {
    const nextImages = addUploadedFiles(files);
    const addedCount = nextImages.length - uploadedImages.length;

    if (addedCount <= 0) {
      setStatusMessage("No supported image files found. Use jpg, jpeg, png, webp, or browser-supported heic.");
      return;
    }

    const nextGroups = regroupImages(nextImages, imageCountMode, customImageCount);
    setStatusMessage(`${addedCount} photo${addedCount === 1 ? "" : "s"} uploaded locally. ${nextGroups.length} group${nextGroups.length === 1 ? "" : "s"} generated from upload order.`);
  }

  function clearBatch() {
    if (!window.confirm("Clear the current local intake batch? Uploaded groups, approval state, and mock inventory from this batch will be removed.")) return;
    clearIntakeState();
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
      activeReviewGroups.forEach((group) => {
        if (checked) next.add(group.id);
        else next.delete(group.id);
      });
      return next;
    });
  }

  function nextActiveGroupId(currentId: string) {
    return visibleGroups.find((group) => group.id !== currentId && !approvedIds.has(group.id) && !rejectedIds.has(group.id))?.id || "";
  }

  function advanceAfterProcessed(id: string, keepDrawerOpen = false) {
    const nextId = nextActiveGroupId(id);
    setSelectedGroupId(nextId);
    setSelectedQueueIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setDrawerGroupId(keepDrawerOpen && nextId ? nextId : null);
    return nextId;
  }

  async function approveGroup(id: string, keepDrawerOpen = false) {
    const actionContext = {
      actionType: "approve",
      batchId: currentBatchEntry.batchId,
      selectedGroupId,
      drawerGroupId,
      groupId: id
    };
    setProcessingAction({ type: "approve", groupId: id });

    try {
      const group = groups.find((item) => item.id === id);
      if (!group) {
        setDrawerGroupId(null);
        setStatusMessage(`${id} is no longer in the active intake queue.`);
        return null;
      }

      logIntakeDev("Approve started", {
        ...actionContext,
        images: safeImages(group).map((image) => ({ id: image.id, role: image.role, fileName: image.fileName }))
      });

      if (approvedIds.has(id)) {
        setDrawerGroupId(null);
        setStatusMessage(`${group.id} already has SKU ${assignedSkuForGroup(group)}. Repeated approval is disabled.`);
        return null;
      }

      if (rejectedIds.has(id)) {
        setStatusMessage(`${group.id} is rejected. Undo reject before approving.`);
        return null;
      }

      const groupImages = safeImages(group);
      if (!groupImages.some((image) => image.role === "Front")) {
        setResearchIds((current) => new Set(current).add(id));
        setDrawerGroupId(null);
        setStatusMessage(`${group.id} needs review before approval: missing Front image.`);
        return null;
      }

      if (researchIds.has(id)) {
        setStatusMessage(`${group.id} is marked Needs Research. Save corrections before approving to Inventory.`);
        return null;
      }

      const approvalStatus = statusForGroup(group);
      if (approvalStatus !== "Ready to Approve") {
        const issues = readinessIssuesForGroup(group).slice(0, 2).join(", ") || approvalStatus;
        setStatusMessage(`${group.id} is not ready for inventory approval: ${issues}.`);
        return null;
      }

      const nextSku = assignedSkus[id] || buildMockSku(group, skuCounterRef.current);
      const primaryImage = groupImages.find((image) => image.role === "Front") || groupImages[0];
      const approvedItem = {
        sku: nextSku,
        batch: group.batch,
        group: group.id,
        source: group.source,
        primaryImageUrl: primaryImage?.dataUrl || primaryImage?.url || primaryImage?.publicUrl || "",
        needsImageReupload: Boolean(primaryImage?.needsReupload || !(primaryImage?.dataUrl || primaryImage?.url || primaryImage?.publicUrl)),
        images: groupImages,
        proposed: safeProposed(group),
        aiConfidence: group.aiExtraction?.confidenceScore,
        confirmedFields: Object.keys(safeProposed(group)) as Array<keyof ProposedRecord>,
        parallelRecognition: group.aiExtraction?.parallelRecognition,
        approvedAt: new Date().toLocaleString()
      };
      const approvedEntry = {
        ...currentBatchEntry,
        approved: approvedIds.has(id) ? approvedIds.size : approvedIds.size + 1,
        rejected: rejectedIds.size,
        remaining: Math.max(0, currentBatchEntry.remaining - 1),
        approvedIds: Array.from(new Set([...currentBatchEntry.approvedIds, id])),
        rejectedIds: currentBatchEntry.rejectedIds.filter((groupId) => groupId !== id),
        researchIds: currentBatchEntry.researchIds.filter((groupId) => groupId !== id),
        assignedSkus: { ...currentBatchEntry.assignedSkus, [id]: nextSku }
      };

      await approveGroupToBackend(approvedEntry, group, approvedItem);
      const cachedApprovedItem = compactApprovedInventoryItemForCache(approvedItem);
      const approvedUploadIds = new Set(groupImages.map((image) => image.uploadId).filter(Boolean) as string[]);

      if (!assignedSkus[id]) skuCounterRef.current += 1;
      setAssignedSkus((current) => ({ ...current, [id]: current[id] || nextSku }));
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
      setUploadedImages((current) => current.map((image) => (approvedUploadIds.has(image.id) ? compactUploadedImageForCache(image) : image)));
      setGroups((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                images: item.images.map((image) => compactIntakeImageForCache(image))
              }
            : item
        )
      );
      setApprovedInventory((current) => {
        return current.some((item) => item.group === id) ? current.map((item) => (item.group === id ? cachedApprovedItem : item)) : [...current, cachedApprovedItem];
      });

      const nextId = advanceAfterProcessed(id, keepDrawerOpen);
      setStatusMessage(`Approved to Inventory: ${nextSku}.${nextId ? ` Next group: ${nextId}.` : " Batch review complete."}`);
      logIntakeDev("Approve completed", { ...actionContext, assignedSku: nextSku, nextGroupId: nextId || null });
      return nextId;
    } catch (error) {
      logIntakeException("approve transition", error, actionContext);
      setDrawerGroupId(null);
      setStatusMessage(`${id} could not finish the approval transition. The drawer was closed safely; refresh Intake if needed.`);
      return null;
    } finally {
      setProcessingAction((current) => (current?.type === "approve" && current.groupId === id ? null : current));
    }
  }

  async function sendToResearch(id: string) {
    const actionContext = {
      actionType: "research",
      batchId: currentBatchEntry.batchId,
      selectedGroupId,
      drawerGroupId,
      groupId: id
    };
    setProcessingAction({ type: "research", groupId: id });

    try {
      const group = groups.find((item) => item.id === id);
      if (!group) {
        setDrawerGroupId(null);
        setStatusMessage(`${id} is no longer in the active intake queue.`);
        return;
      }

      const researchEntry = {
        ...currentBatchEntry,
        researchIds: Array.from(new Set([...currentBatchEntry.researchIds, id])),
        approvedIds: currentBatchEntry.approvedIds.filter((groupId) => groupId !== id),
        rejectedIds: currentBatchEntry.rejectedIds.filter((groupId) => groupId !== id)
      };
      await updateGroupStatusInBackend(researchEntry, group, "Needs Research");

      setResearchIds((current) => new Set(current).add(id));
      setApprovedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setRejectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setDrawerGroupId(null);
      setStatusMessage(`${id} sent to research.`);
      logIntakeDev("Research completed", actionContext);
    } catch (error) {
      logIntakeException("research transition", error, actionContext);
      setDrawerGroupId(null);
      setStatusMessage(`${id} could not finish the research transition. The drawer was closed safely.`);
    } finally {
      setProcessingAction((current) => (current?.type === "research" && current.groupId === id ? null : current));
    }
  }

  async function rejectGroup(id: string, keepDrawerOpen = false) {
    const actionContext = {
      actionType: "reject",
      batchId: currentBatchEntry.batchId,
      selectedGroupId,
      drawerGroupId,
      groupId: id
    };
    setProcessingAction({ type: "reject", groupId: id });

    try {
      const group = groups.find((item) => item.id === id);
      if (!group) {
        setDrawerGroupId(null);
        setStatusMessage(`${id} is no longer in the active intake queue.`);
        return null;
      }

      const rejectedEntry = {
        ...currentBatchEntry,
        rejected: rejectedIds.has(id) ? rejectedIds.size : rejectedIds.size + 1,
        remaining: Math.max(0, currentBatchEntry.remaining - 1),
        rejectedIds: Array.from(new Set([...currentBatchEntry.rejectedIds, id])),
        approvedIds: currentBatchEntry.approvedIds.filter((groupId) => groupId !== id),
        researchIds: currentBatchEntry.researchIds.filter((groupId) => groupId !== id)
      };
      await updateGroupStatusInBackend(rejectedEntry, group, "Rejected");

      setRejectedIds((current) => new Set(current).add(id));
      setApprovedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setResearchIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });

      const nextId = advanceAfterProcessed(id, keepDrawerOpen);
      setStatusMessage(`${id} rejected.${nextId ? ` Next group: ${nextId}.` : " Batch review complete."}`);
      logIntakeDev("Reject completed", { ...actionContext, nextGroupId: nextId || null });
      return nextId;
    } catch (error) {
      logIntakeException("reject transition", error, actionContext);
      setDrawerGroupId(null);
      setStatusMessage(`${id} could not finish the rejection transition. The drawer was closed safely.`);
      return null;
    } finally {
      setProcessingAction((current) => (current?.type === "reject" && current.groupId === id ? null : current));
    }
  }

  function undoRejectGroup(id: string) {
    setRejectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setStatusMessage(`${id} rejection undone. Group is back in review history.`);
  }

  function openGroup(group: IntakeGroup) {
    setSelectedGroupId(group.id);
    setDrawerGroupId(group.id);
  }

  function updateGroup(groupId: string, updater: (group: IntakeGroup) => IntakeGroup) {
    setGroups((current) => current.map((group) => (group.id === groupId ? updater(group) : group)));
  }

  function updateImageRole(groupId: string, imageId: string, role: ImageRole) {
    updateGroup(groupId, (group) => {
      const nextGroup = { ...group, images: safeImages(group).map((image) => (image.id === imageId ? { ...image, role } : image)) };
      return { ...nextGroup, pairingStatus: pairingStatusForGroup(nextGroup) };
    });
  }

  function setImageRoleExclusive(groupId: string, imageId: string, role: ImageRole) {
    updateGroup(groupId, (group) => {
      const images: IntakeImage[] = safeImages(group).map((image) => {
        if (image.id === imageId) return { ...image, role };
        if (role === "Front" && image.role === "Front") return { ...image, role: "Detail / Closeup" };
        if (role === "Back" && image.role === "Back") return { ...image, role: "Detail / Closeup" };
        return image;
      });
      const nextGroup = {
        ...group,
        images
      };
      return { ...nextGroup, pairingStatus: pairingStatusForGroup(nextGroup) };
    });
  }

  function swapFrontBack(groupId: string) {
    updateGroup(groupId, (group) => {
      const images: IntakeImage[] = safeImages(group).map((image) =>
        image.role === "Front" ? { ...image, role: "Back" } : image.role === "Back" ? { ...image, role: "Front" } : image
      );
      const nextGroup = {
        ...group,
        images
      };
      return { ...nextGroup, pairingStatus: pairingStatusForGroup(nextGroup) };
    });
    setStatusMessage(`${groupId} front/back roles swapped locally.`);
  }

  function moveImage(groupId: string, imageId: string, direction: -1 | 1) {
    updateGroup(groupId, (group) => {
      const currentImages = safeImages(group);
      const index = currentImages.findIndex((image) => image.id === imageId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= currentImages.length) return group;
      const images = [...currentImages];
      const [moved] = images.splice(index, 1);
      images.splice(target, 0, moved);
      return { ...group, images };
    });
  }

  function updateProposed<K extends keyof ProposedRecord>(groupId: string, key: K, value: ProposedRecord[K]) {
    updateGroup(groupId, (group) => ({
      ...group,
      proposed: { ...safeProposed(group), [key]: value },
      confirmedFields: Array.from(new Set([...(group.confirmedFields || []), key]))
    }));
  }

  async function runAiExtraction(groupId: string) {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;
    if (extractingGroupId) return;

    setExtractingGroupId(groupId);
    updateGroup(groupId, (currentGroup) => ({
      ...currentGroup,
      aiExtraction: defaultAiExtraction()
    }));
    try {
      const groupImages = safeImages(group);
      const proposed = safeProposed(group);
      logIntakeDev("Run AI Extraction", {
        batchId: currentBatchEntry.batchId,
        groupId: group.id,
        images: groupImages.map((image) => ({
          id: image.id,
          fileName: image.fileName,
          role: image.role,
          order: image.order,
          hasUrl: Boolean(image.publicUrl || image.url),
          hasDataUrl: Boolean(image.dataUrl)
        }))
      });
      const result = await extractCardFromImagesViaApi({
        images: groupImages,
        imageRoles: groupImages.map((image) => ({ id: image.id, role: image.role })),
        batchId: currentBatchEntry.batchId,
        groupId: group.id,
        categoryHint: proposed.category,
        existingValues: proposed
      });
      updateGroup(groupId, (currentGroup) => ({
        ...currentGroup,
        proposed: {
          ...currentGroup.proposed,
          ...Object.fromEntries(Object.entries(result.extracted).filter(([key]) => !(currentGroup.confirmedFields || []).includes(key as keyof ProposedRecord)))
        },
        aiExtraction: {
          status: result.status,
          extracted: result.extracted,
          fieldConfidence: result.fieldConfidence,
          warnings: result.warnings,
          suggestedTitle: result.suggestedTitle,
          extractedAt: result.extractedAt,
          confidenceScore: result.confidenceScore,
          modelLabel: result.modelLabel,
          extractionSources: result.extractionSources,
          catalogDiagnostics: result.catalogDiagnostics,
          providerDiagnostics: result.providerDiagnostics,
          parallelRecognition: result.parallelRecognition
        }
      }));
      logIntakeDev("AI Extraction Result", {
        batchId: currentBatchEntry.batchId,
        groupId: group.id,
        status: result.status,
        confidence: result.confidenceScore,
        extracted: result.extracted,
        catalogDiagnostics: result.catalogDiagnostics,
        parallelRecognition: result.parallelRecognition,
        providerDiagnostics: result.providerDiagnostics
      });
      setStatusMessage(`${groupId} ACV AI Orchestrator extraction complete. Review editable fields before approving.`);
    } catch (error) {
      updateGroup(groupId, (currentGroup) => ({
        ...currentGroup,
        aiExtraction: {
          status: "Failed",
          extracted: undefined,
          fieldConfidence: {},
          warnings: [error instanceof Error ? error.message : "AI extraction failed"],
          suggestedTitle: "",
          extractedAt: new Date().toISOString(),
          modelLabel: "ACV extraction route",
          providerDiagnostics: [
            {
              providerName: "ACV extraction route",
              status: "failed",
              reason: error instanceof Error ? error.message : "AI extraction failed",
              mode: "local"
            }
          ]
        }
      }));
      setStatusMessage(`${groupId} AI extraction failed. Manual field values were preserved.`);
    } finally {
      setExtractingGroupId(null);
    }
  }

  function clearAiExtraction(groupId: string) {
    updateGroup(groupId, (group) => ({ ...group, aiExtraction: { ...defaultAiExtraction(), status: "Cleared" } }));
    setStatusMessage(`${groupId} AI extraction cleared. Current manual field values were preserved.`);
  }

  function applyAiSuggestion(groupId: string) {
    const group = groups.find((item) => item.id === groupId);
    const extracted = group?.aiExtraction?.extracted;
    if (!group || !extracted) {
      setStatusMessage(`${groupId} has no AI suggestion to apply yet.`);
      return;
    }

    updateGroup(groupId, (currentGroup) => ({ ...currentGroup, proposed: { ...currentGroup.proposed, ...extracted } }));
    setStatusMessage(`${groupId} AI suggestion applied to editable fields. Mock only.`);
  }

  function applySuggestedTitle(groupId: string, previewTitle?: string) {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;

    const title = previewTitle || marketplaceTitleForRecord(safeProposed(group), group.aiExtraction?.catalogDiagnostics).ebayTitle;
    if (!hasFieldValue(title)) {
      setStatusMessage(`${groupId} does not have a usable suggested title yet.`);
      return;
    }
    updateProposed(groupId, "cardName", title);
    setStatusMessage(`${groupId} suggested title applied to Card title.`);
  }

  function saveGroup(id: string) {
    void saveBatchSnapshotToBackend(currentBatchEntry);
    setStatusMessage(`${id} saved in ${backendStatus.connectionState === "connected" ? "Supabase + local cache" : "local browser state"}.`);
  }

  function saveCurrentBatchToHistory() {
    setBatchHistory((current) => [{ ...currentBatchEntry, lastOpened: new Date().toLocaleString() }, ...current.filter((batch) => batch.batchId !== currentBatchEntry.batchId)].slice(0, 30));
    void saveBatchSnapshotToBackend(currentBatchEntry);
  }

  function openBatchHistory() {
    saveCurrentBatchToHistory();
    setShowBatchHistory(true);
  }

  function restoreHistoryBatch(batch: BatchHistoryEntry) {
    restoreBatch(batch);
    setActiveSource(batch.source as SourceKey);
    setShowBatchHistory(false);
  }

  function startNewIntake() {
    if (!window.confirm("Archive this local batch snapshot and start a new intake batch?")) return;
    saveCurrentBatchToHistory();
    clearIntakeState();
  }

  return (
    <>
      <PageHeader
        title="Photo Intake Workstation"
        description="Images to batch grouping, pairing review, AI extraction review, and staged approval into inventory."
        action={
          <>
            <MiniButton icon={<FolderOpen className="h-4 w-4" />} onClick={openBatchHistory}>
              Batch Library
            </MiniButton>
            <MiniButton tone="pink" icon={<XCircle className="h-4 w-4" />} onClick={clearBatch}>
              Clear Batch
            </MiniButton>
          </>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(event) => {
          if (event.target.files) handleFiles(event.target.files);
          event.target.value = "";
        }}
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
                  onChange={(event) => {
                    const nextMode = event.target.value as ImageCountMode;
                    setImageCountMode(nextMode);
                    regroupImages(uploadedImages, nextMode, customImageCount);
                    setStatusMessage(nextMode === "Auto-detect" ? "Auto-detect mock mode regrouped uploaded images using 2/card." : `Regrouped uploaded images using ${nextMode}.`);
                  }}
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
                  onChange={(event) => {
                    const nextCount = Math.min(10, Math.max(1, Number(event.target.value) || 1));
                    setCustomImageCount(nextCount);
                    if (imageCountMode === "Custom") {
                      regroupImages(uploadedImages, imageCountMode, nextCount);
                      setStatusMessage(`Regrouped uploaded images using ${nextCount} images/card.`);
                    }
                  }}
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
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFiles(event.dataTransfer.files);
                }}
                className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-acv-teal/35 bg-acv-teal/5 p-5 text-center"
              >
                <UploadCloud className="h-9 w-9 text-acv-teal" />
                <p className="mt-3 text-base font-semibold text-acv-text">Drag and drop card photos</p>
                <p className="mt-1 max-w-lg text-xs leading-5 text-acv-muted">Local browser upload bay for front, back, closeup, serial, surface, auto, patch, relic, and other image roles.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <MiniButton tone="teal" icon={<Camera className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>
                    Upload Photos
                  </MiniButton>
                  <MiniButton icon={<FolderOpen className="h-4 w-4" />} onClick={openBatchHistory}>
                    Batch Library
                  </MiniButton>
                  <MiniButton tone="pink" icon={<XCircle className="h-4 w-4" />} onClick={clearBatch}>
                    Clear Batch
                  </MiniButton>
                </div>
                <p className="mt-3 text-xs font-semibold text-acv-teal">{statusMessage}</p>
                {imageCountMode === "Auto-detect" && (
                  <div className="mt-2">
                    <StatusPill tone="gold">Auto-detect mock: using 2/card</StatusPill>
                  </div>
                )}
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
            {uploadedImages.length > 0 && (
              <div className="mt-3 rounded-lg border border-acv-border bg-acv-panel2 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-acv-gold">Upload order preview</p>
                  <StatusPill tone="teal">{uploadedImages.length} local photos</StatusPill>
                </div>
                <div className="acv-scrollbar contained-x-scroll flex gap-2 pb-1">
                  {uploadedImages.map((image, index) => (
                    <div key={image.id} className="w-20 shrink-0">
                      <div className="h-20 overflow-hidden rounded-md border border-acv-border bg-acv-black">
                        {image.url || image.dataUrl ? (
                          <img src={image.url || image.dataUrl} alt={image.fileName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-semibold text-acv-muted">
                            Re-upload
                          </div>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[10px] font-semibold text-acv-muted">{index + 1}. {image.fileName}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-2">
          <CompactMetric label="Total photos" value={String(totalPhotos)} tone="teal" />
          <CompactMetric label="Estimated cards" value={imageCountMode === "Auto-detect" && totalPhotos > 0 ? `~${estimatedCards}` : String(estimatedCards)} tone="gold" />
          <CompactMetric label="Paired groups" value={String(pairedGroups)} tone="green" />
          <CompactMetric label="Review flags" value={String(reviewFlags)} tone="pink" />
          <CompactMetric label="Ready to approve" value={String(readyToApprove)} tone="teal" />
        </div>

        <BatchMetadataStrip batchName={batchName} batchId={batchId} source={activeSource} createdAt={batchCreatedAt} totalCards={visibleGroups.length} status={batchStatus} />

        <div className="grid min-w-0 gap-3 2xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard title="Grouping / Pairing Review" eyebrow="Horizontal batch filmstrip">
            {visibleGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed border-acv-border bg-acv-panel2 p-6 text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-acv-muted" />
                <p className="mt-3 text-sm font-semibold text-acv-text">No local upload groups yet</p>
                <p className="mt-1 text-xs text-acv-muted">Upload photos or drag them into the upload zone to generate groups from upload order.</p>
              </div>
            ) : activeReviewGroups.length === 0 ? (
              <div className="rounded-lg border border-acv-green/35 bg-acv-green/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md border border-acv-green/35 bg-acv-green/10">
                      <CheckCircle2 className="h-5 w-5 text-acv-green" />
                    </div>
                    <p className="text-base font-semibold text-acv-text">Batch Complete</p>
                    <p className="mt-1 text-xs text-acv-muted">Review complete. Every active group has been approved or rejected.</p>
                  </div>
                  <div className="grid min-w-[220px] grid-cols-3 gap-2">
                    <CompactMetric label="Approved" value={String(approvedIds.size)} tone="green" />
                    <CompactMetric label="Rejected" value={String(rejectedIds.size)} tone="pink" />
                    <CompactMetric label="Remaining" value="0" tone="teal" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MiniButton icon={<FolderOpen className="h-4 w-4" />} onClick={openBatchHistory}>
                    Open another batch
                  </MiniButton>
                  <MiniButton tone="teal" icon={<UploadCloud className="h-4 w-4" />} onClick={startNewIntake}>
                    Start new intake
                  </MiniButton>
                  <MiniButton icon={<FolderOpen className="h-4 w-4" />} onClick={openBatchHistory}>
                    View Batch History
                  </MiniButton>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill tone="teal">{activeReviewGroups.length} active</StatusPill>
                    <StatusPill tone="green">{approvedIds.size} approved</StatusPill>
                    <StatusPill tone="pink">{rejectedIds.size} rejected</StatusPill>
                  </div>
                  <p className="text-xs font-semibold text-acv-muted">Click a tile to open the AI Review drawer.</p>
                </div>
                <div className="acv-scrollbar contained-x-scroll flex min-w-0 gap-3 pb-2">
                  {activeReviewGroups.map((group) => {
                    const routeStatus = statusForGroup(group);
                    const aiStatus = aiStatusForGroup(group);
                    const isSelected = selectedGroup?.id === group.id;
                    const warnings = warningsForGroup(group);
                    const groupImages = safeImages(group);
                    const proposed = safeProposed(group);
                    const confidence = safeConfidence(group);
                    const frontImage = groupImages.find((image) => image.role === "Front");
                    const backImage = groupImages.find((image) => image.role === "Back");
                    return (
                      <article
                        key={group.id}
                        className={cn(
                          "w-72 shrink-0 rounded-lg border bg-acv-panel2 p-3 transition",
                          isSelected ? "border-acv-teal/55 shadow-[0_0_0_1px_rgba(38,212,199,0.18)]" : "border-acv-border hover:border-acv-purple/55"
                        )}
                      >
                        <button type="button" onClick={() => openGroup(group)} className="block w-full min-w-0 text-left">
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            <StatusPill tone="purple">Batch: {group.batch}</StatusPill>
                            <StatusPill tone="gold">Group: {group.id}</StatusPill>
                          </div>
                          <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-acv-text">{group.pairingStatus}</p>
                              <p className="mt-0.5 truncate text-[11px] text-acv-muted">{proposed.cardName}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <StatusPill tone={toneForStatus(routeStatus)}>{routeStatus}</StatusPill>
                              <StatusPill tone={confidenceTone(confidence)}>Pairing {confidence}%</StatusPill>
                              <StatusPill tone={toneForAiStatus(aiStatus)}>AI: {aiStatus}</StatusPill>
                            </div>
                          </div>
                          <div className="grid min-w-0 grid-cols-2 gap-2">
                            <ImagePlaceholder image={frontImage} emptyLabel="Front" />
                            <ImagePlaceholder image={backImage} emptyLabel="Back" />
                          </div>
                          {warnings.length > 0 && (
                            <div className="mt-2 flex min-h-6 min-w-0 max-w-full flex-wrap gap-1.5 overflow-hidden">
                              {warnings.slice(0, 2).map((warning) => (
                                <StatusPill key={warning} tone="pink" className={wrappedWarningPillClass}>
                                  {warning}
                                </StatusPill>
                              ))}
                            </div>
                          )}
                        </button>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <MiniButton icon={<ArrowLeftRight className="h-3.5 w-3.5" />} onClick={() => swapFrontBack(group.id)}>
                            Swap
                          </MiniButton>
                          <MiniButton tone="teal" icon={<FileSearch className="h-3.5 w-3.5" />} onClick={() => openGroup(group)}>
                            Review
                          </MiniButton>
                          <MiniButton onClick={() => groupImages[0] && setImageRoleExclusive(group.id, groupImages[0].id, "Front")}>Set front</MiniButton>
                          <MiniButton onClick={() => groupImages[groupImages.length - 1] && setImageRoleExclusive(group.id, groupImages[groupImages.length - 1].id, "Back")}>Set back</MiniButton>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <MiniButton icon={<ImagePlus className="h-3.5 w-3.5" />}>Add closeup</MiniButton>
                          <MiniButton icon={<Move className="h-3.5 w-3.5" />}>Move</MiniButton>
                          <MiniButton icon={<Scissors className="h-3.5 w-3.5" />}>Split</MiniButton>
                          <MiniButton icon={<Layers3 className="h-3.5 w-3.5" />}>Merge</MiniButton>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          <div className="min-w-0 space-y-3">
            <SectionCard title="AI Extraction Review" eyebrow={selectedGroup?.id || "No group selected"}>
              {selectedGroup ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <StatusPill tone={toneForStatus(statusForGroup(selectedGroup))}>{statusForGroup(selectedGroup)}</StatusPill>
                    <StatusPill tone={confidenceTone(safeConfidence(selectedGroup))}>Pairing {safeConfidence(selectedGroup)}%</StatusPill>
                    <StatusPill tone={toneForAiStatus(aiStatusForGroup(selectedGroup))}>AI: {aiStatusForGroup(selectedGroup)}</StatusPill>
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <FieldRow label="Proposed card name" value={safeProposed(selectedGroup).cardName} tone="gold" />
                    <FieldRow label="AI suggested title" value={selectedGroup.aiExtraction?.suggestedTitle || "Not generated"} tone={selectedGroup.aiExtraction?.suggestedTitle ? "teal" : undefined} />
                    <FieldRow label="Player / Character" value={safeProposed(selectedGroup).playerCharacter} />
                    <FieldRow label="Team" value={safeProposed(selectedGroup).team} />
                    <FieldRow label="Sport / Category" value={safeProposed(selectedGroup).category} />
                    <FieldRow label="Year" value={safeProposed(selectedGroup).year} />
                    <FieldRow label="Brand" value={safeProposed(selectedGroup).brand} />
                    <FieldRow label="Set" value={safeProposed(selectedGroup).set} />
                    <FieldRow label="Card Number" value={safeProposed(selectedGroup).cardNumber} />
                    <FieldRow label="Parallel" value={safeProposed(selectedGroup).parallel} />
                    <FieldRow label="Serial Number" value={safeProposed(selectedGroup).serialNumber} />
                    <FieldRow label="Rookie Flag" value={flagLabel(safeProposed(selectedGroup).rookieFlag)} tone={safeProposed(selectedGroup).rookieFlag ? "teal" : undefined} />
                    <FieldRow label="Auto Flag" value={flagLabel(safeProposed(selectedGroup).autoFlag)} />
                    <FieldRow label="Relic Flag" value={flagLabel(safeProposed(selectedGroup).relicFlag)} />
                    <FieldRow label="Variation Flag" value={flagLabel(safeProposed(selectedGroup).variationFlag)} tone={safeProposed(selectedGroup).variationFlag ? "gold" : undefined} />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-md border border-acv-border bg-acv-panel2 p-3 text-xs leading-5 text-acv-text">
                      <span className="font-semibold text-acv-muted">Condition notes: </span>
                      {safeProposed(selectedGroup).conditionNotes}
                    </div>
                    <div className="rounded-md border border-acv-border bg-acv-panel2 p-3 text-xs leading-5 text-acv-text">
                      <span className="font-semibold text-acv-muted">Uncertainty notes: </span>
                      {safeProposed(selectedGroup).uncertaintyNotes}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-acv-border bg-acv-panel2 p-5 text-center text-xs text-acv-muted">
                  Upload images to generate a proposed local inventory record.
                </div>
              )}
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
                <MiniButton tone="teal" onClick={() => selectedQueueIds.forEach((id) => approveGroup(id))}>
                  Approve selected
                </MiniButton>
                <MiniButton onClick={() => setSelectedQueueIds(new Set())}>Clear</MiniButton>
              </div>
            ) : null
          }
        >
          <DataTable<IntakeGroup>
            rows={activeReviewGroups}
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
                cell: (group) => <ImagePlaceholder image={safeImages(group).find((image) => image.role === "Front")} emptyLabel="Front" compact />
              },
              { key: "item", header: "Proposed Item", className: "min-w-56", cell: (group) => <span className="font-semibold text-acv-text">{safeProposed(group).cardName}</span> },
              { key: "category", header: "Category", cell: (group) => <StatusPill tone="purple">{safeProposed(group).category}</StatusPill> },
              { key: "pairing", header: "Pairing", cell: (group) => <span className={cn("font-semibold", safeConfidence(group) >= 90 ? "text-acv-teal" : safeConfidence(group) >= 70 ? "text-acv-gold" : "text-acv-pink")}>{safeConfidence(group)}%</span> },
              { key: "aiStatus", header: "AI Status", cell: (group) => <StatusPill tone={toneForAiStatus(aiStatusForGroup(group))}>{aiStatusForGroup(group)}</StatusPill> },
              { key: "status", header: "Status", cell: (group) => <StatusPill tone={toneForStatus(queueStatus(group))}>{queueStatus(group)}</StatusPill> },
              {
                key: "warnings",
                header: "Warnings",
                className: "min-w-44",
                cell: (group) => {
                  const warnings = warningsForGroup(group);
                  return warnings.length ? (
                    <div className="flex min-w-0 max-w-full flex-wrap gap-1.5 overflow-hidden">
                      {warnings.slice(0, 2).map((warning) => (
                        <StatusPill key={warning} tone="pink" className={wrappedWarningPillClass}>
                          {warning}
                        </StatusPill>
                      ))}
                    </div>
                  ) : (
                    <span className="font-semibold text-acv-teal">None</span>
                  );
                }
              },
              {
                key: "actions",
                header: "Actions",
                className: "min-w-80",
                cell: (group) => {
                  const isApproved = approvedIds.has(group.id);
                  const isRejected = rejectedIds.has(group.id);
                  return (
                    <div className="flex flex-wrap gap-2">
                      <MiniButton
                        tone="teal"
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        disabled={isApproved || isRejected}
                        onClick={(event) => {
                          event.stopPropagation();
                          void approveGroup(group.id);
                        }}
                      >
                        {isApproved ? "Approved" : "Approve to Inventory"}
                      </MiniButton>
                      <MiniButton
                        icon={<FileSearch className="h-3.5 w-3.5" />}
                        disabled={isApproved || isRejected}
                        onClick={(event) => {
                          event.stopPropagation();
                          void sendToResearch(group.id);
                        }}
                      >
                        Needs Research
                      </MiniButton>
                      <MiniButton
                        tone="pink"
                        icon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isRejected) undoRejectGroup(group.id);
                          else void rejectGroup(group.id);
                        }}
                      >
                        {isRejected ? "Undo Reject" : "Reject"}
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
                  );
                }
              }
            ]}
          />
          {approvedIds.size > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-acv-green/35 bg-acv-green/10 px-3 py-2 text-xs font-semibold text-acv-green">
              <CheckCircle2 className="h-4 w-4" />
              {approvedIds.size} record{approvedIds.size === 1 ? "" : "s"} approved locally. SKU would be assigned during approval: {Array.from(approvedIds)
                .map((id) => assignedSkus[id] || "SKU pending")
                .join(", ")}. Mock only, not permanent yet.
            </div>
          )}
          {approvedInventory.length > 0 && (
            <div className="mt-3 rounded-md border border-acv-border bg-acv-panel2 px-3 py-2 text-xs text-acv-muted">
              <span className="font-semibold text-acv-teal">Local approved inventory:</span> {approvedInventory.length} item{approvedInventory.length === 1 ? "" : "s"} staged in browser memory for future Inventory/Supabase handoff.
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

      {showBatchHistory && <BatchHistoryModal currentBatch={currentBatchEntry} batches={batchHistory} onClose={() => setShowBatchHistory(false)} onRestore={restoreHistoryBatch} />}

      {drawerGroup && (
        <ReviewDrawerErrorBoundary
          key={drawerGroup.id}
          context={{
            batchId,
            selectedGroupId,
            drawerGroupId,
            groupId: drawerGroup.id,
            processingAction: processingAction?.type || null
          }}
          onClose={() => setDrawerGroupId(null)}
          onRefresh={() => {
            setDrawerGroupId(null);
            setSelectedGroupId(activeReviewGroups[0]?.id || "");
            setStatusMessage("Photo Intake review reset safely. Select a group to continue.");
          }}
        >
          <ReviewDrawer
            group={drawerGroup}
            skuStatus={skuStatusForGroup(drawerGroup)}
            assignedSku={assignedSkuForGroup(drawerGroup)}
            isApproved={approvedIds.has(drawerGroup.id)}
            isRejected={rejectedIds.has(drawerGroup.id)}
            isResearch={researchIds.has(drawerGroup.id)}
            isExtracting={extractingGroupId === drawerGroup.id}
            isProcessingAction={processingAction?.groupId === drawerGroup.id}
            onClose={() => setDrawerGroupId(null)}
            onSave={saveGroup}
            onSwapFrontBack={swapFrontBack}
            onRoleChange={updateImageRole}
            onSetImageRole={setImageRoleExclusive}
            onMoveImage={moveImage}
            onUpdateProposed={updateProposed}
            onRunExtraction={runAiExtraction}
            onClearExtraction={clearAiExtraction}
            onApplyAiSuggestion={applyAiSuggestion}
            onApplySuggestedTitle={applySuggestedTitle}
            onApprove={(id) => {
              void approveGroup(id, true);
            }}
            onResearch={(id) => {
              void sendToResearch(id);
            }}
            onReject={(id) => {
              void rejectGroup(id, true);
            }}
            onUndoReject={(id) => {
              undoRejectGroup(id);
            }}
          />
        </ReviewDrawerErrorBoundary>
      )}
    </>
  );
}
