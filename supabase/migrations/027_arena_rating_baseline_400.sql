-- STATUS: pending. Every student's per-skill-area Arena rating now starts
-- from 400 (matching capabilio-web's baseline) instead of 1200 — the
-- expected-score formula in complete_workstation_attempt already handles
-- any starting value correctly, this only changes the seed for rows
-- created from here on. Existing rows are untouched: a student who has
-- already completed Arena work keeps the rating they earned.
alter table public.arena_skill_ratings
  alter column rating set default 400;
