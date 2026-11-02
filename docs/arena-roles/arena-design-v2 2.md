# Arena design v2: launch roles, built from what colleges upload

Status: design, 2026-10-31. Extends `lib/arena-roles/catalog.ts` (45 roles, stable IDs) and `workstation-design.md`. Nothing here replaces them.

## 1. Principles

1. **Arena is real work, never multiple choice.** Every task is a scenario ticket: a brief from a named requester, a generated dataset or drawing parameters, and an answer the server computes. MCQs exist once, as the sign-up screen for the student's chosen role (`assess_question_pool`), and can lift a skill to 40 at most.
2. **Proof raises scores.** A skill is proven only by passed Arena tasks or verified proof of work (`SCREEN_CAP = 40`, `PRACTICAL_STEP = 15` in `lib/assess/scoring.ts`).
3. **The server owns the answer.** Seeded generators produce data and the key; AI writes scenario wording offline, in batches, into a bank. Serving a task is a database read (no per-student LLM call).
4. **Weak skills first.** Next task = the skill with the largest `weight x (target - score)`; unproven skills before partly proven ones; never an area twice in a row, never a template already completed.
5. **Build tools, then roles.** A role is cheap once its tool exists.

## 2. Launch set (`lib/arena-roles/launch.ts`)

15 IT roles (the full catalog IT stream) and three per branch, chosen by **compulsory** courses in the published uploads, since electives differ by college:

| Branch | Roles | Curriculum evidence (core courses) |
|---|---|---|
| MECH | Mechanical Design, Manufacturing/Production, Thermal/HVAC | Machine Elements, Mechanics of Solids, FEM; Manufacturing Processes, Machine Tools & Metrology; Thermodynamics, Heat Transfer |
| CIVIL | Site, Structural Design, QS/Estimation | Surveying, Concrete, Building Materials; Structural Analysis, RCC/Steel design; Estimation, Specifications & Contracts, Valuation |
| ECE | Embedded, VLSI Design/Verification, Communication/RF | Microcontrollers, Embedded; Switching Theory, HDL, VLSI; Analog/Digital Communication, DSP, Antennas |
| EEE | Power Systems, Industrial Automation/PLC, Electrical Design | Power Systems I/II, Switchgear & Protection; Control, Drives, PLC; Machines, Circuits, Power Electronics |

Data seen on 2026-10-31: 10 curriculum imports from 2 colleges (CSE/IT/AI 6, ECE 1, EEE 1, Mechanical 1, Civil 1). Thin: re-check this table as colleges upload, and prefer a role whenever more colleges' core courses back it.

## 3. How a branch student meets Arena

- **Stream track (course-linked, from 2-1):** tasks written about the student's own current courses (Thermodynamics, Surveying...). Calculation tickets and hands-on missions only (no concept questions).
- **Domain track (role-linked):** the role's workstation areas, ranked by skill gap (section 1.4). This is what moves readiness for the chosen role.
- Course -> skill mapping (already built for roadmaps) decides which role skills a course feeds, so a student sees "Heat Transfer -> Thermal/HVAC".

## 4. Tools (one tool serves many roles)

| Tool | Status | Roles |
|---|---|---|
| Python notebook (Pyodide: numpy, pandas, scikit-learn, scipy) | exists (`ml_workspace`) | AI/ML, Data Scientist, Data Analyst; **also the engineering-calculation bench** for Mech/Civil/ECE/EEE tickets (scipy covers beam, heat and circuit numerics) |
| SQL lab, spreadsheet, BI, cleaning, stats | exist | Data Analyst, Data Engineer, BI, DBA; spreadsheet also for QS bills of quantities |
| Code lab (browser JS/Python, hidden unit tests) | partly (`code_workspace`) | Backend, Frontend, Full Stack, SDE, QA Automation |
| Config lab (Docker/YAML/Terraform checked by rules) | to build | DevOps, Cloud |
| Security log lab | areas exist | SOC, Pen Testing/AppSec |
| Domain solvers: circuit (nodal DC/AC), beam/truss, logic-network equivalence, PLC ladder | to build, in this order | EEE/ECE circuits, Civil structural, VLSI digital, PLC |

