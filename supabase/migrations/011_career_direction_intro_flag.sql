-- STATUS: APPLIED to production 2026-09-27.
-- Additive only. Tracks whether a student has seen the one-time Career
-- Direction Explainer modal, shown the first time their computed
-- recommendation is revealed.
alter table public.profiles
  add column has_seen_career_direction_intro boolean not null default false;
