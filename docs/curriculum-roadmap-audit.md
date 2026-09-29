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

---

# Phase 2 — Design

## Data model (migration `033_curriculum_roadmap.sql`, additive)
All five tables: RLS enabled, **no policies, all privileges revoked from `anon` and `authenticated`** — private to the service role, written and read only through server code that has already authorised the caller. (Part A1's lesson: never leave a client-writable path, not even "own row" ones.)

| table | columns | notes |
|---|---|---|
| `curriculum_subjects` | `id`, `institution_id` → institutions (cascade), `branch text`, `year smallint 1..6`, `semester smallint null 1..2`, `name`, `code null`, `created_by`, `created_at` | unique `(institution_id, lower(branch), year, lower(name))`. Scope is **year** of study (the student side no longer knows a semester); `semester` is stored because the admin's syllabus is semester-shaped, but matching uses year only. |
| `curriculum_subject_skill_map` | `subject_id` → subjects (cascade), `role_key`, `area_key`, `source ('admin'\|'ai_suggestion_confirmed')`, `confirmed_by`, `confirmed_at` | PK `(subject_id, role_key, area_key)`; **composite FK to `arena_skill_areas(role_key, area_key)`** so a mapping can only name real skill areas. Only *confirmed* rows exist — AI proposals are never persisted. |
| `role_target_profiles` | `role_key`, `area_key`, `min_verified_count int ≥ 1` | PK `(role_key, area_key)`, FK to skill areas. "Ready" for an area = at least N verified Arena attempts (audit §5: rating is not comparable across students). Seeded for Data Analyst's five enabled areas with N = 3 — a **product default, not student data**, marked for product-team review. Python (disabled, no executor) is not seeded: an unassessable area cannot be a gap. |
| `skill_area_resources` | `id`, `role_key`, `area_key`, `kind ('project'\|'certification'\|'practice')`, `title`, `url null`, `description null`, `active` | the curated list. Product-team maintained via SQL/migration; no UI in this task. Seeded with two well-known public certifications only (Microsoft PL-300 → dashboard, Google Data Analytics certificate → spreadsheet), flagged for link review; nothing is generated per render. |
| (branch matching) | — | `curriculum_subjects.branch` is compared to `institution_memberships.branch` case-insensitively after trimming. The admin form reuses the same branch autocomplete, so values come from the same catalog the student picked from. |

## Gap-analysis algorithm (`lib/roadmap/build.ts`, pure)
Inputs: role + its skill areas; target profile (`area → min`); verified counts (`getWorkstationState().progress`); curriculum subjects for the student's institution + branch with their confirmed mappings; curated resources; the student's confirmed academic year (`computeCurrentAcademicYear`).

1. **Preconditions → `needs_info`, never a fake roadmap.** Reasons, all reported: `no_role`, `no_target_profile`, `year_unknown` (years unset/unconfirmed), `no_curriculum` (institution has no subjects for this branch), `no_curriculum_for_year` (subjects exist but none for this or next year), `no_confirmed_mapping` (subjects exist but none is mapped to any skill area, so coverage is unknown). "Zero verified evidence" is **not** a precondition failure — with a curriculum and target it yields a legitimate, fully populated roadmap.
2. **Coverage:** an area is *covered* by every subject mapped to it in years ≤ current+1, each tagged `past | this_year | next_year`.
3. **Demonstrated:** `verifiedCount ≥ min_verified_count`.
4. **Buckets** (over target areas that are enabled):
   - **Affirm** — covered ∧ demonstrated ("your curriculum covers X and you've proved it"); also demonstrated ∧ not covered, tagged `beyond_curriculum`.
   - **Engage** — covered ∧ ¬demonstrated: "Your curriculum covers X in *Subject (Year N)* — engage with it, then prove it: n of min verified {area} tasks."
   - **External gap** — ¬covered ∧ ¬demonstrated: a deterministic Arena focus ("complete `min − n` more verified {area} tasks") plus the curated resources for that area, if any. If none are stored, only the Arena focus is shown.
5. Each item carries only stored facts (subject names, counts, curated titles). No LLM is involved in any of this.

## Recompute policy
**On demand, per page render, from live reads — nothing is stored.** A stored roadmap would need invalidation on three independent events (curriculum edit, mapping confirmation, new verified Arena evidence, plus year re-confirmation); computing a small pure function over four indexed reads is cheaper than getting invalidation right, and can never be stale.

## Admin flow (`/admin/curriculum`)
- Gate: server-side `can(supabase, userId, "organisation", "admin", { organisationId })` on **every** page load and API call (existing RBAC; principal / vice_principal / ceo with an *active* membership). The institution is derived from the caller's own admin membership — the request never carries an institution id.
- Entry: structured form (branch via the existing autocomplete, year, subject rows) **and** CSV/template import (`branch,year,semester,subject_name,subject_code`), parsed in the browser, previewed, then posted; server re-validates everything (zod, size caps).
- Mapping: per subject, choose skill areas. **"Suggest"** calls the AI provider (`completeJson`) which returns only area keys filtered to real ones; the UI shows them unsaved and pre-checked *for review*; only the admin's explicit "Confirm mapping" writes, with `source='ai_suggestion_confirmed'` if it started from a suggestion. The suggest endpoint has no database write path.
- Operator: `scripts/grant-org-admin.mjs` (service role) activates an existing membership as an org admin — the only way an admin exists, since there is no approval flow and clients cannot write memberships.

## Student surface
`/dashboard/roadmap` as a new dashboard tab. Visible only when `getStudentDirection().track === "job"` (unset and "not sure" included); other tracks get no tab and the route returns 404. Tab visibility uses a small context filled by the (app) layout from the same `direction` already loaded — track logic is not reimplemented. States: roadmap; `needs_info` with plain reasons and what to do about each (confirm years, "your college hasn't added its curriculum yet"); never an empty-looking "no gaps".

---

# Phases 5–7 — Build and verification record

## Student UI (Phase 5)
- `/dashboard/roadmap` (new dashboard tab, "Roadmap"): three sections — *You're on track*, *Engage with your curriculum, then prove it*, *Not in your curriculum — build these yourself* — each card shows verified/target progress, the covering subjects with year and timing, a deterministic Arena action ("Complete N more verified … tasks"), and (external gaps only) the stored curated resources.
- Honest state: `needs_info` shows every unmet precondition in plain language with the fix where one exists ("Confirm your years" → `/settings/direction`; "your college hasn't added its curriculum yet"). It explicitly says that nothing shown does not mean no gaps.
- Visibility: the tab appears only when the layout-provided `isJobTrack` (from `direction.track === "job"`, the existing resolution) is true; the route itself calls `notFound()` for anyone else. Verified live: job / not_sure / unset → applicable; higher_studies / entrepreneur → not applicable, switching live.

## Verification (Phase 7)
- `tsc` clean; `vitest run` 51 files / 333 tests pass; `eslint app components lib proxy.ts scripts` 0 errors (4 pre-existing `<a href="/">` warnings); `next build` succeeds and lists `/admin/curriculum`, `/api/admin/curriculum/*`, `/dashboard/roadmap`.
- Live tests (`npm run test:live`, disposable fixtures, all cleaned up — verified 0 leftover users/institutions/subjects): `lib/roadmap/admin.live.test.ts` (5), `lib/roadmap/roadmap.live.test.ts` (4), plus the Part A live tests.
- **Real institution / real students (read-only, run against production):** Amrita Sai Institute Of Science And Technology, 3 students (Mechanical, AI/ML, ECE), all goal-state unset (⇒ Job track): each gets `needs_info [year_unknown, no_curriculum]`. That is the correct, honest output today — nobody has confirmed their years (two were blanked by the A3 revert; the third is unconfirmed) and no curriculum has been uploaded. No curriculum was invented to make the page look full. A full ready-state roadmap has been exercised only on disposable fixtures (live test above).
- To see a real roadmap at Amrita: the operator activates one admin (`scripts/grant-org-admin.mjs`), the admin enters subjects at `/admin/curriculum` and confirms mappings, and students confirm their years.

## Authority verification for the new tables
- Static (`lib/security/migrations.test.ts`): each of the 4 tables has RLS enabled, no policies, and privileges revoked from `anon, authenticated`; mappings and targets carry a composite FK to `arena_skill_areas`.
- Live (`admin.live.test.ts`): a signed-in **admin** and a signed-in student both fail to read, insert, update or delete any of the 4 tables directly. An anon probe of production confirmed the same.
- Guards (`lib/roadmap/guards.test.ts`): every `/api/admin` route calls `requireOrgAdmin` before any service-role use; the admin page 404s for non-admins; no request schema can carry an institution or user id; only `lib/roadmap/suggest.ts` imports the AI provider anywhere in the feature; `build.ts` has zero imports.

## Limitations / deferred
- No admin exists yet (needs the operator script); no approval/invitation flow (architecture doc §8.1, later).
- Curated resources: two certifications seeded for review; no project/practice entries and no UI to maintain the list — SQL/migration for now.
- Target profile value (3 verified tasks per area) is a product default awaiting review; rating-based readiness is deferred until the baseline (400) vs difficulty-band (~1200) inconsistency is reconciled.
- Matching is by year of study (semester ignored on the student side) and by case-insensitive branch text; a branch spelled differently from the student's will not match (the admin form reuses the same autocomplete to prevent this).
- Only Data Analyst; Job track only. Deferred per architecture doc §10: PDF/AI curriculum extraction, aggregate TPO dashboard, additional roles, Higher Studies / Entrepreneur roadmap variants.
