-- ACV OS Phase 2 production backend foundation.
-- ACV OS Principle #1:
-- Every physical card has exactly one Universal Card Profile. Every workstation
-- interacts with that same profile rather than maintaining duplicate card data.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default gen_random_uuid(),
  display_name text,
  email text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.universal_card_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  sku text not null,
  title text not null,
  player_or_character text,
  team text,
  sport_category text,
  year text,
  brand text,
  set_name text,
  card_number text,
  parallel text,
  serial_number text,
  rookie boolean not null default false,
  auto boolean not null default false,
  relic boolean not null default false,
  variation boolean not null default false,
  grader text not null default 'Raw',
  grade text not null default 'Raw',
  status text not null default 'Needs Pricing',
  confidence numeric(5,4),
  condition_notes text,
  uncertainty_notes text,
  internal_notes text,
  local_cache_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint universal_card_profiles_user_sku_unique unique (user_id, sku),
  constraint universal_card_profiles_local_cache_unique unique (user_id, local_cache_key)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid not null references public.universal_card_profiles(id),
  quantity integer not null default 1,
  purchase_cost numeric(12,2) not null default 0,
  market_value numeric(12,2) not null default 0,
  listed_price numeric(12,2) not null default 0,
  location text,
  source text,
  acquisition_source text,
  workflow_status text not null default 'Needs Pricing',
  listing_type text not null default 'None',
  views integer not null default 0,
  watchers integer not null default 0,
  days_listed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inventory_profile_unique unique (user_id, universal_card_profile_id)
);

create table if not exists public.intake_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  local_batch_id text,
  batch_name text not null default 'Untitled Batch',
  source text not null default 'Computer Upload',
  status text not null default 'Reviewing',
  total_groups integer not null default 0,
  approved_count integer not null default 0,
  rejected_count integer not null default 0,
  research_count integer not null default 0,
  remaining_count integer not null default 0,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint intake_batches_local_unique unique (user_id, local_batch_id)
);

create table if not exists public.intake_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  batch_id uuid not null references public.intake_batches(id),
  group_id text not null,
  status text not null default 'Review',
  confidence numeric(5,4),
  extraction_status text not null default 'Not Run',
  proposed_fields jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  assigned_sku text,
  approved_card_profile_id uuid references public.universal_card_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint intake_groups_batch_group_unique unique (batch_id, group_id)
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid references public.universal_card_profiles(id),
  intake_batch_id uuid references public.intake_batches(id),
  intake_group_id uuid references public.intake_groups(id),
  role text not null,
  display_order integer not null default 0,
  storage_bucket text not null,
  storage_path text not null,
  public_url text,
  original_filename text,
  file_type text,
  file_size bigint,
  width integer,
  height integer,
  is_primary boolean not null default false,
  local_image_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint images_storage_unique unique (storage_bucket, storage_path),
  constraint images_local_unique unique (user_id, local_image_id)
);

create table if not exists public.pricing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid not null references public.universal_card_profiles(id),
  market_value numeric(12,2) not null default 0,
  sold_median numeric(12,2) not null default 0,
  active_low numeric(12,2) not null default 0,
  suggested_price numeric(12,2) not null default 0,
  pricing_confidence numeric(5,4),
  comp_summary jsonb not null default '{}'::jsonb,
  last_priced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pricing_profile_unique unique (user_id, universal_card_profile_id)
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid not null references public.universal_card_profiles(id),
  platform text not null default 'eBay',
  ebay_item_id text,
  title text,
  listing_type text not null default 'BIN',
  status text not null default 'Draft',
  price numeric(12,2) not null default 0,
  current_bid numeric(12,2),
  bid_count integer not null default 0,
  views integer not null default 0,
  watchers integer not null default 0,
  quantity integer not null default 1,
  listed_at timestamptz,
  ends_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid not null references public.universal_card_profiles(id),
  platform text not null default 'eBay',
  order_id text,
  buyer_alias text,
  sale_price numeric(12,2) not null default 0,
  shipping_charged numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  supplies_cost numeric(12,2) not null default 0,
  purchase_cost numeric(12,2) not null default 0,
  net_profit numeric(12,2) not null default 0,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.audit_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid references public.universal_card_profiles(id),
  event_type text not null,
  event_summary text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists users_user_id_idx on public.users (user_id) where deleted_at is null;
