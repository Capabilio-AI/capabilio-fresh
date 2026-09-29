# Curriculum Roadmap Engine — Progress

**Current phase:** COMPLETE (Phases 1–7). See audit doc 'Phases 5–7 — Build and verification record'.

## Decisions
- Admin gate = existing `can("organisation","admin",{organisationId})`; operator script activates one admin; no new role system.
- Target college = Amrita Sai Institute Of Science And Technology; role = Data Analyst; no curriculum invented — the real student sees the honest "not available yet" state until an admin uploads.
- Readiness = minimum `verified_count` per area (rating scale is inconsistent: baseline 400 vs difficulty bands ~1200).
- Skill Graph read path = `getWorkstationState().progress`.

## Done
- Phase 1 audit (`docs/curriculum-roadmap-audit.md`).

- Phase 2 design (audit doc appended).
- Phase 3: migration 033 applied (4 private tables; seeds: Data Analyst target profile min 3 per enabled area, 2 curated certifications, flagged for product review). Admin backend: `getOrgAdmin` (existing `can(organisation, admin)`), `/api/admin/curriculum/*`, CSV import + preview, propose-only AI suggest, admin page `/admin/curriculum` (404 for non-admins), `scripts/grant-org-admin.mjs`. Live test (`lib/roadmap/admin.live.test.ts`) verifies gating (student, pending principal, cross-institution), no direct client access to any of the 4 tables (even as an admin), duplicates skipped, invalid areas rejected, replace-not-append mapping, cross-institution mapping/delete refused. Fixtures self-deleted (verified).

- Phase 4: pure engine `lib/roadmap/build.ts` (14 unit tests: buckets, timing, beyond-curriculum, deterministic arena focus, resources only from stored list, zero-evidence, Python never a gap, every needs_info reason) + loader `lib/roadmap/load.ts` (job track only, confirmed year only, reuses getStudentDirection + getWorkstationState) + live test on disposable fixtures (needs_info states, buckets, case-insensitive branch, no cross-college leak, live track gating).

- Phase 5: `/dashboard/roadmap` + job-track-only tab (context) + honest needs_info UI. Phase 6: guards test (admin gating, visibility, AI isolation) + static migration test. Phase 7: lint/tsc/tests(333)/build green; real-student read-only check = needs_info [year_unknown, no_curriculum] for all 3.

## Remaining
Nothing in scope. Deferred items listed in the audit doc.

## Post-review status (five review questions)
1. **Authorization sweep done** — all role/membership checks require `active`; two gaps found and fixed (RLS read policies on programs/departments/cohorts → migration 034; `getStudentDirection` no longer falls back to non-active rows). Table in `docs/job-track-audit.md` §R1.
2. **Test-role exposure disproved from data + logs** — §R2.
3. **Browser click-through: NOT DONE — blocked.** The Claude-in-Chrome extension has no connected browser (`list_connected_browsers` → `[]`). A dev server for this repo (pid 461, port 3000, not started by this session) is already running, and Next refuses a second dev server in the same directory. Needed to finish: connect the extension; restart the dev server with `ALLOW_TEST_ROLES=1` (only the Switch step needs it). Plan when unblocked: signup UI (test email at `example.com`, confirmed via admin API) → `/settings/direction` edit end year into the trigger window → prompt modal → four goal states → backdate `higher_studies_checkin_at` 91 days (fixture) → dashboard check-in → Switch, with an evidence snapshot before/after; then delete every fixture.
4. **`scripts/grant-org-admin.mjs` for Amrita Sai: explicitly DEFERRED, not in scope.** It confers real authority (edit curriculum, later see cohort data) on a real person: that needs the user's decision about who, plus that person to have an account — today all 3 profiles are students and no principal/vice-principal/CEO account exists. Proper path: the org-admin invitation flow (architecture doc §8.1). The script remains available for an explicit operator run once someone is named. The roadmap therefore stays in its honest `needs_info` state for Amrita students until then.
5. **Rating-scale mismatch is not roadmap-only** — out of scope by decision, now written up in its own document: `docs/arena-rating-scale-mismatch.md` (includes the interaction with the unapplied migration 029). Not changed.
6. **Deterministic-selection sweep done** — see `docs/job-track-audit.md` §R6 (migration 035 + code fixes + guard test; two items listed as separate tasks).
