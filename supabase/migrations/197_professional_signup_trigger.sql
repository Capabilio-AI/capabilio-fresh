-- Sign-up as a working professional, handled by the database like the other paths.
-- handle_new_user() now reads `path = 'professional'` from the sign-up details. Such an account is created on the professional path
-- (profiles.student_status = 'professional') together with its own rows: pro_profiles, the current job in pro_employment, and the
-- 7-day EPFO window in pro_verification. Everything else in the function is exactly as it was (migration 098).
-- The professional branch is wrapped so a problem there can never block a sign-up; the app repairs missing rows on first sign-in.
-- A client that sends student_status 'graduate' together with path 'professional' stays safe on the old function too.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  resolved_role public.app_role := 'student';
  is_professional boolean := new.raw_user_meta_data ->> 'path' = 'professional';
  resolved_status text := case
    when new.raw_user_meta_data ->> 'path' = 'professional' then 'professional'
    when new.raw_user_meta_data ->> 'student_status' = 'graduate' then 'graduate'
    else 'student' end;
  pro_employer text := left(nullif(btrim(new.raw_user_meta_data ->> 'employer_name'), ''), 120);
  pro_title text := left(nullif(btrim(new.raw_user_meta_data ->> 'job_title'), ''), 120);
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

  if is_professional then
    begin
      update public.profiles set employer_name = pro_employer, job_title = pro_title, stage_changed_at = now() where id = new.id;
      insert into public.pro_profiles (user_id, employer_name, job_title) values (new.id, pro_employer, pro_title) on conflict (user_id) do nothing;
      if pro_employer is not null and pro_title is not null then
        insert into public.pro_employment (user_id, employer_name, job_title, source) values (new.id, pro_employer, pro_title, 'entered');
      end if;
      insert into public.pro_verification (user_id, window_ends_at) values (new.id, now() + interval '7 days') on conflict (user_id) do nothing;
    exception when others then
      null;
    end;
  end if;

  if college_name is not null and not is_professional then
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
