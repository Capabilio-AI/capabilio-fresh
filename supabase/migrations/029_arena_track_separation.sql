-- Stream and Domain challenges must be fully independent tracks (own
-- leaderboard, streak, history) -- today they silently share one row:
-- arena_challenge_stats.points/current_streak/longest_streak is written by
-- BOTH the Stream submit route (lib/arena-challenges/award.ts) and the
-- Domain RPC below, so a student's branch-curriculum streak and their
-- career-domain streak are the same counter. Split it in two.
--
-- Existing rows carry over to arena_stream_stats (Stream's fixed-point model
-- is the older, primary source of this table's data); arena_domain_stats
-- starts empty -- Domain is also switching from a dynamic K-factor ELO step
-- to a fixed per-difficulty delta below, a fresh scoring model anyway.

create table public.arena_stream_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0,
  tasks_completed integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed_week date,
  updated_at timestamptz not null default now()
);

create table public.arena_domain_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points integer not null default 0,
  tasks_completed integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_completed_week date,
  updated_at timestamptz not null default now()
);

insert into public.arena_stream_stats (user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at)
select user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at from public.arena_challenge_stats;

alter table public.arena_stream_stats enable row level security;
alter table public.arena_domain_stats enable row level security;

-- Public-read like the table they replace: a leaderboard needs everyone's numbers.
create policy arena_stream_stats_read_all on public.arena_stream_stats for select using (true);
create policy arena_domain_stats_read_all on public.arena_domain_stats for select using (true);

drop table public.arena_challenge_stats;

-- ── Stream weekly batch: exactly 8 fresh challenges per (user, Monday week) ─
create table public.arena_stream_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  scope_key text not null,
  challenge_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create index idx_arena_stream_weeks_user on public.arena_stream_weeks(user_id, week_start desc);
alter table public.arena_stream_weeks enable row level security;
create policy arena_stream_weeks_self_read on public.arena_stream_weeks for select using (user_id = auth.uid());

