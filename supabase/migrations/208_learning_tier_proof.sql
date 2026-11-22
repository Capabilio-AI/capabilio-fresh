-- Skill tiers (1 Basic, 2 Foundation, 3 Intermediate, 4 Expert) per learning area. A row exists only when the student passed that tier's proof
-- test, so "proven" is the row's existence. The next tier's proof can be attempted only once the one below is proven (checked by the server).
-- Service-role only like the other student-progress tables.
create table public.learning_tier_proof (
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'basic-programming', 'it' or 'stream'
  area text not null check (area in ('basic-programming', 'it', 'stream')),
  tier int not null check (tier between 1 and 4),
  passed int not null check (passed >= 0),
  total int not null check (total > 0 and passed <= total),
  -- the language the student chose to write the proof in
  language text,
  proven_at timestamptz not null default now(),
  primary key (user_id, area, tier)
);
create index learning_tier_proof_user_idx on public.learning_tier_proof (user_id);

alter table public.learning_tier_proof enable row level security;
revoke all on public.learning_tier_proof from anon, authenticated;
