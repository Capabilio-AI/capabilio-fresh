# Code DNA — Discovery & Design

## Phase 1: Discovery

### Code DNA already exists — different architecture than this brief

A Code DNA feature already ships in this repo (`lib/code-dna/*`, `app/api/code-dna/*`,
`components/vault/CodeDnaCard.tsx`, `app/(app)/dashboard/vault/code-dna/page.tsx`,
`github_connections` table). It's a single GitHub-account scanner: connect a username,
verify ownership via a bio code, scan public repos for file-presence tech signals,
testing/CI/docs practice, authorship share, PR counts — then a Groq call writes one
`code_dna_score` (0-100) + `confidence_level` + `recruiter_summary`.

This brief asks for something architecturally different: a **derived projection across
a 13-category capability taxonomy**, sourced from "existing evidence/skill/capability"
data, not a fresh GitHub-only score. Per the brief's own rules (#2 reuse existing
evidence, #6 don't build a second GitHub ingestion system), the right move is
**extend, not replace**: keep the GitHub scan pipeline exactly as-is (it's a real,
already-verified evidence source), and add the capability-taxonomy derivation as a new
layer that consumes it — alongside a second real source found below. No new nav tab,
no new ingestion system.

### Vault structure (must stay intact — rule #1)

- `app/(app)/dashboard/vault/page.tsx` → `<VaultTab />` (client, `components/dashboard/VaultTab.tsx`): renders `<CodeDnaCard />` above the manual vault-items list.
- Detail pattern: a dedicated **route**, not a drawer/modal — `app/(app)/dashboard/vault/code-dna/page.tsx`, a server component reading `github_connections` directly and rendering stacked white bordered cards (`rounded-xl border border-app-border bg-white p-5`), `max-w-3xl` wrapper. This is the pattern every other Vault/dashboard detail page uses (Educational History, Profile, etc.) — reused as-is for the new capability detail page.
- Design tokens: `app-*` (charcoal/orange/blue/success/warning/attention) on detail/dashboard pages, `lp-*` on Vault's own card components. Both already used side by side in the existing Code DNA card+page; kept as-is rather than unifying (out of scope here).

### The critical finding: what evidence is *actually* server-verified today

Traced every write path into `capabilities` / `capability_history`:

- **`lib/capability/compute.ts`** (initial diagnostic assessment) — real: computed server-side from stored `assessment_responses.is_correct` joined to `question_bank`. No client input trusted.
- **`app/api/capability/evidence/route.ts`** — the *only other* writer. Its own code comment: *"This endpoint has no independent way to verify a claimed project or Arena event actually happened... once they do, they should call this server-to-server rather than a student self-reporting their own score here."* A logged-in client can POST `{skill, domain, newScore: 100, source: "arena_challenge"}` directly and it is accepted verbatim into `capabilities`/`capability_history`.
- I checked whether Arena's real completion flow (`finish_arena_challenge` RPC, `record_arena_answer` RPC — both `SECURITY DEFINER`, both compute correctness server-side from `question_bank.correct_option`, never trust client-claimed correctness) calls this evidence endpoint. **It does not.** Arena writes only to `arena_ratings` / `arena_challenge_attempts`. Nothing connects a real, verified Arena result to `capabilities` today.

**Conclusion:** `capabilities`/`capability_history`, as populated today, is **not a trustworthy verified-evidence source** for Code DNA — its `source` column looks like a provenance tag but for anything beyond the initial assessment it is self-reported through an endpoint the client fully controls. Using it here would violate rule #4 (browser must never supply verification status) and rule #7 (self-reported must never raise verified score) by construction. **This table is intentionally excluded from Code DNA's scoring.**

The two evidence sources that *are* genuinely server-verified end-to-end:

1. **`arena_challenge_attempts`** (status='completed') — `correct_count`/`answered_count` computed entirely server-side (traced both RPCs above); `question_order` ties back to `question_bank`; RLS `arena_attempts_select_own` (`auth.uid() = user_id`) already scopes reads to the owner.
2. **`github_connections.analysis`** — the existing Code DNA scan: real GitHub API data, bio-verified ownership, file-presence-only tech detection (never inferred from content/name).

### Evidence → 13-category taxonomy: what's realistically derivable

