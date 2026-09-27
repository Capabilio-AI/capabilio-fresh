# Authorization Matrix

Role × resource × access level, seeded into `roles`/`role_permissions` (`01-database-changes.md`). `admin` implies `write` implies `read` for that resource. A blank cell means no access — not "inherit," explicit denial.

| Role | own person | other person (same org) | organisation | opportunity | evidence (own) | evidence (others') | audit_logs |
|---|---|---|---|---|---|---|---|
| `student` / `graduate` | admin | — | read | read | admin | — | — |
| `professional` | admin | — | read | read | admin | — | — |
| `executive` | admin | — | read | read | admin | — | — |
| `mentor` | admin | read (mentees only, via `mentor_evaluations`/`project_members`) | read | — | admin | read (mentees, evaluation context only) | — |
| `faculty` | admin | read | read | — | admin | — | — |
| `hod` | admin | read | read | read | admin | read (dept scope) | — |
| `principal` / `university_admin` | admin | read | admin | read | admin | read (org scope) | read (own org) |
| `vice_principal` / `ceo` | admin | read | admin | read | admin | read (org scope) | read (own org) |
| `recruiter` | admin | read (only fields the person marked `Recruiter Visible`, §12) | read (own company) | admin (own postings) | — | read (applicants to own postings, visibility-gated) | — |
| `hiring_manager` | admin | same as `recruiter` | read | read | — | read (same gate) | — |
| `company_admin` | admin | same as `recruiter`, plus manage recruiter seats | admin (own org) | admin (own org) | — | read (same gate) | read (own org) |
| `platform_admin` | admin | admin | admin | admin | admin | admin | admin |

## The visibility layer this matrix assumes

`recruiter`/`hiring_manager` rows above are deliberately narrower than "read" on a whole person — they resolve through the profile visibility levels from §12 (`Public / Recruiter Visible / Organisation Visible / Portfolio Visible / Private`), which is a **per-field, per-person setting**, not a role grant. The matrix says a recruiter *can* query a candidate; the visibility level says *which fields* come back. Both checks are required — a `role_permissions` grant without a visibility check would leak private fields to anyone with the recruiter role; a visibility check without the role grant would let anyone query anyone. Neither exists as enforced code yet (visibility levels aren't modeled in the schema this pass) — flagged, not silently assumed solved. `08-roadmap.md`'s Phase 3 (Talent network) is where this lands, since it's meaningless without real opportunities/applications to gate access around.

## Enforcement point

`lib/auth/authorize.ts` (new, this pass): `can(userId, resource, action, { organisationId? })` — checks `roles`/`role_permissions` for the caller's role within the given organisation (via `organisation_memberships`), never trusts a client-supplied role claim. Every sensitive route calls this server-side; **frontend route-hiding is never treated as authorization**, per §12's explicit instruction. Wired into `/api/v1/students/{id}/state` and `/api/v1/organisations/[id]` this pass; the pattern is documented for every future sensitive route rather than retrofitted onto routes that don't yet expose cross-user data (existing routes are all self-scoped already — see `docs/audit/2026-09-27-full-audit.md` §5).
