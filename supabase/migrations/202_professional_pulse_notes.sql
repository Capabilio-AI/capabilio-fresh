-- Professional Pulse, second part.
--  - pro_posts accepts a fifth kind, 'project', next to update, win (shown as Achievement), resource and ask (shown as Question).
--  - pro_notes: short notes that stay up for 24 hours, shown as a row of avatars at the top of Pulse.
-- Server-only: RLS on, no grants to anon or authenticated.

alter table public.pro_posts drop constraint if exists pro_posts_kind_check;
alter table public.pro_posts add constraint pro_posts_kind_check check (kind in ('update', 'project', 'resource', 'ask', 'win'));

create table if not exists public.pro_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 160),
  created_at timestamptz not null default now()
);
create index if not exists pro_notes_recent_idx on public.pro_notes (created_at desc);
create index if not exists pro_notes_author_idx on public.pro_notes (author_id, created_at desc);

alter table public.pro_notes enable row level security;
revoke all on public.pro_notes from anon, authenticated;
