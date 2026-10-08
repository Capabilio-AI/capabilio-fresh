# Arena Challenges (Stream + Domain) — Phase 0 Audit

Inspect-only. No code or schema changed. Facts come from reading the repo and querying the live Supabase
project (`gudsoflidkkmtnxvzicw`, read-only counts) on 2026-10-06. Anything the brief assumes that does not
exist is stated as such.

## 1. Current Challenges implementation

### Routes / UI
- `/arena/challenges` (`app/(app)/arena/challenges/page.tsx`): server page, two `TrackCard`s linking to `/stream` and `/domain`.
  Stream card already reads `resolveStreamScope` (shows "add your branch" copy when missing). Domain card is static copy.
  No personalization line, no change links.
- `/arena/challenges/stream` → `TrackChallengesBoard track="stream"` → `TrackWorkspaceView` (grid of pastel cards) → `ChallengeSolvePanel`.
- `/arena/challenges/domain` → `TrackChallengesBoard track="domain"` → `DomainWorkspace` → `WorkstationShell` (+ `components/arena/workstations/*`).
- Leaderboard / History / Streak components exist per track (`ChallengeLeaderboard`, `DomainLeaderboard`, `ChallengeHistory`, `DomainHistory`, `ChallengeStreak`).

### Stream (what exists)
- Pool: `arena_challenges` rows `track='stream'`, keyed by `scope_key`: `it-cluster` (CSE/IT/AI/DS/CSBS share one pool) or `branch-<slug>` (every other branch).
  Mapping in `lib/arena-challenges/branch-clusters.ts`; branch comes from `institution_memberships.branch` via `getStudentBranchContext`.
- Weekly batch of 8: `lib/arena-challenges/weekly-batch.ts` + `arena_stream_weeks (user_id, week_start Monday, scope_key, challenge_ids[])`.
  Idempotent per user/week (unique + 23505 race handling). Picks pool oldest-first minus ever-solved. **No difficulty balancing, no curriculum awareness, no subject spread.**
- Content is **AI-generated on demand** (`generate.ts`, Groq) and inserted with `active: true` — i.e. **unreviewed AI content is served as official today**. IT cluster = coding (Wandbox-verified), other branches = `numeric` calculation (hidden Python reference run + independent second solve, 1% tolerance).
- Points: fixed by difficulty, `lib/arena-challenges/points.ts` (easy 15 / medium 20 / hard 25; docs say 50/70/100 — **docs are stale**). Stored in `arena_stream_stats` (points, tasks_completed, weekly streak). **Stream has no ELO.** The brief's "balance to Stream ELO" has nothing to read.
- Completions: `arena_challenge_completions` unique `(user_id, challenge_id)`, one correct completion per challenge, ever.
- Leaderboard: `GET /api/arena/challenges/leaderboard` (global / same branch). History: `/api/arena/challenges/history`.

### Domain (what exists) — materially different from the brief
- **Not a list of 8.** Domain is a *rotation + daily cadence*: one open ticket at a time, next unlocks 24h after completion (`daily.ts`, `COOLDOWN_MS`), skill area chosen by a shuffled-bag rotation (`rotation.ts`, `arena_rotation_state`), challenge **generated per student per attempt** by AI (`arena_challenges.user_id` set, immutable instance, `content`/`answer_key` jsonb), graded by deterministic engines.
- Roles are data: `arena_domain_roles` (**1 row: data-analyst**) and `arena_skill_areas` (sql, spreadsheet, dashboard, statistics, data_cleaning enabled; python disabled — "no isolated executor"). Each area → `tool_type` → registered `ToolDefinition` (`lib/arena-workstations/registry.ts`: sql, statistics, cleaning, dashboard, spreadsheet).
- Role selection: `pickActiveRole` — explicit `active_role_key`, else engaged role, else keyword match on **free-text stated career** (`getStatedCareerInterest`), else *first enabled role* (i.e. a non-analyst gets Data Analyst by fallback — "guess" behavior the brief forbids). It does **not** read `student_career_intent` / `careers`.
- Scoring: **per-(role, area) ELO** in `arena_skill_ratings` (baseline 1200, fixed step 8/12/15 by difficulty via RPC `complete_workstation_attempt`), plus `arena_domain_stats` (points/streak) and `arena_attempt_completions`. ELO exists only for Domain.
- Execution/grading: SQL via Python `sqlite3` harness on Wandbox (`engines/sql-runner.ts`, 3s limit, 500-row cap); other tools are pure TS engines (formula, spreadsheet, stats, cleaning, BI). All deterministic.
- 12 hand-authored data-analyst SQL tickets (mig 024) are **deactivated** (`active=false`); live domain content is per-student AI instances.

