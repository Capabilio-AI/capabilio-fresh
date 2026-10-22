# Capabilio Labs and Proof Sessions

Design for how every role gets real-world tasks and proves skills by doing them. It combines two models the team looked at:

- **LabEx-style Labs:** short tasks in a live environment, verified by checks on the final state, with a daily task and themed quests.
- **OpenRound-style Proof Sessions:** a longer realistic project with AI allowed, a play-by-play report scored on six dimensions, and a live discussion.

It builds on `workstation-design.md` (the 44 workstations W01-W44 and the 45 roles). Nothing here is built unless marked **[exists]**. Capabilio's difference stays the same: the output is **evidence for the student's portfolio**, not a recruiter score and not a certificate.

## 1. The two modes and the path

| | **Lab** | **Proof Session** |
|---|---|---|
| Purpose | practise and prove one skill | prove you can do a piece of the job end to end |
| Length | 10-30 min | 60-120 min |
| Task | one ticket, one workstation, a stated starting state | a connected mini-project: several linked tickets or one realistic ticket with ambiguity |
| AI | off, or limited hints | allowed, fully recorded |
| Verified by | checks on the result (visible and hidden) | the same checks, plus a rubric over the recorded session, plus an interview |
| Output | pass/fail with per-check feedback, rating change | report with six-dimension scores, timeline, artifacts, interview result |
| Cadence | one per day per role (existing 24 h cooldown) | a milestone, unlocked after enough passed Labs in the role |

**Quests:** themed series of Labs (for example "30 days as a Data Analyst", "30 days of Kubernetes") that award a passport badge on completion.

**Role path:** Fresher, then Junior, then Mid, using the existing experience levels. Higher levels unlock harder Labs and Proof Sessions. The existing Plan B and Domain unlock rules do not change.

## 2. What the student sees

1. **Role home:** today's Lab, the quest in progress, area coverage (which skills are verified), the next Proof Session and what unlocks it.
2. **Workbench:** the brief (who is asking, what is needed, acceptance criteria), the workstation for the role, a task panel with checks, an AI panel (when the mode allows), a timer, and draft autosave.
3. **Result:** per-check results (never expected values), what to revisit, retry rules, rating change.
4. **Proof Session report:** score and six-dimension breakdown, a timeline of what the student did, artifacts, check results, interview result, and a plain statement of what this does and does not prove.
5. **Portfolio:** the evidence entry, shared only if the student chooses.

## 3. Architecture

### 3.1 Lab spec (versioned data, not code)

Each Lab or Proof Session is a spec stored in the database and loaded by one engine:

- role ID, skill area, difficulty, level, version
- brief, requester, scenario, acceptance criteria
- workspace template (which workstation, starter files or data, or a generated dataset from a per-student seed)
- **checks:** visible and hidden, each with a type, weight, and whether failing it is a hard fail
- AI policy: `off`, `hints` or `full`
- time limit, retry rules, variant seed rules
- rubric version
- execution tier: browser, simulator, or executor

This replaces ad hoc per-tool content. **[exists in part]** Generated tickets already store content and an answer key in `arena_challenges`; the spec generalises that.

### 3.2 Environment providers (one interface, three backends)

```
provision(spec, student)  -> session
observe(session)          -> events
snapshot(session)         -> artifacts
verify(session, checks)   -> check results   // server side only
teardown(session)
```

- **Browser provider [exists]:** the current tools (SQL, spreadsheet, BI, stats, cleaning, investigation, notebook, code function, config editor). The browser holds the work; the server verifies the submitted artifacts.
- **Simulator provider [new]:** deterministic engines we write (CI runner, IAM evaluator, CPM scheduler, PLC interpreter, and so on).
- **Executor provider [needs executor]:** an isolated machine with a terminal and a real repository. Not available today; see section 8.

A Lab names its provider. The same verifier and recorder work across all three.

### 3.3 Verifier

Check types, all run on the server, never trusting a client-supplied result:

