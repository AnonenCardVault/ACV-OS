# ACV OS Supabase Backend

Phase 2 uses version-controlled SQL migrations as the source of truth for database, index, trigger, and storage bucket setup.

Run migrations against each Supabase project before enabling production persistence:

- `supabase/migrations/202607070001_acv_os_phase2_schema.sql`
- `supabase/migrations/202607100001_pricing_engine_v1.sql`

The migration creates:

- Universal Card Profile centered tables
- Soft-delete columns on every ACV table
- Updated-at triggers
- Useful workflow indexes
- Storage buckets: `temp-intake`, `inventory-images`, `listing-images`
- Permissive no-auth storage policies for the current pre-auth phase
- Pricing Engine v1 evidence/history attached to Universal Card Profiles

ACV currently uses only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No service role key is required or used in the frontend.
