# Arena workstation design: the tools each role really uses

Design for the 45 roles in `lib/arena-roles/catalog.ts`. It describes what a professional in each role uses day to day, how that becomes a workstation in Arena, how it is assessed, and what it takes to build. Nothing here is built yet unless marked **[exists]**.

## 1. Principles

1. **A workstation is a real tool or an honest model of one.** Every workstation carries a tier, shown to the student and stored on the evidence record:
   - **R, runs for real.** The tool or an actual engine runs the student's work (SQLite/Postgres in WASM, Pyodide, an AVR emulator, an SPICE engine, a Verilog simulator).
   - **S, simulated.** We write a deterministic engine that models the tool's rules (a CI runner, an IAM policy evaluator, a CPM scheduler, a ladder-logic interpreter). It checks real rules but is not the vendor product, and is labelled "simulator".
   - **A, artifact + validators.** The student produces a structured document (BOQ, FMEA, BRD, test plan) and the server validates it against rules, calculations and traceability. It is never graded on prose alone.
2. **Where the student's work runs.** Browser-run work (Pyodide, WASM engines) is safe for the platform but the server only sees the outputs the browser sends (as the Code tool does today). Server-side runs of student code need an isolated executor, which does not exist yet and is marked **[needs executor]**.
3. **Grading is always server-side** against an answer key or invariants the student never receives. Tools report per-check results, never the expected values.
4. **No generic fallback.** A role lists the workstations it needs. If one is missing, the ticket is unavailable. No other role's tool is substituted.
5. **Every ticket has the same shape:** workplace brief, source assets, workstation, deliverables, acceptance checks (visible and hidden), explain-your-work interview, evidence record (role, area, tool, tier, rubric version).
6. **Educational, not certification.** Engineering and security tasks use explicit units, assumptions and tolerances. Results never imply approval of a real design, installation or test.

## 2. Shared workstation catalog

Status tags: **[exists]** built, **[extend]** built but missing capability, **[new]** not built. Roles refer to these IDs.

### Data and analytics
| ID | Workstation | Mirrors in real life | Tier | Status |
|---|---|---|---|---|
| W01 | SQL Studio | DBeaver, pgAdmin, SSMS, BigQuery console | R | **[exists]** `sql_workspace` (SQLite worker). **[extend]** Postgres semantics (the repo has `pg-runner`; PGlite is the browser option), `EXPLAIN` plans, transactions, multi-statement scripts |
| W02 | Spreadsheet | Excel, Google Sheets | S | **[exists]** in-house formula engine. **[extend]** pivot tables, finance functions, named ranges |
| W03 | BI Studio | Power BI, Tableau, Looker | S | **[exists]** dashboard spec evaluator. **[extend]** semantic model, measures (DAX-like), filter context |
| W04 | Stats Lab | R, SPSS, Python statsmodels | S | **[exists]** |
| W05 | Data Prep | Power Query, OpenRefine, pandas cleaning | S | **[exists]** |
| W06 | Investigation Desk | SQL + ticket + findings report | R | **[exists]** |
| W07 | Notebook | Jupyter, Colab | R (browser, Pyodide) | **[exists]** as the ML notebook. **[extend]** general analysis tasks; this is the safe way to turn on the blocked Python area for Data Analyst |
| W08 | Pipeline Lab | Airflow, dbt, Spark, Fivetran, Great Expectations | S + R (DuckDB-WASM) | **[new]** DAG editor, incremental load, quality checks, backfill and failure recovery on synthetic sources |
| W09 | ML Lab | MLflow, Weights & Biases, SageMaker | R | **[exists]** `ml_workspace`. **[extend]** experiment tracker, model card, drift check |

### Software engineering
| ID | Workstation | Mirrors | Tier | Status |
|---|---|---|---|---|
| W10 | Project IDE | VS Code, IntelliJ with tests, debugger, linter | R | Function-level editor **[exists]** (`code_workspace`, browser-run). Multi-file project with a real test runner **[needs executor]** |
| W11 | API Lab | Postman, Swagger/OpenAPI, curl | R + A | **[new]** HTTP client against a mock service, OpenAPI contract validation, status-code and schema assertions |
| W12 | Git Desk | Git CLI, GitHub PR review | R (isomorphic-git) | **[new]** branches, commits, merge conflicts, reviewing a diff, writing a PR description |
| W13 | Frontend Studio | VS Code + Chrome DevTools, Storybook, axe, Lighthouse | R | **[exists]** HTML/CSS editor with preview (`frontend_workspace`, text-checked). **[extend]** component sandbox, axe-core accessibility run, responsive viewports, DOM inspector |
| W14 | Config Editor | Editing Dockerfile, CI YAML, Kubernetes, Terraform, Compose | A | **[exists]** `devops_workspace` (text checks). **[extend]** JSON-Schema validation (Kubernetes, Compose, GitHub Actions), OPA/Rego policy checks, Dockerfile lint rules |
| W15 | Pipeline Console | GitHub Actions, Jenkins, GitLab CI, ArgoCD | S | **[new]** workflow YAML to simulated run graph with failing-step logs, secrets/permissions rules, rollback decisions |
| W16 | Cloud Console | AWS/Azure/GCP console + CLI, Cost Explorer | S | **[new]** IAM policy evaluator, VPC/route/security-group reachability, Terraform plan diff reader, cost model |
| W17 | Terminal Lab | Linux shell, kubectl, docker | R | **[needs executor]** (the `TERMINAL_VM` runtime is planned but disabled). Browser Linux (WebVM) is an alternative to evaluate for licence and scope |
| W18 | Observability Desk | Grafana, Prometheus, Datadog, ELK, CloudWatch | S + R (DuckDB-WASM) | **[new]** metrics/logs/traces on synthetic telemetry, alert rules, incident timeline |
| W21 | Test Lab | Jest, JUnit, pytest, Selenium, Playwright, Cypress | R (unit, browser) | **[new]** unit and API tests run in the browser against a sandbox app. UI automation on a live browser **[needs executor]** |

