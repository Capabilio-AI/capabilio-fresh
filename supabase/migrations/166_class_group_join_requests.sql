-- Students ask to join a forming project group (from a link the lead shares, or from the open-groups list); the group's lead accepts or rejects.
-- Nobody joins a group directly any more. Written only through the server (service role) via the functions below.
create table public.class_group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.class_project_groups(id) on delete cascade,
  project_id uuid not null references public.class_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (group_id, user_id)
);
create index class_group_join_requests_project_idx on public.class_group_join_requests (project_id, status);
create index class_group_join_requests_user_idx on public.class_group_join_requests (user_id);
alter table public.class_group_join_requests enable row level security;
revoke all on public.class_group_join_requests from anon, authenticated;

-- A student asks to join. Same rules as joining (open project, forming group, in scope, not already grouped, a free slot); a declined request stays declined.
create or replace function public.class_request_join_group(p_user_id uuid, p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
  member_count int;
  existing public.class_group_join_requests;
  req_id uuid;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  select * into proj from public.class_projects where id = grp.project_id;
  if proj.status <> 'open' or now() > proj.deadline_at then raise exception 'project_closed'; end if;
  if grp.status <> 'forming' then raise exception 'group_not_forming'; end if;
  perform public.class_student_branch_for_project(p_user_id, proj);
  if exists (select 1 from public.class_project_group_members where project_id = proj.id and user_id = p_user_id) then
    raise exception 'already_in_group';
  end if;
  select count(*) into member_count from public.class_project_group_members where group_id = p_group_id;
  if member_count >= proj.team_size then raise exception 'group_full'; end if;

  select * into existing from public.class_group_join_requests where group_id = p_group_id and user_id = p_user_id;
  if found then
    if existing.status = 'rejected' then raise exception 'request_rejected'; end if;
    if existing.status = 'pending' then return existing.id; end if;
    update public.class_group_join_requests set status = 'pending', created_at = now(), decided_at = null where id = existing.id;
    return existing.id;
  end if;
  insert into public.class_group_join_requests (group_id, project_id, user_id) values (p_group_id, proj.id, p_user_id) returning id into req_id;
  return req_id;
end;
$function$;

-- The group's lead accepts (the student joins exactly as before, so every join rule is re-checked) or rejects.
create or replace function public.class_decide_join_request(p_user_id uuid, p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  req public.class_group_join_requests;
begin
  select * into req from public.class_group_join_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if not exists (select 1 from public.class_project_group_members where group_id = req.group_id and user_id = p_user_id and role = 'lead') then
    raise exception 'forbidden';
  end if;
  if req.status <> 'pending' then raise exception 'request_not_pending'; end if;
  if p_accept then
    perform public.class_join_group(req.user_id, req.group_id);
    update public.class_group_join_requests set status = 'accepted', decided_at = now() where id = req.id;
    update public.class_group_join_requests set status = 'cancelled', decided_at = now()
      where project_id = req.project_id and user_id = req.user_id and status = 'pending' and id <> req.id;
  else
    update public.class_group_join_requests set status = 'rejected', decided_at = now() where id = req.id;
  end if;
end;
$function$;

-- The student withdraws their own pending request.
create or replace function public.class_cancel_join_request(p_user_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  req public.class_group_join_requests;
begin
  select * into req from public.class_group_join_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if req.user_id <> p_user_id then raise exception 'forbidden'; end if;
  if req.status <> 'pending' then raise exception 'request_not_pending'; end if;
  update public.class_group_join_requests set status = 'cancelled', decided_at = now() where id = req.id;
end;
$function$;

do $$
declare f text;
begin
  foreach f in array array['class_request_join_group(uuid, uuid)', 'class_decide_join_request(uuid, uuid, boolean)', 'class_cancel_join_request(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
