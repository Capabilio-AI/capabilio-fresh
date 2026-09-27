# 06 — Security

## RBAC: already modeled, not yet enforced

`institution_memberships.role` is `Database["public"]["Enums"]["app_role"]`: `student | faculty | hod | principal | vice_principal | ceo | mentor | professional`. `institution_memberships.status` is `pending | active | revoked`. A `role_requires_verification(role)` RPC already exists (used by the signup flow, `components/login/roles.ts` + `RoleSelector.tsx`, to decide whether a chosen role needs approval before becoming active).

**What's missing is enforcement, not modeling.** As of this session's dashboard/arena/pulse/etc. build-out, every page and API route checks exactly one thing: "is there a logged-in user" (`supabase.auth.getUser()`), never "does this user hold role X in institution Y with status = active." That means, today, a `student`-role account and a hypothetical `faculty`-role account see identical UI and have identical API access — there is no admin/faculty surface yet, so this hasn't caused a real exposure, but it also means none exists to protect once one is built. `04-api-surface.md`'s `/state` endpoint is the first route in the repo to actually branch on `role`/`status`.

## Tenant isolation pattern

Every new table in `01-domain-model.md` follows one of two shapes:

1. **Self-scoped** (`plan_b_explorations`, `evidence`, `mentor_evaluations`, `student_journeys`, `applications`): RLS policy `using (user_id = auth.uid())`. A student can only ever read their own row — no institution join needed because the row already belongs to exactly one person.
2. **Institution-scoped** (`programs`, `departments`, `cohorts`, `journey_templates` when non-null): RLS policy walks the FK chain back to `institution_memberships` for the current user (see the migration file's `*_read_own_institution` policies) — a College A admin's queries structurally cannot return College B's rows, because the policy is a `select ... in (...)` against the caller's own memberships, not a client-supplied filter.

The second pattern is the one that matters for "College A admin must never reach College B's students" (§25) — it's enforced at the Postgres row level via RLS, not in application code, so a bug in a future admin route can't accidentally leak cross-tenant data the way an application-level `if` check could.

## Secrets

Already correct in this repo and unchanged by this work: `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` are read server-side only (`lib/supabase/service.ts`, `lib/ai/groq.ts`), never referenced with a `NEXT_PUBLIC_` prefix, never passed to a Client Component. The new `/state` endpoint and any future Journey/Project/Mentor routes must follow the same rule: service-role client only inside Route Handlers, never returned to or constructed by the browser.

## Consent & audit

Not modeled in this pass — there's no `consent_records` or `audit_log` table yet. Given the domain entities added here (Plan B explorations, mentor evaluations, project contributions) are all either self-authored or mentor-authored-about-a-consenting-participant, and none introduce a new category of sensitive data collection beyond what `assessment_responses`/`capabilities` already store, a dedicated audit table is deferred to when a real admin/recruiter surface exists and needs "who viewed this student's data" logging (§24's recruiter platform is the concrete trigger for this — flagged in `08-roadmap.md`, not built speculatively now).

## Recruiter-specific rule

Repeating §24 here because it's a hard constraint, not a suggestion: nothing in the `opportunities`/`applications`/`recruiters` schema or any future recruiter-facing code may compute or display a hiring-probability score, a placement-likelihood percentage, or fabricated partnership/placement statistics. `Skills match` (already implemented on the Launchpad page this session, `app/(app)/launchpad/page.tsx`) is deliberately phrased as "N/M skills align," a relevance count — never a prediction. Any future recruiter search feature must preserve that framing.
