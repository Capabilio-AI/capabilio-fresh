-- 087: the common assessment's per-section question counts, fixed when the session starts. Normally 10 + 10; if the question pool is
-- thinner than that, the plan shrinks to what exists (the same for everyone while the pool is the same) instead of dead-ending the student.
alter table public.assess_sessions add column if not exists section_plan jsonb;
