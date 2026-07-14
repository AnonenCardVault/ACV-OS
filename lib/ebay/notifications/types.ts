export const EBAY_MARKETPLACE_ACCOUNT_DELETION_TOPIC = "MARKETPLACE_ACCOUNT_DELETION";

export type EbayMarketplaceAccountDeletionPayload = {
  metadata?: {
    topic?: string;
    schemaVersion?: string;
    deprecated?: boolean;
  };
  notification?: {
    notificationId?: string;
    eventDate?: string;
    publishDate?: string;
    publishAttemptCount?: number;
    data?: {
      username?: string;
      userId?: string;
      eiasToken?: string;
    };
  };
};

export type ValidatedEbayDeletionPayload = {
  topic: string;
  schemaVersion?: string;
  notificationId: string;
  eventDate?: string;
  publishDate?: string;
  publishAttemptCount?: number;
  ebayUsername?: string;
  ebayUserId?: string;
  eiasToken?: string;
};

export type EbayNotificationVerificationResult =
  | {
      verified: true;
      provider: "local-development" | "ebay-signature";
      message: string;
      keyId?: string;
    }
  | {
      verified: false;
      provider: "pending" | "missing-signature" | "invalid-signature";
      message: string;
      status: number;
      keyId?: string;
    };

export type EbayDeletionStatus = "received" | "verified" | "processing" | "completed" | "failed" | "ignored";

