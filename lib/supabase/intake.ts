import type { ApprovedInventoryItem, BatchHistoryEntry, IntakeGroup, IntakeImage, ProposedRecord, UploadedImage } from "@/lib/acv-local-state";
import { getOrCreateAcvUser, patchRows, selectRows, upsertRows } from "@/lib/supabase/client";
import { insertAuditEvent, loadApprovedInventoryFromSupabase, upsertApprovedInventoryItem } from "@/lib/supabase/cards";
import { saveImageMetadataRows } from "@/lib/supabase/images";
import { buildStoragePath, uploadDataUrlToBucket, uploadFileToBucket } from "@/lib/supabase/storage";
import type { ImageRow, IntakeBatchRow, IntakeGroupRow, SupabaseLoadedState, SupabaseStoredImage } from "@/lib/supabase/types";

const defaultProposed: ProposedRecord = {
  cardName: "Untitled card",
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
  conditionNotes: "",
  uncertaintyNotes: "",
  purchaseCost: 0,
  quantity: 1,
  acquisitionSource: "Computer Upload",
  location: "Photo Intake",
  internalNotes: ""
};

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeProposed(value: unknown): ProposedRecord {
  if (!value || typeof value !== "object") return defaultProposed;
  return { ...defaultProposed, ...(value as Partial<ProposedRecord>) };
}

function rowToImage(row: ImageRow): IntakeImage {
  return {
    id: row.local_image_id || row.id,
    role: row.role as IntakeImage["role"],
    label: row.original_filename || row.role,
    fileName: row.original_filename || row.storage_path.split("/").pop() || row.role,
    url: row.public_url || "",
    dataUrl: undefined,
    uploadId: row.local_image_id || row.id,
    order: row.display_order,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url || "",
    supabaseImageId: row.id
  };
}

function groupStatus(group: IntakeGroup, entry: BatchHistoryEntry) {
  if (entry.approvedIds.includes(group.id)) return "Approved";
  if (entry.rejectedIds.includes(group.id)) return "Rejected";
  if (entry.researchIds.includes(group.id)) return "Needs Research";
  return group.pairingStatus || "Review";
}

function batchStatus(entry: BatchHistoryEntry) {
  if (entry.remaining === 0 && entry.cardCount > 0) return "Complete";
  if (entry.researchIds.length > 0) return "Needs Research";
  return entry.status || "Reviewing";
}

async function uploadImageForGroup({
  userId,
  batchId,
  groupId,
  image
}: {
  userId: string;
  batchId: string;
  groupId: string;
  image: IntakeImage;
}): Promise<SupabaseStoredImage | null> {
  if (image.storageBucket && image.storagePath && image.publicUrl) {
    return { bucket: image.storageBucket, path: image.storagePath, publicUrl: image.publicUrl };
  }
  if (!image.dataUrl?.startsWith("data:")) return null;

  return uploadDataUrlToBucket({
    bucket: "temp-intake",
    path: buildStoragePath([userId, batchId, groupId, `${image.order ?? 0}-${image.fileName || image.role}.png`]),
    dataUrl: image.dataUrl,
    contentType: image.fileName?.toLowerCase().endsWith(".jpg") || image.fileName?.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png"
  });
}

export async function uploadTempIntakeFile({
  file,
  batchId,
  uploadId
}: {
  file: File;
  batchId: string;
  uploadId: string;
}) {
  const user = await getOrCreateAcvUser();
  return uploadFileToBucket({
    bucket: "temp-intake",
    path: buildStoragePath([user.id, batchId, `${uploadId}-${file.name}`]),
    file
  });
}

export async function saveBatchSnapshotToSupabase(entry: BatchHistoryEntry) {
  const user = await getOrCreateAcvUser();
  const [batch] = await upsertRows<IntakeBatchRow>(
    "intake_batches",
    [
      {
        user_id: user.id,
        local_batch_id: entry.batchId,
        batch_name: entry.batchName || "Untitled Batch",
        source: entry.source,
        status: batchStatus(entry),
        total_groups: entry.cardCount,
        approved_count: entry.approved,
        rejected_count: entry.rejected,
        research_count: entry.researchIds.length,
        remaining_count: entry.remaining,
        last_opened_at: parseDate(entry.lastOpened || new Date().toISOString())
      }
    ],
    "user_id,local_batch_id"
  );

  const groupRows = await upsertRows<IntakeGroupRow>(
    "intake_groups",
    entry.groups.map((group) => ({
      user_id: user.id,
      batch_id: batch.id,
      group_id: group.id,
      status: groupStatus(group, entry),
      confidence: group.confidence / 100,
      extraction_status: group.aiExtraction?.status || "Not Run",
      proposed_fields: group.proposed,
      warnings: [...group.warnings, ...(group.aiExtraction?.warnings || [])],
      assigned_sku: entry.assignedSkus[group.id] || null
    })),
    "batch_id,group_id"
  );

  const groupRowById = new Map(groupRows.map((row) => [row.group_id, row]));
  const imageRows: Array<Record<string, unknown>> = [];

  for (const group of entry.groups) {
    const groupRow = groupRowById.get(group.id);
    if (!groupRow) continue;
    for (const [index, image] of group.images.entries()) {
      const stored = await uploadImageForGroup({ userId: user.id, batchId: entry.batchId, groupId: group.id, image });
      if (!stored) continue;
      imageRows.push({
        user_id: user.id,
        intake_batch_id: batch.id,
        intake_group_id: groupRow.id,
        role: image.role,
        display_order: index,
        storage_bucket: stored.bucket,
        storage_path: stored.path,
        public_url: stored.publicUrl,
        original_filename: image.fileName,
        file_type: image.fileName?.split(".").pop() || "image",
        is_primary: image.role === "Front",
        local_image_id: `intake:${entry.batchId}:${group.id}:${image.id}`
      });
    }
  }

  await saveImageMetadataRows(imageRows);
  return batch;
}

