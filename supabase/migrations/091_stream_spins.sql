-- Weekly Stream wheel: one spin per student per Sunday (IST) week decides how many Stream challenges they get (4-9).
-- The server draws the number; students can read their own row but never write it.
create table public.arena_stream_spins (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  challenge_count smallint not null check (challenge_count between 4 and 9),
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.arena_stream_spins enable row level security;
create policy arena_stream_spins_self_read on public.arena_stream_spins for select using (user_id = auth.uid());
