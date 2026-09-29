# Workstation Feature Progress

## Current Phase

All ten checkpoints worked through. Remaining items are the Python blocker and the risks below.

## Completed

1. Audit + architecture — `docs/workstation-audit.md` (a2728bd)
2. Schema/config — migration 025: roles + skill areas as data, rotation state, immutable
   per-candidate instances, attempt state, sub-skill ratings, completion events, two
   service-role-only functions (debae0f)
3. Rotation engine — `lib/arena-workstations/rotation.ts` (pure) + `rotation-store.ts`
   (reserve/commit), unit + live concurrency tests (494785c)
4. Workstation registry — server `lib/arena-workstations/registry.ts`, client
   `components/arena/workstations/registry.tsx`; tools: SQL, Excel/Spreadsheet, BI/Dashboard,
   Statistics, Data Cleaning (5dd2f66, e4519f1)
5. Live AI generation — per-tool generation contracts with semantic checks inside the zod
   schema (the provider wrapper feeds failures back for self-correction), bounded outer retry,
   no static fallback (5dd2f66)
6. Deterministic grading — pure engines `lib/arena-workstations/engines/*` (03d6b16)
7. Sub-skill ELO + evidence — `complete_workstation_attempt` (one transaction, exactly once)
8. Portfolio — rebuilt `app/(app)/dashboard/portfolio/page.tsx` + `lib/portfolio/view.ts`,
   evidence detail page `/arena/attempts/[attemptId]` (93d8151)
9. Security — column grants, owner-only RLS on instances, service-only functions, live
   authorization tests
10. Verification — see below

## In Progress

—

## Remaining

- Python workstation: blocked (see Blockers).
- Visual QA of the five workstations in a browser (the browser automation extension was not
  connected in this session; the UI compiles, lints and builds but was not clicked through).

## Architecture Decisions

- One registry (none existed before). Server side maps tool type → generation contract,
  semantic validator, answer-key builder, grader, versions; client side maps tool type →
  renderer. Routes are thin (`app/api/arena/domain/**`).
- Taxonomy is data (`arena_domain_roles`, `arena_skill_areas`). Code refuses to generate if a
  skill area's configured generation/grading version differs from the registered tool's.
- Instances reuse `arena_challenges` (`user_id`, `content`, `answer_key`, provider/model/
  versions); attempts reuse `arena_domain_assignments` (status, submission, grade, cycle).
- The server computes answer keys wherever the task is a closed parameter set (statistics,
  cleaning, BI, spreadsheet); instructions are rendered from the same parameters. SQL uses an
  AI reference query that must agree with an independently generated query on the same data.
- Daily cadence kept from the user's earlier requirement: one open attempt, open until
  verified; next unlocks 24h after verification. Rotation picks the skill area.

## Rotation Decision

Crypto-random Fisher–Yates bag per cycle; no immediate cross-cycle repeat (swap); disabled
areas leave the bag, newly enabled areas join the current cycle unless already served, an
emptied bag starts a new cycle. Two phases: reserve (version-checked update persists only new
bags; the head is not consumed) → generate/validate outside any transaction → commit
(`commit_rotation_attempt`: row lock, version + head check, insert instance + attempt, pop head).
A losing concurrent request creates nothing; the one-open-attempt partial unique index is a
second guard. Failed generation never touches rotation.

Edge cases: first attempt (state row seeded, bag created); cycle boundary (new bag); disabled
area (dropped); new area (joins current cycle); removed area (dropped); one-skill role (same
area each cycle — repeat rule needs >1 area); two-skill role (alternates); role change (state is
per role); long inactivity (state persists; open attempt stays open); generation failure
(recoverable 503, rotation unchanged); attempt-creation failure (transaction rolls back);
abandoned attempt (stays open until verified — product rule); retry after wrong answer (same
attempt); concurrent tabs (one attempt).

## Generation Decision

Groq via existing `completeJson` (4 corrective attempts inside, 429 backoff), wrapped in 3
outer attempts with backoff; failure → "Nothing was used up — try again". The 12 hand-authored
tickets (migration 024) are deactivated; no stored task is ever served for a new attempt.
Generated datasets are validated (identifier regex, types, row/column/size limits); SQL seeds
are built by the server from the structured data. Difficulty comes from the candidate's
sub-skill rating (<1250 beginner, <1400 intermediate, else advanced) and is enforced in the
contracts (e.g. allowed statistics per level).

