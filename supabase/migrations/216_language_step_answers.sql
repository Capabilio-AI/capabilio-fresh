-- A step (lesson) is done when the server has recorded the learner's answer to every one of its questions AND, where the lesson has a coding challenge, a pass of it.
-- The browser used to report its own score; now the server records each answer (the first answer to a question stands) and decides. Service-role only, like the
-- other progress tables. language_lesson_progress stays the list of finished steps.
create table public.language_step_answers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('c', 'java', 'python', 'cpp', 'sql', 'html', 'javascript', 'csharp')),
  lesson_key text not null check (char_length(lesson_key) between 1 and 80),
  -- question index (as text) -> the option the learner chose first
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, track, lesson_key)
);

alter table public.language_step_answers enable row level security;
revoke all on public.language_step_answers from anon, authenticated;
