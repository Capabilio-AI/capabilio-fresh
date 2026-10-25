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

### IT-01 progress, second pass (2026-10-22): Proof Session wired end to end in code, NOT live

Production state: **migration 120 is NOT applied.** The permission system denied `apply_migration` ("Modify Shared Resources"), so I stopped and did not route around it. Migration 113 (Backend role) is also not applied. Everything below is verified locally only.

Built:

- Service and storage port (`session/service.ts`, `store.ts`, `memory-store.ts`, `supabase-store.ts`): start (idempotent, race-safe, refuses while a daily ticket is open), sequential stages, browser events limited to `brief_viewed`, `data_inspected`, `plan_note`, student-scoped reads, report built once from server-graded stage results.
- Stage attempts (`session/stage-attempt.ts`): a stage is an ordinary workstation attempt on the student's own BrightCart warehouse, so the existing tools and graders serve it. Double-activation is stopped by the `one_active_stage` index.
- Changes to existing code (`attempts.ts`): daily state ignores session stages and reports `in_session`; the daily start refuses during a session; a stage pass parks the attempt in `explaining` (no rating, no cooldown); `finishVerified` and `closeWithoutRating` take an optional cooldown (default unchanged). Before the migration is applied the daily flow falls back to the old query, so deploying the code first does not break daily tickets (by reading; not tested).
- Interview (`session/finish.ts`, `explain-attempts.ts`): one interview for the whole session, only after every stage is passed and only from the last stage; a pass rates every stage with no daily cooldown, a miss or skip closes them unrated.
- Routes: `/api/arena/sessions` (+ `/stage`, `/events`, `/report`); the SQL run route records a trusted `query_run` for session stages.
- UI: `SessionWorkspace`, `ReportView`, wired into the Domain page for roles with a workstation; `WorkstationShell` shows "Stage passed / Continue the session".
- Migration 120 extended and tested on PGlite (11 tests): `proof_session_id` on assignments, the daily one-open index rebuilt to ignore session rows, one in-progress stage per session, service_role explicitly revoked on the log and reports.

Verified locally: `tsc` 0 source errors, eslint clean, 298 tests pass in the affected areas (service 24, explain flow incl. session 13, migration 11).

NOT verified: anything against the live database (stage creation insert, the explain-to-finish chain, `complete_workstation_attempt` with a 0-hour cooldown), any browser run of the UI, AI-generated stage tickets, the full suite after these changes.

Known gaps: the AI helper is not offered in sessions yet (the AI dimension reads "not assessed"); `data_inspected` events are not sent by the SQL tool yet; stages are not linked by data (stated in the report); a session cannot be abandoned from the UI.

### IT-01 third pass (2026-10-24): migrations applied, verified live

Production state, checked by query: migration 120 is applied (4 tables, RLS on, `proof_session_id` column, `one_open` index rebuilt, `one_active_stage` added, `service_role` limited to select+insert on the log and reports). Migration 113 is also applied: `backend-developer` exists with 5 enabled areas. The 2 existing assignments were untouched.

Verified live against the real database with throwaway users (all deleted afterwards; 0 test users, sessions or events left):

- `session.live.test.ts`: 12 tests, passed in 3 consecutive runs after the fixes below. Covers: one session however many starts (concurrent), daily ticket held back during a session, a stage served once under a race, a wrong answer leaving the stage open, interview refused from a middle stage, five stages passed with no rating, no cooldown and no closed ticket, server vs browser events, interview built on the whole session, every stage rated once with a zero-hour cooldown and a report written, daily ticket available afterwards, another student's session unreadable and untouchable, browser clients unable to read or write the four tables, the log append-only even for the server key, no duplicate event numbers under 8 concurrent writers.
- The three existing live suites (daily e2e, security, higher-studies switch): 10 tests pass.

Defects the live run found and fixed:

1. Concurrent event writes could fail to get a sequence number (6 immediate retries). Now up to 25 tries with a random wait.
2. The test helper did not know SQL "script" tickets (UPDATE, ALTER), so intermittently a random student's reference answer was rejected. Fixed, and `reference.test.ts` now proves every stage is solvable for 25 different students at two levels, with no database.
3. Design fix: the "business question" stage could be served a script task. It now serves only retrieval and analytics tasks (`onlyTaskKinds`), asserted for 25 students.
4. Two existing live tests were already failing on a clean `main` (checked in a separate worktree) because they predate the interview step and the 400 rating baseline, and the e2e test did not know the role now has six fresher areas. Updated; they pass.

Also: an error boundary keeps a failure in the session panel from breaking the Domain page; the full unit suite had a repo guard (every `.limit(1)` ordered) that my code broke, now fixed.

Checks: `tsc` 0 source errors, eslint 0 errors (8 older warnings in untouched files), `next build` compiles and the four session routes are in it. The build's type check failed locally only because of stray Finder duplicates (`routes.d 2.ts` etc.) in the generated `.next/dev/types`; I removed those untracked, git-ignored files only.

NOT verified: the screens in a browser (a login is required and test credentials cannot be entered into an app whose sign-in goes to the production auth host), the real AI interview scoring end to end (questions were generated live; the pass path was driven through the session finish directly), and the AI-written stage tickets (the Data Analyst stages use the template engine).

### IT-01 fourth pass (2026-10-24): tested through the running app over HTTP

PR #12 is open and NOT merged (CI `verify` green; the Vercel preview fails on a missing `NEXT_PUBLIC_SUPABASE_URL`, as it did on PRs #9-#11). Production still runs the previous release, so this pass tested the built branch locally (`next start`) against the production database.

`session.http.live.test.ts`, 12 tests, passed 4 times in a row against the real built app: sign-in cookies in the real format, the proxy, rate limits, every route handler and the database. Covers: visitors refused; a student with no workstation told so and never given a Data Analyst ticket (session start and daily start); start is idempotent; the daily ticket is held back (`in_session`, 409 `session_open`); browsers can only report `brief_viewed`, `plan_note`, `data_inspected` (forged `submitted`, `check_run`, `query_run` get 400); five stages each with a genuine miss then a pass, a repeat request returning the same stage, no answer key in any response, no rating or cooldown; interview refused from a middle stage (409 `not_anchor`); a real AI interview on the whole session (questions generated, AI-written answers scored: award at 55, 62, 55; pass mark is 50) rating all five stages; five completions, five evidence rows each carrying the interview score, no cooldown; the report; another student getting 404 on every session and attempt route; the Domain page returning 200.

What the run exposed in my own report logic, now fixed and covered by unit tests:

1. Discovery and Analysis were judged on every stage although only the SQL stage reports exploration, so every student scored 0. Discovery is now assessed only on stages whose tool reports exploration (`explorable`); "not assessed" otherwise.
2. A student who failed a stage, corrected it and passed was told they "did not change their work", because the tools do not report edits. A later resubmission now counts as revising.
3. Planning was marked trusted although the plan length comes from the browser; now lower-confidence.
4. The same explanation was repeated once per stage; now said once.

With a plan before each stage, the brief shown, one query run, and a miss then a fix on every stage, the report reads: planning 3, analysis 1, discovery 1, judgement 3, execution 3, AI not assessed.

Honest limits seen: the interview scores are close to the pass mark (55-62) with answers written by an AI from the submission summary, so a real student's result is unknown; Analysis tops out at 1 until the tools report which data a student inspected; the screens have still not been exercised in a browser.
