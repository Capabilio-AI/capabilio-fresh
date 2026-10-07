-- Role-aware Arena Challenges, Phase 3: atomic completion of a challenge attempt, and the per-skill Domain ELO it feeds.
-- ADDITIVE. Reuses the existing stat, completion and evidence tables so leaderboards, history and the capability model keep working.
--
-- Trust model: complete_challenge_attempt is callable by the service role only. The server grades deterministically (checks, never AI) and passes the
-- result in; points/ELO are only ever awarded here for a PASSED attempt whose evidence_status is VERIFIED_AUTOMATED. A pass that rests on checks only the
-- student's browser ran (UNVERIFIED) still locks the challenge as passed but earns no points, ELO or skill evidence.

-- Domain ELO per canonical skill (career-based challenges are tied to skills, not to the legacy role/area pairs). Baseline 400, as arena_skill_ratings.
create table public.arena_skill_elo (
  student_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  rating integer not null default 400,
  verified_count integer not null default 0 check (verified_count >= 0),
  last_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);
alter table public.arena_skill_elo enable row level security;
create policy arena_skill_elo_self_read on public.arena_skill_elo for select using (student_id = auth.uid());
revoke all on public.arena_skill_elo from anon, authenticated;
grant select on public.arena_skill_elo to authenticated;

create function public.complete_challenge_attempt(p_attempt_id uuid, p_result jsonb, p_streak jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  a public.challenge_attempts%rowtype;
  c public.arena_challenges%rowtype;
  v_status text := p_result->>'status';
  v_evidence_status text := p_result->>'evidence_status';
  v_award boolean;
  v_points integer;
  v_elo integer;
  v_now timestamptz := now();
  v_skill_ids uuid[];
  v_career_ids uuid[];
begin
  if v_status not in ('PASSED', 'FAILED', 'NEEDS_REVIEW', 'EXPIRED') then raise exception 'Invalid attempt status %', v_status; end if;
  if v_evidence_status is not null and v_evidence_status not in ('VERIFIED_AUTOMATED', 'NEEDS_REVIEW', 'UNVERIFIED') then raise exception 'Invalid evidence status %', v_evidence_status; end if;

  select * into a from public.challenge_attempts where id = p_attempt_id for update;
  if not found then raise exception 'Attempt not found'; end if;
  if a.status <> 'IN_PROGRESS' then
    return jsonb_build_object('already_completed', true, 'status', a.status, 'points_awarded', a.points_awarded, 'elo_delta', a.elo_delta, 'evidence_status', a.evidence_status);
  end if;

  select * into c from public.arena_challenges where id = a.challenge_id;
  v_award := v_status = 'PASSED' and v_evidence_status = 'VERIFIED_AUTOMATED';
  v_points := case when v_award and c.track = 'stream' then greatest(0, coalesce((p_result->>'points')::integer, 0)) else 0 end;
  v_elo := case when v_award and c.track = 'domain' then greatest(0, coalesce((p_result->>'elo')::integer, 0)) else 0 end;

  update public.challenge_attempts set
    status = v_status,
    submitted_at = v_now,
    score = (p_result->>'score')::smallint,
    checks_passed = (p_result->>'checks_passed')::smallint,
    checks_total = (p_result->>'checks_total')::smallint,
    check_results = p_result->'check_results',
    time_spent_s = (p_result->>'time_spent_s')::integer,
    hints_used = coalesce((p_result->>'hints_used')::smallint, hints_used),
    evidence_status = v_evidence_status,
    points_awarded = v_points,
    elo_delta = v_elo,
    grading_version = p_result->>'grading_version',
    submission = p_result->'submission',
    reflection_text = p_result->>'reflection_text',
    draft = null
  where id = p_attempt_id;

  select coalesce(array_agg(skill_id), '{}') into v_skill_ids from public.arena_challenge_skills where challenge_id = c.id;
  select coalesce(array_agg(career_id), '{}') into v_career_ids from public.challenge_careers where challenge_id = c.id;

  if v_status = 'PASSED' then
    insert into public.arena_challenge_completions (user_id, challenge_id, track, scope_key, is_correct, elo_delta, completed_at)
    values (a.student_id, c.id, c.track, c.scope_key, true, v_elo, v_now)
    on conflict (user_id, challenge_id) do update set is_correct = true, elo_delta = excluded.elo_delta, completed_at = excluded.completed_at;
  end if;

  if v_award then
    insert into public.evidence (user_id, skill, source_type, evidence_type, source_identifier, source_url, observed_at, confidence, metadata, analysis_version)
    select a.student_id, s.name, 'arena_challenge', 'arena_result', 'challenge-attempt:' || a.id || ':' || s.id, null, v_now, 'medium',
      jsonb_build_object('attemptId', a.id, 'challengeId', c.id, 'title', c.title, 'track', c.track, 'skillId', s.id,
        'verification', 'deterministic_server_checks', 'score', (p_result->>'score')::integer),
      p_result->>'grading_version'
    from public.skills s where s.id = any(v_skill_ids)
    on conflict (user_id, source_type, source_identifier) where source_identifier is not null do update set observed_at = excluded.observed_at;

    if c.track = 'domain' then
      insert into public.arena_skill_elo (student_id, skill_id, rating, verified_count, last_verified_at)
      select a.student_id, sid, 400 + v_elo, 1, v_now from unnest(v_skill_ids) as sid
      on conflict (student_id, skill_id) do update set rating = public.arena_skill_elo.rating + v_elo,
        verified_count = public.arena_skill_elo.verified_count + 1, last_verified_at = v_now, updated_at = v_now;

      insert into public.arena_domain_stats (user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at)
      values (a.student_id, v_elo, 1, (p_streak->>'current_streak')::integer, (p_streak->>'longest_streak')::integer, (p_streak->>'last_completed_week')::date, v_now)
      on conflict (user_id) do update set points = public.arena_domain_stats.points + v_elo, tasks_completed = public.arena_domain_stats.tasks_completed + 1,
        current_streak = excluded.current_streak, longest_streak = excluded.longest_streak, last_completed_week = excluded.last_completed_week, updated_at = v_now;
    else
      insert into public.arena_stream_stats (user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at)
      values (a.student_id, v_points, 1, (p_streak->>'current_streak')::integer, (p_streak->>'longest_streak')::integer, (p_streak->>'last_completed_week')::date, v_now)
      on conflict (user_id) do update set points = public.arena_stream_stats.points + v_points, tasks_completed = public.arena_stream_stats.tasks_completed + 1,
        current_streak = excluded.current_streak, longest_streak = excluded.longest_streak, last_completed_week = excluded.last_completed_week, updated_at = v_now;
    end if;
  end if;

  -- Roadmap / skill-gap outbox. One event per attempt; consumers poll processed_at is null.
  insert into public.challenge_events (event_type, student_id, payload, dedupe_key)
  values (case when v_status = 'PASSED' then 'CHALLENGE_PASSED' else 'CHALLENGE_FAILED' end, a.student_id,
    jsonb_build_object('attemptId', a.id, 'challengeId', c.id, 'track', c.track, 'skillIds', v_skill_ids, 'careerIds', v_career_ids,
      'evidenceStatus', v_evidence_status, 'score', (p_result->>'score')::integer, 'awarded', v_award),
    'attempt:' || a.id)
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('already_completed', false, 'status', v_status, 'points_awarded', v_points, 'elo_delta', v_elo, 'evidence_status', v_evidence_status);
end;
$$;
revoke execute on function public.complete_challenge_attempt(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.complete_challenge_attempt(uuid, jsonb, jsonb) to service_role;
