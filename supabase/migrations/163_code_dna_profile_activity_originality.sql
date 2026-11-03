-- STATUS: APPLIED to production 2026-11-03.
-- Code DNA v3: account facts, a year of contribution activity, a five-part
-- score breakdown, per-repo commit forensics, and content-fingerprint
-- originality evidence. All additive jsonb/text columns -- no existing
-- column is changed or dropped. Same trust boundary as the rest of Code DNA:
-- authenticated clients can SELECT their own rows (existing policies) and
-- can never write them; the scan route writes through the service role.

alter table public.github_connections
  add column if not exists account_facts jsonb,
  add column if not exists activity jsonb,
  add column if not exists score_breakdown jsonb,
  add column if not exists originality jsonb;

alter table public.github_repositories
  add column if not exists commit_signals jsonb;

alter table public.github_similarity_signals
  add column if not exists method text not null default 'name_match'
    check (method in ('name_match', 'file_fingerprint')),
  add column if not exists evidence jsonb;
