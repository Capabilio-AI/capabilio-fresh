# Capabilio: product audit and roadmap (2026-11-02)

Written from the repository on `main` (commit 45215e6), not from the brief. Where the brief and the code disagree, the code is quoted and the brief is corrected in section 7.

## 1. What Capabilio is today

A career-readiness platform with five connected layers, most of them already built:

| Layer | What exists (evidence in the repo) |
|---|---|
| Measure | Sign-up assessment per role (14 skills for Data Analyst, 53 to 84 questions per skill, adaptive min/max per skill: `career_skill_requirements`), the only multiple choice in the product |
| Plan | Visual roadmap per career, curriculum import, student path (stream, domain) |
| Practise | **Arena**: tool-faithful workstations with answer keys computed by the server from a per-student generated dataset; weekly 5-ticket board; skill-gap ordering; explain-your-work interview; Proof Session (staged project) |
| Evidence | `lib/evidence` + `lib/capability`: arena results, GitHub, Code DNA roll up to per-skill capability with a confidence of low / medium / high (3 and 5 data points). "Proven readiness": a headline readiness of 0% until a task is passed |
| Show | Public portfolio (`/p/[slug]`), Passport with badges and QR (`/passport/[code]`), graduate home, company-visit launchpad, college workspace (`/org`: students, placements, outcomes, insights) |

Role coverage: only **Data Analyst** passes `npm run arena:gate` (1 of 15 launch roles). Other roles have partial or unverified builds.

## 2. What is missing to be a real job-simulation platform

1. **Independence is unprovable.** Everything runs in the student's own browser. We can show correct work but not who did it or with what help. This is the largest trust gap and the one a recruiter will ask about first.
2. **Evidence is a score, not a work sample.** `EvidenceRow` has type, confidence and metadata; it does not store the artifact (the query, formulas, notebook, dashboard spec, the note) as a versioned, shareable record with the rubric that graded it.
3. **No proficiency model.** Confidence (data-point count) is not proficiency. There is no defined Level 1 to 5 with measurable criteria, and one passed easy task can raise a skill.
4. **No employer side.** There are college roles and permissions but no recruiter account, no consent model for sharing, no search. The portfolio link is the only channel.
5. **"Ready" means two different things.** The Arena gate says a role's *tooling* is ready. Nothing yet says a *student* is ready for the role. They share a word.
6. **One company, one dataset family.** BrightCart is good but narrow; a recruiter will want variety (finance, healthcare, logistics) so skills look transferable.
7. **Thin scenario work.** The staged project exists for Data Analyst only, and it is about a day's work, not a multi-dataset review.

## 3. What a recruiter trusts, and what a college pays for

**Recruiter:** a work sample they can open (the actual query, formulas, chart spec, note), the rubric it was graded against, how long it took and how many tries, and a second signal that the student understands it (the explain-your-work interview). Not XP, badges or streaks.

**College placement cell:** cohort readiness against a named role, who needs help, preparation reports, and a way to turn company visits into registered, prepared students. Capabilio already has the visit workflow and `/org` insights, which most competitors lack.

## 4. What makes students come back

Weekly board and skill-gap ordering exist. What is missing is a visible path: "you are 3 verified skills from role-ready for assessment", with the next task and why. Streaks should reward verified improvement, not volume.

## 5. Differentiation

| Competitor | What they are | Capabilio's real edge |
|---|---|---|
| HackerRank, LeetCode | Algorithm puzzles, one correct output | Work in the actual tool (SQL client, Excel, Power BI-style, notebook), graded on realistic business data |
| DataCamp | Guided lessons, fill-in exercises | Open-ended tasks with no hints in the way, answers computed per student so they cannot be copied |
| Forage | Static simulation slides, no machine grading | Server-verified numbers on each student's own data |
| All of them | Course completion as the signal | "Proven versus screened" readiness: 0% until work is passed |

The defensible combination is: per-student generated data, server-computed keys, tool-faithful simulators, and the college workflow around it. Employer-grade trust will come from the evidence record, not from more tools.

## 6. Roadmap

Order follows "evidence before audience before breadth".

