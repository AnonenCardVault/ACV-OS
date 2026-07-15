-- eBay Sandbox user OAuth and read-only seller sync staging.
-- These tables intentionally keep marketplace evidence separate from ACV
-- Universal Card Profiles and Inventory source-of-truth records.

create table if not exists public.ebay_connections (
  id uuid primary key default gen_random_uuid(),
  acv_user_id uuid not null references public.users(id),
  environment text not null,
  marketplace_id text not null default 'EBAY_US',
  ebay_user_id text,
  ebay_username text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[],
  connection_status text not null default 'disconnected',
  last_connected_at timestamptz,
  last_refreshed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ebay_connections_environment_check check (environment in ('sandbox', 'production')),
  constraint ebay_connections_status_check check (connection_status in ('connected', 'disconnected', 'reauthorization_required', 'failed')),
  constraint ebay_connections_user_environment_unique unique (acv_user_id, environment)
);

create table if not exists public.ebay_sync_runs (
  id uuid primary key default gen_random_uuid(),
  acv_user_id uuid not null references public.users(id),
  ebay_connection_id uuid not null references public.ebay_connections(id),
  environment text not null,
  sync_type text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  pages_fetched integer not null default 0,
  records_received integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_unchanged integer not null default 0,
  records_failed integer not null default 0,
  warning_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ebay_sync_runs_environment_check check (environment in ('sandbox', 'production')),
  constraint ebay_sync_runs_type_check check (sync_type in ('inventory_items', 'offers', 'orders', 'everything')),
  constraint ebay_sync_runs_status_check check (status in ('running', 'completed', 'partial_success', 'failed'))
);

create table if not exists public.ebay_inventory_items (
  id uuid primary key default gen_random_uuid(),
  acv_user_id uuid not null references public.users(id),
  ebay_connection_id uuid not null references public.ebay_connections(id),
  environment text not null,
  marketplace_id text not null default 'EBAY_US',
  sku text not null,
  product_title text,
  description text,
  aspects jsonb not null default '{}'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  condition text,
  quantity integer,
  package_details jsonb not null default '{}'::jsonb,
  availability jsonb not null default '{}'::jsonb,
  locale text,
  raw_status text,
  source_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ebay_inventory_items_environment_check check (environment in ('sandbox', 'production')),
  constraint ebay_inventory_items_unique unique (ebay_connection_id, environment, sku)
);

create table if not exists public.ebay_offers (
  id uuid primary key default gen_random_uuid(),
  acv_user_id uuid not null references public.users(id),
  ebay_connection_id uuid not null references public.ebay_connections(id),
  environment text not null,
  marketplace_id text not null default 'EBAY_US',
  offer_id text not null,
  sku text,
  listing_id text,
  offer_status text,
  listing_state text,
  price_value numeric(12,2),
  price_currency text,
  quantity_limit_per_buyer integer,
  available_quantity integer,
  category_id text,
  fulfillment_policy_id text,
  payment_policy_id text,
  return_policy_id text,
  listing_description text,
  merchant_location_key text,
  listing_duration text,
  include_catalog_product_details boolean,
  source_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ebay_offers_environment_check check (environment in ('sandbox', 'production')),
  constraint ebay_offers_unique unique (ebay_connection_id, environment, offer_id)
);

create table if not exists public.ebay_orders (
  id uuid primary key default gen_random_uuid(),
  acv_user_id uuid not null references public.users(id),
  ebay_connection_id uuid not null references public.ebay_connections(id),
  environment text not null,
  marketplace_id text not null default 'EBAY_US',
  order_id text not null,
  creation_date timestamptz,
  last_modified_date timestamptz,
  order_fulfillment_status text,
  order_payment_status text,
  pricing_summary jsonb not null default '{}'::jsonb,
  total_value numeric(12,2),
  total_currency text,
  shipping_cost_value numeric(12,2),
  tax_value numeric(12,2),
  cancellation_status text,
  refund_status text,
  source_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ebay_orders_environment_check check (environment in ('sandbox', 'production')),
  constraint ebay_orders_unique unique (ebay_connection_id, environment, order_id)
);

create table if not exists public.ebay_order_lines (
  id uuid primary key default gen_random_uuid(),
  acv_user_id uuid not null references public.users(id),
  ebay_connection_id uuid not null references public.ebay_connections(id),
  ebay_order_id uuid not null references public.ebay_orders(id),
  environment text not null,
  marketplace_id text not null default 'EBAY_US',
  order_id text not null,
  line_item_id text not null,
  legacy_item_id text,
  listing_id text,
  sku text,
  title text,
  quantity integer,
  line_item_cost_value numeric(12,2),
  line_item_cost_currency text,
  fulfillment_status text,
  source_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ebay_order_lines_environment_check check (environment in ('sandbox', 'production')),
  constraint ebay_order_lines_unique unique (ebay_connection_id, environment, order_id, line_item_id)
);

create index if not exists ebay_connections_user_idx on public.ebay_connections (acv_user_id, environment) where deleted_at is null;
create index if not exists ebay_sync_runs_connection_idx on public.ebay_sync_runs (ebay_connection_id, sync_type, started_at desc) where deleted_at is null;
create index if not exists ebay_inventory_items_connection_idx on public.ebay_inventory_items (ebay_connection_id, last_synced_at desc) where deleted_at is null;
create index if not exists ebay_offers_connection_idx on public.ebay_offers (ebay_connection_id, offer_status, last_synced_at desc) where deleted_at is null;
create index if not exists ebay_orders_connection_idx on public.ebay_orders (ebay_connection_id, creation_date desc) where deleted_at is null;
create index if not exists ebay_order_lines_order_idx on public.ebay_order_lines (ebay_order_id) where deleted_at is null;

drop trigger if exists set_ebay_connections_updated_at on public.ebay_connections;
create trigger set_ebay_connections_updated_at before update on public.ebay_connections for each row execute function public.set_updated_at();
drop trigger if exists set_ebay_sync_runs_updated_at on public.ebay_sync_runs;
create trigger set_ebay_sync_runs_updated_at before update on public.ebay_sync_runs for each row execute function public.set_updated_at();
drop trigger if exists set_ebay_inventory_items_updated_at on public.ebay_inventory_items;
create trigger set_ebay_inventory_items_updated_at before update on public.ebay_inventory_items for each row execute function public.set_updated_at();
drop trigger if exists set_ebay_offers_updated_at on public.ebay_offers;
create trigger set_ebay_offers_updated_at before update on public.ebay_offers for each row execute function public.set_updated_at();
drop trigger if exists set_ebay_orders_updated_at on public.ebay_orders;
create trigger set_ebay_orders_updated_at before update on public.ebay_orders for each row execute function public.set_updated_at();
drop trigger if exists set_ebay_order_lines_updated_at on public.ebay_order_lines;
create trigger set_ebay_order_lines_updated_at before update on public.ebay_order_lines for each row execute function public.set_updated_at();

