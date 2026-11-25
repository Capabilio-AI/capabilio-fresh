# Data Scientist: the job-ready path (Beginner to Expert)

Design for how a B.Tech student becomes job-ready as a Data Scientist inside Capabilio. It builds on `workstation-design.md` and `labs-and-proof-sessions-design.md`, and it reuses what exists. Nothing here changes the portfolio, skill graph, skills or role rating flows: it only feeds them more, better evidence.

## 1. What already exists (IT-08, do not rebuild)

| Piece | State |
|---|---|
| Role blueprint `lib/arena-roles/blueprints/data-scientist.ts` | 7 assessed competencies, 6 enabled areas |
| Areas | exploratory-analysis, experiment-design, feature-engineering, model-building, model-evaluation, data-storytelling |
| Workstations | Data Science Notebook (Pyodide: numpy, pandas, scipy, scikit-learn), Stats Lab, Findings Desk (SQL on BrightCart) |
| Grading | computed-key from fresh per-student data; predictions scored on hidden labels; explain-your-work interview |
| Evidence | tickets graded per check, notebook code kept for the interview, role rating ledger, skill-gap picker (`skill-gap.ts`) |
| Learning | SkillStudio role modules read from the career roadmap graph |

**Not assessed today (stated, never claimed):** regression with a continuous target, charts and visual design, written communication, causal inference beyond randomised tests. There is also no ordered path, no gate between levels, and no end-to-end project or pressure scenario.

## 2. The student's view (3rd and 4th year)

A 3rd-year student asks: "What do I need to know, in what order, and how do I show a recruiter I can really do it?" A 4th-year asks: "Can I handle a real Monday morning?" The path answers both with four levels. Each level has the same shape, so it is easy to understand:

1. **Learn:** 5 to 6 short lessons (Predict, Build, Prove, like the language courses) in SkillStudio, on the Data Science roadmap skills of that level.
2. **Labs:** 4 to 6 Arena tickets on the real workstations, one skill each, graded by checks.
3. **Proof Session:** one longer, realistic, connected project that ends the level (45 to 120 minutes).
4. **Gate:** pass the labs and the Proof Session to prove the level. Only then does the next level open. One after one, never skipping.

## 3. The four levels

### Level 1, Beginner: "Read the data" (start of 3rd year)
- **Learn:** pandas and SQL for analysis, summary statistics, missing data and outliers, reading a distribution, joining tables.
- **Labs:** profile first-order delay (Stats Lab); clean a messy export (cleaning engine); answer three business questions with SQL (Findings Desk); spot a Simpson's paradox; correlation is not cause.
- **Proof Session: "The returns spike".** Monday, 9:10. The ops lead says returns doubled. You get the warehouse and a CSV. Find the three facts behind it and report them. Graded on the facts and checked against the data.
- **Proves:** ds.eda, SQL, data cleaning.

### Level 2, Intermediate: "Decide with evidence" (3rd year)
- **Learn:** hypothesis tests and confidence intervals, A/B test design, power and sample size, feature engineering without leakage, plotting.
- **Labs:** size a test before it runs; read a finished A/B test; fix an experiment with a peeking mistake; prepare features with the scaler learnt on training rows only; build a chart to a spec (new, section 5).
- **Proof Session: "The checkout test".** The PM wants a ship decision on a finished test with a sample-ratio problem. Decide, and explain the risk in the answer sheet.
- **Proves:** ds.inference, ds.experiments, ds.features, plus the new chart skill.

### Level 3, Advanced: "Build the model" (end of 3rd year)
- **Learn:** classification and regression, cross-validation, thresholds, calibration, class imbalance, feature importance, error analysis.
- **Labs:** predict course completion on unseen rows; regression on a continuous target (new); find the cheapest decision threshold; compare two models honestly; find leakage in a "too good" model.
- **Proof Session: "Churn, end to end".** Raw tables to a model to a business threshold. AI allowed and recorded. Score on hidden labels plus the six-dimension report and the interview.
- **Proves:** ds.modelling, ds.evaluation, regression.

