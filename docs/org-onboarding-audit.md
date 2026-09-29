# Org Onboarding — Audit & Design

## Phase 1 — Audit (verified against live prod, project `gudsoflidkkmtnxvzicw`)

**Missing input:** `docs/CAPABILIO_ORGANISATION_PATH.md` does not exist anywhere in the repo. Worked from
`CAPABILIO_PRODUCT_ARCHITECTURE.md` (§2 Organisation module, §3 identity model) and this task's spec.

**Student signup/login today**
- `/signup` → `app/signup/page.tsx` → `components/login/SignupForm.tsx` (client) → `components/login/auth.ts#signUp` (`supabase.auth.signUp`, metadata `role:'student'`, `college_name`, `branch`, `start_year`, `end_year`). Reused unchanged.
- `/login` → `components/login/AuthCard.tsx` → `auth.ts#signIn`. Reads `profiles.primary_role`; `student`/`professional` succeed immediately; any other role needs an **active** `institution_memberships` row, else outcome `pending-approval` (banner "Your institution access is pending approval."). Non-student roles have no portal (`routeFor` → null, "workspace hasn't been built"). So the pending/login mechanism for org roles already exists.
- CTAs: `Navbar.tsx` (×2), `Hero.tsx:315`, `FinalCTA.tsx:38` all `href="/signup"`. `/get-started` is free (no collision).

**Role enum `app_role` (prod):** `student, faculty, hod, principal, vice_principal, ceo, mentor, professional`. No `tpo`/`org_admin`/`company_admin`. (The separate RBAC `roles` table has `company_admin`, `university_admin`, `recruiter`… as text keys but no enum counterpart, and no `tpo`.)

**`institutions`:** `id, name, slug, created_at, updated_at, city, state, college_type (enum engineering…other), academic_start_month`. 16,284 rows (seeded directory). **No org type column**; no duplicate lowercase names today. RLS: select-all only; writes are service role / SECURITY DEFINER.

**`set_membership_status`** (BEFORE INSERT on `institution_memberships`, fires for service role too): `role_requires_verification(role)` (= role in faculty,hod,principal,vice_principal,ceo,mentor) → `pending`, else `active`. A new role is **active by default** unless the function's list is extended — so the list must change (design below: invert to allow-list).
- `handle_new_user` (auth.users AFTER INSERT) trusts `raw_user_meta_data.role` (client-controlled) for `profiles.primary_role` and the membership role. Today harmless because privileged roles land `pending`; but a raw `signUp` with `role:'professional'` gets a self-serve profile. Tightened in 036.
- Membership UPDATE/INSERT revoked from clients (031); `profiles.primary_role` not client-writable.

**Invitation-based org onboarding:** none exists in code (grep: no invite tables/routes/pages). Planned only.
**Existing operator tool:** `scripts/grant-org-admin.mjs` (service-role; activates an existing membership). Reused/extended as the approval tool.
**Design-system reference:** `Stakeholders.tsx` card grid (`rounded-xl border-lp-border-hairline bg-lp-surface-card p-space-lg`, `Reveal`, `SectionLabel`) + `AuthLayout`/`CardChrome` for auth screens.
**Migrations:** prod's applied list ends at `deterministic_row_selection` (= repo 035). Repo `029_arena_track_separation.sql` is NOT applied in prod (no `arena_track_separation` entry) — left untouched. Real next number: **036** (no file exists at 036).

## Phase 2 — Design

**Routes:** `/get-started` (4-card selector) → Student `/signup` (unchanged) · Professional `/get-started/professional` (static) · Executive `/get-started/executive` (static) · Organisation `/get-started/organisation` (form) → `/get-started/organisation/pending` (post-signup confirmation is in-page state; login reuses `/login`). All CTAs → `/get-started`. Sign-in stays `/login`.

**Copy:** exactly as specified in the task (Executive subtext "Startup Founders, CEOs, Directors and other leaders"; Organisation "Colleges & Universities, Companies").

**Org form fields:** organisation type (Institution|Company), organisation name (2–200), your name, designation/role (Institution: Principal/Vice Principal/HOD/TPO; Company: fixed "Company admin"), work email, password + confirm (≥8), terms. Zod-validated server-side; the client sends none of role/status/type as trusted — it sends a *choice*, server maps it to a role from a fixed allow-list.

**Authority:** browser calls `POST /api/org/signup` (server). Server: validates, calls `auth.signUp` (anon, metadata only `full_name`; `handle_new_user` ignores every role but student), then with the service role sets `profiles.primary_role` and inserts the membership. `set_membership_status` (extended) forces `pending`. If `signUp` returns no new identity (email already registered) nothing is written (no enumeration, no hijack).

**Roles:** new enum values `tpo` (institution TPO) and `company_admin` (matches existing RBAC key). Institution designation principal/vice_principal/hod reuse existing values. `role_requires_verification` inverted to "everything except student/professional" so future roles default to pending.

**Type fork:** `institutions.org_type text not null default 'institution' check in ('institution','company')`. Institution: exact match (case-insensitive, whitespace-collapsed) among org_type='institution' rows → link; else create. Company: same exact-match among org_type='company' (never links to a college), creates row. Confirmation: Institution → "Awaiting approval; we'll email once verified"; Company → "Thanks — we'll be in touch." Nothing else built for Company.

**Pending state:** login already yields `pending-approval` for non-active org accounts; copy sharpened to be honest ("Your organisation account is awaiting manual approval"). No dashboard exists to break.

**Approval tool: operator script** (extends existing `scripts/grant-org-admin.mjs` pattern): `scripts/org-approvals.mjs list` / `approve <membership-id>`. Chosen over an admin page because there is no platform-admin auth surface and volume is ~0; a page would need a new gate. Approve refuses unless email confirmed, and only flips `status`.

**Migration 036:** enum values, `institutions.org_type`, allow-list `role_requires_verification`, `handle_new_user` (student-only role), `get_or_create_organisation(name, org_type)` SECURITY DEFINER, execute revoked from anon/authenticated/public.
