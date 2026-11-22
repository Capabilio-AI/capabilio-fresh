-- Goals students typed that no job role and no published pathway covers. This is the demand signal that decides which pathway is written next
-- (docs/any-goal-pathways-design.md). One row per student per goal wording-independent key; service-role only.
create table public.goal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_text text not null check (char_length(goal_text) between 2 and 300),
  -- the words of the goal with filler removed (lib/goals/match.ts), so the same goal typed two ways counts once
  goal_key text not null check (char_length(goal_key) between 1 and 300),
  status text not null default 'OPEN' check (status in ('OPEN', 'COVERED', 'DECLINED')),
  covered_by_pathway_key text,
  created_at timestamptz not null default now(),
  unique (user_id, goal_key)
);
create index goal_requests_open_idx on public.goal_requests (goal_key) where status = 'OPEN';

alter table public.goal_requests enable row level security;
revoke all on public.goal_requests from anon, authenticated;
