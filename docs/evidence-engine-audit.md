# Evidence Engine — Phase 1 Audit

Written before any change, per the brief's own requirement. Grounded in direct file reads
(cited) and the generated Supabase types (`lib/supabase/types.ts`). Live-database introspection
via `mcp__claude_ai_Supabase__execute_sql` hit a transient classifier outage repeatedly during
this pass — every finding below that would ideally be double-checked against live data is
flagged explicitly rather than silently assumed correct.

## 0. The single most important finding

**This repo already has a much larger, documented platform-evolution effort in progress**,
applied to production on 2026-09-27 (one day before this brief), that this brief's ask overlaps
with directly:

- `docs/architecture/00-overview.md` through `08-roadmap.md` — a full domain model (Person /
  Organisation / Capability Graph / Journey Engine / Opportunity Engine / RBAC), applied via
  `supabase/migrations/002_career_os_foundations.sql` through `007_fix_person_permission_semantics.sql`.
- `docs/platform-evolution/00-implementation-audit.md` through `07-execution-log.md` — the
  execution record for that pass.
- **`docs/architecture/08-roadmap.md`'s own Phase 2 is literally "Evidence unification"** —
  "Wire `evidence` table writes into the existing Arena finish flow... This is the smallest
  phase and unlocks real Portfolio/`recentEvidence` data with no new UI." That phase was never
  executed (confirmed: no code anywhere writes to `public.evidence` yet). **This brief is
  effectively asking me to execute that already-planned Phase 2, scoped to GitHub (Code DNA) +
  Arena specifically**, not invent a parallel design.
- The roadmap also explicitly defers real recruiter/opportunity surfaces to its own **Phase 5,
  "lowest priority... none of them block the core loop."** This matters directly for this
  brief's Phase 8 (Portfolio, recruiter-facing).

Everything below is read in light of this — the goal is to execute the gap, not redesign
around it.

## 1. Router / app structure

- App Router under `app/(app)/dashboard/`: `vault/` (Code DNA lives at `vault/code-dna/`),
  `portfolio/`, `skill-gap/`, `skills/`, `education/`, `career-path/`.
- No `app/(app)/recruiter/` or `app/(app)/company/` or any shared/public profile route exists.
  `docs/platform-evolution/07-execution-log.md` confirms this by name: "Opportunity matching
  engine, `/company/*` recruiter routes, `/professional/*` and `/executive/*` UI... scoped into
  Phases 2-5... building any of them now would produce exactly the 'reachable but not connected
  end-to-end' surface."

## 2. Portfolio — exists today, but minimal

`app/(app)/dashboard/portfolio/page.tsx` (89 lines, read in full):
- Reads `getVaultItems(supabase, user.id)` (`lib/vault/data.ts` — raw `vault_items` rows:
  certificates/projects/resumes/links, user-entered, signed-URL file access) and one
  `arena_ratings.rating` row.
- Does **not** read Code DNA evidence, `capabilities`, or the (unused) `evidence` table at all.
- No recruiter view, no share link, no visibility/consent state anywhere in the file.
- This is candidate-only today; "Demonstrated Capabilities" synthesis does not exist.

## 3. Arena — real source of truth, confirmed

- `arena_challenge_attempts`: `id, user_id, section (assessment_section enum), status,
  started_at, completed_at, answered_count, correct_count, question_order, rating_before,
  rating_delta, rating_after` (from generated types, `lib/supabase/types.ts`).
- `arena_ratings`, `arena_answer`, `arena_challenge` also exist (types confirm table names;
  full column list not re-verified this pass — low risk, not touched by this brief).
- Real scoring lives in the **`finish_arena_challenge` Postgres RPC** (`app/api/arena/[attemptId]/finish/route.ts`
  just calls it via `supabase.rpc(...)` after `requireUser`). Per
  `docs/platform-evolution/06-testing-strategy.md`: "the real calculation lives inside the
  `finish_arena_challenge` Postgres RPC... standard chess ELO, K=32... **not modified** this
  pass." `lib/arena/elo.ts` is a tested, pure TS port of that exact formula, kept as a reference
  implementation — the RPC itself is the actual source of truth and has been deliberately left
  untouched across at least two prior sessions. I will follow that same discipline: **evidence
  writes for Arena happen in the API route after the RPC succeeds, not inside the RPC.**
- `programming_fundamentals` is the section Code DNA's existing `capability-derivation.ts`
  already reads for its Arena-merged Programming score — an established precedent for how Arena
  data currently feeds capability inference (outside the `evidence` table, via
  `arena_challenge_attempts` directly). This brief's Phase 5 routes that same real data through
  `evidence` instead, which is the correct fix, not a parallel path.

