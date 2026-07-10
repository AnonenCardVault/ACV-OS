-- Inventory approval idempotency.
-- Each intake group may create at most one active inventory row.

alter table public.inventory
  add column if not exists intake_group_id uuid references public.intake_groups(id);

with candidates as (
  select
    i.id as inventory_id,
    g.id as intake_group_id,
    row_number() over (
      partition by g.id
      order by i.created_at asc, i.id asc
    ) as rn
  from public.inventory i
  join public.intake_groups g
    on g.approved_card_profile_id = i.universal_card_profile_id
  where i.intake_group_id is null
    and i.deleted_at is null
    and g.deleted_at is null
    and g.approved_card_profile_id is not null
)
update public.inventory i
set intake_group_id = candidates.intake_group_id
from candidates
where i.id = candidates.inventory_id
  and candidates.rn = 1;

create unique index if not exists inventory_intake_group_unique_active_idx
  on public.inventory (user_id, intake_group_id)
  where intake_group_id is not null
    and deleted_at is null;

create index if not exists inventory_intake_group_lookup_idx
  on public.inventory (intake_group_id)
  where intake_group_id is not null
    and deleted_at is null;
