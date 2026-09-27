# 04 — API Surface

## Namespace decision

The brief asks for everything under `/api/v1/`. This repo's existing 21 route handlers are unversioned (`/api/arena/...`, `/api/assessment/...`, etc.) and are working, tested-by-use production code. Renaming them is a breaking change to every client call site (`fetch("/api/...")` calls throughout `components/**`) for zero functional benefit today, and explicitly against §27 ("do not... break existing working functionality").

**Decision:** new Career-OS-domain endpoints (Journey, Plan B, Projects, Mentor Evaluations, the `/state` aggregate) are built under `/api/v1/*` from the start. Existing endpoints stay where they are. `08-roadmap.md` includes an explicit (opt-in, non-urgent) phase for migrating old routes to `/api/v1/*` with redirects, once there's a real second consumer (mobile app, college admin tooling) that benefits from a stable versioned contract — not before.

## Endpoint inventory

`[existing]` = already implemented and working. `[new]` = added by this work (schema + code where noted). `[doc-only]` = designed here, not implemented this pass (see `08-roadmap.md` for why).

| Brief namespace | This repo | Status |
|---|---|---|
| `auth` | Supabase Auth directly (`app/login`, `app/signup`, `app/auth/confirm`) | `[existing]` |
| `students` / `academic-context` | `institution_memberships`, read via `lib/dashboard/viewer.ts` | `[existing]`, no dedicated route (server-component direct read) |
| `assessments` | `/api/assessment/start`, `/[section]/questions`, `/[section]/submit`, `/[section]/responses`, `/[section]/coding-submit`, `/career-interests`, `/progress` | `[existing]` |
| `capabilities` | `/api/capability/history`, `/api/capability/evidence` | `[existing]` |
| `careers` | `/api/career-matches` | `[existing]` |
| `guide-path` | `/api/guide-path`, `/api/guide-path/generate` | `[existing]` |
| `arena` | `/api/arena/start`, `/[attemptId]/answer`, `/[attemptId]/finish`, `/leaderboard` | `[existing]` |
| `evidence` | `/api/capability/evidence` (existing, narrow) + `evidence` table (new) | `[existing]` + `[new schema]` |
| `elo` | `arena_ratings` via `/api/arena/leaderboard` | `[existing]`, not yet per-skill (see `03-capability-graph.md`) |
| `tenants` / `colleges` / `programs` | none yet — `institutions` read inline in server components | `[new schema]`, `[doc-only]` route (no admin UI to author programs/departments/cohorts yet) |
| `journeys` / `guide-path` recalculation | none yet | `[new schema]`, `[doc-only]` beyond the `/state` endpoint below |
| `plan-b` | none yet | `[new schema]`, `[doc-only]` |
| `projects` / `teams` | none yet | `[new schema]`, `[doc-only]` |
| `mentors` / `evaluations` | none yet | `[new schema]`, `[doc-only]` |
| `curriculum` / `learning` | none yet (SkillStudio pages read `lib/mock/skillstudio.ts`) | not modeled this pass — no real content-authoring surface exists to back it |
| `opportunities` | Launchpad reads `lib/mock/launchpad.ts` | `[new schema]` (`opportunities`/`applications`/`recruiters`), route not implemented this pass |
| `notifications` | `lib/notifications/derive.ts` (derived, not stored) | `[existing]`, deliberately not a stored feed (see that module's own comments) |
| `analytics` | none | `[doc-only]` — college dashboard (§24) is unbuilt |
| `ai` | `lib/ai/groq.ts` direct calls | `[existing]`, gateway consolidation is `[doc-only]` (see `03-capability-graph.md`) |
| `students/{id}/state` | `app/api/v1/students/[studentId]/state/route.ts` | **`[new, implemented]`** — see below |

## `GET /api/v1/students/{studentId}/state`

The one endpoint the brief asks to see running, not just described. Implemented at `app/api/v1/students/[studentId]/state/route.ts`, wired to real data:

```ts
type StudentStateResponse = {
  studentId: string
  academicContext: {
    institutionId: string | null
    institutionName: string | null
    branch: string | null
    year: string | null          // "<year>-<semester>", e.g. "3-2"
  }
  capabilityState: {
    overall: number | null       // average across domains, null if no data
    dimensions: { domain: string; score: number }[]
  }
  careerState: {
    topCareer: string | null
    readiness: number | null     // 0-100, from buildCareerMatch — never a hiring prediction
    recommendation: "Ready" | "Explore" | "Long-term pathway" | null
  }
  journeyState: {
    templateName: string | null
    capabilityPhase: string
    careerPhase: string
    academicPhaseIndex: number    // from lib/journey/stage.ts, until split per 02-journey-engine.md
  }
  currentFocus: string | null     // = nextBestAction.skill, kept as a separate friendly field
  nextBestAction: {
    skill: string
    why: string
    currentLevel: number | null
    targetLevel: number
    estimatedWeeks: number
  } | null
  skillGaps: { skill: string; current: number | null; required: number; gap: number }[]
  recentEvidence: { skill: string; score: number; source: string; recordedAt: string }[]
  readiness: number | null        // duplicate of careerState.readiness at top level, per the brief's exact shape
}
```

Data sources, all real:

| Field | Source |
|---|---|
| `academicContext` | `getViewerSummary()` (existing) |
| `capabilityState` | `getSkills()` (existing) aggregated by domain, same logic as `components/dashboard/CapabilityCard.tsx` |
| `careerState`, `skillGaps`, `nextBestAction` | `matchCareersForStudent()` + `computeNextAction()` (existing) |
| `journeyState` | `lib/journey/stage.ts`'s `currentStageIndex()` today; swapped for real `student_journeys` reads once `02-journey-engine.md`'s split lands — the endpoint already returns the shape that change needs, so callers don't have to change again |
| `recentEvidence` | `capability_history`, most recent 10 rows |

## Authorization

Self-access (`studentId === auth.uid()`) is always allowed. Cross-student access requires the caller to hold a **staff role** (`faculty \| hod \| principal \| vice_principal \| ceo \| mentor`) in `institution_memberships` for the **same `institution_id`** as the target student, with `status = 'active'` — otherwise `403`. This is the first place in the repo that actually reads `institution_memberships.role`/`.status` for authorization (see `06-security.md` — until now these columns existed but nothing enforced them).