| Type | Example |
|---|---|
| result equality | SQL result set matches the reference |
| value within tolerance | a computed load, link budget or yield |
| artifact structure | a BOQ with correct units and totals; a BRD with testable criteria |
| invariant | cleaned data still reconciles to the source total |
| hidden tests | a test suite the student never sees (executor, or browser-run with outputs compared) |
| state check | a file contains a setting, a service answers, a policy allows only the intended action (executor or simulator) |
| safety hard fail | an interlock fails, protected data is exposed, a destructive step is taken |

The existing check model in `lib/arena-challenges/checks.ts` is the starting point; it has not been reviewed for fit.

### 3.4 Session recorder

An append-only log of timestamped events written by the server: opened, file saved, command run, query run, check run, AI prompt and reply, hint used, submit. It feeds the play-by-play, the interview questions and the integrity checks. Students can read their own log. It is never public unless they share it.

### 3.5 AI assistant policy

- **`off`:** no assistant.
- **`hints` [exists]:** the current helper: 3 uses per attempt, 5 points off the score per use, replies scanned so they cannot reveal check answers (`ai-help-rules.ts`).
- **`full` (Proof Sessions):** unlimited use, every exchange logged, no score penalty for using it. The answer-leak guard still applies to hidden checks. Use is judged on how well it is used, not whether it is used.

### 3.6 Scoring: what decides pass or fail

- **Pass or fail comes only from the checks.** An AI judge never decides a pass.
- **The six dimensions** are scored from the session log against a versioned rubric, with the evidence excerpt shown next to each score:
  - **Analysis:** understood the problem and the data.
  - **Discovery:** found the relevant facts and constraints.
  - **Planning:** chose an approach before acting.
  - **Judgement:** made sound trade-offs and caught problems.
  - **Execution:** correct, complete, clean result (mostly check-driven).
  - **AI Collaboration:** gave the assistant good context, verified its output, corrected it.
- Dimension scores are labelled "assessed from your session", with the limits of that assessment shown.

### 3.7 Interview

Reuse the explain-your-work interview **[exists]**: 4 questions, pass at 50, up to 2 tries, rating awarded only if the explanation holds. For Proof Sessions the questions are drawn from the student's own log (why this approach, what the AI got wrong, what they would change). A live human discussion is out of scope for students; a future employer-facing option is separate.

### 3.8 Integrity

Server-timed sessions, one active session per student, per-student generated variants from a seed, hidden checks, the interview, similarity checks across students, and the AI log. We do not claim proctoring or identity verification.

### 3.9 Evidence

A passed Lab or Proof Session writes evidence through the existing atomic completion path (`complete_workstation_attempt`, evidence record, rating, portfolio entry). The record states the role, area, tool, tier, rubric version and what was verified. Claims stay task-specific ("passed 8 of 9 checks on a simulated sales analysis"), never "certified".

## 4. Every role: example Lab and Proof Session

Runtime: **B** browser tools, **S** simulator we write, **W** WASM engine (needs a spike), **E** isolated executor (not available). A role marked with two letters starts on the first and gains the second.

### IT
| Role | Daily Lab | Proof Session | Runtime |
|---|---|---|---|
| IT-01 Data Analyst | find why weekly revenue dropped using SQL | clean, analyse and present a quarter of sales data: profile, SQL, metric check, dashboard, findings | B |
| IT-02 Backend Developer | fix a pagination bug in a handler | implement and test a small order API from a contract, with AI | B then E |
| IT-03 Frontend Developer | fix a form's accessibility errors | build a responsive, accessible signup flow, with AI | B then E |
| IT-04 Full Stack Developer | trace a failing request across layers | add one feature end to end behind a flag | B then E |
| IT-05 Data Engineer | add a quality check to a failing load | build an incremental pipeline with late data and a backfill | S |
| IT-06 BI Developer | fix a double-counting measure | model a star schema, define metrics, build the report | B |
| IT-07 AI/ML Engineer | find the leakage in a model | beat a baseline, document, and write the serving config | B |
| IT-08 Data Scientist | read an A/B test correctly | design an experiment and analyse the result | B |
| IT-09 DevOps Engineer | repair a failing CI workflow | design a safe deploy with rollback, then handle an incident | S then E |
| IT-10 Cloud Engineer | write a least-privilege policy | design a small secure network and cut its cost | S |
| IT-11 SOC Analyst | triage 10 alerts | investigate an incident across logs and write the report | S |
| IT-12 Pentest / AppSec | find the injection in supplied code | threat-model a login flow, review code, rate and fix findings | S then E |
| IT-13 DBA / SQL Developer | speed up a slow query with an index | diagnose and fix a production database slowdown with a safe migration | B then E |
| IT-14 Software Engineer | implement to a spec with edge cases | refactor an existing module without breaking its tests, with AI | B then E |
| IT-15 QA Automation | design cases for a coupon feature | build an automated suite that catches seeded defects | B then E |

