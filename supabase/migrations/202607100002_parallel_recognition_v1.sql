-- Parallel Recognition Engine v1.
-- Stores evidence and user-confirmed corrections without treating manual edits as numeric confidence.

create table if not exists public.parallel_recognition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid references public.universal_card_profiles(id),
  intake_group_id uuid references public.intake_groups(id),
  sku text,
  original_prediction text,
  normalized_prediction text,
  confirmed_parallel text,
  recognition_status text,
  parallel_confidence numeric(5,4),
  provider_outputs jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  product_context jsonb not null default '{}'::jsonb,
  image_refs jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists parallel_recognition_profile_idx on public.parallel_recognition_events (universal_card_profile_id, created_at desc) where deleted_at is null;
create index if not exists parallel_recognition_sku_idx on public.parallel_recognition_events (user_id, sku, created_at desc) where deleted_at is null;
create index if not exists parallel_recognition_confirmed_idx on public.parallel_recognition_events (user_id, confirmed_parallel, created_at desc) where deleted_at is null;

drop trigger if exists set_parallel_recognition_events_updated_at on public.parallel_recognition_events;
create trigger set_parallel_recognition_events_updated_at before update on public.parallel_recognition_events for each row execute function public.set_updated_at();

grant select, insert, update on public.parallel_recognition_events to anon, authenticated;
