-- Mentorship: a group asks a staff member (faculty or HoD) to mentor it; the staff member accepts, or rejects with a reason the students can read.
-- Also: staff can place a student who has not joined any group into a forming group. Written only through the server (service role).
create table public.class_group_mentor_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_project_groups(id) on delete cascade,
  project_id uuid not null references public.class_projects(id) on delete cascade,
  requested_by_user_id uuid not null references public.profiles(id) on delete cascade,
  mentor_membership_id uuid not null references public.institution_memberships(id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) between 3 and 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (group_id, mentor_membership_id)
);
create unique index class_group_one_mentor on public.class_group_mentor_requests (group_id) where status = 'accepted';
create index class_group_mentor_requests_mentor_idx on public.class_group_mentor_requests (mentor_membership_id, status);
create index class_group_mentor_requests_project_idx on public.class_group_mentor_requests (project_id, status);
alter table public.class_group_mentor_requests enable row level security;
revoke all on public.class_group_mentor_requests from anon, authenticated;

-- A member of the group asks one staff member. At most 3 requests wait at a time, and a group has one mentor.
create or replace function public.class_request_mentor(p_user_id uuid, p_group_id uuid, p_mentor_membership_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
  mem public.institution_memberships;
  existing public.class_group_mentor_requests;
  req_id uuid;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  if not exists (select 1 from public.class_project_group_members where group_id = p_group_id and user_id = p_user_id) then
    raise exception 'not_a_member';
  end if;
  if grp.status in ('submitted', 'graded') then raise exception 'group_locked'; end if;
  select * into proj from public.class_projects where id = grp.project_id;
  select * into mem from public.institution_memberships where id = p_mentor_membership_id;
  if not found or mem.status <> 'active' or mem.institution_id <> proj.institution_id or mem.role not in ('faculty', 'hod') or mem.user_id = p_user_id then
    raise exception 'invalid_mentor';
  end if;
  if exists (select 1 from public.class_group_mentor_requests where group_id = p_group_id and status = 'accepted') then raise exception 'group_has_mentor'; end if;
  if (select count(*) from public.class_group_mentor_requests where group_id = p_group_id and status = 'pending') >= 3 then raise exception 'too_many_requests'; end if;

  select * into existing from public.class_group_mentor_requests where group_id = p_group_id and mentor_membership_id = p_mentor_membership_id;
  if found then
    if existing.status = 'rejected' then raise exception 'mentor_request_rejected'; end if;
    if existing.status = 'pending' then return existing.id; end if;
    update public.class_group_mentor_requests set status = 'pending', message = nullif(btrim(p_message), ''), requested_by_user_id = p_user_id, created_at = now(), decided_at = null where id = existing.id;
    return existing.id;
  end if;
  insert into public.class_group_mentor_requests (group_id, project_id, requested_by_user_id, mentor_membership_id, message)
  values (p_group_id, proj.id, p_user_id, p_mentor_membership_id, nullif(btrim(p_message), '')) returning id into req_id;
  return req_id;
end;
$function$;

-- The asked staff member accepts, or rejects with a reason (3 to 500 characters).
create or replace function public.class_decide_mentor_request(p_user_id uuid, p_request_id uuid, p_accept boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  req public.class_group_mentor_requests;
  mem public.institution_memberships;
  why text := btrim(coalesce(p_reason, ''));
begin
  select * into req from public.class_group_mentor_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  select * into mem from public.institution_memberships where id = req.mentor_membership_id;
  if not found or mem.user_id <> p_user_id or mem.status <> 'active' then raise exception 'forbidden'; end if;
  if req.status <> 'pending' then raise exception 'request_not_pending'; end if;
  if p_accept then
    if exists (select 1 from public.class_group_mentor_requests where group_id = req.group_id and status = 'accepted') then raise exception 'group_has_mentor'; end if;
    update public.class_group_mentor_requests set status = 'accepted', decided_at = now() where id = req.id;
    update public.class_group_mentor_requests set status = 'cancelled', decided_at = now() where group_id = req.group_id and status = 'pending' and id <> req.id;
  else
    if char_length(why) < 3 then raise exception 'reason_required'; end if;
    update public.class_group_mentor_requests set status = 'rejected', reject_reason = left(why, 500), decided_at = now() where id = req.id;
  end if;
end;
$function$;

create or replace function public.class_cancel_mentor_request(p_user_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  req public.class_group_mentor_requests;
begin
  select * into req from public.class_group_mentor_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if req.requested_by_user_id <> p_user_id then raise exception 'forbidden'; end if;
  if req.status <> 'pending' then raise exception 'request_not_pending'; end if;
  update public.class_group_mentor_requests set status = 'cancelled', decided_at = now() where id = req.id;
end;
$function$;

-- Staff place a student who is in no group into a forming group. The usual join rules run again (scope, free slot, project open).
create or replace function public.class_staff_add_member(p_membership_id uuid, p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
begin
  select * into grp from public.class_project_groups where id = p_group_id;
  if not found then raise exception 'group_not_found'; end if;
  select * into proj from public.class_projects where id = grp.project_id;
  perform public.class_assert_staff_for_project(p_membership_id, proj);
  perform public.class_join_group(p_user_id, p_group_id);
  update public.class_group_join_requests set status = 'cancelled', decided_at = now()
    where project_id = proj.id and user_id = p_user_id and status = 'pending';
end;
$function$;

do $$
declare f text;
begin
  foreach f in array array['class_request_mentor(uuid, uuid, uuid, text)', 'class_decide_mentor_request(uuid, uuid, boolean, text)', 'class_cancel_mentor_request(uuid, uuid)', 'class_staff_add_member(uuid, uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
