# Organisation Path — Reference Study (capabilio-web) and Redesign for capabilio-fresh

**Reference read:** `capabilio-web/INSTITUTION_PATH_BLUEPRINT.md` (1,906 lines), `College_Path_Production_System_Design.md`, `docs/organisation_path_coordination_layer_design.md`, and the shipped Institution OS UI (`frontend/src/pages/InstitutionOS.jsx` nav, roles, Home; `paths/CollegePath.jsx`; `InstitutionPublicProfile.jsx`) plus the `college.js` route list.

## 1. What the reference gets right (and we adopt)

| # | Reference idea | Why it matters |
|---|---|---|
| 1 | **Grouped workspace nav** — Visibility / Operations / Intelligence, role-filtered (`ROLE_PAGES`) | One mental model per audience; each role only sees pages it can use |
| 2 | **Home = "what needs attention now?"** — alerts, KPIs, workflow queue, upcoming; every number links to the action | The TPO/dean's Monday-9am question, not a static dashboard |
| 3 | **Placement pipeline** — drive → applicants → shortlist → offer → **TPO-confirmed placement**; self-reported placements never count | The core B2B value; prevents fake placement inflation |
| 4 | **Outcomes** — placed list, stats by department, funnel, NAAC-style export | What a college actually reports upward |
| 5 | **Student consent for the Placement Wall** | Privacy boundary: institution shows a student publicly only with their say-so |
| 6 | **Students page** — roster with department/batch filters and per-student status | Staff need to see their own students, not only aggregates |
| 7 | **Events with registration** | Drives and talks need a headcount |
| 8 | **Public profile with trust signal and outcomes** | Discovery/marketing surface; verified badge only when earned |
| 9 | **Manual verification before trust** | Same as our operator approval |
| 10 | Server-computed metrics only (no client-authored numbers) | Same rule as our server authority |

## 2. What the reference does that we deliberately do NOT copy

| Reference feature | Decision | Reason |
|---|---|---|
| ELO everywhere (leaderboards, "avg ELO", interventions by ELO) | **Skip** | Fresh's thesis is evidence, not a rating; Arena ratings stay private to the student's Portfolio. We show *counts of verified evidence* instead |
| Client-authored ELO / grading races (its own audit flags them) | Avoided | Fresh grades are staff-entered via atomic DB functions |
| Two parallel schemas (`org_*` vs `institution_*`) | Avoided | One schema, real foreign keys |
| Domain DNS / document / Aadhaar verification ladder | **Defer** | Needs uploads + a review team; our manual operator approval is the honest equivalent today. Badge is derived, never faked |
| Recruiter portal + NDAs, interviews, offers as a marketplace | **Defer** | Recruiter identity/NDAs are undesigned here; TPO-entered pipeline covers the college side |
| Chat / coordination layer, mentions, follow-ups, approvals | **Defer** | Large, and the reference itself calls the substrate a separate track |
| Tasks propagation engine with ELO deltas | **Adapt** | Our equivalent is class projects + staff grade → evidence (already built) |
| Cohorts/intervention wizards | **Defer** | Needs a tasks engine first |
| Professional-transition + EPFO/UAN verification | **Defer** | Belongs to the Professional path task |
| Integrations grid (Zoom, WhatsApp, ERP…) | **Skip** | Speculative |

## 3. Gap analysis: fresh (as built) vs reference

Already covered: role-gated workspace, materials, projects/groups/grading→evidence, drives as private `opportunities`, aggregate insights with small-cohort suppression, public opt-in page with events/announcements/follow/like/share, faculty approval, operator approval.

Missing versus the reference — **built in this pass:**
1. **IA:** grouped sidebar, role-filtered; **Home rebuilt as an attention board** (alerts, KPIs, grading queue, upcoming).
2. **Students** roster (staff/admin): branch + class-of filters, real signals (project groups, staff-graded projects, Arena completions in 30 days). No ELO.
3. **Placement pipeline:** students apply to campus drives → TPO shortlists/selects → TPO **confirms placement** (company, role, CTC).
4. **Outcomes** (TPO/admin): confirmed placements, funnel, by-branch stats with suppression, CSV export.
5. **Placement Wall + consent:** student decides whether their confirmed placement appears on the public page.
6. **Event RSVPs** with counts.
7. **Public page** upgrade: derived "Verified organisation" badge, placement wall, event RSVP.
8. **Security fix found while studying the pipeline:** `applications` let any signed-in student write their own status (`accepted`). Client writes are now revoked; only server routes write applications.

## 4. Role model (reference → fresh)

| Reference role | Fresh role | Workspace |
|---|---|---|
| Institution admin / college admin | `principal`, `vice_principal` (admin) | everything except cross-institution |
| Placement officer (TPO) | `tpo` | Overview, Placements, Outcomes, Insights |
| Professor / dept head / mentor | `faculty`, `hod` (staff) | Overview, Students, Classroom, Posts |
| Recruiter (guest) | — (deferred) | — |
| Student | `student` | `/classroom`, Launchpad, consent |

## 5. Authority and privacy rules carried over

- TPO sees placement/outcome data and aggregates, **not** project submissions or grades (unchanged). Staff and admin see their students' roster and classroom work; no ELO anywhere.
- Confirmed placement is created only by TPO/admin of the student's own institution, for an active student of that institution. No self-report path exists.
- Public exposure of a placed student requires that student's own consent; CTC is never shown publicly.
- Every count that could single out a person is suppressed below 5.

## 6. Migration
`041_org_placement_pipeline`: `org_placements`, `org_event_rsvps`, revoke client writes on `applications` (keep own-row read), `applications` policy narrowed to SELECT.
