# Ticket bank: design

Status: proposal, nothing built. Goal: serve every IT and non-IT role without hand-writing templates per role, keep AI cost falling, and grow a reusable per-role dataset of validated tickets.

## What exists today (verified in code)

- Tickets are produced by `tool.generate(ctx)` inside `startNextAttempt` (`lib/arena-workstations/attempts.ts`). Two sources: deterministic templates (`lib/workplace/tickets/`, code, no storage) and AI (Groq) for roles without a company world.
- Every generated ticket is written to `arena_challenges` (`user_id` = the user, `scope_key` = role) and attached to the user through `arena_domain_assignments`. So storing generated tickets already happens.
- `arena_challenges.user_id` is nullable: `user_id is null` + `status = 'PUBLISHED'` is already the shape of a shared, readable challenge (migration 061 policies). `source` already allows `AI_GENERATED`. The shared bank needs mostly a reuse path, not a new schema.
- Rotation (`arena_rotation_state`, weakest skill first, level gating) already decides which skill area is next.

## The one real constraint

Company-world tickets (BrightCart etc.) are built from a per-user seeded warehouse, so their answers depend on that user's data. They are not reusable across users and must not enter the shared bank. Only self-contained tickets are bankable: the dataset or files needed are embedded in `content`, and `answer_key` does not depend on a user's world.

## Design

### 1. Role workstation + checker (the actual per-role work)
Per role: a workstation (tool_type) and a deterministic checker that grades a submission against the `answer_key`. AI writes the scenario and data; the checker, never the AI, decides pass or fail. Roles whose output cannot be checked mechanically (essays, design) use a rubric-graded tool and are marked `grading = rubric`, with lower ELO weight until calibrated.

### 2. Validation gate (shared by all sources)
Before any ticket is served or banked it passes the same checks `validateDraft` applies to SQL: reference solution passes, common mistake fails, doing nothing fails, answer is small and unambiguous. For AI tickets add: a second independent solve (different model or seed) must agree with `answer_key`. Failure means regenerate; a failed ticket is never served.

### 3. Bank-first assignment
In `startNextAttempt`, after rotation picks the skill area and difficulty:
1. Look in the bank for `user_id is null`, `status = PUBLISHED`, matching `scope_key`, area, difficulty, level, not previously assigned to this user, ordered by lowest times served.
2. Found: assign it (insert an assignment row pointing at the bank challenge). No AI call.
3. Not found: generate, validate, assign to the user, and publish a bankable copy (`user_id = null`).
Bank grows from real demand. Cost per ticket falls as it fills. Cold start for a new role is the fresh-generation path.

### 4. Quality loop
Track per banked ticket: times served, pass rate, median time, report-a-problem count. Auto-retire (`status = RETIRED`) when pass rate is 0% or 100% over N attempts, or reports exceed a threshold. Re-validate on tool version bump (`generation_version` / `grading_version`).

### 5. Pending ticket stays until finished
Already the model: an assignment stays `presented` until submitted or closed, and the next ticket is generated only after completion. Keep that; the bank changes only where the ticket comes from.

## Schema changes (small)
- `arena_challenges`: add `times_served int`, `pass_count int`, `report_count int`, `bank_key text` (hash of role+area+difficulty+content for dedupe), `reusable boolean` (false for world-bound).
- Index on (`scope_key`, `area_key`, `difficulty`, `status`) where `user_id is null`.
- A function `claim_bank_challenge(user, role, area, difficulty, level)` that picks and records the assignment atomically (avoids two users racing; mirrors `commit_rotation_attempt`).

## Risks
- Answer leakage: banked tickets are seen by many users, so a leaked `answer_key` or shared solutions hurt. Mitigation: `answer_key` stays server-only (already true), rate-limit submissions, and mix in light parameterisation (seeded numbers) where the checker allows.
- Quality drift of AI tickets: handled by the gate and the retire loop; start new roles in a "beta" band with reduced ELO.
- Fairness of ELO across bank vs fresh tickets: difficulty is calibrated from observed pass rate, not the AI's label, once a ticket has enough attempts.

## Build order
1. Add the columns and `claim_bank_challenge` (migration 108).
2. Extract the validation gate into a tool-agnostic interface (`validate(draft)`), keep SQL's implementation.
3. Bank-first branch in `startNextAttempt`, with publish-on-generate for `reusable` tickets only.
4. Stats + auto-retire job.
5. Pick one non-IT role as the pilot (rubric-graded workstation) to prove the path beyond SQL.

## Decisions needed from you
- Which role is the pilot for step 5 (one IT outside SQL, or one non-IT)?
- Is a ticket shared between users acceptable for ELO, or must every user get a unique instance (then only parameterised tickets are bankable)?
- Rubric-graded roles: allowed to affect ELO at launch, or shown as practice only until calibrated?
