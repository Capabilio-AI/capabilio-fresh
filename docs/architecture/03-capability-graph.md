# 03 — Capability Graph

## The shift this replaces

`Student → Course → Completion` becomes:

```
Student → Capability Graph → { Skills, Competencies, Evidence, Projects,
                                Challenges, Evaluations, Mentor Feedback,
                                Career Requirements }
```

This repo never had a course-completion model to begin with (there's no LMS/course table anywhere), so there's no legacy to migrate away from — the graph can be built directly. What already exists maps like this:

| Graph concept | Real table/module today |
|---|---|
| Skills | `skills` (new catalog) + free-text `capabilities.skill` |
| Current capability | `capabilities` (`capability_score`, `confidence`, `data_points`) |
| Capability history | `capability_history` (per-skill snapshots over time, sourced) |
| Evidence | `capability_history.source`, new `evidence`, `vault_items` |
| Projects | new `projects` / `project_contributions` |
| Challenges | `arena_challenge_attempts`, `arena_ratings` |
| Evaluations | new `mentor_evaluations` |
| Career Requirements | `career_requirements.requirements` (jsonb skill→level) |

The graph's core question — *what can this student do, how strong is it, what evidence supports it, what does the target career need, what's the gap, what next* — is already answerable end-to-end for the "current capability" and "career requirement" halves via existing code:

- **What can they do / how strong**: `lib/dashboard/data.ts`'s `getSkills()` reads `capabilities` directly.
- **What does the target career need / what's the gap**: `lib/career/skill-gap.ts`'s `computeSkillGaps()` and `buildCareerMatch()` — pure, deterministic, already in production use on the dashboard.
- **What next**: `lib/dashboard/next-action.ts`'s `computeNextAction()`.
- **What evidence supports it**: partially — `capability_history.source` tells you *what kind* of evidence (assessment/learning/project/arena), but not *which specific* project or arena attempt. That's exactly the gap the new `evidence` table closes (`source_type` + `source_id`).

## Assessment & Capability Baseline (§7)

Already real and correctly modeled, not a single score:

- `lib/assessment/sections.ts` defines six real sections (`quantitative_aptitude`, `logical_reasoning`, `verbal_communication`, `programming_fundamentals`, `engineering_mathematics`, `basic_sciences`) plus `career_interests` as a **separate, seventh, non-assessment signal** — this already matches the brief's instruction to treat Career Interests as a discovery signal, not one of the graded sections (enforced in the dashboard UI this session: `components/dashboard/AssessmentResults.tsx` explicitly filters `career_interests` out of the graded section grid).
- `lib/capability/compute.ts`'s `computeCapabilitiesForAttempt()` maps every answered question to a `skill` + `domain` (via `question_bank`), tallies correct/total per skill, and writes both `capabilities` (current) and `capability_history` (one row per skill, `source: 'initial_assessment'`) — a real baseline snapshot with confidence (`confidenceFor()`: low/medium/high by data-point count, never treating a 1-2-question skill as certain) and a timestamp. Re-assessment is already a distinct enum value (`reassessment`) waiting for a producing flow.

## Career Intelligence (§8)

Capability and Interest are already separate signals, never merged into one number:

- `capabilities` = what they can do (assessment/practice/project-derived).
- `interests` / `career_interest_target` = what they want to explore (from the dedicated `career_interests` assessment section).
- `lib/career/match.ts`'s `matchCareersForStudent()` combines both explicitly: `buildCareerMatch(careerRole, requirements, capabilities, interestLevel)` takes interest as a **separate parameter** from the capability array — a high-interest/low-capability career still surfaces (as `"Long-term pathway"`, not silently dropped), matching the brief's "high interest + low capability → long-term path, not elimination" rule exactly.
- The Career Skill Model is `career_requirements.requirements` (skill → required level, jsonb). It's denormalized rather than a `CareerSkillRequirement(skill_id, required_level)` join table — see `01-domain-model.md` for why that's a deliberate phase-2 item, not a gap in this pass.

## ELO (§14)

`arena_ratings` stores one global ELO number per student, updated by `lib/arena/data.ts` + the Arena challenge-finish flow. This does **not** yet satisfy "ELO is one input among several, stored per skill alongside capability/evidence" — today it's a single cross-skill number, disconnected from `capabilities`. The new `evidence` table's `source_type = 'arena_challenge'` rows (once Arena writes them) are the intended bridge: each Arena attempt becomes an evidence row against the *specific skill(s)* that challenge exercised, with `capability_delta`, closing the "ELO as one signal, not identity" gap without redesigning the existing rating system. Flagged as a real gap in `08-roadmap.md`, not silently declared solved.

## AI Gateway (§17)

Not yet centralized. Today, three call sites import `lib/ai/groq.ts` directly:

- `lib/guide-path/generate.ts` (guide path narrative — via `completeJson()`, schema-validated)
- `lib/question-bank/generate.ts` (assessment question generation — via `completeJson()`)
- `app/api/mentor/chat/route.ts` (AI Mentor — free-text chat, direct `groq.chat.completions.create()` call)

All three already follow the brief's deeper rule even without a formal gateway module: **every score, skill gap, and recommendation number comes from deterministic code** (`buildCareerMatch`, `computeSkillGaps`, `computeCapabilitiesForAttempt`); AI is only ever used for *narrative/interpretation* layered on top of numbers that are already computed and handed to it as fixed facts (see `lib/guide-path/generate.ts`'s system prompt: "you must NOT invent or alter these numbers"; `app/api/mentor/chat/route.ts`'s system prompt: "never invent scores... ground every suggestion in the real data given below"). The gateway itself — a single `lib/ai/gateway.ts` that all three route through, so rate limiting, model selection, and logging live in one place instead of three — is a mechanical extraction, not a behavior change, and is sequenced in `08-roadmap.md` rather than done speculatively here (YAGNI: three call sites doing the same safe thing correctly isn't yet a maintenance problem; a fourth or fifth AI call site would tip it into one).
