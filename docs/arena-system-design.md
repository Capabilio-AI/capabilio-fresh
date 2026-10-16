# Arena as one linked system (design)

Status: design for review. "Exists" means it is in the code today; everything else is proposed. Effort figures are guesses.

## The one rule that links everything

Arena never talks to Vault, Launchpad, Interview or Portfolio directly. It writes **evidence**. Everything else reads the **capability read model** (`lib/capability/read-model.ts`), which turns evidence into a level per canonical skill.

```
Arena result ──► evidence row ──► capability (per skill) ──► Vault / Passport / Portfolio
   (also: SkillStudio, GitHub, projects, assessments)    ├──► Launchpad match %
                                                         ├──► AI Interview topics
                                                         └──► Arena difficulty (what to serve next)
```

Adding a feature means writing better evidence or reading the model; it never means wiring one module to another.

## What exists today

| Piece | State |
|---|---|
| Work tickets with a requester, scenario, hidden checks and server grading | Exists (SQL, spreadsheet, cleaning, statistics, dashboard) |
| Company world with a warehouse per user, no repeated tickets, five tiers of experience | Exists for the Data Analyst; Postgres roles added |
| Evidence rows and a per-skill capability model (kinds: ARENA, ASSESSMENT, PROJECT, GITHUB, ...) | Exists |
| Arena rating (ELO) per role and per skill area | Exists |
| Passport, badges, QR, portfolio | Exists |
| Arena pass writes evidence, moves ELO, refreshes the skill graph | Exists |
| Launchpad opportunities with a skills list | Exists, but no match percentage |
| AI Interview | Exists, not linked to Arena |

## The proposal, piece by piece

| Idea | Verdict | What it needs |
|---|---|---|
| Skill matrix instead of one level | Mostly exists | Show `arena_skill_ratings` per area and the capability model per skill |
| Five experience bands | Four exist (fresher, junior, mid, senior); add expert | A fifth level and harder tickets |
| Mixed challenge types (sprint, debugger, detective, case, incident) | New ticket kinds | Debugger: a broken query to fix, graded by result. Detective: question a dataset, graded on the conclusion. Both fit the current engine |
| Production incident mode | New | A timed ticket with a data-quality fault planted in the warehouse; graded on the cause named plus the corrected number |
| SQL optimisation | Partly | Score the query plan (rows scanned, index used) on Postgres, not wall-clock time; PGlite runs in WebAssembly so its timings are not production timings |
| Messy data | Exists for cleaning | Plant faults in analysis tickets too |
| Industry worlds (banking, SaaS, healthcare, logistics, edtech) | New, repeatable | Each world is a data generator plus its tickets; BrightCart is the template |
| AI coach with hints and independent-solving score | Partly | Hints with penalties exist; add the independence score to the profile |
| Verified skill and Vault credential | Mostly exists | A rule for when a result is rigorous enough to count |
| Arena to Launchpad match % and gap challenges | New, high value | Compare the capability model with each job's skills; link a gap to an Arena ticket |
| Job-specific Arena | New, high value | Read a job description, map it to canonical skills, serve tickets tagged with those skills |
| Arena to AI Interview | New | After a case, open an interview seeded with the user's own answers |
| Arena to Portfolio case study | New | Turn a completed case into a verified portfolio entry |
| AI stakeholder simulation | New, hardest | AI-assessed, costs per message, needs a rubric and a transcript record |
| Open-ended business cases | New | Needs a rubric grader; mark it "AI-assessed" next to auto-verified work |

## Honest risks

1. Anything without one correct answer (cases, stakeholder talk, explanations) needs AI grading. It costs money and can be wrong. Label it separately from auto-verified work, and never let it alone create a "verified" credential.
2. Each industry world is real work: a believable data generator, tickets, and checks that the answers are fair.
3. A match percentage is only as good as the skill mapping. Job descriptions use free text; the mapping to canonical skills must be reviewed.
4. "Proof" must stay honest: show the evidence behind every verified skill.

## Done so far

- Step 1: the Arena home shows the user's skill profile, read from the capability model. Unmeasured skills read "Not assessed", never zero.
- Step 2: Launchpad shows a match percentage per job with the reasons behind it, and links each gap to the Arena skill area that builds it (or to SkillStudio when none does).

- Step 3: job-specific Arena at `/arena/prepare`. Open it from a Launchpad listing or paste a job description. The skills are found by matching the text against the skill catalog (no AI), compared with the user's measured skills, and turned into a plan: a step per gap, about how many tickets it takes, and where to practise. It is computed live from the capability model, so it needs no new table and is always current.

- Step 4: SQL debugger tickets (fix a broken query), data detective (find which slice of the business is failing and measure it) and production incident (find a data fault such as orders loaded twice, a price 100 times too high, or statuses that stopped updating). Detective and incident use a new investigation workspace: explore with SQL, then report findings in a form that is graded exactly. Incidents suit mid-level and above, detective junior and above, and the rotation leaves them out until the user has the experience.

- Step 5: explain your work. A solved task waits in "explaining": the user sees the completed task, answers four AI questions about their own work, and only a passing explanation (50 out of 100) awards the rating, writes the portfolio entry and updates the skill graph. One more try with fresh questions, then the task closes without a rating; skipping also closes it without a rating.

- Data Analyst finish: dashboard and statistics tickets on the company data (no AI), an expert level, expert SQL tickets and a compound incident.

- SQL roles, first depth batch: 45 Postgres tickets (from 19), including fresher-level everyday work, data-changing tickets, DBA tickets that verify the actual query plan, and debugging for the SQL roles; BI Developer gets dashboard tickets.

## Suggested order

1. Show the skill matrix and the capability model in Arena (reads only).
2. Launchpad match % from the capability model, plus "close this gap" links to tickets.
3. Job-specific Arena (job description to skills to tickets).
4. Debugger and data-detective tickets, then production incident.
5. Arena to AI Interview and Arena to Portfolio.
6. More industry worlds.
7. AI stakeholder simulation last.