### Live data snapshot
| Item | Count |
|---|---|
| careers (all active) | 10 |
| active skills | 53 |
| career_skill_requirements | 81 |
| published curriculum_versions / courses / CONFIRMED course↔skill mappings | 1 / 61 / 9 |
| stream pool: it-cluster code (active) | 14 |
| stream pool: mechanical numeric (active) / code (active) | 13 / 28 (code rows for Mech are legacy, flagged active) |
| stream pools for ECE, EEE, Civil | **none** (generated lazily on first request) |
| domain roles with workstations | 1 (Data Analyst) |
| stream completions | 2 |
| `student_career_intent` rows | 1 |
Student memberships: Mech 1, ECE 1, CSE 1, AI/ML 1, no branch 2.

## 2. Profile data available
- Branch: `institution_memberships.branch` (free text, `lib/branch-catalog.ts` has 52 names), `regulation` (mig 054).
- Year: computed `computeCurrentAcademicYear` (start/end year, override) in `lib/career/academic-year.ts`. **Semester granularity was explicitly dropped** ("no semester claim"). The brief's "Year 2 Sem 1" cannot be derived; **year-level only**.
- Career intent: `student_career_intent` (`primary_career_id`, `secondary_career_id` = Plan B, `is_exploring`, `career_goal_text`) → `careers`.
- Skills: canonical `skills` (+`skill_aliases`), `capabilities (user_id, skill TEXT, domain, capability_score 0–100, confidence, data_points)` — **keyed by free-text skill name, not skill_id**; history in `capability_history`.
- Skill gap: `lib/career/skill-gap.ts` (legacy `career_requirements`, free text) and `lib/roadmap-engine/gaps.ts` (canonical `career_skill_requirements` + `roadmap_skill_gaps`).

## 3. Taxonomy / careers (reuse, do not duplicate)
- `skills`, `skill_aliases` (047); `careers`, `career_skill_requirements` (054, target_level, importance); `student_career_intent`.
- Curriculum: `curriculum_versions` → `courses (year, semester, title, kind)` → `course_units`/`unit_topics`; `course_skill_mappings` (status CONFIRMED/SUGGESTED, AI can never be CONFIRMED). Published-curriculum reader: `lib/roadmap/published.ts`.
- `arena_challenge_skills (challenge_id, skill_id, source AREA|TAG)` — challenge→canonical-skill link, auto-derived by DB trigger from `skill_area_key` + exact tag match. `roadmap_arena_challenges` already consumes it; `roadmap-engine/gaps.ts` `recommendArena` already ranks challenges by gap skills.
- Two legacy skill/career vocabularies still coexist (`career_requirements` free text vs canonical `careers`). Domain roles (`arena_domain_roles.match_keywords`) are a **third** mapping and are not linked to `careers`.

## 4. Execution / sandbox infrastructure
- **Only** `lib/code-execution/wandbox.ts`: public third-party service (`wandbox.org`), Python 3.10 + C, 15s timeout, **no files, no packages, no network control by us, no sessions**. Anything we send leaves our infra.
- No docker/VM/container code, no Monaco, xterm, Pyodide, sql.js, DuckDB-WASM, WebContainers in `package.json` (checked). No iframes/preview runtime.
- Workstation "tools" are bespoke React components + TS engines, not a runtime abstraction.
- `docs/workstation-audit.md` already records that Python workspace is disabled for lack of an isolated executor.
- Admin: only curriculum admin (`app/(app)/admin/curriculum`, `lib/roadmap/admin-gate.ts` = org admin via RBAC). **No Capabilio-global admin role, no challenge admin UI, no feature-flag system, no runtime cost tracking.** Rate limiting exists (`lib/rate-limit`).

## 5. Challenge types today
- Stream: `code` (stdin→stdout exact match), `numeric` (answer ± 1%).
- Domain: `sql`, plus `workstation` kind (content/answer_key jsonb) for sql/spreadsheet/statistics/cleaning/dashboard tools.
- No MCQ in Challenges any more (legacy quiz backend still present, unlinked). No ticket/steps/multi-check model, no hints, no reflection, no `evidence_status`.
- Evidence writes: `lib/evidence/from-arena-challenges.ts` (stream; `evidenceType "arena_result"`, confidence `low`, one row per skill_tag text) and domain via `complete_workstation_attempt` RPC (writes `evidence`). There is **no roadmap event bus** — roadmap recomputes on demand; `docs/architecture/05-events.md` is design-only.

