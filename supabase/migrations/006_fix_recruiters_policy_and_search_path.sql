-- STATUS: APPLIED to production 2026-09-27.
-- Fixes two gaps the security advisor caught immediately after 002/004:
-- `recruiters` had RLS enabled with zero policies (deny-all — not even the
-- owner could read their own row), and set_updated_at() was missing the
-- search_path pin every other function in this database has.

create policy recruiters_self on public.recruiters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
