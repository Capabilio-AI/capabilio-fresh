-- Organisation signup (docs/org-onboarding-audit.md). Prod's latest applied migration was 035;
-- 029 is intentionally untouched.

-- 1. Roles for the org-side contact who is not a principal/HOD (TPO) and for company accounts
--    (`company_admin` matches the existing RBAC roles key). Not used in this migration.
alter type public.app_role add value if not exists 'tpo';
alter type public.app_role add value if not exists 'company_admin';

-- 2. Pending-by-default: only self-serve roles are auto-active; every other (incl. future) role is pending.
create or replace function public.role_requires_verification(role public.app_role)
returns boolean
language sql
immutable
set search_path to ''
as $$ select role not in ('student', 'professional'); $$;

-- 3. Institution vs Company.
alter table public.institutions
  add column if not exists org_type text not null default 'institution'
  check (org_type in ('institution', 'company'));

-- 4. handle_new_user: metadata `role` is client-controlled, so it is no longer honoured at all —
--    every self-created auth user is a student. Org accounts are created only by create_org_signup.
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
    insert into public.institution_memberships (user_id, institution_id, role, branch, year, start_year, end_year)
    values (new.id, resolved_institution_id, resolved_role, branch_name, study_year, parsed_start, parsed_end);
  end if;

  return new;
end;
$function$;

-- 5. Atomic org signup. Service role only. Exact (case-insensitive, whitespace-collapsed) name match
--    within the same org_type, else create. No fuzzy matching. Status comes from set_membership_status.
create or replace function public.create_org_signup(p_user_id uuid, p_org_name text, p_org_type text, p_role public.app_role)
returns table (institution_id uuid, membership_id uuid, matched_existing boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  clean_name text := btrim(regexp_replace(p_org_name, '\s+', ' ', 'g'));
  found_id uuid;
  was_match boolean := true;
  new_membership uuid;
  generated_slug text;
begin
  if p_org_type not in ('institution', 'company') then
    raise exception 'invalid org type';
  end if;
  if not ((p_org_type = 'institution' and p_role in ('principal', 'vice_principal', 'hod', 'tpo'))
       or (p_org_type = 'company' and p_role = 'company_admin')) then
    raise exception 'role not allowed for org type';
  end if;
  if clean_name is null or char_length(clean_name) < 2 or char_length(clean_name) > 200 then
    raise exception 'Organisation name must be between 2 and 200 characters';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and primary_role = 'student') then
    raise exception 'unknown or already-promoted user';
  end if;

  select i.id into found_id from public.institutions i
  where lower(i.name) = lower(clean_name) and i.org_type = p_org_type
  order by i.created_at, i.id limit 1;

  if found_id is null then
    was_match := false;
    generated_slug := trim(both '-' from lower(regexp_replace(clean_name, '[^a-zA-Z0-9]+', '-', 'g')));
    if generated_slug = '' then generated_slug := 'organisation'; end if;
    while exists (select 1 from public.institutions where slug = generated_slug) loop
      generated_slug := generated_slug || '-' || substr(md5(random()::text), 1, 4);
    end loop;
    insert into public.institutions (name, slug, org_type) values (clean_name, generated_slug, p_org_type)
    returning id into found_id;
  end if;

  update public.profiles set primary_role = p_role where id = p_user_id;
  insert into public.institution_memberships (user_id, institution_id, role)
  values (p_user_id, found_id, p_role) returning id into new_membership;

  return query select found_id, new_membership, was_match;
end;
$function$;

revoke all on function public.create_org_signup(uuid, text, text, public.app_role) from public, anon, authenticated;
grant execute on function public.create_org_signup(uuid, text, text, public.app_role) to service_role;
