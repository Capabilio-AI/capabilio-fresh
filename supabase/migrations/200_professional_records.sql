-- Professional records: certifications, education, projects and links as real rows a professional can edit, instead of text kept inside the
-- stored resume. When a resume is uploaded, the server replaces the rows with source = 'resume' and leaves the ones the person added.
-- Server-only like the other pro_* tables: RLS on, no grants to anon or authenticated.

create table if not exists public.pro_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  issuer text check (issuer is null or char_length(issuer) <= 120),
  year smallint check (year is null or year between 1950 and 2100),
  source text not null default 'added' check (source in ('resume', 'added')),
  created_at timestamptz not null default now()
);
create index if not exists pro_certifications_user_idx on public.pro_certifications (user_id, year desc nulls last);

create table if not exists public.pro_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution text not null check (char_length(btrim(institution)) between 1 and 200),
  degree text check (degree is null or char_length(degree) <= 200),
  field_of_study text check (field_of_study is null or char_length(field_of_study) <= 200),
  start_year smallint check (start_year is null or start_year between 1950 and 2100),
  end_year smallint check (end_year is null or end_year between 1950 and 2100),
  source text not null default 'added' check (source in ('resume', 'added')),
  created_at timestamptz not null default now()
);
create index if not exists pro_education_user_idx on public.pro_education (user_id, end_year desc nulls last);

create table if not exists public.pro_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  description text check (description is null or char_length(description) <= 600),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https?://')),
  skills text[] not null default '{}' check (cardinality(skills) <= 12),
  source text not null default 'added' check (source in ('resume', 'added')),
  created_at timestamptz not null default now()
);
create index if not exists pro_projects_user_idx on public.pro_projects (user_id, created_at desc);

create table if not exists public.pro_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  url text not null check (char_length(url) <= 500 and url ~* '^https?://'),
  source text not null default 'added' check (source in ('resume', 'added')),
  created_at timestamptz not null default now()
);
create index if not exists pro_links_user_idx on public.pro_links (user_id, created_at);

alter table public.pro_certifications enable row level security;
alter table public.pro_education enable row level security;
alter table public.pro_projects enable row level security;
alter table public.pro_links enable row level security;
revoke all on public.pro_certifications, public.pro_education, public.pro_projects, public.pro_links from anon, authenticated;

-- Fill them from resumes that were already read.
insert into public.pro_certifications (user_id, name, issuer, year, source)
select r.user_id, left(btrim(c ->> 'name'), 160), nullif(left(btrim(c ->> 'issuer'), 120), ''),
       case when (c ->> 'year') ~ '^[0-9]{4}$' and (c ->> 'year')::int between 1950 and 2100 then (c ->> 'year')::smallint end, 'resume'
from public.pro_resumes r cross join lateral jsonb_array_elements(coalesce(r.extraction -> 'certifications', '[]'::jsonb)) c
where btrim(coalesce(c ->> 'name', '')) <> '';

insert into public.pro_education (user_id, institution, degree, field_of_study, start_year, end_year, source)
select r.user_id, left(btrim(e ->> 'institution'), 200), nullif(left(btrim(e ->> 'degree'), 200), ''), nullif(left(btrim(e ->> 'fieldOfStudy'), 200), ''),
       case when (e ->> 'startYear') ~ '^[0-9]{4}$' and (e ->> 'startYear')::int between 1950 and 2100 then (e ->> 'startYear')::smallint end,
       case when (e ->> 'endYear') ~ '^[0-9]{4}$' and (e ->> 'endYear')::int between 1950 and 2100 then (e ->> 'endYear')::smallint end, 'resume'
from public.pro_resumes r cross join lateral jsonb_array_elements(coalesce(r.extraction -> 'education', '[]'::jsonb)) e
where btrim(coalesce(e ->> 'institution', '')) <> '';

insert into public.pro_projects (user_id, name, description, url, skills, source)
select r.user_id, left(btrim(p ->> 'name'), 160), nullif(left(btrim(p ->> 'description'), 600), ''),
       case when (p ->> 'url') ~* '^https?://' then left(p ->> 'url', 500) end,
       coalesce(array(select left(btrim(s), 60) from jsonb_array_elements_text(coalesce(p -> 'skills', '[]'::jsonb)) s where btrim(s) <> '' limit 12), '{}'), 'resume'
from public.pro_resumes r cross join lateral jsonb_array_elements(coalesce(r.extraction -> 'projects', '[]'::jsonb)) p
where btrim(coalesce(p ->> 'name', '')) <> '';

insert into public.pro_links (user_id, label, url, source)
select r.user_id, left(btrim(l ->> 'label'), 60),
       left(case when (l ->> 'url') ~* '^https?://' then btrim(l ->> 'url') else 'https://' || btrim(l ->> 'url') end, 500), 'resume'
from public.pro_resumes r cross join lateral jsonb_array_elements(coalesce(r.extraction -> 'personal' -> 'links', '[]'::jsonb)) l
where btrim(coalesce(l ->> 'label', '')) <> '' and btrim(coalesce(l ->> 'url', '')) <> '';
