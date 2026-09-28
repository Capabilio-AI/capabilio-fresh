-- STATUS: APPLIED to production 2026-09-28.
-- Code DNA v2 (GitHub Recruiter Intelligence): normalized per-repository
-- evidence, replacing the single github_connections.analysis jsonb blob.
-- github_connections.analysis/code_dna_score/confidence_level/
-- recruiter_summary columns are left in place (no destructive migration)
-- but stop being written/read by the new code path.
--
-- One row per analyzed repo per scan (replace-on-rescan: the scan route
-- deletes this user's existing rows and inserts fresh ones each run).
-- scan_status is per-repo so one failed repo can never fail the whole
-- scan -- see docs/code-dna-discovery.md Phase 2.

create table public.github_repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  full_name text not null,
  html_url text not null,
  description text,
  is_fork boolean not null default false,
  fork_source_full_name text,
  fork_source_url text,
  primary_language text,
  topics text[] not null default '{}',
  license text,
  stars integer not null default 0,
  forks_count integer not null default 0,
  is_archived boolean not null default false,
  size_kb integer not null default 0,
  repo_created_at timestamptz,
  repo_updated_at timestamptz,
  candidate_commit_count integer not null default 0,
  candidate_pr_count integer not null default 0,
  candidate_pr_merged_count integer not null default 0,
  first_candidate_commit_at timestamptz,
  last_candidate_commit_at timestamptz,
  tech_signals text[] not null default '{}',
  has_tests boolean not null default false,
  has_ci boolean not null default false,
  has_readme boolean not null default false,
  has_dependencies boolean not null default false,
  has_database_signal boolean not null default false,
  has_auth_signal boolean not null default false,
  contributors_count integer,
  scan_status text not null default 'ok' check (scan_status in ('ok', 'partial', 'failed')),
  scan_error text,
  scanned_at timestamptz not null default now()
);

create index idx_github_repositories_user on public.github_repositories(user_id);

create table public.github_similarity_signals (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.github_repositories(id) on delete cascade,
  matched_repo_full_name text not null,
  matched_repo_url text not null,
  similarity_level text not null check (similarity_level in ('low', 'moderate', 'high')),
  affected_area text,
  possible_explanations text[] not null default '{}',
  detected_at timestamptz not null default now()
);

create index idx_github_similarity_signals_repository on public.github_similarity_signals(repository_id);

alter table public.github_repositories enable row level security;
alter table public.github_similarity_signals enable row level security;

-- Own-row read only, same trust boundary as github_connections: these are
-- computed, evidence-derived rows -- the authenticated client can SELECT
-- but never INSERT/UPDATE/DELETE its own rows directly (would let a
-- student fabricate their own evidence). All writes go through the
-- service-role client, only after a real GitHub scan.
create policy github_repositories_select_own
  on public.github_repositories for select
  using (user_id = auth.uid());

create policy github_similarity_signals_select_own
  on public.github_similarity_signals for select
  using (
    exists (
      select 1 from public.github_repositories r
      where r.id = repository_id and r.user_id = auth.uid()
    )
  );