## SQL Sandbox Decision

Wandbox + stdlib `sqlite3` harness: data via stdin JSON, fresh in-memory DB per query, 3 s
progress-handler timeout, 500-row cap, candidate SQL cannot reach network/files from SQLite.
The candidate only ever queries their own instance (ownership checked).

## Python Sandbox Decision

Blocked — see Blockers. Skill area present with `enabled = false`; rotation never serves it
and the Domain tab shows it as "coming soon" with the reason.

## Spreadsheet Decision

In-house restricted formula engine (no eval), shared by the grid and the grader. Locked data
cells always come from the instance; target cells must be formulas that reference cells;
expected values are computed from the data independently of the engine. Helper cells allowed.

## Dashboard Decision

Structured spec; expected and candidate specs are both evaluated on the dataset and the series
compared (equivalent specs pass); chart type must suit the data by a server rule (time →
line/bar; ≤6 categories → bar/pie; otherwise bar/table).

## Grading Decision

Pure graders, server-side, on the persisted instance; per-check pass/fail returned, never
expected values. A grading lock (`status presented → grading`) prevents concurrent grading.

## ELO Decision

Same formula and constants as `finish_arena_challenge` (K=32, baseline 1200), actual = 1 for a
verified pass, applied to `arena_skill_ratings (user, role, area)`. The global quiz rating is
untouched. The Portfolio never shows a rating number (capabilio-web rule).

## Evidence Decision

Written inside `complete_workstation_attempt` with the completion event and rating update.
`source_identifier = arena-attempt:<id>`, metadata carries parent skill, skill area/node,
tool, attempt, challenge, company, cycle, generation + grading versions; `source_url` points to
the owner-only evidence page.

## Portfolio Decision

Order follows capabilio-web: hero → recruiter snapshot → demonstrated capabilities (grouped by
parent, e.g. Data Analysis → SQL) → Arena verified work → GitHub evidence → projects &
certificates → assessment-only skills. Sections render only with real rows. "Arena rating: N"
removed.

## Verification

- Unit: 231 tests (engines, rotation, portfolio view, existing suites) — `npm test`.
- Live (`npm run test:live`, real DB + Groq + Wandbox, throwaway users, cleaned up):
  - rotation: concurrent commits → exactly one attempt; unconsumed reservation; full cycle +
    no cross-cycle repeat; no commit while open; immutable instances.
  - tools: each of 5 tools generates a valid instance, the server's own answer passes, a wrong
    answer fails, content never contains the key.
  - e2e (§62): 5 attempts, one per area, each wrong→fail, right→pass, sub-skill rating +1
    verification exactly once (RPC replay is a no-op, resubmission refused), one evidence row
    with the right parent/area, cooldown, cycle 2 starts on a different area.
  - security: cross-candidate service access 404; RLS hides other candidates' instances,
    attempts, rotation; answer keys/expected outputs unreadable even by the owner; completion
    and rotation functions not callable from a session; rating/evidence/self-verify writes
    rejected; malformed submission rejected without consuming the attempt.
- `tsc --noEmit` clean · ESLint clean (2 pre-existing `<img>` warnings suppressed per repo
  convention) · `next build` passes.

## Known Risks

- Wandbox is a free public service with no SLA; SQL grading and Stream code depend on it.
- Generation runs in the request (10–30 s typical); a queue/background job would be better at
  scale.
- Stream challenges still use a shared pool with a stored fallback (earlier explicit user
  requirement; conflicts with the brief's §67) — user decision.
- `/arena/projects` and `/arena/competitions` still render mock data (pre-existing).
- Recruiter-facing public Portfolio doesn't exist yet (no recruiter auth flow); evidence pages
  are owner-only.

## Blockers

- **Python workstation.** The only execution environment (Wandbox) has open outbound network
  (verified live), no pandas/numpy, and no configurable CPU/memory/process limits. Required:
  an isolated executor with network egress denied, pandas/numpy preinstalled, CPU/memory/time/
  process limits, no credentials inside, per-run ephemeral filesystem — e.g. Vercel Sandbox
  (Firecracker microVM) or an equivalent gVisor/Firecracker service. Needs provisioning and
  credentials from the project owner; then add a `python_workspace` tool (grading = run the
  candidate's function on hidden inputs in the sandbox, compare structured output) and set
  `arena_skill_areas.enabled = true` for `python`.