### Security
| ID | Workstation | Mirrors | Tier | Status |
|---|---|---|---|---|
| W19 | SOC Console | Splunk, Microsoft Sentinel, EDR console, TheHive | S | **[new]** alert queue, search over synthetic logs, case notes, ATT&CK mapping, fixed threat-intel lookup, severity and escalation decision |
| W20 | Vuln Lab | Burp Suite, ZAP, Semgrep, nmap | S (R later) | **[new]** supplied vulnerable source for secure code review, request/response replay against a modelled app, scope and authorization rules. A live vulnerable target **[needs executor]** |

### Hardware and electrical
| ID | Workstation | Mirrors | Tier | Status |
|---|---|---|---|---|
| W22 | Embedded Lab | Arduino IDE, STM32CubeIDE, PlatformIO, logic analyzer, serial terminal | R (AVR emulator in JS) | **[new]** Arduino-class MCU with virtual LED/button/sensor/serial/LCD. ARM Cortex-M is a later spike |
| W23 | HDL Lab | ModelSim, Vivado simulator, GTKWave | R (Verilog simulator in WASM) | **[new]**, needs a spike to confirm a maintained WASM simulator |
| W24 | Circuit Lab | LTspice, KiCad, Altium, OrCAD | R (ngspice in WASM) | **[new]** netlist/schematic entry, DC/AC/transient, measurement checks |
| W25 | RF and Signals Lab | MATLAB, GNU Radio, spectrum analyzer, Smith chart | R (Pyodide numpy/scipy) | **[new]** link budget, FFT/spectrum, modulation and noise, impedance matching |
| W26 | Instrument Bench | Oscilloscope, DMM, power supply, function generator, LabVIEW, traceability tools | S | **[new]** virtual instruments over a circuit model, test procedure builder, requirements-to-test matrix |
| W27 | Power Studio | ETAP, PowerWorld, DIgSILENT, AutoCAD Electrical | R/S | **[new]** single-line diagram, load flow, short-circuit, cable and transformer sizing, relay coordination curves |
| W28 | PLC Lab | TIA Portal, Studio 5000, CODESYS, WinCC HMI | S | **[new]** ladder/structured-text interpreter driving a virtual process (tank, conveyor, motor) with an HMI view |
| W29 | Solar Studio | PVsyst, Helioscope, SAM, PVWatts | S | **[new]** yield model, string voltage vs inverter window across temperature, loss waterfall, economics |

### Civil and mechanical
| ID | Workstation | Mirrors | Tier | Status |
|---|---|---|---|---|
| W30 | Drawing Desk | AutoCAD viewer, Bluebeam, CostX | A (DXF/PDF parsed in browser) | **[new]** measure tool, takeoff markup, revision compare, dimension checks |
| W31 | Structural Solver | STAAD.Pro, ETABS, SAP2000 | R/S | **[new]** beam and frame analysis (direct stiffness), load combinations, code checks (selectable code) |
| W32 | Schedule Desk | Primavera P6, MS Project | S | **[new]** WBS, CPM, resource levelling, S-curve and earned value, delay analysis |
| W33 | QA/QC Lab | Inspection and test plans, lab registers, NCR logs | A + S | **[new]** ITP builder, test result entry (cube strength, slump), acceptance statistics, NCR and corrective action |
| W34 | CAD Bench | SolidWorks, Creo, Fusion, CATIA | R (geometry kernel in WASM) | **[new]**, needs a spike (OpenCascade.js or OpenSCAD in WASM). Checks mass properties, interference, GD&T and tolerance stack-up |
| W35 | Process and Quality Studio | Minitab, QI Macros, SPC software | S | **[new]** control charts, Cp/Cpk, gauge R&R, FMEA, Pareto, 8D (builds on W04) |
| W36 | Plant Ops Desk | MES, ERP production module, CMMS (Maximo, SAP PM) | S | **[new]** line and capacity simulation, OEE, line balancing, work-order board, MTBF/Weibull |
| W37 | Thermal Studio | Carrier HAP/TRACE, psychrometric chart, EES, ductulator | S/R | **[new]** psychrometrics (CoolProp WASM or published correlations), load calculation, duct and pipe sizing, equipment selection |

