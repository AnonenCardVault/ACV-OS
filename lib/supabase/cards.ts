import type { ApprovedInventoryItem, IntakeImage, ProposedRecord } from "@/lib/acv-local-state";
import { getOrCreateAcvUser, insertRows, patchRows, selectRows, upsertRows } from "@/lib/supabase/client";
import { saveImageMetadataRows } from "@/lib/supabase/images";
import { buildStoragePath, uploadDataUrlToBucket } from "@/lib/supabase/storage";
import { logParallelRecognitionEvent } from "@/lib/supabase/parallel-recognition";
import type { AuditHistoryRow, ImageRow, IntakeBatchRow, IntakeGroupRow, InventoryRow, UniversalCardProfileRow } from "@/lib/supabase/types";

function cardsDevLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV Supabase Cards] ${message}`, payload || {});
  }
}

function asNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function positiveNumberOrNull(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function profileToProposed(profile: UniversalCardProfileRow, inventory?: InventoryRow): ProposedRecord {
  return {
    cardName: profile.title,
    playerCharacter: profile.player_or_character || "",
    team: profile.team || "",
    category: profile.sport_category || "Other",
    year: profile.year || "",
    brand: profile.brand || "",
    set: profile.set_name || "",
    cardNumber: profile.card_number || "",
    parallel: profile.parallel || "",
    serialNumber: profile.serial_number || "",
    rookieFlag: Boolean(profile.rookie),
    autoFlag: Boolean(profile.auto),
    relicFlag: Boolean(profile.relic),
    variationFlag: Boolean(profile.variation),
    grader: profile.grader || "Raw",
    grade: profile.grade || "Raw",
    conditionNotes: profile.condition_notes || "",
    uncertaintyNotes: profile.uncertainty_notes || "",
    purchaseCost: asNumber(inventory?.purchase_cost),
    quantity: asNumber(inventory?.quantity, 1),
    acquisitionSource: inventory?.acquisition_source || inventory?.source || "Supabase",
    location: inventory?.location || "Supabase",
    internalNotes: profile.internal_notes || ""
  };
}

function rowToIntakeImage(row: ImageRow): IntakeImage {
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

async function loadInventoryItemsFromSupabase(options: { archived?: boolean } = {}): Promise<ApprovedInventoryItem[]> {
  const user = await getOrCreateAcvUser();
  const inventoryQuery = options.archived
    ? `select=*&user_id=eq.${user.id}&workflow_status=eq.Archived&order=updated_at.desc`
    : `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=created_at.desc`;
  const [profiles, inventoryRows, imageRows, groupRows, batchRows, auditRows] = await Promise.all([
    selectRows<UniversalCardProfileRow>("universal_card_profiles", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=created_at.desc`),
    selectRows<InventoryRow>("inventory", inventoryQuery),
    selectRows<ImageRow>("images", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=display_order.asc`),
    selectRows<IntakeGroupRow>("intake_groups", `select=*&user_id=eq.${user.id}&deleted_at=is.null`),
    selectRows<IntakeBatchRow>("intake_batches", `select=*&user_id=eq.${user.id}&deleted_at=is.null`),
    selectRows<AuditHistoryRow>("audit_history", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=created_at.desc`)
  ]);
  const visibleInventoryRows = options.archived
    ? inventoryRows.filter((row) => row.workflow_status === "Archived")
    : inventoryRows.filter((row) => row.workflow_status !== "Archived" && row.workflow_status !== "Deleted");
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const imagesByProfile = imageRows.reduce((map, row) => {
    if (!row.universal_card_profile_id) return map;
    map.set(row.universal_card_profile_id, [...(map.get(row.universal_card_profile_id) || []), row]);
    return map;
  }, new Map<string, ImageRow[]>());
  const groupById = new Map(groupRows.map((row) => [row.id, row]));
  const groupByProfile = new Map(groupRows.filter((row) => row.approved_card_profile_id).map((row) => [row.approved_card_profile_id as string, row]));
  const batchById = new Map(batchRows.map((row) => [row.id, row]));
  const auditByProfile = auditRows.reduce((map, row) => {
    if (!row.universal_card_profile_id) return map;
    map.set(row.universal_card_profile_id, [...(map.get(row.universal_card_profile_id) || []), `${row.event_summary} (${new Date(row.created_at).toLocaleString()})`]);
    return map;
  }, new Map<string, string[]>());

  const itemFromRows = (profile: UniversalCardProfileRow, inventory?: InventoryRow): ApprovedInventoryItem => {
    const group = inventory?.intake_group_id ? groupById.get(inventory.intake_group_id) : groupByProfile.get(profile.id);
    const batch = group ? batchById.get(group.batch_id) : undefined;
    const images = (imagesByProfile.get(profile.id) || []).map(rowToIntakeImage);
    const primary = images.find((image) => image.role === "Front") || images[0];

    return {
      inventoryId: inventory?.id,
      profileId: profile.id,
      intakeGroupId: inventory?.intake_group_id || group?.id,
      sku: profile.sku,
      batch: batch?.local_batch_id || batch?.batch_name || "Supabase",
      group: group?.group_id || profile.local_cache_key || profile.id,
      source: (batch?.source as ApprovedInventoryItem["source"]) || "Computer Upload",
      primaryImageUrl: primary?.publicUrl || primary?.url || "",
      images,
      proposed: profileToProposed(profile, inventory),
      aiConfidence: typeof profile.confidence === "number" ? Math.round(profile.confidence * 100) : undefined,
      approvedAt: profile.created_at,
      needsImageReupload: images.length === 0 || !primary?.url,
      auditHistory: auditByProfile.get(profile.id) || [],
      listedPrice: positiveNumberOrNull(inventory?.listed_price),
      marketValue: positiveNumberOrNull(inventory?.market_value),
      views: positiveNumberOrNull(inventory?.views),
      watchers: positiveNumberOrNull(inventory?.watchers),
      daysListed: positiveNumberOrNull(inventory?.days_listed),
      workflowStatus: inventory?.workflow_status || profile.status,
      listingType: inventory?.listing_type || "None",
      ebayItemId: null
    };
  };

  const inventoryItems = visibleInventoryRows
    .map((inventory) => {
      const profile = profileById.get(inventory.universal_card_profile_id);
      return profile ? itemFromRows(profile, inventory) : null;
    })
    .filter((item): item is ApprovedInventoryItem => Boolean(item));

  return inventoryItems;
}

