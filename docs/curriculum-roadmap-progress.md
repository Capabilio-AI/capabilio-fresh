# Curriculum Roadmap Engine — Progress

**Current phase:** 4 (gap-analysis engine) — Phases 1–3 done.

## Decisions
- Admin gate = existing `can("organisation","admin",{organisationId})`; operator script activates one admin; no new role system.
- Target college = Amrita Sai Institute Of Science And Technology; role = Data Analyst; no curriculum invented — the real student sees the honest "not available yet" state until an admin uploads.
- Readiness = minimum `verified_count` per area (rating scale is inconsistent: baseline 400 vs difficulty bands ~1200).
- Skill Graph read path = `getWorkstationState().progress`.

## Done
- Phase 1 audit (`docs/curriculum-roadmap-audit.md`).

- Phase 2 design (audit doc appended).
- Phase 3: migration 033 applied (4 private tables; seeds: Data Analyst target profile min 3 per enabled area, 2 curated certifications, flagged for product review). Admin backend: `getOrgAdmin` (existing `can(organisation, admin)`), `/api/admin/curriculum/*`, CSV import + preview, propose-only AI suggest, admin page `/admin/curriculum` (404 for non-admins), `scripts/grant-org-admin.mjs`. Live test (`lib/roadmap/admin.live.test.ts`) verifies gating (student, pending principal, cross-institution), no direct client access to any of the 4 tables (even as an admin), duplicates skipped, invalid areas rejected, replace-not-append mapping, cross-institution mapping/delete refused. Fixtures self-deleted (verified).

## Remaining
Phases 4–7.
