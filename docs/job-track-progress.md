# Job-Track Career-Direction Loop — Progress

## Current phase
**Stopped after Phase 1 (Audit), awaiting a decision on the blocker in
`docs/job-track-audit.md` §3 before starting Phase 2 (Design).**

## Done and verified
- Read `docs/CAPABILIO_PRODUCT_ARCHITECTURE.md` in full (§4, §5, §9, §10 as required).
- Phase 1 audit complete, written to `docs/job-track-audit.md`:
  - Onboarding: fields, `handle_new_user()` trigger, every reader of `institution_memberships.year`,
    Google auth references, exact root cause of the "Get Started" bug (found: `FinalCTA.tsx`
    uses a literal `href="#"` placeholder).
  - Membership schema: confirmed live via direct DB query — `start_year`/`end_year`
    already exist (migration 015, applied 2026-09-28); `goal_state` does not exist
    anywhere yet.
  - **Discrepancy found:** migration `003_organisations_rename.sql`'s rename of
    `institution_memberships` → `organisation_memberships` was never actually applied to
    production — the live table is still `institution_memberships`. Migration file
    chronology in this repo is not fully trustworthy; verified against
    `lib/supabase/types.ts` and live `information_schema` instead.
  - Arena domain-role switching: **found a genuine blocker**, reported per the task's own
    instruction — see below.
  - Real Arena engagement data: confirmed via direct query there is effectively none (0
    rotation-state rows, 1 domain completion, 1 stream completion, across 3 total users).
    Decided: fallback (non-data-driven) reflection-prompt variant must be the one wired
    live at launch.
  - Assessment: confirmed the 7 sections and that "lighter assessment" maps cleanly to
    `verbal_communication` + `career_interests`.
  - Portfolio/Evidence: real. AI Interview: real. Launchpad: currently fabricated
    (`MOCK_OPPORTUNITIES`) with an honest on-page disclosure — decided this must **not**
    be reused for the new Job-track surfacing; a genuine empty state is required there
    instead.
  - Design-system components identified for reuse (cards, forms, modal, settings page
    location).

## Blocker — needs a decision before continuing
`docs/job-track-audit.md` §3: Arena domain-role switching is not currently a safe,
clean config-only operation. `resolveRole()` makes an already-engaged role "sticky"
forever (ignores `career_interest_target.stated_role` changes once any
`arena_rotation_state` row exists for a role), and its role lookup uses
`.limit(1)` with no deterministic ordering. Fix proposed: add one explicit
"active role" pointer that `resolveRole()` checks first, plus a small generic
(not per-role) code change. This preserves all prior evidence/ELO/rotation data
exactly as rule 8 requires. Recommended to proceed with this fix in Phase 5,
but stopping to confirm before building it, per the task's explicit instruction.

## What remains
- Phase 2: Design (schema/migration plan write-up, shared trigger utility signature +
  full call-site list, cadence confirmation, UI placement) — blocked on the above.
- Phase 3: Onboarding rework.
- Phase 4: goal_state model, trigger utility, assessment gating, reflection prompt, settings page.
- Phase 5: Job / Higher Studies / Entrepreneur / Not Sure experiences.
- Phase 6: Tests.
- Phase 7: Verify + final report.

## If resuming
Read this file, then `docs/job-track-audit.md` in full, then continue from Phase 2 once
the blocker decision is made.
