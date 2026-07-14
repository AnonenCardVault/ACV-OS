-- eBay Marketplace Account Deletion notification compliance.
-- This table stores processing status idempotently by eBay notificationId.
-- Do not store raw tokens or full notification payloads here.

create table if not exists public.ebay_deletion_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  notification_id text not null,
  topic text not null,
  ebay_user_id text,
  ebay_username text,
  eias_token_hash text,
  event_date timestamptz,
  publish_date timestamptz,
  publish_attempt_count integer,
  signature_verified boolean not null default false,
  status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ebay_deletion_notifications_unique unique (notification_id),
  constraint ebay_deletion_notifications_status_check check (status in ('received', 'verified', 'processing', 'completed', 'failed', 'ignored'))
);

create index if not exists ebay_deletion_notifications_user_idx
  on public.ebay_deletion_notifications (user_id, received_at desc)
  where deleted_at is null;

create index if not exists ebay_deletion_notifications_ebay_user_idx
  on public.ebay_deletion_notifications (ebay_user_id)
  where deleted_at is null and ebay_user_id is not null;

create index if not exists ebay_deletion_notifications_status_idx
  on public.ebay_deletion_notifications (status, received_at desc)
  where deleted_at is null;

drop trigger if exists set_ebay_deletion_notifications_updated_at on public.ebay_deletion_notifications;
create trigger set_ebay_deletion_notifications_updated_at
before update on public.ebay_deletion_notifications
for each row execute function public.set_updated_at();

