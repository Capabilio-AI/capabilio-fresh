-- STATUS: APPLIED to production 2026-09-27.
-- Additive only: two new tables, no changes to any existing table, function,
-- or policy. See docs/platform-evolution/01-database-changes.md and
-- 03-authorization-matrix.md. Semantics of the 'person' resource grants
-- below were corrected in 007_fix_person_permission_semantics.sql.

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  scope text not null check (scope in ('platform', 'organisation')),
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  resource text not null,
  action text not null check (action in ('read', 'write', 'admin')),
  primary key (role_id, resource, action)
);

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
create policy roles_read_all on public.roles for select using (true);
create policy role_permissions_read_all on public.role_permissions for select using (true);

insert into public.roles (key, label, scope) values
  ('student', 'Student', 'organisation'),
  ('graduate', 'Graduate', 'organisation'),
  ('professional', 'Professional', 'organisation'),
  ('executive', 'Executive', 'organisation'),
  ('mentor', 'Mentor', 'organisation'),
  ('faculty', 'Faculty', 'organisation'),
  ('hod', 'HOD', 'organisation'),
  ('principal', 'Principal', 'organisation'),
  ('vice_principal', 'Vice Principal', 'organisation'),
  ('ceo', 'CEO', 'organisation'),
  ('university_admin', 'University Admin', 'organisation'),
  ('recruiter', 'Recruiter', 'organisation'),
  ('hiring_manager', 'Hiring Manager', 'organisation'),
  ('company_admin', 'Company Admin', 'organisation'),
  ('platform_admin', 'Platform Admin', 'platform');

insert into public.role_permissions (role_id, resource, action)
select r.id, v.resource, v.action
from public.roles r
join (values
  ('student', 'person', 'admin'), ('student', 'organisation', 'read'), ('student', 'opportunity', 'read'), ('student', 'evidence', 'admin'),
  ('graduate', 'person', 'admin'), ('graduate', 'organisation', 'read'), ('graduate', 'opportunity', 'read'), ('graduate', 'evidence', 'admin'),
  ('professional', 'person', 'admin'), ('professional', 'organisation', 'read'), ('professional', 'opportunity', 'read'), ('professional', 'evidence', 'admin'),
  ('executive', 'person', 'admin'), ('executive', 'organisation', 'read'), ('executive', 'opportunity', 'read'), ('executive', 'evidence', 'admin'),
  ('mentor', 'person', 'admin'), ('mentor', 'organisation', 'read'), ('mentor', 'evidence', 'admin'),
  ('faculty', 'person', 'admin'), ('faculty', 'organisation', 'read'), ('faculty', 'evidence', 'admin'),
  ('hod', 'person', 'admin'), ('hod', 'organisation', 'read'), ('hod', 'opportunity', 'read'), ('hod', 'evidence', 'admin'),
  ('principal', 'person', 'admin'), ('principal', 'organisation', 'admin'), ('principal', 'opportunity', 'read'), ('principal', 'evidence', 'admin'), ('principal', 'audit_logs', 'read'),
  ('vice_principal', 'person', 'admin'), ('vice_principal', 'organisation', 'admin'), ('vice_principal', 'opportunity', 'read'), ('vice_principal', 'evidence', 'admin'), ('vice_principal', 'audit_logs', 'read'),
  ('ceo', 'person', 'admin'), ('ceo', 'organisation', 'admin'), ('ceo', 'opportunity', 'read'), ('ceo', 'evidence', 'admin'), ('ceo', 'audit_logs', 'read'),
  ('university_admin', 'person', 'admin'), ('university_admin', 'organisation', 'admin'), ('university_admin', 'opportunity', 'read'), ('university_admin', 'evidence', 'admin'), ('university_admin', 'audit_logs', 'read'),
  ('recruiter', 'person', 'admin'), ('recruiter', 'organisation', 'read'), ('recruiter', 'opportunity', 'admin'),
  ('hiring_manager', 'person', 'admin'), ('hiring_manager', 'organisation', 'read'), ('hiring_manager', 'opportunity', 'read'),
  ('company_admin', 'person', 'admin'), ('company_admin', 'organisation', 'admin'), ('company_admin', 'opportunity', 'admin'), ('company_admin', 'audit_logs', 'read'),
  ('platform_admin', 'person', 'admin'), ('platform_admin', 'organisation', 'admin'), ('platform_admin', 'opportunity', 'admin'), ('platform_admin', 'evidence', 'admin'), ('platform_admin', 'audit_logs', 'admin')
) as v(role_key, resource, action) on v.role_key = r.key;
