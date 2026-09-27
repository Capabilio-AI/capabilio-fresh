-- STATUS: APPLIED to production 2026-09-27.
-- Practical, DB-backed rate limiting (works correctly across serverless
-- instances, unlike an in-memory counter — brief §17). One row per
-- (user, bucket, fixed window); the atomic upsert-increment (009) is the
-- whole mechanism.

create table public.rate_limit_hits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  hit_count integer not null default 1,
  primary key (user_id, bucket, window_start)
);

create index idx_rate_limit_hits_window on public.rate_limit_hits(window_start);

alter table public.rate_limit_hits enable row level security;
-- No client access at all — checked server-side only, via the service-role
-- client (lib/rate-limit/check.ts), same pattern as capability_history writes.