| # | Work | Why now | Complexity | Impact |
|---|---|---|---|---|
| 1 | **Evidence record v2 and proficiency levels** (artifact + rubric + version + attempts + time; levels 1 to 5 with measurable criteria; no level from one easy task) | Everything recruiters and colleges see depends on it | M | Very high |
| 2 | **Split the two meanings of "ready"**: `arena:gate` becomes "tooling complete"; student role-readiness states (Not started, Learning, Developing, Demonstrated, Ready for assessment) with the reason and next task | Removes the most misleading claim in the product | S to M | High |
| 3 | **Recruiter view by consent, no accounts yet**: a share link with granular choices (which projects, which evidence) that opens the artifacts and rubric | Tests whether recruiters care before building accounts and search | M | High |
| 4 | **Data Analyst depth, in this order**: Business KPI analysis, data quality scorecard, A/B test analysis, data modelling (fact and dimension) | Each is a 1-to-2 week slice on tools that exist | M each | High |
| 5 | **Capstone**: BrightCart monthly review across tools, configurable rubric weights | Needs 1 and 4 first to be gradeable | L | High |
| 6 | **Recruiter accounts, search, shortlist, compare** | Only after 3 shows pull | L | High, but unproven |
| 7 | **College readiness reports per role** | Builds on 2 and 1 | M | High for sales |
| 8 | **Second domain dataset** (for example a hospital or a lender) | Shows transferability | M | Medium |
| 9 | **Engineering roles** (ECE, EEE, Mechanical, Civil) | Large simulators per role; do after Data Analyst is trusted | XL | Breadth, not trust |

Avoid for now: all eight new Data Analyst areas at once; any server-side execution of student code; AI that ranks or rejects candidates; a full Power BI clone; more gamification; engineering roles before the Data Analyst evidence story works.

## 7. Corrections to the brief (so we plan from facts)

- "Sign-up assessment: 14 questions per area": it is 14 skills for Data Analyst, with a bank of 53 to 84 questions per skill and an adaptive minimum and maximum per skill.
- DAX: the interpreter also supports **CALCULATE, ALL and DIVIDE**; the brief's list omits them.
- `order_items` is **not fixed at 421**: it varies by student seed (413, 430 and 441 in three samples). Everything else (55, 20, 210) is fixed.
- "Readiness gate reports READY" is correct but, as section 2 says, it describes tooling, not students.

## 8. Technical limits to address

- Evidence schema is thin (section 2.2).
- The full test suite takes about 25 minutes and the PGlite and ML tests time out when run alongside other jobs; they pass in isolation. CI cost and flakiness will grow with every role.
- `main` was red from PR #67 until the one-line fix in #69; a required pre-merge check would prevent this.
- Many migrations land by hand; production and repo drift is possible (149 and 151 were applied outside this work).
- Other roles' workstation tools still need the same real-tool restyle, honest limits and live verification before they claim readiness.
- DAX has no data model; Excel has no charts; Python code is not graded. These are stated in the blueprint and must stay in the recruiter view as limits.

## 9. Built: proficiency levels (roadmap item 1, first slice)

`lib/proficiency`: levels 0 to 5 (Not demonstrated, Familiarity, Guided practice, Independent execution, Workplace application, Advanced problem solving), each a list of measurable criteria over verified Arena passes (count, difficulty, tries before passing, explained in the interview, areas covered). One easy task never moves a skill past Familiarity; easy-only work caps at Guided practice; a task counts once. Shown on the portfolio with the reason; the next-step advice shows only to the student. Checked on production data: the one verified pass in the database yields Level 1 for SQL and Data Analysis.

Not yet done from item 1: storing the artifact itself (query, formulas, note) as a shareable, versioned evidence record, and persisting levels so they can be queried for cohorts. The portfolio's existing "View evidence" modal already opens the graded attempt.

## 10. Built: the two meanings of "ready" are separate (roadmap item 2)

- `npm run arena:gate` now reports **tooling complete** (Capabilio can measure and prove the role). Data Analyst: complete; 1 of 15 roles.
- `lib/proficiency/readiness.ts`: a **student's** readiness for their target role: Not started, Learning, Developing, Demonstrated, Ready for role assessment. Each required skill has a target level (critical and high: Level 3, medium: Level 2, low: Level 1); the top state needs every critical and high skill met and 80% of the weighted requirement; strength in minor skills never stands in for a missing core skill. It always says why and lists the gaps with the concrete next steps, and states that it is not a hiring prediction.
- Shown on the portfolio above the skill levels. Checked on production data: the one student with a verified pass reads "Learning, 7%, 0 of 14 met".
## 11. Built: sealed evidence records (roadmap item 1, second slice)

