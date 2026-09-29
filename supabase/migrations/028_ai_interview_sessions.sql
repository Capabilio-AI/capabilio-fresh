-- STATUS: pending. AI interview sessions — the "Practice/Technical/
-- Behavioral/HR" tabs in the Interview page were UI-only before this;
-- this is the first real persistence for them. v1 is text-only: the full
-- question set is generated once at session start (no live adaptive
-- follow-ups yet), answered client-side, then scored in one pass at
-- completion.
create type public.interview_mode as enum ('practice', 'technical', 'behavioral', 'hr');
create type public.interview_status as enum ('in_progress', 'completed', 'abandoned');

create table public.ai_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode public.interview_mode not null,
  status public.interview_status not null default 'in_progress',
  role_target text,
  domain text,
  questions jsonb not null,
  transcript jsonb not null default '[]'::jsonb,
  overall_score integer,
  skill_scores jsonb,
  strengths jsonb,
  improvements jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index ai_interview_sessions_user_idx on public.ai_interview_sessions (user_id, started_at desc);

alter table public.ai_interview_sessions enable row level security;
-- Read-only to the student, like capabilities/arena_skill_ratings — all
-- writes go through the service-role client from the interview API routes,
-- which enforce ownership themselves.
create policy ai_interview_sessions_self_read on public.ai_interview_sessions for select using (user_id = auth.uid());