### Business
| ID | Workstation | Mirrors | Tier | Status |
|---|---|---|---|---|
| W38 | Business Docs Studio | Jira, Confluence, Lucidchart/BPMN, Visio | A | **[new]** BRD and user-story editor, process map with structure rules, RACI, acceptance-criteria quality checks, gap analysis |
| W39 | Finance Studio | Excel models, Capital IQ, SAP FI | S (on W02) | **[new]** three-statement skeleton, DCF, variance bridge, scenarios |
| W40 | Growth Analytics | GA4, Mixpanel, Amplitude, HubSpot, ad managers | S + R (DuckDB-WASM) | **[new]** funnel, cohort, attribution, A/B evaluation, CAC and ROAS |
| W41 | Talent Desk | Greenhouse, Workday, LinkedIn Recruiter | S | **[new]** ATS pipeline, structured scorecards, funnel metrics, fairness and privacy checks |
| W42 | Supply Chain Desk | SAP MM, WMS, forecasting tools | S | **[new]** EOQ, safety stock, reorder points, forecasts, supplier scorecards, purchase flow |
| W43 | Enterprise App Sandbox | SAP, Dynamics 365, Salesforce, Odoo | S | **[new]** modelled ERP/CRM modules, workflow and role-permission configuration, data mapping, test scripts |
| W44 | Service Desk | ServiceNow, Jira Service Management | S | **[new]** ticket triage, runbooks, SLA clocks, escalation |

Cross-cutting pieces every workstation uses (build once): ticket brief and assets panel, deliverable uploader with schema validation, per-check feedback, draft autosave, explain-your-work interview, evidence writer.

## 3. The 45 roles

Format per role: **Real tools** (what the job uses), **Workstation** (catalog IDs), **Skills assessed**, **Signature tickets**, **Grading**, **Build**.

### Stream IT: 15 roles

#### IT-01 Data Analyst
- **Real tools:** DBeaver/BigQuery, Excel, Power BI/Tableau, Jupyter, Jira/Confluence.
- **Workstation:** W01, W02, W03, W04, W05, W06, W07.
- **Skills:** SQL, data profiling and cleaning, spreadsheet analysis, KPI interpretation, statistics, dashboards, root-cause investigation, anomaly detection, evidence-based recommendations.
- **Tickets:** revenue dropped last week, find why; clean a vendor export and reconcile totals; build a retention dashboard; test whether a promo changed conversion.
- **Grading:** result sets vs server reference, invariants on cleaned data, dashboard series, statistical answers with tolerance, findings vs known cause.
- **Build:** **[exists]** 8 areas. Add W07 Python (browser-run) to replace the blocked area; add semantic-model and pivot extensions.

#### IT-02 Backend Developer
- **Real tools:** VS Code/IntelliJ, Postman/Swagger, Docker, Git/GitHub, Postgres client, Datadog logs.
- **Workstation:** W10, W11, W01 (Postgres), W12, W18, W21.
- **Skills:** API design, request validation, business logic, authn/authz, database access, error handling, automated tests, reliability, documentation.
- **Tickets:** implement an order endpoint to a contract; fix a pagination bug found in logs; add idempotency to payments; write tests that catch a regression.
- **Grading:** contract validation, hidden request sequences, test suite quality (mutation check on a seeded bug), log-based debugging answers.
- **Build:** today a pure-function API model, browser-run **[exists]**. Next W11 (contract checker, browser) then W21. Real service plus tests **[needs executor]**.

#### IT-03 Frontend Developer
- **Real tools:** VS Code, Chrome DevTools, React/Vue, Storybook, Figma inspect, Lighthouse, axe, Jest/Testing Library.
- **Workstation:** W13, W12, W21, W14 (bundler config).
- **Skills:** UI implementation, component architecture, state, form validation, API integration, accessibility, responsive layout, browser debugging, performance.
- **Tickets:** build an accessible form from a spec; make a layout responsive at 320/768/1280; fix a re-render bug; hit a Lighthouse budget.
- **Grading:** DOM and style checks, axe violations, viewport assertions, behaviour tests in the sandbox.
- **Build:** **[exists]** text-checked editor. Extend with the preview-run checks (R, in browser).

#### IT-04 Full Stack Developer
- **Real tools:** all of IT-02 and IT-03 plus Vercel/Netlify, Playwright.
- **Workstation:** W11, W13, W01, W12, W15, W21.
- **Skills:** end-to-end feature delivery, frontend/backend integration, schema design, auth flows, validation, integration testing, cross-layer debugging, deployment readiness.
- **Tickets:** add a signup flow end to end; trace a failing request across UI, API and DB; ship a feature behind a flag.
- **Grading:** contract between layers, cross-layer scenario scripts, deployment checklist via W15.
- **Build:** composition of IT-02 and IT-03 workstations. Starts only after both pass their gates. Differs from them by cross-layer tickets.

#### IT-05 Data Engineer
- **Real tools:** Airflow, dbt, Spark, Kafka, Snowflake/BigQuery, SQL, Python, Great Expectations.
- **Workstation:** W08, W01, W05, W15, W18.
- **Skills:** ingestion, ETL/ELT, transformation, schema design, data quality checks, incremental processing, monitoring, failure recovery, lineage.
- **Tickets:** build an incremental load with late-arriving rows; add quality checks to a failing pipeline; backfill after a schema change; trace a wrong number to its source.
- **Grading:** output tables vs expected, idempotent reruns, check coverage, lineage graph correctness.
- **Build:** **[new]** W08 is the big piece. Existing SQL tickets cover only the SQL part today.

