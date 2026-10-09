-- 080: two-layer assessment (general diagnostic + career-specific), role ELO ledger, skill graph.
--
-- Design notes
--  * Reuses the existing taxonomy: careers (= career_roles), skills, career_skill_requirements (= career_role_skills).
--    The requirements table gains assessment_weight / min_questions / max_questions rather than introducing a duplicate table.
--  * Skill graph (student_skill_scores), career readiness (computed, stored in snapshots) and role ELO (student_career_elo)
--    are three separate things on purpose: capability per skill / weighted alignment with a role / a performance rating.
--  * Every question comes from Groq and is stored once in assess_question_pool (deduped by content_hash). The pool holds the
--    answer key, so it has RLS enabled with NO policies: only the server (service role) can read it. The client never sees
--    correct_index or explanation until record_assessment_answer returns them for that one question.
--  * ELO only changes inside apply_elo_event(), which writes the ledger row and the rating in one transaction.
--    record_assessment_answer() calls it in the SAME transaction that inserts the response, so they cannot diverge.

-- ---------------------------------------------------------------------------------------------------------------------
-- taxonomy additions
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.skill_categories (
  key text primary key,
  name text not null,
  sort_order int not null default 0
);
alter table public.skill_categories enable row level security;
create policy "skill categories readable" on public.skill_categories for select using (true);

alter table public.career_skill_requirements
  add column if not exists assessment_weight numeric not null default 1 check (assessment_weight > 0),
  add column if not exists min_questions smallint not null default 1 check (min_questions >= 0),
  add column if not exists max_questions smallint not null default 3;
alter table public.career_skill_requirements
  add constraint career_skill_requirements_question_range check (max_questions >= min_questions and max_questions <= 6);

-- new canonical skills (existing ones are reused; name/key collisions are skipped)
with v(key, name, category) as (values
  ('SKILL_POWER_BI','Power BI','Data'),
  ('SKILL_DATA_VISUALIZATION','Data Visualization','Data'),
  ('SKILL_SOFTWARE_ARCHITECTURE','Software Architecture','Software Engineering'),
  ('SKILL_HTML_CSS','HTML & CSS','Software Engineering'),
  ('SKILL_FRONTEND_FRAMEWORKS','Frontend Frameworks','Software Engineering'),
  ('SKILL_BACKEND_DEVELOPMENT','Backend Development','Software Engineering'),
  ('SKILL_THREAT_DETECTION','Threat Detection & Incident Response','Cybersecurity'),
  ('SKILL_VULNERABILITY_ASSESSMENT','Vulnerability Assessment','Cybersecurity'),
  ('SKILL_WEB_APPLICATION_SECURITY','Web Application Security','Cybersecurity'),
  ('SKILL_INFRASTRUCTURE_AS_CODE','Infrastructure as Code','DevOps'),
  ('SKILL_MONITORING_AND_OBSERVABILITY','Monitoring & Observability','DevOps'),
  ('SKILL_USER_RESEARCH','User Research','Design'),
  ('SKILL_ROADMAP_PRIORITIZATION','Roadmap & Prioritization','Business'),
  ('SKILL_STAKEHOLDER_MANAGEMENT','Stakeholder Management','Business'),
  ('SKILL_PROCESS_MODELING','Process Modeling','Business'),
  ('SKILL_WIREFRAMING_AND_PROTOTYPING','Wireframing & Prototyping','Design'),
  ('SKILL_VISUAL_DESIGN','Visual Design','Design'),
  ('SKILL_INTERACTION_DESIGN','Interaction Design','Design'),
  ('SKILL_DESIGN_SYSTEMS','Design Systems','Design'),
  ('SKILL_USABILITY_TESTING','Usability Testing','Design'),
  ('SKILL_ACCESSIBILITY_DESIGN','Accessibility Design','Design')
)
insert into public.skills (key, name, category, status)
select v.key, v.name, v.category, 'active' from v
where not exists (select 1 from public.skills s where s.key = v.key or s.name = v.name);