### ECE and EEE
| Role | Daily Lab | Proof Session | Runtime |
|---|---|---|---|
| ECE-01 Embedded | debounce a button and drive an LED | build a sensor-to-serial state machine against a virtual board | W |
| ECE-02 VLSI | pass a FIFO testbench | write a testbench that exposes a seeded design bug | W (blocked if no simulator) |
| ECE-03 Electronics Design | pick resistors for a tolerance budget | design a regulated supply to spec | W |
| ECE-04 RF | close a link budget | find an interferer and propose a fix | B/S |
| ECE-05 Test and Validation | write a test procedure for a spec | isolate a failing stage and produce a traceability matrix | S |
| EEE-01 Electrical Design | size a breaker and cable | produce a load schedule and voltage-drop check for a small building | S |
| EEE-02 Power Systems | fix an undervoltage with load flow | study a fault and coordinate two relays | S/B |
| EEE-03 PLC | write a start/stop with interlock | automate a fill-and-drain tank sequence safely | S |
| EEE-04 Electrical Maintenance | plan a PM schedule | diagnose a motor from readings and write the failure report | S |
| EEE-05 Solar Design | check string voltage across temperature | size a system for a load and estimate payback | S |

### Civil and Mechanical
| Role | Daily Lab | Proof Session | Runtime |
|---|---|---|---|
| CIVIL-01 Site | list a pour sequence from a drawing | run a week of site records and raise the right issues | S |
| CIVIL-02 Estimation | takeoff for a retaining wall | price a small BOQ and compare tenders | S |
| CIVIL-03 Structural | analyse a beam | design checks for a small frame (educational) | S |
| CIVIL-04 Planning | find the critical path | forecast completion and explain a delay | S |
| CIVIL-05 QA/QC | accept or reject a concrete batch | run a quality closeout with NCRs and a trend | S |
| MECH-01 Mechanical Design | tolerance stack-up | model a part to dimensions with a drawing check | W (or calculation-only) |
| MECH-02 Manufacturing | balance a line to takt | plan a week of production around a bottleneck | S |
| MECH-03 Quality | read a control chart | capability study and an 8D report | S |
| MECH-04 Reliability | fit a Weibull | plan spares and maintenance for a service level | S |
| MECH-05 HVAC | compute a cooling load | size a duct and select equipment for a zone | S |

### MBA and MCA
| Role | Daily Lab | Proof Session | Runtime |
|---|---|---|---|
| MBA-01 Business Analyst | turn an email into testable stories | map a process, find gaps and define KPIs | B |
| MBA-02 Financial Analyst | variance bridge | build a forecast model with scenarios | B |
| MBA-03 Growth Analyst | find where a funnel leaks | analyse a campaign and an A/B test, then recommend | B |
| MBA-04 Talent Acquisition | compute time-to-hire | run a screening pipeline fairly and privately | S |
| MBA-05 Supply Chain | set reorder points | plan inventory and suppliers for a service level | S |
| MCA-01 Application Developer | add validation to a CRUD form | deliver a small multi-layer feature | B then E |
| MCA-02 ERP Developer | fix a permission leak | configure an approval workflow and its data mapping | S |
| MCA-03 Data Apps Engineer | remove an N+1 query | ship a safe migration for a live table | B then E |
| MCA-04 Cloud Support | trace a login failure | handle a service incident from ticket to runbook | S |
| MCA-05 Test Automation | remove a flaky test | build a page-object framework with fixtures | B then E |

