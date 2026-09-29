# Organisation Path (Modules B, C, A) — Audit & Design

Spec: the "Organisation Path: Design & Architecture" companion doc (pasted into the task; the file itself is not in the repo).
Build order per spec: **B → C(5.2 placements) → C(5.1 insights) → A**.

## Audit (verified against prod)
- **Roles** (`app_role`): student, faculty, hod, principal, vice_principal, ceo, mentor, professional, tpo, company_admin. `institution_memberships` is UNIQUE(user_id, institution_id): **one role per person per institution** (spec: don't hard-code single role — the model is what it is; a person needing two hats gets the higher role; noted).
- **Spec role → app role mapping** (`lib/org/roles.ts`): staff = faculty, hod · org_admin = principal, vice_principal · tpo = tpo · student = student. Always derived from an ACTIVE membership, server-side.
- **Name collisions:** `projects`, `project_members`, `posts`, `post_likes`, `post_comments` already exist (older schema/Pulse). New tables are prefixed `class_*` (Module B) and `org_*` (Module A).
- **Reuse:** `curriculum_subjects` (subject FK for materials/projects), `institution_memberships.branch` (department), `opportunities` (already has `institution_id`, `created_by` — the spec's two new columns are unnecessary), `evidence` (source_type enum value `project` already exists; new evidence_type `staff_graded_project`), `recordEvidence` shape, `getOrgAdmin`/`can` RBAC, `institutions.slug` for public URLs, service-role-only tables with RLS on and no client policies (pattern of 033).
- **Gap found:** `opportunities` RLS is `read_all` — a private placement drive would be readable by anyone. Migration replaces it: institution_id null (platform-wide, unchanged) OR active member of that institution.
- **No storage for uploads** exists for this use; v1 uses links (materials/submissions/attachments/cover images are URLs). File upload deferred.
- **Invitations:** none. Faculty join through org signup (designation Faculty → pending) and are approved in-app by an org admin (`/org/members`); admin-level roles (principal/vice_principal) stay operator-approved only, so nobody can self-promote into admin by claiming an existing institution's name.
- **Bug fixed here:** login showed "Student Portal" for tpo (`getRole` fell back to student). Org roles added to `ROLES`, org roles route to `/org`.

## Decisions on the spec's open questions (its stated defaults)
Team size fixed 4 · cross-department permitted, not mandated · group-level grade + optional per-member notes · grade scale: free text ≤10 chars (numeric or letter, institution convention) · staff may publish their own posts (edit/delete own only) · public org page is **opt-in** (`is_public` default false) — the public page 404s until an admin publishes it.

## Authority model
All new tables: RLS on, **no client policies** (service role only). Every write is an API route that derives the institution and role from the caller's own active membership — never from the request. State transitions that need atomicity/locking are SECURITY DEFINER functions executable by service_role only: `class_create_group`, `class_join_group`, `class_leave_group`, `class_submit_project`, `class_grade_group` (grade + one evidence row per member, atomic).

## Evidence
`class_grade_group` upserts one `evidence` row per member: source_type `project`, evidence_type `staff_graded_project`, confidence `high` (staff-verified), skill "Project Work", source_identifier `class-project-grade:<grade_id>:<user_id>` (idempotent on re-grade), metadata {project_title, staff role, grade, group_size, subject}. Weekly reports never produce evidence. Not AI-assigned anywhere.

## Migrations (prod's latest applied: 037-equivalent `org_signup_name_conflict`; 029 untouched)
038 org_classroom (Module B tables + functions) · 039 org_placements_rls (opportunities policy) · 040 org_presence (Module A) · 041 faculty designation.

## Deferred (explicit)
File uploads · skill-area mapping of project evidence (uses "Project Work") · per-member numeric grades · comments · internal reposts/feed · material view-tracking (so no "engagement" metric is shown — none is measured) · notifications.