Honest limits are stated per role in its blueprint (no CAD, no HDL toolchain, no GPU): never claim a skill a tool cannot assess.

## 5. Role-complete gate (`npm run arena:gate`)

A role is READY only when: >= 12 skills; sign-up bank >= 30 per skill; >= 6 enabled areas; every area linked to a skill; every critical/high skill provable by at least one area. Template depth (3 per critical/high skill: easy, medium, hard) is checked by the role's blueprint test. A role that is not READY shows students "assessment only, Arena coming" and is excluded from job-ready claims.

Baseline 2026-10-31: **0 / 27 ready.** Common gaps: 14 IT/branch roles have no skill list at all; 12 roles have areas that are linked to no skill; 9 have no workstation; Data Analyst still has 3 unlinked areas and 4 of 9 critical/high skills unprovable.

## 6. Order of work: IT first, end to end

Decision 2026-10-31: all 15 IT roles are finished end to end before any branch role starts (`LAUNCH_ROLES` = IT; `BRANCH_WAVE_ROLES` = wave 2). Product promise: a student or recent graduate proves each skill by doing Arena tasks; nothing is claimed from answers alone.

**Platform layer (done in code, not yet applied):** proof-capped readiness and job-ready gate; no MCQ in Arena; workstation passes write evidence for every skill an area proves (migration 149); next task = biggest skill gap (`lib/arena-workstations/skill-gap.ts`); `npm run arena:gate`.

**Per-role pipeline (the same five steps for every IT role):**
1. Skill list: 12 to 18 skills with importance, target and weight in `career_skill_requirements`.
2. Sign-up screen: >= 30 questions per skill (`assess:pool`), the only MCQs in the product.
3. Workstation: >= 6 areas on a tool that exists, every area linked to the skills it proves.
4. Templates: >= 3 scenario variants (easy, medium, hard) for every critical and high skill, answer keys computed by the server.
5. Gate green, then the role is switched on; until then students see "assessment only, Arena coming".

**Baseline per IT role (`arena:gate`, 2026-10-31): 0 / 15 ready.**

| Role | Blocking gaps |
|---|---|
| IT-01 Data Analyst | 3 areas unlinked; 4 of 9 critical/high skills unprovable (Data Analysis, Power BI, Problem Solving, Formulas) |
| IT-02 Backend, IT-03 Frontend | no skill list; areas unlinked; Backend migration 113 is not applied to production |
| IT-04 Full Stack | no workstation; a 17-skill career exists under `full-stack-developer` |
| IT-05 Data Engineer, IT-06 BI, IT-13 DBA | no skill list; areas unlinked; BI and DBA have 4 areas (need 6) |
| IT-07 AI/ML | 8 areas unlinked (fixed by 149); sign-up bank short on 13 skills; 9 more templates areas needed (see AI/ML plan) |
| IT-08 Data Scientist, IT-10 Cloud | areas unlinked; sign-up bank short on 15 skills |
| IT-09 DevOps, IT-11 SOC, IT-14 SDE | no skill list; areas unlinked |
| IT-12 Pen Testing, IT-15 QA Automation | nothing built; skills exist for `cybersecurity-analyst` (16) |

Two cross-cutting fixes first: (a) the catalog's `domainRoleKey` and the `careers.key` differ for several roles (`full-stack-developer`, `cybersecurity-analyst`, `software-engineer`, `ai-embedded-systems-engineer` hold skill lists the catalog roles cannot see), so the catalog needs an explicit `careerKey`; (b) one script links every area to its skills instead of per-role SQL.

**Build order for tools (each unlocks several IT roles):** (1) Python notebook, SQL lab, spreadsheet, BI: exist, finish Data Analyst, AI/ML, Data Scientist, Data Engineer, BI, DBA; (2) Code lab with hidden tests: Backend, Frontend, Full Stack, SDE, QA Automation; (3) Config lab: DevOps, Cloud; (4) Security log lab: SOC, Pen Testing. Branch roles (section 9) follow.

## 7. Reference platforms: what we take and what we do not

