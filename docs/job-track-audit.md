# Job-Track Career-Direction Loop — Phase 1 Audit

**Status:** Phase 1 complete. Stopping here per the task's own instruction — a genuine
blocker was found in the Arena domain-role switching mechanism (§3). Phase 2 design
work is deferred until that's resolved with the user.

Live DB checked directly (Supabase project `gudsoflidkkmtnxvzicw`, "capabilio AI",
created 2026-09-22 — one week old). All counts below are real production numbers as of
this audit, not estimates.

---

## 1. Onboarding flow

### 1.1 Current fields (signup)
`components/login/SignupForm.tsx` → `signUp({ firstName, lastName, collegeName, branch,
year, email, password })`. `year` is the semester-label string (`"1-2"`, `"3-1"`, etc.),
picked from a dropdown. No start/end year captured at signup today.

### 1.2 Where signup data lands
Signup does **not** insert `institution_memberships` from application code — it goes
through Supabase Auth's `raw_user_meta_data`, consumed by a **database trigger**,
`public.handle_new_user()` (defined in `supabase/migrations/003_organisations_rename.sql:88`,
never redefined since):

```sql
college_name := raw_user_meta_data ->> 'college_name'
branch_name  := raw_user_meta_data ->> 'branch'
study_year   := raw_user_meta_data ->> 'year'
-- inserts into institution_memberships (user_id, organisation_id, role, branch, year)
```

**Important discrepancy found:** migration 003 is titled "organisations_rename" and
literally contains `alter table institution_memberships rename to
organisation_memberships`. That rename is **not reflected in the live database** —
confirmed directly: `information_schema.columns` shows the live table is still named
`institution_memberships`, matching the 11 application-code references to it, and zero
to `organisation_memberships`. **The migrations folder does not reliably reflect
production schema history for this table** — treat `lib/supabase/types.ts` (generated
from the live DB) and live `information_schema` queries as ground truth, not migration
file chronology, when planning the Phase 3 migration. `handle_new_user()`'s *logic*
(reading `branch`/`year` from metadata) is corroborated as still-current by migration
015's own comment ("branch/year are left as-is... they're still what the signup trigger
(handle_new_user) writes"), so the function body is trustworthy — just target
`institution_memberships`, not `organisation_memberships`, when replacing it.

### 1.3 Where `year` (semester label) is read elsewhere
`institution_memberships.year` (text, `"<year>-<semester>"`) is consumed by:

- `lib/journey/stage.ts` — `JOURNEY_STAGES` (7 stages, Discover→Launch),
  `currentStageIndex()`, `isStageUnlocked()`. **`UNLOCK_STAGE_KEY = "experience"` = year-semester
  `"3-2"` — this is the existing, de facto 3-2 gate**, predating this task, built on the
  semester string.
  - Callers: `app/(app)/interview/page.tsx` (gates AI Interview), `app/(app)/launchpad/page.tsx`
    (gates Launchpad), `components/shell/HeaderNav.tsx`, `components/dashboard/JourneyTimeline.tsx`
    (renders the 7-stage visual progress bar), `app/api/v1/students/[studentId]/state/route.ts`
    (a public API route), and `lib/journey/stage.test.ts`.
- Three **duplicated** `formatYearSemester()` functions (byte-identical) in
  `components/education/EducationEntryCard.tsx`, `components/dashboard/DashboardHeader.tsx`,
  `app/(app)/profile/page.tsx`.
- `getStudentBranchContext()` (`lib/assessment/attempts.ts:97`) returns `year` as part of
  academic context, used for stream-challenge branch resolution.

**Consequence for Phase 2:** the architecture doc says semester granularity is dropped,
but 5 real call sites (including a 7-stage visual timeline and a public API) depend on
year-**semester** granularity, not just year. Dropping the raw field without a plan
breaks JourneyTimeline, HeaderNav, and the existing Interview/Launchpad gates. The clean
fix: derive an equivalent `"<year>-<semester>"` string from `start_year` + the
academic-cycle-start-month rule (§4.2 of the architecture doc) at read time, so
`JOURNEY_STAGES`/`isStageUnlocked` keep working unchanged and only the *input* field
changes shape. This is a Phase 2 decision to confirm, not a blocker — flagging it here so
it isn't missed.

