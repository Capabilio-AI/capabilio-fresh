-- Stream challenges written for the student (any branch, not just IT): concept / case questions with four lettered options, next to the
-- existing calculation (numeric) kind. The correct option key lives in expected_output like every other kind's answer; `options` is what the
-- student sees and `explanation` is shown only after they answer. Neither column is granted to students: the API reads them as the service role.
-- Per-student rows already exist (user_id set, PUBLISHED by arena_challenge_status_guard), so no publish gate changes.
alter table public.arena_challenges drop constraint if exists arena_challenges_kind_check;
alter table public.arena_challenges add constraint arena_challenges_kind_check check (kind in ('code', 'numeric', 'sql', 'workstation', 'leetcode', 'mcq'));

alter table public.arena_challenges
  add column if not exists options jsonb check (options is null or jsonb_typeof(options) = 'array'),
  add column if not exists explanation text check (explanation is null or char_length(explanation) <= 1500);

-- the "my own rows for this scope" lookup in loadStreamPool
create index if not exists arena_challenges_stream_owner on public.arena_challenges (user_id, scope_key) where track = 'stream' and user_id is not null;
