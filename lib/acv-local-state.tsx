"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, testSupabaseConnection } from "@/lib/supabase/client";
import {
  approveGroupToSupabase,
  loadSupabaseState,
  migrateLocalStateToSupabase,
  saveBatchSnapshotToSupabase,
  updateIntakeGroupStatusInSupabase,
  uploadTempIntakeFile
} from "@/lib/supabase/intake";
import type { SupabaseBackendStatus } from "@/lib/supabase/types";

export type SourceKey = "Computer Upload" | "eBay Active Listings" | "eBay Drafts" | "Google Drive" | "Dropbox" | "Mobile Camera Upload" | "Scanner" | "Shared Team Uploads" | "Future Sources";
export type ImageCountMode = "2 images/card" | "3 images/card" | "Custom" | "Auto-detect";
export type ImageRole = "Front" | "Back" | "Detail / Closeup" | "Serial Closeup" | "Holo / Surface" | "Auto Closeup" | "Patch / Relic Closeup" | "Other";

export type UploadedImage = {
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

export type IntakeImage = {
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

export type ProposedRecord = {
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

export type AiExtractionStatus = "Not Run" | "Extracted" | "Needs Review" | "Failed" | "Cleared";

export type AiFieldConfidenceMap = Partial<Record<keyof ProposedRecord | "suggestedTitle", number>>;

export type AiProviderDiagnostic = {
  providerName: string;
  status: "used" | "skipped" | "failed" | "fallback";
  reason: string;
  confidence?: number;
  mode: "live" | "mock" | "local";
  mappedFields?: Array<{ label: string; value: string }>;
};

export type AiExtractionSnapshot = {
  status: AiExtractionStatus;
  extracted?: Partial<ProposedRecord>;
  fieldConfidence: AiFieldConfidenceMap;
  warnings: string[];
  suggestedTitle: string;
  extractedAt?: string;
  confidenceScore?: number;
  modelLabel?: string;
  extractionSources?: string[];
  providerDiagnostics?: AiProviderDiagnostic[];
};

export type IntakeGroup = {
  id: string;
  batch: string;
  source: SourceKey;
  images: IntakeImage[];
  pairingStatus: string;
  confidence: number;
  warnings: string[];
  proposed: ProposedRecord;
  aiExtraction?: AiExtractionSnapshot;
};

export type ApprovedInventoryItem = {
  sku: string;
  batch: string;
  group: string;
  source: SourceKey;
  primaryImageUrl: string;
  images: IntakeImage[];
  proposed: ProposedRecord;
  approvedAt: string;
  needsImageReupload?: boolean;
  auditHistory?: string[];
};

export type BatchHistoryEntry = {
  batchId: string;
  batchName: string;
  createdDate: string;
  source: SourceKey;
  cardCount: number;
  status: string;
  approved: number;
  rejected: number;
  remaining: number;
  lastOpened: string;
  uploadedImages: UploadedImage[];
  groups: IntakeGroup[];
  selectedGroupId: string;
  approvedIds: string[];
  researchIds: string[];
  rejectedIds: string[];
  assignedSkus: Record<string, string>;
};

type PersistedState = {
  batchNumber: number;
  batchName: string;
  batchCreatedAt: string;
  imageCountMode: ImageCountMode;
  customImageCount: number;
  autoPair: boolean;
  aiPairingCheck: boolean;
  uploadedImages: UploadedImage[];
  groups: IntakeGroup[];
  selectedGroupId: string;
  approvedIds: string[];
  researchIds: string[];
  rejectedIds: string[];
  assignedSkus: Record<string, string>;
  approvedInventory: ApprovedInventoryItem[];
  batchHistory: BatchHistoryEntry[];
  statusMessage: string;
  skuCounter: number;
};

type AcvLocalStateValue = {
  batchNumber: number;
  setBatchNumber: React.Dispatch<React.SetStateAction<number>>;
  batchName: string;
  setBatchName: React.Dispatch<React.SetStateAction<string>>;
  batchCreatedAt: string;
  setBatchCreatedAt: React.Dispatch<React.SetStateAction<string>>;
  imageCountMode: ImageCountMode;
  setImageCountMode: React.Dispatch<React.SetStateAction<ImageCountMode>>;
  customImageCount: number;
  setCustomImageCount: React.Dispatch<React.SetStateAction<number>>;
  autoPair: boolean;
  setAutoPair: React.Dispatch<React.SetStateAction<boolean>>;
  aiPairingCheck: boolean;
  setAiPairingCheck: React.Dispatch<React.SetStateAction<boolean>>;
  uploadedImages: UploadedImage[];
  setUploadedImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
  groups: IntakeGroup[];
  setGroups: React.Dispatch<React.SetStateAction<IntakeGroup[]>>;
  selectedGroupId: string;
  setSelectedGroupId: React.Dispatch<React.SetStateAction<string>>;
  drawerGroupId: string | null;
  setDrawerGroupId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedQueueIds: Set<string>;
  setSelectedQueueIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  approvedIds: Set<string>;
  setApprovedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  researchIds: Set<string>;
  setResearchIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  rejectedIds: Set<string>;
  setRejectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  assignedSkus: Record<string, string>;
  setAssignedSkus: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  approvedInventory: ApprovedInventoryItem[];
  setApprovedInventory: React.Dispatch<React.SetStateAction<ApprovedInventoryItem[]>>;
  batchHistory: BatchHistoryEntry[];
  setBatchHistory: React.Dispatch<React.SetStateAction<BatchHistoryEntry[]>>;
  statusMessage: string;
  setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
  backendStatus: SupabaseBackendStatus;
  skuCounterRef: React.MutableRefObject<number>;
  addUploadedFiles: (files: FileList | File[]) => UploadedImage[];
  clearIntakeState: () => void;
  restoreBatch: (entry: BatchHistoryEntry) => void;
  saveBatchSnapshotToBackend: (entry: BatchHistoryEntry) => Promise<void>;
  approveGroupToBackend: (entry: BatchHistoryEntry, group: IntakeGroup, approvedItem: ApprovedInventoryItem) => Promise<void>;
  updateGroupStatusInBackend: (entry: BatchHistoryEntry, group: IntakeGroup, status: "Rejected" | "Needs Research") => Promise<void>;
};

const storageKey = "acv-os-local-intake-v1";
const migrationMarkerKey = "acv_supabase_migration_completed";
const AcvLocalStateContext = createContext<AcvLocalStateValue | null>(null);

function initialBackendStatus(): SupabaseBackendStatus {
  const configured = isSupabaseConfigured();

  return {
    configured,
    connectionState: configured ? "connecting" : "not-configured",
    storageState: configured ? "connecting" : "not-configured",
    mode: configured ? "Supabase" : "Local Fallback",
    message: configured ? "Supabase connection pending." : "Supabase env vars missing. ACV is using local fallback."
  };
}

function stripObjectUrls(images: UploadedImage[]) {
  return images.map((image) => ({ ...image, url: image.dataUrl || image.publicUrl || "", needsReupload: !(image.dataUrl || image.publicUrl) }));
}

function stripGroupObjectUrls(groups: IntakeGroup[]) {
  return groups.map((group) => ({
    ...group,
    images: group.images.map((image) => ({ ...image, url: image.dataUrl || image.publicUrl || "", needsReupload: !(image.dataUrl || image.publicUrl) }))
  }));
}

function stripApprovedObjectUrls(items: ApprovedInventoryItem[]) {
  return items.map((item) => {
    const frontImage = item.images.find((image) => image.role === "Front");

    return {
      ...item,
      primaryImageUrl: frontImage?.dataUrl || frontImage?.publicUrl || frontImage?.url || "",
      needsImageReupload: !(frontImage?.dataUrl || frontImage?.publicUrl || frontImage?.url),
      images: item.images.map((image) => ({ ...image, url: image.dataUrl || image.publicUrl || "", needsReupload: !(image.dataUrl || image.publicUrl) }))
    };
  });
}

function stripBatchHistoryObjectUrls(entries: BatchHistoryEntry[]) {
  return entries.map((entry) => ({
    ...entry,
    uploadedImages: stripObjectUrls(entry.uploadedImages || []),
    groups: stripGroupObjectUrls(entry.groups || [])
  }));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AcvLocalStateProvider({ children }: { children: React.ReactNode }) {
  const objectUrlsRef = useRef<string[]>([]);
  const skuCounterRef = useRef(1);
  const [hydrated, setHydrated] = useState(false);
  const [batchNumber, setBatchNumber] = useState(73);
  const [batchName, setBatchName] = useState("Untitled Batch");
  const [batchCreatedAt, setBatchCreatedAt] = useState(() => new Date().toISOString());
  const [imageCountMode, setImageCountMode] = useState<ImageCountMode>("2 images/card");
  const [customImageCount, setCustomImageCount] = useState(4);
  const [autoPair, setAutoPair] = useState(true);
  const [aiPairingCheck, setAiPairingCheck] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [groups, setGroups] = useState<IntakeGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [researchIds, setResearchIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [assignedSkus, setAssignedSkus] = useState<Record<string, string>>({});
  const [approvedInventory, setApprovedInventory] = useState<ApprovedInventoryItem[]>([]);
  const [batchHistory, setBatchHistory] = useState<BatchHistoryEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState("Upload photos to generate local intake groups.");
  const [backendStatus, setBackendStatus] = useState<SupabaseBackendStatus>(() => initialBackendStatus());

  useEffect(() => {
    let parsedState: PersistedState | null = null;

    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as PersistedState;
        parsedState = parsed;
        setBatchNumber(parsed.batchNumber || 73);
        setBatchName(parsed.batchName === "July Intake - Breaks + Singles" ? "Untitled Batch" : parsed.batchName || "Untitled Batch");
        setBatchCreatedAt(parsed.batchCreatedAt || new Date().toISOString());
        setImageCountMode(parsed.imageCountMode || "2 images/card");
        setCustomImageCount(parsed.customImageCount || 4);
        setAutoPair(parsed.autoPair ?? true);
        setAiPairingCheck(parsed.aiPairingCheck ?? true);
        setUploadedImages(stripObjectUrls(parsed.uploadedImages || []));
        setGroups(stripGroupObjectUrls(parsed.groups || []));
        setSelectedGroupId(parsed.selectedGroupId || parsed.groups?.[0]?.id || "");
        setApprovedIds(new Set(parsed.approvedIds || []));
        setResearchIds(new Set(parsed.researchIds || []));
        setRejectedIds(new Set(parsed.rejectedIds || []));
        setAssignedSkus(parsed.assignedSkus || {});
        setApprovedInventory(stripApprovedObjectUrls(parsed.approvedInventory || []));
        setBatchHistory(stripBatchHistoryObjectUrls(parsed.batchHistory || []));
        skuCounterRef.current = parsed.skuCounter || Object.keys(parsed.assignedSkus || {}).length + 1;
        setStatusMessage(
          (parsed.uploadedImages?.some((image) => !image.dataUrl) || false)
            ? "Restored mock intake state. Some images need to be re-uploaded after refresh."
            : parsed.statusMessage || "Upload photos to generate local intake groups."
        );
      }
    } catch {
      setStatusMessage("Could not restore mock intake state from localStorage.");
    } finally {
      setHydrated(true);
    }

    if (!isSupabaseConfigured()) {
      setBackendStatus(initialBackendStatus());
      return;
    }

    void (async () => {
      setBackendStatus({
        configured: true,
        connectionState: "connecting",
        storageState: "connecting",
        mode: "Supabase",
        message: "Connecting to Supabase."
      });

      try {
        await testSupabaseConnection();
        const alreadyMigrated = window.localStorage.getItem(migrationMarkerKey) === "true";
        if (parsedState && !alreadyMigrated) {
          await migrateLocalStateToSupabase(parsedState);
          window.localStorage.setItem(migrationMarkerKey, "true");
        }

        const remote = await loadSupabaseState();
        setApprovedInventory((current) => {
          const bySku = new Map(current.map((item) => [item.sku, item]));
          remote.approvedInventory.forEach((item) => bySku.set(item.sku, item));
          return Array.from(bySku.values());
        });
        if (remote.groups.length > 0) {
          setGroups(remote.groups);
          setSelectedGroupId(remote.groups[0]?.id || "");
          setApprovedIds(new Set(remote.approvedIds));
          setRejectedIds(new Set(remote.rejectedIds));
          setResearchIds(new Set(remote.researchIds));
          setAssignedSkus(remote.assignedSkus);
        }
        if (remote.batchHistory.length > 0) {
          setBatchHistory(remote.batchHistory);
        }
        setBackendStatus({
          configured: true,
          connectionState: "connected",
          storageState: "connected",
          mode: "Supabase",
          lastSyncAt: new Date().toLocaleString(),
          message: alreadyMigrated ? "Supabase connected." : "Supabase connected. Local cache migrated once."
        });
      } catch (error) {
        setBackendStatus({
          configured: true,
          connectionState: "offline",
          storageState: "offline",
          mode: "Local Fallback",
          message: error instanceof Error ? error.message : "Supabase unavailable. ACV is using local fallback."
        });
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const payload: PersistedState = {
      batchNumber,
      batchName,
      batchCreatedAt,
      imageCountMode,
      customImageCount,
      autoPair,
      aiPairingCheck,
      uploadedImages: stripObjectUrls(uploadedImages),
      groups: stripGroupObjectUrls(groups),
      selectedGroupId,
      approvedIds: Array.from(approvedIds),
      researchIds: Array.from(researchIds),
      rejectedIds: Array.from(rejectedIds),
      assignedSkus,
      approvedInventory: stripApprovedObjectUrls(approvedInventory),
      batchHistory: stripBatchHistoryObjectUrls(batchHistory),
      statusMessage,
      skuCounter: skuCounterRef.current
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...payload,
          uploadedImages: stripObjectUrls(uploadedImages).map((image) => ({ ...image, dataUrl: undefined, url: image.publicUrl || "", needsReupload: !image.publicUrl })),
          groups: stripGroupObjectUrls(groups).map((group) => ({
            ...group,
            images: group.images.map((image) => ({ ...image, dataUrl: undefined, url: image.publicUrl || "", needsReupload: !image.publicUrl }))
          })),
          approvedInventory: stripApprovedObjectUrls(approvedInventory).map((item) => ({
            ...item,
            primaryImageUrl: item.primaryImageUrl || item.images.find((image) => image.role === "Front")?.publicUrl || "",
            needsImageReupload: !(item.primaryImageUrl || item.images.find((image) => image.role === "Front")?.publicUrl),
            images: item.images.map((image) => ({ ...image, dataUrl: undefined, url: image.publicUrl || "", needsReupload: !image.publicUrl }))
          })),
          batchHistory: stripBatchHistoryObjectUrls(batchHistory).map((entry) => ({
            ...entry,
            uploadedImages: entry.uploadedImages.map((image) => ({ ...image, dataUrl: undefined, url: image.publicUrl || "", needsReupload: !image.publicUrl })),
            groups: entry.groups.map((group) => ({
              ...group,
              images: group.images.map((image) => ({ ...image, dataUrl: undefined, url: image.publicUrl || "", needsReupload: !image.publicUrl }))
            }))
          }))
        })
      );
    }
  }, [
    hydrated,
    batchNumber,
    batchName,
    batchCreatedAt,
    imageCountMode,
    customImageCount,
    autoPair,
    aiPairingCheck,
    uploadedImages,
    groups,
    selectedGroupId,
    approvedIds,
    researchIds,
    rejectedIds,
    assignedSkus,
    approvedInventory,
    batchHistory,
    statusMessage
  ]);

  const addUploadedFiles = useCallback(
    (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name));
      if (imageFiles.length === 0) return [];

      const nextImages = imageFiles.map((file, index) => {
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        return {
          id: `upload-${Date.now()}-${uploadedImages.length + index}`,
          fileName: file.name,
          url,
          type: file.type || "image/*",
          order: uploadedImages.length + index
        };
      });

      setUploadedImages((current) => [...current, ...nextImages]);
      imageFiles.forEach((file, index) => {
        const uploadId = nextImages[index].id;
        if (isSupabaseConfigured()) {
          uploadTempIntakeFile({
            file,
            batchId: `B-${String(batchNumber).padStart(3, "0")}`,
            uploadId
          })
            .then((stored) => {
              setUploadedImages((current) =>
                current.map((image) =>
                  image.id === uploadId
                    ? {
                        ...image,
                        storageBucket: stored.bucket,
                        storagePath: stored.path,
                        publicUrl: stored.publicUrl,
                        url: image.url || stored.publicUrl,
                        needsReupload: false
                      }
                    : image
                )
              );
              setGroups((current) =>
                current.map((group) => ({
                  ...group,
                  images: group.images.map((image) =>
                    image.uploadId === uploadId
                      ? {
                          ...image,
                          storageBucket: stored.bucket,
                          storagePath: stored.path,
                          publicUrl: stored.publicUrl,
                          url: image.url || stored.publicUrl,
                          needsReupload: false
                        }
                      : image
                  )
                }))
              );
              setBackendStatus((current) => ({
                ...current,
                connectionState: "connected",
                storageState: "connected",
                mode: "Supabase",
                lastSyncAt: new Date().toLocaleString(),
                message: "Image uploaded to Supabase temp-intake."
              }));
            })
            .catch((error) => {
              setBackendStatus((current) => ({
                ...current,
                storageState: "offline",
                mode: "Local Fallback",
                message: error instanceof Error ? error.message : "Image storage unavailable. Using local fallback."
              }));
            });
        }
        readFileAsDataUrl(file)
          .then((dataUrl) => {
            setUploadedImages((current) => current.map((image) => (image.id === uploadId ? { ...image, dataUrl, url: image.url || dataUrl, needsReupload: false } : image)));
            setGroups((current) =>
              current.map((group) => ({
                ...group,
                images: group.images.map((image) => (image.uploadId === uploadId ? { ...image, dataUrl, url: image.url || dataUrl, needsReupload: false } : image))
              }))
            );
            setApprovedInventory((current) =>
              current.map((item) => ({
                ...item,
                primaryImageUrl: item.images.find((image) => image.uploadId === uploadId && image.role === "Front") ? dataUrl : item.primaryImageUrl,
                needsImageReupload: item.images.find((image) => image.uploadId === uploadId && image.role === "Front") ? false : item.needsImageReupload,
                images: item.images.map((image) => (image.uploadId === uploadId ? { ...image, dataUrl, url: image.url || dataUrl, needsReupload: false } : image))
              }))
            );
          })
          .catch(() => {
            setStatusMessage("One or more images could not be persisted locally. They may need to be re-uploaded after refresh.");
          });
      });
      return [...uploadedImages, ...nextImages];
    },
    [batchNumber, uploadedImages, setGroups]
  );

  const clearIntakeState = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setUploadedImages([]);
    setGroups([]);
    setSelectedGroupId("");
    setDrawerGroupId(null);
    setSelectedQueueIds(new Set());
    setApprovedIds(new Set());
    setResearchIds(new Set());
    setRejectedIds(new Set());
    setAssignedSkus({});
    setBatchNumber((current) => current + 1);
    setBatchName("Untitled Batch");
    setBatchCreatedAt(new Date().toISOString());
    setStatusMessage("Batch cleared. Approved mock inventory remains available in Inventory.");
  }, []);

  const restoreBatch = useCallback((entry: BatchHistoryEntry) => {
    setBatchNumber(Number.parseInt(entry.batchId.replace("B-", ""), 10) || 73);
    setBatchName(entry.batchName);
    setBatchCreatedAt(entry.createdDate);
    setUploadedImages(stripObjectUrls(entry.uploadedImages));
    setGroups(stripGroupObjectUrls(entry.groups));
    setSelectedGroupId(entry.selectedGroupId || entry.groups[0]?.id || "");
    setDrawerGroupId(null);
    setSelectedQueueIds(new Set());
    setApprovedIds(new Set(entry.approvedIds));
    setResearchIds(new Set(entry.researchIds));
    setRejectedIds(new Set(entry.rejectedIds));
    setAssignedSkus(entry.assignedSkus);
    setBatchHistory((current) => current.map((batch) => (batch.batchId === entry.batchId ? { ...batch, lastOpened: new Date().toLocaleString() } : batch)));
    setStatusMessage(`Restored ${entry.batchName}. Images remain if browser storage retained them.`);
  }, []);

  const saveBatchSnapshotToBackend = useCallback(async (entry: BatchHistoryEntry) => {
    if (!isSupabaseConfigured()) return;
    try {
      await saveBatchSnapshotToSupabase(entry);
      setBackendStatus((current) => ({
        ...current,
        connectionState: "connected",
        storageState: "connected",
        mode: "Supabase",
        lastSyncAt: new Date().toLocaleString(),
        message: "Batch snapshot saved to Supabase."
      }));
    } catch (error) {
      setBackendStatus((current) => ({
        ...current,
        connectionState: "offline",
        mode: "Local Fallback",
        message: error instanceof Error ? error.message : "Could not save batch to Supabase. Local fallback retained."
      }));
    }
  }, []);

  const approveGroupToBackend = useCallback(async (entry: BatchHistoryEntry, group: IntakeGroup, approvedItem: ApprovedInventoryItem) => {
    if (!isSupabaseConfigured()) return;
    try {
      await approveGroupToSupabase(entry, group, approvedItem);
      const remote = await loadSupabaseState();
      setApprovedInventory((current) => {
        const bySku = new Map(current.map((item) => [item.sku, item]));
        remote.approvedInventory.forEach((item) => bySku.set(item.sku, item));
        return Array.from(bySku.values());
      });
      setBackendStatus((current) => ({
        ...current,
        connectionState: "connected",
        storageState: "connected",
        mode: "Supabase",
        lastSyncAt: new Date().toLocaleString(),
        message: `${approvedItem.sku} saved to Supabase.`
      }));
    } catch (error) {
      setBackendStatus((current) => ({
        ...current,
        connectionState: "offline",
        mode: "Local Fallback",
        message: error instanceof Error ? error.message : "Could not approve to Supabase. Local fallback retained."
      }));
    }
  }, []);

  const updateGroupStatusInBackend = useCallback(async (entry: BatchHistoryEntry, group: IntakeGroup, status: "Rejected" | "Needs Research") => {
    if (!isSupabaseConfigured()) return;
    try {
      await updateIntakeGroupStatusInSupabase(entry, group, status);
      setBackendStatus((current) => ({
        ...current,
        connectionState: "connected",
        storageState: current.storageState === "not-configured" ? "not-configured" : "connected",
        mode: "Supabase",
        lastSyncAt: new Date().toLocaleString(),
        message: `${group.batch} / ${group.id} saved as ${status} in Supabase.`
      }));
    } catch (error) {
      setBackendStatus((current) => ({
        ...current,
        connectionState: "offline",
        mode: "Local Fallback",
        message: error instanceof Error ? error.message : "Could not update Supabase group status. Local fallback retained."
      }));
    }
  }, []);

  return (
    <AcvLocalStateContext.Provider
      value={{
        batchNumber,
        setBatchNumber,
        batchName,
        setBatchName,
        batchCreatedAt,
        setBatchCreatedAt,
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
      }}
    >
      {children}
    </AcvLocalStateContext.Provider>
  );
}

export function useAcvLocalState() {
  const context = useContext(AcvLocalStateContext);
  if (!context) {
    throw new Error("useAcvLocalState must be used inside AcvLocalStateProvider");
  }
  return context;
}
