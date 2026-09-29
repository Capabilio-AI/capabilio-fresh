# Job-Track Progress

**Current phase:** 4 (goal_state, trigger, assessment gating) — next.

## Decisions
- Blocker resolved: Option 1 (`active_role_key` on membership, read first by `resolveRole`). Switch UI only offers targets when ≥2 roles are enabled.
- Add `handle_new_user` to repo migration in Phase 3 (converge repo + prod).
- `isStageUnlocked` is deleted in favor of `lib/career/trigger.ts#isCareerDirectionWindow`.
- Semester-label call-site plan approved-by-default: see audit doc Phase 2 table.
- Reflection copy uses verified attempt counts per role.
- Launchpad mock removed in Phase 5; real `opportunities` table wired with empty state.

## Done
- Phase 1 audit (f704993). Phase 2 design (audit doc, appended).

- Phase 3 onboarding: migration 030 applied to prod (goal_state*, year_*, active_role_key, portfolio_prompt_seen_at, institutions.academic_start_month; handle_new_user now in repo; label→years backfill hit 2 rows, unconfirmed). Signup uses start/end year (validated client + trigger). Google removed from login. Get Started → /signup (Navbar, Hero, FinalCTA; root cause was href="#"). Year confirm card + `POST /api/direction/year` (strict zod). Verified: tsc clean, 268 tests pass, eslint clean.
- Note: institution_memberships has no UPDATE RLS policy -> service-role writes only via API routes. Known residual: `institution_memberships_insert_own` lets a client insert its own row with arbitrary column values (pre-existing); the app never reads goal_state from client input.

## Remaining
Phase 3 leftovers folded into Phase 4: semester-label call sites per audit table, delete `isStageUnlocked`.
Phases 4–7.
