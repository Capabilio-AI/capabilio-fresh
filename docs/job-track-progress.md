# Job-Track Progress

**Current phase:** 3 (Onboarding rework) — starting.

## Decisions
- Blocker resolved: Option 1 (`active_role_key` on membership, read first by `resolveRole`). Switch UI only offers targets when ≥2 roles are enabled.
- Add `handle_new_user` to repo migration in Phase 3 (converge repo + prod).
- `isStageUnlocked` is deleted in favor of `lib/career/trigger.ts#isCareerDirectionWindow`.
- Semester-label call-site plan approved-by-default: see audit doc Phase 2 table.
- Reflection copy uses verified attempt counts per role.
- Launchpad mock removed in Phase 5; real `opportunities` table wired with empty state.

## Done
- Phase 1 audit (f704993). Phase 2 design (audit doc, appended).

## Remaining
Phases 3–7.
