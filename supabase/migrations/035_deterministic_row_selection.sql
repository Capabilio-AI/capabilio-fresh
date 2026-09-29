-- "Pick the first row" bugs (Job-Track review follow-up). Two SQL functions chose a row with
-- `limit 1` and no ORDER BY, so with more than one candidate the result was arbitrary.
--
-- 1. get_or_start_section: the student's college_type/branch (used to tier assessment questions)
--    came from an arbitrary membership — possibly an education-history row with no branch.
--    Now: prefer a row with a branch, then an active one, then the newest.
-- 2. get_or_create_institution: exact-name lookup was case-insensitive but the only unique index
--    is case-sensitive, so case-variant duplicates could exist and be picked arbitrarily.
--    Now: a unique index on lower(name) makes the lookup unambiguous (0 duplicates exist today,
--    verified before adding it), plus a deterministic order as defence in depth.

create unique index if not exists institutions_name_lower_key on public.institutions (lower(name));

create or replace function public.get_or_create_institution(institution_name text)
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
  from public.institutions
  where lower(name) = lower(clean_name)
  order by created_at, id
  limit 1;

  if found_id is not null then
    return found_id;
  end if;

  generated_slug := trim(both '-' from lower(regexp_replace(clean_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if generated_slug = '' then
    generated_slug := 'institution';
  end if;

  while exists (select 1 from public.institutions where slug = generated_slug) loop
    generated_slug := generated_slug || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.institutions (name, slug)
  values (clean_name, generated_slug)
  returning id into found_id;

  return found_id;
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

    select i.college_type, im.branch into v_college_type, v_branch
    from public.institution_memberships im
    join public.institutions i on i.id = im.institution_id
    where im.user_id = v_caller
    order by (im.branch is not null) desc, (im.status = 'active') desc, im.created_at desc, im.id
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
