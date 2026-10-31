-- 1. How many times the system has read each course. A live (published) curriculum is frozen, so progress cannot be written on the course itself.
create table if not exists public.curriculum_analysis_attempts (
  course_id uuid primary key references public.courses(id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz not null default now()
);
alter table public.curriculum_analysis_attempts enable row level security;
revoke all on public.curriculum_analysis_attempts from anon, authenticated;   -- service role only

-- 2. A live curriculum stays frozen for people (content, confirmations, deletions), with ONE exception: the system may ADD a new evidence-checked AI
--    suggestion (status SUGGESTED, source AI_SUGGESTED) to a course or outcome of a published curriculum. It can never change or remove anything already there.
create or replace function public.guard_frozen_by_course()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare c_old uuid; c_new uuid;
begin
  if tg_op = 'INSERT'
     and tg_table_name in ('course_skill_mappings', 'course_outcome_skill_mappings')
     and new.status = 'SUGGESTED' and new.mapping_source = 'AI_SUGGESTED' then
    return new;
  end if;
  if tg_op <> 'INSERT' then
    select import_id into c_old from public.courses where id = old.course_id;
  end if;
  if tg_op <> 'DELETE' then
    select import_id into c_new from public.courses where id = new.course_id;
  end if;
  if (c_old is not null and public.curriculum_import_is_frozen(c_old)) or (c_new is not null and public.curriculum_import_is_frozen(c_new)) then
    raise exception 'This curriculum is published and cannot be edited; create a new import instead.' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $function$;
