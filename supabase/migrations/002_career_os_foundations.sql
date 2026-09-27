-- Career OS foundations: Journey Engine, Capability Graph extensions, Plan B,
-- Project/Team, Evidence, Mentor Evaluation, Skills catalog, Opportunities.
--
-- Purely additive. Nothing here alters an existing table's columns, types,
-- or constraints, and nothing here is destructive. Every new table that
-- belongs to a student is tenant-scoped through institution_memberships
-- (directly or via a join), per docs/architecture/06-security.md.
--
-- STATUS: APPLIED to production 2026-09-27 (via Supabase MCP apply_migration,
-- after explicit approval). This file is kept identical to what was run —
-- see docs/platform-evolution/07-execution-log.md.

-- ============================================================================
-- 1. Institutional hierarchy: College (institutions, existing) -> Program ->
--    Department -> Cohort. institution_memberships gets an additive,
--    nullable cohort_id so existing rows (branch/year free text) keep
--    working unchanged while new enrollments can link a real cohort.
--    See 01-domain-model.md and §4 of the brief (multi-tenant college model).
-- ============================================================================

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, name)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, name)
);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  -- "<year>-<semester>", matching institution_memberships.year's existing format.
  entry_year_semester text not null,
  graduation_year_semester text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, name)
);

alter table public.institution_memberships
  add column if not exists cohort_id uuid references public.cohorts(id) on delete set null;

create index if not exists idx_programs_institution on public.programs(institution_id);
create index if not exists idx_departments_program on public.departments(program_id);
create index if not exists idx_cohorts_department on public.cohorts(department_id);
create index if not exists idx_institution_memberships_cohort on public.institution_memberships(cohort_id);

alter table public.programs enable row level security;
alter table public.departments enable row level security;
alter table public.cohorts enable row level security;

-- Any authenticated member of the institution can read its own hierarchy;
-- writes are service-role only (college admin surface goes through a
-- server action, not direct client writes) until a COLLEGE_ADMIN policy
-- is written in a later phase.
create policy programs_read_own_institution on public.programs
  for select using (
    institution_id in (
      select institution_id from public.institution_memberships where user_id = auth.uid()
    )
  );

create policy departments_read_own_institution on public.departments
  for select using (
    program_id in (
      select p.id from public.programs p
      join public.institution_memberships im on im.institution_id = p.institution_id
      where im.user_id = auth.uid()
    )
  );

