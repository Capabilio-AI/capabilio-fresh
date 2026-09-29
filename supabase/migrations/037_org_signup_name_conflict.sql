-- institutions.name is UNIQUE (case-sensitive), so a company cannot reuse an institution's exact name
-- (and vice versa). Fail explicitly instead of a raw unique-violation; never link across org types.
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
    if exists (select 1 from public.institutions i where lower(i.name) = lower(clean_name)) then
      raise exception 'name_taken_other_type';
    end if;
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
