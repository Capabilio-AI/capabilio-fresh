# API Architecture

Extends `docs/architecture/04-api-surface.md` (still accurate for everything it covers). This adds the brief's namespace list, mapped against what's built this pass vs. planned.

| Namespace | This pass | Detail |
|---|---|---|
| `/auth` | Unchanged | Supabase Auth directly |
| `/person` | **New, minimal**: `GET /api/v1/person/me` | Returns the calling user's own `profiles` + `organisation_memberships` + `professional_context`/`executive_context` (whichever exist) — the "one continuous record across role transitions" made concrete as a single read |
| `/organisations` | **New, minimal**: `GET /api/v1/organisations/[id]` | Read-only, RLS-scoped; no org-admin write routes this pass (Phase 4) |
| `/assessment` | Existing, extended | Rate limiting added (`06-testing-strategy.md`'s sibling concern, `docs/platform-evolution` doesn't re-litigate `04-api-surface.md`'s inventory) |
| `/capability`, `/career`, `/journey` | Existing (`/capability/*`, `/career-matches`) + `/api/v1/students/{id}/state` | Journey templates (Professional/Executive) are schema-only this pass — no new journey-read endpoint beyond `/state`'s existing `journeyState` field |
| `/learning`, `/projects` | Existing (SkillStudio pages) / **schema-only** (Project Lab) | No new routes — Phase 2/3 |
| `/arena` | Existing | Unchanged |
| `/evidence` | Existing (`/api/capability/evidence`) + `evidence` table (schema, prior session) | No new route this pass |
| `/portfolio` | Existing (`/dashboard/portfolio` page) | Unchanged |
| `/opportunities`, `/matching`, `/applications`, `/interviews`, `/recruitment` | **Schema only** (`opportunities`/`applications`/`recruiters`, prior session) | Zero new routes this pass — see `05-opportunity-flow.md` for why building routes without a matching engine behind them would be hollow |
| `/mentor` | Existing | Rate limiting added |
| `/analytics` | Not built | Phase 4 |

## New this pass

- `GET /api/v1/person/me` — self-only (no cross-person authorization needed, unlike `/students/{id}/state`), returns the unified Person record.
- `GET /api/v1/organisations/[id]` — RLS-scoped to the caller's own membership; the `roles`/`role_permissions` check (`03-authorization-matrix.md`) gates whether they see admin-only fields (none exist to gate yet, so this is a plain read for now — the authorization *hook point* is what's new, not a visible behavior change).

Both follow the same pattern as `/api/v1/students/{id}/state`: `requireUser()` for authentication, a real authorization check (not just "is logged in") before returning data, Zod-validated params.