Arena's `section` enum (`quantitative_aptitude`, `logical_reasoning`, `verbal_communication`,
`programming_fundamentals`, `engineering_mathematics`, `basic_sciences`) is a generic
first-year-engineering foundation, not a capability taxonomy — only `programming_fundamentals`
maps sensibly onto **Programming**. GitHub's existing file-presence signal table
(`TECH_SIGNALS` in `github-scan.ts`: Node/TS/Next/Angular/Python/Go/Rust/Java/Ruby/PHP/
Docker/CI) maps onto **Frontend Engineering**, **Backend Engineering**, **Testing**
(`hasTests`), **DevOps/Infrastructure** (Docker/CI), and general **Programming**.

No real signal exists anywhere in this codebase today for: Debugging, Algorithms (beyond
the weak Arena logical-reasoning link, deliberately not used — too indirect), Database
Engineering, API Design, Security, System Design, Data Analysis, AI/ML. Per the brief's
own rule, these are **omitted / shown as "not enough evidence yet"** rather than invented.
This is expected and correct, not a shortcoming — extending `TECH_SIGNALS` with speculative
new file detectors to force-populate these was considered and rejected as scope creep
against "minimum schema/API changes" and against fabricating a false sense of coverage.

### No blocker. Proceeding to Phase 2/3.

## Phase 2: Design

### Derivation model (`lib/code-dna/capability-derivation.ts`, pure functions)

Per category: `{ category, score: number, confidence: 'low'|'medium'|'high', evidenceCount, lastVerifiedAt, contexts: ('github'|'arena')[] }`. A category is omitted entirely unless `evidenceCount >= 1`.

- **GitHub-sourced categories** (Frontend/Backend/Testing/DevOps, and a Programming contribution): `score = round(reposWithSignal / totalOriginalReposAnalyzed * 100)` — "in X% of your analyzed original repos we observed real evidence of Y." `evidenceCount = reposWithSignal`.
- **Arena-sourced (Programming only)**: `score = round(sum(correct_count) / sum(answered_count) * 100)` across completed `programming_fundamentals` attempts. `evidenceCount = attempt count`.
- **Programming** combines both when present: evidence-count-weighted average, `contexts: ['github','arena']`.
- **Confidence**: reuses the existing thresholds verbatim (`lib/capability/compute.ts`: high ≥5 data points, medium ≥3, else low) — applied to `evidenceCount`. A recency penalty caps confidence at `medium` when `lastVerifiedAt` is >180 days old (last GitHub scan or last Arena attempt in that category) — real, deterministic, documented, not AI-judged.
- Everything is a pure function over already-fetched rows (`GithubScanResult`, an array of `{section, correctCount, answeredCount, completedAt}`). No network call, no AI call, in the derivation itself — reproducible from source evidence by construction.

### Persistence: none added

Both source tables already exist and are small per-user (a handful of repos/attempts). Computing the projection on read is cheap, always fresh, and trivially satisfies "reproducible from source evidence" — there is nothing to invalidate. Rule #2's "smallest derived persistence... if existing structures genuinely cannot serve it" is satisfied by *not* adding a table: existing structures can serve it. This also means recalculation is automatic — there's no cache to hook invalidation into.

### API: extend the existing route, don't fragment

`GET /api/code-dna` already exists, is session-scoped, and already builds a derived
`evidenceProfile` from `github_connections`. It's extended (not replaced) to also fetch
the caller's completed `arena_challenge_attempts` and include `capabilityProfile` in the
response — computed **regardless of GitHub-connection state**, since Arena-only evidence
is still real Code DNA data (the current route short-circuits to `{connected:false}`
before Arena would ever be considered — fixed as part of this change). No new API route.

### Engineering Signature: reuse the existing narrative, don't add a new LLM call

`github_connections.recruiter_summary` is already Groq-written **at scan time**, never
on page load — reusing it as the Engineering Signature narrative satisfies "AI may narrate,
never score" and "never run AI analysis on Vault open" simultaneously, with zero new AI
wiring. No LLM involvement anywhere in scoring/confidence.

### Trajectory: only from real timestamped data

`arena_challenge_attempts.rating_after` + `completed_at` is a real, server-computed
ELO-style history. Trajectory renders only when ≥2 completed attempts exist (a real line);
otherwise the brief's "Building your DNA" empty state with an Enter Arena CTA (`/arena`).
GitHub has no historical snapshots (only the latest scan), so it never drives trajectory.