create index if not exists universal_card_profiles_user_idx on public.universal_card_profiles (user_id) where deleted_at is null;
create index if not exists universal_card_profiles_status_idx on public.universal_card_profiles (status) where deleted_at is null;
create index if not exists inventory_user_idx on public.inventory (user_id) where deleted_at is null;
create index if not exists inventory_profile_idx on public.inventory (universal_card_profile_id) where deleted_at is null;
create index if not exists images_profile_idx on public.images (universal_card_profile_id, display_order) where deleted_at is null;
create index if not exists images_intake_idx on public.images (intake_batch_id, intake_group_id) where deleted_at is null;
create index if not exists intake_batches_user_idx on public.intake_batches (user_id, updated_at desc) where deleted_at is null;
create index if not exists intake_groups_batch_idx on public.intake_groups (batch_id, status) where deleted_at is null;
create index if not exists pricing_profile_idx on public.pricing (universal_card_profile_id) where deleted_at is null;
create index if not exists listings_profile_idx on public.listings (universal_card_profile_id, status) where deleted_at is null;
create index if not exists sales_profile_idx on public.sales (universal_card_profile_id, sold_at desc) where deleted_at is null;
create index if not exists audit_profile_idx on public.audit_history (universal_card_profile_id, created_at desc) where deleted_at is null;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists set_universal_card_profiles_updated_at on public.universal_card_profiles;
create trigger set_universal_card_profiles_updated_at before update on public.universal_card_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_inventory_updated_at on public.inventory;
create trigger set_inventory_updated_at before update on public.inventory for each row execute function public.set_updated_at();
drop trigger if exists set_images_updated_at on public.images;
create trigger set_images_updated_at before update on public.images for each row execute function public.set_updated_at();
drop trigger if exists set_intake_batches_updated_at on public.intake_batches;
create trigger set_intake_batches_updated_at before update on public.intake_batches for each row execute function public.set_updated_at();
drop trigger if exists set_intake_groups_updated_at on public.intake_groups;
create trigger set_intake_groups_updated_at before update on public.intake_groups for each row execute function public.set_updated_at();
drop trigger if exists set_pricing_updated_at on public.pricing;
create trigger set_pricing_updated_at before update on public.pricing for each row execute function public.set_updated_at();
drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
drop trigger if exists set_sales_updated_at on public.sales;
create trigger set_sales_updated_at before update on public.sales for each row execute function public.set_updated_at();
drop trigger if exists set_audit_history_updated_at on public.audit_history;
create trigger set_audit_history_updated_at before update on public.audit_history for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('temp-intake', 'temp-intake', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('inventory-images', 'inventory-images', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('listing-images', 'listing-images', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ACV read card image buckets" on storage.objects;
create policy "ACV read card image buckets"
on storage.objects for select
using (bucket_id in ('temp-intake', 'inventory-images', 'listing-images'));

drop policy if exists "ACV insert card image buckets" on storage.objects;
create policy "ACV insert card image buckets"
on storage.objects for insert
with check (bucket_id in ('temp-intake', 'inventory-images', 'listing-images'));

drop policy if exists "ACV update card image buckets" on storage.objects;
create policy "ACV update card image buckets"
on storage.objects for update
using (bucket_id in ('temp-intake', 'inventory-images', 'listing-images'))
with check (bucket_id in ('temp-intake', 'inventory-images', 'listing-images'));

grant usage on schema public to anon, authenticated;
grant select, insert, update on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update on tables to anon, authenticated;
