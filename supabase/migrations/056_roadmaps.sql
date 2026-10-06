-- Phase 7b: the student's roadmap as a VERSIONED, immutable computation (docs/curriculum-roadmap-v2-progress.md).
-- A roadmap row is one (student, career); each regeneration that changes the inputs is a new, immutable roadmap_version with its input snapshot.
-- Old versions are never deleted or edited. Everything is written through save_roadmap_version() — one transaction, serialized per student,
-- and a no-op when the inputs hash is unchanged (so regeneration is idempotent). ADDITIVE. Readable by the student only; written by the server only.

create table public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  branch_key text,
  career_id uuid not null references public.careers(id),
  /** the curriculum version the latest roadmap version was built from */
  curriculum_version_id uuid references public.curriculum_versions(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, career_id)
);
create unique index roadmaps_one_current_per_student on public.roadmaps (student_id) where is_current;

create table public.roadmap_versions (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  version_no integer not null check (version_no >= 1),
  generated_at timestamptz not null default now(),
  trigger text not null check (trigger in ('CAREER_CHANGE', 'CURRICULUM_PUBLISHED', 'PROGRESS_UPDATE', 'MANUAL')),
  mode text not null default 'STANDARD' check (mode in ('STANDARD', 'EXPLORING')),
  curriculum_version_id uuid references public.curriculum_versions(id) on delete set null,
  input_snapshot jsonb not null,
  input_hash text not null,
  readiness_score smallint not null check (readiness_score between 0 and 100),
  baseline_recommended boolean not null default false,
  next_best_action jsonb,
  /** the honest "not configured yet" messages and the readiness explanation that applied to this version */
  notes jsonb not null default '{}',
  unique (roadmap_id, version_no)
);
create index roadmap_versions_latest on public.roadmap_versions (roadmap_id, version_no desc);

