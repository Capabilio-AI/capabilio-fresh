# Capabilio Workplace — Phase 1 spec (Data Analyst, Business Analyst, SQL roles)

Status: approved scope (all four SQL roles, PGlite Postgres, M1 first). Nothing here is built unless marked "exists". Time figures are estimates, not commitments.

## 1. Goal

A second workplace for freshers and professionals. Users work realistic tickets for a fictional company, in tools that match what the job really uses, and every result becomes verified proof on the Skill Passport. No resume claims: only evidence.

## 2. Roles in Phase 1 (to confirm)

| Role key | Role | Notes |
|---|---|---|
| `data-analyst` | Data Analyst | Exists with 5 enabled skill areas; needs far more content |
| `business-analyst` | Business Analyst | New role and new tools |
| `sql-developer` | SQL Developer | New role |
| `bi-developer` | BI / Reporting Developer | New role, reuses dashboard and SQL tools |
| `database-admin` | Database Administrator (junior) | New role, needs a Postgres engine (see 5.3) |
| `data-engineer-sql` | Data Engineer (SQL-first) | New role: pipelines, data-quality and transformation SQL |

## 3. What exists today (verified in code)

- Workstation templates: SQL console (sql.js / SQLite), spreadsheet, dashboard, statistics, data cleaning, Python notebook (Pyodide), front-end editor, config editor, scenario questions.
- Role taxonomy tables `arena_domain_roles` / `arena_skill_areas`; only `data-analyst` is seeded. Skill areas: SQL, Spreadsheet, Dashboard, Statistics, Data Cleaning enabled; Python disabled.
- Challenge spec (`lib/arena-content/spec.ts`): ticket brief written as a message from a named stakeholder, steps, server-side checks, hints with score penalties, provenance, a reference solution, a "wrong" solution that must fail. Import, validate, then publish flow (DRAFT to PUBLISHED).
- Server-side grading on a persisted per-attempt data instance; expected values never reach the browser.
- Difficulty from the user's rating, a rotation that avoids repeats, one ticket at a time with a 24 h cooldown, ELO and skill-evidence writes.
- Content: only 3 seed tickets for Data Analyst.

## 4. Gaps to close

1. **No persistent company or sprint.** Tickets are standalone. Needed: a company world, a weekly sprint board, story continuity.
2. **Content volume.** 3 tickets per role is a demo, not a workplace.
3. **Per-user data.** Seed tickets use one fixed dataset. Needed: a seeded data generator so each user gets the same scenario with different data.
4. **No Business Analyst tools** and no BA role.
5. **SQL roles need a real database engine.** SQLite cannot show EXPLAIN plans, stored procedures, triggers or real transactions.
6. **Analyst Python is disabled.** Python in the browser (Pyodide) exists, but results are client-verified, which is a lower trust level than server-verified.

## 5. Design

### 5.1 Company and sprint model (platform core, built once)

- `workplace_companies`: key, name, industry, one-paragraph story, the data model each role works against.
- `workplace_sprints`: one row per user per role per week: ordered ticket ids, story beats, status.
- A ticket belongs to a company, a role, a skill area and a difficulty. A sprint is 5 tickets that share one story (for example: "Q3 churn review at BrightCart").
- Cadence: sprint per week, one open ticket at a time with the existing 24 h cooldown between tickets.
- Existing `arena_challenges` rows stay the ticket store; sprints reference them.

### 5.2 Workspace layout (same for every tool)

- Left: the ticket thread (stakeholder messages, attachments, deadline, priority).
- Centre: the tool.
- Right: checks (pass or fail only), hints with penalties, time.
- Top: the sprint board for the week.
- On submit: an evidence record (tool, inputs hashed, check results, verification type).

### 5.3 SQL roles: engine

- Keep sql.js for entry-level query tickets.
- Add PGlite (Postgres compiled to WebAssembly, runs in the browser) for developer and DBA tickets: window functions, CTEs, EXPLAIN, indexes, transactions, functions, triggers. Grading re-runs the user's final script on the server against the same instance.
- Trade-off: Postgres dialect only. MySQL and SQL Server differences are noted in ticket text. Verify PGlite licence and bundle size before adopting.

