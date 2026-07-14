export function describeCurrentEbayDeletionScope(row: {
  notification_id: string;
  ebay_user_id: string | null;
  eias_token_hash: string | null;
}) {
  void row;
  return "No matching persisted eBay account data found.";
}

