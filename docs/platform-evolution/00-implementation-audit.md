# Implementation Audit — Capabilio → Capability Operating System

Written before any large change, per the brief's own requirement. Everything below was re-verified directly against the running repo and the live Supabase project (`gudsoflidkkmtnxvzicw`, via direct SQL introspection — not generated types alone) as of 2026-09-27, not recalled from memory.

## A. Existing architecture

Full detail in `docs/audit/2026-09-27-full-audit.md`. Summary relevant to this evolution:

- **Stack**: Next.js 16 App Router + Route Handlers, Supabase (Auth/Postgres/SSR), Groq, Zod. No Express, no separate backend service, no Firestore.
- **Scale, confirmed live**: `institutions` has **16,282 rows** (a real seeded AICTE/UGC-style college directory — not a toy table). `profiles`/`institution_memberships` have **3 rows** — real but very early usage. `question_bank` 141 rows, `assessment_responses` 320 rows — the assessment engine has genuinely been used.
- **A finding not visible from source alone**: signup does not create `institution_memberships` rows from application code. `auth.signUp()` passes `college_name`/`branch`/`year`/`role` through Supabase Auth's `raw_user_meta_data`; a Postgres trigger (`on_auth_user_created` → `handle_new_user()`) reads that metadata, inserts into `profiles`, and — if a college name was given — calls `get_or_create_institution()` (a `SECURITY DEFINER` function, fuzzy-matches by name, creates if missing) and inserts the `institution_memberships` row. A second function, `get_or_start_section()`, joins `institution_memberships`/`institutions` to filter `question_bank` by the student's `college_type`/`branch` — this is live, production-critical logic. **All three functions live only in the database**, not as version-controlled SQL in this repo, until this pass's migrations capture them.
- **RBAC**: `app_role` enum (`student, faculty, hod, principal, vice_principal, ceo, mentor, professional`) and `membership_status` (`pending, active, revoked`) exist on `institution_memberships`/`profiles.primary_role`. Confirmed again this session: **zero application code reads `.role` or `.status` for authorization** except the one endpoint built last session (`/api/v1/students/[studentId]/state`).
- **Capability/Evidence domain**: `capabilities`, `capability_history` (with a real `capability_evidence_source` enum: `initial_assessment/reassessment/learning_module/project/arena_challenge`), `career_requirements`, `interests`/`career_interest_target`, `guide_paths` — all real, deterministic where it matters (scores), AI only for narrative.
- **Mock surfaces** (unchanged since last audit): Arena Projects/Competitions, SkillStudio catalogs, Launchpad opportunities, Pulse trending/follows/communities — all isolated under `lib/mock/`.
- **Zero tests, zero lint, zero CI.**

## B. Target architecture

```
                              CAPABILIO
                                  │
              ┌───────────────────┼────────────────────┐
           PEOPLE            ORGANISATIONS          OPPORTUNITIES
              └───────────────────┴────────────────────┘
                                  ▼
                          CAPABILITY GRAPH  →  JOURNEY ENGINE  →  EVALUATION
                                  ▼
                       PORTFOLIO  ↔  MATCHING  →  OPPORTUNITY  →  Apply/Interview/Hire
                                  ▼
                          NEW EVIDENCE → CAPABILITY GROWTH (loop)
```

Six domains, each mapped to what already exists vs. what's new:

| Domain | Root entity | Existing foundation | New this evolution |
|---|---|---|---|
| **Person** | `profiles` (already role-agnostic — not "students" table) | Identity, auth, `primary_role` | `professional_context`, `executive_context` tables; continuity across role transitions is a query pattern on the same `profiles.id`, not a new identity |
| **Organisation** | `institutions` → **renamed** `organisations` | Education-only today (`college_type`) | `org_type` (education/workforce) discriminator; same table serves both — approved direction, see §C |
| **Capability Graph** | `capabilities`/`capability_history` | Real, deterministic, evidence-sourced | `evidence` table (source-linked, from the prior session's migration — not yet applied) |
| **Journey Engine** | (new) `journey_templates`/`student_journeys` (schema from prior session, not applied) | `lib/journey/stage.ts` (year-derived, to be split) | Three templates (Student/Professional/Executive) instead of one |
| **Opportunity Engine** | (new) `opportunities`/`applications` (schema from prior session, not applied) | `lib/mock/launchpad.ts` | Real matching engine, requirements model, recruiter side |
| **RBAC/Security** | `app_role` enum, `institution_memberships.role/.status` | Modeled, unenforced | Normalized `roles`/`role_permissions` tables (approved direction, see §C), `audit_logs` |

## C. Migration plan — Keep / Modify / Move / Create / Deprecate

| Component | Verdict | Detail |
|---|---|---|
| `profiles` | **Keep** | Already the Person entity — no rename, no fork. Role transitions (Student→Professional) are new rows in context tables, not new `profiles` rows. |
| `institutions` | **Modify** (rename) | → `organisations`, + `org_type`. Approved: full rename, not a parallel table — see the three DB functions this requires updating in lockstep (§D). |
| `institution_memberships` | **Modify** (rename) | → `organisation_memberships`, `institution_id` → `organisation_id`. |
| `handle_new_user()`, `get_or_create_institution()`, `get_or_start_section()` | **Modify** | Recreated verbatim (same logic) against the renamed tables, in the same migration that renames them — never left out of sync. |
| `app_role` enum + ad-hoc role checks | **Move** | Logic moves into `roles`/`role_permissions` tables + a real `lib/auth/authorize.ts` module. The enum itself is kept as a column type for backward read compatibility during transition, not dropped this pass (see `01-database-changes.md`). |
| `capabilities`, `capability_history`, `career_requirements`, `interests`, `guide_paths`, Arena (`arena_ratings`/`arena_challenge_attempts`), Vault, Pulse | **Keep, extend only** | Explicitly named as "don't break" in the brief; nothing here changes structurally this pass. |
| `evidence`, `journey_templates`/`student_journeys`, `plan_b_explorations`, `projects`/`project_contributions`, `mentor_evaluations`, `skills` catalog (prior session's migration) | **Create** (still not applied) | Folded into this pass's consolidated migration set, applied to a branch and verified before any production application. |
| `opportunities`/`applications`/`recruiters` (prior session's migration) | **Create**, schema only this pass | Real matching engine (Phase 3) is not built this pass — see `08-roadmap.md`'s phasing, unchanged. |
| `professional_context`, `executive_context`, `audit_logs` | **Create** | New this pass. |
| Recruiter/professional/executive UI routes (§9-10 of the brief) | **Deprecate the mock-only framing, not built this pass** | Explicitly out of scope for this pass — building 20+ new routes across three new experiences without their backing engines would be exactly the "reachable but not connected end-to-end" anti-pattern the brief itself forbids. Scoped into Phases 3-5 of `08-roadmap.md`. |
| `lib/mock/*.ts` | **Keep as-is this pass** | Migration protocol (Mock → Schema → API → Auth → UI → Tests) starts with schema this pass; API/UI/tests for Arena Projects etc. are a later phase, not silently skipped — tracked explicitly. |
