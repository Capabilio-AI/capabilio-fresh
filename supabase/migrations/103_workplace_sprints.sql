-- Workplace sprints: a user's work week at a fictional company. A sprint groups the tickets of one week under one story.
-- Tickets stay in arena_domain_assignments; each one is stamped with the sprint it belongs to.
create table if not exists public.workplace_sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.arena_domain_roles(role_key),
  -- the Monday of the week, in India time
  week_start date not null,
  company_key text not null,
  story_title text not null,
  story_blurb text not null,
  created_at timestamptz not null default now(),
  unique (user_id, role_key, week_start)
);
create index if not exists workplace_sprints_user_idx on public.workplace_sprints (user_id, week_start desc);

alter table public.workplace_sprints enable row level security;
drop policy if exists workplace_sprints_owner_read on public.workplace_sprints;
create policy workplace_sprints_owner_read on public.workplace_sprints for select to authenticated using (user_id = (select auth.uid()));
-- only the server (service role) creates sprints
revoke insert, update, delete on public.workplace_sprints from anon, authenticated;

alter table public.arena_domain_assignments add column if not exists sprint_id uuid references public.workplace_sprints(id) on delete set null;
create index if not exists arena_domain_assignments_sprint_idx on public.arena_domain_assignments (sprint_id);
