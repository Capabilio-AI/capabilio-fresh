# Curriculum Roadmap Engine — Progress

**Current phase:** 2 (Design) — Part A complete (see job-track docs), Phase 1 audit written.

## Decisions
- Admin gate = existing `can("organisation","admin",{organisationId})`; operator script activates one admin; no new role system.
- Target college = Amrita Sai Institute Of Science And Technology; role = Data Analyst; no curriculum invented — the real student sees the honest "not available yet" state until an admin uploads.
- Readiness = minimum `verified_count` per area (rating scale is inconsistent: baseline 400 vs difficulty bands ~1200).
- Skill Graph read path = `getWorkstationState().progress`.

## Done
- Phase 1 audit (`docs/curriculum-roadmap-audit.md`).

## Remaining
Phases 2–7.
