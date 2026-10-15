-- Career stage and plans.
--  - profiles.student_status is the career stage: 'student' -> 'graduate' -> 'professional'. It only moves forward, and only the server
--    changes it (it is not in the client column grant from migration 031), so the app path follows the profile.
--  - plan_id: the plan a recently graduated user chose after login. null = not chosen yet (the app asks before showing anything else).
--  - employer_name / job_title / employed_since: set when a graduate reports a job (or accepts a placement offer).
alter table public.profiles drop constraint if exists profiles_student_status_check;
alter table public.profiles
  add constraint profiles_student_status_check check (student_status in ('student', 'graduate', 'professional'));

alter table public.profiles
  add column if not exists plan_id text check (plan_id is null or plan_id in ('launch', 'accelerate_monthly', 'accelerate_quarterly')),
  add column if not exists plan_selected_at timestamptz,
  add column if not exists stage_changed_at timestamptz,
  add column if not exists employer_name text check (employer_name is null or char_length(employer_name) <= 120),
  add column if not exists job_title text check (job_title is null or char_length(job_title) <= 120),
  add column if not exists employed_since date;

-- Employment history (Vault tab). A row with no end date is a current job: recording one moves a recently graduated profile to the
-- professional path. Writes go through the server; owners can read (and the server deletes) their own rows.
create table if not exists public.employment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  employer_name text not null check (char_length(btrim(employer_name)) between 1 and 120),
  job_title text not null check (char_length(btrim(job_title)) between 1 and 120),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists employment_history_user_idx on public.employment_history (user_id, start_date desc nulls last);
alter table public.employment_history enable row level security;
drop policy if exists employment_history_owner_read on public.employment_history;
create policy employment_history_owner_read on public.employment_history for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.employment_history from anon, authenticated;
