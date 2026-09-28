# Arena Challenges Redesign — Stream + Domain, no MCQs

## Request

Arena's Challenges section (`/arena/challenges`) currently serves generic 10-question MCQ
quizzes pulled from `question_bank`, disconnected from the student's branch or career. Replace
it with two tracks — Stream (the student's own branch) and Domain (their chosen career) — no
MCQs.

## v2 — wheel + scratch card + weekly batch (supersedes the first pass's per-slot rotation)

The user shared reference screenshots of a wheel → scratch card → task-grid → leaderboard →
history flow and asked for the same mechanic, plus two things confirmed via clarifying
questions:

1. **Branch clustering for Stream challenges**: CSE, IT, AI/ML, AI & DS, Data Science, and CSBS
   share one "IT cluster" pool (`lib/arena-challenges/branch-clusters.ts`, reusing
   `BRANCH_CATALOG`'s own names/keywords rather than re-declaring them). Every other branch
   (ECE, EEE, Mech, Civil, MBA, MCA, ...) gets its own distinct pool via slugification — they're
   too different from each other and from IT to share content meaningfully.
2. **One weekly batch, not independent slots**: a single spin per track per week picks a task
   count (5-10, matching the reference wheel's segments), a scratch card reveals it, and that
   many challenges unlock together as a grid — not the first pass's 3 independently-rotating
   slots. `arena_challenge_weeks` (one row per user/track/week) replaced
   `arena_challenge_slots` outright (020_arena_challenge_weekly_batches.sql); no real data
   existed in the slot table yet, so it was dropped rather than migrated in place.

"Common challenges" in the user's phrasing turned out to mean the shared rotation/generation
*mechanism* behind both Stream and Domain, not a third challenge category — confirmed, not
guessed.

### Points, streak, and the leaderboard — genuinely new

- `arena_challenge_stats` (one row per user): running `points`, `tasks_completed`,
  `current_streak`, `longest_streak` — a different, simpler mechanism from `arena_ratings`'
  ELO, matching the reference's Easy/Medium/Hard → 50/70/100 point scale
  (`lib/arena-challenges/points.ts`, computed server-side from difficulty at submit time, never
  trusted from the AI generator's own output).
- Streak advances at most once per week regardless of how many challenges are solved that week,
  and resets (not decrements) after a skipped week (`lib/arena-challenges/streak.ts`, pure,
  tested against `lib/arena-challenges/week.ts`'s Monday-anchored week boundaries).
- `GET /api/arena/challenges/leaderboard?scope=global|branch` — Global or same-branch-as-viewer
  (the student's own literal branch, a finer grain than the shared IT-cluster pool), reusing the
  existing `get_public_profiles` RPC the quiz leaderboard already depends on.
- `GET /api/arena/challenges/history` — past (non-current) revealed weeks with solved-count,
  backing the reference's History tab.

### AI-generation-failure fallback (explicit requirement)

The reveal (`POST /api/arena/challenges/[track]/scratch`) tries to top up the catalog via AI
first, but the top-up call is wrapped so a Groq failure never blocks the reveal — it just
proceeds with whatever's already stored in `arena_challenges` for that scope. Only a genuinely
empty pool (first-ever request for a scope, and generation also failing) produces an honest
"not ready yet" error instead of either crashing or faking a reveal.

## What already exists and is reused, not duplicated

- **Branch**: `lib/branch-catalog.ts` (52 real branches) + `getStudentBranchContext()`
  (`lib/assessment/attempts.ts`) reading `institution_memberships`/`institutions`.
- **Chosen career**: `getStatedCareerInterest()` (`lib/career/interest-statement.ts`) reading
  `career_interest_target.stated_role` — what the student explicitly told the platform.
- **Real career catalog**: `career_requirements.career_role` — 5 seeded roles today (Business
  Analyst, Data Analyst, Machine Learning Engineer, Product Designer, Software Engineer).
- **Code execution + deterministic evaluation**: `runCode()` (`lib/code-execution/wandbox.ts`,
  Wandbox-backed) + the exact-output-match pattern already live in
  `app/api/assessment/[section]/coding-submit/route.ts` (`stdout.trim() === expectedOutput.trim()`).
  Reused directly — no new evaluator, no AI grading, ever.
- **AI-backed content generation**: `lib/question-bank/generate.ts`'s pattern (Groq +
  `completeJson` + Zod schema, batch-inserted into a catalog table, `active` flag) — the same
  shape, applied to a new `arena_challenges` catalog instead of `question_bank`.
- **Auth/rate-limit conventions**: `requireUser`, `checkRateLimit` — unchanged, used as-is.
- **`arena_ratings`/leaderboard**: kept as the shared rating surface; challenge completions bump
  it directly and simply (see below), without touching `finish_arena_challenge` or its ELO math.

## What's genuinely new

- `arena_challenges` — the challenge catalog, scoped by `track` (`'stream' | 'domain'`) and
  `scope_key` (an IT-cluster key, a per-branch key, or a `career_role`). Nothing existing models
  this.
- `arena_challenge_weeks` — one row per (user, track, week), holding the wheel's task-count
  result and, once scratched, the picked challenge ids (`lib/arena-challenges/batch-select.ts`
  for the picking logic — prefers challenges not used the previous week, falls back to reuse
  rather than under-delivering, never returns more than the pool actually has).
- `arena_challenge_completions` — the attempt record for a Stream/Domain challenge, source table
  for a new evidence writer (`lib/evidence/from-arena-challenges.ts`, extending today's evidence
  work rather than duplicating `from-arena.ts`'s quiz-shaped logic). Unique on
  `(week_id, challenge_id)` so a resubmission updates the same row instead of double-awarding
  points on retry.
- `arena_challenge_stats` — running points/streak per student, public-read like `arena_ratings`
  (a leaderboard needs to see everyone's numbers).

## Explicitly NOT touched

- `arena_challenge_attempts` / `finish_arena_challenge` RPC / the MCQ quiz backend
  (`/api/arena/start`, `/api/arena/[attemptId]/finish`) stay exactly as they are. The Challenges
  *page* stops offering the quiz UI, but nothing about the quiz backend, its RLS, or its ELO
  formula is deleted or modified — same "don't touch the RPC" discipline this session has
  followed for `finish_arena_challenge` throughout. If genuinely dead after this lands, that's a
  separate, later cleanup decision, not bundled into this one.
- Capabilio-new's `arena-v2` workstation rendering (Monaco/notebook/terminal shells,
  `workstationRegistry.js`) — not ported. A `<textarea>` + run/submit, matching the assessment
  engine's own `CodingPanel`, is the right scope for v1; a full IDE-in-browser is a separate,
  much larger undertaking not requested here.

## Points impact — simple and separate from the quiz's ELO

A correct Stream/Domain challenge submission adds a fixed, difficulty-based point value
(50/70/100, `lib/arena-challenges/points.ts`) to `arena_challenge_stats.points`, not to
`arena_ratings.rating`. Deliberately not routed through `finish_arena_challenge` (that RPC's
shape — `answered_count`/`correct_count`/`question_order` — is quiz-specific and left untouched)
and deliberately not folded into the quiz's ELO (a single pass/fail challenge isn't a "match" in
the ELO sense a quiz score is). A separate, simpler, and — per the reference screenshots — more
legible number for this specific gamification loop.

## Wheel UI

A real animated spin: the server has already computed the pick (via the rotation algorithm) by
the time the wheel starts spinning — the animation is a reveal, never client-side randomness
deciding the actual result. Matches the "server decides, client reveals" discipline used
everywhere else in this codebase (scores, evidence, verification).

## Scope bound for v1

Stream/Domain challenges are code-execution-evaluable only (language + starter code + stdin +
expected output) — this is what keeps evaluation deterministic and lets it reuse `runCode`
directly with zero new evaluation risk. A design/scenario/free-response challenge type (open-
ended, AI-assessed) is out of scope for this pass; adding one later would need its own explicit
decision about how to keep grading non-AI-decided, matching this codebase's whole trust
architecture.

## Empty-state honesty

A student with no branch on record, or no stated career interest yet, sees a real empty state
directing them to set it (Education/Profile for branch, the career-interest assessment step for
career) — never a fake/generic challenge pool standing in for "we don't know your branch yet."