export async function loadApprovedInventoryFromSupabase(): Promise<ApprovedInventoryItem[]> {
  return loadInventoryItemsFromSupabase();
}

export async function loadArchivedApprovedInventoryFromSupabase(): Promise<ApprovedInventoryItem[]> {
  return loadInventoryItemsFromSupabase({ archived: true });
}

async function loadApprovedInventoryByInventoryId(inventoryId: string) {
  const items = await loadApprovedInventoryFromSupabase();
  return items.find((item) => item.inventoryId === inventoryId);
}

async function findExistingInventoryByIntakeGroup(userId: string, intakeGroupId?: string) {
  if (!intakeGroupId) return undefined;

  try {
    const [inventory] = await selectRows<InventoryRow>(
      "inventory",
      `select=*&user_id=eq.${userId}&intake_group_id=eq.${encodeURIComponent(intakeGroupId)}&deleted_at=is.null&limit=1`
    );
    return inventory;
  } catch (error) {
    cardsDevLog("intake_group_id lookup unavailable", {
      intakeGroupId,
      error: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  }
}

function inventoryPayload({
  userId,
  profileId,
  item,
  intakeGroupId
}: {
  userId: string;
  profileId: string;
  item: ApprovedInventoryItem;
  intakeGroupId?: string;
}) {
  return {
    user_id: userId,
    universal_card_profile_id: profileId,
    intake_group_id: intakeGroupId || null,
    quantity: Math.max(1, Number(item.proposed.quantity) || 1),
    purchase_cost: Number(item.proposed.purchaseCost) || 0,
    market_value: positiveNumberOrNull(item.marketValue) || 0,
    listed_price: positiveNumberOrNull(item.listedPrice) || 0,
    location: item.proposed.location || "Photo Intake",
    source: item.source,
    acquisition_source: item.proposed.acquisitionSource || item.source,
    workflow_status: item.workflowStatus || "Needs Pricing",
    listing_type: item.listingType || "None",
    views: positiveNumberOrNull(item.views) || 0,
    watchers: positiveNumberOrNull(item.watchers) || 0,
    days_listed: positiveNumberOrNull(item.daysListed) || 0
  };
}

export async function upsertApprovedInventoryItem(
  item: ApprovedInventoryItem,
  options: { intakeGroupId?: string; approvedProfileId?: string | null; reuseExistingByIntakeGroup?: boolean } = {}
): Promise<ApprovedInventoryItem> {
  const user = await getOrCreateAcvUser();
  const intakeGroupId = options.intakeGroupId || item.intakeGroupId;
  if (options.reuseExistingByIntakeGroup) {
    const existingInventory = await findExistingInventoryByIntakeGroup(user.id, intakeGroupId);
    if (existingInventory) {
      cardsDevLog("duplicate approval reused existing inventory", {
        intakeGroupId,
        inventoryId: existingInventory.id,
        sku: item.sku
      });
      const existingItem = await loadApprovedInventoryByInventoryId(existingInventory.id);
      if (existingItem) return existingItem;
    }
    if (options.approvedProfileId) {
      const [existingByProfile] = await selectRows<InventoryRow>(
        "inventory",
        `select=*&user_id=eq.${user.id}&universal_card_profile_id=eq.${encodeURIComponent(options.approvedProfileId)}&deleted_at=is.null&limit=1`
      );
      if (existingByProfile) {
        cardsDevLog("duplicate approval reused profile-linked inventory", {
          intakeGroupId,
          profileId: options.approvedProfileId,
          inventoryId: existingByProfile.id,
          sku: item.sku
        });
        const existingItem = await loadApprovedInventoryByInventoryId(existingByProfile.id);
        if (existingItem) return existingItem;
      }
    }
  }

  const localCacheKey = `intake:${item.batch}:${item.group}`;
  const [profile] = await upsertRows<UniversalCardProfileRow>(
    "universal_card_profiles",
    [
      {
        user_id: user.id,
        sku: item.sku,
        title: item.proposed.cardName || "Untitled card",
        player_or_character: item.proposed.playerCharacter,
        team: item.proposed.team,
        sport_category: item.proposed.category,
        year: item.proposed.year,
        brand: item.proposed.brand,
        set_name: item.proposed.set,
        card_number: item.proposed.cardNumber,
        parallel: item.proposed.parallel,
        serial_number: item.proposed.serialNumber,
        rookie: item.proposed.rookieFlag,
        auto: item.proposed.autoFlag,
        relic: item.proposed.relicFlag,
        variation: item.proposed.variationFlag,
        grader: item.proposed.grader || "Raw",
        grade: item.proposed.grade || "Raw",
        status: "Needs Pricing",
        confidence: typeof item.aiConfidence === "number" ? item.aiConfidence / 100 : null,
        condition_notes: item.proposed.conditionNotes,
        uncertainty_notes: item.proposed.uncertaintyNotes,
        internal_notes: item.proposed.internalNotes,
        local_cache_key: localCacheKey
      }
    ],
    "user_id,sku"
  );

  let inventory: InventoryRow | undefined;
  const nextInventoryPayload = inventoryPayload({ userId: user.id, profileId: profile.id, item, intakeGroupId });

  if (item.inventoryId) {
    [inventory] = await patchRows<InventoryRow>("inventory", `id=eq.${encodeURIComponent(item.inventoryId)}`, nextInventoryPayload);
  } else {
    try {
      [inventory] = await upsertRows<InventoryRow>("inventory", [nextInventoryPayload], "user_id,universal_card_profile_id");
    } catch (error) {
      const existingInventory = await findExistingInventoryByIntakeGroup(user.id, intakeGroupId);
      if (existingInventory) {
        cardsDevLog("unique conflict resolved by reusing inventory", {
          intakeGroupId,
          inventoryId: existingInventory.id,
          error: error instanceof Error ? error.message : String(error)
        });
        const existingItem = await loadApprovedInventoryByInventoryId(existingInventory.id);
        if (existingItem) return existingItem;
      }

      const message = error instanceof Error ? error.message : String(error);
      if (intakeGroupId && message.includes("intake_group_id")) {
        const { intake_group_id: _intakeGroupId, ...fallbackPayload } = nextInventoryPayload;
        [inventory] = await upsertRows<InventoryRow>("inventory", [fallbackPayload], "user_id,universal_card_profile_id");
      } else {
        throw error;
      }
    }
  }

  if (!inventory) {
    const [selectedInventory] = await selectRows<InventoryRow>("inventory", `select=*&user_id=eq.${user.id}&universal_card_profile_id=eq.${profile.id}&deleted_at=is.null&limit=1`);
    inventory = selectedInventory;
  }

  const imageRows: Array<Record<string, unknown>> = [];
  for (const [index, image] of item.images.entries()) {
    const hasDataUrl = Boolean(image.dataUrl?.startsWith("data:"));
    const bucket = "inventory-images";
    const storagePath = image.storagePath && image.storageBucket === bucket ? image.storagePath : buildStoragePath([user.id, item.sku, `${index + 1}-${image.fileName || image.role}.png`]);
    let publicUrl = image.publicUrl || image.url || "";

    if (hasDataUrl) {
      const stored = await uploadDataUrlToBucket({
        bucket,
        path: storagePath,
        dataUrl: image.dataUrl || "",
        contentType: image.fileName?.toLowerCase().endsWith(".jpg") || image.fileName?.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png"
      });
      publicUrl = stored.publicUrl;
    }

    const imageRow = {
      user_id: user.id,
      universal_card_profile_id: profile.id,
      role: image.role,
      display_order: index,
      storage_bucket: bucket,
      storage_path: storagePath,
      public_url: publicUrl,
      original_filename: image.fileName,
      file_type: image.fileName?.split(".").pop() || "image",
      is_primary: image.role === "Front",
      local_image_id: `inventory:${item.batch}:${item.group}:${image.id}`
    };

    if (image.supabaseImageId) {
      await patchRows<ImageRow>("images", `id=eq.${encodeURIComponent(image.supabaseImageId)}`, imageRow);
    } else {
      imageRows.push(imageRow);
    }
  }

  await saveImageMetadataRows(imageRows);
  await insertAuditEvent({
    profileId: profile.id,
    type: "inventory.approved",
    summary: `Approved to Inventory: ${item.sku}`,
    payload: { sku: item.sku, batch: item.batch, group: item.group }
  });
  await logParallelRecognitionEvent({ profileId: profile.id, item }).catch(() => undefined);

  cardsDevLog("inventory approval saved", {
    intakeGroupId,
    inventoryId: inventory?.id,
    profileId: profile.id,
    sku: item.sku
  });

  return {
    ...item,
    inventoryId: inventory?.id || item.inventoryId,
    profileId: profile.id,
    intakeGroupId: intakeGroupId || item.intakeGroupId
  };
}

export async function saveApprovedInventoryItemChanges(item: ApprovedInventoryItem, removedImageIds: string[] = []) {
  const savedItem = await upsertApprovedInventoryItem(item);
  const now = new Date().toISOString();

  if (removedImageIds.length > 0) {
    for (const imageId of removedImageIds) {
      await patchRows<ImageRow>("images", `id=eq.${encodeURIComponent(imageId)}`, { deleted_at: now });
    }
  }

  await insertAuditEvent({
    profileId: savedItem.profileId,
    type: "inventory.updated",
    summary: `Updated Universal Card Profile: ${item.sku}`,
    payload: { sku: item.sku, removedImageIds }
  });

  return savedItem;
}

async function findProfileBySku(sku: string) {
  const user = await getOrCreateAcvUser();
  const [profile] = await selectRows<UniversalCardProfileRow>("universal_card_profiles", `select=*&user_id=eq.${user.id}&sku=eq.${encodeURIComponent(sku)}&deleted_at=is.null&limit=1`);
  return { user, profile };
}

async function findInventoryById(inventoryId: string) {
  const user = await getOrCreateAcvUser();
  const [inventory] = await selectRows<InventoryRow>("inventory", `select=*&user_id=eq.${user.id}&id=eq.${encodeURIComponent(inventoryId)}&deleted_at=is.null&limit=1`);
  if (!inventory) return { user, inventory: undefined, profile: undefined };
  const [profile] = await selectRows<UniversalCardProfileRow>(
    "universal_card_profiles",
    `select=*&user_id=eq.${user.id}&id=eq.${encodeURIComponent(inventory.universal_card_profile_id)}&deleted_at=is.null&limit=1`
  );
  return { user, inventory, profile };
}

async function findInventoryByIdIncludingArchived(inventoryId: string) {
  const user = await getOrCreateAcvUser();
  const [inventory] = await selectRows<InventoryRow>("inventory", `select=*&user_id=eq.${user.id}&id=eq.${encodeURIComponent(inventoryId)}&limit=1`);
  if (!inventory) return { user, inventory: undefined, profile: undefined };
  const [profile] = await selectRows<UniversalCardProfileRow>(
    "universal_card_profiles",
    `select=*&user_id=eq.${user.id}&id=eq.${encodeURIComponent(inventory.universal_card_profile_id)}&limit=1`
  );
  return { user, inventory, profile };
}

async function hasOtherActiveInventory(profileId: string, inventoryId: string) {
  const user = await getOrCreateAcvUser();
  const rows = await selectRows<InventoryRow>(
    "inventory",
    `select=id&user_id=eq.${user.id}&universal_card_profile_id=eq.${encodeURIComponent(profileId)}&id=neq.${encodeURIComponent(inventoryId)}&deleted_at=is.null&limit=1`
  );
  return rows.length > 0;
}

export async function archiveApprovedInventoryItemById(inventoryId: string) {
  const { inventory, profile } = await findInventoryById(inventoryId);
  if (!inventory) return null;
  const now = new Date().toISOString();

  await patchRows<InventoryRow>("inventory", `id=eq.${encodeURIComponent(inventory.id)}`, { workflow_status: "Archived", deleted_at: now });

  await insertAuditEvent({
    profileId: profile?.id || inventory.universal_card_profile_id,
    type: "inventory.archived",
    summary: `Archived inventory row: ${inventory.id}`,
    payload: { inventoryId: inventory.id, sku: profile?.sku }
  });

  return inventory;
}

export async function softDeleteApprovedInventoryItemById(inventoryId: string, archiveImages = false) {
  const { inventory, profile } = await findInventoryById(inventoryId);
  if (!inventory) return null;
  const now = new Date().toISOString();

  await patchRows<InventoryRow>("inventory", `id=eq.${encodeURIComponent(inventory.id)}`, { workflow_status: "Deleted", deleted_at: now });

  if (archiveImages && profile && !(await hasOtherActiveInventory(profile.id, inventory.id))) {
    await patchRows<ImageRow>("images", `universal_card_profile_id=eq.${profile.id}`, { deleted_at: now });
  }

  await insertAuditEvent({
    profileId: profile?.id || inventory.universal_card_profile_id,
    type: "inventory.deleted",
    summary: `Soft deleted inventory row: ${inventory.id}`,
    payload: { inventoryId: inventory.id, sku: profile?.sku, archiveImages }
  });

  return inventory;
}

export async function restoreApprovedInventoryItemById(inventoryId: string) {
  const { inventory, profile } = await findInventoryByIdIncludingArchived(inventoryId);
  if (!inventory) return null;

  const [restored] = await patchRows<InventoryRow>("inventory", `id=eq.${encodeURIComponent(inventory.id)}`, { workflow_status: "Needs Pricing", deleted_at: null });

  if (profile?.deleted_at) {
    await patchRows<UniversalCardProfileRow>("universal_card_profiles", `id=eq.${encodeURIComponent(profile.id)}`, { status: "Needs Pricing", deleted_at: null });
  }

  await insertAuditEvent({
    profileId: profile?.id || inventory.universal_card_profile_id,
    type: "inventory.restored",
    summary: `Restored inventory row: ${inventory.id}`,
    payload: { inventoryId: inventory.id, sku: profile?.sku }
  });

  return restored || inventory;
}

export async function archiveApprovedInventoryItemBySku(sku: string) {
  const { profile } = await findProfileBySku(sku);
  if (!profile) return null;
  const now = new Date().toISOString();

  await Promise.all([
    patchRows<UniversalCardProfileRow>("universal_card_profiles", `id=eq.${profile.id}`, { status: "Archived", deleted_at: now }),
    patchRows<InventoryRow>("inventory", `universal_card_profile_id=eq.${profile.id}`, { workflow_status: "Archived", deleted_at: now })
  ]);

  await insertAuditEvent({
    profileId: profile.id,
    type: "inventory.archived",
    summary: `Archived inventory item: ${sku}`,
    payload: { sku }
  });

  return profile;
}

export async function softDeleteApprovedInventoryItemBySku(sku: string, archiveImages = false) {
  const { profile } = await findProfileBySku(sku);
  if (!profile) return null;
  const now = new Date().toISOString();

  await Promise.all([
    patchRows<UniversalCardProfileRow>("universal_card_profiles", `id=eq.${profile.id}`, { status: "Deleted", deleted_at: now }),
    patchRows<InventoryRow>("inventory", `universal_card_profile_id=eq.${profile.id}`, { workflow_status: "Deleted", deleted_at: now }),
    archiveImages ? patchRows<ImageRow>("images", `universal_card_profile_id=eq.${profile.id}`, { deleted_at: now }) : Promise.resolve([])
  ]);

  await insertAuditEvent({
    profileId: profile.id,
    type: "inventory.deleted",
    summary: `Soft deleted inventory item: ${sku}`,
    payload: { sku, archiveImages }
  });

  return profile;
}

export async function insertAuditEvent({
  profileId,
  type,
  summary,
  payload
}: {
  profileId?: string | null;
  type: string;
  summary: string;
  payload?: Record<string, unknown>;
}) {
  const user = await getOrCreateAcvUser();
  const [event] = await insertRows<AuditHistoryRow>("audit_history", [
    {
      user_id: user.id,
      universal_card_profile_id: profileId || null,
      event_type: type,
      event_summary: summary,
      event_payload: payload || {},
      created_by: "ACV OS local operator"
    }
  ]);
  return event;
}

export async function softDeleteProfile(profileId: string) {
  return patchRows<UniversalCardProfileRow>("universal_card_profiles", `id=eq.${profileId}`, { deleted_at: new Date().toISOString() });
}
