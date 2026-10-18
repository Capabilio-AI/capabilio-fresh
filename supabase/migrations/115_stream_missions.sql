-- Stream missions: interactive engineering labs written for the student (ECE, EEE, Mechanical, Civil).
-- A mission is an arena_challenges row of kind 'mission' whose public scenario lives in `problem`; the lab and its rules live in code, and the server
-- re-runs every test the student makes. This table holds the student's progress on it: runs, hints, and the points awarded once.
-- Stream points only: no ELO, no skill-passport evidence.
alter table public.arena_challenges drop constraint if exists arena_challenges_kind_check;
alter table public.arena_challenges add constraint arena_challenges_kind_check check (kind in ('code', 'numeric', 'sql', 'workstation', 'leetcode', 'mcq', 'mission'));

create table public.arena_mission_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  runs integer not null default 0 check (runs >= 0),
  hints integer not null default 0 check (hints between 0 and 3),
  /** fingerprints of the distinct settings the student has tested (capped by the server) */
  tried text[] not null default '{}',
  hint_log jsonb not null default '[]' check (jsonb_typeof(hint_log) = 'array'),
  last_settings jsonb,
  passed boolean not null default false,
  points integer check (points is null or points >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, challenge_id)
);
alter table public.arena_mission_attempts enable row level security;
revoke all on public.arena_mission_attempts from anon, authenticated;
