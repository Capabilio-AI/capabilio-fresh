-- One completion row per (week, challenge) -- a resubmission updates the
-- same row via upsert instead of accumulating duplicate rows (which would
-- otherwise let points/streak be re-awarded on every retry).
alter table public.arena_challenge_completions
  add constraint arena_challenge_completions_week_challenge_unique unique (week_id, challenge_id);