create table public.roadmap_goals (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  kind text not null check (kind in ('PRIMARY', 'PLAN_B', 'EXPLORING_ALT')),
  career_id uuid references public.careers(id) on delete set null,
  career_name text not null,
  readiness smallint check (readiness between 0 and 100),
  primary key (version_id, kind, career_name)
);
create table public.roadmap_skill_gaps (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  skill_name text not null,
  importance text not null check (importance in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  target_level smallint not null,
  current_level smallint not null,
  confidence numeric(3, 2) not null default 0,
  verified boolean not null,
  self_declared_only boolean not null default false,
  gap smallint not null,
  coverage text not null check (coverage in ('STRONG', 'PARTIAL', 'NONE')),
  gap_type text check (gap_type in ('COVERED_BY_CURRICULUM', 'PARTIALLY_COVERED', 'NOT_COVERED', 'NEEDS_PRACTICAL_EXPERIENCE', 'NEEDS_EXTERNAL_LEARNING')),
  stage text not null,
  blocked_by_skill_id uuid,
  sort_order integer not null
);
create table public.roadmap_courses (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  title text not null,
  year smallint not null,
  semester smallint,
  tier text not null check (tier in ('CRITICAL', 'HIGH', 'MODERATE', 'USEFUL')),
  stars smallint not null check (stars between 1 and 5),
  score numeric(8, 4) not null,
  schedule text not null check (schedule in ('PAST', 'CURRENT', 'UPCOMING', 'FUTURE')),
  facts jsonb not null,
  /** one AI sentence grounded only in `facts`; NULL when none was written */
  ai_explanation text,
  sort_order integer not null
);
create table public.roadmap_learning_items (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete set null,
  skill_name text not null,
  learning_item_id uuid references public.learning_catalog(id) on delete set null,
  title text not null,
  provider text not null,
  url text,
  level_from smallint not null,
  level_to smallint not null,
  estimated_hours numeric(6, 1),
  starts_now boolean not null,
  reason text not null
);
create table public.roadmap_certifications (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  certification_id uuid references public.certification_catalog(id) on delete set null,
  name text not null,
  provider text not null,
  url text,
  relevance text not null check (relevance in ('REQUIRED', 'RECOMMENDED', 'OPTIONAL')),
  covered_skill_ids uuid[] not null default '{}'
);
create table public.roadmap_projects (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  project_id uuid references public.project_catalog(id) on delete set null,
  title text not null,
  difficulty text not null,
  covered_skill_ids uuid[] not null default '{}',
  is_ai_recommendation boolean not null default false,
  status text not null default 'RECOMMENDED' check (status in ('RECOMMENDED', 'IN_PROGRESS', 'COMPLETED'))
);
create table public.roadmap_arena_challenges (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  challenge_id uuid references public.arena_challenges(id) on delete set null,
  title text not null,
  difficulty text not null,
  covered_skill_ids uuid[] not null default '{}'
);
create table public.roadmap_milestones (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  kind text not null check (kind in ('COURSE', 'SKILL', 'CERTIFICATION', 'PROJECT')),
  ref_id uuid,
  title text not null,
  horizon text not null check (horizon in ('NOW', 'NEXT', 'THIS_YEAR', 'NEXT_YEAR', 'LONG_TERM')),
  status text not null check (status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED')),
  reason text not null,
  optional_exploration boolean not null default false,
  blocked_by_skill_id uuid,
  sort_order integer not null
);
create index on public.roadmap_skill_gaps (version_id);
create index on public.roadmap_courses (version_id);
create index on public.roadmap_learning_items (version_id);
create index on public.roadmap_certifications (version_id);
create index on public.roadmap_projects (version_id);
create index on public.roadmap_arena_challenges (version_id);
create index on public.roadmap_milestones (version_id);

-- Versions and everything under them are immutable. Two narrow exceptions keep the rest of the system deletable:
--  (1) deleting is allowed only as a cascade (the parent is already gone), e.g. when a student is removed;
--  (2) an UPDATE is allowed only when every changed column is a *_id reference being set to NULL because what it pointed at was deleted
--      (the ON DELETE SET NULL actions on course / catalog / curriculum-version references). Content never changes.
create function public.only_dangling_refs_nulled(o jsonb, n jsonb) returns boolean language sql immutable set search_path = public, pg_temp as $$
  select coalesce(bool_and(k.key like '%\_id' and n->>k.key is null), true) from jsonb_each(o) k where n->k.key is distinct from k.value
$$;
create function public.guard_roadmap_version_immutable() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.roadmaps where id = old.roadmap_id) then return old; end if;
  if tg_op = 'UPDATE' and public.only_dangling_refs_nulled(to_jsonb(old), to_jsonb(new)) then return new; end if;
  raise exception 'Roadmap versions are immutable.' using errcode = 'check_violation';
end $$;
create function public.guard_roadmap_child_immutable() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.roadmap_versions where id = old.version_id) then return old; end if;
  if tg_op = 'UPDATE' and public.only_dangling_refs_nulled(to_jsonb(old), to_jsonb(new)) then return new; end if;
  raise exception 'Roadmap versions are immutable.' using errcode = 'check_violation';
end $$;
create trigger guard_immutable before update or delete on public.roadmap_versions for each row execute function public.guard_roadmap_version_immutable();
create trigger guard_immutable before update or delete on public.roadmap_goals for each row execute function public.guard_roadmap_child_immutable();
create trigger guard_immutable before update or delete on public.roadmap_skill_gaps for each row execute function public.guard_roadmap_child_immutable();
create trigger guard_immutable before update or delete on public.roadmap_courses for each row execute function public.guard_roadmap_child_immutable();
create trigger guard_immutable before update or delete on public.roadmap_learning_items for each row execute function public.guard_roadmap_child_immutable();
create trigger guard_immutable before update or delete on public.roadmap_certifications for each row execute function public.guard_roadmap_child_immutable();
create trigger guard_immutable before update or delete on public.roadmap_projects for each row execute function public.guard_roadmap_child_immutable();
create trigger guard_immutable before update or delete on public.roadmap_arena_challenges for each row execute function public.guard_roadmap_child_immutable();
create trigger guard_immutable before update or delete on public.roadmap_milestones for each row execute function public.guard_roadmap_child_immutable();

