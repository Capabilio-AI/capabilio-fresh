-- Visual roadmap: baseline diagnostic sessions and answers. Written only by the server (answer keys never reach the browser);
-- a student may read their own sessions. One open session per student and career, so a check is resumable.
create table public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  career_id uuid not null references public.careers(id),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
  -- ordered skill ids the check will cover; fixed at start so a resumed session is the same session
  plan jsonb not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index diagnostic_one_open on public.diagnostic_sessions (student_id, career_id) where status = 'IN_PROGRESS';
create index diagnostic_sessions_student on public.diagnostic_sessions (student_id, career_id, started_at desc);

create table public.diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.diagnostic_sessions(id) on delete cascade,
  item_id uuid not null references public.diagnostic_items(id),
  skill_id uuid not null references public.skills(id),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  response jsonb not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (session_id, item_id)
);
create index diagnostic_answers_session on public.diagnostic_answers (session_id);

alter table public.diagnostic_sessions enable row level security;
alter table public.diagnostic_answers enable row level security;
revoke all on public.diagnostic_sessions, public.diagnostic_answers from anon, authenticated;
grant select on public.diagnostic_sessions to authenticated;
create policy diagnostic_sessions_own on public.diagnostic_sessions for select to authenticated using (student_id = auth.uid());
