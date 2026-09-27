-- STATUS: APPLIED to production 2026-09-27.
-- increment_rate_limit takes an arbitrary p_user_id, so it must never be
-- callable by a regular authenticated client (they could grief another
-- user's bucket via /rest/v1/rpc/increment_rate_limit) — only the
-- server-side service-role client may call it (lib/rate-limit/check.ts),
-- same trust boundary as lib/supabase/service.ts's other privileged writes.
-- Caught by the security advisor immediately after 009; confirmed fixed by
-- re-running it afterward.

revoke execute on function public.increment_rate_limit(uuid, text, timestamptz) from public, authenticated, anon;
