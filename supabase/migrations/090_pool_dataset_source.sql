-- The common assessment can now be filled from open datasets (downloaded once, stored here) as well as from Groq.
-- Career questions stay Groq-generated. Dataset rows record where they came from so the licence/attribution travels with them.
alter table public.assess_question_pool drop constraint if exists assess_question_pool_source_check;
alter table public.assess_question_pool add constraint assess_question_pool_source_check check (source in ('groq', 'dataset'));
alter table public.assess_question_pool add column if not exists dataset text, add column if not exists license text;
