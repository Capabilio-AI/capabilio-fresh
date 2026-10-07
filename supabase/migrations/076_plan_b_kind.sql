-- The student's Plan B is one of five kinds, chosen once in 3-1. A career is only attached for 'change_role'
-- (student_career_intent.secondary_career_id); the other kinds keep it null.
alter table public.student_career_intent
  add column if not exists plan_b_kind text
    check (plan_b_kind in ('same_role', 'higher_studies', 'entrepreneur', 'change_role', 'undecided')),
  add column if not exists plan_b_decided_at timestamptz;