create policy cohorts_read_own_institution on public.cohorts
  for select using (
    department_id in (
      select d.id from public.departments d
      join public.programs p on p.id = d.program_id
      join public.institution_memberships im on im.institution_id = p.institution_id
      where im.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 2. Skills catalog. Skill names are free text today (capabilities.skill,
--    career_requirements.requirements keys, question_bank.skill) — this adds
--    a reference table without touching any of those columns. Backfilled
--    from existing distinct skill names below; not yet a foreign key from
--    capabilities/career_requirements (phase-2, see 08-roadmap.md).
-- ============================================================================

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  domain text,
  created_at timestamptz not null default now()
);

insert into public.skills (name, domain)
select distinct c.skill, c.domain
from public.capabilities c
on conflict (name) do nothing;

alter table public.skills enable row level security;
create policy skills_read_all on public.skills for select using (true);

-- ============================================================================
-- 3. Journey Engine: templates are configuration, not code. A null
--    institution_id means a platform-default template every college can use
--    as-is or override. student_journeys tracks the Capability and Career
--    axes independently of each other and of academic year — see
--    02-journey-engine.md. student_journey_events is the append-only trail
--    that Next Best Action and analytics read from (§22 of the brief).
-- ============================================================================

create type public.journey_axis as enum ('capability', 'career');

create table if not exists public.journey_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  name text not null,
  entry_semester text not null,
  -- { capabilityPhases: [...], careerPhases: [...], compressed: bool, ... }
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journey_phases (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.journey_templates(id) on delete cascade,
  axis public.journey_axis not null,
  key text not null,
  label text not null,
  sequence integer not null,
  created_at timestamptz not null default now(),
  unique (template_id, axis, key)
);

create table if not exists public.student_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.journey_templates(id),
  current_capability_phase text not null,
  current_career_phase text not null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.student_journey_events (
  id uuid primary key default gen_random_uuid(),
  student_journey_id uuid not null references public.student_journeys(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_journey_phases_template on public.journey_phases(template_id);
create index if not exists idx_student_journeys_user on public.student_journeys(user_id);
create index if not exists idx_student_journey_events_journey on public.student_journey_events(student_journey_id, created_at desc);

alter table public.journey_templates enable row level security;
alter table public.journey_phases enable row level security;
alter table public.student_journeys enable row level security;
alter table public.student_journey_events enable row level security;

create policy journey_templates_read_all on public.journey_templates for select using (true);
create policy journey_phases_read_all on public.journey_phases for select using (true);

create policy student_journeys_self on public.student_journeys
  for select using (user_id = auth.uid());
create policy student_journey_events_self on public.student_journey_events
  for select using (
    student_journey_id in (select id from public.student_journeys where user_id = auth.uid())
  );

-- ============================================================================
-- 4. Plan B as a first-class entity (§10), not a text field.
-- ============================================================================

create table if not exists public.plan_b_explorations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_input text not null,
  extracted_interests jsonb not null default '[]'::jsonb,
  career_concepts jsonb not null default '[]'::jsonb,
  skill_gaps jsonb not null default '[]'::jsonb,
  status text not null default 'exploring' check (status in ('exploring', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plan_b_user on public.plan_b_explorations(user_id);
alter table public.plan_b_explorations enable row level security;
create policy plan_b_self on public.plan_b_explorations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- 5. Project Lab (§12): team and individual evidence are kept separate —
--    project_contributions is per-student, never aggregated silently into
--    a team-wide capability claim.
-- ============================================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  mentor_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_at date,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists public.project_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_id uuid references public.project_milestones(id) on delete set null,
  description text not null,
  evaluated_score numeric,
  evaluator_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_project_milestones_project on public.project_milestones(project_id);
create index if not exists idx_project_contributions_user on public.project_contributions(user_id);
create index if not exists idx_project_contributions_project on public.project_contributions(project_id);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_contributions enable row level security;

create policy projects_member_read on public.projects
  for select using (
    id in (select project_id from public.project_members where user_id = auth.uid())
    or mentor_id = auth.uid()
  );
create policy project_members_self_read on public.project_members
  for select using (
    project_id in (select project_id from public.project_members where user_id = auth.uid())
  );
create policy project_milestones_member_read on public.project_milestones
  for select using (
    project_id in (select project_id from public.project_members where user_id = auth.uid())
  );
create policy project_contributions_self_read on public.project_contributions
  for select using (
    user_id = auth.uid()
    or project_id in (
      select id from public.projects where mentor_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. Evidence (§15) and Mentor Evaluation. capability_history already IS the
--    CapabilitySnapshot ledger (skill, score, confidence, source, recorded_at)
--    — this does not duplicate it. `evidence` adds the missing link from a
--    capability_history-style snapshot to the *specific* source record
--    (which project, which arena attempt, which mentor evaluation), which
--    capability_history's source enum alone can't express.
-- ============================================================================

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null,
  source_type public.capability_evidence_source not null,
  source_id uuid,
  confidence public.capability_confidence not null default 'low',
  capability_delta numeric,
  evaluated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mentor_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  skill text,
  score numeric,
  feedback text,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_user on public.evidence(user_id, skill);
create index if not exists idx_mentor_evaluations_user on public.mentor_evaluations(user_id);

alter table public.evidence enable row level security;
alter table public.mentor_evaluations enable row level security;

create policy evidence_self_read on public.evidence for select using (user_id = auth.uid());
create policy mentor_evaluations_self_read on public.mentor_evaluations
  for select using (user_id = auth.uid() or mentor_id = auth.uid());

-- ============================================================================
-- 7. Opportunities (Launchpad) and a minimal recruiter/application pair —
--    replaces lib/mock/launchpad.ts once a college/admin surface exists to
--    author real listings. First pass only; recruiter search (§24) is a
--    later phase, not built here.
-- ============================================================================

create table if not exists public.recruiters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete set null,
  recruiter_id uuid references public.recruiters(id) on delete set null,
  role text not null,
  company text not null,
  location text,
  opportunity_type text not null check (opportunity_type in ('job', 'internship', 'competition', 'referral')),
  skills jsonb not null default '[]'::jsonb,
  eligibility text,
  deadline date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'shortlisted', 'rejected', 'accepted')),
  applied_at timestamptz not null default now(),
  unique (opportunity_id, user_id)
);

create index if not exists idx_opportunities_institution on public.opportunities(institution_id);
create index if not exists idx_applications_user on public.applications(user_id);

alter table public.recruiters enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications enable row level security;

create policy opportunities_read_all on public.opportunities for select using (true);
create policy applications_self on public.applications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- 8. updated_at triggers for the tables above that carry one, reusing the
--    same set_updated_at() convention if it already exists in this project;
--    created defensively in case it doesn't.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'programs', 'departments', 'cohorts', 'journey_templates',
    'student_journeys', 'plan_b_explorations', 'projects'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;
