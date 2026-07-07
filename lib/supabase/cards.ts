import type { ApprovedInventoryItem, IntakeImage, ProposedRecord } from "@/lib/acv-local-state";
import { getOrCreateAcvUser, insertRows, patchRows, selectRows, upsertRows } from "@/lib/supabase/client";
import { buildStoragePath, uploadDataUrlToBucket } from "@/lib/supabase/storage";
import type { AuditHistoryRow, ImageRow, IntakeBatchRow, IntakeGroupRow, InventoryRow, UniversalCardProfileRow } from "@/lib/supabase/types";

function asNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
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
    dataUrl: row.public_url || "",
    uploadId: row.local_image_id || row.id,
    order: row.display_order,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    publicUrl: row.public_url || "",
    supabaseImageId: row.id
  };
}

export async function loadApprovedInventoryFromSupabase(): Promise<ApprovedInventoryItem[]> {
  const user = await getOrCreateAcvUser();
  const [profiles, inventoryRows, imageRows, groupRows, batchRows, auditRows] = await Promise.all([
    selectRows<UniversalCardProfileRow>("universal_card_profiles", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=created_at.desc`),
    selectRows<InventoryRow>("inventory", `select=*&user_id=eq.${user.id}&deleted_at=is.null`),
    selectRows<ImageRow>("images", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=display_order.asc`),
    selectRows<IntakeGroupRow>("intake_groups", `select=*&user_id=eq.${user.id}&deleted_at=is.null`),
    selectRows<IntakeBatchRow>("intake_batches", `select=*&user_id=eq.${user.id}&deleted_at=is.null`),
    selectRows<AuditHistoryRow>("audit_history", `select=*&user_id=eq.${user.id}&deleted_at=is.null&order=created_at.desc`)
  ]);
  const inventoryByProfile = new Map(inventoryRows.map((row) => [row.universal_card_profile_id, row]));
  const imagesByProfile = imageRows.reduce((map, row) => {
    if (!row.universal_card_profile_id) return map;
    map.set(row.universal_card_profile_id, [...(map.get(row.universal_card_profile_id) || []), row]);
    return map;
  }, new Map<string, ImageRow[]>());
  const groupByProfile = new Map(groupRows.filter((row) => row.approved_card_profile_id).map((row) => [row.approved_card_profile_id as string, row]));
  const batchById = new Map(batchRows.map((row) => [row.id, row]));
  const auditByProfile = auditRows.reduce((map, row) => {
    if (!row.universal_card_profile_id) return map;
    map.set(row.universal_card_profile_id, [...(map.get(row.universal_card_profile_id) || []), `${row.event_summary} (${new Date(row.created_at).toLocaleString()})`]);
    return map;
  }, new Map<string, string[]>());

  return profiles.map((profile) => {
    const inventory = inventoryByProfile.get(profile.id);
    const group = groupByProfile.get(profile.id);
    const batch = group ? batchById.get(group.batch_id) : undefined;
    const images = (imagesByProfile.get(profile.id) || []).map(rowToIntakeImage);
    const primary = images.find((image) => image.role === "Front") || images[0];

    return {
      sku: profile.sku,
      batch: batch?.local_batch_id || batch?.batch_name || "Supabase",
      group: group?.group_id || profile.local_cache_key || profile.id,
      source: (batch?.source as ApprovedInventoryItem["source"]) || "Computer Upload",
      primaryImageUrl: primary?.publicUrl || primary?.url || "",
      images,
      proposed: profileToProposed(profile, inventory),
      approvedAt: profile.created_at,
      needsImageReupload: images.length === 0 || !primary?.url,
      auditHistory: auditByProfile.get(profile.id) || []
    };
  });
}

export async function upsertApprovedInventoryItem(item: ApprovedInventoryItem) {
  const user = await getOrCreateAcvUser();
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
        confidence: 0.9,
        condition_notes: item.proposed.conditionNotes,
        uncertainty_notes: item.proposed.uncertaintyNotes,
        internal_notes: item.proposed.internalNotes,
        local_cache_key: localCacheKey
      }
    ],
    "user_id,sku"
  );

  await upsertRows<InventoryRow>(
    "inventory",
    [
      {
        user_id: user.id,
        universal_card_profile_id: profile.id,
        quantity: Math.max(1, Number(item.proposed.quantity) || 1),
        purchase_cost: Number(item.proposed.purchaseCost) || 0,
        market_value: 0,
        listed_price: 0,
        location: item.proposed.location || "Photo Intake",
        source: item.source,
        acquisition_source: item.proposed.acquisitionSource || item.source,
        workflow_status: "Needs Pricing",
        listing_type: "None",
        views: 0,
        watchers: 0,
        days_listed: 0
      }
    ],
    "user_id,universal_card_profile_id"
  );

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

    imageRows.push({
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
    });
  }

  await upsertRows<ImageRow>("images", imageRows, "user_id,local_image_id");
  await insertAuditEvent({
    profileId: profile.id,
    type: "inventory.approved",
    summary: `Approved to Inventory: ${item.sku}`,
    payload: { sku: item.sku, batch: item.batch, group: item.group }
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