### Capability detail page: reuse the existing route pattern

New page `app/(app)/dashboard/vault/code-dna/[category]/page.tsx`, server component,
same stacked-card visual pattern as the existing Code DNA detail page. "Why this
capability?" is a deterministic template (e.g. "Observed in 3 of 4 analyzed repositories:
next-app, api-service, cli-tool — verified via GitHub scan on 12 Sep 2026"), never an LLM
sentence about the *number* — only the optional Engineering Signature narrative is
LLM-authored, and it never states a score.

---

# Code DNA v2 — GitHub Recruiter Intelligence: Discovery & Design

## Phase 1: Discovery (corrections against this brief's assumptions)

Re-verified everything against the actual repo rather than the brief's own description of
current state, per standing practice. Two factual corrections:

1. **"Top 1 most-starred repository" is wrong.** `github-scan.ts`'s `MAX_REPOS_TO_ANALYZE = 6`
   — the existing scan already analyzes up to 6 repos, ranked by stars (that ranking-by-
   stars-alone IS a real, valid finding from this brief worth fixing — see Phase 2).
2. **No GitHub OAuth exists.** The existing "connection" is bio-code verification (student
   adds a code to their public bio temporarily; no OAuth token is ever requested, stored,
   or exists per-user) plus an optional server-level `GITHUB_TOKEN` env var only used to
   raise the public API rate limit. This makes rule #7 ("OAuth/GitHub tokens never exposed")
   trivially satisfiable — there is no per-user token to leak in the first place.

### A real, more serious finding: the existing scorer has an LLM deciding the score

