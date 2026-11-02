-- Careers: roles Capabilio is hiring for, and the applications people send. A role is posted from /admin/careers, so adding a job never needs a deploy.
-- Both tables are written and read only by the server (service role) after it has checked the caller, so RLS is on with no policy.
create table if not exists public.job_openings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 80),
  title text not null check (length(title) between 3 and 120),
  team text not null check (length(team) between 2 and 60),
  location text not null check (length(location) between 2 and 80),
  work_mode text not null check (work_mode in ('onsite', 'hybrid', 'remote')),
  employment_type text not null check (employment_type in ('full_time', 'part_time', 'internship', 'contract')),
  summary text not null check (length(summary) between 10 and 280),
  about text not null check (length(about) between 20 and 4000),
  responsibilities text[] not null default '{}' check (cardinality(responsibilities) <= 12),
  requirements text[] not null default '{}' check (cardinality(requirements) <= 12),
  nice_to_have text[] not null default '{}' check (cardinality(nice_to_have) <= 12),
  -- the small real task a candidate does after the first read; shown on the role page so nobody is surprised by it
  proof_brief text check (proof_brief is null or length(proof_brief) <= 1500),
  compensation text check (compensation is null or length(compensation) <= 80),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  published_at timestamptz,
  closes_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists job_openings_status_idx on public.job_openings (status, published_at desc);
alter table public.job_openings enable row level security;

-- opening_id is null for an open introduction ("don't see your role"). Deleting an opening keeps the application.
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid references public.job_openings(id) on delete set null,
  full_name text not null check (length(full_name) between 2 and 120),
  email text not null check (length(email) between 5 and 254),
  work_url text not null check (length(work_url) <= 500),
  proof_note text not null check (length(proof_note) between 40 and 2000),
  resume_url text check (resume_url is null or length(resume_url) <= 500),
  profile_url text check (profile_url is null or length(profile_url) <= 500),
  status text not null default 'new' check (status in ('new', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  internal_note text check (internal_note is null or length(internal_note) <= 2000),
  created_at timestamptz not null default now()
);
-- one application per person per role (and one open introduction per person); a repeat gets the same success answer
create unique index if not exists job_applications_one_per_role
  on public.job_applications (coalesce(opening_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email));
create index if not exists job_applications_opening_idx on public.job_applications (opening_id, created_at desc);
alter table public.job_applications enable row level security;
