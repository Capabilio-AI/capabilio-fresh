-- Recently graduated accounts.
--  - profiles.student_status: 'student' (currently studying) or 'graduate'. Set once by handle_new_user() from the signup metadata;
--    clients cannot update it (it is not in the column grant from migration 031).
--  - graduate_resumes: what the server extracted from the resume a graduate uploaded (the file itself is not kept). Server-only.
--  - assess_sessions.focus_skill_ids: the role skills the resume claims, which the adaptive assessment tests a little more.
alter table public.profiles
  add column if not exists student_status text not null default 'student' check (student_status in ('student', 'graduate'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  resolved_role public.app_role := 'student';
  resolved_status text := case when new.raw_user_meta_data ->> 'student_status' = 'graduate' then 'graduate' else 'student' end;
  college_name text := nullif(btrim(new.raw_user_meta_data ->> 'college_name'), '');
  branch_name text := nullif(btrim(new.raw_user_meta_data ->> 'branch'), '');
  study_year text := nullif(btrim(new.raw_user_meta_data ->> 'year'), '');
  raw_start text := nullif(btrim(new.raw_user_meta_data ->> 'start_year'), '');
  raw_end text := nullif(btrim(new.raw_user_meta_data ->> 'end_year'), '');
  join_code text := nullif(btrim(new.raw_user_meta_data ->> 'join_code'), '');
  roll text := left(nullif(btrim(new.raw_user_meta_data ->> 'roll_number'), ''), 40);
  parsed_start smallint;
  parsed_end smallint;
  resolved_institution_id uuid;
begin
  if raw_start ~ '^[0-9]{4}$' and raw_end ~ '^[0-9]{4}$' then
    parsed_start := raw_start::smallint;
    parsed_end := raw_end::smallint;
    if parsed_start not between 1980 and 2100
       or parsed_end not between 1980 and 2100
       or parsed_end <= parsed_start
       or parsed_end - parsed_start > 8 then
      parsed_start := null;
      parsed_end := null;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, primary_role, student_status)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''), resolved_role, resolved_status);

  if college_name is not null then
    resolved_institution_id := public.get_or_create_institution(college_name);
    insert into public.institution_memberships (user_id, institution_id, role, branch, year, start_year, end_year, roll_number)
    values (new.id, resolved_institution_id, resolved_role, branch_name, study_year, parsed_start, parsed_end, roll);

    if join_code is not null then
      begin
        insert into public.org_join_link_uses (join_link_id, user_id)
        select l.id, new.id from public.org_join_links l
        where l.code = join_code and l.institution_id = resolved_institution_id and l.active
        on conflict do nothing;
      exception when others then
        null;
      end;
    end if;
  end if;

  return new;
end;
$function$;

create table public.graduate_resumes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  file_name text check (file_name is null or char_length(file_name) <= 255),
  extraction jsonb not null,
  skill_names text[] not null default '{}',
  model text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.graduate_resumes enable row level security;
revoke all on public.graduate_resumes from anon, authenticated;

alter table public.assess_sessions add column if not exists focus_skill_ids uuid[];
