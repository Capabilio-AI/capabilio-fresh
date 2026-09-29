-- Organisation Path, Module B: classroom & project system (docs/org-path-audit.md).
-- All tables are private to the service role (RLS on, no client policies). Every write goes through an
-- API route that derives institution + role from the caller's ACTIVE membership; atomic state changes
-- are the SECURITY DEFINER functions below (service_role only).
-- Existing `projects`/`posts` tables belong to other features, hence the class_ prefix.

-- Faculty may apply through org signup (pending; approved in-app by an org admin, or by the operator).
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
  if not ((p_org_type = 'institution' and p_role in ('principal', 'vice_principal', 'hod', 'tpo', 'faculty'))
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

-- ---------- tables ----------
create table public.class_materials (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid references public.curriculum_subjects(id) on delete set null,
  author_membership_id uuid not null references public.institution_memberships(id) on delete cascade,
  type text not null check (type in ('notes', 'pdf', 'link')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  body text check (char_length(body) <= 20000),
  url text check (url ~ '^https?://' and char_length(url) <= 2000),
  branch text not null check (char_length(btrim(branch)) between 1 and 200),
  year smallint not null check (year between 1 and 6),
  published_at timestamptz not null default now(),
  check ((type = 'notes' and body is not null) or (type <> 'notes' and url is not null))
);
create index class_materials_scope_idx on public.class_materials (institution_id, branch, year);

create table public.class_projects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_by_membership_id uuid not null references public.institution_memberships(id) on delete cascade,
  subject_id uuid references public.curriculum_subjects(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  brief text not null check (char_length(brief) between 1 and 10000),
  department_scope text[],
  team_size smallint not null default 4 check (team_size between 2 and 6),
  submission_type text not null check (submission_type in ('in_app', 'physical')),
  weekly_report_required boolean not null default true,
  starts_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  check (deadline_at > starts_at)
);
create index class_projects_institution_idx on public.class_projects (institution_id, status);

create table public.class_project_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.class_projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  status text not null default 'forming' check (status in ('forming', 'active', 'submitted', 'graded')),
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index class_project_groups_project_idx on public.class_project_groups (project_id);

create table public.class_project_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_project_groups(id) on delete cascade,
  project_id uuid not null references public.class_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  branch text,
  role text not null default 'member' check (role in ('lead', 'member')),
  joined_at timestamptz not null default now(),
  unique (project_id, user_id),
  unique (group_id, user_id)
);

create table public.class_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_project_groups(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  submitted_by_user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  attachment_url text check (attachment_url ~ '^https?://' and char_length(attachment_url) <= 2000),
  submitted_at timestamptz not null default now(),
  staff_feedback text check (char_length(staff_feedback) <= 3000),
  staff_seen_at timestamptz,
  unique (group_id, week_number)
);

create table public.class_submissions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.class_project_groups(id) on delete cascade,
  submission_type text not null check (submission_type in ('in_app', 'physical')),
  link_url text check (link_url ~ '^https?://' and char_length(link_url) <= 2000),
  submitted_by_user_id uuid references public.profiles(id) on delete set null,
  physical_confirmed_by_membership_id uuid references public.institution_memberships(id) on delete set null,
  submitted_at timestamptz not null default now(),
  check ((submission_type = 'in_app' and link_url is not null)
      or (submission_type = 'physical' and physical_confirmed_by_membership_id is not null))
);

