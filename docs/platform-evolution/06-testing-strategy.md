# Testing Strategy

## Unit (Vitest, added this pass)

Pure, deterministic functions first — the brief's own list (§16), scoped to what exists today:

- `computeSkillGaps`/`buildCareerMatch` (`lib/career/skill-gap.ts`)
- `matchCareersForStudent`'s sort/shape (`lib/career/match.ts`)
- `scoreTier` (`components/dashboard/tier.ts`)
- `currentStageIndex`/`isStageUnlocked` (`lib/journey/stage.ts`)
- `computeNextAction` (`lib/dashboard/next-action.ts`)
- `computeCapabilitiesForAttempt`'s confidence thresholds (`lib/capability/compute.ts`) — the pure tallying logic, not the Supabase I/O
- ELO: the real calculation lives inside the `finish_arena_challenge` Postgres RPC (confirmed via live introspection this session — standard chess ELO update, fixed 1200 baseline "opponent," K=32: `expected = 1 / (1 + 10^((baseline - ratingBefore)/400))`, `delta = round(K * (actual - expected))`). This pass adds `lib/arena/elo.ts` — a pure TypeScript port of that exact formula, unit-tested, used as the documented reference implementation (e.g. for any future client-side rating preview). The live RPC is the actual source of truth for scoring and is **not modified** this pass; the port is for testability and future consistency, not a behavior change.

## Integration / RLS / authorization — the brief's hard requirement (§15)

**Never assume an RLS policy is correct without testing it against real accounts.** Done this pass via Supabase's session-variable impersonation technique against a branch database (not production): a SQL test creates two organisations and users with different roles, then per-query does

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub": "<test-user-uuid>", "role": "authenticated"}';
select * from organisation_memberships; -- must only return that user's own rows
```

This is a real test of the *policy as written*, executed against a real Postgres instance with the real schema — not a read of the policy SQL and a guess about what it does (which is what last session's migration review was limited to, for lack of any database access at all). Results are recorded in the branch verification log referenced in `08-roadmap.md`.

## What's still missing after this pass

- **E2E** (Playwright or similar): zero coverage, not added this pass. The highest-value first E2E targets once added: signup → assessment → dashboard (the one flow that touches the trigger functions this pass rewrites) and the login role-resolution branching in `components/login/auth.ts`.
- **CI**: a GitHub Actions workflow is added (`.github/workflows/ci.yml`) running typecheck + lint + unit tests on every push — it cannot run RLS/branch tests (those require live Supabase branch provisioning, not yet automated) or E2E (none exist yet). Both are real follow-on work, named rather than implied-done.
- **Matching/journey/opportunity tests** (§16's list also names these): not applicable yet — there is no matching engine or multi-template journey code to test until Phases 1/3 land the logic itself. Listed here so the gap is visible, not because a test was skipped for something that exists.
