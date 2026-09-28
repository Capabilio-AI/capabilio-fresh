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
