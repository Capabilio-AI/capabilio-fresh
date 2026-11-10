-- Brings roadmap_project_submissions (180) up to its current design on a database where 180 was applied in its first form. Safe to run on a
-- database that already has these changes: every statement is idempotent.
--   * 'scoring' status: the answers of one question set are claimed before the model is called, so a set is scored once
--   * applied_at: set once every skill update for a verified project has been written; a verified row without it is finished on the next read
--   * repo_*: a linked GitHub repository, read at submit time (which repo, whose account it sits under, and the text the questions and score used)
alter table public.roadmap_project_submissions drop constraint if exists roadmap_project_submissions_status_check;
alter table public.roadmap_project_submissions add constraint roadmap_project_submissions_status_check
  check (status in ('draft', 'awaiting_answers', 'scoring', 'verified', 'not_verified'));

alter table public.roadmap_project_submissions
  add column if not exists applied_at timestamptz,
  add column if not exists repo_full_name text,
  add column if not exists repo_owner text,
  add column if not exists repo_context text;

alter table public.roadmap_project_submissions drop constraint if exists roadmap_project_submissions_repo_owner_check;
alter table public.roadmap_project_submissions add constraint roadmap_project_submissions_repo_owner_check
  check (repo_owner is null or repo_owner in ('verified-owner', 'other-owner', 'unverified-account'));
