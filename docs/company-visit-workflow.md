# Company visit workflow (college -> student -> college)

Status 2026-11-01. "Built" = in production code; "Fixed" = this change; "Next" = not built.

| # | Step | Who | What happens | State |
|---|---|---|---|---|
| 1 | Record the visit | College (TPO / principal: `postPlacement`) | Company, role, visit date, package, location, deadline, eligible branches, status (planned / registration open). Saved as an `opportunities` row pinned to the college | Built |
| 2 | Choose who can register | College | Branches typed by the college ("CSE", "ECE, IT", a full name) or "all". Empty / "all" = every student of the college | **Fixed**: "all" was stored as a branch named "all", matched nobody, so no notification and no registration |
| 3 | Notify students | System | On create (if registration is open) or when registration is opened later: an in-app notification to the college's active, current students of the eligible branches, linking to Launchpad. One per visit (`drive-open:<id>`) | Built, **Fixed** for "all" |
| 4 | See it in Launchpad | Student | Card: company, role, visit date, package, "Open to", Register. Final-year students only (`launchpadOpen`); earlier years are told when it opens | Built |
| 5 | Register | Student | One click. Refused if registration is closed, the deadline passed, the visit belongs to another college, or the branch is not eligible. The student cannot set their own status | Built, **Fixed** for "all" |
| 6 | Tell the college | System | Notification to every staff member allowed to manage placements: "<student> registered for <company>", linking to the visit | Built |
| 7 | Registered list | College | Visit page lists each student: name, **roll number (student ID)**, branch, class of, status; **Download list (CSV)** with S.No, name, roll number, branch, class, email, status, registered on | **Fixed** (roll number, email and CSV were missing) |
| 8 | Shortlist / select / not selected | College | Each change notifies the student ("Your application to <company> is now shortlisted") | Built |
| 9 | Offer letter and placement | College -> student | Offer released, student accepts or declines, college confirms the placement into Outcomes | Built |
| 10 | Visit closed or cancelled | College | Everyone who registered is notified | Built |

## Missing, in the order I would build it

1. **Reminder before the deadline** to eligible students who have not registered (once, one day before). Today they hear only when the visit opens.
2. **Visit edited** (date, package, branches): notify registered students. There is no edit screen yet; changing the date after students registered is silent.
3. **Student can withdraw** a registration; the college sees it and the list updates.
4. **Eligibility rules beyond branch**: minimum CGPA, no active backlogs, skills readiness. The `eligibility` text exists but is not enforced.
5. **Students outside the final year** who match the branch: notify them too ("opens for you in 4-1") instead of nothing.
6. **Roll number required to register** (or warn the student): a list with blank roll numbers is not useful to a company. The CSV leaves it blank today.
7. **Company-ready packet**: the CSV plus each student's verified skills (Skill Passport link) so a company can shortlist on proof, not on a resume.