Read 2026-10-31 from each site's landing page. LabEx returned 403 and OpenRound returned no content, so nothing is claimed about them; Kaggle, MathWorks and the tools in the branch screenshots (Tinkercad, Wokwi, EDA Playground, Falstad, LTspice, Simulink, Onshape, SimScale, Autodesk) are described from general knowledge, not fetched.

| Platform | Pattern worth taking | How it lands in Arena |
|---|---|---|
| TryHackMe | Role paths of hands-on rooms; browser machine; easy/intermediate/hard; streaks | A role path is an ordered set of scenario packs, one per skill, each opened in the browser, gated by the skill-gap ranking |
| StrataScratch | Questions tagged company, role and difficulty; typed table schemas; AI scoring of written answers on completeness, accuracy, depth, structure | Tickets keep a named requester and a typed dataset; the explain-your-work interview scores the written reasoning with that rubric |
| Kaggle | Hidden test labels, leaderboard | Already how the ML notebook grades; add per-ticket leaderboards for cohort/college |
| CircuitLab / Falstad / LTspice | Transient, AC and sweep analysis in the browser; shareable circuit links | Our own **Circuit bench** (section 8): the student builds a netlist, the server simulates it and grades it against a spec |
| Tinkercad / Wokwi / EDA Playground / Simulink / Onshape / SimScale | Real tools students already use | Cannot be embedded or graded (no grading API). Used as an **external-tool task**: the student works there, submits the link or file as proof of work, and the server checks the key numbers they report against values it generated, then a short viva |
| VLabs | Simulation-based labs with a pre-test and a post-test | Same shape as ours: the sign-up screen is the pre-test, Arena passes are the post-test |
| Frontend Mentor | Design file + starter code + community review | Frontend tickets ship a design spec and starter; checks are DOM tests and a visual diff; solutions go to the portfolio |
| WayCode | Public work as the unit of reputation | Matches the vault/portfolio; verified proof lifts skills, unverified proof shows but carries no weight |

## 8. Grading models, in order of trust

1. **computed-key** (exists): server generates the data and the answer; checked within a tolerance. Calculations, deployment decisions, estimates.
2. **evaluated-spec** (exists in the blueprint types): the student submits a *design*, the server evaluates it against requirements. This is the right model for engineering because many answers are valid: a circuit that meets gain and bandwidth, a beam section that passes the code checks, a gear ratio that meets the speed target. Prefer it to matching one number.
3. **client-run** (exists): the student's code runs in their browser, the server grades outputs on hidden data.
4. **external-tool + evidence + viva** (new): for CAD, FEA, HDL toolchains and microcontroller sims. Counts as proof only after a reviewer verification (`reviewProofOfWork`) or a passed viva, never on the student's word.

## 9. Tool decisions for the branch roles

- **Circuit bench (build first):** a small modified-nodal-analysis solver (DC, AC sweep, transient) behind a netlist editor with a schematic view. Serves ECE (analog, amplifiers, filters), EEE (rectifiers, converters, power factor correction) and Electrical Design. Graded by evaluated-spec (gain, ripple, power factor, efficiency). Check the licence before reusing any existing simulator source; Falstad's CircuitJS in particular is open source under a copyleft licence.
- **Structure bench:** beam and truss solver (stiffness method) plus code-check formulas, graded by evaluated-spec. Serves Structural Design and Site (reading bar-bending and quantity take-offs through the spreadsheet).
- **Engineering calculation bench:** the existing Python notebook with `scipy`. Serves Thermal/HVAC, Manufacturing (SPC, process capability, tolerance stack-up), Power Systems (per-unit, fault levels) and QS (bill of quantities in the spreadsheet).
- **Digital bench (later):** gate-level logic and FSM equivalence checked exhaustively against a truth table; real HDL stays an external-tool task.
- **Wokwi-style microcontroller sim:** external-tool task for Embedded until an in-house emulator is justified.

## 10. Project-style prompts are portfolio, not Arena tasks

The screenshots suggest "design a robotic arm", "design a residential building", "automatic streetlight". Those take days and cannot be auto-graded. They belong in the portfolio as projects with verified proof, linked to skills. Arena tasks are the 20 to 60 minute slices: size the motor, check the beam, compute the power factor correction, fix the comparator threshold.
