-- Curriculum Roadmap Engine (Job track, structured input). See docs/curriculum-roadmap-audit.md (Phase 2).
--
-- Authority: every table here is private to the service role. RLS is enabled with NO policies and all
-- privileges are revoked from anon/authenticated, so no browser client can read or write them; the
-- server reads/writes only after authorising the caller (docs/job-track-audit.md, Part A1).

create table public.curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  branch text not null check (char_length(btrim(branch)) between 1 and 200),
  year smallint not null check (year between 1 and 6),
  semester smallint check (semester is null or semester between 1 and 2),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  code text check (code is null or char_length(code) <= 40),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index curriculum_subjects_unique
  on public.curriculum_subjects (institution_id, lower(btrim(branch)), year, lower(btrim(name)));
create index curriculum_subjects_lookup on public.curriculum_subjects (institution_id, lower(btrim(branch)), year);

create table public.curriculum_subject_skill_map (
  subject_id uuid not null references public.curriculum_subjects(id) on delete cascade,
  role_key text not null,
  area_key text not null,
  source text not null check (source in ('admin', 'ai_suggestion_confirmed')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  primary key (subject_id, role_key, area_key),
  foreign key (role_key, area_key) references public.arena_skill_areas(role_key, area_key)
);

create table public.role_target_profiles (
  role_key text not null,
  area_key text not null,
  min_verified_count integer not null check (min_verified_count >= 1),
  primary key (role_key, area_key),
  foreign key (role_key, area_key) references public.arena_skill_areas(role_key, area_key)
);

create table public.skill_area_resources (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  area_key text not null,
  kind text not null check (kind in ('project', 'certification', 'practice')),
  title text not null check (char_length(title) between 1 and 200),
  url text check (url is null or url ~ '^https://'),
  description text check (description is null or char_length(description) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (role_key, area_key) references public.arena_skill_areas(role_key, area_key)
);

alter table public.curriculum_subjects enable row level security;
alter table public.curriculum_subject_skill_map enable row level security;
alter table public.role_target_profiles enable row level security;
alter table public.skill_area_resources enable row level security;

revoke all on public.curriculum_subjects, public.curriculum_subject_skill_map,
  public.role_target_profiles, public.skill_area_resources from anon, authenticated;

-- Product defaults (not student data). "Ready" in an area = at least this many verified Arena attempts.
-- Python is not listed: its executor is disabled, so it cannot be assessed and cannot be a gap.
-- PRODUCT-TEAM REVIEW: the value 3 is a starting default.
insert into public.role_target_profiles (role_key, area_key, min_verified_count) values
  ('data-analyst', 'sql', 3),
  ('data-analyst', 'spreadsheet', 3),
  ('data-analyst', 'dashboard', 3),
  ('data-analyst', 'statistics', 3),
  ('data-analyst', 'data_cleaning', 3);

-- Curated list: two widely-known public certifications. PRODUCT-TEAM REVIEW: verify links before launch.
insert into public.skill_area_resources (role_key, area_key, kind, title, url, description) values
  ('data-analyst', 'dashboard', 'certification', 'Microsoft Certified: Power BI Data Analyst Associate (PL-300)', 'https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/', 'Microsoft''s certification for building and sharing Power BI reports and dashboards.'),
  ('data-analyst', 'spreadsheet', 'certification', 'Google Data Analytics Professional Certificate', 'https://grow.google/certificates/data-analytics/', 'A beginner-level program that covers spreadsheets, SQL and data visualisation.');
