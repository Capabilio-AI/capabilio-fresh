# Capabilio-fresh — Full Audit (2026-09-27)

Scope: this repository only (`Capabilio-fresh`, `main` @ `33577f9`). Two other, larger "Capabilio" codebases exist on this machine (`capabilio-web`, `Capabilio-new` — Express + Vite, separate Supabase projects) and are **not** covered here; see `docs/architecture/00-overview.md` for how that was confirmed.

## 1. Executive summary

A ~12,900-line Next.js 16 App Router application, one consistent stack since its first commit (no legacy Firestore, no partial migration, no separate backend service). The core Career-OS domain logic — assessment baseline, per-skill capability tracking, deterministic career/skill-gap matching, AI-assisted Guide Path generation — is real, working, and genuinely well-built. The gaps are almost entirely in **enforcement and surface area**, not in the underlying model: RBAC columns exist in the schema and are checked by zero routes; there is no test suite and no lint configuration at all; several product surfaces (SkillStudio catalog, Launchpad opportunities, Arena Projects/Competitions) are intentionally-isolated mock data standing in for tables that don't exist yet.

Everything below was re-verified against the live repo just now, not recalled from earlier in this session.

## 2. Tech stack

| Layer | Version / detail |
|---|---|
| Framework | Next.js **16.3.5**, App Router, Turbopack (dev default) |
| UI runtime | React **19.2.8**, TypeScript (`strict: true`) |
| Styling | Tailwind CSS **v4** (`@theme inline` token system in `app/globals.css`), `clsx` |
| Icons | `lucide-react` |
| Charts | `recharts` (installed, not yet used by any page) |
| Animation | `framer-motion` (marketing/landing components only — not used in the authenticated app shell) |
| Auth/DB | `@supabase/supabase-js` + `@supabase/ssr`, Postgres |
| AI | `groq-sdk` (`openai/gpt-oss-120b` via Groq — see `lib/ai/groq.ts`'s comment on why not Llama) |
| Validation | `zod` (every API route body) |
| Deployment | Vercel-conventions (no `vercel.json`, zero-config) |
| Package manager | npm (`package-lock.json` present) |

No test runner, no linter, no CI config anywhere in the repo (`package.json` has exactly three scripts: `dev`, `build`, `start`).

## 3. Route inventory (52 files: 30 pages/layouts, 22 API routes)

### Pages — public

| Route | State |
|---|---|
| `/` | Static marketing landing page |
| `/login`, `/signup`, `/reset-password`, `/verified` | Real Supabase Auth flows |
| `/auth/confirm` | Route handler, email-confirm callback |
| `/assessment` | Real assessment-taking flow (own layout, no shell) |

### Pages — authenticated app shell (`app/(app)/`, all real Supabase auth-guarded)

| Route | Data | Notes |
|---|---|---|
| `/dashboard` | Real | Career direction, capability, next-best-action, assessment results, journey timeline |
| `/dashboard/career-path` | Real | Career matches + AI-generated Guide Path |
| `/dashboard/portfolio` | Real | Vault items + Arena rating |
| `/dashboard/skills` | Real | |
| `/dashboard/skill-gap` | Real | |
| `/dashboard/vault` | Real | CRUD |
| `/arena` | Real | Hub + leaderboard |
| `/arena/challenges` | **Real** | Full timed-quiz engine with ELO scoring — the most complete single feature in the app |
| `/arena/projects`, `/arena/competitions` | **Mock** | `lib/mock/arena.ts` — no `projects`/`competitions` tables exist yet |
| `/pulse` | Real (For You tab) / locked (Following, Communities, Mentors — no follow-graph table) | |
| `/skillstudio`, `.../foundations`, `.../courses`, `.../certifications` | My Path real (Guide Path reuse); catalogs **mock** (`lib/mock/skillstudio.ts`) | |
| `/launchpad` | Stage-locked, **mock** opportunities (`lib/mock/launchpad.ts`) matched against real skill-gap data | |
| `/interview` | Stage-locked, entry cards only — no interview engine exists | |
| `/mentor` | **Real** — live Groq-backed chat grounded in the student's actual data | |
| `/notifications` | Real — derived from live signals, not a stored/fabricated feed | |
| `/settings` | Real — editable name via server action | |
| `/profile` | Real | |

### API routes

| Route | Auth | Notes |
|---|---|---|
| `/api/assessment/*` (7 routes) | `requireUser` | Full assessment lifecycle incl. coding questions (Wandbox) |
| `/api/arena/*` (4 routes) | `requireUser` | Start/answer/finish/leaderboard, real ELO math |
| `/api/capability/{evidence,history}` | `requireUser` | |
| `/api/career-matches` | `requireUser` | |
| `/api/guide-path`, `/api/guide-path/generate` | `requireUser` | AI-assisted, deterministic scoring |
| `/api/code/run` | `requireUser` | Proxies to Wandbox (see §7) |
| `/api/mentor/chat` | `requireUser` | Real Groq chat, grounded system prompt, graceful fallback on Groq failure |
| `/api/pulse/posts*` (3 routes) | `requireUser` | |
| `/api/vault*` (2 routes) | `requireUser` | |
| `/api/v1/students/[studentId]/state` | `requireUser` + role/institution check | New (this session); the only route in the repo that checks `institution_memberships.role`/`.status` |

`proxy.ts` (Next 16's `middleware.ts` equivalent) refreshes the Supabase session on every page request, explicitly excluding `/api/*` — each API route already re-verifies via `requireUser()`, so this avoids a redundant auth round-trip. Correct as designed.

## 4. Data layer — Supabase/Postgres

**Existing tables** (confirmed via `lib/supabase/types.ts`): `profiles`, `institutions`, `institution_memberships`, `assessment_attempts`, `assessment_responses`, `assessment_section_progress`, `capabilities`, `capability_history`, `career_interest_questions`, `career_interest_target`, `career_requirements`, `guide_paths`, `interests`, `posts`, `post_comments`, `post_likes`, `vault_items`, `arena_ratings`, `arena_challenge_attempts`, `question_bank`. Plus RPCs: `get_public_profiles`, `get_or_create_institution`, `get_or_start_section`, `record_arena_answer`, `record_assessment_response`, `record_coding_response`, `role_requires_verification`, `get_coding_question_for_grading`, `start_arena_challenge`.

**Notable, already-real design**: `capability_history.source` is a proper enum (`initial_assessment | reassessment | learning_module | project | arena_challenge`) — evidence provenance exists at the schema level even though `learning_module` and `project` have no producing feature yet. `institution_memberships.role` (`app_role`: student/faculty/hod/principal/vice_principal/ceo/mentor/professional) and `.status` (`pending/active/revoked`) are real columns — see §5.

**New, not-yet-applied schema** (`supabase/migrations/20260927000000_career_os_foundations.sql`, written this session, reviewed but never run against the live database): college hierarchy (`programs`/`departments`/`cohorts`), Journey Engine (`journey_templates`/`journey_phases`/`student_journeys`/`student_journey_events`), `plan_b_explorations`, Project Lab (`projects`/`project_members`/`project_milestones`/`project_contributions`), `evidence`, `mentor_evaluations`, a `skills` catalog, and a first-pass `opportunities`/`applications`/`recruiters`. Full rationale in `docs/architecture/01-domain-model.md`.

**Service-role usage** (`lib/supabase/service.ts`, correctly documented as RLS-bypassing, server-only): called from `/api/capability/evidence`, `/api/guide-path/generate`, `/api/assessment/career-interests`, `/api/assessment/[section]/submit` — all four are writing system-computed data (scores, generated paths), not echoing arbitrary client input, which is the safe pattern the file's own comment prescribes.

## 5. Authentication & authorization — the biggest real finding

- **Authentication** is solid: cookie-based Supabase sessions, refreshed by `proxy.ts`, every API route re-verifies via `requireUser()`, every page does its own `auth.getUser()` check (deduped via `lib/supabase/auth.ts`'s `cache()`-wrapped `requireAuthedUser()`, added this session for the layout+page double-call).
- **Authorization (RBAC) is modeled but almost entirely unenforced.** `institution_memberships.role` and `.status` have existed in the schema since before this session; until the new `/api/v1/students/[studentId]/state` route, **no page or route in the repo ever read them.** Every account — regardless of `role` — sees an identical UI and has identical API access. There is no faculty/HOD/principal/CEO/mentor/professional surface anywhere; the signup flow lets a user pick one of those roles (`components/login/RoleSelector.tsx`), but picking "faculty" today grants no different behavior than "student." This isn't a vulnerability today (nothing sensitive is gated by role yet) but it means the moment any admin/staff feature ships without this being addressed, everyone with an account can reach it.
- Tenant isolation for the *student's own* data relies on RLS (`user_id = auth.uid()` policies, presumed on existing tables — not independently re-verified against the live database this session, since no local Postgres/Docker was available to test against; flagged, not confirmed).

## 6. AI integration

Single shared Groq client (`lib/ai/groq.ts`, model `openai/gpt-oss-120b`), three call sites:

1. `lib/question-bank/generate.ts` — assessment question generation, JSON-mode + schema validation + retry-on-invalid-JSON.
2. `lib/guide-path/generate.ts` — Guide Path narrative. System prompt explicitly forbids inventing/altering scores; every number is computed deterministically first, AI only sequences and narrates.
3. `app/api/mentor/chat/route.ts` — free-text chat, grounded in real student data (top career match, readiness, biggest skill gap, weak sections), explicit "never invent" instruction, graceful non-500 fallback on failure.

No centralized "AI Gateway" module exists yet — each site imports `lib/ai/groq.ts` directly. Not a problem at 3 call sites; would be worth consolidating past 4-5 (rate limiting, cost tracking in one place).

## 7. External dependencies & their risk profile

- **Wandbox** (`lib/code-execution/wandbox.ts`): free, public, no-API-key code execution service, used for the assessment's "Run" button (Python/C only). 15s timeout, 10K-char code cap, 2K-char stdin cap, auth-gated. **No per-user rate limiting** — a logged-in student could send an unbounded number of requests to a third-party free service under this app's identity. Low severity (no grading/scoring path through this endpoint, per its own comment) but worth a rate limit if abuse is ever observed.
- **Groq**: paid API, key server-side only, never exposed to the client.
- **Supabase**: the actual system of record; both anon (RLS-scoped) and service-role (bypasses RLS, server-only) clients are used, correctly separated.

## 8. Design system

Two token systems coexist in `app/globals.css`, both real and in active use:
- `lp-*` tokens — the original landing-page system (`#faf9f5` cream, ochre/indigo accents, Geist/Inter/JetBrains Mono) — still used by marketing components and several older dashboard sub-components (`SkillsTab.tsx`, `SkillGapsTab.tsx`, `VaultTab.tsx`, `ArenaView.tsx`, `PulseFeed.tsx`).
- `app-*` tokens — added this session for the redesigned app shell (`#FF5701` orange, `#171717` charcoal, `#FAFAF8` background, muted/border/blue/success/warning/attention + container variants).

These are visually close (both warm-neutral) but not identical — a full pass to migrate the older `lp-*`-styled components to `app-*` tokens would tighten consistency; not done this session to avoid touching working, already-shipped UI beyond what was asked. `components/dashboard/tier.ts`'s score-tier colors were updated to use `app-*` tokens with non-alarmist language ("Needs development" instead of red-for-everything) and are shared correctly across old and new components.

## 9. Mock data inventory (all isolated under `lib/mock/`, each file header-commented with what real table it stands in for)

| File | Backs | Real table needed |
|---|---|---|
| `lib/mock/arena.ts` | Arena Projects/Competitions | `projects`, `competitions` (schema for the former exists in the new migration; not applied) |
| `lib/mock/skillstudio.ts` | Foundations/Courses/Certifications catalogs | No content-authoring table designed yet |
| `lib/mock/launchpad.ts` | Launchpad opportunities | `opportunities` (schema exists in new migration; not applied) |
| `lib/mock/pulse.ts` | Trending topics, people-to-follow | `follows`, `communities` (not modeled) |

No mock data is ever written back to the database, and none of it is presented as production data — each surface carries an explicit "in development" note in its UI.

## 10. Security findings, ranked

1. **RBAC unenforced** (§5) — modeled, not checked anywhere except the one new endpoint. Medium priority: no current exposure, but blocks any admin feature from shipping safely.
2. **RLS on the new migration's tables is untested** — reviewed for syntax, never dry-run (no local Postgres available this session). Must be verified on a staging/branch project with a real second account before the migration is applied to production.
3. **No rate limiting anywhere** — not on `/api/code/run` (third-party cost/abuse), not on `/api/mentor/chat` (Groq cost), not on assessment submission. Low-to-medium depending on real traffic.
4. **Secrets handling is clean** — verified no `NEXT_PUBLIC_`-prefixed secret, no service-role key or Groq key referenced in any client component, no hardcoded credentials anywhere in source.
5. **No audit/consent logging** — acceptable today (no sensitive cross-user data access exists yet), becomes a real requirement the moment a recruiter or admin surface ships.

## 11. Performance

Diagnosed and fixed this session: dev-mode "lag" was (a) Turbopack's one-time per-route compile on first visit — not fixable, not present in production (`next build && next start`), and (b) every navigation triggering two separate Supabase `auth.getUser()` network calls (layout + page). Fix: `lib/supabase/auth.ts`'s `requireAuthedUser()`, wrapped in React's `cache()`, applied across all 21 app pages + the layout — deduped to one call per navigation. Added `app/(app)/loading.tsx` for instant navigation feedback. Warm route response times measured at 63–127ms.

## 12. Code quality

- **Zero test files, zero lint config.** No `*.test.ts`, no `.eslintrc`/`eslint.config.*`, no CI. This is the single most actionable gap for long-term maintainability — nothing currently catches a regression except manual testing or `tsc`.
- **Zero `console.log`/`console.warn`** left in `app`/`components`/`lib` — clean.
- **Zero `TODO`/`FIXME`** markers — either genuinely no known debt markers, or debt is undocumented; the honest ledger lives in `docs/architecture/08-roadmap.md` instead.
- `tsc --noEmit` is clean as of this audit; `next build` succeeds (45 routes compiled).
- ~12,900 lines across `app/`, `components/`, `lib/` (17 top-level `lib/` modules).
- One static asset in `public/` (`logo-mark.jpg`) — no favicon variants, no OG image.

## 13. Git & deployment state

- `main` @ `33577f9`, no remote configured on this checkout (nothing pushed anywhere outside this machine).
- One uncommitted, pre-existing local change on `main`: `next.config.ts` (`allowedDevOrigins` for `localhost`/`*.ngrok-free.dev`) — not made by this session's work, left untouched.
- All work this session was done in an isolated git worktree (`.claude/worktrees/mellow-plotting-stearns`, branch `worktree-mellow-plotting-stearns`) and merged into `main` after each verified build — no direct commits to `main` from inside the worktree.

## 14. Prioritized recommendations

1. **Decide if/when RBAC gets enforced** before building any admin, faculty, or recruiter-facing surface — the columns are ready, nothing reads them yet.
2. **Add a test runner and lint config.** Even a minimal Vitest + `next lint` setup would catch regressions that `tsc` alone can't (logic bugs, not just type errors).
3. **Dry-run the new migration on a Supabase branch/staging project**, verify RLS with two real accounts, before applying to production.
4. **Rate-limit `/api/code/run` and `/api/mentor/chat`** if/when real usage justifies the cost of building it — not urgent at current scale.
5. **Consolidate the two CSS token systems** (`lp-*` vs `app-*`) the next time any of the still-`lp-*`-styled components (`SkillsTab`, `SkillGapsTab`, `VaultTab`, `ArenaView`, `PulseFeed`) get touched for another reason — not worth a standalone pass on working UI.