insert into public.skill_categories (key, name)
select distinct category, category from public.skills where category is not null
on conflict (key) do nothing;

-- complete canonical skill sets per career (existing rows are kept untouched; only missing skills are added)
with r(career, skill, importance, target) as (values
  -- Data Analyst
  ('data-analyst','SQL','CRITICAL',80),('data-analyst','PYTHON','MEDIUM',60),('data-analyst','SPREADSHEETS','HIGH',75),
  ('data-analyst','SPREADSHEET_FORMULAS_AND_FUNCTIONS','HIGH',70),('data-analyst','DATA_CLEANING','HIGH',70),
  ('data-analyst','DATA_ANALYSIS','CRITICAL',80),('data-analyst','STATISTICS','HIGH',70),('data-analyst','DATA_VISUALIZATION','HIGH',70),
  ('data-analyst','POWER_BI','HIGH',65),('data-analyst','BI_DASHBOARDING','HIGH',75),('data-analyst','DASHBOARD_DESIGN','MEDIUM',60),
  ('data-analyst','PROBLEM_SOLVING','HIGH',75),('data-analyst','BUSINESS_ANALYSIS','MEDIUM',65),
  ('data-analyst','TECHNICAL_COMMUNICATION','MEDIUM',60),('data-analyst','DATA_STORYTELLING','MEDIUM',60),
  -- Software Engineer
  ('software-engineer','PROGRAMMING_FUNDAMENTALS','CRITICAL',85),('software-engineer','OOP','HIGH',70),('software-engineer','DATA_STRUCTURES','CRITICAL',80),
  ('software-engineer','ALGORITHMS','CRITICAL',75),('software-engineer','VERSION_CONTROL','HIGH',70),
  ('software-engineer','ERROR_HANDLING_AND_DEBUGGING','HIGH',70),('software-engineer','SOFTWARE_TESTING','MEDIUM',55),
  ('software-engineer','API_DESIGN','HIGH',65),('software-engineer','DBMS','MEDIUM',55),
  ('software-engineer','OBJECT_ORIENTED_DESIGN_PATTERNS','MEDIUM',55),('software-engineer','SOFTWARE_ARCHITECTURE','MEDIUM',55),
  ('software-engineer','OPERATING_SYSTEMS','LOW',50),('software-engineer','COMPUTER_NETWORKS','LOW',45),
  ('software-engineer','CLOUD_COMPUTING','LOW',40),('software-engineer','INFORMATION_SECURITY','LOW',45),
  ('software-engineer','SYSTEM_DESIGN','MEDIUM',55),('software-engineer','TECHNICAL_COMMUNICATION','MEDIUM',60),
  ('software-engineer','PROBLEM_SOLVING','HIGH',75),('software-engineer','SOFTWARE_ENGINEERING','HIGH',65),
  -- AI/ML Engineer
  ('ai-ml-engineer','NEURAL_NETWORK_FUNDAMENTALS','HIGH',70),('ai-ml-engineer','MODEL_EVALUATION_AND_METRICS','HIGH',70),
  ('ai-ml-engineer','FEATURE_ENGINEERING','MEDIUM',60),('ai-ml-engineer','OVERFITTING_AND_REGULARIZATION','MEDIUM',60),
  ('ai-ml-engineer','DATA_WRANGLING_WITH_PANDAS','MEDIUM',60),('ai-ml-engineer','MODEL_DEPLOYMENT_BASICS','MEDIUM',55),
  ('ai-ml-engineer','TRANSFORMERS_AND_ATTENTION','LOW',55),('ai-ml-engineer','OPTIMIZATION_AND_GRADIENT_DESCENT','LOW',55),
  -- Cybersecurity Analyst
  ('cybersecurity-analyst','THREAT_DETECTION','CRITICAL',70),('cybersecurity-analyst','VULNERABILITY_ASSESSMENT','HIGH',65),
  ('cybersecurity-analyst','WEB_APPLICATION_SECURITY','HIGH',65),('cybersecurity-analyst','AUTHENTICATION_AND_AUTHORIZATION','HIGH',60),
  ('cybersecurity-analyst','COMMAND_LINE_BASICS','MEDIUM',55),('cybersecurity-analyst','HTTP_FUNDAMENTALS','MEDIUM',55),
  ('cybersecurity-analyst','TECHNICAL_COMMUNICATION','MEDIUM',55),('cybersecurity-analyst','PROBLEM_SOLVING','MEDIUM',60),
  -- Cloud Engineer
  ('cloud-engineer','INFRASTRUCTURE_AS_CODE','HIGH',65),('cloud-engineer','MONITORING_AND_OBSERVABILITY','MEDIUM',60),
  ('cloud-engineer','COMMAND_LINE_BASICS','MEDIUM',60),('cloud-engineer','HTTP_FUNDAMENTALS','LOW',45),
  ('cloud-engineer','DBMS','LOW',40),('cloud-engineer','PROBLEM_SOLVING','MEDIUM',60),
  -- Data Scientist
  ('data-scientist','HYPOTHESIS_TESTING','HIGH',70),('data-scientist','MODEL_EVALUATION_AND_METRICS','HIGH',70),
  ('data-scientist','FEATURE_ENGINEERING','HIGH',65),('data-scientist','EXPLORATORY_DATA_ANALYSIS','HIGH',70),
  ('data-scientist','DATA_VISUALIZATION','MEDIUM',60),('data-scientist','DATA_WRANGLING_WITH_PANDAS','MEDIUM',65),
  ('data-scientist','DATA_STORYTELLING','MEDIUM',60),
  -- Full Stack Developer
  ('full-stack-developer','HTML_CSS','HIGH',70),('full-stack-developer','FRONTEND_FRAMEWORKS','HIGH',70),
  ('full-stack-developer','BACKEND_DEVELOPMENT','HIGH',70),('full-stack-developer','AUTHENTICATION_AND_AUTHORIZATION','MEDIUM',60),
  ('full-stack-developer','PROGRAMMING_FUNDAMENTALS','HIGH',70),('full-stack-developer','ERROR_HANDLING_AND_DEBUGGING','MEDIUM',60),
  ('full-stack-developer','HTTP_FUNDAMENTALS','MEDIUM',55),
  -- Product Manager
  ('product-manager','USER_RESEARCH','HIGH',70),('product-manager','ROADMAP_PRIORITIZATION','HIGH',70),
  ('product-manager','STAKEHOLDER_MANAGEMENT','HIGH',70),('product-manager','KPI_AND_METRIC_DEFINITION','HIGH',65),
  ('product-manager','A_B_TEST_ANALYSIS','MEDIUM',55),('product-manager','REQUIREMENTS_AND_USER_STORIES','HIGH',65),
  ('product-manager','AGILE_DELIVERY','MEDIUM',60),('product-manager','PROBLEM_SOLVING','MEDIUM',65),
  -- Business Analyst
  ('business-analyst','BUSINESS_ANALYSIS','CRITICAL',80),('business-analyst','REQUIREMENTS_AND_USER_STORIES','CRITICAL',80),
  ('business-analyst','PROCESS_MODELING','HIGH',70),('business-analyst','STAKEHOLDER_MANAGEMENT','HIGH',70),
  ('business-analyst','KPI_AND_METRIC_DEFINITION','HIGH',65),('business-analyst','SPREADSHEETS','MEDIUM',65),
  ('business-analyst','DATA_STORYTELLING','MEDIUM',60),('business-analyst','DATA_VISUALIZATION','MEDIUM',60),
  ('business-analyst','AGILE_DELIVERY','MEDIUM',55),
  -- Product Designer
  ('product-designer','UI_UX_DESIGN','CRITICAL',80),('product-designer','USER_RESEARCH','CRITICAL',75),
  ('product-designer','WIREFRAMING_AND_PROTOTYPING','HIGH',75),('product-designer','VISUAL_DESIGN','HIGH',75),
  ('product-designer','INTERACTION_DESIGN','HIGH',70),('product-designer','DESIGN_SYSTEMS','MEDIUM',65),
  ('product-designer','USABILITY_TESTING','HIGH',70),('product-designer','ACCESSIBILITY_DESIGN','MEDIUM',60),
  ('product-designer','TEAMWORK','MEDIUM',55)
)
insert into public.career_skill_requirements (career_id, skill_id, importance, target_level, required_by_stage)
select c.id, s.id, r.importance, r.target,
       case r.importance when 'CRITICAL' then 'FOUNDATION' when 'HIGH' then 'INTERMEDIATE' else 'JOB_READY' end
