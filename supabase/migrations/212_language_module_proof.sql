-- A language module is proven by an assessment (questions drawn from its lessons) and, where the judge can run the language, one problem. The next
-- module of the track opens only when the one before it is proven (lib/languages/module-gate.ts). Service-role only like the other progress tables.
create table public.language_module_proof (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('c', 'java', 'python', 'cpp', 'sql', 'html', 'javascript', 'csharp')),
  module_key text not null check (char_length(module_key) between 1 and 80),
  -- finished attempts at the assessment; the next attempt draws a different set of questions
  assessment_attempts int not null default 0 check (assessment_attempts >= 0),
  assessment_passed_at timestamptz,
  problem_attempts int not null default 0 check (problem_attempts >= 0),
  problem_passed_at timestamptz,
  proven_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, track, module_key)
);
create index language_module_proof_user_idx on public.language_module_proof (user_id, track);

alter table public.language_module_proof enable row level security;
revoke all on public.language_module_proof from anon, authenticated;