export async function approveGroupToSupabase(entry: BatchHistoryEntry, group: IntakeGroup, approvedItem: ApprovedInventoryItem) {
  const batchSnapshot = await saveBatchSnapshotToSupabase(entry);
  const batches = await selectRows<IntakeBatchRow>("intake_batches", `select=*&local_batch_id=eq.${encodeURIComponent(group.batch)}&deleted_at=is.null&limit=1`);
  const batch = batches[0] || batchSnapshot;
  const [groupRow] = batch
    ? await selectRows<IntakeGroupRow>("intake_groups", `select=*&batch_id=eq.${batch.id}&group_id=eq.${encodeURIComponent(group.id)}&deleted_at=is.null&limit=1`)
    : [];
  const savedItem = await upsertApprovedInventoryItem(
    {
      ...approvedItem,
      intakeGroupId: groupRow?.id || approvedItem.intakeGroupId
    },
    {
      intakeGroupId: groupRow?.id,
      approvedProfileId: groupRow?.approved_card_profile_id,
      reuseExistingByIntakeGroup: true
    }
  );
  if (batch) {
    await patchRows<IntakeGroupRow>("intake_groups", `batch_id=eq.${batch.id}&group_id=eq.${encodeURIComponent(group.id)}`, {
      status: "Approved",
      assigned_sku: approvedItem.sku,
      approved_card_profile_id: savedItem.profileId || null,
      proposed_fields: group.proposed,
      warnings: [...group.warnings, ...(group.aiExtraction?.warnings || [])],
      extraction_status: group.aiExtraction?.status || "Not Run"
    });
  }
  return savedItem;
}

export async function updateIntakeGroupStatusInSupabase(entry: BatchHistoryEntry, group: IntakeGroup, status: "Rejected" | "Needs Research") {
  await saveBatchSnapshotToSupabase(entry);
  const batches = await selectRows<IntakeBatchRow>("intake_batches", `select=*&local_batch_id=eq.${encodeURIComponent(group.batch)}&deleted_at=is.null&limit=1`);
  const batch = batches[0];
  if (!batch) return;
  const [updated] = await patchRows<IntakeGroupRow>("intake_groups", `batch_id=eq.${batch.id}&group_id=eq.${encodeURIComponent(group.id)}`, {
    status,
    proposed_fields: group.proposed,
    warnings: [...group.warnings, ...(group.aiExtraction?.warnings || [])],
    extraction_status: group.aiExtraction?.status || "Not Run"
  });
  await insertAuditEvent({
    type: status === "Rejected" ? "intake.rejected" : "intake.needs_research",
    summary: `${group.batch} / ${group.id} marked ${status}`,
    payload: { batch: group.batch, group: group.id, status }
  });
  return updated;
}

