-- Students attach images and PDFs to weekly reports and to the final project submission. Files live in a PRIVATE bucket (staff and the group read
-- them through short-lived signed links); each row keeps a small list of {path, name, contentType, size}. Written only through the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-files', 'project-files', false, 4194304, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

alter table public.class_weekly_reports add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.class_weekly_reports drop constraint if exists class_weekly_reports_attachments_check;
alter table public.class_weekly_reports add constraint class_weekly_reports_attachments_check check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5);

alter table public.class_submissions add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.class_submissions drop constraint if exists class_submissions_attachments_check;
alter table public.class_submissions add constraint class_submissions_attachments_check check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 5);
-- an in-app submission is a link, files, or both
alter table public.class_submissions drop constraint if exists class_submissions_check;
alter table public.class_submissions add constraint class_submissions_check check (
  (submission_type = 'in_app' and (link_url is not null or jsonb_array_length(attachments) > 0)) or submission_type = 'physical'
);

drop function if exists public.class_submit_project(uuid, uuid, text);
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
  if nullif(btrim(coalesce(p_link, '')), '') is null and jsonb_array_length(files) = 0 then raise exception 'submission_empty'; end if;
  insert into public.class_submissions (group_id, submission_type, link_url, attachments, submitted_by_user_id)
  values (p_group_id, 'in_app', nullif(btrim(coalesce(p_link, '')), ''), files, p_user_id)
  on conflict (group_id) do update set link_url = excluded.link_url, attachments = excluded.attachments, submitted_by_user_id = excluded.submitted_by_user_id, submitted_at = now();
  update public.class_project_groups set status = 'submitted' where id = p_group_id;
end;
$function$;

revoke all on function public.class_submit_project(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.class_submit_project(uuid, uuid, text, jsonb) to service_role;