-- The one write path. Serialized per student; a no-op (returns the existing version) when the inputs hash is unchanged, unless this is a
-- (re)activation of a roadmap, which always starts a new version. Everything is inserted in this one transaction.
create function public.save_roadmap_version(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  v_student uuid := (p->>'student_id')::uuid; v_career uuid := (p->>'career_id')::uuid;
  rm public.roadmaps; v_no integer; v_id uuid; last_id uuid; last_hash text; v_force boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_student::text, 0));
  select * into rm from public.roadmaps where student_id = v_student and career_id = v_career for update;
  if not found then
    update public.roadmaps set is_current = false where student_id = v_student and is_current;
    insert into public.roadmaps (student_id, institution_id, branch_key, career_id, curriculum_version_id, is_current)
      values (v_student, nullif(p->>'institution_id', '')::uuid, p->>'branch_key', v_career, nullif(p->>'curriculum_version_id', '')::uuid, true) returning * into rm;
    v_force := true;
  elsif not rm.is_current then
    update public.roadmaps set is_current = false where student_id = v_student and is_current;
    update public.roadmaps set is_current = true where id = rm.id;
    v_force := true;
  end if;

  select id, version_no, input_hash into last_id, v_no, last_hash from public.roadmap_versions where roadmap_id = rm.id order by version_no desc limit 1;
  if found and last_hash = p->>'hash' and not v_force then
    return jsonb_build_object('created', false, 'version_id', last_id, 'version_no', v_no, 'roadmap_id', rm.id);
  end if;
  v_no := coalesce(v_no, 0) + 1;

  insert into public.roadmap_versions (roadmap_id, version_no, trigger, mode, curriculum_version_id, input_snapshot, input_hash, readiness_score, baseline_recommended, next_best_action, notes)
    values (rm.id, v_no, p->>'trigger', coalesce(p->>'mode', 'STANDARD'), nullif(p->>'curriculum_version_id', '')::uuid, p->'snapshot', p->>'hash', (p->>'readiness')::smallint,
            coalesce((p->>'baseline')::boolean, false), p->'next_best_action', coalesce(p->'notes', '{}'::jsonb))
    returning id into v_id;

  insert into public.roadmap_goals (version_id, kind, career_id, career_name, readiness)
    select v_id, x.kind, nullif(x.career_id, '')::uuid, x.career_name, x.readiness from jsonb_to_recordset(coalesce(p->'goals', '[]')) as x(kind text, career_id text, career_name text, readiness smallint);
  insert into public.roadmap_skill_gaps (version_id, skill_id, skill_name, importance, target_level, current_level, confidence, verified, self_declared_only, gap, coverage, gap_type, stage, blocked_by_skill_id, sort_order)
    select v_id, nullif(x.skill_id, '')::uuid, x.skill_name, x.importance, x.target_level, x.current_level, x.confidence, x.verified, x.self_declared_only, x.gap, x.coverage, x.gap_type, x.stage, nullif(x.blocked_by_skill_id, '')::uuid, x.sort_order
    from jsonb_to_recordset(coalesce(p->'gaps', '[]')) as x(skill_id text, skill_name text, importance text, target_level smallint, current_level smallint, confidence numeric, verified boolean, self_declared_only boolean, gap smallint, coverage text, gap_type text, stage text, blocked_by_skill_id text, sort_order integer);
  insert into public.roadmap_courses (version_id, course_id, title, year, semester, tier, stars, score, schedule, facts, ai_explanation, sort_order)
    select v_id, nullif(x.course_id, '')::uuid, x.title, x.year, x.semester, x.tier, x.stars, x.score, x.schedule, x.facts, x.ai_explanation, x.sort_order
    from jsonb_to_recordset(coalesce(p->'courses', '[]')) as x(course_id text, title text, year smallint, semester smallint, tier text, stars smallint, score numeric, schedule text, facts jsonb, ai_explanation text, sort_order integer);
  insert into public.roadmap_learning_items (version_id, skill_id, skill_name, learning_item_id, title, provider, url, level_from, level_to, estimated_hours, starts_now, reason)
    select v_id, nullif(x.skill_id, '')::uuid, x.skill_name, nullif(x.learning_item_id, '')::uuid, x.title, x.provider, x.url, x.level_from, x.level_to, x.estimated_hours, x.starts_now, x.reason
    from jsonb_to_recordset(coalesce(p->'learning', '[]')) as x(skill_id text, skill_name text, learning_item_id text, title text, provider text, url text, level_from smallint, level_to smallint, estimated_hours numeric, starts_now boolean, reason text);
  insert into public.roadmap_certifications (version_id, certification_id, name, provider, url, relevance, covered_skill_ids)
    select v_id, nullif(x.certification_id, '')::uuid, x.name, x.provider, x.url, x.relevance, coalesce(array(select jsonb_array_elements_text(x.covered_skill_ids))::uuid[], '{}')
    from jsonb_to_recordset(coalesce(p->'certifications', '[]')) as x(certification_id text, name text, provider text, url text, relevance text, covered_skill_ids jsonb);
  insert into public.roadmap_projects (version_id, project_id, title, difficulty, covered_skill_ids, is_ai_recommendation)
    select v_id, nullif(x.project_id, '')::uuid, x.title, x.difficulty, coalesce(array(select jsonb_array_elements_text(x.covered_skill_ids))::uuid[], '{}'), x.is_ai_recommendation
    from jsonb_to_recordset(coalesce(p->'projects', '[]')) as x(project_id text, title text, difficulty text, covered_skill_ids jsonb, is_ai_recommendation boolean);
  insert into public.roadmap_arena_challenges (version_id, challenge_id, title, difficulty, covered_skill_ids)
    select v_id, nullif(x.challenge_id, '')::uuid, x.title, x.difficulty, coalesce(array(select jsonb_array_elements_text(x.covered_skill_ids))::uuid[], '{}')
    from jsonb_to_recordset(coalesce(p->'arena', '[]')) as x(challenge_id text, title text, difficulty text, covered_skill_ids jsonb);
  insert into public.roadmap_milestones (version_id, kind, ref_id, title, horizon, status, reason, optional_exploration, blocked_by_skill_id, sort_order)
    select v_id, x.kind, nullif(x.ref_id, '')::uuid, x.title, x.horizon, x.status, x.reason, x.optional_exploration, nullif(x.blocked_by_skill_id, '')::uuid, x.sort_order
    from jsonb_to_recordset(coalesce(p->'milestones', '[]')) as x(kind text, ref_id text, title text, horizon text, status text, reason text, optional_exploration boolean, blocked_by_skill_id text, sort_order integer);

  update public.roadmaps set curriculum_version_id = nullif(p->>'curriculum_version_id', '')::uuid, institution_id = nullif(p->>'institution_id', '')::uuid, branch_key = p->>'branch_key', updated_at = now() where id = rm.id;
  return jsonb_build_object('created', true, 'version_id', v_id, 'version_no', v_no, 'roadmap_id', rm.id);
