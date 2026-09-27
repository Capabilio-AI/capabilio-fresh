# 07 — Example Journeys

Four students, same codebase, same routes, same nav (`lib/nav/config.ts`), same `GET /api/v1/students/{id}/state` shape. Only their `student_journeys` row and the data behind it differ. None of this requires a single `if (year === ...)` in product logic — every difference below flows from Capability/Career phase and evidence, with Academic year only ever setting the *initial* template/cohort at enrollment.

## Student A — Academic 1-1, Full Journey template

- **Enrollment**: `institution_memberships` (`year = '1-1'`), `cohorts.entry_year_semester = '1-1'` → assigned the platform-default **Full Journey** `journey_templates` row.
- **`student_journeys`**: `current_capability_phase = 'discover'`, `current_career_phase = 'explore'` — freshly created, no assessment yet.
- **`GET /state`**: `academicContext.year = '1-1'`; `capabilityState.overall = null` (no `capabilities` rows yet); `careerState.topCareer = null`; `nextBestAction = null`.
- **What the student sees**: Dashboard's `CareerDirectionCard`/`CapabilityCard` render their existing "not enough data yet" empty states (already implemented, unchanged) — pointing at `/assessment`.
- **Nav**: identical `PRIMARY_NAV` as every other student. Launchpad/AI Interview show locked (real check: `isStageUnlocked('1-1', 'experience')` → `false`).
- **First real event**: completes the assessment → `AssessmentCompleted` → `capabilities`/`capability_history` populate → `student_journeys.current_capability_phase` advances to `'foundation'` (first real evidence exists, still below the threshold for `'develop'`).

## Student B — Academic 2-1, Accelerated Journey template, has completed the assessment

- **Enrollment**: entered directly at `2-1` (lateral entry / diploma-to-degree bridge) → `journey_templates` row with `entry_semester = '2-1'`, `config.skipPhasesBefore = 'foundation'`.
- **Capability**: assessment completed in orientation week — `capabilities` shows moderate scores across `quantitative_aptitude`/`programming_fundamentals`, low elsewhere.
- **`matchCareersForStudent()`** (real, unchanged): top match is "Backend Developer" at 42% readiness, `recommendation: 'Explore'`.
- **`student_journeys`**: `current_capability_phase = 'foundation'`, `current_career_phase = 'explore'` — same *labels* as Student A could be at, but reached via a compressed template and with real evidence behind it, not a fresh account.
- **`GET /state`**: `capabilityState.overall ≈ 38`; `nextBestAction` = the largest gap on "Backend Developer" (e.g. `SQL`, current 20 → target 65).
- **Contrast with Student A**: same phase *keys*, different template (`Accelerated` vs `Full`), different evidence. The Journey Engine doesn't need to know or care that B skipped Year 1 — it only reads B's `capabilities` and `student_journeys` row.

## Student C — Academic 3-1, Full Journey template, ahead of a typical 3-1 peer

- **Enrollment**: same Full Journey template as Student A (same cohort, in fact — could be the same student two years later).
- **Capability**: has been active in Arena and completed one project (once `projects`/`project_contributions` are wired) — `capability_history` shows multiple `arena_challenge` and `project` source rows, `confidence: 'high'` on several skills.
- **`student_journeys`**: `current_capability_phase = 'specialize'`, `current_career_phase = 'prepare'` — **ahead of the "typical" 3-1 profile** precisely because phase is evidence-driven, not year-driven. A different 3-1 student in the same cohort who only ever took the initial assessment sits at `capability_phase = 'foundation'` instead — same academic point, different Student State, because the engine never looks at `year` to decide this.
- **Launchpad/Interview lock check**: still gated on `isStageUnlocked(year, 'experience')` today (year-based, per `02-journey-engine.md`'s known gap) — so Student C sees the same locked state as any other 3-1 student even though their *capability* phase is ahead. This is the concrete, present-tense argument for the `02-journey-engine.md` refactor: once the lock check reads `student_journeys.current_career_phase` instead of `year`, Student C unlocks Launchpad/Interview early on merit; a 3-1 student who's behind stays locked despite being "old enough," which is the entire point of §19 ("capability gates, never `student.year >= 3`").

## Student D — Academic 4-1, Career Acceleration Journey template

- **Enrollment**: entered at `3-2`/`4-1` directly onto the **Career Acceleration Journey** (`config.compressed = true`, `config.skipPhasesBefore = 'prepare'`) — e.g. a student who transferred in late or is catching up before placements.
- **`student_journeys`**: `current_capability_phase = 'build'`, `current_career_phase = 'demonstrate'` — reached quickly because the compressed template's phase list is shorter (`journey_phases` for this template skips `discover`/`foundation` phase rows entirely; they don't exist for this template, so there's nothing to "skip" at runtime — the compression is data, not a runtime conditional).
- **`GET /state`**: `journeyState.templateName = 'Career Acceleration Journey'`; `nextBestAction` likely points at a portfolio-facing gap (interview readiness, a missing certification) rather than a foundational skill, because `buildCareerMatch()`'s gap-ranking naturally surfaces whatever the largest remaining gap is — no special-casing needed for "this is a late-stage student."
- **Launchpad**: unlocked (`career_phase` already at `demonstrate`, past the unlock threshold) — sees real opportunity cards with skills-match badges against their actual top career match.
- **Same nav, same dashboard, same `/state` shape as Students A/B/C.** The only things that differ across all four students in this document are: which `journey_templates`/`journey_phases` rows their `student_journeys` points at, and what their own `capabilities`/`evidence`/`career_requirements` diff produces. Nothing in `app/(app)/**` branches on which of these four they are.