-- ── Domain: fixed ELO delta by difficulty (8/12/15), replacing the dynamic
-- K=32 expected-score formula, and point the stats upsert at the new,
-- Domain-only arena_domain_stats table instead of the now-dropped shared one.
-- p_points is kept only for call-site compatibility; ignored below in favor
-- of the server-computed v_delta so a client can never influence the reward.
create or replace function public.complete_workstation_attempt(
  p_attempt_id uuid, p_grade jsonb, p_submission jsonb, p_points integer, p_streak jsonb, p_cooldown_hours integer
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_attempt public.arena_domain_assignments%rowtype;
  v_challenge public.arena_challenges%rowtype;
  v_area public.arena_skill_areas%rowtype;
  v_parent text;
  v_existing public.arena_attempt_completions%rowtype;
  v_rating_before integer;
  v_delta integer;
  v_evidence_id uuid;
  v_now timestamptz := now();
begin
  select * into v_attempt from public.arena_domain_assignments where id = p_attempt_id for update;
  if not found then raise exception 'Attempt not found'; end if;

  select * into v_existing from public.arena_attempt_completions where attempt_id = p_attempt_id;
  if found then
    return jsonb_build_object('already_completed', true, 'rating_delta', v_existing.rating_delta, 'rating_after', v_existing.rating_after,
      'points', v_existing.points, 'next_available_at', v_attempt.next_available_at);
  end if;
  if v_attempt.completed_at is not null then raise exception 'Attempt already closed'; end if;

  select * into v_challenge from public.arena_challenges where id = v_attempt.challenge_id;
  select * into v_area from public.arena_skill_areas where role_key = v_attempt.role_key and area_key = v_attempt.skill_area_key;
  select parent_skill_name into v_parent from public.arena_domain_roles where role_key = v_attempt.role_key;

  insert into public.arena_skill_ratings (user_id, role_key, area_key) values (v_attempt.user_id, v_attempt.role_key, v_attempt.skill_area_key)
  on conflict do nothing;
  select rating into v_rating_before from public.arena_skill_ratings
  where user_id = v_attempt.user_id and role_key = v_attempt.role_key and area_key = v_attempt.skill_area_key for update;

  -- Fixed step, not K-factor-scaled: easy/medium/hard -> 8/12/15 ELO, always,
  -- regardless of the student's current rating. Mirrors the fixed point scale
  -- Stream already uses (lib/arena-challenges/points.ts).
  v_delta := case v_challenge.difficulty when 'easy' then 8 when 'medium' then 12 when 'hard' then 15 else 8 end;

  update public.arena_skill_ratings
  set rating = v_rating_before + v_delta, verified_count = verified_count + 1, last_verified_at = v_now, updated_at = v_now
  where user_id = v_attempt.user_id and role_key = v_attempt.role_key and area_key = v_attempt.skill_area_key;

  insert into public.evidence (user_id, skill, source_type, evidence_type, source_identifier, source_url, observed_at, confidence, metadata, analysis_version)
  values (
    v_attempt.user_id, v_area.display_name, 'arena_challenge', 'arena_result',
    'arena-attempt:' || p_attempt_id, '/arena/attempts/' || p_attempt_id, v_now, 'medium',
    jsonb_build_object('parentSkill', v_parent, 'roleKey', v_attempt.role_key, 'skillArea', v_attempt.skill_area_key,
      'skillNode', v_area.skill_node_key, 'toolType', v_challenge.tool_type, 'attemptId', p_attempt_id,
      'challengeId', v_challenge.id, 'title', v_challenge.title, 'company', v_challenge.content->>'company',
      'cycle', v_attempt.cycle_number, 'gradingVersion', v_challenge.grading_version,
      'generationVersion', v_challenge.generation_version, 'verification', 'deterministic_server_grading'),
    v_challenge.grading_version
  )
  on conflict (user_id, source_type, source_identifier) where source_identifier is not null do update set observed_at = excluded.observed_at
  returning id into v_evidence_id;

  -- points mirrors rating_delta here (not p_points): domain's "points" column
  -- means ELO now, and must never drift from the server-computed delta above.
  insert into public.arena_attempt_completions (attempt_id, user_id, role_key, skill_area_key, challenge_id, grading_version,
    rating_before, rating_delta, rating_after, points, evidence_id, completed_at)
  values (p_attempt_id, v_attempt.user_id, v_attempt.role_key, v_attempt.skill_area_key, v_challenge.id, v_challenge.grading_version,
    v_rating_before, v_delta, v_rating_before + v_delta, v_delta, v_evidence_id, v_now);

  update public.arena_domain_assignments
  set status = 'verified', grade = p_grade, submission = p_submission, submitted_at = v_now, submission_count = submission_count + 1,
      completed_at = v_now, next_available_at = v_now + make_interval(hours => p_cooldown_hours)
  where id = p_attempt_id;

  insert into public.arena_challenge_completions (user_id, challenge_id, track, scope_key, code_submitted, is_correct, elo_delta, completed_at)
  values (v_attempt.user_id, v_challenge.id, 'domain', v_attempt.role_key, p_submission::text, true, v_delta, v_now)
  on conflict (user_id, challenge_id) do update set is_correct = true, elo_delta = excluded.elo_delta, code_submitted = excluded.code_submitted, completed_at = excluded.completed_at;

  insert into public.arena_domain_stats (user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at)
  values (v_attempt.user_id, v_delta, 1, (p_streak->>'current_streak')::integer, (p_streak->>'longest_streak')::integer,
    (p_streak->>'last_completed_week')::date, v_now)
  on conflict (user_id) do update set points = public.arena_domain_stats.points + v_delta,
    tasks_completed = public.arena_domain_stats.tasks_completed + 1,
    current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
    last_completed_week = excluded.last_completed_week, updated_at = v_now;

  return jsonb_build_object('already_completed', false, 'rating_before', v_rating_before, 'rating_delta', v_delta,
    'rating_after', v_rating_before + v_delta, 'points', v_delta, 'evidence_id', v_evidence_id,
    'next_available_at', v_now + make_interval(hours => p_cooldown_hours));
end;
$$;

revoke execute on function public.complete_workstation_attempt(uuid, jsonb, jsonb, integer, jsonb, integer) from public, anon, authenticated;
grant execute on function public.complete_workstation_attempt(uuid, jsonb, jsonb, integer, jsonb, integer) to service_role;
