import type { EbayNotificationVerificationResult, ValidatedEbayDeletionPayload } from "./types.ts";

const publicKeyCache = new Map<string, { value: unknown; expiresAt: number }>();

function isLocalUnsignedVerificationAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.EBAY_MARKETPLACE_DELETION_ALLOW_UNSIGNED_LOCAL === "true";
}

function extractPossibleKeyId(signature: string) {
  const [header] = signature.split(".");
  if (!header) return undefined;

  try {
    const decoded = Buffer.from(header.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { kid?: string; keyId?: string; publicKeyId?: string };
    return parsed.kid || parsed.keyId || parsed.publicKeyId;
  } catch {
    return undefined;
  }
}

export async function verifyEbayNotificationSignature({
  rawBody,
  signature,
  payload
}: {
  rawBody: string;
  signature: string | null;
  payload: ValidatedEbayDeletionPayload;
}): Promise<EbayNotificationVerificationResult> {
  void rawBody;
  void payload;

  if (!signature) {
    if (isLocalUnsignedVerificationAllowed()) {
      return {
        verified: true,
        provider: "local-development",
        message: "Unsigned notification accepted by explicit local-development override."
      };
    }

    return {
      verified: false,
      provider: "missing-signature",
      status: 412,
      message: "Missing X-EBAY-SIGNATURE header. Notification was not processed."
    };
  }

  const keyId = extractPossibleKeyId(signature);
  if (keyId && !publicKeyCache.has(keyId)) {
    publicKeyCache.set(keyId, { value: null, expiresAt: Date.now() + 60 * 60 * 1000 });
  }

  // The production route intentionally rejects signed POST processing until the
  // official eBay event-notification signature verifier is wired here. This
  // keeps the endpoint challenge-ready without trusting unverifiable deletion
  // requests. The interface and cache are in place for the future public-key
  // verification flow or official Node SDK.
  return {
    verified: false,
    provider: "pending",
    status: 412,
    keyId,
    message: keyId
      ? `X-EBAY-SIGNATURE was present, but production signature verification is not configured yet for key ${keyId}.`
      : "X-EBAY-SIGNATURE was present, but production signature verification is not configured yet."
  };
}
