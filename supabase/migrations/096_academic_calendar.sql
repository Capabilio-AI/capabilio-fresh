-- Semester start and end dates, kept by each college (staff with the "College page" permission). Students never set their own semester:
-- their current semester is derived from the latest start date that has passed for their branch and year of study.
-- branch_key '*' = all branches; year_of_study 0 = all years. A more specific row wins over a wildcard.
create table public.academic_calendar (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  branch text not null,
  branch_key text not null,
  year_of_study smallint not null check (year_of_study between 0 and 6),
  semester smallint not null check (semester in (1, 2)),
  starts_on date not null,
  ends_on date not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (ends_on > starts_on),
  unique (institution_id, branch_key, year_of_study, semester)
);
-- Read and written only through the server (service role); no client policies.
alter table public.academic_calendar enable row level security;