### 1.4 Google sign-up/login
- `components/login/auth.ts` → `signInWithGoogle()` (Supabase `signInWithOAuth`,
  provider `google`).
- `components/login/GoogleIcon.tsx` — icon-only component, single use.
- Referenced from `components/login/AuthCard.tsx` (need to confirm both login and
  signup render `AuthCard`, or if `SignupForm`/`LoginScreen` each have their own
  Google button block — resolve exact render sites in Phase 3, not guessed here).
- No server-side dependency on Google-sourced profile data found (`full_name`/`email`
  come from `raw_user_meta_data` regardless of provider) — removal is UI-only, no schema
  or trigger impact.

### 1.5 "Get Started" button — root cause confirmed
Two distinct CTAs, both labeled "Get Started Free":
- `components/Hero.tsx` → `<PrimaryButton href="#ecosystem">` — **this one works**:
  `#ecosystem` is a real section id (`components/Stakeholders.tsx:44`). It scrolls to a
  marketing section, not to signup, which is a weak CTA choice but not "broken."
- `components/FinalCTA.tsx` → `<a href="#">Get Started Free</a>` — **this is the bug**.
  Literal placeholder href, does nothing (scrolls to page top). `PrimaryButton`'s own
  default (`components/ui.tsx:187`, `href = "#"`) is the same placeholder pattern,
  suggesting FinalCTA was never wired past scaffolding.
- **Fix:** point both to `/signup` (the real signup route, confirmed to exist and
  render `SignupForm` via `AuthLayout`).

---

## 2. Membership/context model — schema reality

`institution_memberships` (live columns, confirmed via `information_schema.columns`):

```
id, user_id, institution_id, role, status, created_at, updated_at,
branch, year, cohort_id, degree, field_of_study, start_year (smallint), end_year (smallint)
```

**`start_year`/`end_year` already exist** — added in `015_education_degree_years.sql`,
applied to production 2026-09-28 (yesterday relative to this audit). They are currently
only populated by the separate "Add Education History" flow
(`AddEducationHistoryForm` → `POST /api/education/institution`), not by signup.

**No `goal_state` column exists anywhere** (checked migrations, `lib/`, `app/`,
`components/` — zero hits). Adding it is a plain `alter table add column`, no complex
migration needed for the column itself — it's brand new, nothing to backfill.

**Real current data** (5 rows, 3 users):
- 3 rows are signup-created "current B.Tech" entries — all have `year = "1-2"`, only
  **one** of the three has `start_year`/`end_year` populated (via a later manual edit).
  The other two have `start_year`/`end_year` both `null`.
- 2 rows are separate Education-History entries (Intermediate, SSC) with
  `start_year`/`end_year` populated but no `branch`/`year` — working as designed, not
  part of this migration's scope.

