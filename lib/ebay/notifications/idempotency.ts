export function shouldProcessEbayDeletionNotification(row: Pick<{ status: string }, "status">, duplicate: boolean) {
  return !duplicate && row.status !== "completed";
}

