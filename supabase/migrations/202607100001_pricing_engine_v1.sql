-- Pricing Engine v1 evidence/history.
-- Manual estimates and future provider evidence attach to the Universal Card Profile.

create table if not exists public.pricing_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  universal_card_profile_id uuid not null references public.universal_card_profiles(id),
  pricing_id uuid references public.pricing(id),
  provider text not null,
  evidence_type text not null,
  label text not null,
  value numeric(12,2),
  query text,
  url text,
  notes text,
  confidence numeric(5,4),
  evidence_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists pricing_evidence_profile_idx on public.pricing_evidence (universal_card_profile_id, created_at desc) where deleted_at is null;
create index if not exists pricing_evidence_provider_idx on public.pricing_evidence (user_id, provider, created_at desc) where deleted_at is null;

drop trigger if exists set_pricing_evidence_updated_at on public.pricing_evidence;
create trigger set_pricing_evidence_updated_at before update on public.pricing_evidence for each row execute function public.set_updated_at();

grant select, insert, update on public.pricing_evidence to anon, authenticated;