#### IT-06 BI Developer
- **Real tools:** Power BI (DAX, Power Query), Tableau, Looker (LookML), star-schema modelling.
- **Workstation:** W03 (extended), W01, W02, W05.
- **Skills:** semantic models, measures, KPI definitions, relationships, aggregation correctness, filters, visual design, performance, metric consistency.
- **Tickets:** fix a measure that double counts across a many-to-many; define churn once and use it everywhere; make a slow report fast.
- **Grading:** measure values under filter contexts, model relationship rules, metric-definition consistency across reports.
- **Build:** **[extend]** W03 with a semantic layer. Distinct from Data Analyst by modelling, not analysis.

#### IT-07 AI/ML Engineer
- **Real tools:** Jupyter, PyTorch/scikit-learn, MLflow, W&B, Docker, feature stores.
- **Workstation:** W09, W07, W14, W18.
- **Skills:** problem formulation, feature engineering, training, validation, model selection, inference interface, evaluation, reproducibility, monitoring.
- **Tickets:** beat a baseline without leakage; fix a train/serve skew; write a serving config; respond to drift.
- **Grading:** predictions on hidden rows, leakage detection, reproducibility check, config validation.
- **Build:** **[exists]** ML notebook with capped tries. Extend with tracker and drift.

#### IT-08 Data Scientist
- **Real tools:** Jupyter, statsmodels/R, SQL, experimentation platforms.
- **Workstation:** W07, W04, W01, W06.
- **Skills:** EDA, inference, hypothesis testing, experiment design, predictive modelling, evaluation, bias and uncertainty, communicating findings.
- **Tickets:** design and read an A/B test; model churn and justify the metric; find a confounder; quantify uncertainty.
- **Grading:** statistical answers with tolerance, valid design choices, findings vs ground truth.
- **Build:** **[new role]** reuses W04/W07; today "data scientist" is matched to AI/ML by keyword. Needs its own role row.

#### IT-09 DevOps Engineer
- **Real tools:** GitHub Actions/Jenkins, Docker, Kubernetes, Terraform, Prometheus/Grafana, ArgoCD, Linux shell.
- **Workstation:** W15, W14, W17, W18, W16 (light).
- **Skills:** CI/CD, build and release automation, environment config, deployment, observability, incident response, rollback, infrastructure automation, reliability.
- **Tickets:** repair a failing pipeline; write a safe rolling deploy; find why pods restart; roll back a bad release.
- **Grading:** workflow run outcome in the simulator, config validated against schemas and policies, incident timeline answers.
- **Build:** **[exists]** text-checked config editor. W15 and W18 are new.

#### IT-10 Cloud Engineer
- **Real tools:** AWS/Azure/GCP console and CLI, IAM, VPC, CloudFormation/Terraform, CloudWatch, Cost Explorer.
- **Workstation:** W16, W14, W17, W18.
- **Skills:** architecture fundamentals, IAM, networking, compute and storage, IaC, deployment config, cost, monitoring, reliability and security.
- **Tickets:** least-privilege policy for a Lambda; why instance A cannot reach B; cut spend without hurting availability; review a Terraform plan.
- **Grading:** policy evaluation outcomes, reachability results, plan-diff answers, cost model totals.
- **Build:** **[new]** W16 evaluator and reachability engine. Differs from DevOps by cloud architecture over delivery.

#### IT-11 SOC Analyst
- **Real tools:** Splunk/Sentinel, EDR, ticketing, MITRE ATT&CK, Wireshark, VirusTotal.
- **Workstation:** W19, W18, W06, W44.
- **Skills:** alert triage, log analysis, event correlation, classification, threat investigation, IOCs, escalation, incident documentation, detection improvement.
- **Tickets:** triage 10 alerts and find the real incident; trace lateral movement through logs; write the incident report; tune a noisy rule.
- **Grading:** conclusions vs known evidence, severity and escalation rubric, report completeness.
- **Build:** **[new]** W19 on synthetic logs only. No real targets.

#### IT-12 Penetration Testing / Application Security Associate
- **Real tools:** Burp Suite, ZAP, nmap, Semgrep, Metasploit, threat modelling (STRIDE).
- **Workstation:** W20, W10 (read-only review), W12, W38 (report).
- **Skills:** authorized assessment, threat modelling, secure code review, web vulnerabilities, controlled reproduction, risk rating, remediation checks, reporting, scope and ethics.
- **Tickets:** find the injection in supplied code and fix it; threat-model a login flow; rate findings; verify a patch.
- **Grading:** vulnerabilities found vs seeded set, scope compliance, risk rating rubric, patch verification.
- **Build:** **[new]** starts as code review and a modelled request replay. A live target **[needs executor]** and a signed-off safety design.

#### IT-13 Database Administrator / SQL Developer
- **Real tools:** SSMS/pgAdmin, `EXPLAIN`, backup/restore tools, `pg_stat`, migration tools.
- **Workstation:** W01 (Postgres), W18, W14, W12.
- **Skills:** schema and indexes, query performance, transactions and concurrency, backup and recovery, permissions, integrity, plan analysis, migration safety, monitoring.
- **Tickets:** make a 40 s query fast with the right index; fix a deadlock; write a safe migration; restore to a point in time (modelled).
- **Grading:** plan cost and result equality, lock outcomes, permission matrix, migration safety checks.
- **Build:** **[exists]** four DBA areas and `sql-developer` as separate rows today; they merge here (scope in blueprint). **[extend]** Postgres semantics.

