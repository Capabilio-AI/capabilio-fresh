-- Lets rate_limit_hits be keyed by a hashed-IP uuid for unauthenticated routes (waitlist, org signup).
-- The FK to auth.users would reject those keys. Until this is applied the IP checks fail open (and waitlist keeps its in-memory throttle).
alter table public.rate_limit_hits drop constraint if exists rate_limit_hits_user_id_fkey;
