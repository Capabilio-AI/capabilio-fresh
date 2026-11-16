-- Professional path: its own tables, so a working professional's data is not mixed into the student or graduate tables.
--  - pro_profiles: headline, about, location and the current job.
--  - pro_employment: every job, with how it was checked (self_claimed until EPFO verifies it).
--  - pro_resumes: what the server read from the resume (the file itself is not kept).
--  - pro_verification: the EPFO window. A new professional has 7 days from sign-up; status moves to 'verified' when EPFO confirms,
--    and to 'deactivated' only by the server once EPFO verification exists. Nothing deactivates anyone before then.
-- All four are server-only: RLS on, no grants to anon or authenticated. The identity (profiles, auth.users) stays shared on purpose.
-- Accounts already on the professional path are copied across; the old rows are left in place.

create table if not exists public.pro_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text check (headline is null or char_length(headline) <= 160),
  about text check (about is null or char_length(about) <= 1200),
  location text check (location is null or char_length(location) <= 120),
  employer_name text check (employer_name is null or char_length(employer_name) <= 120),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_employment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  employer_name text not null check (char_length(btrim(employer_name)) between 1 and 120),
  job_title text not null check (char_length(btrim(job_title)) between 1 and 120),
  start_date date,
  end_date date,
  period_text text check (period_text is null or char_length(period_text) <= 60),
  description text check (description is null or char_length(description) <= 600),
  source text not null default 'entered' check (source in ('entered', 'resume')),
  verification text not null default 'self_claimed' check (verification in ('self_claimed', 'epfo')),
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists pro_employment_user_idx on public.pro_employment (user_id, start_date desc nulls last);

create table if not exists public.pro_resumes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  file_name text check (file_name is null or char_length(file_name) <= 255),
  extraction jsonb not null,
  skill_names text[] not null default '{}',
  model text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_verification (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed', 'deactivated')),
  window_ends_at timestamptz not null,
  verified_at timestamptz,
  provider text,
  updated_at timestamptz not null default now()
);

alter table public.pro_profiles enable row level security;
alter table public.pro_employment enable row level security;
alter table public.pro_resumes enable row level security;
alter table public.pro_verification enable row level security;
revoke all on public.pro_profiles, public.pro_employment, public.pro_resumes, public.pro_verification from anon, authenticated;

-- Accounts already on the professional path.
insert into public.pro_profiles (user_id, employer_name, job_title)
select p.id, left(p.employer_name, 120), left(p.job_title, 120) from public.profiles p where p.student_status = 'professional'
on conflict (user_id) do nothing;

insert into public.pro_employment (user_id, employer_name, job_title, start_date, end_date, source)
select e.user_id, e.employer_name, e.job_title, e.start_date, e.end_date, 'entered'
from public.employment_history e join public.profiles p on p.id = e.user_id
where p.student_status = 'professional'
  and not exists (select 1 from public.pro_employment x where x.user_id = e.user_id and x.employer_name = e.employer_name and x.job_title = e.job_title);

insert into public.pro_resumes (user_id, file_name, extraction, skill_names, model, applied_at, created_at, updated_at)
select r.user_id, r.file_name, r.extraction, r.skill_names, r.model, r.applied_at, r.created_at, r.updated_at
from public.graduate_resumes r join public.profiles p on p.id = r.user_id
where p.student_status = 'professional'
on conflict (user_id) do nothing;

insert into public.pro_verification (user_id, window_ends_at)
select p.id, p.created_at + interval '7 days' from public.profiles p where p.student_status = 'professional'
on conflict (user_id) do nothing;
