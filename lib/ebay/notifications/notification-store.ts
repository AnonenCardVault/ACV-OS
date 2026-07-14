import { createHash } from "crypto";
import { getLastMarketplaceDeletionChallengeAt } from "@/lib/ebay/notifications/challenge";
import { getOrCreateAcvUser, patchRows, selectRows, upsertRows } from "@/lib/supabase/client";
import type { EbayDeletionStatus, ValidatedEbayDeletionPayload } from "@/lib/ebay/notifications/types";
import type { EbayDeletionNotificationRow } from "@/lib/supabase/types";

function hashNullable(value?: string) {
  if (!value) return null;
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function devLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV eBay Deletion] ${message}`, payload || {});
  }
}

export async function findEbayDeletionNotification(notificationId: string) {
  const [existing] = await selectRows<EbayDeletionNotificationRow>(
    "ebay_deletion_notifications",
    `select=*&notification_id=eq.${encodeURIComponent(notificationId)}&limit=1`
  );
  return existing;
}

export async function recordEbayDeletionNotification({
  payload,
  signatureVerified,
  status,
  errorMessage
}: {
  payload: ValidatedEbayDeletionPayload;
  signatureVerified: boolean;
  status: EbayDeletionStatus;
  errorMessage?: string | null;
}) {
  const user = await getOrCreateAcvUser();
  const existing = await findEbayDeletionNotification(payload.notificationId);

  if (existing) {
    const shouldPromotePreviouslyRejectedNotification = signatureVerified && !existing.signature_verified && existing.status === "failed";
    const [updated] = await patchRows<EbayDeletionNotificationRow>(
      "ebay_deletion_notifications",
      `id=eq.${encodeURIComponent(existing.id)}`,
      {
        ebay_user_id: shouldPromotePreviouslyRejectedNotification ? payload.ebayUserId || null : existing.ebay_user_id,
        ebay_username: shouldPromotePreviouslyRejectedNotification ? payload.ebayUsername || null : existing.ebay_username,
        eias_token_hash: shouldPromotePreviouslyRejectedNotification ? hashNullable(payload.eiasToken) : existing.eias_token_hash,
        signature_verified: shouldPromotePreviouslyRejectedNotification ? true : existing.signature_verified,
        status: shouldPromotePreviouslyRejectedNotification ? status : existing.status,
        publish_attempt_count: payload.publishAttemptCount ?? existing.publish_attempt_count,
        error_message: shouldPromotePreviouslyRejectedNotification ? null : errorMessage ?? existing.error_message
      }
    );
    devLog("duplicate notification reused", {
      notificationId: payload.notificationId,
      status: updated?.status || existing.status,
      promotedRejectedNotification: shouldPromotePreviouslyRejectedNotification
    });
    return { row: updated || existing, duplicate: !shouldPromotePreviouslyRejectedNotification };
  }

  const [row] = await upsertRows<EbayDeletionNotificationRow>(
    "ebay_deletion_notifications",
    [
      {
        user_id: user.id,
        notification_id: payload.notificationId,
        topic: payload.topic,
        ebay_user_id: signatureVerified ? payload.ebayUserId || null : null,
        ebay_username: signatureVerified ? payload.ebayUsername || null : null,
        eias_token_hash: signatureVerified ? hashNullable(payload.eiasToken) : null,
        event_date: payload.eventDate || null,
        publish_date: payload.publishDate || null,
        publish_attempt_count: payload.publishAttemptCount ?? null,
        signature_verified: signatureVerified,
        status,
        error_message: errorMessage || null
      }
    ],
    "notification_id"
  );
  devLog("notification recorded", {
    notificationId: payload.notificationId,
    status,
    signatureVerified
  });

  return { row, duplicate: false };
}

export async function updateEbayDeletionNotificationStatus({
  id,
  status,
  errorMessage,
  processed
}: {
  id: string;
  status: EbayDeletionStatus;
  errorMessage?: string | null;
  processed?: boolean;
}) {
  const [row] = await patchRows<EbayDeletionNotificationRow>(
    "ebay_deletion_notifications",
    `id=eq.${encodeURIComponent(id)}`,
    {
      status,
      error_message: errorMessage || null,
      processed_at: processed ? new Date().toISOString() : null
    }
  );
  return row;
}

export async function getEbayDeletionComplianceSummary() {
  const configured = Boolean(process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN && process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT);
  const endpointUrl = process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT || "Not configured";

  try {
    const rows = await selectRows<EbayDeletionNotificationRow>(
      "ebay_deletion_notifications",
      "select=*&order=received_at.desc&limit=25"
    );
    const lastNotification = rows[0];
    const lastCompleted = rows.find((row) => row.status === "completed");

    return {
      configured,
      endpointUrl,
      lastChallengeAt: getLastMarketplaceDeletionChallengeAt(),
      lastNotificationAt: lastNotification?.received_at || null,
      lastSuccessfulProcessingAt: lastCompleted?.processed_at || null,
      status: configured ? "Notification verification pending" : "Misconfigured",
      message: configured
        ? "GET challenge is ready. POST deletion processing is gated until eBay signature verification is fully configured."
        : "Missing server-only eBay Marketplace Account Deletion environment variables."
    };
  } catch (error) {
    return {
      configured,
      endpointUrl,
      lastChallengeAt: getLastMarketplaceDeletionChallengeAt(),
      lastNotificationAt: null as string | null,
      lastSuccessfulProcessingAt: null as string | null,
      status: configured ? "Error" : "Misconfigured",
      message: error instanceof Error ? error.message : "Could not load eBay deletion notification status."
    };
  }
}