### 5.4 Role tracks

**Data Analyst** (extend): SQL, spreadsheet, dashboard, statistics, data cleaning, plus Python (browser-verified, labelled as such until a server sandbox exists).

**Business Analyst** (new):
- Requirements: user stories with acceptance criteria in a structured form. Rule checks (format, completeness, traceability) plus an AI quality judge. Label: AI-assessed.
- Stakeholder scenarios: branching dialogue where the user picks clarifying questions. Scored against hidden "must-ask" items. Auto-verified.
- Process mapping: a simple node-and-edge diagram editor graded structurally against a reference. Auto-verified.
- UAT and test cases: given a spec and a hidden list of seeded defects, write test cases. Scored by defect coverage. Auto-verified.
- Prioritisation: MoSCoW / RICE scoring in the calculation worksheet. Auto-verified.
- Data for decisions: reuses SQL, spreadsheet and dashboard tools.

**SQL Developer / BI Developer / Database Admin** (new roles, shared tool):
- Query writing, query debugging, performance (read an EXPLAIN plan, add an index, graded on plan and cost), schema design (DDL checked against valid and invalid sample inserts), safe data changes and transactions, functions and triggers, data-quality fixes, and for the DBA role, backup and recovery scenarios.

### 5.5 Proof and anti-fake rules

- Per-user generated data (seeded by user and ticket) so answers cannot be shared.
- Hidden checks and server-side grading only; the browser never sees expected values.
- Evidence status stays as in `lib/arena-runtime/types.ts`: VERIFIED_AUTOMATED, NEEDS_REVIEW, UNVERIFIED. The Passport shows "auto-verified" or "AI-assessed" per work sample.

### 5.6 Plan linkage (proposal, not committed)

- Free: 1 ticket a week. Pro and Elite: a ticket a day. Real counts need the usage counter (not built).

## 6. Milestones

| # | Milestone | Done when | Estimate |
|---|---|---|---|
| M1 | Platform core: companies, sprints, workspace layout, seeded data generator | One Data Analyst sprint plays end to end with different data per user | 3-4 weeks |
| M2 | Data Analyst content | 3 company worlds, about 12 tickets each across easy, medium and hard, all validated | 2-3 weeks |
| M3 | SQL roles: PGlite engine and tickets | Index and EXPLAIN ticket graded correctly on the server | 3-4 weeks |
| M4 | Business Analyst tools and content | Five BA skill areas playable, badges shown | 4-5 weeks |
| M5 | BI Developer and DBA tracks | Roles enabled with content | 2-3 weeks |
| M6 | Passport proof and Python (browser-verified) | Work samples visible on the Passport | 1-2 weeks |

## 7. Content plan

- About 36 tickets per role as a launch target (3 worlds x 12). Five roles is about 180 tickets, many shared across roles by tool.
- Generate with AI from role, skill and difficulty, validate by running the reference solution, then a human spot-checks a sample before publishing.
- Cost: roughly Rs 1-3 per generated ticket, so the generation bill is small. The real cost is review time.

## 8. Risks and open decisions

1. Business Analyst grading is partly AI-assessed; keep the badge honest.
2. PGlite adoption needs licence, size and sandbox checks.
3. Postgres-only SQL may not match every employer's dialect.
4. Python for analysts stays browser-verified until a server sandbox is available.
5. Human review capacity limits how fast content can be published.
6. Confirm the final role list in section 2.

## 9. Status (updated)

Built: company warehouse per user, 21 SQLite tickets (Data Analyst), 19 PostgreSQL tickets (four database roles) on PGlite, 8 spreadsheet and 6 cleaning tickets on the company data, experience levels, weekly sprint board, in-house SQL executors (no public code-runner for SQL).
Migrations written, not applied: 102 (plan tiers), 103 (sprints), 104 (database roles).
Not built: MySQL, T-SQL and PL/SQL engines, Business Analyst tools, dashboard/Power BI-style tickets on the company data, report writing, backup/restore and EXPLAIN tuning tickets, Passport evidence view.
