# Workstation Feature Progress

## Current Phase

Checkpoint 2 — schema/configuration.

## Completed

- Checkpoint 1: audit (`docs/workstation-audit.md`), architecture decisions below.

## In Progress

- Checkpoint 2.

## Remaining

3 rotation engine · 4 workstation registry + tools · 5 live generation · 6 grading ·
7 sub-skill ELO + evidence (atomic) · 8 Portfolio · 9 security · 10 tests + verification.

## Architecture Decisions

- **One registry, created once.** No panel registry exists (audit). `lib/arena-workstations/`
  holds the server side (per tool type: generation contract, validator, answer-key builder,
  grader, versions); `components/arena/workstations/` holds the client renderer per tool type.
  Routes stay thin and dispatch through the registry.
- **Taxonomy is data.** `arena_skill_areas` table: role_key, area_key, display_name, tool_type,
  skill node key, enabled, sort_order, versions. Adding an area to an existing tool type is a row
  insert; a new tool type needs a registry entry.
- **Challenge instances reuse `arena_challenges`** (new nullable `user_id`, `skill_area_key`,
  `tool_type`, `content jsonb`, `answer_key jsonb`, provider/model/version columns) and
  **attempts reuse `arena_domain_assignments`** (+ skill area, cycle, status, submission, grade,
  rating fields). Completions/history/leaderboard keep working unchanged.
- **Answer keys are computed by the server, not written by the AI**, wherever the task can be
  expressed in a closed parameter set: statistics (server computes the statistic), data cleaning
  (server applies the step list), BI (server evaluates the spec), spreadsheet (server computes
  target values). Instructions for those tools are rendered from the same parameters, so task
  text and key cannot disagree. SQL needs an AI reference query; it is executed by the server
  and must agree with an independently generated second query.
- **Daily cadence kept** (earlier explicit user requirement): one open attempt per role; it
  stays open until verified; the next attempt unlocks 24h after verification. Rotation decides
  *which* skill area the next attempt uses.

## Rotation Decision

- State table `arena_rotation_state (user_id, role_key, cycle_number, remaining text[],
  served text[], last_served, version)`.
- Pure planner (TS, crypto-random Fisher–Yates) builds a bag of enabled areas; if >1 area, the
  new cycle's first element ≠ previous cycle's last (swap). Disabled areas are dropped from the
  remaining bag; newly enabled areas join the current cycle at a random position unless already
  served this cycle.
- Two phases so a failed generation never consumes a slot: **reserve** (persist a new bag only
  when a cycle starts; head is not consumed) → generate + validate (no transaction held) →
  **commit** (one Postgres function: lock state row `FOR UPDATE`, check version + head, insert
  challenge instance + attempt, pop head, bump version). A concurrent tab that loses the version
  check gets the winner's attempt; the unique partial index still guarantees one open attempt.

## Generation Decision

- Groq via existing `completeJson` (bounded retries + 429 backoff). No static fallback for new
  domain attempts: failure → rotation untouched → recoverable error with retry. The 12 curated
  tickets from migration 024 are deactivated (kept as history).
- Every generated field is validated (zod + size limits + identifier regex + type checks).
  Datasets are persisted as structured JSON; SQL seed scripts are built by the server from that
  structure (AI never supplies DDL).

## SQL Sandbox Decision

Reuse Wandbox + stdlib `sqlite3` harness (data via stdin JSON, fresh in-memory DB per query,
3s progress-handler timeout, 500-row cap). Candidate SQL cannot use the network from SQLite.
Risk: public third-party service without SLA — see Known Risks.

## Python Sandbox Decision

**Blocked.** The only execution environment (Wandbox) has open outbound network and no pandas;
no CPU/memory/process limits are configurable. Per the brief this requirement is not weakened.
The Python skill area exists in the taxonomy with `enabled = false`, so rotation never serves it.
Required deployment: an isolated executor such as Vercel Sandbox (Firecracker microVM, available
to this Vercel project) or an equivalent gVisor/Firecracker service with network egress denied,
pandas/numpy preinstalled, CPU/memory/time limits, no credentials inside, per-run ephemeral
filesystem. Needs the user to provision credentials/billing.

## Spreadsheet Decision

In-house restricted formula engine (parser + evaluator, no `eval`), shared by the client grid
(live recalculation) and the server grader. Supported: numbers, strings, cell refs, ranges,
`+ - * / ^ &`, comparisons, `SUM AVERAGE MIN MAX COUNT COUNTA COUNTIF SUMIF AVERAGEIF IF ROUND
ABS IFERROR`. Chosen over HyperFormula (GPLv3/commercial licence) and unmaintained parsers.

## Dashboard Decision

Structured spec (chart type, dimension, measure, aggregation, filters, sort, limit). Grading
evaluates both the candidate's and the expected spec on the dataset and compares the aggregated
series (equivalent specs pass) plus the chart type.

## Grading Decision

All graders are pure TS functions with unit tests, run server-side on the persisted instance.
The client never supplies a result.

## ELO Decision

Existing formula (`lib/arena/elo.ts` = `finish_arena_challenge`: K=32, baseline 1200),
actual = 1 for a verified pass, applied to the (user, role, skill area) node only.

## Evidence Decision

Evidence row written in the same database transaction as the completion event and rating
update. Idempotent by `unique(attempt_id)` on the completion-event table.

## Portfolio Decision

Rebuild in fresh's design system following capabilio-web's order, showing only sections with
real data; replace the bare "Arena rating" number with verified-evidence presentation.

## Verification

—

## Known Risks

- Wandbox is a free public service with no SLA; used for SQL and Stream code.
- Stream track keeps its stored pool + AI-failure fallback (earlier explicit user requirement,
  conflicts with §67 — user decision).
- `/arena/projects` and `/arena/competitions` render mock data (pre-existing).

## Blockers

- Python workstation — isolated executor not available (see Python Sandbox Decision).
