-- Multi-skill domain workstations: config-driven taxonomy, server-side
-- rotation, immutable generated challenge instances, sub-skill ratings and
-- exactly-once verified completion. See docs/workstation-progress.md.

-- ── Taxonomy (configuration as data) ──────────────────────────────────────
create table public.arena_domain_roles (
  role_key text primary key,
  display_name text not null,
  parent_skill_name text not null,
  match_keywords text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.arena_skill_areas (
  role_key text not null references public.arena_domain_roles(role_key),
  area_key text not null,
  display_name text not null,
  skill_node_key text not null unique,
  tool_type text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  generation_version text not null,
  grading_version text not null,
  disabled_reason text,
  created_at timestamptz not null default now(),
  primary key (role_key, area_key)
);

alter table public.arena_domain_roles enable row level security;
alter table public.arena_skill_areas enable row level security;
create policy arena_domain_roles_read on public.arena_domain_roles for select to authenticated using (true);
create policy arena_skill_areas_read on public.arena_skill_areas for select to authenticated using (true);

insert into public.arena_domain_roles (role_key, display_name, parent_skill_name, match_keywords) values
  ('data-analyst', 'Data Analyst', 'Data Analysis',
   array['data analyst', 'data analytics', 'sql analyst', 'reporting analyst', 'analytics', 'business intelligence', 'bi analyst', 'power bi', 'tableau']);

insert into public.arena_skill_areas (role_key, area_key, display_name, skill_node_key, tool_type, enabled, sort_order, generation_version, grading_version, disabled_reason) values
  ('data-analyst', 'sql', 'SQL', 'data_analyst.sql', 'sql_workspace', true, 1, 'sql.gen.v1', 'sql.grade.v1', null),
  ('data-analyst', 'python', 'Python', 'data_analyst.python', 'python_workspace', false, 2, 'python.gen.v0', 'python.grade.v0',
   'No isolated Python executor with network egress denied is available (see docs/workstation-progress.md).'),
  ('data-analyst', 'spreadsheet', 'Excel / Spreadsheets', 'data_analyst.spreadsheet', 'spreadsheet_workspace', true, 3, 'spreadsheet.gen.v1', 'spreadsheet.grade.v1', null),
  ('data-analyst', 'dashboard', 'BI / Dashboarding', 'data_analyst.dashboard', 'dashboard_workspace', true, 4, 'dashboard.gen.v1', 'dashboard.grade.v1', null),
  ('data-analyst', 'statistics', 'Statistics', 'data_analyst.statistics', 'statistics_workspace', true, 5, 'statistics.gen.v1', 'statistics.grade.v1', null),
  ('data-analyst', 'data_cleaning', 'Data Cleaning', 'data_analyst.data_cleaning', 'cleaning_workspace', true, 6, 'cleaning.gen.v1', 'cleaning.grade.v1', null);

-- ── Rotation state ─────────────────────────────────────────────────────────
create table public.arena_rotation_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.arena_domain_roles(role_key),
  cycle_number integer not null default 0,
  remaining text[] not null default '{}',
  served text[] not null default '{}',
  last_served text,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, role_key)
);
alter table public.arena_rotation_state enable row level security;
create policy arena_rotation_state_self_read on public.arena_rotation_state for select using (user_id = auth.uid());

-- ── Generated challenge instances (per candidate, immutable) ───────────────
alter table public.arena_challenges
  add column user_id uuid references auth.users(id) on delete cascade,
  add column skill_area_key text,
  add column tool_type text,
  add column content jsonb,
  add column answer_key jsonb,
  add column generation_provider text,
  add column generation_model text,
  add column generation_version text,
  add column grading_version text,
  add column generated_at timestamptz;

alter table public.arena_challenges drop constraint arena_challenges_kind_check;
alter table public.arena_challenges add constraint arena_challenges_kind_check check (kind in ('code', 'numeric', 'sql', 'workstation'));

create index idx_arena_challenges_owner on public.arena_challenges(user_id) where user_id is not null;

create or replace function public.arena_challenge_instance_immutable() returns trigger
language plpgsql set search_path to '' as $$
begin
  if old.user_id is not null and (
    new.content is distinct from old.content or new.answer_key is distinct from old.answer_key
    or new.title is distinct from old.title or new.scenario is distinct from old.scenario
    or new.objective is distinct from old.objective or new.user_id is distinct from old.user_id
    or new.skill_area_key is distinct from old.skill_area_key or new.tool_type is distinct from old.tool_type
    or new.generation_version is distinct from old.generation_version or new.grading_version is distinct from old.grading_version
  ) then
    raise exception 'Generated challenge instances are immutable';
  end if;
  return new;
end;
$$;
create trigger arena_challenge_instance_immutable before update on public.arena_challenges
  for each row execute function public.arena_challenge_instance_immutable();

