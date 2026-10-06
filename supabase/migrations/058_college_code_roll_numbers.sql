-- Each college has one unique code; a student's roll number must start with it. A student whose roll number is missing or
-- doesn't start with their college's code is FLAGGED (never blocked) so staff can see they may not belong to that college.

alter table public.institutions add column if not exists college_code text;
alter table public.institutions drop constraint if exists institutions_college_code_format;
alter table public.institutions add constraint institutions_college_code_format check (college_code is null or college_code ~ '^[A-Z0-9]{2,12}$');
create unique index if not exists institutions_college_code_key on public.institutions (college_code) where college_code is not null;

alter table public.institution_memberships add column if not exists roll_number text;
alter table public.institution_memberships add column if not exists roll_number_status text not null default 'unchecked';
alter table public.institution_memberships drop constraint if exists membership_roll_status_check;
alter table public.institution_memberships add constraint membership_roll_status_check check (roll_number_status in ('unchecked', 'verified', 'flagged'));

-- unchecked: the college has set no code yet (or this is an education-history row); verified: roll number starts with the code; flagged: missing or different.
create or replace function public.roll_number_status_for(p_institution uuid, p_roll text)
returns text language sql stable security definer set search_path to '' as $$
  select case
    when i.college_code is null then 'unchecked'
    when p_roll is null then 'flagged'
    when left(upper(p_roll), length(i.college_code)) = i.college_code then 'verified'
    else 'flagged'
  end
  from public.institutions i where i.id = p_institution;
$$;

-- Always recomputed on write, so a client can never set its own status.
create or replace function public.membership_roll_number_check()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  new.roll_number := nullif(upper(btrim(new.roll_number)), '');
  if new.role = 'student' and new.branch is not null then
    new.roll_number_status := coalesce(public.roll_number_status_for(new.institution_id, new.roll_number), 'unchecked');
  else
    new.roll_number_status := 'unchecked';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_membership_roll_number on public.institution_memberships;
create trigger trg_membership_roll_number before insert or update on public.institution_memberships
  for each row execute function public.membership_roll_number_check();

-- Setting or changing a college's code re-checks every student already there.
create or replace function public.institution_code_recheck()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.college_code is distinct from old.college_code then
    update public.institution_memberships set roll_number = roll_number where institution_id = new.id and role = 'student';
  end if;
  return null;
end;
$$;
drop trigger if exists trg_institution_code_recheck on public.institutions;
create trigger trg_institution_code_recheck after update of college_code on public.institutions
  for each row execute function public.institution_code_recheck();

-- Signup: carry the roll number from the form (unchanged otherwise).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  resolved_role public.app_role := 'student';
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

  insert into public.profiles (id, email, full_name, primary_role)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''), resolved_role);

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
