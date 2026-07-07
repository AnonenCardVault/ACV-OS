-- Extraction attempt metadata for Photo Intake AI runs.
-- Stores provider/status/warnings only. Never store API keys or secrets.

create table if not exists public.extraction_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  intake_group_id uuid references public.intake_groups(id),
  batch_id text,
  group_id text,
  provider text not null,
  model text,
  status text not null,
  confidence numeric(5,2),
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists extraction_attempts_user_idx on public.extraction_attempts (user_id, created_at desc) where deleted_at is null;
create index if not exists extraction_attempts_group_idx on public.extraction_attempts (batch_id, group_id, created_at desc) where deleted_at is null;
create index if not exists extraction_attempts_intake_group_idx on public.extraction_attempts (intake_group_id, created_at desc) where deleted_at is null;

drop trigger if exists set_extraction_attempts_updated_at on public.extraction_attempts;
create trigger set_extraction_attempts_updated_at before update on public.extraction_attempts for each row execute function public.set_updated_at();

grant select, insert, update on public.extraction_attempts to anon, authenticated;
