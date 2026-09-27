# 00 — Overview & Stack Reconciliation

## §0: what's actually running

This document set is scoped to **this repository (`Capabilio-fresh`)**, confirmed directly against the code rather than assumed. Two other Capabilio codebases exist on this machine (`capabilio-web`, an Express + Vite monorepo with its own Supabase project; `Capabilio-new`, a fork of it) — they are **separate products with separate databases** and are out of scope here. If this architecture is ever meant to also apply to those, that's a distinct exercise against their own (much larger) codebases.

**Confirmed stack, this repo:**

| Layer | What's actually here |
|---|---|
| Framework | Next.js 16.3.5, App Router, React 19, TypeScript (strict), Tailwind v4 |
| "Backend" | Next.js Route Handlers under `app/api/**` — there is no separate Express/Node server, no Java, no Spring Boot anywhere in this repo |
| Database | Supabase (Postgres). No Firestore, no partial migration — one consistent store since this repo's first commit |
| Auth | Supabase Auth via `@supabase/ssr`, cookie-based sessions (`lib/supabase/server.ts`, `lib/supabase/client.ts`) |
| AI | Groq (`lib/ai/groq.ts`), called directly by a handful of modules — not yet routed through a single gateway (see `03-capability-graph.md` and `08-roadmap.md`) |
| Deployment | Vercel-oriented (Next.js conventions throughout); no `vercel.json` present, standard zero-config deploy |

**The brief assumed Next.js + Java/Spring Boot + PostgreSQL.** The Postgres part is right (via Supabase); Java/Spring Boot is not present and was not silently introduced. Per your decision, this architecture is a **retrofit onto the existing Next.js + Supabase stack**, not a migration:

- Module boundaries stay as TypeScript modules under `lib/<domain>/`, one bounded context per domain (already the repo's convention — see `21-module-boundaries` mapping in `08-roadmap.md`).
- The "API surface" is Next.js Route Handlers (`app/api/v1/.../route.ts`), which play the role Express routes or Spring controllers would.
- No language migration, no new runtime, no new database.

## The one rule, and where the repo already breaks it

> Never branch product logic on academic year.

`lib/journey/stage.ts` (added this session, for dashboard/launchpad/interview lock states) currently **does** derive a single stage index from `institution_memberships.year` alone. It's a reasonable seed — the phase list (`Discover → Develop → Build → Specialize → Experience → Prove → Launch`) already matches the brief's Capability-axis language — but it conflates academic year with capability/career progress. `02-journey-engine.md` specifies how this gets split into three independent axes without breaking the existing lock checks that already call it (`isStageUnlocked`).

## Document map

| Doc | Covers |
|---|---|
| `01-domain-model.md` | Full ER model — existing tables kept as-is, new tables additive. PKs/FKs/tenant boundaries/indexes. |
| `02-journey-engine.md` | Student State computation, the three independent axes, Journey Templates, Next Best Action. |
| `03-capability-graph.md` | Capability Graph, Assessment baseline, Career Intelligence, Skill Gap — mapped to real existing code. |
| `04-api-surface.md` | `/api/v1/*` surface, endpoint-by-endpoint, existing-vs-new. |
| `05-events.md` | Domain event catalog and how it's persisted/consumed in a modular monolith. |
| `06-security.md` | RBAC (already schema-real, not yet enforced), tenant isolation, RLS patterns. |
| `07-example-journeys.md` | Four concrete students (1-1, 2-1, 3-1, 4-1) through the identical codebase. |
| `08-roadmap.md` | Phased plan, new-vs-existing ledger, microservice-extraction note, risks. |

## What's genuinely surprising and good news

Large parts of the Capability/Career domain the brief describes **already exist, correctly modeled, in this repo** — this is a retrofit in the true sense, not a rewrite:

- `capabilities` + `capability_history` (with a real `capability_evidence_source` enum: `initial_assessment | reassessment | learning_module | project | arena_challenge`) is already exactly the brief's `CapabilitySnapshot` / `CapabilityHistory` — including evidence-source provenance and confidence, for source types that don't even have a producing feature yet (`learning_module`, `project`).
- `career_requirements` (career → required skill levels) + `lib/career/skill-gap.ts`'s `buildCareerMatch()` is already a real, deterministic Skill Gap engine — no AI in the loop for the numbers, exactly per the brief's Career Intelligence principle.
- `interests` / `career_interest_target` already keep interest and capability as **separate signals**, matched together in `lib/career/match.ts`.
- `guide_paths` + `lib/guide-path/generate.ts` is already a real (AI-assisted, deterministically-scored) Guide Path generator — just not yet auto-triggered on every event (§9); today it's a manual "Generate/Regenerate" action.
- `institution_memberships.role` (`app_role` enum: `student | faculty | hod | principal | vice_principal | ceo | mentor | professional`) and `.status` (`pending | active | revoked`) **already exist in the schema**, including a `role_requires_verification` RPC — but no route or page in this repo checks them yet. RBAC enforcement is a wiring gap, not a modeling gap.

The genuinely missing pieces are: the Journey Engine itself (multi-axis, template-driven), Plan B as an entity, Project/Team/Mentor-evaluation, a first-class Evidence table linking snapshots to specific source records, and the college hierarchy above `institutions` (Program/Department/Cohort). All are additive in `supabase/migrations/20260927000000_career_os_foundations.sql`.