create table public.class_project_grades (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.class_project_groups(id) on delete cascade,
  graded_by_membership_id uuid not null references public.institution_memberships(id) on delete cascade,
  grade text not null check (char_length(btrim(grade)) between 1 and 10),
  feedback text check (char_length(feedback) <= 5000),
  member_contribution_notes jsonb not null default '{}'::jsonb,
  graded_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['class_materials','class_projects','class_project_groups','class_project_group_members',
                           'class_weekly_reports','class_submissions','class_project_grades'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- state-changing functions (service_role only) ----------
-- Shared: the student's branch iff they are an ACTIVE student at the project's institution and the
-- project's department scope (if any) includes it. Raises a coded error otherwise.
create or replace function public.class_student_branch_for_project(p_user_id uuid, p_project public.class_projects)
returns text
language plpgsql
stable
set search_path to ''
as $function$
declare
  student_branch text;
begin
  select m.branch into student_branch
  from public.institution_memberships m
  where m.user_id = p_user_id and m.institution_id = p_project.institution_id
    and m.status = 'active' and m.role = 'student';
  if not found then raise exception 'not_a_student_of_institution'; end if;
  if p_project.department_scope is not null and cardinality(p_project.department_scope) > 0
     and not exists (select 1 from unnest(p_project.department_scope) s where lower(btrim(s)) = lower(btrim(coalesce(student_branch, '')))) then
    raise exception 'department_not_in_scope';
  end if;
  return student_branch;
end;
$function$;

create or replace function public.class_create_group(p_user_id uuid, p_project_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  proj public.class_projects;
  student_branch text;
  new_group uuid;
begin
  select * into proj from public.class_projects where id = p_project_id;
  if not found then raise exception 'project_not_found'; end if;
  if proj.status <> 'open' or now() > proj.deadline_at then raise exception 'project_closed'; end if;
  student_branch := public.class_student_branch_for_project(p_user_id, proj);
  if exists (select 1 from public.class_project_group_members where project_id = p_project_id and user_id = p_user_id) then
    raise exception 'already_in_group';
  end if;
  insert into public.class_project_groups (project_id, name, created_by_user_id)
  values (p_project_id, btrim(p_name), p_user_id) returning id into new_group;
  insert into public.class_project_group_members (group_id, project_id, user_id, branch, role)
  values (new_group, p_project_id, p_user_id, student_branch, 'lead');
  return new_group;
end;
$function$;

create or replace function public.class_join_group(p_user_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
  student_branch text;
  member_count int;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  select * into proj from public.class_projects where id = grp.project_id;
  if proj.status <> 'open' or now() > proj.deadline_at then raise exception 'project_closed'; end if;
  if grp.status <> 'forming' then raise exception 'group_not_forming'; end if;
  student_branch := public.class_student_branch_for_project(p_user_id, proj);
  if exists (select 1 from public.class_project_group_members where project_id = proj.id and user_id = p_user_id) then
    raise exception 'already_in_group';
  end if;
  select count(*) into member_count from public.class_project_group_members where group_id = p_group_id;
  if member_count >= proj.team_size then raise exception 'group_full'; end if;
  insert into public.class_project_group_members (group_id, project_id, user_id, branch)
  values (p_group_id, proj.id, p_user_id, student_branch);
  if member_count + 1 >= proj.team_size then
    update public.class_project_groups set status = 'active' where id = p_group_id;
  end if;
end;
$function$;

create or replace function public.class_leave_group(p_user_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  remaining int;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  if grp.status in ('submitted', 'graded') then raise exception 'group_locked'; end if;
  delete from public.class_project_group_members where group_id = p_group_id and user_id = p_user_id;
  if not found then raise exception 'not_a_member'; end if;
  select count(*) into remaining from public.class_project_group_members where group_id = p_group_id;
  if remaining = 0 then
    delete from public.class_project_groups where id = p_group_id;
    return;
  end if;
  update public.class_project_group_members set role = 'lead'
  where id = (select id from public.class_project_group_members where group_id = p_group_id order by joined_at, id limit 1)
    and not exists (select 1 from public.class_project_group_members where group_id = p_group_id and role = 'lead');
  update public.class_project_groups set status = 'forming' where id = p_group_id;
end;
$function$;

create or replace function public.class_submit_project(p_user_id uuid, p_group_id uuid, p_link text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  if not exists (select 1 from public.class_project_group_members where group_id = p_group_id and user_id = p_user_id) then
    raise exception 'not_a_member';
  end if;
  select * into proj from public.class_projects where id = grp.project_id;
  if proj.submission_type <> 'in_app' then raise exception 'physical_submission_only'; end if;
  if proj.status <> 'open' then raise exception 'project_closed'; end if;
  if grp.status not in ('active', 'submitted') then raise exception 'group_not_ready'; end if;
  insert into public.class_submissions (group_id, submission_type, link_url, submitted_by_user_id)
  values (p_group_id, 'in_app', p_link, p_user_id)
  on conflict (group_id) do update set link_url = excluded.link_url, submitted_by_user_id = excluded.submitted_by_user_id, submitted_at = now();
  update public.class_project_groups set status = 'submitted' where id = p_group_id;
end;
$function$;

-- Staff/admin membership (ACTIVE) at the project's institution; staff (faculty/hod) only for their own projects.
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
  if mem.role in ('principal', 'vice_principal') then return mem; end if;
  if mem.role in ('faculty', 'hod') and p_project.created_by_membership_id = mem.id then return mem; end if;
  raise exception 'forbidden';
end;
$function$;

create or replace function public.class_mark_physical_received(p_membership_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  select * into proj from public.class_projects where id = grp.project_id;
  perform public.class_assert_staff_for_project(p_membership_id, proj);
  if proj.submission_type <> 'physical' then raise exception 'in_app_submission_only'; end if;
  if grp.status not in ('active', 'submitted') then raise exception 'group_not_ready'; end if;
  insert into public.class_submissions (group_id, submission_type, physical_confirmed_by_membership_id)
  values (p_group_id, 'physical', p_membership_id)
  on conflict (group_id) do update set physical_confirmed_by_membership_id = excluded.physical_confirmed_by_membership_id, submitted_at = now();
  update public.class_project_groups set status = 'submitted' where id = p_group_id;
end;
$function$;

-- Grade + one evidence row per member, atomically. The grade is staff input; nothing here is AI-assigned.
create or replace function public.class_grade_group(p_membership_id uuid, p_group_id uuid, p_grade text, p_feedback text, p_notes jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
  mem public.institution_memberships;
  grade_id uuid;
  sub public.class_submissions;
  member_total int;
  subject_name text;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  select * into proj from public.class_projects where id = grp.project_id;
  mem := public.class_assert_staff_for_project(p_membership_id, proj);
  if grp.status not in ('submitted', 'graded') then raise exception 'group_not_submitted'; end if;
  if char_length(btrim(coalesce(p_grade, ''))) not between 1 and 10 then raise exception 'invalid_grade'; end if;

  -- contribution notes may only name actual members
  if exists (select 1 from jsonb_object_keys(coalesce(p_notes, '{}'::jsonb)) k
             where not exists (select 1 from public.class_project_group_members gm where gm.group_id = p_group_id and gm.user_id::text = k)) then
    raise exception 'invalid_contribution_notes';
  end if;

  insert into public.class_project_grades (group_id, graded_by_membership_id, grade, feedback, member_contribution_notes)
  values (p_group_id, p_membership_id, btrim(p_grade), nullif(btrim(coalesce(p_feedback, '')), ''), coalesce(p_notes, '{}'::jsonb))
  on conflict (group_id) do update
    set grade = excluded.grade, feedback = excluded.feedback, member_contribution_notes = excluded.member_contribution_notes,
        graded_by_membership_id = excluded.graded_by_membership_id, graded_at = now()
  returning id into grade_id;

  select * into sub from public.class_submissions where group_id = p_group_id;
  select count(*) into member_total from public.class_project_group_members where group_id = p_group_id;
  select s.name into subject_name from public.curriculum_subjects s where s.id = proj.subject_id;

  insert into public.evidence (user_id, skill, source_type, confidence, evaluated_by, evidence_type, source_identifier, source_url, observed_at, metadata, analysis_version)
  select gm.user_id, 'Project Work', 'project', 'high', mem.user_id, 'staff_graded_project',
         'class-project-grade:' || grade_id::text || ':' || gm.user_id::text,
         sub.link_url, now(),
         jsonb_build_object('projectTitle', proj.title, 'gradedByRole', mem.role, 'grade', btrim(p_grade),
                            'groupSize', member_total, 'subject', subject_name, 'provenance', 'staff-verified',
                            'submission', case when sub.submission_type = 'physical' then 'physical — verified by staff' else 'link' end),
         'class-project.v1'
  from public.class_project_group_members gm where gm.group_id = p_group_id
  on conflict (user_id, source_type, source_identifier) where source_identifier is not null do update
    set confidence = excluded.confidence, evaluated_by = excluded.evaluated_by, source_url = excluded.source_url,
        observed_at = excluded.observed_at, metadata = excluded.metadata, analysis_version = excluded.analysis_version;

  update public.class_project_groups set status = 'graded' where id = p_group_id;
  return grade_id;
end;
$function$;

do $$
declare f text;
begin
  foreach f in array array[
    'class_create_group(uuid, uuid, text)', 'class_join_group(uuid, uuid)', 'class_leave_group(uuid, uuid)',
    'class_submit_project(uuid, uuid, text)', 'class_mark_physical_received(uuid, uuid)',
    'class_grade_group(uuid, uuid, text, text, jsonb)',
    'class_student_branch_for_project(uuid, public.class_projects)',
    'class_assert_staff_for_project(uuid, public.class_projects)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
