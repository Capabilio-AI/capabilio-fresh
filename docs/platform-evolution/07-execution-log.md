# Execution Log — Phase 1 (2026-09-27)

Per §24: exactly what happened, against §21's audit categories. Nothing below is claimed done unless it was actually run and verified against the live database (`gudsoflidkkmtnxvzicw`) this session.

## Applied to production (live, verified)

| Migration | What | Verification |
|---|---|---|
| `002_career_os_foundations` | Program/Department/Cohort hierarchy, skills catalog, Journey Engine tables, Plan B, Project Lab, Evidence, Mentor Evaluation, Opportunities/Applications/Recruiters | Applied clean; purely additive |
| `004_rbac_foundations` | `roles`, `role_permissions`, seeded with the brief's role set (+ existing `vice_principal`/`ceo`, kept — not in scope to drop) | Applied; one semantic bug found and fixed in `007` (see below) |
| `005_person_extensions` | `professional_context`, `executive_context`, `audit_logs` | Applied clean |
| `006_fix_recruiters_policy_and_search_path` | Fixed two gaps the security advisor caught in my own `002`/`004`: `recruiters` had RLS enabled with zero policies (nobody, including the owner, could read anything); `set_updated_at()` was missing the `search_path` pin every other function in this DB has | Applied; advisor re-run clean on both |
| `007_fix_person_permission_semantics` | `role_permissions.resource = 'person'` was seeded onto every role including plain `student` — as designed, that resource means "may read ANOTHER person's record," so a student would have incorrectly passed a cross-person authorization check. Removed the over-broad grants for `student`/`graduate`/`professional`/`executive` | Applied; re-verified only staff-like roles hold it |
| `008_rate_limit_hits` | New table for DB-backed rate limiting | Applied |
| `009_rate_limit_increment_fn` | Atomic upsert-increment function | Applied |
| `010_lock_down_rate_limit_fn` | Found during review: the increment function takes an arbitrary `p_user_id`, which any authenticated client could otherwise call directly via PostgREST to grief another user's bucket. Revoked `EXECUTE` from `authenticated`/`anon`/`public` | Applied; advisor confirms the function no longer appears in the "callable by signed-in users" list |

**`lib/supabase/types.ts` was regenerated from the live schema twice** (once after the additive tables, once after the rate-limit function existed) — not hand-edited.

## NOT applied — blocked, not silently skipped

`003_organisations_rename` (institutions→organisations, institution_memberships→organisation_memberships, org_type, the three dependent function rewrites) was staged for direct application after your explicit go-ahead, and was **blocked by Claude Code's own safety classifier** as a destructive-looking production DDL action (table rename + function drop) — independent of your approval. The exact, live-verified SQL is in `supabase/migrations/003_organisations_rename.sql`, ready to run manually (Supabase SQL editor or `supabase db push`). Application code was **not** changed to the new names, since the database wasn't renamed — see that file's own header comment for what must change in the same deploy when you do run it.

## RLS verification — real, read-only, against real accounts

No Supabase branch was available (free-tier project) and a write-based test (even a throwaway row) was also blocked by the safety classifier as a production write. Verified instead with pure `SELECT`s under `SET LOCAL ROLE` + `request.jwt.claims` impersonation, using your 3 real accounts and their real data — zero rows written or modified:

- User A and User B each see **only their own row** in `institution_memberships` (not each other's, not all 3).
- The `anon` role sees **zero rows** in `institution_memberships`.
- User B (with 119 real `capabilities` rows) sees exactly 119 — **zero rows leaked** from the other 70 rows belonging to other users in that table.
- The new `roles`/`role_permissions` tables' read-all policy correctly returns all 15/61 rows to any authenticated user, as designed (they're reference data, not per-user).

## Engineering quality (§16)

Vitest + `eslint.config.mjs` (flat config, `eslint-config-next`) + `.github/workflows/ci.yml` added. First lint run surfaced 30 real, pre-existing problems (none introduced this session): fixed everything in code touched this session (my own dashboard `try/catch` around JSX — restructured per the new `react-hooks/error-boundaries` rule; 6 unescaped-quote issues in copy I wrote; one JSX text node that looked like a stray comment). **Left untouched, documented as known debt:** 4 `react-hooks/set-state-in-effect` errors in pre-existing timer/debounce code (`ArenaView.tsx`, `AssessmentRunner.tsx`, `BranchAutocomplete.tsx`, `CollegeAutocomplete.tsx`) — refactoring live countdown-timer and autocomplete-debounce logic without dedicated behavioral testing is exactly the kind of blind change that could regress the assessment/Arena timing this pass was told not to break.

26 unit tests added and passing: `computeSkillGaps`/`buildCareerMatch`, `scoreTier`, `currentStageIndex`/`isStageUnlocked`, `computeNextAction`, and a new `computeEloUpdate` (a tested TypeScript port of the live `finish_arena_challenge` RPC's exact formula — the RPC itself remains the real scoring path, untouched).

CI workflow is written and correct but **cannot run yet** — this repo has no configured git remote, so there's nowhere for GitHub Actions to trigger from until you push it somewhere and add the four secrets it references.

## Rate limiting (§17)

DB-backed (correct across serverless instances, unlike an in-memory counter), wired into all three named surfaces: `/api/code/run` (20/min), `/api/mentor/chat` (20/min), and all 7 `/api/assessment/*` routes (30-120/min depending on real cost — tightest on `coding-submit` and `career-interests`, which trigger Wandbox/Groq calls respectively).

## What Phase 1 did not touch (by design, not oversight)

Opportunity matching engine, `/company/*` recruiter routes, `/professional/*` and `/executive/*` UI, AI Gateway centralization, mock-data replacement for Arena Projects/SkillStudio catalogs/Pulse. All scoped into Phases 2-5 in `08-roadmap.md` (from the prior architecture pass) — building any of them now, ahead of their prerequisites, would produce exactly the "reachable but not connected end-to-end" surface §24 says never to report as done.
