# Job-Track Progress

**Current phase:** COMPLETE (Phases 1–7). See audit doc 'Phase 7 — Verification record'.

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

- Phase 4: semester-label call sites migrated (approach U; `year` no longer read anywhere except legacy DB column; education rows show start–end years; guide-path prompt derives year context). `isStageUnlocked`/`UNLOCK_STAGE_KEY` deleted; Launchpad, AI Interview, nav lock all use `viewer.direction.inDirectionWindow` (from `isCareerDirectionWindow`). `lib/assessment/mode.ts` picks light/full server-side; section routes 403 out-of-mode sections; light attempts never seed Arena ELO; dashboard lists only sections taken. Goal-state: `PUT /api/direction/goal-state`, `POST /api/direction/dismiss` (strict zod), prompt modal (reflection variant only with real verified counts), `/settings/direction`. 55 career tests + rest pass.
- Deviation from Phase 2 table: EducationEntryCard/profile education line shows start–end years, not the legacy label (backfill gave B.Tech rows years).

- Phase 5: Launchpad now queries real `opportunities` (open = no/future deadline) with honest empty state; `lib/mock/launchpad.ts` deleted. TrackPanel on dashboard: Job (portfolio prompt only on real new `arena_attempt_completions` since `portfolio_prompt_seen_at`; interview push links to real infra, real session count), Higher Studies (90-day check-in; Switch = `PUT /api/direction/active-role` → sets only `active_role_key` + check-in stamp; resolver `pickActiveRole` reads it first; Switch only offered when another enabled role exists — today none, so honest 'nothing to switch to'), Entrepreneur (static `/entrepreneur`, external links only, no forms). Unset/not_sure => job everywhere via `trackFor`.
- Known gaps: no on-demand domain-role switch outside the 90-day check-in; other `lib/mock/*` (skillstudio, arena, pulse) remain and are out of this task's scope.

## Remaining (old list, done)
Phase 5: Launchpad real query + honest empty state, Portfolio/interview pushes, Higher Studies check-in + Switch (active_role_key, resolveRole), Entrepreneur page, Not-sure cadence confirmation. Phases 6–7.

- Phase 6 tests: consistency.test.ts (no Google, Get Started, single trigger implementation via source scan with mutation check, assessment/prompt/Launchpad agreement sweep, section guard, Launchpad empty), direction-writes/higher-studies-switch/reflection tests. Phase 7 verification recorded in audit doc.

## Phase 1 findings carried over (from the fuller audit committed in 042adfd; full detail in the audit doc §§1–7)
- Live table is still `institution_memberships`: migration 003's rename was never applied to production. Repo migration chronology isn't fully trustworthy — verified against live `information_schema`.
- Engagement data at audit time: 0 rotation-state rows, 1 domain completion, 1 stream completion, 3 users → fallback prompt variant is the default; data-driven variant is live only for a student with ≥1 verified Arena completion.
- `resolveRole()` had an un-ordered `.limit(1)` on `arena_rotation_state`; the explicit `active_role_key` pointer now takes precedence (pickActiveRole), so a Switch is deterministic. The un-ordered lookup remains only for students who have never explicitly chosen a role.
- Launchpad was fabricated (`MOCK_OPPORTUNITIES`) — removed in Phase 5.

## Part A close-out (checkpoint)
- A1 fixed (mig 031): direct client insert of role/goal_state/active_role_key had SUCCEEDED; `profiles.primary_role` self-promotion also fixed. Permanent tests added.
- A2 done on production with `test-` role + disposable user (no staging: branching needs Pro); evidence for old role byte-identical after Switch; all fixtures deleted and verified.
- A3 reverted (mig 032): no year inference from created_at/label.
- See audit doc "Part A" for detail.
