-- The pathway a student chose as their goal (docs/any-goal-pathways-design.md): one per student, changeable. A job-skill career is still chosen through
-- student_career_intent; this is for goals that are not a job-skill career. Service-role only.
create table public.student_pathway_goal (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  pathway_key text not null check (pathway_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(pathway_key) <= 60),
  chosen_at timestamptz not null default now()
);
alter table public.student_pathway_goal enable row level security;
revoke all on public.student_pathway_goal from anon, authenticated;
