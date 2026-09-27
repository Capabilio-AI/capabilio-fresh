-- Rename institutions -> organisations, institution_memberships ->
-- organisation_memberships, and recreate the three dependent functions
-- (handle_new_user, get_or_create_institution -> get_or_create_organisation,
-- get_or_start_section) against the new names.
--
-- STATUS: NOT APPLIED. This exact SQL was staged for direct application to
-- production (docs/platform-evolution/01-database-changes.md) and was
-- blocked by Claude Code's own safety classifier as a destructive-looking
-- production DDL action (table rename + function drop), independent of the
-- user's prior approval to proceed. It needs to be run manually — Supabase
-- SQL editor or `supabase db push` — when you're ready.
--
-- Every function body below is an exact port of the LIVE definition,
-- captured via pg_get_functiondef() immediately before this file was
-- written (see docs/platform-evolution/00-implementation-audit.md) — same
-- logic, only institutions/institution_memberships/institution_id renamed.
-- RLS policies are attached to the table's OID, not its name, and survive
-- the rename automatically (verified: none of the 4 existing policies on
-- these two tables reference the table name in qual/with_check — only
-- auth.uid() = user_id and true).
--
-- IMPORTANT: application code (lib/dashboard/viewer.ts, lib/dashboard/data.ts,
-- lib/assessment/attempts.ts, components/login/auth.ts,
-- components/login/CollegeAutocomplete.tsx, components/login/InstitutionPicker.tsx,
-- app/api/v1/students/[studentId]/state/route.ts) still reference
-- institutions/institution_memberships/institution_id, because the database
-- hasn't been renamed yet. Update those files in the SAME deploy as running
-- this migration — not before, not after — or signup/dashboard/assessment
-- will break.

begin;

alter table public.institutions rename to organisations;
alter table public.organisations rename constraint institutions_pkey to organisations_pkey;
alter table public.organisations add column org_type text not null default 'education'
  check (org_type in ('education', 'workforce'));

alter table public.institution_memberships rename to organisation_memberships;
alter table public.organisation_memberships rename column institution_id to organisation_id;
alter table public.organisation_memberships
  rename constraint institution_memberships_institution_id_fkey to organisation_memberships_organisation_id_fkey;
alter table public.organisation_memberships
  rename constraint institution_memberships_user_id_fkey to organisation_memberships_user_id_fkey;

create or replace function public.get_or_create_organisation(institution_name text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  clean_name text := btrim(regexp_replace(institution_name, '\s+', ' ', 'g'));
  generated_slug text;
  found_id uuid;
begin
  if clean_name is null or char_length(clean_name) < 2 or char_length(clean_name) > 200 then
    raise exception 'Institution name must be between 2 and 200 characters';
  end if;

  select id into found_id
  from public.organisations
  where lower(name) = lower(clean_name)
  limit 1;

  if found_id is not null then
    return found_id;
  end if;

  generated_slug := trim(both '-' from lower(regexp_replace(clean_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if generated_slug = '' then
    generated_slug := 'institution';
  end if;

  while exists (select 1 from public.organisations where slug = generated_slug) loop
    generated_slug := generated_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.organisations (name, slug, org_type)
  values (clean_name, generated_slug, 'education')
  returning id into found_id;

  return found_id;
end;
$function$;

drop function public.get_or_create_institution(text);

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  resolved_role public.app_role;
  college_name text := nullif(btrim(new.raw_user_meta_data ->> 'college_name'), '');
  branch_name text := nullif(btrim(new.raw_user_meta_data ->> 'branch'), '');
  study_year text := nullif(btrim(new.raw_user_meta_data ->> 'year'), '');
  resolved_organisation_id uuid;
begin
  if requested_role is not null and requested_role in (
    'student', 'faculty', 'hod', 'principal', 'vice_principal', 'ceo', 'mentor', 'professional'
  ) then
    resolved_role := requested_role::public.app_role;
  else
    resolved_role := 'student';
  end if;

  insert into public.profiles (id, email, full_name, primary_role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    resolved_role
  );

  if college_name is not null then
    resolved_organisation_id := public.get_or_create_organisation(college_name);

    insert into public.organisation_memberships (user_id, organisation_id, role, branch, year)
    values (new.id, resolved_organisation_id, resolved_role, branch_name, study_year);
  end if;

  return new;
end;
$function$;

create or replace function public.get_or_start_section(p_section assessment_section)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_attempt_id uuid;
  v_status public.section_progress_status;
  v_question_order uuid[];
  v_current_index smallint;
  v_result jsonb;
  v_college_type public.college_type;
  v_branch text;
  v_limit int;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_attempt_id from public.assessment_attempts where user_id = v_caller;
  if v_attempt_id is null then
    raise exception 'Assessment not started';
  end if;

  select status, question_order, current_index
    into v_status, v_question_order, v_current_index
  from public.assessment_section_progress
  where attempt_id = v_attempt_id and section = p_section;

  if not found then
    v_limit := case p_section
      when 'programming_fundamentals' then 15
      when 'engineering_mathematics' then 20
      else 25
    end;

    select o.college_type, om.branch into v_college_type, v_branch
    from public.organisation_memberships om
    join public.organisations o on o.id = om.organisation_id
    where om.user_id = v_caller
    limit 1;

    with candidates as (
      select id, 1 as tier from public.question_bank
      where section = p_section and active = true
        and v_college_type is not null and v_branch is not null
        and college_type = v_college_type and branches @> array[v_branch]
      union all
      select id, 2 as tier from public.question_bank
      where section = p_section and active = true
        and v_college_type is not null
        and college_type = v_college_type and branches is null
      union all
      select id, 3 as tier from public.question_bank
      where section = p_section and active = true
        and college_type is null and branches is null
    ),
    deduped as (
      select id, min(tier) as tier from candidates group by id
    ),
    ranked as (
      select id from deduped order by tier, random() limit v_limit
    )
    select coalesce(array_agg(id), '{}') into v_question_order from ranked;

    insert into public.assessment_section_progress
      (attempt_id, user_id, section, status, question_order, started_at)
    values
      (v_attempt_id, v_caller, p_section, 'in_progress', v_question_order, now());

    v_status := 'in_progress';
    v_current_index := 0;
  end if;

  select jsonb_build_object(
    'status', v_status,
    'currentIndex', v_current_index,
    'questions', coalesce(jsonb_agg(
      jsonb_build_object(
        'index', ord.idx - 1,
        'id', qb.id,
        'questionKind', qb.question_kind,
        'questionText', qb.question_text,
        'options', qb.options,
        'language', qb.language,
        'starterCode', qb.starter_code,
        'stdin', qb.stdin,
        'answeredOption', ar.selected_option,
        'correctOption', case when ar.selected_option is not null then qb.correct_option else null end,
        'isCorrect', ar.is_correct
      ) order by ord.idx
    ), '[]'::jsonb)
  ) into v_result
  from unnest(v_question_order) with ordinality as ord(id, idx)
  join public.question_bank qb on qb.id = ord.id
  left join public.assessment_responses ar
    on ar.attempt_id = v_attempt_id and ar.section = p_section and ar.question_index = ord.idx - 1;

  return v_result;
end;
$function$;

commit;