from r
join public.careers c on c.key = r.career
join public.skills s on s.key = 'SKILL_' || r.skill
on conflict (career_id, skill_id) do nothing;

-- weights and per-skill question ranges follow importance (tunable per row afterwards)
update public.career_skill_requirements set
  assessment_weight = case importance when 'CRITICAL' then 4 when 'HIGH' then 3 when 'MEDIUM' then 2 else 1 end,
  min_questions = case importance when 'CRITICAL' then 2 when 'LOW' then 0 else 1 end,
  max_questions = case importance when 'CRITICAL' then 4 when 'HIGH' then 3 when 'MEDIUM' then 2 else 1 end;

-- ---------------------------------------------------------------------------------------------------------------------
-- onboarding gate
-- ---------------------------------------------------------------------------------------------------------------------
create table public.student_onboarding (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'ASSESSMENT_REQUIRED'
    check (status in ('ASSESSMENT_REQUIRED','GENERAL_ASSESSMENT_COMPLETE','CAREER_ASSESSMENT_COMPLETE','PROFILE_READY','ACTIVE')),
  updated_at timestamptz not null default now()
);
alter table public.student_onboarding enable row level security;
create policy "own onboarding" on public.student_onboarding for select using (student_id = auth.uid());

-- Existing students who already finished the legacy assessment keep their dashboard (grandfathered, not locked out of data
-- they already have); everyone else must complete the new flow.
insert into public.student_onboarding (student_id, status)
select p.id, case when exists (select 1 from public.assessment_attempts a where a.user_id = p.id and a.status = 'completed')
                  then 'ACTIVE' else 'ASSESSMENT_REQUIRED' end