-- Instances are private to their candidate; the shared Stream pool stays readable.
drop policy arena_challenges_read_all on public.arena_challenges;
create policy arena_challenges_read on public.arena_challenges for select to authenticated using (user_id is null or user_id = auth.uid());
grant select (content, skill_area_key, tool_type, user_id, generated_at) on public.arena_challenges to authenticated;

-- Deactivate the hand-authored Data Analyst tickets: new attempts are generated.
update public.arena_challenges set active = false where track = 'domain' and scope_key = 'data-analyst' and user_id is null;

-- ── Attempts ───────────────────────────────────────────────────────────────
alter table public.arena_domain_assignments
  add column skill_area_key text,
  add column cycle_number integer,
  add column status text not null default 'presented' check (status in ('presented', 'grading', 'verified', 'cancelled')),
  add column submission jsonb,
  add column grade jsonb,
  add column submitted_at timestamptz,
  add column submission_count integer not null default 0;

-- Backfill attempts made on the hand-authored SQL tickets (migration 024).
update public.arena_domain_assignments set skill_area_key = 'sql' where skill_area_key is null and role_key = 'data-analyst';
update public.arena_domain_assignments set status = 'verified' where completed_at is not null;

-- ── Sub-skill ratings (Skill Graph nodes: role → skill area) ───────────────
create table public.arena_skill_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  area_key text not null,
  rating integer not null default 1200,
  verified_count integer not null default 0,
  last_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, role_key, area_key),
  foreign key (role_key, area_key) references public.arena_skill_areas(role_key, area_key)
);
alter table public.arena_skill_ratings enable row level security;
create policy arena_skill_ratings_self_read on public.arena_skill_ratings for select using (user_id = auth.uid());

-- ── Completion events (exactly once per attempt) ───────────────────────────
create table public.arena_attempt_completions (
  attempt_id uuid primary key references public.arena_domain_assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  skill_area_key text not null,
  challenge_id uuid not null references public.arena_challenges(id),
  grading_version text not null,
  rating_before integer not null,
  rating_delta integer not null,
  rating_after integer not null,
  points integer not null,
  evidence_id uuid references public.evidence(id),
  completed_at timestamptz not null default now()
);
-- Replay verified legacy (migration 024) SQL attempts into the sub-skill node
-- with the same formula; their points/evidence were already written then.
do $$
declare
  r record;
  v_before integer;
  v_delta integer;
begin
  for r in
    select a.id, a.user_id, a.role_key, a.skill_area_key, a.challenge_id, a.completed_at, coalesce(cc.elo_delta, 0) as points
    from public.arena_domain_assignments a
    left join public.arena_challenge_completions cc on cc.user_id = a.user_id and cc.challenge_id = a.challenge_id
    where a.status = 'verified' order by a.completed_at
  loop
    insert into public.arena_skill_ratings (user_id, role_key, area_key) values (r.user_id, r.role_key, r.skill_area_key) on conflict do nothing;
    select rating into v_before from public.arena_skill_ratings where user_id = r.user_id and role_key = r.role_key and area_key = r.skill_area_key;
    v_delta := round(32 * (1 - 1 / (1 + power(10, (1200 - v_before)::numeric / 400))));
    update public.arena_skill_ratings set rating = v_before + v_delta, verified_count = verified_count + 1, last_verified_at = r.completed_at
    where user_id = r.user_id and role_key = r.role_key and area_key = r.skill_area_key;
    insert into public.arena_attempt_completions (attempt_id, user_id, role_key, skill_area_key, challenge_id, grading_version, rating_before, rating_delta, rating_after, points, completed_at)
    values (r.id, r.user_id, r.role_key, r.skill_area_key, r.challenge_id, 'sql.grade.legacy-024', v_before, v_delta, v_before + v_delta, r.points, r.completed_at);
  end loop;
end;
$$;

alter table public.arena_attempt_completions enable row level security;
create policy arena_attempt_completions_self_read on public.arena_attempt_completions for select using (user_id = auth.uid());

