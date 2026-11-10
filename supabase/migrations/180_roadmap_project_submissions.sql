-- A student's own submission for a roadmap project: the proof they attach (link, photos, PDF, a written account), the ticked checklist, and
-- the "explain your work" check that decides whether it counts as evidence. One row per student per project; the server writes it, the
-- student can only read their own.
create table public.roadmap_project_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.project_catalog(id) on delete cascade,
  career_id uuid references public.careers(id) on delete set null,
  checklist text[] not null default '{}',
  note text check (note is null or char_length(note) <= 3000),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  files jsonb not null default '[]'::jsonb,
  -- a linked GitHub repository, read at submit time: which repo, whose account it sits under, and the text the questions and the score were based on
  repo_full_name text,
  repo_owner text check (repo_owner is null or repo_owner in ('verified-owner', 'other-owner', 'unverified-account')),
  repo_context text,
  status text not null default 'draft' check (status in ('draft', 'awaiting_answers', 'scoring', 'verified', 'not_verified')),
  questions jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  session_started_at timestamptz,
  score integer check (score is null or score between 0 and 100),
  review jsonb,
  proof_id uuid references public.proof_of_work(id) on delete set null,
  skills_updated text[] not null default '{}',
  verified_at timestamptz,
  -- set once every skill update for a verified project has been written; a verified row without it is finished on the next read
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, project_id)
);
create index roadmap_project_submissions_student on public.roadmap_project_submissions (student_id, updated_at desc);
create trigger set_updated_at before update on public.roadmap_project_submissions for each row execute function public.set_updated_at();

alter table public.roadmap_project_submissions enable row level security;
create policy "own project submissions" on public.roadmap_project_submissions for select using (student_id = auth.uid());

-- Evidence from a checked project is its own kind, so the portfolio can say how it was verified.
-- (evidence.evidence_type is free text; nothing to alter.)
