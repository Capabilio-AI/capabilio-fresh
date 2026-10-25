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

## Browser QA pass (real Chrome, every role)

Driven through headless Chrome against a seeded disposable college (principal, TPO, default faculty, custom-permission staff, students, visitor); fixture and all created data removed afterwards (prod back to 16,284 institutions, 0 test users, 0 stray storage objects).

Covered: every org page per role (permission-gated pages 404 for roles without the permission), composer (text / photo / event), post menu (edit, unpublish, publish, delete), college page (logo + cover upload, edit details, tabs, view as visitor), staff invitation → accept → account creation → limited access → single-use link, permission editor, student join link landing, team chat (send, new channel), company visit → student registers → shortlist → select → offer letter (private PDF) → student sees it and answers → outcomes + CSV, curriculum inside the org shell, legacy `/admin/curriculum` forward, mobile widths (no horizontal overflow), sign-out.

Defects found and fixed:
- Student join link missing on first open of Team & access (re-select after insert served a stale cached fetch) — now uses the inserted row.
- Edit-access / new-channel / edit-post dialogs were see-through (theme `.o-card` overrode their background).
- Event posts repeated the title and body.
- Visitor view of the college page had no way back — added "Back to workspace" for staff (not shown to students).
- New channel didn't navigate/refresh (push + refresh raced) — push only.
- A failed offer-letter upload left "No letter attached" with no way to retry — added Attach / Replace letter.

Known, outside the org path: `/api/assessment/start` returns 500 for a brand-new student with no profile (student path, untouched by this work).

## College followers list (2026-10-25)

The follower count on a college page (header, and the Followers tile in the workspace) now opens a list, like Instagram or LinkedIn: photo, name, what they are (a student's career goal and ELO, or "Role @ College"), class and branch, an "At this college" mark for members, and a Follow button. Search box; 50 at a time with "Show more". Newest first.

Who sees it: any signed-in person, for a college whose page they may see (public, or one they belong to). Visitors who are not signed in get a sign-in link instead. People blocked in either direction are left out, no email is ever returned, and the list uses the same public fields as Pulse's follower lists. Route: `GET /api/orgs/followers?slug=&before=` (the cursor is the follow time and person of the last row, validated before it reaches a query, so two people who followed at the same moment never get lost between pages). Code: `lib/org/followers.ts`, `components/org/FollowersList.tsx`.

Checked live against a throwaway college (removed afterwards), including through the running app: order, paging across a tie, a blocked person, who is from the college, the viewer's own follow, visitor refused, private college refused, bad cursor refused.
## Semester start dates drive the student path (2026-10-25)

Who sets them: admins (principal, vice principal) any branch or college-wide; an **HOD** their own branch only (a date for another branch or "all branches" is refused with a message); faculty and the TPO only if an admin granted "College page" (as before). Staff whose department is not recorded cannot set any, because a date moves unlocks for a whole cohort. The HOD rule is by role, not a new stored permission, so no database change was needed (the permission list is fixed by a CHECK constraint). An HOD sees "Academic calendar" in the sidebar.

What a date does for students (`lib/career/term.ts#isFirstSemesterOpen`, applied in `buildDirection`):

- **3-1, Plan B:** if the college has entered a Year 3 Semester 1 date for the student's branch (or college-wide), Plan B (the career-direction question) opens on that date; with no date it opens when the third year begins, as before.
- **4-1, final year:** the same rule opens the AI Interview tab and the Launchpad page (`launchpadOpen`).
- A date only holds a feature back until it arrives. Students already in the second semester, or in a later year, are not affected. A date more than 120 days ahead is treated as next cycle's, entered early, and holds nothing back. A branch's own date beats the college-wide one.
- Today's date is taken in UTC (as the semester calculation already did), so a date takes effect at 05:30 IST.

Production had no calendar rows when this shipped, so nothing changed for anyone until a college enters a date. Checked live (real database, throwaway college): dates hold and release Plan B and Launchpad at the right day, per branch, with branch dates overriding college-wide ones; through the running app: admin any branch, HOD own branch only, HOD without a branch, faculty, TPO, student and visitor refused.
