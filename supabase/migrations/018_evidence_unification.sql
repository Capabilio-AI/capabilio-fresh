-- Evidence engine Phase 2: extends the existing, already-applied public.evidence
-- table (created 002_career_os_foundations.sql, never written to since) rather
-- than creating a parallel table -- see docs/evidence-engine-audit.md §Phase 2.
-- Purely additive: new nullable columns, one new enum value, one new table,
-- one new RLS policy. No existing column, type, or policy is altered or dropped.

alter type public.capability_evidence_source add value if not exists 'github_repository';

alter table public.evidence
  add column if not exists evidence_type text,
  add column if not exists source_identifier text,
  add column if not exists source_url text,
  add column if not exists observed_at timestamptz,
  add column if not exists strength numeric,
  add column if not exists metadata jsonb,
  add column if not exists analysis_version text;

comment on column public.evidence.evidence_type is 'Finer grain than source_type, e.g. commit_activity | pull_request | technology_usage | engineering_practice | authenticity_signal | arena_result.';
comment on column public.evidence.source_identifier is 'Stable dedup key, e.g. a repo full_name or an Arena attempt id -- rows are replaced wholesale on rescan, not accumulated per-commit.';
comment on column public.evidence.strength is 'Only set by a documented, deterministic formula (docs/evidence-strength.md). Null means not computed, never a fabricated number.';

-- One row per (user, source_type, source_identifier) so a rescan/reprocess
-- replaces rather than duplicates evidence. Partial index: rows without a
-- source_identifier (legacy assessment-sourced rows) are unaffected.
create unique index if not exists idx_evidence_source_identifier
  on public.evidence(user_id, source_type, source_identifier)
  where source_identifier is not null;

-- Per-run history for GitHub ingestion. github_connections tracks only the
-- latest scan's status as a single mutable row; nothing existing keeps a
-- history of runs with coverage/error detail, so this is a genuinely new
-- table, not a duplicate of anything.
create table if not exists public.github_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'partial', 'failed')),
  analysis_version text not null,
  repos_discovered integer,
  repos_analyzed integer,
  repos_failed integer,
  commits_analyzed integer,
  prs_analyzed integer,
  warnings jsonb not null default '[]',
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_github_analysis_runs_user on public.github_analysis_runs(user_id, started_at desc);

alter table public.github_analysis_runs enable row level security;

create policy github_analysis_runs_self_read
  on public.github_analysis_runs for select
  using (user_id = auth.uid());

-- Recruiter read access to a candidate's evidence, scoped to the existing
-- applications relationship: applying to a recruiter's opportunity is the
-- candidate's explicit sharing action against schema that already exists --
-- no new consent table. See docs/evidence-engine-audit.md §Phase 2 for why
-- this doesn't extend to a full recruiter UI in this pass.
create policy evidence_recruiter_read
  on public.evidence for select
  using (
    exists (
      select 1
      from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.recruiters r on r.id = o.recruiter_id
      where a.user_id = evidence.user_id and r.user_id = auth.uid()
    )
  );
