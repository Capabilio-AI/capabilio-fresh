-- Coding exercises for lessons, in the style of a classroom tutorial: a short task, starter code, and tests the student's code is run against.
-- An exercise is stored only after its reference solution has been run on the code runner and passed every test, so a wrong "answer key" never
-- reaches a student. The solution and the hidden tests' answers are never readable by students (no policy: only the server reads this table).
create table public.lesson_exercises (
  id uuid primary key default gen_random_uuid(),
  -- 'topic:{roadmap node key}' or 'track:{language track}:{lesson key}'
  topic_key text not null,
  language text not null check (language in ('python', 'java', 'c', 'cpp')),
  position smallint not null default 0,
  title text not null check (char_length(title) between 3 and 100),
  instructions text not null,
  starter_code text not null,
  solution text not null,
  -- [{ input, expected, hidden }]
  tests jsonb not null,
  model text,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (topic_key, title)
);
create index lesson_exercises_topic on public.lesson_exercises (topic_key, position);
alter table public.lesson_exercises enable row level security;

-- A student's progress on an exercise: how many times they ran the tests and whether they passed. Learning progress only; it is never skill evidence.
create table public.lesson_exercise_attempts (
  student_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.lesson_exercises(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  passed boolean not null default false,
  passed_at timestamptz,
  last_code text check (last_code is null or char_length(last_code) <= 10000),
  updated_at timestamptz not null default now(),
  primary key (student_id, exercise_id)
);
alter table public.lesson_exercise_attempts enable row level security;
create policy "own exercise attempts" on public.lesson_exercise_attempts for select using (student_id = auth.uid());