-- ── Commit a rotation slot + challenge instance + attempt atomically ───────
-- Called only after generation+validation succeeded. Returns conflict=true
-- (and creates nothing) if another request already advanced the rotation or
-- an attempt is already open.
create or replace function public.commit_rotation_attempt(
  p_user_id uuid, p_role_key text, p_area_key text, p_expected_version integer, p_challenge jsonb
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_state public.arena_rotation_state%rowtype;
  v_challenge_id uuid;
  v_attempt_id uuid;
begin
  select * into v_state from public.arena_rotation_state
  where user_id = p_user_id and role_key = p_role_key for update;

  if not found or v_state.version <> p_expected_version or v_state.remaining[1] is distinct from p_area_key then
    return jsonb_build_object('conflict', true);
  end if;
  if exists (select 1 from public.arena_domain_assignments where user_id = p_user_id and role_key = p_role_key and completed_at is null) then
    return jsonb_build_object('conflict', true);
  end if;

  insert into public.arena_challenges (
    track, scope_key, kind, title, category, difficulty, time_limit_minutes, scenario, objective,
    language, starter_code, expected_output, requester, skill_tags, active,
    user_id, skill_area_key, tool_type, content, answer_key,
    generation_provider, generation_model, generation_version, grading_version, generated_at
  ) values (
    'domain', p_role_key, 'workstation', p_challenge->>'title', p_challenge->>'category', p_challenge->>'difficulty',
    (p_challenge->>'time_limit_minutes')::integer, p_challenge->>'scenario', p_challenge->>'objective',
    p_challenge->>'tool_type', null, '', p_challenge->>'requester',
    array(select jsonb_array_elements_text(p_challenge->'skill_tags')), true,
    p_user_id, p_area_key, p_challenge->>'tool_type', p_challenge->'content', p_challenge->'answer_key',
    p_challenge->>'generation_provider', p_challenge->>'generation_model', p_challenge->>'generation_version',
    p_challenge->>'grading_version', now()
  ) returning id into v_challenge_id;

  insert into public.arena_domain_assignments (user_id, role_key, challenge_id, skill_area_key, cycle_number, status)
  values (p_user_id, p_role_key, v_challenge_id, p_area_key, v_state.cycle_number, 'presented')
  returning id into v_attempt_id;

  update public.arena_rotation_state
  set remaining = v_state.remaining[2:], served = v_state.served || p_area_key, last_served = p_area_key,
      version = v_state.version + 1, updated_at = now()
  where user_id = p_user_id and role_key = p_role_key;

  return jsonb_build_object('conflict', false, 'attempt_id', v_attempt_id, 'challenge_id', v_challenge_id);
end;
$$;

-- ── Verified completion: event + sub-skill ELO + evidence + points, once ───
-- Same ELO constants/formula as finish_arena_challenge (K=32, baseline 1200),
-- actual = 1 for a verified pass. Idempotent: a second call for the same
-- attempt returns the stored completion and changes nothing.
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
  v_expected numeric;
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

  v_expected := 1 / (1 + power(10, (1200 - v_rating_before)::numeric / 400));
  v_delta := round(32 * (1 - v_expected));

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

  insert into public.arena_attempt_completions (attempt_id, user_id, role_key, skill_area_key, challenge_id, grading_version,
    rating_before, rating_delta, rating_after, points, evidence_id, completed_at)
  values (p_attempt_id, v_attempt.user_id, v_attempt.role_key, v_attempt.skill_area_key, v_challenge.id, v_challenge.grading_version,
    v_rating_before, v_delta, v_rating_before + v_delta, p_points, v_evidence_id, v_now);

  update public.arena_domain_assignments
  set status = 'verified', grade = p_grade, submission = p_submission, submitted_at = v_now, submission_count = submission_count + 1,
      completed_at = v_now, next_available_at = v_now + make_interval(hours => p_cooldown_hours)
  where id = p_attempt_id;

  insert into public.arena_challenge_completions (user_id, challenge_id, track, scope_key, code_submitted, is_correct, elo_delta, completed_at)
  values (v_attempt.user_id, v_challenge.id, 'domain', v_attempt.role_key, p_submission::text, true, p_points, v_now)
  on conflict (user_id, challenge_id) do update set is_correct = true, elo_delta = excluded.elo_delta, code_submitted = excluded.code_submitted, completed_at = excluded.completed_at;

  insert into public.arena_challenge_stats (user_id, points, tasks_completed, current_streak, longest_streak, last_completed_week, updated_at)
  values (v_attempt.user_id, p_points, 1, (p_streak->>'current_streak')::integer, (p_streak->>'longest_streak')::integer,
    (p_streak->>'last_completed_week')::date, v_now)
  on conflict (user_id) do update set points = public.arena_challenge_stats.points + p_points,
    tasks_completed = public.arena_challenge_stats.tasks_completed + 1,
    current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
    last_completed_week = excluded.last_completed_week, updated_at = v_now;

  return jsonb_build_object('already_completed', false, 'rating_before', v_rating_before, 'rating_delta', v_delta,
    'rating_after', v_rating_before + v_delta, 'points', p_points, 'evidence_id', v_evidence_id,
    'next_available_at', v_now + make_interval(hours => p_cooldown_hours));
end;
$$;

revoke execute on function public.commit_rotation_attempt(uuid, text, text, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.complete_workstation_attempt(uuid, jsonb, jsonb, integer, jsonb, integer) from public, anon, authenticated;
grant execute on function public.commit_rotation_attempt(uuid, text, text, integer, jsonb) to service_role;
grant execute on function public.complete_workstation_attempt(uuid, jsonb, jsonb, integer, jsonb, integer) to service_role;
