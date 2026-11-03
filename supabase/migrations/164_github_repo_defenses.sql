-- STATUS: NOT YET APPLIED.
-- Code DNA phase 3, "Explain your project": the student answers questions
-- generated from their own repository's code, scored by the model. Keyed by
-- (user_id, full_name) rather than the repository row id because a rescan
-- replaces github_repositories rows. Computed, evidence-like data: the
-- student can read their own row but never write it (service role only).

create table public.github_repo_defenses (
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  questions jsonb,
  asked jsonb not null default '[]'::jsonb,
  attempts smallint not null default 0,
  score smallint check (score is null or score between 0 and 100),
  feedback jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, full_name)
);

alter table public.github_repo_defenses enable row level security;

create policy github_repo_defenses_select_own on public.github_repo_defenses
  for select using (user_id = auth.uid());