## 5. Quests, daily Lab and badges

- **Daily Lab [exists in spirit]:** one open ticket at a time, the next unlocks 24 hours after a pass (`daily.ts`). Unchanged.
- **Quests [new]:** a quest is an ordered list of Lab specs for one role plus a completion rule. Progress shows on the role home. Completion issues a badge through `lib/passport/badges.ts`, and badges must come only from demonstrated work (existing rule).
- **Sprint board [exists]:** the weekly sprint view stays as the planning surface.

## 6. Data model (additive, no destructive changes)

New tables, owner-only read, service-only write, no deletes of evidence:

| Table | Purpose |
|---|---|
| `lab_specs`, `lab_spec_versions` | the versioned specs |
| `lab_sessions` | one row per attempt: student, spec version, provider, status, start and end, link to the existing assignment |
| `session_events` | append-only recorder |
| `check_results` | per check, per run, with the spec version |
| `session_reports` | six-dimension scores, summary, rubric version |
| `quests`, `quest_steps`, `quest_progress` | quests and progress |

Existing tables stay: `arena_domain_assignments`, `arena_challenges`, `arena_skill_ratings`, evidence and the portfolio. A session links to its assignment, so cooldown, ratings and evidence keep one source of truth.

## 7. Build plan

**Phase 1: no executor.** Lab engine, verifier, session recorder, AI policy, reports, quests, on the browser tools that already exist. First vertical slice is Data Analyst: a Lab and a Proof Session using the six tools plus the recorder and report. This proves the whole chain without any new infrastructure.

**Phase 2: simulators and WASM spikes.** Build the S-runtime engines role by role. Run the Verilog, geometry and AVR spikes; a failed spike makes that role BLOCKED, not simulated.

**Phase 3: executor.** Terminal Labs and real-repository Proof Sessions for the software, DevOps, cloud and security roles.

Until Phase 3, a Proof Session for a software role runs on the function-level editor with the AI panel and is labelled that way. We do not claim "a real codebase with an AI CLI" before it exists.

## 8. Executor requirements and cost

Required: isolation per session (microVM or container), network egress denied by default with an allow-list only when a Lab needs it, CPU, memory, disk and time limits, a session time-to-live, snapshots for verification, and teardown that always runs. Vercel Sandbox is a candidate because the app is on Vercel, but its limits, network controls and pricing must be checked before relying on it.

Real environments cost money per session. LabEx limits free users to 3 machines a day, which shows the pressure. Capabilio would tie executor Labs to the existing Free, Pro and Elite plans with a per-student daily cap, and measure cost per session before launch.

## 9. Security and safety

- No student code runs in the app process. Browser-run work is checked as submitted output; executor work runs only in the isolated machine.
- Scores and pass flags come from the server only. The client never supplies them.
- Event logs and AI transcripts are private to the student by default, with the same retention and consent rules as the rest of the portfolio.
- Security Labs (IT-11, IT-12) use synthetic logs and supplied code or an isolated target, never real third-party systems.
- Engineering Labs state units, assumptions and tolerances, and are educational only.
- A failed check engine or executor never becomes a pass: the session stays open and retryable.

## 10. What this does not claim

- It does not certify anyone or imply job readiness.
- Six-dimension scores are assessed from a recorded session, with stated limits. They never decide pass or fail.
- Browser-run work proves the outputs were right, not that the student wrote the code.
- Roles marked W or E are not live until their spike or the executor decision is done.

## 11. Decisions needed

1. Approve Phase 1 and the Data Analyst vertical slice as the first build.
2. Decide whether to invest in the executor, and set a per-session cost ceiling.
3. Decide whether Proof Sessions stay student-private or may be shared with employers on the student's consent.
4. Choose which spikes (Verilog, geometry, AVR) to run first.