export async function loadIntakeStateFromSupabase(): Promise<Omit<SupabaseLoadedState, "approvedInventory">> {
  const user = await getOrCreateAcvUser();
  const [batches, groups, imageRows] = await Promise.all([
    selectRows<IntakeBatchRow>("intake_batches", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=updated_at.desc`),
    selectRows<IntakeGroupRow>("intake_groups", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=created_at.asc`),
    selectRows<ImageRow>("images", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=display_order.asc`)
  ]);
  const latestBatch = batches[0];
  const imagesByGroup = imageRows.reduce((map, row) => {
    if (!row.intake_group_id) return map;
    map.set(row.intake_group_id, [...(map.get(row.intake_group_id) || []), row]);
    return map;
  }, new Map<string, ImageRow[]>());
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const latestGroups = latestBatch ? groups.filter((group) => group.batch_id === latestBatch.id) : [];

  const intakeGroups: IntakeGroup[] = latestGroups.map((row) => ({
    id: row.group_id,
    batch: latestBatch?.local_batch_id || "B-000",
    source: (latestBatch?.source as IntakeGroup["source"]) || "Computer Upload",
    images: (imagesByGroup.get(row.id) || []).map(rowToImage),
    pairingStatus: row.status,
    confidence: Math.round((row.confidence || 0) * 100),
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
    proposed: normalizeProposed(row.proposed_fields),
    aiExtraction: {
      status: row.extraction_status === "Extracted" || row.extraction_status === "Needs Review" || row.extraction_status === "Failed" || row.extraction_status === "Cleared" ? row.extraction_status : "Not Run",
      fieldConfidence: {},
      warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : [],
      suggestedTitle: ""
    }
  }));

  const approvedIds = latestGroups.filter((group) => group.status === "Approved").map((group) => group.group_id);
  const rejectedIds = latestGroups.filter((group) => group.status === "Rejected").map((group) => group.group_id);
  const researchIds = latestGroups.filter((group) => group.status === "Needs Research").map((group) => group.group_id);
  const assignedSkus = Object.fromEntries(latestGroups.filter((group) => group.assigned_sku).map((group) => [group.group_id, group.assigned_sku as string]));

  const batchHistory: BatchHistoryEntry[] = batches.map((batch) => {
    const batchGroups = groups.filter((group) => group.batch_id === batch.id);
    const batchImages = imageRows.filter((row) => row.intake_batch_id === batch.id);
    const approved = batchGroups.filter((group) => group.status === "Approved").map((group) => group.group_id);
    const rejected = batchGroups.filter((group) => group.status === "Rejected").map((group) => group.group_id);
    const research = batchGroups.filter((group) => group.status === "Needs Research").map((group) => group.group_id);

    return {
      batchId: batch.local_batch_id || batch.id,
      batchName: batch.batch_name,
      createdDate: batch.created_at,
      source: (batch.source as BatchHistoryEntry["source"]) || "Computer Upload",
      cardCount: batch.total_groups,
      status: batch.status,
      approved: batch.approved_count,
      rejected: batch.rejected_count,
      remaining: batch.remaining_count,
      lastOpened: batch.last_opened_at || batch.updated_at,
      uploadedImages: batchImages.map((image) => ({
        id: image.local_image_id || image.id,
        fileName: image.original_filename || image.storage_path,
        url: image.public_url || "",
        dataUrl: undefined,
        type: image.file_type || "image/*",
        order: image.display_order,
        storageBucket: image.storage_bucket,
        storagePath: image.storage_path,
        publicUrl: image.public_url || "",
        supabaseImageId: image.id
      })),
      groups: batchGroups.map((group) => ({
        id: group.group_id,
        batch: batch.local_batch_id || batch.id,
        source: (batch.source as IntakeGroup["source"]) || "Computer Upload",
        images: (imagesByGroup.get(group.id) || []).map(rowToImage),
        pairingStatus: group.status,
        confidence: Math.round((group.confidence || 0) * 100),
        warnings: Array.isArray(group.warnings) ? group.warnings.map(String) : [],
        proposed: normalizeProposed(group.proposed_fields)
      })),
      selectedGroupId: batchGroups[0]?.group_id || "",
      approvedIds: approved,
      researchIds: research,
      rejectedIds: rejected,
      assignedSkus: Object.fromEntries(batchGroups.filter((group) => group.assigned_sku).map((group) => [group.group_id, group.assigned_sku as string]))
    };
  });

  return {
    batchHistory,
    groups: intakeGroups,
    uploadedImages: [],
    approvedIds,
    rejectedIds,
    researchIds,
    assignedSkus
  };
}

export async function loadSupabaseState(): Promise<SupabaseLoadedState> {
  const [approvedInventory, intakeState] = await Promise.all([loadApprovedInventoryFromSupabase(), loadIntakeStateFromSupabase()]);
  return { approvedInventory, ...intakeState };
}

export async function migrateLocalStateToSupabase(localState: {
  uploadedImages?: UploadedImage[];
  groups?: IntakeGroup[];
  approvedIds?: string[];
  researchIds?: string[];
  rejectedIds?: string[];
  assignedSkus?: Record<string, string>;
  approvedInventory?: ApprovedInventoryItem[];
  batchHistory?: BatchHistoryEntry[];
  batchNumber?: number;
  batchName?: string;
  batchCreatedAt?: string;
}) {
  const batchId = `B-${String(localState.batchNumber || 73).padStart(3, "0")}`;
  const currentEntry: BatchHistoryEntry = {
    batchId,
    batchName: localState.batchName || "Untitled Batch",
    createdDate: localState.batchCreatedAt || new Date().toISOString(),
    source: "Computer Upload",
    cardCount: localState.groups?.length || 0,
    status: "Reviewing",
    approved: localState.approvedIds?.length || 0,
    rejected: localState.rejectedIds?.length || 0,
    remaining: (localState.groups || []).filter((group) => !(localState.approvedIds || []).includes(group.id) && !(localState.rejectedIds || []).includes(group.id)).length,
    lastOpened: new Date().toISOString(),
    uploadedImages: localState.uploadedImages || [],
    groups: localState.groups || [],
    selectedGroupId: localState.groups?.[0]?.id || "",
    approvedIds: localState.approvedIds || [],
    researchIds: localState.researchIds || [],
    rejectedIds: localState.rejectedIds || [],
    assignedSkus: localState.assignedSkus || {}
  };

  if (currentEntry.groups.length > 0) await saveBatchSnapshotToSupabase(currentEntry);
  for (const entry of localState.batchHistory || []) {
    await saveBatchSnapshotToSupabase(entry);
  }
  for (const item of localState.approvedInventory || []) {
    await upsertApprovedInventoryItem(item);
  }
}