from public.profiles p where p.primary_role = 'student'
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------------------------
-- question pool (Groq-generated only; answer key lives here, never exposed to clients)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.assess_question_pool (
  id uuid primary key default gen_random_uuid(),
  layer text not null check (layer in ('GENERAL','CAREER')),
  section text,
  career_id uuid references public.careers(id),
  skill_id uuid references public.skills(id),
  skill_name text not null,
  category text,
  difficulty text not null check (difficulty in ('EASY','MEDIUM','HARD')),
  question_type text not null,
  question_text text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_index smallint not null check (correct_index >= 0),
  explanation text not null,
  estimated_seconds int not null default 60,
  source text not null default 'groq' check (source = 'groq'),
  model text not null,
  version int not null default 1,
  content_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((layer = 'CAREER' and career_id is not null and skill_id is not null) or (layer = 'GENERAL' and section is not null))
);
create index assess_pool_career_idx on public.assess_question_pool (career_id, skill_id, difficulty) where is_active and layer = 'CAREER';
create index assess_pool_general_idx on public.assess_question_pool (section, difficulty) where is_active and layer = 'GENERAL';
alter table public.assess_question_pool enable row level security;   -- no policies: service role only
revoke all on public.assess_question_pool from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- sessions, served questions, responses (both layers)
-- ---------------------------------------------------------------------------------------------------------------------
create table public.assess_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  layer text not null check (layer in ('GENERAL','CAREER')),
  career_id uuid references public.careers(id),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED')),
  total_questions smallint not null check (total_questions > 0),
  starting_elo int,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb,
  check ((layer = 'CAREER') = (career_id is not null))
);
-- one open session per student, layer and career: start is idempotent and a refresh resumes it
create unique index assess_sessions_one_open on public.assess_sessions
  (student_id, layer, coalesce(career_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'IN_PROGRESS';
create index assess_sessions_student_idx on public.assess_sessions (student_id, layer, started_at desc);
alter table public.assess_sessions enable row level security;
create policy "own assess sessions" on public.assess_sessions for select using (student_id = auth.uid());

-- QUEUED rows are the prefetch buffer (chosen ahead, never sent to the client); SERVED rows have been handed out.
create table public.assess_session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assess_sessions(id) on delete cascade,
  position smallint not null check (position >= 1),
  pool_question_id uuid not null references public.assess_question_pool(id),
  option_order smallint[] not null,            -- persisted shuffle: displayed slot i shows original option option_order[i]
  state text not null default 'QUEUED' check (state in ('QUEUED','SERVED')),
  created_at timestamptz not null default now(),
  served_at timestamptz,
  unique (session_id, position),
  unique (session_id, pool_question_id)
);
alter table public.assess_session_questions enable row level security;
revoke all on public.assess_session_questions from anon, authenticated;

create table public.assess_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assess_sessions(id) on delete cascade,
  session_question_id uuid not null unique references public.assess_session_questions(id) on delete cascade,  -- one answer per question: finality
  attempt_id uuid not null,
  chosen_index smallint not null,              -- ORIGINAL option index (before the per-attempt shuffle)
  is_correct boolean not null,
  response_ms int,
  answered_at timestamptz not null default now(),
  elo_event_id uuid
);
alter table public.assess_responses enable row level security;
revoke all on public.assess_responses from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- ELO: one rating per student and role, an append-only ledger, configurable rules
-- ---------------------------------------------------------------------------------------------------------------------
create table public.elo_rules (
  source text primary key,
  correct_delta int not null,
  incorrect_delta int not null,
  difficulty_multiplier numeric not null default 1.0,
  performance_multiplier numeric not null default 1.0,
  min_rating int not null default 0
);
alter table public.elo_rules enable row level security;
create policy "elo rules readable" on public.elo_rules for select using (true);
-- Assessment scoring is exactly +4 / -2. The multipliers are 1.0 until Arena needs richer rules.
insert into public.elo_rules (source, correct_delta, incorrect_delta) values ('ASSESSMENT', 4, -2), ('ARENA', 4, -2);

