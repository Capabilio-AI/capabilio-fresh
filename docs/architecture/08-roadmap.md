# 08 — Roadmap

## Phased implementation order

**Phase 0 (done, this pass):** schema (`supabase/migrations/20260927000000_career_os_foundations.sql`, not yet applied), `GET /api/v1/students/{id}/state` stub wired to real data, this doc set.

**Phase 1 — Journey Engine core (highest priority: it's the one architectural rule everything else depends on).**
1. Apply the migration to a Supabase branch/staging project first; verify RLS policies with a real second test account before touching production (see `06-security.md`).
2. Seed one `journey_templates` row per named template (`Full`/`Accelerated`/`Career Acceleration`/`Placement`) with `institution_id = null` (platform defaults), plus their `journey_phases`.
3. Split `lib/journey/stage.ts` per `02-journey-engine.md`: extract `computeAcademicPhase` (kept, year-based, curriculum-only) from new `computeCapabilityPhase`/`computeCareerPhase` (evidence-based). Update `isStageUnlocked` callers (`app/(app)/launchpad/page.tsx`, `app/(app)/interview/page.tsx`) to read the new career-phase function instead of raw `year`. **Why first:** every other phase's "what should this student see" logic depends on this being right; getting it wrong compounds into the college dashboard and recruiter search phases with escaped year-based logic no one meant to write.
4. Auto-create a `student_journeys` row on `StudentRegistered` (signup completion) — the first real event producer.
5. Build `lib/events/bus.ts` **alongside** this one subscriber, per `05-events.md` — not before, not as standalone scaffolding.

**Phase 2 — Evidence unification.**
Wire `evidence` table writes into the existing Arena finish flow (`ArenaChallengeCompleted` → one `evidence` row per skill the challenge exercised) and the assessment submit flow (`AssessmentCompleted` already writes `capability_history`; add the parallel `evidence` row with `source_id` pointing at the `assessment_attempts` row). This is the smallest phase and unlocks real Portfolio/`recentEvidence` data with no new UI.

**Phase 3 — Project Lab.**
`projects`/`project_members`/`project_milestones`/`project_contributions` need a real authoring UI (currently: none — Arena's "Projects" tab is `lib/mock/arena.ts`). Build the minimal mentor-assigns-project / student-logs-contribution flow; this is genuinely new product surface, not a retrofit, and is the largest phase.

**Phase 4 — College hierarchy + admin surface.**
`programs`/`departments`/`cohorts` exist in schema from Phase 0; nothing authors them yet. A College Admin role (`institution_memberships.role = 'principal' | 'vice_principal' | 'hod'`, `status = 'active'`) needs a real dashboard to create programs/departments/cohorts and assign `journey_templates` per cohort. This is also where RBAC enforcement (`06-security.md`) stops being "modeled but unused" and starts mattering.

**Phase 5 — Plan B UI, Mentor Marketplace surface, Opportunities authoring, Recruiter search.**
Schema exists (Phase 0); each needs its own UI and is independently shippable in any order after Phase 1. Lowest priority relative to the others because none of them block the core "prove your skills, not claim them" loop.

## New vs. existing — the honest ledger

| Area | Verdict |
|---|---|
| Assessment engine, capability baseline, capability history | **Exists**, correctly modeled, extend only |
| Career matching, skill gap computation | **Exists**, deterministic, extend only |
| Guide Path generation | **Exists**, needs auto-trigger wiring (Phase 1/2), not a rewrite |
| Next Best Action | **Exists** (single-recommendation, reasoned), needs more inputs (Phase 1) |
| RBAC roles/status | **Exists in schema**, zero enforcement anywhere — Phase 4 |
| Multi-tenant institution model | **Exists** (`institutions`), needs the Program/Department/Cohort layer — Phase 0 schema done, Phase 4 UI |
| Journey Engine (multi-axis, template-driven) | **Genuinely new** — Phase 1 |
| Evidence (as a first-class, source-linked object) | **Genuinely new** — Phase 2 |
| Project Lab | **Genuinely new** — Phase 3 |
| Plan B as an entity | **Genuinely new** — Phase 5 |
| Mentor evaluations | **Genuinely new** — Phase 5 |
| Opportunities/Recruiter/Applications | **Genuinely new**, minimal first pass — Phase 5 |
| AI Gateway | **Exists in spirit** (deterministic-first discipline already followed by all 3 call sites), not yet a single module — cheap extraction, anytime after Phase 1 |
| Domain events | **Table exists** (Phase 0), **bus doesn't** — built with its first subscriber, Phase 1 |

## Microservice-extraction note

**Staying as one modular monolith for now** — confirmed, not silently assumed. If/when extraction becomes worth the operational cost, the natural first candidates, in likely order, are:

1. **Assessment/Question-Bank generation** — already isolated behind `lib/question-bank/generate.ts` + `lib/ai/groq.ts`, CPU/latency profile (AI calls, retries) very different from the rest of the app; easiest to peel off first since it's already nearly stateless from the rest of the domain's perspective.
2. **Arena** — has its own tight request/response loop (timed challenges, per-second client state) and its own rating system; a natural boundary if Arena ever needs different scaling (e.g., WebSocket-based live challenges) than the rest of the app.
3. **AI Gateway** — once centralized (see above), a single chokepoint for all LLM traffic is also the single easiest thing to extract into its own deployable, for rate-limiting/cost-control reasons independent of anything architectural.
4. **Capability/Journey** — the core domain logic; extract last, if ever, since splitting it prematurely would recreate exactly the cross-module network-call coupling the event-driven design in `05-events.md` is meant to avoid paying for until there's a real reason to.

None of this is scheduled. It's here because the brief asked for the note, and because the module boundaries in this doc set (`lib/<domain>/`, one bounded context each, communicating through the event catalog rather than reaching into each other's internals) are deliberately chosen so that this extraction, if it ever happens, is a deployment change, not a rewrite.

## Known risks & tradeoffs

- **RLS policies in the new migration are unexecuted.** No local Postgres/Docker was available in this session to dry-run them (see the migration file's own note). They're syntactically reviewed but must be applied to a staging/branch project and verified with a second real test account (cross-tenant read attempt should fail) before touching production. This is the single highest-risk item in this deliverable.
- **`career_requirements.requirements` staying denormalized** means the new `skills` catalog and `career_requirements` don't share a foreign key yet — two sources of truth for skill names that must be kept in sync by convention (exact string match) until Phase-2 normalization. Low risk today (few career roles, few skills), grows with catalog size.
- **The Journey Engine's phase-advancement rules** (`02-journey-engine.md`: what evidence threshold moves a student from `foundation` to `develop`) are specified conceptually but not as a concrete scoring formula in this pass — that formula needs product input (what counts as "enough" evidence per phase), not just an engineering decision, and is called out rather than guessed at.
- **`isStageUnlocked` still reads `year` today.** Until Phase 1's split lands, Launchpad/AI Interview lock state is still exactly the year-based check `02-journey-engine.md` and `07-example-journeys.md` (Student C) both flag as the one place the codebase currently breaks its own rule. Not fixed in this pass because it requires the Journey Engine (Phase 1) to exist first — fixing the symptom without the underlying engine would just move the hardcoded year check into a differently-shaped hardcoded check.
- **No consent/audit table.** Deferred per `06-security.md` until a real recruiter/admin surface creates an actual "who viewed this student's data" requirement — building it speculatively now risks guessing the wrong shape.
