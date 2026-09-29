# Curriculum Roadmap Engine (Job track) — Audit (Part B, Phase 1)

Audited 2026-09-29 against the repo and the live Supabase project. Part A of this task is **complete and committed** (`docs/job-track-audit.md`, "Part A") — the gate for starting Part B is met.

## 1. Organisation-admin capability today
- **No admin-facing page, route, or gate exists.** No page under `app/` is role-gated on an admin role; the only caller of authorization in the app is `app/api/v1/students/[studentId]/state/route.ts` (`can(..., "person", "read")`).
- **The RBAC machinery does exist and is reusable:** `lib/auth/authorize.ts#can(supabase, userId, resource, action, { organisationId })` re-derives the caller's role from their own `institution_memberships` rows (only `status='active'`, optionally scoped to one institution) and checks `roles` / `role_permissions`. `organisation:admin` is granted to `principal`, `vice_principal`, `ceo` (and `university_admin`, `company_admin`, `platform_admin`, which are not in the `app_role` enum and so cannot appear on a membership today). `hod`/`faculty` have only `organisation:read`.
- **`institution_memberships.role` values** (enum `app_role`): `student, faculty, hod, principal, vice_principal, ceo, mentor, professional`.
- **How an admin membership becomes active:** the `set_membership_status` BEFORE INSERT trigger forces `status='pending'` for any role where `role_requires_verification` is true, on every insert including the service role. There is **no approval flow** in the app, and migration 031 removed all client writes to this table. Live data: 3 profiles, 5 memberships, **all `student`** — there is no admin anywhere today.
- **Consequence:** the only piece Part B needs to add is (a) a server-side gate using the existing `can("organisation","admin",{organisationId})`, and (b) a way for the platform operator to activate one real admin (an existing membership → `role='principal'|…`, `status='active'`, via the service role). Part B builds (a) and a small operator script for (b); it does not build a role system, invitations, or an approval UI (out of scope; architecture doc §8.1 invitations remain a later task).

## 2. The one college
Live student data exists at exactly one institution: **Amrita Sai Institute Of Science And Technology** (Andhra Pradesh, `academic_start_month = 7`), 3 student memberships: AI/ML, ECE, Mechanical Engineering. (Two other institutions, "Kakatiya Apollo" and "Narayana college", appear only as one education-history entry each, with no branch.) No curriculum data exists for it and none will be invented (rule 5). Its three students' years are currently unconfirmed / partly unset (see job-track Part A3), so their roadmap will honestly say more information is needed until they confirm their years.

## 3. Data Analyst taxonomy (live)
`arena_domain_roles`: `data-analyst` ("Data Analyst", parent skill "Data Analysis"), the only role.

| area_key | display | skill_node_key | tool_type | enabled |
|---|---|---|---|---|
| sql | SQL | data_analyst.sql | sql_workspace | yes |
| python | Python | data_analyst.python | python_workspace | **no** — no isolated Python executor (`disabled_reason` set) |
| spreadsheet | Excel / Spreadsheets | data_analyst.spreadsheet | spreadsheet_workspace | yes |
| dashboard | BI / Dashboarding | data_analyst.dashboard | dashboard_workspace | yes |
| statistics | Statistics | data_analyst.statistics | statistics_workspace | yes |
| data_cleaning | Data Cleaning | data_analyst.data_cleaning | cleaning_workspace | yes |

The subject-mapping and target-profile tables must reference these exact `(role_key, area_key)` pairs (FK to `arena_skill_areas`), so mappings cannot point at keys that don't exist.

## 4. Skill Graph read path (reuse)
`lib/arena-workstations/attempts.ts#getWorkstationState(service, userId, statedRole)` is read-only and already returns the student's resolved role (`role.key`, honouring the `active_role_key` from the Job-Track work) plus `progress[]` — one entry per skill area with `verifiedCount`, `lastVerifiedAt`, `enabled`, `disabledReason`. It is backed by `arena_skill_ratings` (self-read RLS; rows written only by the `complete_workstation_attempt` RPC). The roadmap reuses this; it does not add a second reader.

## 5. Readiness threshold — existing concepts do NOT imply one
Arena has `difficultyForRating` (easy < 1250 ≤ medium < 1400 ≤ hard) and ELO steps (8/12/15). These are not usable as readiness thresholds: new rating rows now default to **400** (migration 027) while the difficulty bands assume ~1200, and the one real row is 1216 from the old default — so a rating cut-off would mean different things for different students. **`verified_count` is the only comparable measure**, so the target profile uses a minimum verified-attempt count per skill area (stored, editable data; optional `min_rating` left out until the rating scale is reconciled — flagged for the architecture doc).

## 6. UI surfaces for reuse
- Student roadmap: a new tab in `components/dashboard/DashboardSubNav.tsx` ("Roadmap", `/dashboard/roadmap`), following the existing dashboard sub-pages (`/dashboard/skill-gap`, `/dashboard/skills`). The tab list is static today; it needs a `showRoadmap` prop so non-Job-track students never see it.
- Cards, empty-state (dashed card) and badge patterns from `components/dashboard/*`, `app/(app)/launchpad/page.tsx`; settings section/row components (`components/settings/SettingsRow.tsx`) for the admin page; form field styles from `components/direction/YearConfirmCard.tsx`.
- Admin page: `app/(app)/admin/curriculum/page.tsx`, server-gated with `can()`; client form posts to `/api/admin/curriculum/*`.

## 7. Facts that shape the design
- All new tables must be service-role-write-only from day one: no INSERT/UPDATE/DELETE policy and grants revoked for `anon`/`authenticated` (lesson of Part A1). The static-migration test and the live direct-write test will be extended to cover them.
- Track resolution: `getStudentDirection(...).track` / `trackFor()` (Job-Track work) — reused, not reimplemented.
- Current/upcoming academic year: `computeCurrentAcademicYear` (+ the year-confirmation state). A student whose years are unset or unconfirmed gets the honest "needs more information" state rather than a roadmap built on a guess.
- The sole existing AI provider abstraction is `lib/ai/groq.ts#completeJson`; an assistive mapping suggestion (if included) would use it and only return a proposal.
