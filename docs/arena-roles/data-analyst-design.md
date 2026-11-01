# Data Analyst (IT-01): end-to-end design

Status: design + step 1, 2026-11-01. Extends `arena-design-v2.md` section 6. Principle: the **job** is professional; the **tasks** are what a fresher is handed in the first 6 months.

## 1. A fresher analyst's week (what Arena imitates)

| Day-to-day work | Fresher-sized task | Arena area | Skills proven |
|---|---|---|---|
| Pull numbers for a manager | "Orders and revenue per city last month" (1-2 tables, one JOIN/GROUP BY) | `sql` | SQL, Data Analysis |
| Fix a report that broke | Repair a query with a wrong join or filter | `debugging` | SQL, Problem Solving |
| Tidy a messy export | Dedupe, trim, fix dates/blanks, say what you removed | `data_cleaning` | Data Cleaning, Data Analysis |
| Monthly sheet for the team | Formulas: SUMIFS, VLOOKUP/XLOOKUP, pivots, percentages | `spreadsheet` | Excel, Spreadsheet Formulas, Data Analysis |
| Is this difference real? | Mean/median, spread, simple A/B comparison, correlation | `statistics` | Statistics, Data Analysis |
| Build the weekly dashboard | Choose the right chart and measures for a KPI brief | `dashboard` | BI/Dashboarding, Power BI*, Dashboard Design, Data Storytelling |
| "Why did sales drop?" | Slice by region/product, find the cause, write 2-3 findings | `investigation` | Data Analysis, Problem Solving, Technical Communication, Business Analysis |
| A number looks wrong in production | Trace a data incident to its source, report it | `incident` | Problem Solving, Data Analysis, Technical Communication |
| Quick analysis in code | pandas load, filter, group, plot | `python` (blocked) | Python |

\* Honest limit: the dashboard tool grades a structured chart/measure spec on real data, not Power BI itself (no DAX, no data model). The claim shown to students must say "dashboard measures and charts", not "Power BI certified". Revisit once a measures/DAX-style ticket exists (step 4).

Fresher rule: one requester, one clear question, <= 3 tables of <= 60 rows, no ambiguity about the deliverable. Difficulty rises by combining requirements, never by hiding them. Senior work (modelling, experimentation design, stakeholder negotiation) is not served.

## 2. Build steps, one after another

| # | Step | Done when |
|---|---|---|
| 1 | **Link areas to skills** (migration 151) | Gate shows no unlinked area and no unprovable critical/high skill. **Built, unapplied.** |
| 2 | **Template depth audit**: count templates per area x difficulty x level; fill any critical/high skill without easy/medium/hard fresher variants | Every critical/high skill has >= 3 fresher variants with server-computed keys |
| 3 | **Python area**: browser notebook (Pyodide, same client-run model as `ml_workspace`), pandas tickets graded on numbers; unblocks `python` | `python` enabled, Python skill provable |
| 4 | **Dashboard measures tickets**: define a measure (ratio, YoY, running total) and a chart from a brief | Power BI wording either earned or removed |
| 5 | **Work-week sprint**: a themed week of 5 mixed tickets ending in a short written summary for the "manager"; result goes to the portfolio as a case study | One sprint playable start to finish |
| 6 | **Go live**: apply migrations (151 after 149), `npm run arena:gate` green for IT-01, browser check of every area | Role switched on |

## 3. Gate expectations for IT-01 after step 1

14 skills (>= 12), sign-up bank 53-84 per skill (>= 30), 8 enabled areas (>= 6), 0 unlinked, 0 unprovable critical/high. Verify with `npm run arena:gate` once 149 and 151 are applied (the gate reads `arena_area_extra_skills`).

## 4. Step 2 result: fresher template audit (2026-11-01)

Before: fresher-level templates per area were sql 7 easy, debugging 4, spreadsheet 2 easy + 2 medium, dashboard 2 easy + 1 medium, cleaning 2 easy + 1 medium, statistics 2 easy only, **investigation 0, incident 0** (they started at junior/mid, so a fresher got nothing or fell back to harder tickets).

