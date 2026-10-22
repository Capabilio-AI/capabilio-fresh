-- Proof Sessions: a longer, connected piece of role work (several stages, each served by an existing skill area and graded by its own tool),
-- with an append-only log of what happened and a report built from it. Server-mediated like the other Arena tables: RLS on and NO client
-- policies, so rows are written and read only by trusted server code after an auth check, scoped to the signed-in user.
-- Additive: nothing existing is altered. Pass/fail and ratings stay in arena_domain_assignments / complete_workstation_attempt.

create table public.arena_proof_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_key text not null,
  spec_key text not null check (char_length(spec_key) between 1 and 80),
  spec_version integer not null check (spec_version >= 1),
  status text not null default 'open' check (status in ('open', 'finished', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((status = 'open') = (finished_at is null))
);
-- one open session per student and role at a time
create unique index arena_proof_sessions_one_open_idx on public.arena_proof_sessions (user_id, role_key) where status = 'open';
create index arena_proof_sessions_user_idx on public.arena_proof_sessions (user_id, started_at desc);

create table public.arena_proof_session_stages (
  session_id uuid not null references public.arena_proof_sessions(id) on delete cascade,
  stage_key text not null check (char_length(stage_key) between 1 and 60),
  stage_index integer not null check (stage_index >= 0),
  area_key text not null,
  -- the ordinary workstation attempt that serves this stage; kept if the attempt row is ever removed
  assignment_id uuid references public.arena_domain_assignments(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'passed', 'failed')),
  checks_passed integer check (checks_passed >= 0),
  checks_total integer check (checks_total >= 0),
  primary key (session_id, stage_key),
  unique (session_id, stage_index),
  check (checks_passed is null or checks_total is null or checks_passed <= checks_total)
);

create table public.arena_session_events (
  session_id uuid not null references public.arena_proof_sessions(id) on delete cascade,
  seq integer not null check (seq >= 1),
  at timestamptz not null default now(),
  stage_key text not null,
  kind text not null check (kind in ('stage_started', 'brief_viewed', 'data_inspected', 'plan_note', 'query_run', 'check_run', 'ai_prompt', 'ai_reply', 'submitted')),
  -- who reported it: our own routes ("server") or the browser ("client", lower trust)
  source text not null check (source in ('server', 'client')),
  payload jsonb not null default '{}'::jsonb check (pg_column_size(payload) <= 2000),
  primary key (session_id, seq)
);

-- the log only ever grows: an event is never edited
create function public.arena_session_events_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'arena_session_events is append-only';
end $$;
create trigger arena_session_events_no_update before update on public.arena_session_events for each row execute function public.arena_session_events_immutable();

-- a report is written once per session and rubric version, never edited
create table public.arena_session_reports (
  session_id uuid not null references public.arena_proof_sessions(id) on delete cascade,
  rubric_version text not null check (char_length(rubric_version) between 1 and 40),
  report jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, rubric_version)
);
create trigger arena_session_reports_no_update before update on public.arena_session_reports for each row execute function public.arena_session_events_immutable();

alter table public.arena_proof_sessions enable row level security;
alter table public.arena_proof_session_stages enable row level security;
alter table public.arena_session_events enable row level security;
alter table public.arena_session_reports enable row level security;
revoke all on public.arena_proof_sessions, public.arena_proof_session_stages, public.arena_session_events, public.arena_session_reports from anon, authenticated;
grant select, insert, update on public.arena_proof_sessions, public.arena_proof_session_stages to service_role;
grant select, insert on public.arena_session_events, public.arena_session_reports to service_role;
