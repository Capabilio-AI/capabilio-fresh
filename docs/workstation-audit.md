# Workstation Audit — capabilio-fresh (2026-09-29)

Findings from reading the code and querying the live Supabase project
(`gudsoflidkkmtnxvzicw`). Nothing below is hypothetical; where the brief
assumed something exists and it does not, that is stated.

## Existing Arena Architecture

- **Panel registry / `workstation_layout` / domain-role config: none exist.** `grep` for
  `workstation_layout`, `panel_type`, `panelType`, `PANEL_REGISTRY` across `app/`,
  `components/`, `lib/`, `supabase/` returns nothing. There is no JSONB layout column and no
  per-domain-role configuration table. The brief's "extend the existing registry" cannot apply;
  a registry is created once (`lib/arena-workstations/`) and becomes the single one.
- Arena pages: `app/(app)/arena/page.tsx` (overview), `/arena/challenges`
  (`ArenaChallengesBoard`: Stream + Domain tracks, Leaderboard, History), `/arena/projects` and
  `/arena/competitions` (both render `lib/mock/arena.ts` mock data — pre-existing, out of scope,
  flagged as a known risk).
- Domain track (commit 33c6a6d): `components/arena/domain/*` — one Data Analyst SQL workstation
  (`DataAnalystWorkstation.tsx`), `DomainWorkspace.tsx` (Today's Mission card), APIs
  `/api/arena/domain` (GET/POST), `/run`, `/submit`.

## Existing Challenge Generation

- AI provider: Groq via `lib/ai/groq.ts` — single client, `completeJson(prompt, system, zodSchema)`
  with up to 4 attempts, validation-error feedback, 15s backoff on 429. Model
  `openai/gpt-oss-120b`. This is the provider abstraction; it is reused.
- Stream: `lib/arena-challenges/generate.ts` — generates into a shared per-branch pool in
  `arena_challenges` (code or numeric), verified by execution (starter-code leak check; numeric
  answers from an executed hidden reference solution + an independent second solution). The pool
  is **reused across students and the GET falls back to the stored pool when generation fails**
  — a stored catalog read on the new-attempt path. This was an explicit earlier user
  requirement ("when AI fails then user will get these challenges from database") and the Stream
  track is a different feature from domain-role workstations, so it is left unchanged and
  recorded here as a conflict with rule §67 for the user to decide.
- **Domain: static catalog on the new-attempt path — yes.** `lib/domain-workstations/state.ts`
  `loadDomainState()` → `pickNextTicket()` selects from 12 hand-authored tickets inserted by
  migration 024 (`track='domain'`, `scope_key='data-analyst'`). This is the path the new
  implementation replaces. Live DB: 0 domain assignments exist, so no history is affected.
- Legacy MCQ quiz: `/api/arena/start|[attemptId]/answer|[attemptId]/finish` call RPCs
  `start_arena_challenge` / `record_arena_answer` / `finish_arena_challenge` over `question_bank`
  (static). No UI links to these routes any more (grep). Left untouched (historical data: 1
  attempt row).

## Existing Grading

- Stream code: exact stdout match via `runCode()` (Wandbox). Stream numeric: within 1%
  (`lib/arena-challenges/numeric-answer.ts`). Resubmission guarded by
  `arena_challenge_completions` unique `(user_id, challenge_id)`; points only on first correct.
- Domain SQL: `lib/domain-workstations/grade.ts` — hidden ground-truth query and the student's
  query run on the same data; pass = same row count + every expected value present (tolerant
  numbers, case/space-insensitive text). Deterministic, unit-tested.
- Idempotency: Domain submit closes the assignment with a conditional update
  (`completed_at is null`) before awarding — application-level, not a DB-level completion event,
  and points/evidence writes are separate non-transactional calls (partial-failure risk).

## Existing Skill Graph

- `capabilities (user_id, skill, domain, capability_score 0–100, confidence, data_points)` —
  flat, one row per (user, skill), computed from the onboarding assessment
  (`lib/capability/compute.ts`), history in `capability_history`. `domain` is a label, not a
  parent node. 189 rows live.
- **Role → sub-skill hierarchy: not supported.** Minimal extension needed: a per-(user, role,
  skill area) node table carrying the Arena rating.

## Existing ELO

- One global rating per user: `arena_ratings (user_id, rating)`, updated only by the
  `finish_arena_challenge` RPC (SECURITY DEFINER). Formula (verified via `pg_get_functiondef`):
  `expected = 1 / (1 + 10^((1200 − r)/400))`, `delta = round(32 × (actual − expected))`,
  `actual = correct/total`. TS reference port: `lib/arena/elo.ts` `computeEloUpdate()`.
- Transaction boundary: the RPC body (single transaction). Retry: guarded by
  `status <> 'in_progress'` → raises. No completion-event table.
- Domain/Stream challenges do not touch ELO today; they award fixed points into
  `arena_challenge_stats` (`lib/arena-challenges/award.ts`).
- Decision: reuse the exact formula (same constants) for sub-skill ratings, applied inside one
  Postgres function so rating, completion event and evidence commit atomically.

## Existing Evidence

- `evidence` table (migration 018): `skill, source_type (enum capability_evidence_source),
  evidence_type, source_identifier, source_url, observed_at, confidence, metadata jsonb,
  analysis_version`, upsert key `(user_id, source_type, source_identifier)`. Writer
  `lib/evidence/record.ts` (service role only; RLS self-read). Arena writer
  `lib/evidence/from-arena-challenges.ts` (one row per skill tag). GitHub writer
  `lib/evidence/from-github.ts`. Live rows: 0.
- Portfolio consumes via `aggregateDemonstratedCapabilities()` (grouped by `skill`, strength
  formula in `docs/evidence-strength.md`).

## Existing Sandbox

Searched for `child_process`, `subprocess`, `exec(`, `eval(`, Docker, WASM, workers: the only
code execution is `lib/code-execution/wandbox.ts` → the public Wandbox API
(`cpython-3.10.15`, `gcc-13.2.0-c`). Live probe of that environment (2026-09-29):

| Property | Result |
|---|---|
| pandas / numpy / scipy | **missing** |
| stdlib `sqlite3`, `statistics`, `csv` | available |
| outbound network | **OPEN** (`urlopen('https://example.com')` succeeded) |
| env vars | `HOME, HOSTNAME, LC_CTYPE, PATH, container` (no Capabilio secrets — runs off our host) |
| filesystem | ephemeral container, only `prog.py` |

- Runs off the Capabilio host, so candidate code cannot reach our secrets, DB or filesystem.
- It does **not** meet the brief's Python requirements: no network isolation, no pandas, no
  configurable CPU/memory/process limits, no SLA (free public service).
- SQL through it is acceptable: candidate SQL executes inside SQLite (no network/extension
  loading from SQL; `enable_load_extension` is off by default), each query on a fresh in-memory
  DB, and the harness receives data only via stdin JSON.

## Portfolio

| capabilio-web (`frontend/src/pages/Portfolio.jsx`, 2942 lines) | capabilio-fresh (`app/(app)/dashboard/portfolio/page.tsx`, 174 lines) |
|---|---|
| Hero: name, role pill, tagline, bio, CTAs, avatar, tier badge (no bare ELO) | Title + one-line intro |
| Stats bar | — |
| **Recruiter Snapshot**: direction · strongest capabilities · key evidence · recent activity · career readiness · verification | — |
| Verified Credibility (professionals) | — |
| **Skills & Capability Evidence**: skill cards with "Evidence: 3 projects · 5 Arena tasks · GitHub activity" | Demonstrated Capabilities (flat, grouped by skill) + Candidate Stated |
| Strengths & Focus Areas | — |
| Projects | Vault items grid |
| Arena Challenges (per-challenge cards, detail modal with scenario/solution/grading) | "Arena rating: N" card — **shows a bare ELO number**, which capabilio-web's product rule forbids |
| Interviews, Education, Certificates, Recommendations | Vault items |
| **GitHub Evidence** | — (evidence rows only) |
| Activity & Development, Recruiter Summary | — |

Typography/cards in web: rounded-24 cards, uppercase pill section titles with a subtitle line,
evidence-first skill cards. Rebuild in fresh's own tokens (`app-*`, `font-lp-*`) with only
sections backed by real data.
