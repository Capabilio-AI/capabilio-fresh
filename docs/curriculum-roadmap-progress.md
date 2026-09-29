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
