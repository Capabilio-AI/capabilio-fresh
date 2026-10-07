-- Visual roadmap, Phase 1: topic-tree templates (data, not code), per-student node state, per-version node snapshots, diagnostic items,
-- AI call logging, tunable settings, and the honest-score fixes (formula_version, "assessed"). ADDITIVE ONLY: existing versions stay immutable and unchanged.
--
-- Authority: templates/nodes/edges/resources are readable by students ONLY when their template is PUBLISHED; everything is written by the server or
-- operators (service role). A student reads only their own node state and version snapshots. Diagnostic items hold answer keys: service role only.

-- ---------------------------------------------------------------------------------------------------------------------------------
create table public.roadmap_templates (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references public.careers(id),
  version integer not null check (version >= 1),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'REVIEWED', 'PUBLISHED', 'RETIRED')),
  source text not null default 'CAPABILIO' check (source in ('CAPABILIO', 'AI_DRAFTED_THEN_REVIEWED')),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text check (description is null or char_length(description) <= 1000),
  /** where this tree comes from and how it was designed; required, never blank (original content only) */
  provenance jsonb not null,
  spec_hash text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (career_id, version),
  -- nothing is served as official without a person having reviewed it
  constraint roadmap_templates_review_required check (status in ('DRAFT', 'RETIRED') or reviewed_by is not null)
);
create unique index roadmap_templates_one_published on public.roadmap_templates (career_id) where status = 'PUBLISHED';
create trigger set_updated_at before update on public.roadmap_templates for each row execute function public.set_updated_at();

create table public.roadmap_nodes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.roadmap_templates(id) on delete cascade,
  /** stable within a template, so versions and per-student state can follow a node across template edits */
  node_key text not null check (node_key ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  parent_node_id uuid references public.roadmap_nodes(id) on delete cascade,
  type text not null check (type in ('SPINE', 'GROUP', 'TOPIC')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1200),
  skill_id uuid references public.skills(id),
  importance text not null default 'CORE' check (importance in ('CORE', 'RECOMMENDED', 'OPTIONAL')),
  target_level smallint check (target_level is null or target_level between 0 and 100),
  stage text not null check (stage in ('FOUNDATION', 'CORE', 'SPECIALIZATION', 'JOB_READY')),
  sort_order integer not null default 0,
  side text not null default 'CENTER' check (side in ('LEFT', 'RIGHT', 'CENTER')),
  unique (template_id, node_key),
  -- a topic is scored, so it must name a canonical skill and a target
  constraint roadmap_nodes_topic_scored check (type <> 'TOPIC' or (skill_id is not null and target_level is not null)),
  constraint roadmap_nodes_spine_center check (type <> 'SPINE' or side = 'CENTER')
);
create index roadmap_nodes_by_template on public.roadmap_nodes (template_id, sort_order);
create index roadmap_nodes_by_skill on public.roadmap_nodes (skill_id) where skill_id is not null;

-- A node may only name a reviewed (active) canonical skill: never a candidate, never free text.
create function public.guard_node_skill_active() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.skill_id is not null and not exists (select 1 from public.skills where id = new.skill_id and status = 'active') then
    raise exception 'A roadmap node can only use an active skill from the canonical taxonomy.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guard_node_skill before insert or update of skill_id on public.roadmap_nodes for each row execute function public.guard_node_skill_active();

create table public.roadmap_edges (
  template_id uuid not null references public.roadmap_templates(id) on delete cascade,
  from_node_id uuid not null references public.roadmap_nodes(id) on delete cascade,
  to_node_id uuid not null references public.roadmap_nodes(id) on delete cascade,
  type text not null check (type in ('PREREQUISITE', 'CONNECTOR', 'OPTIONAL_PATH')),
  primary key (from_node_id, to_node_id, type),
  check (from_node_id <> to_node_id)
);
create index roadmap_edges_by_template on public.roadmap_edges (template_id);

create table public.node_resources (
  node_id uuid not null references public.roadmap_nodes(id) on delete cascade,
  resource_kind text not null check (resource_kind in ('LEARNING', 'CERTIFICATION', 'PROJECT', 'ARENA')),
  /** id in the matching catalog (learning_catalog / certification_catalog / project_catalog / arena_challenges); validated by the template validator */
  resource_id uuid not null,
  tier text not null default 'FREE' check (tier in ('FREE', 'PREMIUM')),
  sort_order integer not null default 0,
  primary key (node_id, resource_kind, resource_id)
);

