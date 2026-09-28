-- STATUS: APPLIED to production 2026-09-28.
-- Code DNA: a GitHub-based engineering-evidence engine, ported from
-- capabilio-web's real implementation there (not a UI reskin — see
-- lib/code-dna/* for the scanning/scoring/formatting logic).
--
-- code_dna_score/confidence_level/analysis/recruiter_summary are COMPUTED,
-- evidence-derived fields — same trust boundary as capabilities/
-- capability_history: the authenticated client can SELECT its own row but
-- can never INSERT/UPDATE it directly (that would let a student fabricate
-- their own evidence score). All writes go through the service-role
-- client, only after a real GitHub API scan.

create table public.github_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  profile_url text not null,
  verification_state text not null default 'pending' check (verification_state in ('pending', 'verified', 'failed')),
  verification_code text not null,
  scan_status text not null default 'idle' check (scan_status in ('idle', 'scanning', 'failed')),
  code_dna_score smallint check (code_dna_score is null or (code_dna_score between 0 and 100)),
  confidence_level text check (confidence_level is null or confidence_level in ('low', 'medium', 'high')),
  repositories_analyzed smallint,
  analysis jsonb,
  recruiter_summary text,
  last_scanned_at timestamptz,
  next_scan_at timestamptz,
  consecutive_failures smallint not null default 0,
  last_scan_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.github_connections
  for each row execute function public.set_updated_at();

alter table public.github_connections enable row level security;

create policy github_connections_select_own on public.github_connections
  for select using (user_id = auth.uid());
-- Deliberately no insert/update/delete policy for the authenticated role —
-- all writes are service-role only, via lib/code-dna/*.
