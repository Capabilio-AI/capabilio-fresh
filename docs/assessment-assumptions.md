# Assessment redesign: decisions and assumptions

One line per ambiguous call, made on the safest side. Change any of them in `lib/assess/config.ts` or the named table.

## Data model
- **Reused, not duplicated.** `careers` is the role table, `skills` the skill table, `career_skill_requirements` the role-skill table (it gained `assessment_weight`, `min_questions`, `max_questions`). `skill_categories` was added and filled from the existing `skills.category` values. No second taxonomy exists.
- **Skill sets were completed, not replaced.** Migration 080 only *adds* missing skills and requirement rows (`on conflict do nothing`), so existing rows and the roadmap engine keep working. Every career now has 12 to 19 skills.
- **Weights follow importance** (CRITICAL 4, HIGH 3, MEDIUM 2, LOW 1; min questions 2/1/1/0; max 4/3/2/1). They are plain columns, tunable per row.
- **One generic set of tables for both layers**: `assess_sessions` (+ `layer`), `assess_session_questions`, `assess_responses`, with `assess_sessions.result` holding each finished result. The brief's separate `career_assessment_*` tables would only have duplicated them.
- **`assess_question_pool`** has RLS on and no policies. It holds the answer key, so only the server can read it.

## Flow and gating
- **Existing students are grandfathered.** Anyone who completed the legacy assessment was backfilled to `ACTIVE`, so nobody loses a dashboard they already have. Everyone else (and every new signup) starts at `ASSESSMENT_REQUIRED`. The legacy assessment code and routes are left in place but unused.
- **Gate scope**: the dashboard and the roadmap page show only the onboarding shell until `PROFILE_READY`. Staff and other non-student roles are never gated. First view of the unlocked dashboard moves `PROFILE_READY` to `ACTIVE`.
- **"I'm exploring"** lets a student take the general assessment first, but they must confirm one career before the career assessment. Nothing ever picks a career silently: free text goes through the existing `career_suggestions` flow and the student confirms one.
- **Plan B** can be assessed separately (`/assessment?plan=b`), accepted only for the student's saved Plan B. It has its own session, radar and ELO row and is never merged with the main career.
- A signed-in student whose assessment is done is sent straight to `/dashboard`; `/assessment?retake=1` retakes the career assessment.

## Questions (Groq only)
- **Model**: `GROQ_MODEL`, default `openai/gpt-oss-120b` (the largest chat model this account's key can reach; see `lib/ai/groq.ts`). `GROQ_FALLBACK_MODEL` is optional. `GROQ_MAX_CONCURRENCY` (default 2) caps parallel calls.
- **JSON mode + zod, not `json_schema`.** The shared client already uses `json_object`; every response is validated by a strict schema plus semantic checks, so the stricter transport adds nothing.
- **Second-pass verification.** A separate Groq call solves each generated question *without* seeing the key; a question is stored only if it agrees. If the verifier call fails, nothing from that batch is stored. This was added after the first batch showed explanations saying "Option 2" (wrong once options are shuffled), which is now also rejected by the validator.
- **Pool targets** per skill: 2 easy, 3 medium, 2 hard (`POOL_TARGET_PER_SKILL`); per general section 4/6/4. Fill with `npm run assess:pool -- <career-key>` or `-- --general`. Confirming a career and starting a session also top the pool up in the background.
- **Cold start**: if the first question's skill has nothing stored, one bounded (20 s) live generation is tried, then the nearest stored question, then a friendly retry state (HTTP 503 `POOL_UNAVAILABLE`, progress kept).
- Questions that failed review were **deactivated** (`is_active = false`), not deleted.

## Lengths
- **General diagnostic: 30 questions** (5 in each of the 6 sections, served in section order, difficulty adapting inside a section). The brief gave no length; the old assessment was 135 questions.
- **Career assessment: 22** (`CAREER_QUESTIONS_DEFAULT`), capped by the role's total skill capacity. Minimums that do not fit are dropped least-important-first (`fitTargets`).
- **No timer** (the brief made it optional) and **no skip**, so `assessment_question_skipped` is defined but never emitted.

## Scoring
- **Skill score** = posterior mean of a small item-response model (difficulty-aware, 25% guess floor), mapped to 0-100. **Confidence** is HIGH (3+ answers and a tight posterior), MEDIUM (2), LOW (1), INSUFFICIENT (0, shown as "Insufficient evidence", never a fake number).
- **Readiness** = sum(weight x confidence factor x min(1, score/target)) / sum(weight x confidence factor), factors 1 / 0.8 / 0.5 / 0. It also reports `coverage` (share of the role's weight actually measured) so the UI can say "based on N of M skills".
- The skill graph is shared across roles: SQL evidence from one role counts toward every role that needs SQL. ELO is per role and never transfers.
- A finished career assessment also writes the legacy `capabilities` / `capability_history` rows, which is how the existing roadmap engine receives the new graph; it then runs `ensureRoadmap` (hash-on-read, so it only writes a new version if the inputs changed, and reports what is missing, for example no curriculum, instead of inventing a roadmap).

## ELO
- Rules live in `elo_rules`: ASSESSMENT `+4 / -2`, multipliers `1.0`, floor `0`. All changes go through `apply_elo_event`, one transaction with the response (`record_assessment_answer`). `elo_events` and snapshots reject UPDATE and DELETE.
- **Arena (ARENA rule, +4 / -2 base)**: only a *verified pass* of a workstation challenge moves the rating, scaled by difficulty (easy x1, medium x2, hard x3), because a failed submission can be retried freely and punishing it would discourage trying. It updates the same `student_career_elo`, appends a skill-graph snapshot, and triggers a roadmap refresh when the rating crosses a multiple of 50. The role is matched by `arena_domain_roles.role_key = careers.key`.
- Arena's existing separate `arena_skill_ratings` (1200-scale, see `docs/arena-rating-scale-mismatch.md`) is untouched; it is not the career ELO. The weekly *stream* track is not wired to the career ELO.

## Known limits
- Question correctness comes from an LLM plus an independent LLM check; it is much better than a single pass but is not a human review. Bad questions can be switched off with `is_active = false`.
- Taxonomy reads are cached per server process for 60 s.