## 6. Gap analysis vs the brief
| Brief | Today | Gap |
|---|---|---|
| Stream by branch, 8/Monday | Yes, but pool is per cluster; IT = code, others numeric | Curriculum-aware pick, difficulty/spread, honest short-batch state; ECE/EEE/Civil pools empty |
| Stream from published curriculum | Not used | Needs `courses`/mappings join; only 61 courses & 9 confirmed maps exist |
| Domain = target career (primary / Plan B) | Free-text keyword → 1 role; falls back to first role | Move to `student_career_intent` + `careers`; Plan B switch; "exploring" state |
| Domain 8 items, "Earn ELO" | 1 rotating AI ticket / 24h | New list model; ELO is per (role, area) not per track |
| Pluggable WorkstationRuntime | Hard-coded tool registry (5 data tools) | New abstraction + templates table |
| IDE/notebook/terminal/simulators | None | Entirely new; needs sandbox decision |
| AI_GENERATED → DRAFT → admin review | AI rows go live immediately | Policy change for new content; legacy rows need grandfathering |
| Steps/checks/hints/attempt state machine | Single submit | New tables |
| Admin + validation tool + seed | None | New |
| Feature flags / cost caps | None | New |

## 7. Runtime evaluation (licensing/cost — to be re-verified before adoption)
1. **CODE_EDITOR_PREVIEW**: Monaco (MIT) for editing. For running JS/React: (a) **WebContainers** — commercial license required for production use; runs only in Chromium/Firefox-recent, needs COOP/COEP headers (affects the whole app unless isolated to a sub-path/iframe); (b) **Sandpack** (CodeSandbox, Apache-2.0) — in-browser bundler, React/vanilla, live preview + file tree, no Node server needed, can run tests via its test runner; **recommended for v1**; (c) server sandbox — rejected for v1 (cost, security surface).
   Checks run in-browser against the iframe DOM / test results, then **re-run server-side** is impossible without a runtime ⇒ see risk R1.
2. **NOTEBOOK_PYTHON**: **Pyodide** (MPL-2.0), runs in a Web Worker, numpy/pandas available, datasets mounted from our storage. Fully client-side = zero server cost, but see R1.
3. **SQL_CONSOLE**: **sql.js** (MIT) or **DuckDB-WASM** (MIT). We already grade SQL server-side with `sqlite3` — can keep that for authoritative grading while the console runs sql.js.
4. **TERMINAL_VM**: needs a real server sandbox. Options: Firecracker/gVisor containers on a vendor (e2b, Fly Machines, Modal), or our own — **cost + security-heavy, no existing infra**. In-browser alternatives (v86 / WebVM, ~GPL/Apache mixed, heavy) are possible for toy tasks. Recommend deferring to a later phase behind a flag.
5. **SIMULATOR** (candidates; embedding terms must be confirmed per project before use): CircuitJS1 (falstad, GPL-2.0 — embedding/ redistribution constraints), Ngspice/ngspice-WASM (BSD-3, headless simulation, no UI), Wokwi (commercial, embed terms restrictive), PhET (CC-BY / mixed, many HTML5 sims embeddable with attribution), Three.js/OpenCascade.js (LGPL) for CAD — heavy. **I will not embed anything until its terms are checked.** Default plan: structured **CALCULATION_WORKSHEET** (our own, already conceptually exists as stream `numeric`), plus optional ngspice-WASM-backed graded circuit netlists later.
6. **QUESTION_FLOW**: trivial; build on the same step/check model.