### Level 4, Expert: "Hold up on the job" (4th year, job-ready)
- **Learn:** monitoring and drift, causal thinking (difference-in-differences), experiment pitfalls, writing a decision memo, handling pushback.
- **Labs (under time pressure):** a model's accuracy fell 9 points overnight, find why in 30 minutes (new drift lab); a feature pipeline silently shifted; diff-in-diff on a regional rollout (new); a stakeholder challenges your number, defend it with the data.
- **Proof Sessions (two, 90 to 120 minutes, no hints):**
  - **"The bad Tuesday".** Dashboard numbers dropped, the CEO is asking, and two stakeholders push different stories. Mid-task messages arrive (a chat feed on a timer). You need the root cause and a recommendation.
  - **Capstone: "Own a model".** Pick up a half-built model from a "colleague", audit it, fix it, set the threshold, write the handover. Then the explain-your-work interview.
- **Proves:** monitoring, causal basics, storytelling under pressure, and the whole role.

## 4. Pressure, on purpose

Beginner and Intermediate teach. Advanced and Expert imitate a job: ambiguous briefs, messy data, a countdown, stakeholder messages that arrive mid-task, hidden checks, and no hints at Expert. Every pressure feature is explained before the session starts, so it is fair. A failed session shows what was missed and offers a retry on a new seed (new numbers, same skill).

## 5. What is new to build

| New | Why | Grading |
|---|---|---|
| Path engine for roles: levels, gates, "open one after one" | the missing spine | pure functions plus a table of level proofs, like the language levels |
| Chart lab (visualisation) | closes an unassessed skill | evaluated-spec: the student's chart spec is checked against the data |
| Regression tickets | closes an unassessed skill | computed-key on a numeric tolerance |
| Drift and monitoring lab | the main real-job failure | computed-key (which feature shifted, by how much) |
| Difference-in-differences lab | causal basics | computed-key |
| Proof Session runner for this role | the end-to-end project | existing runner design, plus the timed message feed |
| 4 levels of lessons | job-ready learning | authored and verified by the runner pipeline |

Honest limits to keep: written report quality is not scored (only the facts and decisions in it); charts are checked as specs, not as design; the notebook runs in the student's browser, so the interview is the only check of how they worked.

## 6. How it connects (nothing is disturbed)

- **Skill graph and skills:** every passed lab or session writes the same evidence rows the current areas write. A level is proven only through them; the roadmap's skill levels move because of that evidence.
- **Portfolio:** each lab pass, each Proof Session report and the capstone become portfolio artifacts, shared only if the student chooses (as today).
- **Role rating (ELO):** unchanged. Level gates sit on top.
- **Weak skills:** the existing skill-gap picker chooses the next lab inside the open level, so a student weak in leakage gets leakage labs first.
- **Certificate:** like the language certificate, a "Capabilio Data Scientist" credential needs all four levels, with the evidence of each.
- **Arena vs SkillStudio:** the lessons live in SkillStudio; every proof lives in Arena. Finishing a lesson's questions sends the student to the matching lab, and passing it sends them back to the next lesson, the same flow as the language courses.

## 7. Build order

1. **Path spine:** levels and gates over the 6 existing areas, with the level screen and portfolio hooks. No new workstation, so it ships fast and safely.
2. **New labs:** regression, chart, drift, diff-in-diff.
3. **Proof Sessions:** Beginner and Intermediate first, then Advanced, then the two Expert sessions.
4. **Lessons:** authored per level with the runner pipeline.
5. **Credential:** the signed Data Scientist certificate.

## 8. Status

**Built (PR "Data Scientist path"):** the path spine and the four Proof Sessions, composed from the six existing areas (`lib/arena-roles/sessions/data-scientist-path.ts`). Levels open one after another (`ladderStatus` in `lib/arena-roles/session/service.ts`); a level is proven when its session is finished (every stage passed and the explain-your-work interview done). Stage results are ordinary graded attempts, so skills, portfolio and the role rating update exactly as they do for daily tickets. No database change was needed.

**Not built yet:** regression, chart, drift and difference-in-differences labs; the timed stakeholder message feed; the four levels of lessons; the Data Scientist certificate. Until the new labs exist, Levels 1 to 4 differ in how many existing areas they combine, not in new tools.
