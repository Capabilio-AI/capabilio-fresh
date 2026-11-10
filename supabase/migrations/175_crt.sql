-- CRT (campus recruitment training): a college runs a cycle every six months; students take the training sessions and then one timed assessment,
-- and the placement cell sees the results. Service-role only like the other org_* tables: the server checks the caller, then reads and writes,
-- so answer keys (options.points) never reach a browser.
create table public.crt_cycles (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.institutions(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  opens_on date not null,
  closes_on date not null,
  -- null = every branch / every year
  branches text[],
  years int[],
  duration_minutes int not null default 60 check (duration_minutes between 15 and 180),
  created_by uuid references public.profiles(id) on delete set null,
  -- set when the placement cell's results report has been sent after the cycle closed
  report_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (closes_on > opens_on)
);
create index crt_cycles_college_idx on public.crt_cycles (college_id, opens_on desc);

-- The assessment bank. points is per option: 1/0 for a right/wrong question, 0-3 for a situational judgement question.
create table public.crt_questions (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('aptitude', 'reasoning', 'verbal', 'soft_skills')),
  topic text not null,
  difficulty int not null default 2 check (difficulty between 1 and 3),
  prompt text not null check (char_length(btrim(prompt)) >= 8),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  explanation text,
  status text not null default 'published' check (status in ('draft', 'published', 'retired')),
  created_at timestamptz not null default now()
);
create index crt_questions_pick_idx on public.crt_questions (module, status, difficulty);

-- One attempt per student per cycle. question_ids is the fixed set served, answers maps question id -> chosen option key.
create table public.crt_attempts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.crt_cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  college_id uuid not null references public.institutions(id) on delete cascade,
  branch text,
  year_of_study int,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  question_ids uuid[] not null,
  answers jsonb not null default '{}'::jsonb,
  -- {module: {points, max}} and the overall percentage, written once at submit
  module_scores jsonb,
  total_pct numeric(5, 2),
  unique (cycle_id, user_id)
);
create index crt_attempts_cycle_idx on public.crt_attempts (cycle_id, submitted_at);
create index crt_attempts_user_idx on public.crt_attempts (user_id, started_at desc);

-- Training sessions: short guided lessons per module, in order.
create table public.crt_sessions (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('aptitude', 'reasoning', 'verbal', 'soft_skills')),
  position int not null default 0,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  summary text not null,
  minutes int not null default 20 check (minutes between 5 and 120),
  -- ordered blocks: {type: 'text'|'example'|'tip'|'practice', ...}
  content jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'retired')),
  created_at timestamptz not null default now(),
  unique (module, position)
);

create table public.crt_session_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.crt_sessions(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

do $$
declare t text;
begin
  foreach t in array array['crt_cycles', 'crt_questions', 'crt_attempts', 'crt_sessions', 'crt_session_progress'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