## 8. Recommended plan (needs approval)
- **P1 Data model + abstraction (additive migrations)**: `workstation_templates`, extend `arena_challenges` (ticket_brief, workstation_template_id, branch_ids/career_ids/course_tags/skill links via existing `arena_challenge_skills`, `status`, `source`, `reviewed_*`), new `challenge_steps`, `challenge_checks`, `challenge_attempts`, `challenge_hints`, `runtime_feature_flags`/`runtime_usage`. Reuse `skills`, `careers`, `courses`. Existing rows backfilled `source='AI_GENERATED', status='PUBLISHED'` (grandfathered; no deletion).
- **P2 Selection** (pure, tested): stream (branch + published-curriculum year + difficulty balance + spread + honest short batch) and domain (primary/Plan B career + gap-driven order + "recommended because" text), plus the empty/exploring states on the two cards.
- **P3 Check engine + attempt state machine + scoring + evidence write-through + event** (reuse numeric/sql graders; add check_types).
- **P4 Runtimes in order**: QUESTION_FLOW/CALC_WORKSHEET → SQL_CONSOLE → CODE_EDITOR_PREVIEW (Sandpack) → NOTEBOOK_PYTHON (Pyodide) → TERMINAL_VM (deferred).
- **P5 Admin + validation tool + seed (spec files in repo + script first; UI later)**.
- **P6 UI** polish, flags, cost caps, tests.

## 9. Risks & decisions needed (these affect the data model / security)
- **R1 — Client-side runtimes cannot be trusted for grading.** Sandpack/Pyodide/sql.js run in the student's browser; a student can forge the "checks passed" result. To keep "pass/fail is deterministic and trustworthy" I propose: the client submits the *artifact* (files / notebook outputs / query text), and the **server re-evaluates** where feasible — SQL (server sqlite, exists), numeric/worksheet (pure TS), Python output-checks (re-run in server Pyodide? not safe on Vercel; alternative: submit computed outputs + hidden-check on deterministic metrics, accepting lower assurance). Frontend/DOM tests cannot be server-verified without a headless browser. Proposal: those get `evidence_status = NEEDS_REVIEW`/`UNVERIFIED` (not VERIFIED_AUTOMATED) unless a server-side executor exists. **Question for you: accept that tiering, or fund a server sandbox?**
- **R2 — Wandbox is a public third-party runner**; reference solutions/hidden checks must never be sent to it with student data we care about, and it is not a sandbox we control (egress/quota guarantees are theirs). Not suitable for TERMINAL_VM / notebook.
- **R3 — "Stream ELO" and "Domain 8 items / Earn ELO"** conflict with current models (Stream = points, Domain = ELO per area, one ticket/day). Proposal: keep points for Stream, ELO for Domain, and introduce a per-track list of 8 for Domain *selected from published challenges*; the existing rotation/AI-per-student generator stays as an alternate source until replaced. **Question: should the 24h one-at-a-time cadence be retired for Domain?**
- **R4 — Content is the real bottleneck.** Only Data Analyst has a workstation; ECE/EEE/Civil stream pools are empty; verified seed content for ~5 streams × 2 and 4 roles × 2–3 requires authoring + a verified reference solution each. I will not ship ungradable seeds, so volume will be small.
- **R5 — Curriculum linkage is thin** (1 published curriculum, 9 confirmed mappings, year-level only). The selector will degrade gracefully (adjacent → general fundamentals) and say so.
- **R6 — No global admin role / flags / cost tracking exist.** I need to define "Capabilio admin" (new `platform_admins` table or env allow-list?). **Question.**
- **R7 — Legacy unreviewed AI content is live.** Proposal: grandfather it as `PUBLISHED, source=AI_GENERATED, reviewed_by=NULL` and stop AI top-up writing `PUBLISHED` going forward (new AI output → `DRAFT`). That would make Stream pools stop growing until an admin reviews drafts. **Question: OK to switch AI top-up to DRAFT now, or after the admin tool exists (P5)?**
- **R8 — Capability evidence key is free-text skill name** (`capabilities.skill`), not `skill_id`; write-through will map `skills.id → name`. Existing `arena_result` evidence type vs the brief's `ARENA/VERIFIED` — I'll reuse the existing enum and add `evidence_status` on the attempt rather than a parallel evidence model.
- **R9 — No roadmap event bus.** I'll add a minimal `challenge_events` outbox table (stable interface) rather than invent a bus.
- **R10 — `docs/arena-challenges-redesign.md` is stale** (points values, per-slot descriptions); this audit supersedes it.

## 10. Questions blocking Phase 1
1. Grading trust tiering for client-side runtimes (R1): accept `NEEDS_REVIEW/UNVERIFIED` for non-server-verifiable runtimes, or budget for a server sandbox vendor?
2. Retire Domain's 24h one-ticket cadence in favor of the list of 8 (R3)?
3. Admin identity mechanism (R6).
4. Switch AI top-up to DRAFT immediately (R7)?
5. Confirm Sandpack + Pyodide + sql.js as v1 runtimes and defer TERMINAL_VM + third-party simulators.
