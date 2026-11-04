-- The final submission can carry a written project report (up to 20,000 characters), alongside the link and files. An in-app submission needs at least one of the three.
alter table public.class_submissions add column if not exists report text;
alter table public.class_submissions drop constraint if exists class_submissions_report_check;
alter table public.class_submissions add constraint class_submissions_report_check check (report is null or char_length(report) <= 20000);
alter table public.class_submissions drop constraint if exists class_submissions_check;
alter table public.class_submissions add constraint class_submissions_check check (
  (submission_type = 'in_app' and (link_url is not null or jsonb_array_length(attachments) > 0 or nullif(btrim(coalesce(report, '')), '') is not null)) or submission_type = 'physical'
);

drop function if exists public.class_submit_project(uuid, uuid, text, jsonb);
create or replace function public.class_submit_project(p_user_id uuid, p_group_id uuid, p_link text, p_attachments jsonb default '[]'::jsonb, p_report text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  grp public.class_project_groups;
  proj public.class_projects;
  files jsonb := coalesce(p_attachments, '[]'::jsonb);
  text_report text := nullif(btrim(coalesce(p_report, '')), '');
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
  if nullif(btrim(coalesce(p_link, '')), '') is null and jsonb_array_length(files) = 0 and text_report is null then raise exception 'submission_empty'; end if;
  insert into public.class_submissions (group_id, submission_type, link_url, attachments, report, submitted_by_user_id)
  values (p_group_id, 'in_app', nullif(btrim(coalesce(p_link, '')), ''), files, text_report, p_user_id)
  on conflict (group_id) do update set link_url = excluded.link_url, attachments = excluded.attachments, report = excluded.report, submitted_by_user_id = excluded.submitted_by_user_id, submitted_at = now();
  update public.class_project_groups set status = 'submitted' where id = p_group_id;
  update public.class_group_join_requests set status = 'cancelled', decided_at = now() where group_id = p_group_id and status = 'pending';
end;
$function$;

revoke all on function public.class_submit_project(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.class_submit_project(uuid, uuid, text, jsonb, text) to service_role;
