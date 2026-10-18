-- Stream missions: remember each experiment (settings and how many requirements it met) so the student can compare attempts, even after a reload.
-- The server keeps the last 12; it is only ever written by the mission service.
alter table public.arena_mission_attempts
  add column history jsonb not null default '[]' check (jsonb_typeof(history) = 'array');