#### IT-14 Software Development Engineer / Programmer
- **Real tools:** IDE, Git, debugger, unit tests, profiler.
- **Workstation:** W10, W12, W21.
- **Skills:** algorithms, data structures, problem solving, code quality, unit testing, debugging, complexity, refactoring, version control.
- **Tickets:** implement to a spec with edge cases; debug a failing case; refactor without breaking tests.
- **Grading:** hidden test cases, complexity limits, tests the student wrote.
- **Build:** **[exists]** function-level editor, Python and JavaScript, browser-run.

#### IT-15 QA Automation Engineer
- **Real tools:** Selenium/Playwright/Cypress, Postman/RestAssured, TestRail, CI, k6.
- **Workstation:** W21, W11, W13, W15.
- **Skills:** test planning, case design, functional and API testing, UI automation, fixtures, regression, defect reports, CI integration.
- **Tickets:** design cases for a coupon feature; automate an API suite; reproduce and report a defect; stabilise a flaky test.
- **Grading:** defects caught on seeded builds, case quality (coverage of partitions and boundaries), defect report completeness.
- **Build:** **[new]** W21. UI automation on a live browser **[needs executor]**. Differs from MCA-05 by test strategy and defect work.

### Stream ECE: 5 roles

#### ECE-01 Embedded Systems Engineer
- **Real tools:** STM32CubeIDE/Keil/PlatformIO/Arduino IDE, SWD/JTAG debugger, logic analyzer, UART terminal, datasheets.
- **Workstation:** W22, W26.
- **Skills:** MCU fundamentals, GPIO and peripherals, embedded C, sensors and actuators, timing and state machines, serial protocols, debugging, memory limits.
- **Tickets:** debounce a button and drive an LED state machine; read a sensor over I2C and report on serial; fix a timing bug seen on the logic analyzer.
- **Grading:** emulator run against scripted inputs, pin and serial traces, timing within tolerance.
- **Build:** **[new]** AVR emulator in the browser (real execution). ARM is a later spike.

#### ECE-02 VLSI Design / Verification Engineer
- **Real tools:** Verilog/SystemVerilog, ModelSim/VCS, Vivado, GTKWave, UVM.
- **Workstation:** W23.
- **Skills:** RTL basics, digital logic, HDL, testbenches, functional verification, timing concepts, waveform analysis, coverage, defect hunting.
- **Tickets:** design a FIFO and pass the testbench; write a testbench that exposes a seeded bug; read a waveform to find a race.
- **Grading:** simulation results, bug found by the student's testbench, coverage numbers.
- **Build:** **[new]**, only after a WASM simulator spike. If none is viable the role stays BLOCKED, not simulated.

#### ECE-03 Electronics Design Engineer
- **Real tools:** KiCad/Altium/OrCAD, LTspice, multimeter and scope, BOM tools.
- **Workstation:** W24, W26, W38 (design notes).
- **Skills:** circuit analysis, component selection, analog and digital design, schematics, tolerance and power, trade-offs, simulation, documentation.
- **Tickets:** design a 5 V to 3.3 V supply within ripple spec; pick resistors for a tolerance budget; fix an amplifier that clips.
- **Grading:** SPICE measurements against spec, BOM tolerance and power checks.
- **Build:** **[new]** ngspice in WASM (real engine).

#### ECE-04 Communication / RF Engineer
- **Real tools:** MATLAB, ADS/AWR, VNA, spectrum analyzer, GNU Radio.
- **Workstation:** W25, W26.
- **Skills:** communication systems, signal and noise, modulation, link budgets, antennas and RF basics, spectrum reading, channel behaviour, system calculation, troubleshooting.
- **Tickets:** close a link budget; find the interferer in a spectrum; choose modulation for a noise limit; match an impedance.
- **Grading:** numeric answers within tolerance, spectrum findings vs seeded signals.
- **Build:** **[new]** Pyodide-based. A numerical lab, not a full RF simulator, and labelled so.

#### ECE-05 Electronics Test and Validation Engineer
- **Real tools:** oscilloscope, DMM, power supply, LabVIEW, ATE, requirements tools.
- **Workstation:** W26, W24, W38.
- **Skills:** test planning, measurement interpretation, instruments, procedures, tolerance verification, defect isolation, validation reports, traceability, root cause.
- **Tickets:** write a test procedure for a spec; isolate which stage fails from scope captures; produce a traceability matrix.
- **Grading:** procedure covers the spec items, defect located, matrix has no orphan requirements.
- **Build:** **[new]** virtual instruments over a circuit model (simulated, labelled).

### Stream EEE: 5 roles

#### EEE-01 Electrical Design Engineer
- **Real tools:** AutoCAD Electrical, ETAP, DIALux, load-schedule spreadsheets, IS/IEC/NEC codes.
- **Workstation:** W27, W02, W30.
- **Skills:** load calculation, equipment and cable sizing, protection basics, drawings, standards-aware documentation, safety constraints, verification.
- **Tickets:** build a load schedule and size the main breaker and cable; check voltage drop; mark up a single-line diagram error.
- **Grading:** calculations within tolerance, correct standard values chosen, checks pass.
- **Build:** **[new]** educational, not design approval; this is stated in every ticket.