end $$;
revoke execute on function public.save_roadmap_version(jsonb) from public, anon, authenticated;
grant execute on function public.save_roadmap_version(jsonb) to service_role;

-- Authority: a student reads only their own roadmap; nothing is client-writable.
alter table public.roadmaps enable row level security;
alter table public.roadmap_versions enable row level security;
alter table public.roadmap_goals enable row level security;
alter table public.roadmap_skill_gaps enable row level security;
alter table public.roadmap_courses enable row level security;
alter table public.roadmap_learning_items enable row level security;
alter table public.roadmap_certifications enable row level security;
alter table public.roadmap_projects enable row level security;
alter table public.roadmap_arena_challenges enable row level security;
alter table public.roadmap_milestones enable row level security;
create policy roadmaps_read_own on public.roadmaps for select using (student_id = auth.uid());
create policy roadmap_versions_read_own on public.roadmap_versions for select using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and r.student_id = auth.uid()));
create policy roadmap_goals_read_own on public.roadmap_goals for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
create policy roadmap_skill_gaps_read_own on public.roadmap_skill_gaps for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
create policy roadmap_courses_read_own on public.roadmap_courses for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
create policy roadmap_learning_items_read_own on public.roadmap_learning_items for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
create policy roadmap_certifications_read_own on public.roadmap_certifications for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
create policy roadmap_projects_read_own on public.roadmap_projects for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
create policy roadmap_arena_challenges_read_own on public.roadmap_arena_challenges for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
create policy roadmap_milestones_read_own on public.roadmap_milestones for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
revoke insert, update, delete, truncate on public.roadmaps, public.roadmap_versions, public.roadmap_goals, public.roadmap_skill_gaps, public.roadmap_courses, public.roadmap_learning_items,
  public.roadmap_certifications, public.roadmap_projects, public.roadmap_arena_challenges, public.roadmap_milestones from anon, authenticated;
