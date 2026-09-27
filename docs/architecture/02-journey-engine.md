# 02 — Journey Engine

## Student State

```
Student State = Academic Context + Current Capability + Career Intent
                + Evidence + Time Remaining + College Configuration
              ↓
        Journey Engine
              ↓
      Personalized Journey + Next Best Action
```

Concretely, in this codebase, each input already has a real source:

| Input | Source (this repo) |
|---|---|
| Academic Context | `institution_memberships` (`branch`, `year`, new `cohort_id`) |
| Current Capability | `capabilities` (current), `capability_history` (trend) |
| Career Intent | `interests`, `career_interest_target`, `lib/career/match.ts` output |
| Evidence | `capability_history.source`, new `evidence`, `vault_items`, (future) `project_contributions`, `mentor_evaluations` |
| Time Remaining | Derived: `cohort.graduation_year_semester` (or `institution_memberships.year` if no cohort yet) minus current semester |
| College Configuration | New `journey_templates.config`, scoped by `institutions.id` (null = platform default) |

The Journey Engine is the pure function that turns this bundle into a phase + a single Next Best Action. It is **not** a service that owns state — `student_journeys` (new table) holds the state; the engine recomputes it.

## The one rule, enforced structurally

Academic semester is **one field** in the Student State input, with equal standing to capability, career intent, and evidence — never a branch condition. Concretely: no code path may do `if (year >= 3) { ... }` to decide product logic (locking, navigation, content). The existing `isStageUnlocked(year, stageKey)` in `lib/journey/stage.ts` is the one place in the current codebase that comes close to violating this — it works, but conflates "stage" (should be capability+career derived) with "year" (should only ever gate the *academic* axis, e.g. curriculum sequencing, never product features). The fix, sequenced in `08-roadmap.md`, is:

1. Keep `lib/journey/stage.ts`'s phase list and lock-check *shape* (it already matches `Discover → Develop → Build → Specialize → Experience → Prove → Launch`).
2. Split it into `computeAcademicPhase(institutionMembership)` (year-derived, used only for curriculum sequencing / cohort defaults) and `computeCapabilityPhase(capabilities, evidence)` / `computeCareerPhase(careerMatch, guidePath)` (evidence-derived, used for Launchpad/Interview locks and all product navigation state).
3. `student_journeys.current_capability_phase` / `current_career_phase` become the source of truth Launchpad/Interview/SkillStudio read, not `institution_memberships.year` directly.

## Three independent axes

```
Academic:    1-1 → 1-2 → 2-1 → 2-2 → 3-1 → 3-2 → 4-1 → 4-2
Capability:  Discover → Foundation → Develop → Specialize → Build → Prove
Career:      Explore → Target → Prepare → Demonstrate → Apply → Opportunity
```

Stored as `journey_phases` rows (`axis = 'capability' | 'career'`, `key`, `sequence`) per `journey_templates` row. A student at Academic `3-1` can independently sit at Capability `Foundation` + Career `Explore`, while a classmate at the same Academic point sits at Capability `Specialize` + Career `Prepare` — both are just two different `student_journeys` rows against the same `journey_templates` row; nothing in the schema or the engine forces them to move together. Concrete walkthroughs in `07-example-journeys.md`.

## College Configuration & Journey Templates

`journey_templates` is the configuration surface (§4 of the brief):

```jsonc
// journey_templates.config
{
  "capabilityPhaseKeys": ["discover", "foundation", "develop", "specialize", "build", "prove"],
  "careerPhaseKeys": ["explore", "target", "prepare", "demonstrate", "apply", "opportunity"],
  "compressed": false,          // true for Career Acceleration / Placement templates
  "skipPhasesBefore": null      // e.g. "prepare" for a template entering at 3-2/4-1
}
```

Four named templates from the brief map directly onto rows, not code branches:

| Template | `entry_semester` | `config.compressed` | `config.skipPhasesBefore` |
|---|---|---|---|
| Full Journey | `1-1` | `false` | `null` |
| Accelerated Journey | `2-1` | `false` | `"foundation"` |
| Career Acceleration Journey | `3-2` | `true` | `"prepare"` |
| Placement Journey | `4-1` | `true` | `"demonstrate"` |

A college admin creating a new template is an insert into `journey_templates` + `journey_phases` — no deploy required. A college that does nothing gets the platform-default template (`institution_id is null`).

## Recalculation

Per §9, the Guide Path (and the phases it implies) must recalculate after every meaningful event, not sit as a fixed plan. The existing `POST /api/guide-path/generate` already does real, on-demand recalculation (deterministic skill-gap diffing + AI-sequenced narrative) — the gap is that today a **student** has to click "Generate/Regenerate." The Journey Engine's job going forward is to be the thing that decides *when* to call that same generator automatically, triggered by `student_journey_events` rows: `LearningCompleted`, `PracticeCompleted` (Arena), `ProjectEvaluated`, `AssessmentCompleted`, `CapabilityUpdated`, `EvidenceCreated` (see `05-events.md`). This is additive scheduling logic on top of the existing generator, not a rewrite of it.

## Next Best Action

Already partially real: `lib/dashboard/next-action.ts`'s `computeNextAction(topCareerMatch)` picks the single largest skill gap on the student's top career match — a genuine, deterministic "one recommendation, not five" implementation of §9's rule. What it's missing against the full brief: it only looks at skill gaps, not yet at journey phase, time remaining, prerequisites, or college calendar. The upgrade path is additive — `computeNextAction` gains more inputs (`journeyPhase`, `timeRemaining`, `prerequisites`) and a widened, still-single-recommendation return type; existing callers (`app/(app)/dashboard/page.tsx`, `app/api/mentor/chat/route.ts`, `lib/notifications/derive.ts`) keep working unchanged since the function's core contract (one recommendation with a stated reason) doesn't change.
