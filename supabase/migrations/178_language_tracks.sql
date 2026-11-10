-- Language tracks (C, Java): authored lessons live in the code, only the student's progress lives here. Service-role only like the other
-- student-progress tables: the server checks who is asking, then reads and writes.
create table public.language_lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('c', 'java', 'python', 'cpp', 'sql')),
  lesson_key text not null check (char_length(lesson_key) between 1 and 80),
  -- the check questions answered right out of asked, from the student's latest try
  correct int not null default 0 check (correct >= 0),
  total int not null default 0 check (total >= 0 and correct <= total),
  completed_at timestamptz not null default now(),
  primary key (user_id, track, lesson_key)
);
create index language_lesson_progress_user_idx on public.language_lesson_progress (user_id, track);

alter table public.language_lesson_progress enable row level security;
revoke all on public.language_lesson_progress from anon, authenticated;
