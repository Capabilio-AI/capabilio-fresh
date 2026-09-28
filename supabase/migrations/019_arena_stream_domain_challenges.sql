-- Arena Challenges redesign: Stream (branch) + Domain (career) challenges,
-- replacing the MCQ-quiz Challenges page. See docs/arena-challenges-redesign.md.
--
-- Does not touch arena_challenge_attempts / finish_arena_challenge / the
-- quiz backend -- those stay exactly as they are. arena_ratings is reused
-- (challenge completions bump it directly, see the app-layer note in the
-- design doc for why that's not routed through finish_arena_challenge).

create table public.arena_challenges (
  id uuid primary key default gen_random_uuid(),
  track text not null check (track in ('stream', 'domain')),
  scope_key text not null,
  title text not null,
  category text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  time_limit_minutes integer not null default 20,
  scenario text not null,
  objective text not null,
  language text not null,
  starter_code text,
  stdin text,
  expected_output text not null,
  skill_tags text[] not null default '{}',
  elo_gain integer not null default 15,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_arena_challenges_scope on public.arena_challenges(track, scope_key) where active;

create table public.arena_challenge_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('stream', 'domain')),
  slot_index integer not null check (slot_index >= 0),
  challenge_id uuid references public.arena_challenges(id) on delete set null,
  assigned_at timestamptz,
  cooldown_until timestamptz,
  recent_challenge_ids uuid[] not null default '{}',
  recent_categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, track, slot_index)
);

create index idx_arena_challenge_slots_user on public.arena_challenge_slots(user_id);

create table public.arena_challenge_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_id uuid not null references public.arena_challenge_slots(id) on delete cascade,
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  track text not null check (track in ('stream', 'domain')),
  scope_key text not null,
  code_submitted text,
  is_correct boolean not null,
  elo_delta integer not null default 0,
  completed_at timestamptz not null default now()
);

create index idx_arena_challenge_completions_user on public.arena_challenge_completions(user_id, completed_at desc);

alter table public.arena_challenges enable row level security;
alter table public.arena_challenge_slots enable row level security;
alter table public.arena_challenge_completions enable row level security;

-- The catalog itself carries no private data -- readable by any
-- authenticated student (needed so a slot can join challenge detail),
-- writable only by the service-role generator.
create policy arena_challenges_read_all
  on public.arena_challenges for select
  using (true);

create policy arena_challenge_slots_self_read
  on public.arena_challenge_slots for select
  using (user_id = auth.uid());

create policy arena_challenge_completions_self_read
  on public.arena_challenge_completions for select
  using (user_id = auth.uid());