`lib/code-dna/fingerprint.ts` sends the full scan to Groq and has it return
`authenticity_score` (0-100) directly — this is precisely what this brief's rule #4
prohibits ("an LLM may optionally phrase summaries but must never decide authenticity,
originality, contribution or any score"). This file is replaced entirely by a deterministic
scorer (Phase 2). `recruiter_summary` was also unconstrained free-text from the same call —
replaced with fully templated, trust-safe copy rather than trusting a prompt not to write a
banned phrase like "did not copy" under all future model versions.

### The named blocker: no sharing/recruiter-view mechanism exists

Searched the whole app tree and every migration for anything resembling a shareable
candidate profile, a recruiter auth flow, or a scoped read-only view. The only "recruiter"
concept in the schema is `public.recruiters` (migration `002_career_os_foundations.sql`) —
a company-identity table so a recruiter account can author `opportunities` (Launchpad job
listings). It has no relationship to viewing a candidate's evidence, and the migration's own
comment says so directly: *"recruiter search (§24) is a later phase, not built here."*
There is no `app/recruiter/*` route, no share-token table, no scoped-authorization pattern
anywhere to extend.

This is the brief's own named example of a true blocker ("no sharing mechanism to extend").
**Scope decision:** rather than stop the entire task, I'm treating this as blocking only
Phase 3 step 7 (recruiter read-only shared presentation) and the shared-view-authorization
half of Phase 2 — a public/shareable link with recruiter-side access control is a distinct,
security-sensitive feature (who can create a share link, does it expire, can it be revoked,
does the recruiter need an account) that deserves its own design conversation, not an
invented shape bolted onto this task. Everything else in the brief — the full candidate-side
Vault rebuild, multi-repo scan improvements, deterministic signal derivation, trust-safe
language, About-this-analysis section — has no dependency on sharing and proceeds in full.

### Existing reusable pieces

- `github-scan.ts`: `fetchGithubProfile`, `bioContainsCode`, `TECH_SIGNALS` file-presence
  table, `detectTechSignals`/`detectTestDir`/`detectReadme` (pure, tested) — all reused.
- `github_connections` table (account-level: username, verification, scan status,
  `last_scanned_at`, `next_scan_at`, `consecutive_failures`) — reused unchanged. Its
  `analysis`/`code_dna_score`/`confidence_level`/`recruiter_summary` columns are left in
  place (no destructive migration) but stop being written/read by the new code path — the
  new normalized tables below replace them going forward.
- `app/api/code-dna/{connect,verify,scan}/route.ts` — connect/verify flow reused unchanged;
  only `scan/route.ts` is rewritten (see Phase 2).
- Vault detail-page pattern, `capability-derivation.ts`'s deterministic-scoring approach and
  its confidence-threshold reuse (`lib/capability/confidence.ts`) — same discipline applied
  here.

## Phase 2: Design

### Normalized schema — new tables, minimum necessary

`github_connections` stays as the account-level row. Two new tables, not the brief's full
seven — `github_commits`/`github_pull_requests` as row-per-commit/PR tables were considered
and rejected: this is a periodically-refreshed, scan-limited evidence system (not a GitHub
mirror), and every UI requirement ("commits", "PRs") only ever needs *counts and dates*, not
individual commit rows. Storing those as aggregates on `github_repositories` is a real,
justified "existing structure can serve it" call, not a shortcut — full commit-level storage
would also multiply GitHub API calls (and rate-limit risk) for no UI benefit.

- **`github_repositories`** — one row per analyzed repo per scan (replace-on-rescan): name,
  description, is_fork, fork_source_full_name, fork_source_url, primary_language, topics,
  license, stars, forks_count, is_archived, size_kb, created_at, repo_updated_at,
  candidate_commit_count, candidate_pr_count, candidate_pr_merged_count,
  first_candidate_commit_at, last_candidate_commit_at, tech_signals jsonb, has_tests, has_ci,
  has_readme, has_dependencies, has_database_signal, has_auth_signal, contributors_count,
  scan_status ('ok'|'failed'|'partial'), scan_error, scanned_at. `scan_status` per row is
  exactly what makes "one failed repo must never fail the whole page" real, not aspirational.
- **`github_similarity_signals`** — repository_id, matched_repo_full_name,
  matched_repo_url, similarity_level ('low'|'moderate'|'high'), affected_area,
  possible_explanations text[], detected_at. See similarity approach below.

### Repository selection — fixes the real "stars-alone" problem this brief flags

New ranking, still capped by an explicit scan limit (`MAX_REPOS_TO_ANALYZE`, raised from 6 to
8 given richer per-repo data is now collected — still a small, explicit, rate-limit-aware
cap): score = recency (updated within 180d: +3, 1y: +1) + candidate-authored signal
(non-fork: +2) + tech-signal diversity (+1 per distinct category, capped) + a small,
capped star contribution (+1 if >10 stars, never more) — stars can nudge, never dominate.
Ties broken by `updated_at` descending. This directly satisfies "never rank by stars alone."

### Deterministic derivation modules (pure, unit-tested, no I/O)

- **`github-repository-selection.ts`** — the ranking above, pure function over raw repo
  list + candidate-authorship signal.
- **`technology-derivation.ts`** — "Observed GitHub usage" per technology: requires the
  signal in ≥1 repo AND (recency within the repo's own history OR appears in ≥2 repos) —
  a single stale config file in one old repo is real but weak evidence; the UI shows a
  strength tier (not a raw count) built from repo count + recency, never from package
  presence alone (directly satisfies the brief's technology-strength rule).
- **`practice-signals.ts`** — testing/CI/PRs/code-review/issue-tracking/docs/dependency-
  management, each `observed | not_observed`, each with its evidence list (which repos, by
  name, with the exact signal: "test file count", "CI workflow file present") — reuses the
  existing `evidence-profile.ts` practice-state pattern, extended to the full list.
- **`authenticity-and-review-signals.ts`** — splits the single old "authenticity_score" into
  two SEPARATE deterministic signal lists per the brief's exact taxonomy: authenticity
  signals (consistent authorship share, longitudinal history, multi-file real changes) and
  review signals (fork, low original-history repos, short-window commit concentration) —
  never combined into one "genuine" number. "GitHub Evidence Confidence" (renamed from the
  old score, per the brief's exact instruction) is a real weighted combination of these, but
  presented as a secondary number alongside the qualitative signal lists, never as the
  headline.
- **`similarity.ts`** — see below.

### Similarity abstraction — MVP scope, explicit limits

No existing similarity detection exists to reuse (verified: `evidence-profile.ts` has none).
Built as a real interface (`SimilarityDetector`) with one real MVP implementation
(`structuralSimilarity`) so a stronger method (fingerprinting, embeddings) can be swapped in
later without touching callers. MVP method, deliberately conservative and real (not
fabricated): for each candidate's original (non-fork) repo, GitHub's own **code search API**
(`/search/repositories` by a distinctive dependency-manifest signature, e.g. an exact
`package.json` "name" field or a rare combination of top-level file names) surfaces public
repos with matching structural fingerprints; a match is scored `high` only when ≥3 identical
distinctive file names AND an identical dependency-manifest name collide with a *different*
owner. This is intentionally narrow — it will under-detect (many real cases missed) rather
than over-claim, which is the correct failure direction for a "review signal, not an
accusation." Enforced limits: only the candidate's non-fork, non-archived repos are checked
(never bulk-compare public repos blindly); at most 3 similarity lookups per scan (own rate
limit, separate from the repo-detail budget); every signal stores `detected_at` and the
exact matched repo for provenance, never a bare "similarity: 73%" without a source link.

### API — extend the existing scan route, not a new surface

`POST /api/code-dna/scan` rewritten internally (same route, same auth/rate-limit/cooldown
gate) to: fetch repo list → rank/select via `github-repository-selection.ts` → for each
selected repo, fetch detail + commit/PR aggregates with real pagination and exponential
backoff on rate-limit responses, continuing past any single repo's failure
(`scan_status: 'partial'` on that row, never failing the whole scan) → run the pure
derivation modules → upsert `github_repositories` rows (delete-then-insert per scan, scoped
to `user_id`) → run similarity (bounded) → update `github_connections` (`last_scanned_at`,
`consecutive_failures` reset only on a fully-clean scan, `'partial'` surfaced via a new
`scan_status` value if any repo failed). `GET /api/code-dna` extended to read the normalized
tables instead of the old `analysis` blob. No new route needed.

## Phase 3-5 — Implementation, tests, verify

### UI rebuild (candidate Vault view)

The brief specifies the recruiter-view content order in detail but doesn't call out a
different order for the candidate's own Vault view — reused the same order (header/summary,
engineering activity, technology DNA, projects, contribution, provenance, project scale,
authenticity signals, review signals, originality review, engineering practices, timeline,
analysis coverage, freshness, source links, About This Analysis) so the candidate sees
exactly the same trustworthy, evidence-first presentation a recruiter would, not a
different/friendlier version of the same data.

`components/vault/CodeDnaCard.tsx` and `app/(app)/dashboard/vault/code-dna/page.tsx` were
both rewritten against the new response shape (`evidenceConfidence`, `repositories`,
`technologies`, `practices`, `authenticitySignals`, `reviewSignals`, `hasPartialCoverage`) —
the old `codeDnaScore`/`confidenceLevel`/`evidenceProfile` fields no longer exist in the API
response.

### Resolving the Arena-mention conflict

The first brief's `capabilityProfile` (Arena + GitHub blended capability scores) is still
computed and returned by `GET /api/code-dna` because `/dashboard/skill-gap` reads it — an
unrelated, still-shipping feature this brief doesn't touch. The second brief's "never mention
Arena in the UI or copy" rule applies to the **Code DNA UI specifically**, not to that shared
API field. Resolution: the new Code DNA card and detail page never render `capabilityProfile`
or `arenaAttemptCount` at all — confirmed via a project-wide grep (`Arena`, case-insensitive)
across every Code DNA UI/component file: every hit lives in backend code (`capability-derivation.ts`,
its test, and the `arenaAttemptCount`/`capabilityProfile` plumbing in `route.ts`), none in
rendered copy.

### Dead-code sweep (first-brief architecture superseded by this brief)

Deleted, confirmed zero remaining importers before removal:
- `app/(app)/dashboard/vault/code-dna/[category]/page.tsx` — first brief's per-category drill-down.
  Broken by this brief's own change (reads `github_connections.analysis`, which the new scan
  route always sets to `null`) and violated the "never mention Arena" rule in its own copy
  ("complete Arena challenges"). No longer linked from anywhere.
- `lib/code-dna/capability-explain.ts` — only consumer was the deleted page.
- `lib/code-dna/evidence-profile.ts` + `.test.ts` — first brief's `analysis` blob shape, fully
  superseded by the normalized `github_repositories` tables.
- `lib/code-dna/fingerprint.ts` — unused, no test, superseded by `similarity.ts`.
- `components/vault/CodeDnaTrajectoryChart.tsx` — unused, no remaining importer.

`lib/code-dna/capability-derivation.ts` (+ its test) and `github-scan.ts`'s legacy
`GithubScanResult`/`RepoAnalysis` types were kept — both are still real, live dependencies of
the Skill Gap integration via the adapter in `route.ts`.

### Phase 4 — security tests

No API route in this codebase has ever had a route-level integration test (checked: only
`lib/**` and `components/**` have `.test.ts` files) — building a Next.js request/response +
Supabase-client mocking harness from scratch for Code DNA alone would be new test
infrastructure the rest of the codebase doesn't use, so verification here follows the
codebase's actual pattern and is backed by code-level facts, not a new test harness:

- **Auth** — `lib/api/require-user.test.ts` (already existed) covers the shared `requireUser`
  gate every Code DNA route calls first; asserts the session user id is never
  client-suppliable.
- **Ownership** — every query in both routes filters `.eq("user_id", auth.userId)` where
  `auth.userId` only ever comes from `requireUser`'s verified session (see above) — no route
  reads a user id from the request body or params.
- **Tampering** — `POST /api/code-dna/scan` takes no request body at all (its handler
  signature is `export async function POST()`, no `Request` parameter) — there is no field
  for a client to tamper with. `evidenceConfidence`, `recruiterSummary`, and every repository
  row are computed entirely server-side from the GitHub scan.
- **Source integrity** — the derivation unit tests (`technology-derivation.test.ts`,
  `practice-signals.test.ts`, `authenticity-and-review-signals.test.ts`, `similarity.test.ts`,
  `recruiter-summary.test.ts`) assert every output signal traces to specific evidence fields
  on the scanned repo, never a fabricated or inferred claim.
- **Leakage / OAuth-token** — confirmed by grep: `GITHUB_TOKEN` (an app-level, optional,
  rate-limit-only credential — never a per-user OAuth token) is referenced only inside
  `github-scan.ts`'s outbound request headers; it never appears in either API route file or
  any response payload. There is no per-user OAuth token anywhere in this feature to leak.
- **GitHub-failure-handling** — new `lib/code-dna/github-scan-resilience.test.ts` (7 tests):
  `lastPageFromLinkHeader` pagination parsing, `fetchWithBackoff` retry-then-succeed and
  bounded-give-up on rate-limiting, and `scanOneRepository`/`scanGithubProfileFull` marking a
  single repo `scanStatus: "failed"` (deleted/renamed/private/timeout) without throwing or
  affecting sibling repos in the same scan (partial coverage).
- **Shared-profile / recruiter read-only view** — still the named, documented blocker from
  Phase 1: no sharing mechanism exists anywhere in this codebase. Deferred, not built. Nothing
  in this brief's scope depends on it existing (the candidate's own Vault view needs no
  sharing).

### Phase 5 — verify

- `npx tsc --noEmit` — clean.
- `npx eslint` on every new/changed file — clean (one `react-hooks/purity` finding on a
  `Date.now()` call in the detail page's render body, fixed by extracting it into a
  module-level `daysSince` helper).
- `npx vitest run` — 106/106 passing across 17 files.
- `npx next build` — clean production build; the deleted `[category]` route is gone from the
  route table, confirming no stale route remained.
- Banned-word audit (`genuine`, `did not copy`, `definitely`, `copied this repository`,
  `plagiar`, `expert`, `Arena`) — grepped across every Code DNA UI/lib/route file. The only
  hits are: test assertions checking the words are *absent*, code comments explaining *why*
  they're banned, and the mandated About-block sentences that explicitly *deny* a plagiarism
  claim ("do not by themselves establish plagiarism"). No violation.
- Duplicate-architecture / nav audit — grepped for any nav file or route referencing
  `code-dna` outside the Vault subtree: none found. Code DNA has exactly one route
  (`/dashboard/vault/code-dna`), reached only from inside Vault, per the hard rule.
- Mobile/desktop UI check — **not verified**. No browser or credentials are available in this
  background session. Disclosed rather than claimed; the responsive classes follow the same
  Tailwind patterns already used elsewhere in Vault, but visual confirmation is outstanding.
