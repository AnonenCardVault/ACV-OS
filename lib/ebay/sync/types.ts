import type { EbayEnvironment } from "@/lib/ebay/integration/types";

export type EbaySyncType = "inventory_items" | "offers" | "orders" | "everything";

export type EbaySyncResult = {
  syncRunId?: string;
  environment: EbayEnvironment;
  type: EbaySyncType;
  status: "completed" | "partial_success" | "failed";
  pagesFetched: number;
  recordsReceived: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFailed: number;
  warnings: string[];
  message: string;
  subResults?: EbaySyncResult[];
};

export type EbayApiPage<T> = {
  records: T[];
  total?: number;
  limit: number;
  offset: number;
  raw: unknown;
};

export type EbaySyncContext = {
  environment: EbayEnvironment;
  connectionId: string;
  acvUserId: string;
  marketplaceId: string;
  accessToken: string;
};