Added (reusing the existing fault planters and answer checker; keys still computed from the planted data): investigation `guided-channel-cancellations`, `guided-city-returns` (easy, fresher: the requester names the way to split the data); incident `guided-duplicate-load` (easy), `guided-stale-status` (medium); statistics `stat-tenure-and-basket` (medium, fresher).

Remaining depth gap: fresher *hard* tickets are intentionally absent; a fresher who clears medium moves to junior tickets via the level system.

## 5. Step 3 result: Python area (2026-11-01)

The `python` area is enabled on the existing in-browser notebook (`ml_workspace`, Pyodide): the student's code runs on their own machine, the server grades only the numbers they send. Five fixed templates on BrightCart data (`lib/workplace/analyst-python/templates.ts`): count orders and the cancel rate, delivered revenue (merge), average order value by channel (groupby), city names tidied then counted (cleaning), best month (dates). Fresher easy x2, fresher medium x2, junior medium x1. Every key was recomputed independently with Python's `csv` module and matched. Migration 152 flips the area on (after 149 and 151).

UI pass (steps shown in the browser): all five tools now look like the programs analysts use: Excel (ribbon, name box, range stats), a SQL client (navigator, highlighted editor, numbered grid), a Power BI-style report canvas, a Power Query-style applied-steps editor, a statistics workbench (data, variable view, charts; computes nothing the questions ask for), and a Jupyter-style multi-cell notebook.

## 6. Step 4 result: dashboard quick measures (2026-11-01)

The Power BI wording is earned for what it covers, and limited for what it does not. The spec gained `quick` (percent of total, running total, ratio) and `measure2` (the ratio's denominator), the same quick-measure menu Power BI offers, evaluated by the same pure `evaluateSpec` for both the answer key and the student's chart. Old specs parse unchanged (defaults `none`/`null`). Meaningless combinations are refused (a percent of an average; a ratio without a second numeric field). A pie is no longer an acceptable chart for ratios or running totals. Four tickets: share of revenue by category (fresher easy), running revenue by month (fresher medium), realised price per unit (junior medium), a quarter's channel shares (junior medium); all 30/30 seeds build, shares sum to 100, running totals never fall. Still not covered, and stated in the blueprint: DAX and data modelling.

## 7. Graduates get professional work (2026-11-01)

**Rule:** a student is a fresher; a recent graduate (`stage = graduate`) is served as a junior; professionals are graded by years in work. So graduates meet the tools at working depth instead of first-year exercises.

| Skill area | Fresher (student) | Graduate (junior) and above |
|---|---|---|
| Excel | row formulas, SUM, SUMIF, COUNTIF, VLOOKUP | + SUMIFS / COUNTIFS / AVERAGEIFS, MEDIAN, STDEV, INDEX/MATCH, XLOOKUP, PivotTables |
| Dashboard | chart + filters; quick measures (percent of total, running total, ratio) | + DAX measures: CALCULATE, ALL, DIVIDE, filter context, with a required takeaway for the reader |
| SQL | joins, grouping, debugging | + window functions (running total, month-on-month with LAG), CTEs, anti-joins |
| Python | read CSVs, count, merge, groupby, clean | + pivot_table, repeat-customer retention, month-on-month growth; city ranking at mid |
| Investigation / incident | guided: the way to split the data is named | full: find the cause unaided, and write the note to the requester |

**Communication, storytelling, business analysis.** From junior up, investigation and dashboard tickets require a short note, graded against the real answer (`lib/workplace/findings-note.ts`): it must state the key figure (rupee, lakh, crore and k forms accepted), name where the finding is (dates in ISO, "14 May" or "May 14" form), say what to do next, and be 20 to 150 words. These are number and keyword checks, not a judgement of prose, and the blueprint says so.

**DAX** is a closed interpreter (`engines/dax.ts`), not `eval`: SUM, AVERAGE, MIN, MAX, COUNT, COUNTROWS, DISTINCTCOUNT, DIVIDE, CALCULATE, ALL, IF, ROUND, ABS, SUMX, AVERAGEX, with DAX's filter-context rule. No data model or relationships.
