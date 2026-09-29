# Job-Track Career-Direction Loop — Audit (Phase 1)

Audited 2026-09-29 against the repo and the live Supabase project (`gudsoflidkkmtnxvzicw`).

## BLOCKER (needs a decision before Phase 5)
**Switching a student's active Arena domain role is NOT a clean config-only operation today.**
- The taxonomy itself IS data-driven: `arena_domain_roles` / `arena_skill_areas`, loaded by `role_key` in `lib/arena-workstations/taxonomy.ts`. No `data-analyst` hardcoding exists outside seed data and tests.
- But the *student's active role is not stored anywhere*. `resolveRole()` (`lib/arena-workstations/attempts.ts:37`) derives it: (1) the first `arena_rotation_state` row for the user, else (2) keyword match on free-text `career_interest_target.stated_role`, else (3) `roles[0]`.
- Consequence: once a student has any rotation row, the engaged role always wins. Changing config or `stated_role` cannot move them. A Switch needs a new explicit selection (a stored `active_role_key`, read first by `resolveRole`).
- Only ONE role is enabled today (`data-analyst`). A Switch action would have no real target. There is also no 3-1 taster/role-selection UI (out of scope per the task).

Options for the decision are in the final section.

## Onboarding
- `app/signup/page.tsx` → `components/login/SignupForm.tsx`: fields first/last name, college, branch, **semester-label select** (`YEAR_OPTIONS` "1-1"…"4-2"), email, password, terms.
- `components/login/auth.ts#signUp` sends `year` in Supabase `user_metadata`; DB trigger `public.handle_new_user` (live only — NOT in repo migrations; 001 is missing from the repo) inserts `profiles` + `institution_memberships(user_id, institution_id, role, branch, year)`. It does not write `start_year`/`end_year`.
- **Semester-label readers** (`institution_memberships.year`, format "3-2"): `lib/journey/stage.ts` (stage table + `isStageUnlocked`), `lib/dashboard/viewer.ts`, `lib/dashboard/data.ts`, `lib/dashboard/education.ts`, `lib/assessment/attempts.ts:115`, `lib/guide-path/generate.ts`, `app/(app)/{launchpad,interview,profile,settings,dashboard}`, `components/shell/HeaderNav.tsx`, `components/dashboard/{DashboardHeader,JourneyTimeline}.tsx`, `components/education/EducationEntryCard.tsx`, `app/api/v1/students/[studentId]/state/route.ts`. So the label cannot simply be deleted; readers must move to computed year first.
- **Google**: `components/login/AuthCard.tsx` (button + "OR" divider), `components/login/GoogleIcon.tsx`, `auth.ts#signInWithGoogle`. The signup form has no Google button. No other references (fonts.googleapis is unrelated).
- **"Get Started" root cause**: `components/Navbar.tsx` (desktop + mobile) and `components/FinalCTA.tsx` use `href="#"` — they go nowhere. `Hero.tsx` uses `#ecosystem`, which scrolls to the Stakeholders section rather than signup. No JS error; the links simply never target `/signup`.

## Membership/context model
- Table is `institution_memberships` (the 003 rename to `organisation_*` was NOT applied to the live DB).
- Live columns already include `start_year smallint`, `end_year smallint` (migration 015, range-checked 1980–2100), plus `branch`, `year`, `degree`, `field_of_study`, `cohort_id`. 5 memberships, 3 have start/end set.
- **`goal_state` requires a migration** (new column + check constraint). `start_year`/`end_year` do not.
- There is no per-institution academic-cycle-start-month field anywhere.

## Arena engagement data
Real but tiny: 1 rotation-state row, 1 assignment/attempt/completion, 1 arena rating. So a data-driven reflection prompt is reachable only for the student(s) with real rotation/attempt history; everyone else gets the fallback variant. (Engagement *time* isn't recorded; only counts of verified attempts per role/area exist — the prompt must reference that, not time.)

## Assessment
Single 7-section flow (`lib/assessment/sections.ts`: `SECTION_ORDER`), completed when every section is complete (`submit.ts:42`). **No gating by year/trigger exists.** Lighter mode = `verbal_communication` + `career_interests` and needs a server-chosen section list.

## Existing trigger-like logic (must be consolidated)
`lib/journey/stage.ts#isStageUnlocked` (semester-label based, "3-2" rank) gates Launchpad and AI Interview (`launchpad/page.tsx`, `interview/page.tsx`, `HeaderNav.tsx`, `lib/nav/config.ts`). This is a second definition of the 3-2 concept that must be replaced by the single shared `end_year − current_calendar_year ≤ 1` utility.

## Real vs. not real
- **Portfolio**: real (`components/portfolio/*`, `lib/portfolio/*`, evidence engine; `evidence` table currently 0 rows).
- **AI interview sessions**: real infra (`ai_interview_sessions`, `lib/interview/session.ts`, Groq-generated questions). 0 sessions.
- **Launchpad**: `opportunities` table exists with 0 rows and is unused. The page renders **fabricated `MOCK_OPPORTUNITIES`** (`lib/mock/launchpad.ts`) with a "sample roles" footnote. This violates rule 6 and must be removed and replaced by an honest empty state/real query.
- No goal-state, Entrepreneur resource page, or check-in exists.

## Design-system pieces to reuse
App shell `components/shell/*`, `app-*` Tailwind tokens (`bg-app-*`, `text-app-*`), lucide icons, dashed empty-state card pattern (see launchpad/interview locked states), `CardChrome`/field classes in `components/login/*`, `ForgotPasswordModal`/`InstitutionPicker` as modal patterns, `lib/nav/config.ts` for nav entries.

## Other findings for the architecture doc
- `handle_new_user` and migration 001 are missing from the repo; schema history is not fully reproducible.
- Doc says `organisation_id`; live table is still `institution_memberships`.
- Arena has no stored "active domain role" concept; §5.5/§7 assume one.