Every task that is passed and explained is now sealed into `evidence_records` (migration 153): the brief, the student's submission, the graded checks, the grading and generation versions, tries, the explain-your-work result, and a SHA-256 fingerprint over all of it. Sealed columns cannot be changed (a trigger refuses it; tested in a scratch Postgres). The one column the student controls is `shared`: a hidden record is not listed on the public portfolio and its evidence route answers 404, identical to a record that does not exist. The popup shows the fingerprint and an integrity check. Sealing is best effort and never undoes a pass; tasks passed before this get a record from `scripts/backfill-evidence.mts`. Honest limit: the fingerprint detects silent change inside the database; it does not stop someone with full database access from altering a record and recomputing it.

## 12. Built: recruiter share view (roadmap item 3)

A student creates a **pack** for one recruiter (`/r/[token]`, migration 154): which sealed work samples it includes, 7, 30 or 90 days, whether their contact details show, withdrawable at any time, with an opened-count. The link is the permission, so it works with the public portfolio off. The page leads with the question a recruiter has: readiness for the target role and its gaps, skill levels with their basis, then each work sample opened down to the brief, the submission, every graded check and the seal. No ELO, points, badges or streaks. It states its limits: simulation not field experience, answers verified but not authorship, readiness is not a hiring prediction. An unknown, expired, revoked or out-of-share request is the same 404 on the evidence route, and an expired or revoked page shows nothing about the candidate. No recruiter accounts, search, shortlist or compare yet: those wait to see whether recruiters open these links.

## 13. Changed: scoring by the answer, one final submission, a clock that resumes (2026-11-02, from user feedback)

**Scoring.** Until now only a pass moved the rating. The founder's decision: with no cost to being wrong a rating proves nothing. A wrong answer now lowers the two ratings a pass raises (the career ELO and the skill area's rating) by an amount worked out from the answer alone: the share of the task's checks it failed, taken out of what the ticket is worth (`lib/assess/arena-rules.ts`: `failedShare`, `missChange`). 2 of 3 checks right on a +12 ticket loses 4; none right loses 12; never less than 1. The assessment's fixed +4 / -2 rule is not used in Arena. The database applies it atomically, once per ticket, never below the floor (`apply_arena_miss`, migration 155).

**One final submission.** The student can run, test and preview as much as they like. Submit opens a review of exactly what will be graded and says it is final; confirming sends it. A right answer goes to the explain-your-work interview as before. A wrong one closes the ticket (status `unexplained`), keeps what was handed in, and starts the usual wait for the next ticket. No retry, no edit.

**The ticket stays until finished.** It lives on the account (`arena_domain_assignments`), not the browser, so a student who leaves comes back to the same ticket.

**Running out of time.** If the clock reaches zero with nothing submitted, the ticket closes as unanswered. That is an answer with no check right, so it loses the full worth of the ticket from the career ELO (the rating shown on the profile) and the skill area's rating, by the same rule as any wrong answer. The server settles it when the browser reports zero (checking its own record of the time, allowing 20 s of lag) and again whenever the Arena page loads, so closing the tab in the last seconds does not avoid it (`expireIfTimedOut`). A ticket in a Proof Session has no such deadline. Honest limit: the clock counts time reported by the browser, so someone who blocks those reports stops their own clock; the clock is an incentive, not a security boundary.

**The clock.** It ran on the wall clock from the moment of assignment and, at zero, closed the workspace. A ticket opened hours after it was assigned therefore closed the instant it opened: this is why a student could not open their mission. Now the clock runs only while the workspace is open and the page is visible, is kept on the ticket (`time_spent_seconds`, `beat_attempt_time`, migration 155), resumes where it stopped and across devices, and, at zero, ends the ticket as above.

Not changed: Proof Session stages, the skill graph, proficiency levels (they already count tries). Pass gain is unchanged (the full ticket value after the interview); scaling it by the interview score is an option, not done.
