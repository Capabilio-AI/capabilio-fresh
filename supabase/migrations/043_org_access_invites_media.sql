-- Organisation Path, live-product pass: per-member permission sets, staff invitations, student join links,
-- college profile fields and public media storage.

-- ---------- permission sets ----------
-- null = the role's default set. Admin roles (principal / vice_principal) always hold every permission.
alter table public.institution_memberships add column permissions text[];
alter table public.institution_memberships add constraint institution_memberships_permissions_valid
  check (permissions is null or permissions <@ array['students','classroom','posts','page','placements','outcomes','insights','members','curriculum','chat']::text[]);

create or replace function public.org_effective_permissions(p_role public.app_role, p_permissions text[])
returns text[]
language sql
immutable
set search_path to ''
as $$
  select case
    when p_role in ('principal', 'vice_principal') then array['students','classroom','posts','page','placements','outcomes','insights','members','curriculum','chat']
    when p_permissions is not null then p_permissions
    when p_role in ('faculty', 'hod') then array['students','classroom','posts','chat']
    when p_role = 'tpo' then array['placements','outcomes','insights','chat']
    else array[]::text[]
  end;
$$;

-- Classroom actions now follow the 'classroom' permission instead of a fixed role list. Admins manage every
-- project of their institution; anyone else only projects they created.
create or replace function public.class_assert_staff_for_project(p_membership_id uuid, p_project public.class_projects)
returns public.institution_memberships
language plpgsql
stable
set search_path to ''
as $function$
declare
  mem public.institution_memberships;
begin
  select * into mem from public.institution_memberships where id = p_membership_id;
  if not found or mem.status <> 'active' or mem.institution_id <> p_project.institution_id then
    raise exception 'forbidden';
  end if;
  if not ('classroom' = any(public.org_effective_permissions(mem.role, mem.permissions))) then
    raise exception 'forbidden';
  end if;
  if mem.role in ('principal', 'vice_principal') or p_project.created_by_membership_id = mem.id then
    return mem;
  end if;
  raise exception 'forbidden';
end;
$function$;

-- ---------- staff invitations ----------
create table public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 5 and 254),
  role public.app_role not null check (role in ('faculty', 'hod', 'tpo', 'vice_principal')),
  permissions text[] check (permissions is null or permissions <@ array['students','classroom','posts','page','placements','outcomes','insights','members','curriculum','chat']::text[]),
  token_hash text not null unique,
  invited_by_membership_id uuid references public.institution_memberships(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index org_invitations_open_idx on public.org_invitations (institution_id, email) where accepted_at is null and revoked_at is null;

-- ---------- student join links ----------
create table public.org_join_links (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8,32}$'),
  label text check (char_length(label) <= 80),
  branch text check (char_length(branch) <= 200),
  end_year smallint check (end_year between 1980 and 2100),
  created_by_membership_id uuid references public.institution_memberships(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.org_join_link_uses (
  join_link_id uuid not null references public.org_join_links(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (join_link_id, user_id)
);

-- ---------- college profile ----------
alter table public.org_profiles add column tagline text check (char_length(tagline) <= 160);
alter table public.org_profiles add column logo_url text check (logo_url ~ '^https?://' and char_length(logo_url) <= 2000);
alter table public.org_profiles add column founded_year smallint check (founded_year between 1800 and 2100);

-- Public read for college pictures; writes only through the server (service role) after an authority check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-media', 'org-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['org_invitations', 'org_join_links', 'org_join_link_uses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- signup: attribute a student to the join link they used ----------
-- (unchanged behaviour otherwise; the attribution can never fail a signup)
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
