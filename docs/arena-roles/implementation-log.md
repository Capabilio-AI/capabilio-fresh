# Arena roles: implementation log

Status values: NOT_STARTED, IN_PROGRESS, BLOCKED, PARTIALLY_VERIFIED, READY_FOR_ACCEPTANCE, COMPLETE.
A role is COMPLETE only after every applicable item in the role completion gate is verified. The catalog is in `lib/arena-roles/catalog.ts`.

## Summary (2026-10-22)

| Status | Roles |
|---|---|
| COMPLETE | none |
| IN_PROGRESS | IT-01 Data Analyst |
| NOT_STARTED | the other 44 |

## Phase 0: foundation

- Done: audit (`audit.md`), 45-role catalog with stable IDs and a unit test (8 tests, passing), baseline recorded.
- Done: the explicit A/B resolver (`chooseDomainSource`) and the no-substitution role resolver (audit defects 1 and 2).
- Not done: the role blueprint schema.

## IT-01 Data Analyst: IN_PROGRESS

Gate items verified so far: none of the gate. What exists and is unverified end to end: system A workstation with 8 enabled areas across 6 tools.

Decisions (2026-10-22): the role workstation wins over catalog tickets; a career with no workstation gets an "unavailable" state, never another role's tickets.

Done and tested locally (unit level only):

- `lib/arena-workstations/role-resolution.ts` (+test): role resolution with no "first enabled role" fallback. `attempts.ts` now returns `state: "no_role"` and `startNextAttempt` refuses with 409 `reason: no_role` and logs `role.unresolved`. `DomainWorkspace` shows the unavailable notice.
- `lib/arena-challenges/domain-source.ts` (+test): the Domain page now chooses the workstation first, catalog second, notice third, using the same role resolution as the API.
- Not changed: `pickActiveRole` (still asserted by `higher-studies-switch.test.ts`, no longer used by `attempts.ts`), the cooldown, Plan B logic, the database.

Also done (unit level only):

- `lib/arena-roles/blueprint.ts` + `blueprints/data-analyst.ts` (+tests): IT-01 blueprint with 9 competencies mapped to the 8 enabled areas, honest execution modes (executed / computed-key / evaluated-spec), and Python declared `blocked`. A test fails if a tool's registered gen/grade versions differ from the blueprint.
- Defect fixed: a "grading" lock was never released if the request died mid-grade, leaving the ticket stuck at "already being graded". The lock time is now stamped in `submitted_at` and a lock older than 120 s (route max is 60 s) can be taken over by one compare-and-set (`grading-lock.ts`). The database behaviour of the takeover is NOT tested; it needs a live test.
- Reviewed and found correct by reading, not by running: a grader exception reverts the ticket to "presented" with a 502 and awards nothing; the client sends only the submission, never a score; completion goes through `complete_workstation_attempt`, which reports `already_completed` on repeats.

Open before this role can pass:

1. Run `test:live` suites (`e2e.live`, `security.live`, `higher-studies-switch.live`) against a test project. Not run; they need `LIVE_DB=1` and credentials.
2. Per-criterion rubric detail (graders return per-check results, but criteria, weights and critical failures are not yet documented per tool).
3. Scenario pool and uniqueness rules (family / variant / instance / attempt).
4. Grading checks, idempotency and evaluation-failure paths under test.
5. Authorization / RLS tests, run live.
6. Browser verification of each tool. No e2e framework exists yet.
7. Python stays disabled unless an isolated executor is provided.
8. Clean up the `* 2.ts` Finder duplicates (they break `tsc` via `.next`).

Changes so far: `lib/arena-roles/*`, `lib/arena-workstations/{role-resolution,attempts}.ts`, `lib/arena-challenges/domain-source*`, the Domain page, `DomainWorkspace.tsx`, one type narrowing in `higher-studies-switch.live.test.ts`, `docs/arena-roles/*`. No database changes.
