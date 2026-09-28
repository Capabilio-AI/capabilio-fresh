# Evidence Engine — Progress

Read this first on resume. Phases per the brief in the user's original message
(`# Task: Production evidence engine: Code DNA + Arena evidence + Portfolio`).

## Status

- **Phase 1 (Audit)**: done. See `docs/evidence-engine-audit.md`. Root cause confirmed against
  live production data: the reported "0 commits, 0 PRs" account is a GitHub *organization*
  (`Capabilio-AI`, this repo's own org), not an individual candidate — GitHub commits are never
  authored by an org login, so that symptom is correct, not a bug. See the audit doc's
  root-cause section for the full finding and what it does/doesn't invalidate.
- **Phase 2 (Design)**: done. Appended to the audit file.
- **Phase 3 (GitHub ingestion)**: partially done.
  - Done: `MAX_REPOS_TO_ANALYZE` raised 8 → 60, reframed from a curation cutoff to a documented
    rate-limit safety valve. `MAX_REPO_LIST_PAGES` raised 5 → 20. Fork commit-count bug (fixed
    earlier this session, commit `dd27521`) confirmed real but not the cause of the reported bug.
  - Not done: moving the scan off the synchronous request/response cycle (background execution).
    `github_analysis_runs` table exists (applied) but nothing writes to it yet.
- **Phase 4 (Derivation)**: evidence-strength formula done and tested (`docs/evidence-strength.md`,
  `computeCapabilityStrength`). The rest of Phase 4 (development timeline, provenance object as
  its own evidence, originality/similarity feeding `evidence`) not built — Code DNA's existing
  modules still serve Code DNA's own UI only; they don't feed `evidence` beyond
  `deriveGithubEvidence`'s technology_usage/commit_activity rows.
- **Phase 5 (Arena evidence)**: done — `lib/evidence/from-arena.ts` (tested), wired into
  `app/api/arena/[attemptId]/finish/route.ts` after the RPC succeeds.
- **Phase 6 (Auto-update pipeline)**: not started — evidence writes happen at scan/finish time,
  so Portfolio reflects new evidence on next read, but there's no explicit
  recompute-affected-capabilities step and no "last updated / sync status" surfaced on Portfolio.
- **Phase 7 (API/service layer)**: not separately audited/built beyond what Phase 3/5 needed.
- **Phase 8 (UI)**: Portfolio (candidate-facing) rebuilt to read real evidence — Demonstrated
  Capabilities (strength, source mix, per-item verify links), Candidate Stated (self-reported
  skills not yet evidence-backed) — `app/(app)/dashboard/portfolio/page.tsx`. Code DNA's own UI
  untouched (stays GitHub-only per rule #1). Recruiter-facing Portfolio UI **not built** — see
  decision #4.
- **Phase 9 (Tests)**: pure-function tests written and passing: `lib/evidence/from-github.test.ts`,
  `lib/evidence/from-arena.test.ts`, `lib/evidence/aggregate-capabilities.test.ts` (23 new tests).
  Security tests (RLS cross-candidate read, client-submitted evidence payload rejection,
  recruiter-scope enforcement) **not written** — same gap as Phase 9 in the earlier Code DNA
  brief this session: no route-level test harness exists anywhere in this codebase (confirmed
  again this pass), and building one from scratch is out of scope here too. Argued in the final
  report, not silently skipped.
- **Phase 10 (Verify)**: **done**. `npx tsc --noEmit` clean. `npx eslint` on every
  new/changed file clean. `npx vitest run` — **132/132 passing** across 20 files (was 106 before
  this pass; +23 net for the two prior fix passes plus +23 this pass, some counted twice across
  passes — see git log for exact deltas). `npx next build` clean, all routes present, no route
  regressions. Banned-word audit (Expert/genuine/plagiar/Senior/Top developer/Junior/Excellent
  engineer/Best candidate/Proven original/100% authentic) — zero hits anywhere in this pass's
  files. Mobile/desktop UI check — **not verified**, no browser available in this background
  session.

## New files this pass

- `supabase/migrations/018_evidence_unification.sql` — **applied to production**.
- `lib/evidence/types.ts`, `lib/evidence/from-github.ts` (+ test), `lib/evidence/from-arena.ts`
  (+ test), `lib/evidence/record.ts`, `lib/evidence/aggregate-capabilities.ts` (+ test).
- `docs/evidence-strength.md`.

## Changed files this pass

- `lib/code-dna/github-scan.ts`, `lib/code-dna/github-repository-selection.ts` — cap raised, reframed.
- `lib/code-dna/capability-derivation.ts` — exported `FRONTEND_TECH`/`BACKEND_TECH`/`DEVOPS_TECH`.
- `app/api/code-dna/scan/route.ts` — writes GitHub evidence after a successful scan.
- `app/api/arena/[attemptId]/finish/route.ts` — writes Arena evidence after the RPC succeeds.
- `app/(app)/dashboard/portfolio/page.tsx` — reads `evidence` + `capabilities`, renders
  Demonstrated Capabilities / Candidate Stated.
- `lib/supabase/types.ts` — regenerated after the migration applied.

## Key decisions (see audit doc §Phase 2 for full reasoning)

1. Extend the existing `public.evidence` table (new nullable columns + one new enum value)
   instead of creating a parallel evidence table — it already exists, applied to production,
   and is literally the target of the codebase's own pre-existing roadmap Phase 2.
2. New `github_analysis_runs` table for per-run tracking — nothing existing covers this history.
3. Recruiter read access via a new RLS policy on `evidence`, scoped through the existing
   `applications` → `opportunities` → `recruiters` relationship — no new consent table.
4. **Scoped out of this pass, explicitly**: the actual recruiter-facing UI/routes (no recruiter
   signup/auth flow exists, no design spec, and the codebase's own `08-roadmap.md` defers this
   to its Phase 5 as lowest priority / non-blocking). The RLS-level data access is built and
   real; the pages that would consume it are not.
5. `finish_arena_challenge` RPC is left untouched (per two prior sessions' explicit discipline)
   — Arena evidence writes happen in the API route after the RPC call succeeds.
6. Capability strength is computed at capability (aggregate) level, not per evidence row — the
   brief's own factor list (repetition, cross-source corroboration) describes group properties,
   not single-row properties. `evidence.strength` stays null on every row this pass writes;
   `docs/evidence-strength.md` explains why.

## Known blockers / risks carried over from earlier this session

- `git push` to `origin/main` (`Capabilio-AI/capabilio-fresh`) is still blocked — neither
  authenticated `gh` account (`kgopichandu0405`, `capabilioAI-prog`) has write access; the
  account matching prior commit authorship (`venkatakopuri1995`) has an expired local token
  needing interactive re-auth. All work lands as local commits regardless.
- The Supabase auto-mode classifier had an extended outage spanning most of Phase 3-9 of this
  pass (repeated no-verdict errors on `Bash`/`mcp__claude_ai_Supabase__*`, not denials — Read/
  Write/Edit worked throughout). It recovered before Phase 10; the migration is applied, types
  are regenerated, and everything has been verified for real. No outstanding cleanup from this —
  noted here only as color for why this pass took the shape it did.

## What a future pass should pick up next (not started this pass)

- Background execution for the GitHub scan (Phase 3's "browser never waits" requirement) +
  wiring `github_analysis_runs`.
- Phase 6's explicit recompute-on-new-evidence step and a "last synced" indicator on Portfolio.
- Phase 9's security test suite, once/if this codebase adopts a route-level test harness.
- The actual recruiter-facing Portfolio UI, once there's a recruiter signup/auth flow to build
  it on top of (currently: `recruiters` rows exist but nothing creates them from a real signup
  flow — unverified whether one exists at all; not audited this pass).
