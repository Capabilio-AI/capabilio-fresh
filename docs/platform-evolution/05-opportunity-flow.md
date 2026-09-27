# Opportunity Flow

```
company → opportunity → requirements → matching → student discovery
   → application → interview → hiring → professional profile
```

## What's real, schema-only, or unbuilt at each step

| Step | State this pass |
|---|---|
| Company creates an opportunity | Schema exists (`opportunities`, `recruiters`, prior session's migration). No authoring UI, no route. |
| Requirements (skills/capabilities/experience/eligibility) | `opportunities.skills` (jsonb) exists; no normalized `opportunity_requirements` table yet (the brief's §13 names one — deferred to Phase 3 alongside the matching engine that would actually read it, rather than modeled speculatively now) |
| Matching engine | **Not built.** This is the single largest piece of net-new logic in the whole brief — deterministic, explainable (eligible/not, capability match, evidence strength, missing requirements, plain-language explanation, never an unexplained AI percentage per §8). Building it against schema-only opportunities with zero real postings would produce untestable code; Phase 3 builds it once there's at least a handful of real opportunities to match against. |
| Student discovery | `lib/mock/launchpad.ts` still backs `/launchpad` — unchanged this pass |
| Application | `applications` table exists; no submit flow |
| Interview | Not modeled at all yet — no `interviews` table exists in any migration so far. Added to the domain model as a Phase-3 item, not invented speculatively here |
| Hiring → professional profile | This is the `professional_context` row creation described in `04-user-journeys.md`'s "Recent graduate" case — schema ready, no automated trigger (a hire is presumably a company-admin action, which doesn't exist yet either) |

## Why this isn't further along after this pass

The brief itself names the hard requirement: *"this continuity across graduation is a hard requirement, not a nice-to-have."* Continuity requires the schema (Person stays one identity, `professional_context` attaches to the same `user_id`) — that's what this pass delivers. The *flow* (a real company posting a real job, a real match, a real application, a real hire event) requires building an entire two-sided marketplace feature (recruiter auth, opportunity CRUD, a deterministic matching algorithm, an application pipeline, interview scheduling) that doesn't share much surface area with Phase 1's identity/security foundation — attempting it in the same pass would mean shipping either a half-built matching engine or a fully-mocked one dressed up as real, both of which the brief explicitly forbids reporting as complete. `08-roadmap.md`'s Phase 3 is this flow, sized on its own.