**Migration implication:** for the 2 rows with `year` set but no `start_year`/`end_year`,
inferring `start_year` from `year` + `created_at` (assuming no gap year/backlog) would be
*guessing*, which the task explicitly forbids ("no forced re-onboarding... where not
derivable, flag the account"). Recommendation for Phase 2: treat every row with `year`
set and `start_year` null as "flag for confirmation on next login," full stop — do not
attempt calendar inference from `created_at`.

**Conclusion: no migration is needed to *add* start_year/end_year (already live).** The
real Phase 3 migration work is (a) `goal_state` column, (b) the confirmation-flag
mechanism for pre-existing rows, (c) rewriting `handle_new_user()` to accept
`start_year`/`end_year` from signup metadata instead of `year`.

---

## 3. Arena domain-role switching — BLOCKER FOUND

Task instruction: *"Stop and report if you find that domain-role switching is NOT a
clean config-only operation today."* It is not, today, in a specific and fixable way —
reporting per instruction before proceeding.

**The taxonomy itself genuinely is config-only** (confirmed): `arena_domain_roles` and
`arena_skill_areas` are pure data tables; adding or changing a role's skill areas is a
data change, zero code per role. That part of the architecture doc's claim holds.

**What is NOT built: an actual "switch active role" operation, and the current
role-resolution logic cannot safely support one as-is.**

`resolveRole()` (`lib/arena-workstations/attempts.ts:37-44`):

```ts
const { data: engaged } = await service.from("arena_rotation_state").select("role_key").eq("user_id", userId).limit(1);
const matched = matchRoleForStatedCareer(roles, statedRole);
const role = roles.find((r) => r.role_key === engaged?.[0]?.role_key) ?? matched ?? roles[0];
```

- The student's active role is **not** a stored pointer — it's inferred: "whichever role
  has an `arena_rotation_state` row wins, else fall back to matching
  `career_interest_target.stated_role` text, else the first enabled role."
- Once a student has **any** rotation-state row for a role, that role is sticky *forever*
  — updating `career_interest_target.stated_role` afterward is silently ignored by this
  function. There is no existing code path that lets an already-engaged student move to
  a different `role_key`.
- The `.limit(1)` has **no `order by`**. If a student ever had rotation-state rows for
  two roles (which a "switch" feature would necessarily create), which one `resolveRole`
  picks is arbitrary/undefined, not deterministic.
- **Live data check:** `arena_rotation_state` currently has **0 rows** for any student
  (confirmed via direct query) — this bug has never actually fired in production yet,
  it's latent, not yet observed. It will fire the first time any student does a domain
  challenge, and will actively break the very feature this task asks for (Higher Studies
  switch) the first time it's used, unless fixed.

**This is fixable without violating rule 8** ("a config/data change... not a one-off
bespoke code path"), but it requires one small, generic code change, not a pure data
change:

- Add one explicit pointer for "current active role" (e.g. a column on
  `career_interest_target`, or a tiny new table keyed by `user_id`) that `resolveRole()`
  checks **first**, before falling back to the `engaged` heuristic.
- A "switch" operation becomes: write that pointer to the new `role_key`. This is generic
  — works identically for any role, no per-role branching — genuinely satisfying rule 8's
  intent, just not satisfying the literal claim that *today's* code already supports it
  with zero changes.
- All prior `arena_rotation_state` / `arena_skill_ratings` / `arena_attempt_completions`
  rows stay keyed by the *old* `role_key` untouched — evidence preservation (rule 8,
  Phase 5 gate) is not at risk from this fix; it's purely about which role new activity
  attaches to.

**Decision needed before Phase 2/5 proceeds:** confirm this approach (new explicit
active-role pointer + a small, generic change to `resolveRole()`) is acceptable, since
it's a real (if small and generic) code change, not the zero-code config change the
architecture doc implies. Given the fix is generic and small, and I don't see a viable
alternative that avoids it, I'd recommend proceeding with it in Phase 5 — but flagging
per the task's explicit stop instruction rather than assuming.

---

## 4. Real Arena engagement data — reflection-prompt variant decision

Direct query against production:

| Table | Row count |
|---|---|
| `auth.users` | 3 |
| `arena_rotation_state` | 0 |
| `arena_attempt_completions` (Domain) | 1 |
| `arena_challenge_completions` (Stream) | 1 |
| `arena_skill_ratings` | 1 |
| `career_interest_target` | 2 |

This is effectively **zero real student engagement** — the handful of rows are from
this session's own feature-building/testing, not real usage. Per rule 5, the
data-driven reflection prompt ("you've spent the most time on X") is **not reachable
with real data today** for any student. Both prompt variants must be built (per the
task), but **only the plain fallback variant (goal-state options, no engagement
reference) should be wired live at launch.**

---

## 5. Assessment system — trigger/gating mechanism today

Seven sections, hardcoded order (`lib/assessment/sections.ts`):

```
quantitative_aptitude, logical_reasoning, verbal_communication,
programming_fundamentals, engineering_mathematics, basic_sciences, career_interests
```

The task's "lighter assessment" (Communication + Career Interest only) maps exactly to
`verbal_communication` + `career_interests` — good, no new section types needed, just
conditional section-set selection.

Section flow is server-driven via `get_or_start_section(p_section)` RPC (defined in
migration 003, `SECTION_ORDER`-based) plus `lib/assessment/attempts.ts`. The trigger
condition (`end_year − current_calendar_year ≤ 1`) needs to gate **which section set**
`SECTION_ORDER` effectively resolves to for a given student — this is a Phase 2
design item (exact call sites to touch), not fully enumerated yet; flagging for Phase 2
continuation.

---

## 6. Portfolio, Launchpad, AI-interview — real vs. placeholder

- **Portfolio & Evidence Engine: real and functioning.** Confirmed extensively in this
  session's own prior work (Arena→Evidence→Portfolio pipeline, ELO, streaks, etc.) —
  this is the most mature part of the stack. Safe to hook Job-track's "Portfolio
  completion prompt" into real Arena-completion events per Phase 5 instruction 1.
- **AI Interview: real**, backed by `ai_interview_sessions` (real Groq-driven sessions,
  consumed by Portfolio). No mocks found in `lib/interview/` or `components/interview/`.
  Currently gated by the *old* `isStageUnlocked("experience")` mechanism — see §1.3 for
  the migration implication.
- **Launchpad: fabricated today, but honestly disclosed.** `app/(app)/launchpad/page.tsx`
  renders `MOCK_OPPORTUNITIES` (`lib/mock/launchpad.ts`) with a visible banner: "Live
  opportunity listings are in development — these are sample roles to show the format."
  This is better than silent fabrication, but **rule 6 for this task is stricter**
  ("show an honest empty state — never filler content standing in for a missing
  feature"). For the Job-track's Launchpad surfacing specifically, Phase 5 must **not**
  reuse `MOCK_OPPORTUNITIES` — show a genuine empty state instead. Worth flagging in the
  final report as something the architecture doc/product may want to reconsider more
  broadly (the existing Launchpad page itself still uses mocks outside this task's
  scope, and that's a pre-existing condition, not something this task is asked to fix).

---

## 7. Design system components available for reuse

- **Cards:** consistent `rounded-3xl border border-[#E0E0E0] bg-white p-6 sm:p-7`
  pattern (Portfolio, Arena) or `rounded-xl border border-app-border` (dashboard/forms) —
  both established, pick per information density.
- **Forms:** `AddEducationHistoryForm`'s `INPUT` class constant + labeled-field pattern
  is the closest existing analog for a start/end-year form; reuse its shape for the new
  onboarding fields rather than inventing a new form style.
- **Modals/popups:** `components/portfolio/EvidenceModal.tsx` is the established
  fixed-overlay + centered-card modal pattern (escape-to-close, click-outside-to-close) —
  reuse this shape for the reflection-first prompt.
- **Resource/info pages:** no existing "informational content" page pattern found yet;
  closest analog is Launchpad's static card grid — a simple content page (Entrepreneur
  resources) can reuse the same card grid shell without the mock-data problem, since it's
  genuinely static curated content, not simulated live listings.
- **Settings pages:** `app/(app)/settings/` already exists with `SignOutButton`,
  `ChangePasswordButton` — the goal-state settings page belongs here, matching existing
  layout conventions.

---

## Open items carried into Phase 2 (not blockers, just unresolved)

1. Exact `SECTION_ORDER`/`get_or_start_section` call sites needing trigger-conditional
   section-set logic (enumerate fully in Phase 2).
2. Confirm exactly where `AuthCard.tsx` vs `SignupForm.tsx`/`LoginScreen.tsx` render the
   Google button, so removal touches every render site, not just one.
3. Derive-year-semester-string-from-start_year design for `JOURNEY_STAGES` backward
   compatibility (§1.3).

---

# Phase 2 — Design

**Decision recorded:** Option 1 for the domain-role blocker — a stored, nullable `active_role_key` read first by `resolveRole`. Audit correction: the audit made 6 Supabase calls (1 `list_projects` + 5 `execute_sql`), all read-only `SELECT`s. No production writes.

## Schema (migration `030_job_track_direction.sql`, additive only)
On `public.institution_memberships` (still the live table name):

| column | type | purpose |
|---|---|---|
| `goal_state` | `text null`, check in (`entrepreneur`,`higher_studies`,`job`,`not_sure`) | NULL = never chosen; every reader treats NULL and `not_sure` as Job-track |
| `goal_state_updated_at` | `timestamptz null` | last change |
| `goal_state_prompted_at` | `timestamptz null` | last time the prompt was shown/answered/dismissed (Not-sure cadence) |
| `higher_studies_checkin_at` | `timestamptz null` | last "still on this path?" answer |
| `year_confirmed_at` | `timestamptz null` | NULL = student has not confirmed the computed year (forces confirm UI) |
| `year_override` | `smallint null`, check 1..8 | manual current-year override |
| `active_role_key` | `text null` FK → `arena_domain_roles(role_key)` | explicit active domain role (resolver reads it first) |
| `portfolio_prompt_seen_at` | `timestamptz null` | watermark for the Portfolio-completion prompt |

On `public.institutions`: `academic_start_month smallint not null default 7` check 1..12 (the audit found no per-institution cycle month anywhere; July is the default and can be edited per college).

`start_year`/`end_year` already exist (migration 015) — no change. The legacy `year` text column is **kept**, not dropped.

Writes to `goal_state*`, `year_*`, `active_role_key`, `higher_studies_checkin_at` go through server routes only, using the session user's id; the client never sends `user_id`, `membership_id`, assessment mode, or trigger results. Existing RLS on the table stays; I will check whether it lets a student UPDATE their own row directly, and if so restrict these columns via column-level grants so the API is the only write path.

### Backfill / safety (no data loss, no forced re-onboarding)
- Students with `start_year`/`end_year` already set: leave values, set nothing else → `year_confirmed_at IS NULL` → confirm card shows on next login.
- Students with only a legacy label (`year` = "y-s") and a B.Tech-shaped record: derive `start_year = academic_year_start(created_at) − (y−1)`, `end_year = start_year + 4`, computed from **membership creation date** (the label was true at signup, not now). Written by the migration, `year_confirmed_at` left NULL so the student confirms rather than trusting a derived guess.
- Anything not derivable (no label, or non-B.Tech): leave NULL and flagged (NULL confirmation) → student is prompted to enter years. Nothing is guessed.
- `handle_new_user` is added to the repo in the same migration (`CREATE OR REPLACE`, extended to write `start_year`/`end_year` from metadata with server-side validation). Live DB and repo converge because the migration is applied to production.

## Shared trigger utility
`lib/career/trigger.ts` (pure, server-called):
```ts
export const CAREER_DIRECTION_WINDOW_YEARS = 1;
export function isCareerDirectionWindow(endYear: number | null, now: Date = new Date()): boolean
//   endYear == null -> false;  else  endYear - now.getFullYear() <= 1
```
Companion (same folder): `computeCurrentAcademicYear({startYear, endYear, cycleStartMonth, override, now}) -> {year, source}`; `lib/career/direction.ts#getStudentDirection(supabase, userId)` is the single server read used by every consumer (live read each request, no caching).

**Call sites that will use `isCareerDirectionWindow` (and nothing else):**
1. `lib/assessment/mode.ts#getAssessmentMode` (new) → used by `app/api/assessment/start`, `progress`, `[section]` and `lib/assessment/attempts.ts` — server picks the section list.
2. Goal-state prompt decision (`lib/career/direction.ts#shouldShowGoalPrompt`).
3. Launchpad visibility: `app/(app)/launchpad/page.tsx`, and nav lock via `AppShell → HeaderNav` (server computes a boolean, client component receives it).
4. AI Interview gate: `app/(app)/interview/page.tsx` (currently same 3-2 gate; keeps parity with Launchpad).
5. `lib/nav/config.ts#lockedUntilStage` — replaced by a `requiresDirectionWindow` flag.

`lib/journey/stage.ts#isStageUnlocked` and `UNLOCK_STAGE_KEY` are **deleted**. No other inline `end_year − year` math is permitted (final audit will grep for it).

## Semester-label call sites — migration plan (nothing touched yet)
Approach **U** = update call site directly to computed academic year; **D** = derive a display label for backward compatibility; **K** = keep reading stored legacy data (read-only display of old records).

| file | use | approach |
|---|---|---|
| `lib/journey/stage.ts` | stage table + gate | **U**: stage keyed by year of study (1–4); gate removed (replaced by trigger util) |
| `components/dashboard/JourneyTimeline.tsx` | stage highlight | **U**: takes computed year; 7 stages regroup to year-level (Y1 Discover, Y2 Develop→Build, Y3 Specialize→Experience, Y4 Prove→Launch; stage within a year not claimed, since semester granularity is dropped) |
| `app/api/v1/students/[studentId]/state/route.ts` | `academicPhaseIndex` | **U**: from computed year; `academicContext.year` becomes `{ academicYear, startYear, endYear }` |
| `components/shell/HeaderNav.tsx`, `AppShell.tsx`, `lib/nav/config.ts` | Launchpad/Interview lock | **U**: server-computed boolean prop |
| `app/(app)/launchpad/page.tsx`, `app/(app)/interview/page.tsx` | gate + "you're at stage X (3-2)" copy | **U**: gate via trigger util; copy says "Available in your final two years" — no semester text |
| `lib/dashboard/viewer.ts`, `lib/dashboard/data.ts`, `lib/dashboard/education.ts#getStudentBranchContext` | carry `year` string | **U**: add `startYear`,`endYear`,`academicYear`; keep `year` field temporarily as `null`-safe legacy passthrough until consumers below move, then remove |
| `components/dashboard/DashboardHeader.tsx`, `app/(app)/profile/page.tsx`, `app/(app)/settings/page.tsx` | "3rd Year, Sem 2" chip | **U**: "3rd Year · 2024–2028" from computed year + start/end |
| `components/education/EducationEntryCard.tsx` (+ profile entries list) | education history line | **K**: entries with `start_year/end_year` already render those; legacy-only rows keep their stored label (historic record, no logic) |
| `lib/assessment/attempts.ts:115` | result `year` | **U**: computed academic year |
| `lib/guide-path/generate.ts` | LLM prompt context "year-semester 2-1" | **D**: pass "year N of M (start–end)" derived string; no semester claims |
| `components/login/{SignupForm,auth}.ts`, DB `year` write in `handle_new_user` | capture | **U**: replaced by start/end year; `year` column no longer written for new accounts, retained for old rows |
| `lib/supabase/types.ts` | generated types | regenerate after migration |

Nothing in the app needs a fully derived "3-2" label, so **D** is used in exactly one place (LLM prompt context).

## Reflection-first prompt — which variant is live
Both are built. Data-driven text is gated on real data: a student qualifies only with ≥1 **verified** completion for a role (`arena_skill_ratings.verified_count` summed per `role_key`). Copy uses verified attempt counts, e.g. "You've completed **N verified Data Analyst tasks** on Capabilio. Does that still feel right, or do you want to explore something else?" — never "time spent" (time isn't recorded). Today: 1 student qualifies; everyone else gets the plain fallback (four options, no engagement claim). Because only one role is enabled, the data-driven variant's "explore something else" answer routes to the goal/direction options, not a role picker.

## Cadences (no existing recurring-prompt pattern in the app — only the one-time `has_seen_career_direction_intro` flag — so defaults apply)
- **Not sure / unset:** show the goal-state prompt on the first authenticated page load after ≥14 days since `goal_state_prompted_at` (or immediately if never prompted, once the trigger is met). Any answer or dismissal stamps `goal_state_prompted_at`. Unset (NULL) is treated as `not_sure`.
- **Higher Studies:** show "Still on this path?" once ≥90 days since `higher_studies_checkin_at` (initialized from `goal_state_updated_at`; terms aren't modeled). Continue → stamp; Switch → active-role retarget (requires ≥2 enabled roles, else honest "no other roles available yet" state and the stamp still records the answer).
- "Login" is approximated by first server render of the app layout after the interval (no separate login event is stored).

## Assessment mode
`getAssessmentMode(userId)` → `"full" | "light"`; light iff `isCareerDirectionWindow(end_year)`. Light = `verbal_communication` + `career_interests` (the existing sections that correspond to Communication + Career Interest). Server-side in the start/progress/section routes and `SECTION_ORDER` consumers; the client never sends a mode. A light attempt completes when its own section set is complete (`submit.ts:42` currently requires all 7).

## Where each UI lives
- Onboarding: `/signup` (start/end year; Google removed from `/login`), post-login **year confirm card** (dashboard banner + settings).
- Goal-state prompt: modal/banner rendered by `(app)/layout.tsx` when server says so.
- Always-accessible settings: `app/(app)/settings/direction/page.tsx` (goal state, confirm/override year, active domain role), linked from Settings and the header user menu.
- Job track: dashboard banner (Portfolio prompt after a real new verified completion since `portfolio_prompt_seen_at`; AI-interview push linking to `/interview`), Launchpad (real `opportunities` rows or empty state).
- Higher Studies: check-in banner on dashboard; Switch flow in direction settings.
- Entrepreneur: `app/(app)/entrepreneur/page.tsx` — static informational page, external links only, no forms.
- Portfolio: unchanged data; Portfolio-completion prompt links to it.
