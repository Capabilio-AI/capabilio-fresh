-- A group may submit before it is full. While it is still forming, only its lead can submit, and doing so closes the group to new members
-- (a submitted group no longer takes join requests). A full group is unchanged: any member can submit.
create or replace function public.class_submit_project(p_user_id uuid, p_group_id uuid, p_link text, p_attachments jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
  files jsonb := coalesce(p_attachments, '[]'::jsonb);
  my_role text;
begin
  select * into grp from public.class_project_groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found'; end if;
  select role into my_role from public.class_project_group_members where group_id = p_group_id and user_id = p_user_id;
  if my_role is null then raise exception 'not_a_member'; end if;
  select * into proj from public.class_projects where id = grp.project_id;
  if proj.submission_type <> 'in_app' then raise exception 'physical_submission_only'; end if;
  if proj.status <> 'open' then raise exception 'project_closed'; end if;
  if grp.status = 'graded' then raise exception 'group_locked'; end if;
  if grp.status = 'forming' and my_role <> 'lead' then raise exception 'lead_must_submit'; end if;
  if nullif(btrim(coalesce(p_link, '')), '') is null and jsonb_array_length(files) = 0 then raise exception 'submission_empty'; end if;
  insert into public.class_submissions (group_id, submission_type, link_url, attachments, submitted_by_user_id)
  values (p_group_id, 'in_app', nullif(btrim(coalesce(p_link, '')), ''), files, p_user_id)
  on conflict (group_id) do update set link_url = excluded.link_url, attachments = excluded.attachments, submitted_by_user_id = excluded.submitted_by_user_id, submitted_at = now();
  update public.class_project_groups set status = 'submitted' where id = p_group_id;
  -- nobody can join or be asked for a mentor on a closed group: end their waiting requests
  update public.class_group_join_requests set status = 'cancelled', decided_at = now() where group_id = p_group_id and status = 'pending';
end;
$function$;

revoke all on function public.class_submit_project(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.class_submit_project(uuid, uuid, text, jsonb) to service_role;