create table public.student_career_elo (
  student_id uuid not null references public.profiles(id) on delete cascade,
  career_id uuid not null references public.careers(id),
  rating int not null default 400 check (rating >= 0),
  updated_at timestamptz not null default now(),
  primary key (student_id, career_id)
);
alter table public.student_career_elo enable row level security;
create policy "own elo" on public.student_career_elo for select using (student_id = auth.uid());

create table public.elo_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  career_id uuid not null references public.careers(id),
  source text not null references public.elo_rules(source),
  source_id uuid not null,
  previous_rating int not null,
  change int not null,
  new_rating int not null,
  reason text,
  created_at timestamptz not null default now(),
  check (new_rating = previous_rating + change),
  unique (source, source_id)                   -- the same answer/attempt can never move the rating twice
);
create index elo_events_student_idx on public.elo_events (student_id, career_id, created_at);
alter table public.elo_events enable row level security;
create policy "own elo events" on public.elo_events for select using (student_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------------------
-- skill graph: evidence in, scores out, snapshots append-only
-- ---------------------------------------------------------------------------------------------------------------------
create table public.student_skill_evidence (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  career_id uuid references public.careers(id),
  skill_id uuid references public.skills(id),
  skill_label text not null,
  source text not null check (source in ('ASSESSMENT_GENERAL','ASSESSMENT_CAREER','ARENA')),
  source_id uuid not null,
  correct boolean not null,
  difficulty text not null check (difficulty in ('EASY','MEDIUM','HARD')),
  response_ms int,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);
create index skill_evidence_student_idx on public.student_skill_evidence (student_id, skill_id);
alter table public.student_skill_evidence enable row level security;
create policy "own skill evidence" on public.student_skill_evidence for select using (student_id = auth.uid());

create table public.student_skill_scores (
  student_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  score smallint check (score between 0 and 100),
  confidence text not null check (confidence in ('HIGH','MEDIUM','LOW','INSUFFICIENT')),
  evidence_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);
alter table public.student_skill_scores enable row level security;
create policy "own skill scores" on public.student_skill_scores for select using (student_id = auth.uid());

create table public.career_skill_graph_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  career_id uuid not null references public.careers(id),
  session_id uuid references public.assess_sessions(id),
  trigger text not null check (trigger in ('ASSESSMENT','ARENA')),
  elo int not null,
  readiness smallint not null check (readiness between 0 and 100),
  skills jsonb not null,
  created_at timestamptz not null default now()
);
create index skill_snapshots_student_idx on public.career_skill_graph_snapshots (student_id, career_id, created_at);
alter table public.career_skill_graph_snapshots enable row level security;
create policy "own snapshots" on public.career_skill_graph_snapshots for select using (student_id = auth.uid());

