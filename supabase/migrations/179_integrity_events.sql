-- Integrity signals from student work pages (SkillStudio, Arena): how often a student tried to paste, copy, take a screenshot or leave the window.
-- The browser sends counts in small batches, so one row is "n of this kind in one batch", not one row per keystroke. Service-role only like the
-- other student-activity tables: the server checks who is asking, and the college reads totals through its own page.
create table public.integrity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area text not null check (area in ('skillstudio', 'arena')),
  path text not null check (char_length(path) <= 200),
  kind text not null check (kind in ('paste', 'copy', 'cut', 'screenshot', 'print', 'blur')),
  n int not null check (n between 1 and 500),
  created_at timestamptz not null default now()
);
create index integrity_events_user_idx on public.integrity_events (user_id, created_at desc);

alter table public.integrity_events enable row level security;
revoke all on public.integrity_events from anon, authenticated;
