-- Changes of a student's main career role, made from the dashboard. Each row is one change with the reason the student gave.
-- A student may make at most 3; the trigger enforces it under a per-student lock so two requests at once cannot both pass.
-- Choosing the first role and Plan B are not changes and are not recorded here. Server only (service role).
create table public.career_role_changes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  from_career_id uuid references public.careers(id) on delete set null,
  to_career_id uuid references public.careers(id) on delete set null,
  reason text not null check (reason in ('wrong_role_at_signup', 'better_fit', 'lost_interest', 'goal_changed', 'other')),
  details text check (details is null or char_length(details) <= 400),
  created_at timestamptz not null default now()
);
create index career_role_changes_by_student on public.career_role_changes (student_id, created_at);

create function public.guard_role_change_limit() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text, 0));
  if (select count(*) from public.career_role_changes where student_id = new.student_id) >= 3 then
    raise exception 'role_change_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_role_change_limit before insert on public.career_role_changes for each row execute function public.guard_role_change_limit();

alter table public.career_role_changes enable row level security;
revoke all on public.career_role_changes from anon, authenticated;
