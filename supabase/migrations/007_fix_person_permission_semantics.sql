-- STATUS: APPLIED to production 2026-09-27.
-- role_permissions.resource = 'person' means "may read/write/admin OTHER
-- people's records" — a person's OWN record is always accessible to them
-- and is never gated by this table (checked as a separate, unconditional
-- self-access shortcut in application code, e.g.
-- app/api/v1/students/[studentId]/state/route.ts). As seeded in 004, every
-- role including plain 'student' held a 'person'/'admin' grant, which would
-- incorrectly pass a cross-person authorization check for a student. Only
-- roles that legitimately look at OTHER people's records keep this grant.

delete from public.role_permissions
where resource = 'person'
  and role_id in (
    select id from public.roles where key in ('student', 'graduate', 'professional', 'executive')
  );
