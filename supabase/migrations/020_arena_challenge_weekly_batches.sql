-- Restructures Arena Challenges from independent per-slot rotation
-- (019_arena_stream_domain_challenges.sql) to a single weekly batch per
-- track: one spin picks a task count (5-10), one scratch reveals that many
-- challenges together. No real user data existed in arena_challenge_slots
-- yet (this feature hasn't shipped), so it's dropped and replaced cleanly
-- rather than migrated in place. arena_challenges (the catalog) and
-- arena_challenge_completions are kept, not duplicated.

drop table if exists public.arena_challenge_slots cascade;

-- CASCADE drops the FK constraint that referenced arena_challenge_slots,
-- not the now-meaningless slot_id column itself -- drop it explicitly.
alter table public.arena_challenge_completions drop column if exists slot_id;

create table public.arena_challenge_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('stream', 'domain')),
  week_start date not null,
  task_count integer not null check (task_count between 5 and 10),
  status text not null default 'spun' check (status in ('spun', 'revealed')),
  challenge_ids uuid[] not null default '{}',
  spun_at timestamptz not null default now(),
  revealed_at timestamptz,
  unique (user_id, track, week_start)
);

create index idx_arena_challenge_weeks_user on public.arena_challenge_weeks(user_id, track, week_start desc);

alter table public.arena_challenge_completions
  add column if not exists week_id uuid references public.arena_challenge_weeks(id) on delete cascade;

-- Running points/streak per student -- separate from arena_ratings (ELO,
-- quiz-specific) since this is a different, simpler scoring mechanism (see
-- docs/arena-challenges-redesign.md). Public-read, matching arena_ratings'
-- own leaderboard-visibility model: points/streak aren't private.
create table public.arena_challenge_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0,
  tasks_completed integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed_week date,
  updated_at timestamptz not null default now()
);

alter table public.arena_challenge_weeks enable row level security;
alter table public.arena_challenge_stats enable row level security;

create policy arena_challenge_weeks_self_read
  on public.arena_challenge_weeks for select
  using (user_id = auth.uid());

create policy arena_challenge_stats_read_all
  on public.arena_challenge_stats for select
  using (true);
