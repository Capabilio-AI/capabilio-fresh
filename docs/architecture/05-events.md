# 05 — Domain Events

## Why events, even inside a monolith

The rule from §22 is about coupling, not transport: `ProjectService` should never reach into `CapabilityService`'s internals to update a score directly, even though both run in the same Next.js process. An event boundary keeps that true regardless of whether the two ever become separate deployments later (see the microservice-extraction note in `08-roadmap.md`).

## Persistence: real, today

`student_journey_events` (new table, `01-domain-model.md`) is the durable event log — append-only, one row per event, `event_type` + `payload jsonb`. This is real, runnable schema, not a design placeholder: it's what `07-example-journeys.md`'s walkthroughs read from, and it's enough on its own to answer "why did this student's journey move" without any additional infrastructure.

## Event catalog

| Event | Emitted when | Consumers (documented here; wiring is phased, see `08-roadmap.md`) |
|---|---|---|
| `StudentRegistered` | Signup completes | Journey (creates default `student_journeys` row from the institution's active template) |
| `AssessmentStarted` / `AssessmentCompleted` | `assessment_attempts.status` → `completed` (already real: `lib/dashboard/data.ts` throws `DashboardNotReadyError` until this happens) | Capability (`computeCapabilitiesForAttempt`, already runs), Journey (advance Capability phase from `discover`), Notification |
| `CapabilitySnapshotCreated` | A `capability_history` row is inserted (already happens on every assessment/reassessment) | Career (recompute `matchCareersForStudent`), Journey |
| `CareerTargetSelected` | Student sets a primary target career | Journey (advance Career phase to `target`), Guide Path (generate) |
| `SkillGapDetected` | A `buildCareerMatch()` call surfaces a gap > 0 on the primary target | Notification (`lib/notifications/derive.ts` already does this synchronously — an event-based version would let it react to other students' gap changes too, not needed yet) |
| `JourneyGenerated` | `student_journeys` row created or its phase changes | Notification, Analytics |
| `LearningCompleted` | (No producer yet — SkillStudio has no completion tracking) | Capability, Evidence, Journey |
| `PracticeCompleted` | Arena challenge finishes (`POST /api/arena/[attemptId]/finish`, already real) | Capability, Evidence, ELO |
| `ProjectCreated` / `ProjectSubmitted` / `ProjectEvaluated` | New `projects`/`project_contributions`/`mentor_evaluations` writes | Evidence, Capability, Portfolio |
| `EvidenceCreated` | New `evidence` row | Capability, Portfolio, Journey |
| `CapabilityUpdated` | `capabilities` row changes | Career, Journey, Portfolio |
| `ArenaChallengeCompleted` | Same as `PracticeCompleted`, Arena-specific naming per §22 | ELO, Evidence |
| `ELOUpdated` | `arena_ratings` changes (already happens) | Portfolio |
| `PortfolioUpdated` | Any of the above that touch verified evidence | (nothing consumes this yet — Portfolio is read-on-demand today, not pre-computed) |
| `OpportunityRecommended` | A Launchpad match crosses a relevance threshold | Notification |

Example chain from §22, annotated with what's real vs. designed:

```
AssessmentCompleted           [real: assessment submit flow]
  → CapabilityService         [real: computeCapabilitiesForAttempt]
  → CareerService              [real: matchCareersForStudent, called synchronously today]
  → SkillGapService             [real: buildCareerMatch]
  → JourneyService                [new: advance capability/career phase]
  → NotificationService              [real: lib/notifications/derive.ts, synchronous today]
  → AnalyticsService                    [doc-only: no analytics module exists]
```

## Implementation shape (documented contract, not built this pass)

```ts
// lib/events/bus.ts (proposed — not implemented in this pass; see 08-roadmap.md)
export interface DomainEvent<T = unknown> {
  type: string
  studentId: string
  payload: T
  occurredAt: string
}

export function publish<T>(event: DomainEvent<T>): Promise<void> {
  // 1. Insert into student_journey_events (durable log — this part IS real
  //    once wired, since the table exists today)
  // 2. Fan out in-process to registered handlers (module boundary, not a
  //    queue — this is a modular monolith, not a distributed system)
}

export function subscribe<T>(type: string, handler: (event: DomainEvent<T>) => Promise<void>): void
```

**Why this is documented but not implemented now:** the brief's required code deliverables are the schema and the `/state` endpoint stub (§26), both of which are real and runnable in this pass. A pub/sub module with zero real subscribers yet would be exactly the kind of "purely abstract" scaffolding §27 warns against ("do not produce a purely abstract document if the schema and endpoint stub are achievable" — the inverse also holds: don't build unused abstraction where a document suffices). `08-roadmap.md`'s Phase 1 is explicit that `lib/events/bus.ts` gets built **alongside its first real subscriber** (Journey Engine reacting to `AssessmentCompleted`), not before.
