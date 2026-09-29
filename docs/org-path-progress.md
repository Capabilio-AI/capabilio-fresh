# Org Path Progress

**Phase:** build complete; verification in progress (live tests, lint, build, browser walkthrough).

## Done
- Audit + design: docs/org-path-audit.md.
- Migrations applied to prod: 038 `org_classroom` (Module B tables + atomic functions + faculty signup), 039 `org_placements_rls` (private drives), 040 `org_presence` (Module A).
- Module B: materials, projects (open call, groups of 4, cross-department permitted), groups (create/join/leave with DB-enforced rules), weekly reports (process data only), in-app + physical submissions, group-level grade → one staff-verified evidence row per member (`class_grade_group`, atomic + idempotent).
- Module C: placement drives reuse `opportunities` (institution-scoped via RLS), Launchpad "Campus drive" badge; insights (aggregate only, cohorts < 5 suppressed, no fabricated engagement metric).
- Module A: org profile (opt-in public), events + announcements, follow/like/share-link, public `/o/[slug]` and permalink pages. No comments.
- Org workspace `/org/*` (role-based nav), student `/classroom`, login routing (`landingFor`), `tpo`/`company_admin` role labels (fixes "Student Portal" shown for TPO), faculty may apply via org signup and are approved in-app by an org admin.

## Decisions (spec defaults)
Team size fixed 4 · cross-department permitted · group-level grade + optional per-member notes (private) · grade = free text ≤10 chars · staff may publish own posts · public page opt-in.

## Known limits (deliberate)
- No file uploads: materials, submissions, attachments and cover images are links.
- Evidence skill is "Project Work" (no skill-area mapping yet); subject is stored in metadata.
- One role per person per institution (existing UNIQUE(user_id, institution_id)); admins are approved by the operator script only.
- `lib/supabase/types.ts` not regenerated (pre-existing uncommitted edits there); new tables/roles use `lib/org/db.ts` types.

## Remaining
Run: `npm run test:live -- lib/org`, lint, tsc, build, browser walkthrough; final report.
