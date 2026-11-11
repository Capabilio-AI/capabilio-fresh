-- Company-wise CRT: a company's hiring process and the rounds of its tests, and a student's mock-test results against a round.
-- A company's pattern (sections, question counts, time, negative marking) changes every year and is not ours to guess, so a company is shown to
-- students only when it is PUBLISHED, and publishing requires the source the pattern came from and the date someone checked it.
-- Questions are never copied from a company's papers: a mock is assembled from Capabilio's own question bank in the company's pattern.
create table public.crt_companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null unique check (char_length(btrim(name)) between 2 and 80),
  sector text not null default 'Technology' check (sector in ('Technology', 'Management', 'Core engineering', 'Finance', 'Other')),
  about text check (about is null or char_length(about) <= 1200),
  -- the hiring process in order, one short line per step
  process text[] not null default '{}',
  official_url text check (official_url is null or official_url ~* '^https://'),
  pattern_source_url text check (pattern_source_url is null or pattern_source_url ~* '^https://'),
  pattern_checked_on date,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crt_companies_published_has_source check (status = 'DRAFT' or (pattern_source_url is not null and pattern_checked_on is not null))
);
create trigger set_updated_at before update on public.crt_companies for each row execute function public.set_updated_at();

create table public.crt_company_rounds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crt_companies(id) on delete cascade,
  position smallint not null check (position between 1 and 12),
  kind text not null check (kind in ('online_assessment', 'coding', 'technical_interview', 'hr_interview', 'group_discussion')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  minutes smallint check (minutes is null or minutes between 5 and 360),
  -- share of a mark lost for a wrong answer (0 = none, 0.25 = a quarter mark)
  negative_marking numeric(3, 2) not null default 0 check (negative_marking between 0 and 1),
  -- online_assessment only: [{ "category": "aptitude", "count": 20 }, ...]
  sections jsonb not null default '[]'::jsonb,
  notes text check (notes is null or char_length(notes) <= 800),
  unique (company_id, position)
);
create index crt_company_rounds_company on public.crt_company_rounds (company_id, position);

-- one row per graded company mock, so the hub can show Todo / Completed and the best score
create table public.crt_company_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_id uuid not null references public.crt_company_rounds(id) on delete cascade,
  pct smallint not null check (pct between 0 and 100),
  created_at timestamptz not null default now()
);
create index crt_company_attempts_user on public.crt_company_attempts (user_id, round_id, created_at desc);

alter table public.crt_companies enable row level security;
alter table public.crt_company_rounds enable row level security;
alter table public.crt_company_attempts enable row level security;
-- students read published companies and their rounds; everything is written by the server
create policy "published companies" on public.crt_companies for select to authenticated using (status = 'PUBLISHED');
create policy "rounds of published companies" on public.crt_company_rounds for select to authenticated using (exists (select 1 from public.crt_companies c where c.id = company_id and c.status = 'PUBLISHED'));
create policy "own company attempts" on public.crt_company_attempts for select to authenticated using (user_id = auth.uid());
