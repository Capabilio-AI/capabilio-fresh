-- Sealed evidence for every passed Arena task. Until now a recruiter's "View evidence" read live rows: the brief, the submission, the grade. A sealed record
-- freezes that at the moment the task was passed and explained, and carries a fingerprint over the content so a later change is detectable.
-- The student decides whether the record is shown to others (`shared`); that is the only column that may ever change.
create table if not exists public.evidence_records (
  attempt_id uuid primary key references public.arena_domain_assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  area_key text not null,
  area_name text,
  company text,
  skill_ids uuid[] not null default '{}',
  difficulty text not null,
  tool_type text,
  title text not null,
  requester text,
  scenario text,
  objective text,
  submission jsonb,
  grade jsonb not null,
  submissions int not null default 1,
  grading_version text,
  generation_version text,
  assigned_at timestamptz not null,
  completed_at timestamptz not null,
  explained boolean not null default false,
  explanation_score int,
  schema_version int not null default 1,
  fingerprint text not null,
  shared boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists evidence_records_user_idx on public.evidence_records (user_id, completed_at desc);

alter table public.evidence_records enable row level security;
create policy "own evidence records" on public.evidence_records for select using (user_id = auth.uid());
-- no insert, update or delete policy: the server (service role) seals records and the student changes `shared` through a server action

create or replace function public.evidence_records_sealed() returns trigger language plpgsql as $$
begin
  if new.attempt_id is distinct from old.attempt_id or new.user_id is distinct from old.user_id or new.role_key is distinct from old.role_key
     or new.area_key is distinct from old.area_key or new.skill_ids is distinct from old.skill_ids or new.difficulty is distinct from old.difficulty
     or new.title is distinct from old.title or new.scenario is distinct from old.scenario or new.objective is distinct from old.objective
     or new.submission is distinct from old.submission or new.grade is distinct from old.grade or new.submissions is distinct from old.submissions
     or new.grading_version is distinct from old.grading_version or new.generation_version is distinct from old.generation_version
     or new.assigned_at is distinct from old.assigned_at or new.completed_at is distinct from old.completed_at
     or new.explained is distinct from old.explained or new.explanation_score is distinct from old.explanation_score
     or new.schema_version is distinct from old.schema_version or new.fingerprint is distinct from old.fingerprint then
    raise exception 'an evidence record is sealed: only "shared" can change';
  end if;
  return new;
end $$;
drop trigger if exists evidence_records_sealed on public.evidence_records;
create trigger evidence_records_sealed before update on public.evidence_records for each row execute function public.evidence_records_sealed();
