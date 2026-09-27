# User Journeys

Nine roles, same platform, same modules — differences are data and configuration, never a separate codebase per the brief's own repeated instruction (§22: "one platform with different experiences and configurations"). This pass ships the identity/data continuity these journeys depend on (Person, Organisation, RBAC); the professional/executive/recruiter *UI surfaces* below are Phase 3-5 (`08-roadmap.md`), not built this pass — each journey below states plainly what's real today vs. planned.

## First-year student
`profiles` row + `organisation_memberships` (role `student`, `organisation_type = 'education'`) created by `handle_new_user()` at signup — **real, unchanged behavior** (verified against the live trigger this session). Dashboard shows "not enough data yet" states until the assessment is taken — **real**.

## Final-year student
Same `profiles.id` as first year — capability history has accumulated over years via `capability_history` rows. Career match, Guide Path — **real**. Opportunity discovery (browsing real `opportunities` matched to their capability) — **schema exists, matching engine and UI don't** (Phase 3).

## Recent graduate
This is the continuity test case from the brief (§2, §8): the same `user_id` gets hired, and their `professional_context` row is created (new this pass) pointing at the hiring organisation. No new `profiles` row, no data fork — every existing `capabilities`/`capability_history`/`evidence` row remains attached to the same identity, now accumulating alongside professional evidence too. **Schema supports this today; nothing yet writes a `professional_context` row automatically on hire, since there's no hiring/interview flow built (Phase 3-5).**

## Professional
`professional_context` (current role, target role, organisation) + the existing capability graph — **schema new this pass, no `/professional/*` UI** (Phase 5).

## Executive
`executive_context` (configurable capability framework, leadership goals) — **schema new this pass, no `/executive/*` UI** (Phase 5).

## University admin / Faculty / HOD / Principal
`organisation_memberships.role` already carries these (real, pre-existing). What's new: `roles`/`role_permissions` gives them an actual enforcement path once an admin surface exists to use it (Phase 4) — today these roles exist on accounts but grant no different UI or API access, exactly as flagged in the audit.

## Mentor
Existing `mentor` role. `mentor_evaluations` (schema, prior session, unapplied) is the evidence-linking mechanism for mentor feedback — no mentor-facing UI this pass.

## Recruiter / Company admin
`recruiters`/`opportunities`/`applications` schema exists (prior session); `roles` seeds `recruiter`/`hiring_manager`/`company_admin`/`platform_admin` this pass. **Zero `/company/*` routes built this pass** — per `00-implementation-audit.md`'s migration plan, building the recruiter UI before the matching engine and visibility layer exist would produce exactly the "reachable but not connected end-to-end" surface the brief explicitly forbids reporting as done.
