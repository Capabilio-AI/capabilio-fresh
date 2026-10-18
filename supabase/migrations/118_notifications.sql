-- Stored notifications: one row per thing that happened to a person (an application moved, a project was graded,
-- someone followed you...). Server-mediated like the other social tables: RLS on and NO client policies, so rows
-- are written and read only by trusted server code after an auth check, scoped to the signed-in user.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (char_length(type) between 1 and 60),
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 500),
  href text check (href is null or (href like '/%' and char_length(href) <= 300)),
  actor_id uuid references public.profiles(id) on delete set null,
  institution_id uuid references public.institutions(id) on delete cascade,
  -- same dedupe_key for the same person = stored once (a retried request or a repeated action never doubles up)
  dedupe_key text check (char_length(dedupe_key) <= 200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
-- a plain (non-partial) unique index so ON CONFLICT can use it; NULL keys never collide
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key);
create index notifications_user_recent_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant all on public.notifications to service_role;
