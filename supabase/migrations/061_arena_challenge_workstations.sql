-- Role-aware Arena Challenges, Phase 1: data model for ticket-style challenges that run in a pluggable browser workstation.
-- docs/arena-challenges-audit.md. ADDITIVE ONLY: no existing challenge, attempt, rating, stat or leaderboard row is deleted or rewritten
-- (existing arena_challenges rows only gain new columns, back-filled below).
--
-- Authority model:
--   * Everything new is written by the server (service role) only. Students can read their OWN attempts and the non-secret columns of PUBLISHED challenges.
--   * Hidden checks, hint bodies and reference answers are never granted to anon/authenticated.
--   * AI-generated challenges are born DRAFT and cannot be PUBLISHED without a reviewer (DB constraint, not app convention).

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Who is a "Capabilio admin" (platform-wide, distinct from per-institution curriculum admins). Managed by the service role / operators.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table public.platform_admins enable row level security;
create policy platform_admins_self_read on public.platform_admins for select using (user_id = auth.uid());
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Workstation templates: what a challenge needs to run. Runtime behaviour lives in code (lib/arena-runtime), selected by runtime_type.
create table public.workstation_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  runtime_type text not null check (runtime_type in ('CODE_EDITOR_PREVIEW', 'NOTEBOOK_PYTHON', 'SQL_CONSOLE', 'TERMINAL_VM', 'SIMULATOR', 'CALCULATION_WORKSHEET', 'QUESTION_FLOW')),
  description text check (description is null or char_length(description) <= 600),
  config jsonb not null default '{}',
  tools text[] not null default '{}',
  resource_limits jsonb not null default '{}',
  startup_time_estimate_s integer check (startup_time_estimate_s is null or startup_time_estimate_s >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.workstation_templates for each row execute function public.set_updated_at();
alter table public.workstation_templates enable row level security;
create policy workstation_templates_read on public.workstation_templates for select to authenticated using (is_active);
revoke all on public.workstation_templates from anon, authenticated;
grant select (id, key, name, runtime_type, description, tools, startup_time_estimate_s, is_active) on public.workstation_templates to authenticated;

-- Kill switch + caps per runtime type, changeable without a deploy. A runtime that is not built yet ships DISABLED.
create table public.runtime_settings (
  runtime_type text primary key check (runtime_type in ('CODE_EDITOR_PREVIEW', 'NOTEBOOK_PYTHON', 'SQL_CONSOLE', 'TERMINAL_VM', 'SIMULATOR', 'CALCULATION_WORKSHEET', 'QUESTION_FLOW')),
  enabled boolean not null default false,
  max_attempts_per_student_per_day integer not null default 20 check (max_attempts_per_student_per_day >= 0),
  /** 0 = this runtime has no per-attempt cost (client-side / pure TS), so no cost cap applies */
  daily_cost_cap_cents_per_student integer not null default 0 check (daily_cost_cap_cents_per_student >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.runtime_settings enable row level security;
create policy runtime_settings_read on public.runtime_settings for select to authenticated using (true);
revoke all on public.runtime_settings from anon, authenticated;
grant select (runtime_type, enabled) on public.runtime_settings to authenticated;
insert into public.runtime_settings (runtime_type, enabled) values
  ('QUESTION_FLOW', true), ('CALCULATION_WORKSHEET', true), ('SQL_CONSOLE', true),
  ('CODE_EDITOR_PREVIEW', false), ('NOTEBOOK_PYTHON', false), ('TERMINAL_VM', false), ('SIMULATOR', false);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Extend the existing challenge table. Existing readers keep working: `active` stays, and is kept in step with `status` by the trigger below.
alter table public.arena_challenges
  add column ticket_brief text check (ticket_brief is null or char_length(ticket_brief) <= 8000),
  add column est_minutes integer check (est_minutes is null or est_minutes between 1 and 240),
  add column workstation_template_id uuid references public.workstation_templates(id),
  add column starter_assets_ref jsonb,
  /** lower-cased branch names, same normalisation as curriculum_versions.branch_key */
  add column branch_keys text[] not null default '{}',
  add column course_tags text[] not null default '{}',
  add column status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  add column source text not null default 'AI_GENERATED' check (source in ('CAPABILIO', 'COLLEGE', 'MENTOR', 'AI_GENERATED')),
  add column institution_id uuid references public.institutions(id) on delete set null,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz,
  /** pre-existing AI content that was already live before review was required; stays served, never re-labelled as reviewed */
  add column grandfathered boolean not null default false,
  add column is_seed boolean not null default false,
  /** dataset / material provenance and licence */
  add column source_notes jsonb,
  add column spec_version integer not null default 1;

-- Back-fill: what is live stays live (grandfathered), what was switched off is RETIRED, per-student generated instances are private and PUBLISHED.
update public.arena_challenges set
  status = case when user_id is not null or active then 'PUBLISHED' else 'RETIRED' end,
  grandfathered = (user_id is null and active),
  est_minutes = time_limit_minutes,
  source = case when user_id is null and track = 'domain' and kind = 'sql' and generation_provider is null then 'CAPABILIO' else 'AI_GENERATED' end;

-- The publish gate. Per-student instances (user_id set) are private to that student and are exempt.
alter table public.arena_challenges add constraint arena_challenges_ai_must_be_reviewed
  check (source <> 'AI_GENERATED' or status <> 'PUBLISHED' or user_id is not null or grandfathered or reviewed_by is not null);

create function public.arena_challenge_status_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.user_id is not null then
    new.status := 'PUBLISHED';
    return new;
  end if;
  -- only a PUBLISHED catalog challenge is served; legacy code that flips `active` directly cannot publish a DRAFT
  if new.status <> 'PUBLISHED' then
    new.active := false;
  elsif tg_op = 'INSERT' or old.status is distinct from new.status then
    new.active := true;
  end if;
  return new;
end $$;
create trigger arena_challenge_status_guard before insert or update on public.arena_challenges
  for each row execute function public.arena_challenge_status_guard();

-- Students may read only PUBLISHED catalog rows (and their own generated instances); column grants still hide answer keys.
drop policy arena_challenges_read on public.arena_challenges;
create policy arena_challenges_read on public.arena_challenges for select to authenticated
  using (user_id = auth.uid() or (user_id is null and status = 'PUBLISHED'));
grant select (ticket_brief, est_minutes, workstation_template_id, branch_keys, course_tags, status, source, is_seed) on public.arena_challenges to authenticated;

create index arena_challenges_by_status on public.arena_challenges (track, status) where user_id is null;
create index arena_challenges_branch_keys on public.arena_challenges using gin (branch_keys);

-- Challenge -> career (domain). Skills reuse arena_challenge_skills (extended below).
create table public.challenge_careers (
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  career_id uuid not null references public.careers(id) on delete cascade,
  primary key (challenge_id, career_id)
);
create index challenge_careers_by_career on public.challenge_careers (career_id);
alter table public.challenge_careers enable row level security;
create policy challenge_careers_read on public.challenge_careers for select to authenticated
  using (exists (select 1 from public.arena_challenges c where c.id = challenge_id and c.user_id is null and c.status = 'PUBLISHED'));
revoke all on public.challenge_careers from anon, authenticated;
grant select on public.challenge_careers to authenticated;

-- Explicit, spec-declared skill links (canonical taxonomy) alongside the derived AREA/TAG ones. The re-tagger must not erase them.
alter table public.arena_challenge_skills drop constraint arena_challenge_skills_source_check;
alter table public.arena_challenge_skills add constraint arena_challenge_skills_source_check check (source in ('AREA', 'TAG', 'SPEC'));
create or replace function public.tag_arena_challenge_skills(p_challenge uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare ch record;
begin
  select id, skill_area_key, skill_tags into ch from public.arena_challenges where id = p_challenge;
  if not found then return; end if;
  delete from public.arena_challenge_skills where challenge_id = p_challenge and source in ('AREA', 'TAG');
  insert into public.arena_challenge_skills (challenge_id, skill_id, source)
    select p_challenge, a.skill_id, 'AREA' from public.arena_skill_areas a
    join public.skills s on s.id = a.skill_id and s.status = 'active'
    where ch.skill_area_key is not null and a.area_key = ch.skill_area_key and a.skill_id is not null
  on conflict do nothing;
  insert into public.arena_challenge_skills (challenge_id, skill_id, source)
    select p_challenge, s.id, 'TAG' from unnest(coalesce(ch.skill_tags, '{}')) as t(tag)
    join lateral (select public.normalize_skill_text(t.tag) as n) q on true
    join public.skills s on s.status = 'active' and (
      public.normalize_skill_text(s.name) = q.n or exists (select 1 from public.skill_aliases al where al.skill_id = s.id and al.alias = q.n)
    )
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Steps (what the student sees) and checks (how it is graded). Checks are server-only: hidden expected values live in `config`.
create table public.challenge_steps (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  step_order smallint not null check (step_order >= 1),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  instruction text not null check (char_length(instruction) <= 4000),
  unique (challenge_id, step_order)
);
alter table public.challenge_steps enable row level security;
create policy challenge_steps_read on public.challenge_steps for select to authenticated
  using (exists (select 1 from public.arena_challenges c where c.id = challenge_id and c.user_id is null and c.status = 'PUBLISHED'));
revoke all on public.challenge_steps from anon, authenticated;
grant select (id, challenge_id, step_order, title, instruction) on public.challenge_steps to authenticated;

create table public.challenge_checks (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  step_id uuid references public.challenge_steps(id) on delete cascade,
  check_type text not null check (check_type in ('TEST_RUN', 'QUERY_RESULT', 'NUMERIC_ANSWER', 'CHOICE_ANSWER', 'OUTPUT_MATCH', 'FILE_STATE', 'TERMINAL_OUTPUT', 'DOM_ASSERTION')),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  config jsonb not null default '{}',
  /** visible checks are listed (label only) to the student; hidden ones are scored but not listed until the result */
  visible boolean not null default true,
  weight smallint not null default 1 check (weight >= 1),
  /** SERVER: the server can re-evaluate it from the submitted artifact. CLIENT: only the student's browser ran it, so a pass is self-attested. */
  verification text not null default 'SERVER' check (verification in ('SERVER', 'CLIENT')),
  created_at timestamptz not null default now()
);
create index challenge_checks_by_challenge on public.challenge_checks (challenge_id);
alter table public.challenge_checks enable row level security;
revoke all on public.challenge_checks from anon, authenticated;

create table public.challenge_hints (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  hint_order smallint not null check (hint_order >= 1),
  body text not null check (char_length(body) <= 2000),
  penalty_points smallint not null default 5 check (penalty_points >= 0),
  unique (challenge_id, hint_order)
);
alter table public.challenge_hints enable row level security;
revoke all on public.challenge_hints from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Attempts. The only place a student's work is kept (and only what the runtime submits); read-only to the student, written by the server.
create table public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'PASSED', 'FAILED', 'NEEDS_REVIEW', 'EXPIRED', 'ABANDONED')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score smallint check (score is null or score between 0 and 100),
  checks_passed smallint,
  checks_total smallint,
  time_spent_s integer check (time_spent_s is null or time_spent_s >= 0),
  hints_used smallint not null default 0,
  /** per-check outcome: label + passed only, never expected values */
  check_results jsonb,
  runtime_type text not null check (runtime_type in ('CODE_EDITOR_PREVIEW', 'NOTEBOOK_PYTHON', 'SQL_CONSOLE', 'TERMINAL_VM', 'SIMULATOR', 'CALCULATION_WORKSHEET', 'QUESTION_FLOW')),
  runtime_session_ref text,
  draft jsonb,
  submission jsonb,
  reflection_text text check (reflection_text is null or char_length(reflection_text) <= 2000),
  evidence_status text check (evidence_status is null or evidence_status in ('VERIFIED_AUTOMATED', 'NEEDS_REVIEW', 'UNVERIFIED')),
  points_awarded integer,
  elo_delta integer,
  grading_version text,
  created_at timestamptz not null default now(),
  check (status = 'IN_PROGRESS' or submitted_at is not null or status in ('EXPIRED', 'ABANDONED'))
);
create unique index challenge_attempts_one_open on public.challenge_attempts (student_id, challenge_id) where status = 'IN_PROGRESS';
create index challenge_attempts_by_student on public.challenge_attempts (student_id, started_at desc);
alter table public.challenge_attempts enable row level security;
create policy challenge_attempts_self_read on public.challenge_attempts for select using (student_id = auth.uid());
revoke all on public.challenge_attempts from anon, authenticated;
grant select on public.challenge_attempts to authenticated;

-- Runtime start/stop/cost log, used for the per-student daily caps.
create table public.runtime_usage (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid references public.challenge_attempts(id) on delete set null,
  runtime_type text not null check (runtime_type in ('CODE_EDITOR_PREVIEW', 'NOTEBOOK_PYTHON', 'SQL_CONSOLE', 'TERMINAL_VM', 'SIMULATOR', 'CALCULATION_WORKSHEET', 'QUESTION_FLOW')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  cost_cents numeric(10, 4) not null default 0 check (cost_cents >= 0),
  outcome text check (outcome is null or outcome in ('COMPLETED', 'TIMEOUT', 'FAILED', 'KILLED'))
);
create index runtime_usage_by_student_day on public.runtime_usage (student_id, started_at desc);
alter table public.runtime_usage enable row level security;
revoke all on public.runtime_usage from anon, authenticated;

-- Outbox for the roadmap / skill-gap services (no event bus exists). A stable interface: consumers poll `processed_at is null`.
create table public.challenge_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('CHALLENGE_PASSED', 'CHALLENGE_FAILED')),
  student_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}',
  /** one event per (attempt, type): makes publishing idempotent */
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index challenge_events_unprocessed on public.challenge_events (created_at) where processed_at is null;
alter table public.challenge_events enable row level security;
revoke all on public.challenge_events from anon, authenticated;