-- history is never rewritten: snapshots and ELO events reject UPDATE/DELETE (cascade from a deleted profile is the only exit)
create function public.reject_mutation() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;   -- ON DELETE CASCADE from profiles
  raise exception '% is append-only', tg_table_name;
end $$;
create trigger snapshots_append_only before update or delete on public.career_skill_graph_snapshots
  for each row execute function public.reject_mutation();
create trigger elo_events_append_only before update or delete on public.elo_events
  for each row execute function public.reject_mutation();

-- ---------------------------------------------------------------------------------------------------------------------
-- product analytics
-- ---------------------------------------------------------------------------------------------------------------------
create table public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index product_events_name_idx on public.product_events (name, created_at);
alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- the ELO engine: the only place a rating changes
-- ---------------------------------------------------------------------------------------------------------------------
create function public.apply_elo_event(
  p_student uuid, p_career uuid, p_source text, p_source_id uuid, p_correct boolean, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rule public.elo_rules%rowtype;
  v_prev int; v_new int; v_change int; v_event public.elo_events%rowtype;
begin
  select * into v_rule from public.elo_rules where source = p_source;
  if not found then raise exception 'no elo rule for source %', p_source; end if;

  insert into public.student_career_elo (student_id, career_id) values (p_student, p_career) on conflict do nothing;
  select rating into v_prev from public.student_career_elo where student_id = p_student and career_id = p_career for update;

  -- idempotent: replaying the same source/source_id returns the original event and changes nothing
  select * into v_event from public.elo_events where source = p_source and source_id = p_source_id;
  if found then
    return jsonb_build_object('eventId', v_event.id, 'previous', v_event.previous_rating, 'change', v_event.change,
                              'newRating', v_event.new_rating, 'replayed', true);
  end if;

  v_change := round((case when p_correct then v_rule.correct_delta else v_rule.incorrect_delta end)
                    * v_rule.difficulty_multiplier * v_rule.performance_multiplier);
  v_new := greatest(v_rule.min_rating, v_prev + v_change);
  v_change := v_new - v_prev;                    -- the floor can shrink a loss; the ledger records what really happened

  insert into public.elo_events (student_id, career_id, source, source_id, previous_rating, change, new_rating, reason)
  values (p_student, p_career, p_source, p_source_id, v_prev, v_change, v_new, p_reason) returning * into v_event;
  update public.student_career_elo set rating = v_new, updated_at = now() where student_id = p_student and career_id = p_career;

  return jsonb_build_object('eventId', v_event.id, 'previous', v_prev, 'change', v_change, 'newRating', v_new, 'replayed', false);
end $$;
revoke all on function public.apply_elo_event(uuid, uuid, text, uuid, boolean, text) from public, anon, authenticated;

-- Records one answer. Server-only (called with the service role after the route authenticated the student).
-- Validates ownership and that the question was actually served, enforces one answer per question, computes correctness,
-- writes the evidence row and (career layer) the ELO event — all in one transaction.
create function public.record_assessment_answer(
  p_student uuid, p_session_question uuid, p_attempt uuid, p_displayed_index int, p_response_ms int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sq public.assess_session_questions%rowtype;
  s public.assess_sessions%rowtype;
  q public.assess_question_pool%rowtype;
  v_resp public.assess_responses%rowtype;
  v_original int; v_correct boolean; v_elo jsonb; v_correct_displayed int;
begin
  select * into sq from public.assess_session_questions where id = p_session_question for update;
  if not found then raise exception 'question_not_found'; end if;
  select * into s from public.assess_sessions where id = sq.session_id;
  if s.student_id <> p_student then raise exception 'question_not_found'; end if;   -- never reveal that it exists
  select * into q from public.assess_question_pool where id = sq.pool_question_id;
  v_correct_displayed := array_position(sq.option_order, q.correct_index::smallint) - 1;

  select * into v_resp from public.assess_responses where session_question_id = sq.id;
  if found then   -- finality: a second submission changes nothing and just echoes the first
    select jsonb_build_object('eventId', e.id, 'previous', e.previous_rating, 'change', e.change, 'newRating', e.new_rating)
      into v_elo from public.elo_events e where e.id = v_resp.elo_event_id;
    return jsonb_build_object(
      'alreadyAnswered', true, 'isCorrect', v_resp.is_correct,
      'chosenIndex', array_position(sq.option_order, v_resp.chosen_index::smallint) - 1,
      'correctIndex', v_correct_displayed, 'explanation', q.explanation, 'elo', v_elo);
  end if;

  if s.status <> 'IN_PROGRESS' then raise exception 'session_closed'; end if;
  if sq.state <> 'SERVED' then raise exception 'question_not_served'; end if;
  if p_displayed_index is null or p_displayed_index < 0 or p_displayed_index >= array_length(sq.option_order, 1) then
    raise exception 'invalid_option';
  end if;

  v_original := sq.option_order[p_displayed_index + 1];
  v_correct := (v_original = q.correct_index);

  insert into public.assess_responses (session_id, session_question_id, attempt_id, chosen_index, is_correct, response_ms)
  values (s.id, sq.id, p_attempt, v_original, v_correct, p_response_ms) returning * into v_resp;

  insert into public.student_skill_evidence (student_id, career_id, skill_id, skill_label, source, source_id, correct, difficulty, response_ms)
  values (p_student, s.career_id, q.skill_id, q.skill_name,
          case when s.layer = 'CAREER' then 'ASSESSMENT_CAREER' else 'ASSESSMENT_GENERAL' end, v_resp.id, v_correct, q.difficulty, p_response_ms);

  if s.layer = 'CAREER' then
    v_elo := public.apply_elo_event(p_student, s.career_id, 'ASSESSMENT', v_resp.id, v_correct, 'career assessment answer');
    update public.assess_responses set elo_event_id = (v_elo->>'eventId')::uuid where id = v_resp.id;
  end if;

  return jsonb_build_object('alreadyAnswered', false, 'isCorrect', v_correct, 'chosenIndex', p_displayed_index,
                            'correctIndex', v_correct_displayed, 'explanation', q.explanation, 'elo', v_elo);
end $$;
revoke all on function public.record_assessment_answer(uuid, uuid, uuid, int, int) from public, anon, authenticated;
