-- "Explain your work": solving a Domain task no longer awards the rating by itself. The task moves to 'explaining'; the user answers an AI interview about
-- their own completed work, and only a passing explanation runs the normal completion (rating, evidence, portfolio entry, skill graph).
-- A task closed without a rating (explanation not passed after the allowed tries, or skipped) becomes 'unexplained'.
alter table public.arena_domain_assignments drop constraint if exists arena_domain_assignments_status_check;
alter table public.arena_domain_assignments
  add constraint arena_domain_assignments_status_check check (status in ('presented', 'grading', 'verified', 'cancelled', 'explaining', 'unexplained'));

create table if not exists public.arena_task_interviews (
  attempt_id uuid primary key references public.arena_domain_assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- explanations scored so far (the limit is enforced by the server)
  attempts integer not null default 0,
  -- the current set of questions; null when a fresh set must be written
  questions jsonb,
  -- every question ever asked for this task, so a second try is not the same questions
  asked jsonb not null default '[]'::jsonb,
  answers jsonb,
  score integer check (score is null or score between 0 and 100),
  feedback jsonb,
  passed boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists arena_task_interviews_user_idx on public.arena_task_interviews (user_id);

alter table public.arena_task_interviews enable row level security;
drop policy if exists arena_task_interviews_owner_read on public.arena_task_interviews;
create policy arena_task_interviews_owner_read on public.arena_task_interviews for select to authenticated using (user_id = (select auth.uid()));
-- only the server (service role) writes interviews, like every other Arena result
revoke insert, update, delete on public.arena_task_interviews from anon, authenticated;
