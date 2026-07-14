import { EBAY_MARKETPLACE_ACCOUNT_DELETION_TOPIC, type EbayMarketplaceAccountDeletionPayload, type ValidatedEbayDeletionPayload } from "./types.ts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function parseEbayDeletionPayload(rawBody: string): EbayMarketplaceAccountDeletionPayload {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!isPlainObject(parsed)) throw new Error("Request body must be a JSON object.");
    return parsed as EbayMarketplaceAccountDeletionPayload;
  } catch (error) {
    throw new Error(error instanceof Error ? `Malformed JSON: ${error.message}` : "Malformed JSON.");
  }
}

export function validateEbayDeletionPayload(payload: EbayMarketplaceAccountDeletionPayload): ValidatedEbayDeletionPayload {
  const metadata = isPlainObject(payload.metadata) ? payload.metadata : {};
  const notification = isPlainObject(payload.notification) ? payload.notification : {};
  const data = isPlainObject(notification.data) ? notification.data : {};

  const topic = asString(metadata.topic);
  if (topic !== EBAY_MARKETPLACE_ACCOUNT_DELETION_TOPIC) {
    throw new Error(`Unsupported notification topic: ${topic || "missing"}.`);
  }

  const notificationId = asString(notification.notificationId);
  if (!notificationId) {
    throw new Error("notification.notificationId is required.");
  }

  const ebayUserId = asString(data.userId) || undefined;
  const ebayUsername = asString(data.username) || undefined;
  const eiasToken = asString(data.eiasToken) || undefined;

  if (!ebayUserId && !eiasToken && !ebayUsername) {
    throw new Error("notification.data must include at least one supported eBay account identifier.");
  }

  return {
    topic,
    schemaVersion: asString(metadata.schemaVersion) || undefined,
    notificationId,
    eventDate: asString(notification.eventDate) || undefined,
    publishDate: asString(notification.publishDate) || undefined,
    publishAttemptCount: asNumber(notification.publishAttemptCount),
    ebayUsername,
    ebayUserId,
    eiasToken
  };
}