#### EEE-02 Power Systems Engineer
- **Real tools:** ETAP, PowerWorld, PSS/E, DIgSILENT, Simulink, relay settings software.
- **Workstation:** W27.
- **Skills:** generation and distribution, load flow, fault analysis, protection coordination, power factor, voltage regulation, grid performance, reliability.
- **Tickets:** run load flow and fix undervoltage; compute fault current; coordinate two relays; correct power factor.
- **Grading:** solver results vs reference, relay curve separation.
- **Build:** **[new]** own solver or a vetted library in Pyodide (spike).

#### EEE-03 Industrial Automation / PLC Engineer
- **Real tools:** TIA Portal, Studio 5000, CODESYS, WinCC/SCADA, P&ID drawings.
- **Workstation:** W28.
- **Skills:** ladder logic, I/O mapping, sequence control, interlocks, alarms, process simulation, fault diagnosis, safe control logic.
- **Tickets:** start/stop with seal-in and overload interlock; fill-and-drain tank sequence; find why a conveyor jams.
- **Grading:** run the logic against a scripted process, safety interlocks must hold in every scenario (hard fail otherwise).
- **Build:** **[new]** our own IEC 61131-style interpreter; labelled "PLC simulator, not a vendor runtime".

#### EEE-04 Electrical Maintenance Engineer
- **Real tools:** CMMS (SAP PM, Maximo), megger, thermography, multimeter, LOTO procedures.
- **Workstation:** W36, W26, W44.
- **Skills:** preventive maintenance, fault diagnosis, scheduling, condition analysis, work orders, failure reports, root cause, reliability metrics, electrical safety.
- **Tickets:** plan a PM schedule; diagnose a motor from megger and thermal readings; write a failure report with root cause.
- **Grading:** schedule feasibility, diagnosis vs seeded fault, safety steps present (hard fail if missing).
- **Build:** **[new]**.

#### EEE-05 Renewable Energy / Solar Design Engineer
- **Real tools:** PVsyst, Helioscope, SAM, PVWatts, AutoCAD, datasheets.
- **Workstation:** W29, W27.
- **Skills:** solar resource and yield, PV sizing, inverter selection, string configuration, losses, storage basics, economics, design validation.
- **Tickets:** size an array for a load; check string voltage at coldest and hottest day; build the loss waterfall; payback.
- **Grading:** yield within tolerance, voltage-window checks.
- **Build:** **[new]** simplified model, labelled.

### Stream Civil: 5 roles

#### CIVIL-01 Site Engineer
- **Real tools:** drawings (PDF/AutoCAD), total station, daily progress reports, quality checklists.
- **Workstation:** W30, W33, W32 (light), W44.
- **Skills:** sequencing, progress tracking, drawing reading, material tracking, daily reports, coordination, quality checks, safety observations, escalation.
- **Tickets:** read a slab drawing and list the pour sequence; reconcile material received vs used; write the daily report; raise a safety issue correctly.
- **Grading:** quantities and sequence vs key, report completeness, escalation choice.
- **Build:** **[new]**.

#### CIVIL-02 Quantity Surveyor / Estimation Engineer
- **Real tools:** Excel BOQ, CostX/Bluebeam, rate analysis, Schedule of Rates, contract forms.
- **Workstation:** W30, W02, W39 (cost).
- **Skills:** takeoff, BOQ, rate analysis, estimating, measurement rules, variations, tender comparison, reconciliation, documentation.
- **Tickets:** takeoff for a retaining wall; price a BOQ from rates; compare three tenders; value a variation.
- **Grading:** quantities, units, totals, traceability to drawing items (all within tolerance).
- **Build:** **[new]**.

#### CIVIL-03 Structural Design Engineer
- **Real tools:** STAAD.Pro, ETABS, SAP2000, RCC design to IS 456 or ACI, Revit/Tekla.
- **Workstation:** W31, W30.
- **Skills:** structural analysis, load combinations, member design, calculations, drawings, material properties, design checks, code assumptions.
- **Tickets:** analyse a beam and size reinforcement; combine loads; check a column.
- **Grading:** analysis results vs reference, code checks, stated assumptions. Safety-critical: ticket output is never a design approval.
- **Build:** **[new]**.

#### CIVIL-04 Planning and Project Controls Engineer
- **Real tools:** Primavera P6, MS Project, earned value, S-curves.
- **Workstation:** W32, W02.
- **Skills:** WBS, scheduling, critical path, resource allocation, progress measurement, variance, delay analysis, forecasting, status reports.
- **Tickets:** find the critical path; level resources; explain the delay and its cause; forecast completion from EVM.
- **Grading:** CPM results exact, EVM numbers within tolerance.
- **Build:** **[new]** own CPM engine.

#### CIVIL-05 QA/QC and Materials Testing Engineer
- **Real tools:** ITPs, cube and slump tests, NCR registers, calibration records.
- **Workstation:** W33, W35.
- **Skills:** inspection plans, materials test interpretation, acceptance criteria, NCRs, sampling and traceability, documentation, corrective action, trends, closeout.
- **Tickets:** accept or reject a concrete batch from cube results; raise an NCR; spot a downward strength trend.
- **Grading:** accept/reject decisions vs code limits, NCR completeness.
- **Build:** **[new]**.

### Stream Mechanical: 5 roles

