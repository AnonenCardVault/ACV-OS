import { createHash } from "crypto";

export type EbayDeletionConfig = {
  verificationToken: string;
  endpointUrl: string;
  missing: string[];
  configured: boolean;
};

export function getEbayDeletionConfig(): EbayDeletionConfig {
  const verificationToken = process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN || "";
  const endpointUrl = process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT || "";
  const missing: string[] = [];

  if (!verificationToken) missing.push("EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN");
  if (!endpointUrl) missing.push("EBAY_MARKETPLACE_DELETION_ENDPOINT");

  return {
    verificationToken,
    endpointUrl,
    missing,
    configured: missing.length === 0
  };
}

export function computeMarketplaceDeletionChallengeResponse({
  challengeCode,
  verificationToken,
  endpointUrl
}: {
  challengeCode: string;
  verificationToken: string;
  endpointUrl: string;
}) {
  return createHash("sha256").update(`${challengeCode}${verificationToken}${endpointUrl}`, "utf8").digest("hex");
}

let lastMarketplaceDeletionChallengeAt: string | null = null;

export function markMarketplaceDeletionChallengeVerified(at = new Date().toISOString()) {
  lastMarketplaceDeletionChallengeAt = at;
}

export function getLastMarketplaceDeletionChallengeAt() {
  return lastMarketplaceDeletionChallengeAt;
}
