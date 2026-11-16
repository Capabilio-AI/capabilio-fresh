-- Mentorship, phase 1: a professional with ten or more years of experience can opt in to mentor students, recently graduated
-- users and other professionals.
--  - The public mentor profile and Capabilio's review stay in the existing `mentor_profiles` table, so the Mentors tab that students and
--    graduates already use shows approved professional mentors with no change to how review works.
--  - pro_mentor_profiles: what only the professional side needs (who they mentor, session length, time zone).
--  - pro_mentor_hours: weekly hours they are open for sessions.
--  - mentor_requests: one row per request from a mentee (any path) to a mentor, through accepted and scheduled to completed.
--  - mentor_ratings: the mentee's rating after a completed session.
-- Server-only: RLS on, no grants to anon or authenticated.

create table if not exists public.pro_mentor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  audience text[] not null default '{students,graduates}' check (audience <@ array['students', 'graduates', 'professionals'] and cardinality(audience) between 1 and 3),
  session_minutes smallint not null default 30 check (session_minutes in (30, 45, 60)),
  timezone text not null default 'Asia/Kolkata' check (char_length(timezone) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_mentor_hours (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  check (end_min > start_min)
);
create index if not exists pro_mentor_hours_mentor_idx on public.pro_mentor_hours (mentor_id, weekday, start_min);

create table if not exists public.mentor_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  mentee_path text not null check (mentee_path in ('student', 'graduate', 'professional')),
  topic text not null check (char_length(btrim(topic)) between 3 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 1000),
  preferred text check (preferred is null or char_length(preferred) <= 200),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled', 'completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  meeting_url text check (meeting_url is null or (char_length(meeting_url) <= 500 and meeting_url ~* '^https://')),
  decline_note text check (decline_note is null or char_length(decline_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mentor_id <> mentee_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists mentor_requests_mentor_idx on public.mentor_requests (mentor_id, status, created_at desc);
create index if not exists mentor_requests_mentee_idx on public.mentor_requests (mentee_id, created_at desc);
create unique index if not exists mentor_requests_one_open_idx on public.mentor_requests (mentor_id, mentee_id) where status in ('requested', 'accepted');

create table if not exists public.mentor_ratings (
  request_id uuid primary key references public.mentor_requests(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists mentor_ratings_mentor_idx on public.mentor_ratings (mentor_id, created_at desc);

alter table public.pro_mentor_profiles enable row level security;
alter table public.pro_mentor_hours enable row level security;
alter table public.mentor_requests enable row level security;
alter table public.mentor_ratings enable row level security;
revoke all on public.pro_mentor_profiles, public.pro_mentor_hours, public.mentor_requests, public.mentor_ratings from anon, authenticated;
