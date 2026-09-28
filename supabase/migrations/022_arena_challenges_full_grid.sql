-- Drops the wheel/scratch-card/weekly-batch model in favor of a full,
-- always-visible grid of active challenges per scope (matching the real
-- reference in Capabilio-new's ArenaCollegeStream/ProfessionalWorkspace
-- pages -- confirmed by reading that source directly, not guessed). No
-- real user data existed in arena_challenge_weeks yet, so it's dropped
-- rather than migrated. A completion is now keyed on (user, challenge)
-- directly -- "once passed it locks", not "once passed this week's batch".

drop table if exists public.arena_challenge_weeks cascade;

alter table public.arena_challenge_completions
  drop constraint if exists arena_challenge_completions_week_challenge_unique;
alter table public.arena_challenge_completions drop column if exists week_id;

alter table public.arena_challenge_completions
  add constraint arena_challenge_completions_user_challenge_unique unique (user_id, challenge_id);
