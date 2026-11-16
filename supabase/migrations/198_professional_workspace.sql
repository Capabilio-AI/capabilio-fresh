-- Professional workspace: skills and the skill graph, the document vault, and the job application tracker with its feedback log.
--  - pro_skills / pro_skill_jobs: what a professional can do, and which of their jobs it was used in (the skill graph).
--  - pro_documents: files in the vault (resume, certificates, letters). The files live in the private 'pro-documents' bucket;
--    only the server reads or writes them and hands out short-lived links.
--  - pro_applications / pro_application_feedback: the tracker (saved to accepted) and what each interviewer said.
-- All server-only: RLS on, no grants to anon or authenticated.

create table if not exists public.pro_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  category text check (category is null or char_length(category) <= 40),
  level text not null default 'working' check (level in ('learning', 'working', 'expert')),
  source text not null default 'added' check (source in ('resume', 'added')),
  created_at timestamptz not null default now()
);
create unique index if not exists pro_skills_user_name_idx on public.pro_skills (user_id, lower(btrim(name)));

create table if not exists public.pro_skill_jobs (
  skill_id uuid not null references public.pro_skills(id) on delete cascade,
  employment_id uuid not null references public.pro_employment(id) on delete cascade,
  primary key (skill_id, employment_id)
);

create table if not exists public.pro_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('resume', 'certificate', 'letter', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  file_name text not null check (char_length(file_name) <= 255),
  storage_path text not null check (char_length(storage_path) <= 400),
  mime text not null check (char_length(mime) <= 100),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  share text not null default 'me' check (share in ('me', 'accepted')),
  created_at timestamptz not null default now()
);
create index if not exists pro_documents_user_idx on public.pro_documents (user_id, created_at desc);

insert into storage.buckets (id, name, public) values ('pro-documents', 'pro-documents', false) on conflict (id) do nothing;

create table if not exists public.pro_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  company text not null check (char_length(btrim(company)) between 1 and 120),
  role text not null check (char_length(btrim(role)) between 1 and 120),
  link text check (link is null or (char_length(link) <= 500 and link ~* '^https?://')),
  stage text not null default 'applied' check (stage in ('saved', 'applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn')),
  applied_on date,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pro_applications_user_idx on public.pro_applications (user_id, updated_at desc);

create table if not exists public.pro_application_feedback (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.pro_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  round text not null check (round in ('screen', 'technical', 'hr', 'final', 'offer', 'other')),
  outcome text not null check (outcome in ('positive', 'mixed', 'negative', 'pending')),
  went_well text check (went_well is null or char_length(went_well) <= 1000),
  to_improve text check (to_improve is null or char_length(to_improve) <= 1000),
  given_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists pro_application_feedback_app_idx on public.pro_application_feedback (application_id, given_on desc);

alter table public.pro_skills enable row level security;
alter table public.pro_skill_jobs enable row level security;
alter table public.pro_documents enable row level security;
alter table public.pro_applications enable row level security;
alter table public.pro_application_feedback enable row level security;
revoke all on public.pro_skills, public.pro_skill_jobs, public.pro_documents, public.pro_applications, public.pro_application_feedback from anon, authenticated;

-- Skills already read from a professional's resume.
insert into public.pro_skills (user_id, name, source)
select r.user_id, left(btrim(s), 60), 'resume'
from public.pro_resumes r cross join lateral unnest(r.skill_names) as s
where btrim(s) <> ''
on conflict do nothing;