#### MECH-01 Mechanical Design Engineer
- **Real tools:** SolidWorks/Creo/CATIA/Fusion, GD&T, ANSYS basics, PLM and change requests.
- **Workstation:** W34, W30.
- **Skills:** CAD, drawings, dimensioning and tolerances, materials, fits, calculations, design for manufacturing, validation, revision control.
- **Tickets:** model a bracket to dimensions; choose a fit; do a tolerance stack-up; fix a drawing GD&T error.
- **Grading:** geometry properties vs reference, stack-up numbers, drawing check rules.
- **Build:** **[new]**, depends on the geometry-kernel spike. If not viable, the role runs as drawing and calculation checks only, and says so.

#### MECH-02 Manufacturing / Production Engineer
- **Real tools:** ERP/MES, line balancing, lean tools, CNC programs.
- **Workstation:** W36, W35.
- **Skills:** production planning, routing, capacity, bottlenecks, cycle time, work instructions, yield, process improvement, reporting.
- **Tickets:** balance a line to takt time; find the bottleneck; plan a week's production.
- **Grading:** simulation outputs vs expected, plan feasibility.
- **Build:** **[new]**.

#### MECH-03 Quality Engineer
- **Real tools:** Minitab, SPC, MSA, FMEA, 8D, CMM, PPAP.
- **Workstation:** W35, W04.
- **Skills:** inspection planning, measurement systems, SPC, capability, root cause, CAPA, nonconformances, quality metrics, audit evidence.
- **Tickets:** read a control chart and call the out-of-control rule; compute Cpk and decide; run a gauge R&R; write an 8D.
- **Grading:** statistics exact within tolerance, correct rule violations.
- **Build:** **[new]** on top of the stats engine.

#### MECH-04 Maintenance / Reliability Engineer
- **Real tools:** CMMS, vibration analyzers, FMEA/RCM, Weibull analysis, OEE.
- **Workstation:** W36, W35.
- **Skills:** preventive and predictive maintenance, failure modes, reliability metrics, scheduling, downtime analysis, work orders, root cause, spares planning.
- **Tickets:** fit a Weibull to failure data; plan spares for a service level; find the top downtime cause.
- **Grading:** fitted parameters within tolerance, plan meets target.
- **Build:** **[new]**. Distinct from EEE-04 (electrical) by mechanical failure and reliability statistics.

#### MECH-05 Thermal / HVAC Engineer
- **Real tools:** Carrier HAP/TRACE, psychrometric chart, EES, duct sizing tools, ASHRAE data.
- **Workstation:** W37.
- **Skills:** heating and cooling loads, psychrometrics, airflow, equipment sizing, energy, efficiency, design assumptions, troubleshooting, reporting.
- **Tickets:** compute a cooling load; size a duct; find the process on a psychrometric chart; explain low COP.
- **Grading:** numbers within tolerance and stated assumptions present.
- **Build:** **[new]**.

### Stream MBA: 5 roles

#### MBA-01 Business Analyst
- **Real tools:** Jira, Confluence, Lucidchart/BPMN, SQL, Excel.
- **Workstation:** W38, W01, W02.
- **Skills:** requirements, process mapping, stakeholders, business rules, acceptance criteria, KPIs, gap analysis, user stories, recommendations.
- **Tickets:** turn a stakeholder email into stories with criteria; map the as-is process and find the gap; define a KPI that can be computed.
- **Grading:** structure and completeness rules, testable criteria, KPI computed correctly from data.
- **Build:** **[new]** W38. Not graded on prose alone.

#### MBA-02 Financial Analyst
- **Real tools:** Excel models, Capital IQ/Bloomberg, SAP FI, Power BI.
- **Workstation:** W39, W02, W03.
- **Skills:** statement analysis, budgeting, forecasting, variance, cash flow, unit economics, modelling, scenarios, risk.
- **Tickets:** variance bridge for the quarter; DCF with scenarios; cash runway; unit economics.
- **Grading:** model outputs, reconciliation (balance sheet balances), scenario values.
- **Build:** **[new]** on the spreadsheet engine.

#### MBA-03 Marketing / Growth Analyst
- **Real tools:** GA4, ad managers, HubSpot, Mixpanel/Amplitude, SQL.
- **Workstation:** W40, W01, W03.
- **Skills:** funnels, campaign performance, segmentation, CAC, conversion, retention and cohorts, experiments, attribution, recommendations.
- **Tickets:** find where the funnel leaks; compare channels by CAC; read an A/B result honestly; build a cohort retention table.
- **Grading:** computed metrics, test conclusion validity.
- **Build:** **[new]**.

#### MBA-04 HR / Talent Acquisition Associate
- **Real tools:** Greenhouse/Workday, LinkedIn Recruiter, HRIS, interview scorecards.
- **Workstation:** W41, W02.
- **Skills:** JD interpretation, pipeline management, structured screening, interview coordination, funnel metrics, reporting, fair evaluation, candidate communication, privacy.
- **Tickets:** screen a pipeline with a structured rubric; compute time-to-hire and conversion; spot an adverse-impact pattern; redact personal data before sharing.
- **Grading:** metrics exact, fairness and privacy checks pass (hard fail on exposing protected data).
- **Build:** **[new]** fictional candidates only.

