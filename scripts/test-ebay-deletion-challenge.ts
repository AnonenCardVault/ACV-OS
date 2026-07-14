import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { computeMarketplaceDeletionChallengeResponse } from "../lib/ebay/notifications/challenge.ts";
import { describeCurrentEbayDeletionScope } from "../lib/ebay/compliance/deletion-scope.ts";
import { shouldProcessEbayDeletionNotification } from "../lib/ebay/notifications/idempotency.ts";
import { parseEbayDeletionPayload, validateEbayDeletionPayload } from "../lib/ebay/notifications/validate-notification.ts";
import { verifyEbayNotificationSignature } from "../lib/ebay/notifications/verify-notification.ts";

const sampleChallengeCode = "sample-challenge-code";
const sampleVerificationToken = "sample-verification-token";
const sampleEndpointUrl = "https://acv-os.vercel.app/api/ebay/marketplace-account-deletion";

const expected = createHash("sha256")
  .update(`${sampleChallengeCode}${sampleVerificationToken}${sampleEndpointUrl}`, "utf8")
  .digest("hex");

assert.equal(
  computeMarketplaceDeletionChallengeResponse({
    challengeCode: sampleChallengeCode,
    verificationToken: sampleVerificationToken,
    endpointUrl: sampleEndpointUrl
  }),
  expected,
  "challenge response must use challengeCode + verificationToken + endpointUrl in that exact order"
);

assert.throws(
  () => validateEbayDeletionPayload(parseEbayDeletionPayload("{}")),
  /Unsupported notification topic/,
  "missing topic should be rejected"
);

assert.throws(
  () => parseEbayDeletionPayload("{not-json"),
  /Malformed JSON/,
  "malformed JSON should be rejected"
);

const validBody = JSON.stringify({
  metadata: {
    topic: "MARKETPLACE_ACCOUNT_DELETION",
    schemaVersion: "1.0",
    deprecated: false
  },
  notification: {
    notificationId: "unit-test-notification-1",
    eventDate: "2026-07-13T00:00:00Z",
    publishDate: "2026-07-13T00:00:01Z",
    publishAttemptCount: 1,
    data: {
      username: "sample",
      userId: "ebay-user-123",
      eiasToken: "opaque-eias-token"
    }
  }
});

const validPayload = validateEbayDeletionPayload(parseEbayDeletionPayload(validBody));
assert.equal(validPayload.notificationId, "unit-test-notification-1");
assert.equal(validPayload.ebayUserId, "ebay-user-123");

const missingSignature = await verifyEbayNotificationSignature({
  rawBody: validBody,
  signature: null,
  payload: validPayload
});

assert.equal(missingSignature.verified, false);
assert.equal(missingSignature.status, 412);

assert.equal(shouldProcessEbayDeletionNotification({ status: "verified" }, false), true);
assert.equal(shouldProcessEbayDeletionNotification({ status: "completed" }, false), false);
assert.equal(shouldProcessEbayDeletionNotification({ status: "verified" }, true), false);

assert.equal(
  describeCurrentEbayDeletionScope({
    notification_id: "unit-test-notification-1",
    ebay_user_id: "ebay-user-123",
    eias_token_hash: null
  }),
  "No matching persisted eBay account data found."
);

console.info("eBay Marketplace Account Deletion challenge tests passed.");
