-- STATUS: APPLIED to production 2026-09-27.
-- Atomic upsert-increment so concurrent requests in the same window can't
-- race past the limit (a read-then-write from the client could). Locked
-- down from client execution in 010 — see that file for why.

create or replace function public.increment_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_window_start timestamptz
)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limit_hits (user_id, bucket, window_start, hit_count)
  values (p_user_id, p_bucket, p_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set hit_count = public.rate_limit_hits.hit_count + 1
  returning hit_count into v_count;

  return v_count;
end;
$$;