#### MBA-05 Operations / Supply Chain Analyst
- **Real tools:** SAP MM, WMS, forecasting tools, Power BI, S&OP.
- **Workstation:** W42, W02, W03.
- **Skills:** inventory, demand forecasting, procurement, supplier performance, lead time, fulfilment, bottlenecks, cost and service level, recommendations.
- **Tickets:** set reorder points; forecast a seasonal item; rank suppliers; find the fulfilment bottleneck.
- **Grading:** computed values within tolerance, policy meets the target service level in simulation.
- **Build:** **[new]**.

### Stream MCA: 5 roles

#### MCA-01 Application Developer
- **Real tools:** IDE, Java/.NET/Python/Node, Git, Postman, SQL, Docker.
- **Workstation:** W10, W11, W01, W12.
- **Skills:** application design, programming, database integration, UI and business logic, testing, debugging, error handling, maintenance, delivery.
- **Tickets:** CRUD module with validation; fix a failing integration; add a feature to existing code.
- **Grading:** hidden tests, data-layer checks.
- **Build:** shares IT-14 and IT-02 tools. Differs by whole-application, multi-layer tickets.

#### MCA-02 Enterprise Software / ERP Developer
- **Real tools:** SAP ABAP/Fiori, Dynamics 365, Salesforce Apex, Odoo, REST/IDoc integration.
- **Workstation:** W43, W11, W38.
- **Skills:** business process modelling, application customisation, workflow config, data mapping, role permissions, integration, business-rule validation, regression testing, deployment notes.
- **Tickets:** configure an approval workflow with roles; map legacy fields to the new schema; fix a permission leak.
- **Grading:** workflow run outcomes, permission matrix, mapping correctness.
- **Build:** **[new]** modelled ERP, labelled "enterprise simulator, not SAP".

#### MCA-03 Database and Data Applications Engineer
- **Real tools:** ORM, SQL, migrations, REST APIs.
- **Workstation:** W01, W11, W10, W12.
- **Skills:** database-backed apps, SQL access, schema management, CRUD, transactions, validation, API integration, query performance, integrity testing.
- **Tickets:** fix an N+1; make a transfer atomic; write a safe migration for a live table.
- **Grading:** query counts, constraint outcomes, migration safety.
- **Build:** shares W01 with IT-13, but about application code, not administration.

#### MCA-04 Cloud and Platform Support Engineer
- **Real tools:** cloud console, monitoring, ServiceNow, runbooks, CLI.
- **Workstation:** W16, W18, W44, W17.
- **Skills:** deployment support, environment config, logs and monitoring, access management, incident triage, service health, troubleshooting, runbooks, escalation.
- **Tickets:** a customer cannot log in: trace it; follow a runbook and know when to escalate; fix a misconfigured environment variable.
- **Grading:** diagnosis vs seeded cause, escalation correctness, SLA handling.
- **Build:** **[new]**. Differs from IT-10 by support and triage rather than architecture.

#### MCA-05 Software Test Automation Engineer
- **Real tools:** Selenium/Playwright, pytest/JUnit, fixtures, CI.
- **Workstation:** W21, W11, W15.
- **Skills:** automation frameworks, test design, UI and API testing, fixtures and test data, assertions, regression suites, defect docs, CI runs, test reliability.
- **Tickets:** build page-object structure; remove flakiness from a suite; add fixtures for isolated data.
- **Grading:** suite catches seeded defects, passes reliably on repeated runs.
- **Build:** shares W21 with IT-15. Differs by framework engineering and reliability over test strategy.

## 4. Overlaps that must stay separate

| Pair | How they differ |
|---|---|
| IT-01 and IT-06 | analysis and decisions vs modelling and metric definition |
| IT-01 and MBA-03 | general data work vs marketing funnel and experiment work |
| IT-02, IT-14 and MCA-01 | service logic; algorithmic problems; whole-application delivery |
| IT-13 and MCA-03 | administration and performance vs application-side data access |
| IT-15 and MCA-05 | test strategy and defects vs automation framework engineering |
| IT-10 and MCA-04 | architecture and IaC vs support and triage |
| EEE-04 and MECH-04 | electrical fault diagnosis vs mechanical reliability statistics |

Each pair keeps its own scenarios, rubric and evidence even where the workstation is shared.

## 5. Build order and what each step needs

1. **Browser-only, no new risk:** finish W01/W02/W03/W07 extensions (Data Analyst), W11 API Lab, W12 Git Desk, W13 extensions, W21 unit tests. These cover most IT roles.
2. **Simulators we write (deterministic, testable):** W08, W15, W16, W18, W19, W32, W35, W36, W38-W44. Pure TypeScript, unit-tested engines.
3. **WASM engines, each behind a spike:** W22 (AVR), W24 (SPICE), W23 (Verilog), W34 (geometry), W25/W27/W31 (Pyodide numerics). If a spike fails, the role is BLOCKED, never faked.
4. **Isolated executor (decision needed):** server-side runs of student code, a real terminal (W17), multi-file projects (W10) and live UI automation. The project is on Vercel, whose Sandbox product is a candidate; limits, cost and network-deny behaviour have to be checked before relying on it.

## 6. Decisions still open

- Whether to invest in the isolated executor before roles that need it (IT-02 real tests, IT-12 live target, IT-15, MCA-05).
- Which structural design code to ship first (Indian standards or ACI/Eurocode) for CIVIL-03.
- Which spikes (Verilog, geometry, ARM) are worth running before committing those roles.
