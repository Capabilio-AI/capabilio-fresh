# Org Path Progress

**Status:** built and verified against production (unit 389, live 36, lint 0 errors, build OK). No browser click-through yet.

## Built
- **Classroom (Module B):** materials (links), projects (open call, groups of 4, cross-department), DB-enforced group rules, weekly reports (process data only), in-app + physical submissions, one staff grade per group → one staff-verified "Project Work" evidence row per member (atomic, idempotent).
- **Placements (Module C):** campus drives (`opportunities`, private to the college via RLS) → students **apply** in Launchpad → TPO/admin **shortlist / select / reject** → TPO/admin **confirm placement** (or record an off-campus offer). No self-report path.
- **Outcomes:** confirmed placements, funnel, by-branch counts and CTC stats hidden below 5 records, CSV export scoped to the caller's college.
- **Placement Wall:** the *student* consents (own row only); shows name, company, role — never pay.
- **Insights:** aggregate career intent + project signal, cohorts < 5 suppressed; no invented engagement metric.
- **Home:** "what needs attention now?" (alerts only for things that exist, KPIs, grading queue, coming up).
- **Students** roster for staff/admin: real counts (project groups, staff-graded projects, Arena completions in 30 days). No ratings.
- **Presence (Module A):** opt-in public page `/o/<slug>` with derived "Verified" badge, placement wall, events + RSVP, announcements (members-only unless public), follow / like / share-link. No comments.
- **Workspace:** grouped sidebar (Visibility / Operations / Intelligence), role-filtered. Login routes org roles to `/org`.

## Reference study
docs/org-path-reference-study.md — what was adopted from capabilio-web's Institution OS, what was deliberately not (ELO, recruiter portal/NDAs, chat layer, DNS/document verification), and why.

## Migrations (prod)
038 org_classroom · 039 org_placements_rls · 040 org_presence · 041 org_placement_pipeline · 042 org_removal_safety. 029 untouched.

## Bugs found and fixed on the way
- `applications` was client-writable (a student could set their own status to `accepted`) → client writes revoked (041).
- `opportunities.read_all` exposed private drives → institution-scoped policy (039).
- Removing a staff member / institution failed: physical-submission check vs `ON DELETE SET NULL` (042); `org_placements` confirmer FK would have blocked deleting a TPO (042). Regression test added.
- Login showed "Student Portal" for TPO (missing role entries).

## Limits (deliberate)
No file uploads (links only) · evidence skill is "Project Work" · one role per person per institution · principal/vice principal approved by the operator script only · `lib/supabase/types.ts` not regenerated (new tables via `lib/org/db.ts`) · verification is the operator's manual approval (no DNS/document ladder) · no recruiter accounts, chat, cohorts, or Professional-transition flow.
