-- Job-track career-direction loop (docs/job-track-audit.md, Phase 2).
-- Additive only. Also brings handle_new_user into the repo (it previously
-- existed only in production) and extends it to capture start/end year.
--
-- Writes to the new membership columns are server-only: institution_memberships
-- has no UPDATE policy (RLS default-deny for authenticated), so only the service
-- role used by our API routes can change goal_state / year_* / active_role_key.

alter table public.institutions
  add column if not exists academic_start_month smallint not null default 7
    check (academic_start_month between 1 and 12);

alter table public.institution_memberships
  add column if not exists goal_state text
    check (goal_state is null or goal_state in ('entrepreneur', 'higher_studies', 'job', 'not_sure')),
  add column if not exists goal_state_updated_at timestamptz,
  add column if not exists goal_state_prompted_at timestamptz,
  add column if not exists higher_studies_checkin_at timestamptz,
  add column if not exists year_confirmed_at timestamptz,
  add column if not exists year_override smallint check (year_override is null or year_override between 1 and 8),
  add column if not exists active_role_key text references public.arena_domain_roles(role_key),
  add column if not exists portfolio_prompt_seen_at timestamptz;

-- NOTE: the backfill below was REVERTED by 032_revert_label_year_inference.sql (inference judged
-- unreliable). It is kept here as applied history.
-- Backfill: legacy "<year>-<semester>" label -> start/end year, only for
-- B.Tech-shaped student rows with no years yet. Computed from the membership's
-- creation date (the label was true at signup, not today). year_confirmed_at is
-- deliberately left NULL so the student confirms the derived value; rows that
-- are not derivable stay NULL and the student is asked to enter them.
update public.institution_memberships m
set start_year = s.start_year,
    end_year = s.start_year + 4
from (
  select m2.id,
         (case when extract(month from m2.created_at) >= i.academic_start_month
               then extract(year from m2.created_at)::int
               else extract(year from m2.created_at)::int - 1 end)
         - (split_part(m2.year, '-', 1)::int - 1) as start_year
  from public.institution_memberships m2
  join public.institutions i on i.id = m2.institution_id
  where m2.role = 'student'
    and m2.start_year is null
    and m2.end_year is null
    and m2.branch is not null
    and m2.year ~ '^[1-4]-[12]$'
    and (m2.degree is null or m2.degree ilike 'b.tech%')
) s
where m.id = s.id;

-- handle_new_user: same behavior as production plus start/end year. Years are
-- validated here (the only server-side point for direct client sign-ups);
-- invalid values become NULL, which the app treats as "needs to be entered".
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
  raw_start text := nullif(btrim(new.raw_user_meta_data ->> 'start_year'), '');
  raw_end text := nullif(btrim(new.raw_user_meta_data ->> 'end_year'), '');
  parsed_start smallint;
  parsed_end smallint;
  resolved_institution_id uuid;
begin
  if requested_role is not null and requested_role in (
    'student', 'faculty', 'hod', 'principal', 'vice_principal', 'ceo', 'mentor', 'professional'
  ) then
    resolved_role := requested_role::public.app_role;
  else
    resolved_role := 'student';
  end if;

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

  insert into public.profiles (id, email, full_name, primary_role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    resolved_role
  );

  if college_name is not null then
    resolved_institution_id := public.get_or_create_institution(college_name);

    insert into public.institution_memberships (user_id, institution_id, role, branch, year, start_year, end_year)
    values (new.id, resolved_institution_id, resolved_role, branch_name, study_year, parsed_start, parsed_end);
  end if;

  return new;
end;
$function$;
