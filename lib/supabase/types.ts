import type { ApprovedInventoryItem, BatchHistoryEntry, IntakeGroup, IntakeImage, UploadedImage } from "@/lib/acv-local-state";

export type SupabaseConnectionState = "not-configured" | "connecting" | "connected" | "offline";

export type SupabaseBackendStatus = {
  configured: boolean;
  connectionState: SupabaseConnectionState;
  storageState: SupabaseConnectionState;
  mode: "Supabase" | "Local Fallback";
  lastSyncAt?: string;
  message: string;
};

export type AcvSupabaseUser = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

export type UniversalCardProfileRow = {
  id: string;
  user_id: string;
  sku: string;
  title: string;
  player_or_character: string | null;
  team: string | null;
  sport_category: string | null;
  year: string | null;
  brand: string | null;
  set_name: string | null;
  card_number: string | null;
  parallel: string | null;
  serial_number: string | null;
  rookie: boolean;
  auto: boolean;
  relic: boolean;
  variation: boolean;
  grader: string | null;
  grade: string | null;
  status: string | null;
  confidence: number | null;
  condition_notes: string | null;
  uncertainty_notes: string | null;
  internal_notes: string | null;
  local_cache_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InventoryRow = {
  id: string;
  user_id: string;
  universal_card_profile_id: string;
  quantity: number;
  purchase_cost: number;
  market_value: number;
  listed_price: number;
  location: string | null;
  source: string | null;
  acquisition_source: string | null;
  workflow_status: string | null;
  listing_type: string | null;
  views: number;
  watchers: number;
  days_listed: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PricingRow = {
  id: string;
  user_id: string;
  universal_card_profile_id: string;
  market_value: number;
  sold_median: number;
  active_low: number;
  suggested_price: number;
  pricing_confidence: number | null;
  comp_summary: Record<string, unknown>;
  last_priced_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PricingEvidenceRow = {
  id: string;
  user_id: string;
  universal_card_profile_id: string;
  pricing_id: string | null;
  provider: string;
  evidence_type: string;
  label: string;
  value: number | null;
  query: string | null;
  url: string | null;
  notes: string | null;
  confidence: number | null;
  evidence_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ImageRow = {
  id: string;
  user_id: string;
  universal_card_profile_id: string | null;
  intake_batch_id: string | null;
  intake_group_id: string | null;
  role: string;
  display_order: number;
  storage_bucket: string;
  storage_path: string;
  public_url: string | null;
  original_filename: string | null;
  file_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  is_primary: boolean;
  local_image_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type IntakeBatchRow = {
  id: string;
  user_id: string;
  local_batch_id: string | null;
  batch_name: string;
  source: string;
  status: string;
  total_groups: number;
  approved_count: number;
  rejected_count: number;
  research_count: number;
  remaining_count: number;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type IntakeGroupRow = {
  id: string;
  user_id: string;
  batch_id: string;
  group_id: string;
  status: string;
  confidence: number | null;
  extraction_status: string;
  proposed_fields: Record<string, unknown>;
  warnings: unknown[];
  assigned_sku: string | null;
  approved_card_profile_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AuditHistoryRow = {
  id: string;
  user_id: string;
  universal_card_profile_id: string | null;
  event_type: string;
  event_summary: string;
  event_payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ExtractionAttemptRow = {
  id: string;
  user_id: string;
  intake_group_id: string | null;
  batch_id: string | null;
  group_id: string | null;
  provider: string;
  model: string | null;
  status: string;
  confidence: number | null;
  warnings: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SupabaseLoadedState = {
  approvedInventory: ApprovedInventoryItem[];
  batchHistory: BatchHistoryEntry[];
  groups: IntakeGroup[];
  uploadedImages: UploadedImage[];
  approvedIds: string[];
  rejectedIds: string[];
  researchIds: string[];
  assignedSkus: Record<string, string>;
};

export type SupabaseStoredImage = {
  bucket: string;
  path: string;
  publicUrl: string;
};

export type SupabaseImageInput = IntakeImage | UploadedImage;
