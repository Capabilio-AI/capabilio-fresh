# Arena Challenges Redesign — Stream + Domain, no MCQs

## Request

Arena's Challenges section (`/arena/challenges`) currently serves generic 10-question MCQ
quizzes pulled from `question_bank`, disconnected from the student's branch or career. Replace
it with two tracks — Stream (the student's own branch) and Domain (their chosen career) — no
MCQs. Every week each track gives the student a real animated spinning-wheel pick from a
rotating pool, ported from the equivalent mechanism in the sibling `Capabilio-new` codebase.
"Common challenges" = the shared rotation mechanism powering both tracks, not a third category
(confirmed with the user).

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
  `scope_key` (a branch name or a `career_role`). Nothing existing models this.
- `arena_challenge_slots` — per-student, per-track rotating slots (3 per track). Ported directly
  from Capabilio-new's `useDomainChallengeSlots.js` selection algorithm (4-tier fallback:
  different-category-and-unseen → different-category → unseen → anything), with the cooldown
  changed from 24h to 7 days per this brief's "every week."
- `arena_challenge_completions` — the attempt record for a Stream/Domain challenge, source table
  for a new evidence writer (`lib/evidence/from-arena-challenges.ts`, extending today's evidence
  work rather than duplicating `from-arena.ts`'s quiz-shaped logic).

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

## Rating impact — simple and separate from the quiz's ELO

A correct Stream/Domain challenge submission adds that challenge's own fixed `elo_gain`
(10-30, set per challenge at generation time) directly to `arena_ratings.rating` via the
service-role client. Deliberately not routed through `finish_arena_challenge` (that RPC's shape
— `answered_count`/`correct_count`/`question_order` — is quiz-specific and left untouched) and
deliberately not a new ELO formula (a single pass/fail challenge isn't a "match" in the ELO
sense a quiz score is). Documented as a distinct, simpler mechanism, not a fabricated second ELO
system.

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
