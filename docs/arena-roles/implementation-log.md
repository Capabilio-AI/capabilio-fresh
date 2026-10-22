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

Gate status: PARTIALLY_VERIFIED (unit level; live and browser checks outstanding). IT-02 was started at the owner's instruction while this gate was open.

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

## IT-02 Backend Developer: IN_PROGRESS (BLOCKED on a production migration)

Started 2026-10-22 on the owner's instruction, with IT-01 still PARTIALLY_VERIFIED (not waived: its open items stay listed above).

Found:

- The role is already coded: AI generator Backend mode (`lib/workplace/code/ai.ts`), 5 template problems (one per area, `problems.ts`), the shared `code_workspace` tool, and the sandbox.
- `supabase/migrations/113_backend_role.sql` defines the role, its career and 5 areas but is NOT applied to production (`arena_domain_roles` has no `backend-developer`; verified 2026-10-22). Until it is applied, a Backend student gets the "no workstation" state. Not applied by me: it is a production write and needs your approval.
- Grading trusts the browser: the student's function runs client-side and the server compares the returned outputs. Student code is never run or inspected server-side, so a student can submit correct outputs by any means. Mitigation is the explain-your-work interview only.
- Tasks model an API as a pure function. No real HTTP, database, auth stack or test runner exists, so four competencies are declared unassessed (database, automated tests, performance, documentation) rather than claimed.
- Template fallback repeats a problem once a title was already served (one template per area).

Done (unit level): `blueprints/backend-developer.ts` (7 assessed + 4 unassessed competencies, all 5 areas `client-run`), catalog key set, blueprint validator extended (`unassessed`, `client-run`), sandbox-escape tests (process / require / constructor-chain / eval / Function all blocked; the Node `vm` is not a hardened boundary, the worker thread and timeout are the main protection).

Open: apply migration 113 (needs approval) then live run; more template problems or a validated variant source to avoid repeats; browser check of the code editor; rubric detail; server-side execution of student code is BLOCKED on an isolated executor.

## Founder decisions (2026-10-22, owner delegated ordinary product and engineering calls)

1. **Phase 1 first, no executor spend.** Build the Lab/Proof Session engine on the browser tools that exist. The isolated executor stays a separate, costed decision; nothing is purchased or enabled.
2. **Proof Session v1 = a "story session" on the existing BrightCart company world**: 5 stages, each an existing Data Analyst area and tool, graded by its own grader on the student's own warehouse. A later stage is not computed from an earlier stage's output (stated in every report); real lineage is a later step.
3. **Signals are deterministic, not an AI judge.** Dimension levels (0-3, or "not assessed") come from the session log with caps and de-duplication; anything the browser reports is marked lower-trust; pass/fail and the Execution dimension come only from server grading. No composite score.
4. **Logs and reports are private to the student by default.** Sharing needs an explicit student action (not built yet).
5. **Not done without authorization:** applying migrations 113 and 120 to production, running `test:live` against the only (production) Supabase project, any paid infrastructure.

## IT-01 Data Analyst: IN_PROGRESS (Proof Session core built, not wired)

Built and tested locally (unit and local-Postgres level):

- `lib/arena-roles/session/{events,signals,report}.ts`: event schema, the six dimension signals, and the report builder (claims only what the server verified). 22 tests, including: repeats counted once, late or short plans earn nothing, lowest level across stages, AI not used is never penalised, a client-reported "passed" cannot change a result.
- `lib/arena-roles/sessions/data-analyst-story.ts`: the 5-stage spec, with a fresher variant (statistics replaces investigation, which needs experience). Tests check every stage uses an enabled, registered area the student can actually be served.
- `supabase/migrations/120_proof_sessions.sql`: four additive tables (sessions, stages, append-only events, write-once reports), RLS on, server-only access. NOT applied to production. 8 tests run the real SQL on PGlite and a mutation check confirmed they fail when the index, trigger or grants are removed. PGlite stands in for Supabase (no real auth, RLS policies or `service_role` behaviour), so this is not a production verification.

Verification: full suite 245 files / 1963 tests pass; `tsc` 0 source errors; eslint clean. No browser test, no live-database test.

Not built yet (so the role is not wired end to end): session service (start, record events from the routes, finish, build report), API routes, the workbench and report UI, explain-your-work for sessions, portfolio entry, a Lab spec layer, quests. Next step: the session service and routes, tested against the migration on PGlite where possible.