alter table public.roadmap_templates enable row level security;
alter table public.roadmap_nodes enable row level security;
alter table public.roadmap_edges enable row level security;
alter table public.node_resources enable row level security;
create policy roadmap_templates_read_published on public.roadmap_templates for select to authenticated using (status = 'PUBLISHED');
create policy roadmap_nodes_read_published on public.roadmap_nodes for select to authenticated using (exists (select 1 from public.roadmap_templates t where t.id = template_id and t.status = 'PUBLISHED'));
create policy roadmap_edges_read_published on public.roadmap_edges for select to authenticated using (exists (select 1 from public.roadmap_templates t where t.id = template_id and t.status = 'PUBLISHED'));
create policy node_resources_read_published on public.node_resources for select to authenticated using (exists (select 1 from public.roadmap_nodes n join public.roadmap_templates t on t.id = n.template_id where n.id = node_id and t.status = 'PUBLISHED'));
revoke all on public.roadmap_templates, public.roadmap_nodes, public.roadmap_edges, public.node_resources from anon, authenticated;
grant select (id, career_id, version, status, source, title, description, provenance, published_at) on public.roadmap_templates to authenticated;
grant select on public.roadmap_nodes, public.roadmap_edges, public.node_resources to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- What the student has said about a node. Written by the server only; the student reads their own.
create table public.roadmap_node_state (
  student_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.roadmap_nodes(id) on delete cascade,
  status text not null check (status in ('LEARNING', 'DONE', 'SKIPPED')),
  skip_reason text check (skip_reason is null or char_length(btrim(skip_reason)) between 3 and 300),
  updated_at timestamptz not null default now(),
  primary key (student_id, node_id),
  constraint roadmap_node_state_skip_reason check (status <> 'SKIPPED' or skip_reason is not null)
);
alter table public.roadmap_node_state enable row level security;
create policy roadmap_node_state_read_own on public.roadmap_node_state for select using (student_id = auth.uid());
revoke all on public.roadmap_node_state from anon, authenticated;
grant select on public.roadmap_node_state to authenticated;

-- Per-version snapshot of every node's honest state, so versions can be diffed. level is NULL when nothing has been assessed (never 0).
create table public.roadmap_version_nodes (
  version_id uuid not null references public.roadmap_versions(id) on delete cascade,
  node_key text not null,
  node_id uuid references public.roadmap_nodes(id) on delete set null,
  level smallint check (level is null or level between 0 and 100),
  confidence numeric(3, 2),
  verified boolean not null default false,
  assessed boolean not null default false,
  status text not null,
  coverage text check (coverage is null or coverage in ('STRONG', 'PARTIAL', 'NONE', 'UNKNOWN')),
  primary key (version_id, node_key)
);
alter table public.roadmap_version_nodes enable row level security;
create policy roadmap_version_nodes_read_own on public.roadmap_version_nodes for select using (exists (select 1 from public.roadmap_versions v join public.roadmaps r on r.id = v.roadmap_id where v.id = version_id and r.student_id = auth.uid()));
revoke all on public.roadmap_version_nodes from anon, authenticated;
grant select on public.roadmap_version_nodes to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Honest-score fixes on the existing tables. Old rows keep their meaning: v1 formula, and "assessed" defaults to true because the old
-- code could not tell a measured 0 from an absent one.
alter table public.roadmap_versions add column formula_version text not null default 'capability.v1';
alter table public.roadmap_skill_gaps add column assessed boolean not null default true;

-- The student's own current semester (1 or 2 within their year of study). NULL until the student confirms it; the app shows an estimate until then.
alter table public.institution_memberships
  add column current_semester smallint check (current_semester is null or current_semester between 1 and 2),
  add column semester_confirmed_at timestamptz;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Tunable settings (admin-editable without a deploy). Values are jsonb.