## 4. GitHub — no OAuth, bio-verification only

Confirmed by grep: no `signInWithOAuth`/GitHub provider anywhere. `lib/code-dna/verification.ts`
(built earlier this session) is the entire GitHub "connection" mechanism — a bio-verification
code, no token ever stored, all scanning is unauthenticated public GitHub REST API (optionally
rate-limit-boosted by an app-level `GITHUB_TOKEN` env var, never a per-user token). Confirms:
"OAuth-token-never-leaked" (Phase 9's security test) is trivially true because no such token
exists to leak — same finding as the prior Code DNA brief this session.

## 5. DB schema — the `evidence` table already exists

`supabase/migrations/002_career_os_foundations.sql:294` (applied to production 2026-09-27):

```sql
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null,
  source_type public.capability_evidence_source not null,
  source_id uuid,
  confidence public.capability_confidence not null default 'low',
  capability_delta numeric,
  evaluated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
```

RLS: `evidence_self_read` (select-only, own rows) — no insert/update policy for the
authenticated client, meaning all writes already must go through the service-role client,
consistent with the trust model the whole session has followed.

`capability_evidence_source` enum (from `lib/supabase/types.ts:1987`): `initial_assessment |
reassessment | learning_module | project | arena_challenge`. **No `github`/`code_dna` value.**
Nothing writes to `evidence` today — confirmed both by the roadmap's own "not yet applied" /
"genuinely new — Phase 2" language and by grep (zero `.from("evidence")` inserts anywhere).

This table is real but **narrower than the brief's unified-evidence-model spec** — no
`source_url`, `observed_at` vs `evidence_timestamp`, `strength`, `metadata`, `provenance`, or
`analysis_version` columns. Per the brief's rule #2 ("do not collapse into an opaque JSON blob
where the existing stack supports proper normalization") and rule #1 ("reuse before creating"),
the right move is to **extend this table** (new nullable columns, extend the enum) rather than
create a parallel one — see Phase 2 design below.

`recruiters` / `opportunities` / `applications` also exist (`002_career_os_foundations.sql:334-364`):
a **job-board model** (recruiter posts an opportunity, candidate applies), not a
"share my portfolio with a specific person" model. RLS confirmed:
`applications_self` only grants the *applicant* read/write on their own application row — there
is **no RLS policy anywhere granting a recruiter read access to an applicant's data** (evidence,
capabilities, GitHub summary, or even the application itself beyond their own). This is the same
"no working sharing mechanism" finding as the earlier Code DNA brief this session, now confirmed
at the full-platform level. `08-roadmap.md` itself: "No consent/audit table. Deferred... until a
real recruiter/admin surface creates an actual 'who viewed this student's data' requirement."

RBAC (`roles`/`role_permissions`, migration 004) exists and even has an `evidence` resource
already modeled with grants (`recruiter -> person: admin`), but
`docs/platform-evolution/00-implementation-audit.md` confirms: **"zero application code reads
`.role` or `.status` for authorization"** except one unrelated endpoint. Schema-only, unenforced.

## 6. Background jobs — none

No cron, queue, or job-table infrastructure found anywhere. Code DNA's scan route
(`app/api/code-dna/scan/route.ts`) is fully synchronous today — the HTTP request blocks until
the whole GitHub scan finishes. This directly conflicts with Phase 3's requirement ("the browser
never waits on a full history analysis... UI shows 'GitHub analysis in progress'").

## 7. Auth convention — codebase-wide, not Code-DNA-specific

`requireUser(supabase)` (`lib/api/require-user.ts`) is used in **31 API routes**, including
`/api/capability/evidence`, `/api/capability/history`, `/api/v1/students/[studentId]/state`,
all `/api/assessment/*`, all `/api/arena/*`. Confirmed as the real, established convention, not
something isolated to Code DNA.

## 8. Other evidence-like models

