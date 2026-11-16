-- Mentor slots and professional alerts.
--  - pro_mentor_slots: the specific half-hours or hours a mentor opens on specific dates. A mentee books one of these, not a free-text time.
--    status: open (anyone can request it), requested (a mentee asked and the mentor has not answered), booked (the mentor approved).
--  - mentor_requests.slot_id: the slot a request is for. Older requests have none and keep working.
--  - pro_notifications: alerts for a working professional, such as "a student requested your slot". Only the server writes and reads them.
-- The weekly pattern table pro_mentor_hours is left in place and no longer used.
-- Server-only: RLS on, no grants to anon or authenticated.

create table if not exists public.pro_mentor_slots (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'requested', 'booked')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (mentor_id, starts_at)
);
create index if not exists pro_mentor_slots_mentor_idx on public.pro_mentor_slots (mentor_id, starts_at);
create index if not exists pro_mentor_slots_open_idx on public.pro_mentor_slots (starts_at) where status = 'open';

alter table public.mentor_requests add column if not exists slot_id uuid references public.pro_mentor_slots(id) on delete set null;
create index if not exists mentor_requests_slot_idx on public.mentor_requests (slot_id) where slot_id is not null;

create table if not exists public.pro_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('mentor_request', 'mentor_cancelled', 'system')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text check (body is null or char_length(body) <= 300),
  link text check (link is null or (char_length(link) <= 200 and link like '/%')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pro_notifications_user_idx on public.pro_notifications (user_id, created_at desc);
create index if not exists pro_notifications_unread_idx on public.pro_notifications (user_id) where read_at is null;

alter table public.pro_mentor_slots enable row level security;
alter table public.pro_notifications enable row level security;
revoke all on public.pro_mentor_slots, public.pro_notifications from anon, authenticated;