create table public.roadmap_settings (
  key text primary key check (key ~ '^[a-z0-9_]{3,60}$'),
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.roadmap_settings enable row level security;
revoke all on public.roadmap_settings from anon, authenticated;
insert into public.roadmap_settings (key, value, description) values
  ('inferred_min_confidence', '0.8', 'Skill mappings Capabilio inferred (not confirmed by a college) appear on a roadmap only at or above this confidence, always badged as inferred.');

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Every AI call made by the new roadmap features. Unknown stays unknown: tokens and cost are NULL when the provider did not report them.
-- No prompt or response text is stored; meta holds only non-personal identifiers (e.g. node key).
create table public.ai_call_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feature text not null check (char_length(feature) between 2 and 80),
  model text,
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('ok', 'error', 'rate_limited', 'blocked')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  cost_cents_estimate numeric(12, 6) check (cost_cents_estimate is null or cost_cents_estimate >= 0),
  error text check (error is null or char_length(error) <= 300),
  meta jsonb not null default '{}'
);
create index ai_call_log_by_feature_day on public.ai_call_log (feature, created_at desc);
create index ai_call_log_by_user on public.ai_call_log (user_id, created_at desc);
alter table public.ai_call_log enable row level security;
revoke all on public.ai_call_log from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Career diagnostic items (the baseline assessment). Separate from question_bank; the existing /assessment is untouched.
-- Auto-graded; AI may only DRAFT; nothing is served unless PUBLISHED and reviewed. Holds answer keys, so service role only.
create table public.diagnostic_items (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills(id),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'REVIEWED', 'PUBLISHED')),
  source text not null default 'CAPABILIO' check (source in ('CAPABILIO', 'AI_DRAFTED_THEN_REVIEWED')),
  kind text not null check (kind in ('MCQ', 'MULTI_SELECT', 'NUMERIC')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  prompt text not null check (char_length(btrim(prompt)) between 5 and 2000),
  options jsonb,
  answer_key jsonb not null,
  explanation text check (explanation is null or char_length(explanation) <= 2000),
  estimated_seconds integer not null default 60 check (estimated_seconds between 10 and 900),
  provenance jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- an item without a person's review is never published, whatever wrote it
  constraint diagnostic_items_published_reviewed check (status <> 'PUBLISHED' or reviewed_by is not null),
  constraint diagnostic_items_options check ((kind = 'NUMERIC') = (options is null))
);
create index diagnostic_items_by_skill on public.diagnostic_items (skill_id, status, difficulty);
create trigger set_updated_at before update on public.diagnostic_items for each row execute function public.set_updated_at();
alter table public.diagnostic_items enable row level security;
revoke all on public.diagnostic_items from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- The one write path for versions now also records the formula version and whether each skill was actually assessed.
create or replace function public.save_roadmap_version(p jsonb) returns jsonb
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

  insert into public.roadmap_versions (roadmap_id, version_no, trigger, mode, curriculum_version_id, input_snapshot, input_hash, readiness_score, baseline_recommended, next_best_action, notes, formula_version)
    values (rm.id, v_no, p->>'trigger', coalesce(p->>'mode', 'STANDARD'), nullif(p->>'curriculum_version_id', '')::uuid, p->'snapshot', p->>'hash', (p->>'readiness')::smallint,
            coalesce((p->>'baseline')::boolean, false), p->'next_best_action', coalesce(p->'notes', '{}'::jsonb), coalesce(p->>'formula_version', 'capability.v1'))
    returning id into v_id;

  insert into public.roadmap_goals (version_id, kind, career_id, career_name, readiness)
    select v_id, x.kind, nullif(x.career_id, '')::uuid, x.career_name, x.readiness from jsonb_to_recordset(coalesce(p->'goals', '[]')) as x(kind text, career_id text, career_name text, readiness smallint);
  insert into public.roadmap_skill_gaps (version_id, skill_id, skill_name, importance, target_level, current_level, confidence, verified, self_declared_only, gap, coverage, gap_type, stage, blocked_by_skill_id, sort_order, assessed)
    select v_id, nullif(x.skill_id, '')::uuid, x.skill_name, x.importance, x.target_level, x.current_level, x.confidence, x.verified, x.self_declared_only, x.gap, x.coverage, x.gap_type, x.stage, nullif(x.blocked_by_skill_id, '')::uuid, x.sort_order, coalesce(x.assessed, true)
    from jsonb_to_recordset(coalesce(p->'gaps', '[]')) as x(skill_id text, skill_name text, importance text, target_level smallint, current_level smallint, confidence numeric, verified boolean, self_declared_only boolean, gap smallint, coverage text, gap_type text, stage text, blocked_by_skill_id text, sort_order integer, assessed boolean);
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