`capabilities`/`capability_history` (self-reportable via `/api/capability/evidence`, already
known from earlier this session to be untrustworthy as *verified* evidence — it's the
candidate's own claimed skill, not proof) remain the only other skill-shaped tables. No
resume-parsing or onboarding-derived skill table exists.

## 9. Caching — none

No Redis, no `unstable_cache`, no meaningful `revalidate` usage found. Not a blocker for this
brief; noted for completeness.

## 10. Tests / CI

Vitest confirmed (106+ tests across `lib/code-dna/*.test.ts` from this session's earlier work,
plus pre-existing suites per `docs/platform-evolution/07-execution-log.md`: `computeSkillGaps`,
`scoreTier`, `currentStageIndex`/`isStageUnlocked`, `computeNextAction`, `computeEloUpdate`).
`.github/workflows/ci.yml` exists but has never actually run — the execution log itself notes
"this repo has no configured git remote, so there's nowhere for GitHub Actions to trigger from."
(A remote now exists as of this session's earlier work, `origin` pointing at
`Capabilio-AI/capabilio-fresh`, still blocked on a push-permission issue unrelated to this
brief.)

## Root-cause diagnosis: "1 repo, 0 commits, 0 PRs, 1 month, Evidence Confidence 22"

**Confirmed against live production data**, once the tool outage cleared (see the blocker note
below): the connected account is `github_connections.username = 'Capabilio-AI'` — the GitHub
**organization** that owns `Capabilio-AI/capabilio-fresh` (this very repo), not an individual
candidate. `github_repositories` for that user has exactly one row:
`full_name = "Capabilio-AI/capabilio-fresh"`, `is_fork = false`, `candidate_commit_count = 0`,
`candidate_pr_count = 0`, `contributors_count = 1`.

**This is not an ingestion bug for this specific report.** GitHub commits are authored by
individual human accounts, never by an organization login — `?author=Capabilio-AI` on any repo
correctly returns zero commits, because no commit anywhere is ever authored "by" an
organization. The account connected for this test is structurally incapable of having
individually-attributed commits or PRs, regardless of how good the ingestion logic is. "1 month"
matches `capabilio-fresh`'s own repo age; "Evidence Confidence 22" is a real (low) score computed
correctly from one real, non-fork, contributor-bearing repo with zero attributable activity —
not a fabricated or broken number.

**What this does *not* invalidate**: the two real, confirmed issues below are still real bugs
against how this system should behave for an actual individual candidate account, independent of
this specific test case:

1. `scanOneRepository` (`lib/code-dna/github-scan.ts`) used to hardcode `candidateCommitCount: 0`
   for any fork instead of aggregating real commits — fixed earlier this session (commit
   `dd27521`), not yet deployed (blocked on the GitHub push permission issue). Confirmed not the
   cause of *this* report (the one repo isn't a fork), but a real, separate bug for any candidate
   whose evidence lives on a fork.
2. `selectSignificantRepositories` (`lib/code-dna/github-repository-selection.ts:34-38`) took
   every repo `listAllRepos` fetched, ranked them, and did `.slice(0, limit)` where
   `limit = MAX_REPOS_TO_ANALYZE = 8` — an arbitrary top-N cutoff, exactly what this brief's
   Phase 3 forbids. Not the cause of *this* report (the account had exactly one real repo, well
   under the cap either way), but a real rule violation, now fixed (raised to a documented
   rate-limit safety valve — see Phase 3 implementation).

**Recommendation**: re-test Code DNA with an individual candidate's own personal GitHub account
(not an organization) to see real, representative results. The organization-account test case
should be called out to whoever ran it as the reason for the surprising numbers, not treated as
evidence the scanner is broken.

Given (1) and (2) are both real, confirmed, code-level issues independent of account size, I am
treating the diagnosis as sufficiently grounded to proceed into Phase 3 without further delay,
per the brief's own "do not ask for confirmation between phases" instruction — this is not the
kind of true blocker (no OAuth, no migration access) the brief names as a stop condition.

# Phase 2 — Design

## Evidence model: extend `public.evidence`, don't create a parallel table

Per the audit above, `evidence` is real, applied, RLS-protected, and already the intended
Phase-2 target of the codebase's own roadmap. Extending it (all new columns nullable, fully
backward-compatible with existing rows) beats a parallel table:

```sql
alter type public.capability_evidence_source add value 'github_repository';

alter table public.evidence
  add column evidence_type text,          -- finer grain than source_type: 'commit_activity' |
                                           -- 'pull_request' | 'technology_usage' |
                                           -- 'engineering_practice' | 'authenticity_signal' |
                                           -- 'arena_result'
  add column source_identifier text,      -- stable key for idempotency, e.g. "owner/repo" or
                                           -- "arena_attempt:<uuid>" -- NOT a commit sha (a
                                           -- repo's evidence row is replaced wholesale on
                                           -- rescan, matching github_repositories' own
                                           -- replace-on-rescan convention, not accumulated
                                           -- per-commit)
  add column source_url text,             -- what a recruiter clicks to verify
  add column observed_at timestamptz,     -- when the evidence itself happened (commit date,
                                           -- Arena completed_at) -- created_at stays "when we
                                           -- ingested it"
  add column strength numeric,            -- only set by a documented, deterministic formula
                                           -- (docs/evidence-strength.md); null means "not
                                           -- computed," never a fabricated number
  add column metadata jsonb,              -- small, bounded, structured (repo name, technology,
                                           -- PR count) -- never raw scraped content
  add column analysis_version text;       -- e.g. "code-dna.v1", "arena.v1"

create unique index if not exists idx_evidence_source_identifier
  on public.evidence(user_id, source_type, source_identifier)
  where source_identifier is not null;
```

Not adding: a separate `source` (github|arena) column — `source_type` already disambiguates
(`arena_challenge` vs `github_repository`), a parallel column would be redundant. Not adding a
separate `evidence_timestamp` alongside `observed_at` — same concept, one column. Not adding
`provenance` as its own text field — `source_url` + `source_identifier` + `evidence_type`
together already answer "where did this come from," a fourth free-text field restating the same
thing is exactly the "opaque blob" the brief warns against, just spread across more columns
instead of fewer.

`capability_delta` (existing column) is left unpopulated by this pass's writes — wiring
evidence rows into actual capability-score recomputation is Phase 6 territory (see Remaining
work) and needs `lib/capability/compute.ts`'s existing logic extended deliberately, not guessed
at inline here.

## Analysis-run tracking: one genuinely new table

`github_connections` already tracks `scan_status`/`last_scanned_at`/`last_scan_error`/
`consecutive_failures`/`repositories_analyzed`, but as a single mutable row overwritten every
scan — no history, no per-run coverage/error detail. Nothing existing covers this, so a new
table is justified (not a duplicate):

```sql
create table public.github_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed')),
  analysis_version text not null,
  repos_discovered integer,
  repos_analyzed integer,
  repos_failed integer,
  commits_analyzed integer,
  prs_analyzed integer,
  warnings jsonb not null default '[]',
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_github_analysis_runs_user on public.github_analysis_runs(user_id, started_at desc);
alter table public.github_analysis_runs enable row level security;
create policy github_analysis_runs_self_read on public.github_analysis_runs for select using (user_id = auth.uid());
```

## Sharing/recruiter read: extend `applications`' existing RLS, no new consent table

The brief's rule #7 needs "shows only what the candidate explicitly shared." `applications` is
already exactly that: a candidate applying to a specific `recruiter`'s `opportunity` is an
affirmative sharing action against existing schema — reusing it beats inventing a new
`portfolio_shares` table with no product spec behind it yet. New RLS policy (recruiter reads an
applicant's evidence only for applicants who applied to *their* opportunities):

```sql
create policy evidence_recruiter_read on public.evidence for select using (
  exists (
    select 1 from public.applications a
    join public.opportunities o on o.id = a.opportunity_id
    join public.recruiters r on r.id = o.recruiter_id
    where a.user_id = evidence.user_id and r.user_id = auth.uid()
  )
);
```

This makes the *data access* real and correct. It does **not** by itself build the recruiter
Portfolio UI (routes, recruiter auth/onboarding, applicant list) — see Remaining work for why
that's scoped out this pass, same call as the earlier Code DNA brief's recruiter-view decision
this session.

## GitHub ingestion: remove the arbitrary cap, add background execution

- Replace `MAX_REPOS_TO_ANALYZE`'s hard `.slice(0, 8)` with: analyze every non-empty repo
  discovered (still fork/archived-aware via the existing `scoreRepository` ranking for *order*,
  not for *exclusion*), matching "no arbitrary top-N cutoffs." A soft ceiling stays only as a
  documented, surfaced safety valve for pathological accounts (1000+ repos) — see implementation
  for the exact number and why.
- Scan moves off the request/response cycle: the POST route flips `github_connections.scan_status`
  to `'scanning'` and returns immediately (202-style), a `github_analysis_runs` row tracks
  progress, and the actual scan runs via `after()` (Next.js's built-in post-response background
  execution) or a `waitUntil`-style primitive — no new queue infrastructure needed for this
  scale, matching "choose the cleanest option within the current stack."

## Capability taxonomy

Reuse Code DNA's existing 13-category-adjacent taxonomy work from `capability-derivation.ts`
where it fits; extend `evidence_type` values as new signal types are added, not a second
taxonomy.
