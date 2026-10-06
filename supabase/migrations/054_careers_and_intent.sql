-- Phase 5: careers with canonical skill requirements, the student's career intent (primary + Plan B), AI career suggestions awaiting a person,
-- and the student's regulation (so a roadmap can use the right curriculum). docs/curriculum-roadmap-v2-progress.md, decisions 2 and 5.
--
-- ADDITIVE. The legacy `career_requirements` (free-text skill names -> score, read by Career Path / Skill Gap) is NOT touched; it keeps serving them.
-- Authority: careers and their requirements are a world-readable catalog written only by the service role / operators (decision 4: no admin UI yet).
-- A student's intent and suggestions are readable by that student only and written only by the server after it has validated them.

-- Same normalisation the TypeScript resolver uses (lib/skills/normalize.ts) for the characters that matter here.
create function public.normalize_skill_text(p_text text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9+# ]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

create table public.careers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]{2,60}$'),
  name text not null unique check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 600),
  category text check (category is null or char_length(category) <= 80),
  is_active boolean not null default true,
  /** the career_requirements.career_role this career supersedes, if any */
  legacy_role text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.careers for each row execute function public.set_updated_at();

create table public.career_skill_requirements (
  career_id uuid not null references public.careers(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  importance text not null check (importance in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  target_level smallint not null check (target_level between 0 and 100),
  required_by_stage text not null default 'JOB_READY' check (required_by_stage in ('FOUNDATION', 'INTERMEDIATE', 'JOB_READY')),
  created_at timestamptz not null default now(),
  primary key (career_id, skill_id)
);
create index career_skill_requirements_by_skill on public.career_skill_requirements (skill_id);

-- A requirement can only name a reviewed (active) skill — never an unreviewed candidate.
create function public.guard_requirement_skill_active() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.skills where id = new.skill_id and status = 'active') then
    raise exception 'A career can only require an active skill from the catalog.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guard_active_skill before insert or update on public.career_skill_requirements for each row execute function public.guard_requirement_skill_active();

create table public.student_career_intent (
  student_id uuid primary key references auth.users(id) on delete cascade,
  primary_career_id uuid references public.careers(id) on delete set null,
  secondary_career_id uuid references public.careers(id) on delete set null,
  career_goal_text text check (career_goal_text is null or char_length(career_goal_text) <= 500),
  career_goal_confidence numeric(3, 2) check (career_goal_confidence is null or career_goal_confidence between 0 and 1),
  is_exploring boolean not null default false,
  last_updated timestamptz not null default now(),
  check (primary_career_id is null or primary_career_id is distinct from secondary_career_id)
);

-- What the AI thinks a free-text goal means. A SUGGESTION: it never changes the intent until the student accepts it.
create table public.career_suggestions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  source_text text not null check (char_length(btrim(source_text)) between 3 and 500),
  suggested_career_ids uuid[] not null default '{}',
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'DISMISSED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index career_suggestions_by_student on public.career_suggestions (student_id, status, created_at desc);

alter table public.institution_memberships add column regulation text check (regulation is null or char_length(btrim(regulation)) between 1 and 80);

alter table public.careers enable row level security;
alter table public.career_skill_requirements enable row level security;
alter table public.student_career_intent enable row level security;
alter table public.career_suggestions enable row level security;
create policy careers_read_all on public.careers for select using (true);
create policy career_requirements_read_all on public.career_skill_requirements for select using (true);
create policy student_intent_read_own on public.student_career_intent for select using (student_id = auth.uid());
create policy career_suggestions_read_own on public.career_suggestions for select using (student_id = auth.uid());
revoke insert, update, delete, truncate on public.careers, public.career_skill_requirements, public.student_career_intent, public.career_suggestions from anon, authenticated;

-- A few aliases the legacy requirement names need.
insert into public.skill_aliases (alias, skill_id)
select a.alias, s.id from (values ('programming', 'SKILL_PROGRAMMING_FUNDAMENTALS'), ('visualization', 'SKILL_BI_DASHBOARDING'), ('visualisation', 'SKILL_BI_DASHBOARDING')) a(alias, skill_key)
join public.skills s on s.key = a.skill_key
on conflict (alias) do nothing;

-- Starter careers. PRODUCT-TEAM REVIEW: names, requirements, importance and target levels are editable starter data, not facts about any student.
insert into public.careers (key, name, description, category, legacy_role) values
  ('data-analyst', 'Data Analyst', 'Turns data into answers for decisions: querying, cleaning, analysing and presenting.', 'Data', 'Data Analyst'),
  ('data-scientist', 'Data Scientist', 'Builds statistical and machine-learning models to find patterns and predict outcomes.', 'Data', null),
  ('software-engineer', 'Software Engineer', 'Designs, builds, tests and maintains software.', 'Software', 'Software Engineer'),
  ('full-stack-developer', 'Full Stack Developer', 'Builds both the user-facing and server sides of web applications.', 'Software', null),
  ('ai-ml-engineer', 'AI/ML Engineer', 'Trains, evaluates and ships machine-learning systems.', 'AI/ML', 'Machine Learning Engineer'),
  ('cybersecurity-analyst', 'Cybersecurity Analyst', 'Protects systems and networks: monitoring, defending and responding to threats.', 'Security', null),
  ('cloud-engineer', 'Cloud Engineer', 'Designs, deploys and operates systems on cloud platforms.', 'Cloud', null),
  ('product-manager', 'Product Manager', 'Decides what to build and why, and steers it from idea to launch.', 'Business', null),
  ('business-analyst', 'Business Analyst', 'Bridges business needs and technical teams using data and requirements.', 'Business', 'Business Analyst'),
  ('product-designer', 'Product Designer', 'Designs usable, well-communicated product experiences.', 'Design', 'Product Designer')
on conflict (key) do nothing;

-- Requirements for the eight seeded careers (the two legacy-only careers are backfilled from their stored numbers below).
-- Stage: foundations first, then intermediate, then job-ready skills.
with req(career_key, skill_key, importance, target) as (values
  ('data-analyst','SKILL_SQL','CRITICAL',80),('data-analyst','SKILL_DATA_ANALYSIS','CRITICAL',80),('data-analyst','SKILL_SPREADSHEETS','HIGH',75),('data-analyst','SKILL_BI_DASHBOARDING','HIGH',75),
  ('data-analyst','SKILL_STATISTICS','HIGH',70),('data-analyst','SKILL_DATA_CLEANING','HIGH',70),('data-analyst','SKILL_PYTHON','MEDIUM',60),('data-analyst','SKILL_TECHNICAL_COMMUNICATION','MEDIUM',60),
  ('data-scientist','SKILL_PYTHON','CRITICAL',80),('data-scientist','SKILL_STATISTICS','CRITICAL',80),('data-scientist','SKILL_MACHINE_LEARNING','CRITICAL',75),('data-scientist','SKILL_DATA_ANALYSIS','HIGH',75),
  ('data-scientist','SKILL_SQL','HIGH',65),('data-scientist','SKILL_DATA_CLEANING','HIGH',65),('data-scientist','SKILL_PROBABILITY','MEDIUM',65),('data-scientist','SKILL_LINEAR_ALGEBRA','MEDIUM',60),('data-scientist','SKILL_DEEP_LEARNING','LOW',50),
  ('software-engineer','SKILL_PROGRAMMING_FUNDAMENTALS','CRITICAL',85),('software-engineer','SKILL_DATA_STRUCTURES','CRITICAL',80),('software-engineer','SKILL_ALGORITHMS','CRITICAL',75),('software-engineer','SKILL_OOP','HIGH',70),
  ('software-engineer','SKILL_SOFTWARE_ENGINEERING','HIGH',65),('software-engineer','SKILL_VERSION_CONTROL','HIGH',70),('software-engineer','SKILL_PROBLEM_SOLVING','HIGH',75),('software-engineer','SKILL_SOFTWARE_TESTING','MEDIUM',55),
  ('software-engineer','SKILL_DBMS','MEDIUM',55),('software-engineer','SKILL_OPERATING_SYSTEMS','LOW',50),('software-engineer','SKILL_COMPUTER_NETWORKS','LOW',45),
  ('full-stack-developer','SKILL_JAVASCRIPT','CRITICAL',80),('full-stack-developer','SKILL_WEB_DEVELOPMENT','CRITICAL',80),('full-stack-developer','SKILL_API_DESIGN','HIGH',70),('full-stack-developer','SKILL_DBMS','HIGH',65),
  ('full-stack-developer','SKILL_SQL','HIGH',60),('full-stack-developer','SKILL_VERSION_CONTROL','HIGH',70),('full-stack-developer','SKILL_SOFTWARE_TESTING','MEDIUM',55),('full-stack-developer','SKILL_DATA_STRUCTURES','MEDIUM',60),
  ('full-stack-developer','SKILL_CICD','LOW',45),('full-stack-developer','SKILL_CLOUD_COMPUTING','LOW',45),
  ('ai-ml-engineer','SKILL_MACHINE_LEARNING','CRITICAL',85),('ai-ml-engineer','SKILL_PYTHON','CRITICAL',85),('ai-ml-engineer','SKILL_DEEP_LEARNING','HIGH',75),('ai-ml-engineer','SKILL_AI_FUNDAMENTALS','HIGH',70),
  ('ai-ml-engineer','SKILL_LINEAR_ALGEBRA','HIGH',70),('ai-ml-engineer','SKILL_PROBABILITY','HIGH',65),('ai-ml-engineer','SKILL_STATISTICS','HIGH',65),('ai-ml-engineer','SKILL_ALGORITHMS','MEDIUM',60),
  ('ai-ml-engineer','SKILL_NLP','MEDIUM',55),('ai-ml-engineer','SKILL_SOFTWARE_ENGINEERING','MEDIUM',50),
  ('cybersecurity-analyst','SKILL_INFORMATION_SECURITY','CRITICAL',80),('cybersecurity-analyst','SKILL_NETWORK_SECURITY','CRITICAL',75),('cybersecurity-analyst','SKILL_COMPUTER_NETWORKS','HIGH',70),
  ('cybersecurity-analyst','SKILL_CRYPTOGRAPHY','HIGH',65),('cybersecurity-analyst','SKILL_OPERATING_SYSTEMS','HIGH',65),('cybersecurity-analyst','SKILL_LINUX','HIGH',60),('cybersecurity-analyst','SKILL_PYTHON','MEDIUM',50),('cybersecurity-analyst','SKILL_CLOUD_COMPUTING','LOW',40),
  ('cloud-engineer','SKILL_CLOUD_COMPUTING','CRITICAL',80),('cloud-engineer','SKILL_LINUX','HIGH',70),('cloud-engineer','SKILL_CONTAINERIZATION','HIGH',70),('cloud-engineer','SKILL_CICD','HIGH',65),
  ('cloud-engineer','SKILL_COMPUTER_NETWORKS','HIGH',65),('cloud-engineer','SKILL_OPERATING_SYSTEMS','MEDIUM',55),('cloud-engineer','SKILL_PYTHON','MEDIUM',50),('cloud-engineer','SKILL_SYSTEM_DESIGN','MEDIUM',50),('cloud-engineer','SKILL_INFORMATION_SECURITY','LOW',45),
  ('product-manager','SKILL_PRODUCT_MANAGEMENT','CRITICAL',80),('product-manager','SKILL_TECHNICAL_COMMUNICATION','HIGH',75),('product-manager','SKILL_BUSINESS_ANALYSIS','HIGH',70),('product-manager','SKILL_PROJECT_MANAGEMENT','HIGH',65),
  ('product-manager','SKILL_TEAMWORK','MEDIUM',60),('product-manager','SKILL_DATA_ANALYSIS','MEDIUM',55),('product-manager','SKILL_UI_UX_DESIGN','LOW',45),('product-manager','SKILL_SYSTEM_DESIGN','LOW',35)
)
insert into public.career_skill_requirements (career_id, skill_id, importance, target_level, required_by_stage)
select c.id, s.id, r.importance, r.target,
  case when r.skill_key in ('SKILL_PROGRAMMING_FUNDAMENTALS','SKILL_DATA_STRUCTURES','SKILL_PROBABILITY','SKILL_LINEAR_ALGEBRA','SKILL_STATISTICS','SKILL_COMPUTER_NETWORKS','SKILL_OPERATING_SYSTEMS','SKILL_PROBLEM_SOLVING','SKILL_DBMS','SKILL_SQL') then 'FOUNDATION'
       when r.skill_key in ('SKILL_ALGORITHMS','SKILL_OOP','SKILL_PYTHON','SKILL_JAVASCRIPT','SKILL_WEB_DEVELOPMENT','SKILL_DATA_ANALYSIS','SKILL_DATA_CLEANING','SKILL_VERSION_CONTROL','SKILL_SOFTWARE_ENGINEERING','SKILL_LINUX','SKILL_SPREADSHEETS','SKILL_INFORMATION_SECURITY') then 'INTERMEDIATE'
       else 'JOB_READY' end
from req r join public.careers c on c.key = r.career_key join public.skills s on s.key = r.skill_key
on conflict (career_id, skill_id) do nothing;

-- Backfill from the legacy table, for the careers that only exist there. A legacy skill name resolves only by EXACT alias/name match; anything else is
-- queued for review (skill_suggestions), never guessed. The legacy score becomes the target level; importance is banded from it (>=85 critical, >=70 high, >=55 medium, else low).
with legacy as (
  select cr.career_role, public.normalize_skill_text(e.key) as norm, e.key as raw, e.value::int as score
  from public.career_requirements cr, jsonb_each_text(cr.requirements) e(key, value)
), resolved as (
  select l.*, coalesce(a.skill_id, (select s.id from public.skills s where s.status = 'active' and public.normalize_skill_text(s.name) = l.norm limit 1)) as skill_id
  from legacy l left join public.skill_aliases a on a.alias = l.norm
), inserted as (
  insert into public.career_skill_requirements (career_id, skill_id, importance, target_level)
  select c.id, r.skill_id, case when r.score >= 85 then 'CRITICAL' when r.score >= 70 then 'HIGH' when r.score >= 55 then 'MEDIUM' else 'LOW' end, least(100, greatest(0, r.score))
  from resolved r join public.careers c on c.legacy_role = r.career_role
  where r.skill_id is not null and c.key in ('business-analyst', 'product-designer')
  on conflict (career_id, skill_id) do nothing
  returning 1
)
insert into public.skill_suggestions (normalized_text, display_text, source)
select distinct r.norm, r.raw, 'career_requirement' from resolved r where r.skill_id is null and r.norm <> ''
on conflict (normalized_text) do nothing;
