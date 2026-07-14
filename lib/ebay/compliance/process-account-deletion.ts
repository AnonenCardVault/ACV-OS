import { describeCurrentEbayDeletionScope } from "@/lib/ebay/compliance/deletion-scope";
import { updateEbayDeletionNotificationStatus } from "@/lib/ebay/notifications/notification-store";
import type { EbayDeletionNotificationRow } from "@/lib/supabase/types";

function devLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV eBay Compliance] ${message}`, payload || {});
  }
}

export async function processEbayMarketplaceAccountDeletion(row: EbayDeletionNotificationRow) {
  await updateEbayDeletionNotificationStatus({
    id: row.id,
    status: "processing"
  });

  // ACV OS does not have connected eBay account tables yet. Keep this processor
  // deliberately narrow: future eBay OAuth/account/listing/order cache tables
  // should be located by immutable eBay user ID first, then hashed EIAS token,
  // then legacy username only as a secondary match. Do not delete Universal Card
  // Profiles solely because a marketplace account closed.
  devLog("no matching eBay account data to delete yet", {
    notificationId: row.notification_id,
    ebayUserIdPresent: Boolean(row.ebay_user_id),
    eiasTokenHashPresent: Boolean(row.eias_token_hash)
  });

  return updateEbayDeletionNotificationStatus({
    id: row.id,
    status: "completed",
    processed: true,
    errorMessage: describeCurrentEbayDeletionScope(row)
  });
}
