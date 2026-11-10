-- CRT Career Studio: eight learning paths, a log of every practice answer (the evidence behind competency, streaks and adaptive practice), and speaking practice.
-- Service-role only like the other crt_* tables.

-- Training sessions belong to one of eight paths. The four assessment modules stay as they are; a path is a finer grouping for learning.
alter table public.crt_sessions add column if not exists category text;
update public.crt_sessions set category = case module when 'aptitude' then 'aptitude' when 'reasoning' then 'reasoning' when 'verbal' then 'verbal' else 'soft_skills' end where category is null;
update public.crt_sessions set category = 'workplace' where module = 'verbal' and position = 2 and category = 'verbal';
update public.crt_sessions set category = 'interview' where module = 'verbal' and position = 3 and category = 'verbal';
alter table public.crt_sessions alter column category set not null;
alter table public.crt_sessions drop constraint if exists crt_sessions_category_check;
alter table public.crt_sessions add constraint crt_sessions_category_check
  check (category in ('aptitude', 'reasoning', 'verbal', 'speaking', 'soft_skills', 'group_discussion', 'interview', 'workplace'));

-- Every practice, daily, challenge and simulator answer. points/max_points handle both right-or-wrong and 0-3 situational questions.
create table public.crt_practice_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.crt_questions(id) on delete cascade,
  category text not null check (category in ('aptitude', 'reasoning', 'verbal', 'speaking', 'soft_skills', 'group_discussion', 'interview', 'workplace')),
  mode text not null check (mode in ('practice', 'daily', 'challenge', 'simulator')),
  chosen_key text not null check (char_length(chosen_key) <= 8),
  points int not null check (points >= 0),
  max_points int not null check (max_points >= 1),
  correct boolean not null,
  day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_at timestamptz not null default now()
);
create index crt_practice_log_user_idx on public.crt_practice_log (user_id, created_at desc);
create index crt_practice_log_cat_idx on public.crt_practice_log (user_id, category, created_at desc);
-- the daily challenge counts each question once a day
create unique index crt_practice_log_daily_idx on public.crt_practice_log (user_id, day, question_id) where mode = 'daily';

-- One row per spoken or typed answer, with the feedback the student saw, so improvement can be measured over time.
create table public.crt_speaking_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('self_intro', 'hr', 'conversation', 'project', 'workplace')),
  prompt_key text not null,
  transcript text not null check (char_length(transcript) between 20 and 4000),
  seconds int check (seconds is null or seconds between 1 and 900),
  scores jsonb not null,
  feedback jsonb not null,
  created_at timestamptz not null default now()
);
create index crt_speaking_user_idx on public.crt_speaking_attempts (user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['crt_practice_log', 'crt_speaking_attempts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
