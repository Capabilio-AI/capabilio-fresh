# Capabilio — Product & Architecture Reference

**Status:** Living document. This is the source of truth for what Capabilio is, how the Student and Organisation (TPO) paths work end to end, and how the system is architected. Any Claude Code task prompt or engineer onboarding should start by reading this file.

---

## 1. What Capabilio Actually Is

Capabilio is not "a resume-free hiring platform with a challenge arena." That is one output of the system, not the product.

**Capabilio is an academic-to-career navigation system.** It connects three things that no competitor (Naukri, Unstop, HackerRank, LinkedIn) connects together:

1. **What a student has actually demonstrated** (evidence-backed skills, via Arena and GitHub Code DNA — not self-reported claims)
2. **What their college is actually teaching them** (curriculum, mapped by semester)
3. **What their declared or inferred goal requires** (Job / Higher Studies / Entrepreneurship — evidence-informed, not a one-time form field)

The output is a **personalized roadmap**: which subjects to focus on, which skills to build, which projects to do, which certifications matter — grounded in the gap between what the student can already do and what their goal actually requires.

The same evidence feeds two audiences:

- **Students** get direction ("here's what to focus on and why") instead of another dashboard of unrelated tasks.
- **Colleges (TPO cells)** get an evidence-based, aggregate view of their student body's career intent and demonstrated skill levels — instead of pushing every student toward placement drives blind.

**Core principle, applied everywhere in this system:** show what a student has *demonstrated*, never what they merely *claim*. Career direction, curriculum coverage, and skill level are all treated the same way — inferred from behavior/evidence over time, confirmed with the student, never locked in from a single unverified input.

---

## 2. Architecture Style: Monolith, Not Microservices

Capabilio is built as a **single production monolith**, not a microservices architecture.

- One deployable application (existing `capabilio-fresh` stack: Node/Express or Next.js API layer, single Postgres/Supabase database, single AI-provider abstraction layer already in place for Groq).
- Internal module boundaries (Identity, Arena, Evidence, Skill Graph, Curriculum/Roadmap, Portfolio, Organisation) are **code-level separation, not service-level separation.** No new services, no new databases, no new auth systems per module.
- Background/async work (AI generation, curriculum extraction, rotation recalculation, evidence/Portfolio recompute) runs through the existing or a minimally-added job/queue mechanism inside the same deployment — not a separate microservice.
- Rationale: at current scale, a monolith is faster to build, easier to keep consistent (one transaction boundary, one source of truth for identity/authorization), and avoids the coordination cost of distributed systems this team doesn't need yet. Split out a service later only if a specific component (e.g. Python sandbox execution) genuinely requires isolated infrastructure for security reasons — see §9.

```
                        CAPABILIO MONOLITH
┌───────────────────────────────────────────────────────────┐
│  Universal Identity & Auth                                 │
│  ├── User → Membership/Context (path, org, role, branch,   │
│  │           stream, start_year, end_year)                 │
│  └── Server-side authorization on every module below       │
│                                                              │
│  Arena Module                                               │
│  ├── Domain role + skill-area taxonomy (config-driven)      │
│  ├── Rotation engine (bag-shuffle, server-authoritative)     │
│  ├── Workstation registry (SQL / Python / Excel / BI / ...)  │
│  ├── Live AI generation (no static bank) + deterministic     │
│  │    grading per skill area                                │
│  └── Skill Graph sub-skill + ELO update (idempotent)         │
│                                                              │
│  Evidence Engine                                             │
│  ├── Unified evidence records (Arena + GitHub/Code DNA)       │
│  └── Demonstrated Capabilities (derived, deterministic)       │
│                                                              │
│  Curriculum & Roadmap Engine                                  │
│  ├── Curriculum ingestion (structured upload → later PDF)     │
│  ├── Target-skill-profile per goal (Job/Higher Studies/Entr.) │
│  └── Gap analysis → personalized roadmap                      │
│                                                              │
│  Portfolio (recruiter- and self-facing synthesis)              │
│                                                              │
│  Organisation / TPO Workspace                                  │
│  ├── Invitations (branch/stream scoped, server-validated)       │
│  ├── Curriculum upload                                          │
│  └── Aggregate cohort dashboard (career intent, skill gaps)      │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Universal Identity & Path Model

One Capabilio account per person. A user has one or more **contexts** over time (Student at College X in CSE, later Professional; Organisation Admin at College X), never separate accounts per path.

```
User
 └── Membership/Context
      ├── path            (student | professional | executive | organisation)
      ├── organisation_id
      ├── role             (student | org_admin | org_staff | ...)
      ├── branch_id
      ├── stream_id
      ├── start_year        (e.g. 2024)
      ├── end_year          (e.g. 2028)
      └── goal_state        (post-graduation intent — see §5.4)
```

This document focuses on the **Student** and **Organisation** paths. Professional/Executive paths are covered in a separate architecture note and reuse the same identity/evidence/Portfolio infrastructure.

---

## 4. Onboarding (Account Creation)

### 4.1 Fields
- Standard identity fields (name, email, password — **no Google sign-up/login**, email+password only for this iteration; ensure email verification and password reset are solid since they're now the only recovery path)
- Degree/branch selection (e.g. B.Tech, CSE)
- **Start year** and **end year** (replaces the old "1-2 / 2-1 / 2-2 / 3-1 / 3-2" semester-label field)

### 4.2 Deriving "current year" from start/end year
```
current_academic_year = current_calendar_date bucketed against start_year,
                          using the institution's academic-cycle start month
                          (e.g. June/July), not calendar Jan–Dec
```
- This computation must be **shown to the student for confirmation at onboarding and periodically thereafter**, not silently trusted — it breaks for backlog students, gap years, and repeated years. Provide a manual override.
- Semester-level granularity (the old "-1"/"-2") is dropped. Confirm nothing else in the app currently depends on semester before removing it entirely.

### 4.3 Known bug to fix in the same pass
- "Get Started" button on the landing page is currently non-functional — fix as part of this work, not a separate ticket.

---

## 5. Student Path — Year by Year

### 5.1 Year 1 — Foundation only
- **No Arena challenges of any kind** (neither stream nor domain-role). Introducing domain-role content this early produces exactly the disengagement problem observed in practice — students don't yet have the coursework context to find it meaningful.
- **Communication & Career-Interest module** — universal from day one, not a fallback for final-years. This is foundational groundwork for all three eventual paths (Job / Higher Studies / Entrepreneur), not a lightweight substitute.
- Signal collection begins quietly here (career-interest responses) but nothing is acted on yet.

### 5.2 Year 2 — Stream challenges begin (not domain-role)
- Introduce **stream-level challenges**: broad, branch-based (e.g. for CSE: general programming, basic DSA, logic-building), tied to what the student is actually studying that semester — not narrowed to a specific career role yet.
- Purpose: exploration and signal-gathering, not mastery. Continue accumulating behavioral signal (which problem types the student engages with and performs well on) — this reduces the "blind pick" problem when domain roles are introduced in Year 3.
- Communication & Career-Interest module continues.

### 5.3 Year 3, Semester 1 (3-1) — Domain-role challenges begin
- Domain-role Arena challenges (the full multi-skill-area system — SQL/Python/Excel/BI/Statistics/Data Cleaning for Data Analyst, and equivalent taxonomies for other roles) start here, **not at 3-2 and not earlier.**
- **Explore/taster phase first:** before the full rotation engine locks a student into covering one domain role in depth, give short taster tasks across 2–3 candidate domain roles informed by Year 2 signal data. Let the student choose (or confirm) a domain role based on having actually tried something, not a label.
- Once a domain role is selected/confirmed, the full rotation engine (see §7) begins, ensuring full skill-area coverage before any repeat.
- Engagement and evidence generated this semester feeds directly into the 3-2 trigger below.

### 5.4 Year 3, Semester 2 (3-2) — Career-Direction Trigger

**Exact trigger condition:** `end_year − current_calendar_year ≤ 1` (i.e. the student is entering their final year), evaluated consistently everywhere this logic is checked (assessment gating, the goal-state prompt, Launchpad visibility). **Move this trigger to 3-2, not the literal final year** — Indian campus placement drives commonly begin in semester 7 (3-2) or even 3-1, so waiting until year 4 misses the window where Portfolio-readiness and interview prep actually matter.

**Assessment change for this cohort:** students who meet the trigger condition **skip the full 7-section assessment** and instead only take Communication and Career-Interest assessment sections.

**The prompt — reflection-first, not a cold ask:**
Do not present the three-way choice as a blind form field. Prefix it with a reflection of the student's own Year 3-1 signal:

> "Based on what you've been doing on Capabilio, you've spent the most time on **[inferred domain role]**. Does that still feel right, or do you want to explore something else?"

Then present the goal-state choice:

1. **Entrepreneur**
2. **Higher Studies**
3. **Getting a Job**
4. **Not sure yet** (default state — see below)

**Handling "Not sure yet":** this must be a real, first-class option, not an edge case. A large share of students genuinely won't have decided at this point, and forcing a choice produces unreliable data. Default this cohort into the **Job-track experience** (Portfolio push, Arena, interview prep, Launchpad) since interview-readiness benefits every eventual path regardless of what the student later chooses. Continue surfacing the Entrepreneur and Higher Studies options periodically rather than treating the moment as a one-time fork the student missed.

**Reversibility:** the goal-state choice is a **setting, not a fate.** It must be editable at any time. Model it as another attribute on the student's Membership/Context (`goal_state`), not a one-off flag or a locked record. A student who picks Entrepreneur in month 1 and Job-seeking in month 3 should be able to switch freely, with the application adjusting immediately (see §5.5).

### 5.5 What each goal-state choice does

**1. Entrepreneur**
- Surface curated information/resources for relevant incubators and programs (e.g. T-Hub, RTBI-style bodies) as an **informational resource page in v1** — not a live application/referral integration. Do not build a real partnership integration until an actual partnership commitment exists; building the integration first is solving a problem that doesn't exist yet.

**2. Higher Studies (e.g. GATE, MS abroad)**
- Student profile and Arena domain stay as-is; student continues building Portfolio and skills normally.
- Periodically (not just once) present an **"Option B" check-in**: "Still planning on Higher Studies, or want to explore a different direction?" This is a confirmation prompt in the same reflection-first spirit as §5.4, not a hard re-fork.
  - If the student confirms Higher Studies: no change.
  - If the student wants to switch: retarget Arena to the new domain role's taxonomy (a config change, since the taxonomy/rotation architecture is domain-role-agnostic — see §7). **Keep all previously earned skills/evidence in Portfolio.** New Arena activity builds evidence for the new domain role going forward. Nothing is deleted or overwritten.

**3. Getting a Job**
- Push Portfolio completion actively (prompt to update it as Arena missions complete).
- Push AI interview practice sessions.
- Surface relevant internships and entry-level roles in the **Launchpad** page.
- This student also becomes a candidate for the Curriculum Roadmap Engine (§6) if their college has uploaded curriculum data — the roadmap tells them which subjects/skills/projects/certifications to prioritize toward job-readiness for their domain role.

**4. Not sure yet**
- Defaults into the Job-track experience (see above) for safety, since it benefits any eventual path, while continuing to surface the other two options periodically.

### 5.6 Year 4
- Domain-role Arena challenges continue, shaped by whichever goal-state the student has confirmed.
- Portfolio, roadmap, interview prep, and Launchpad activity continue accordingly.

### 5.7 "What Pops Up When" — Quick Reference Table

| Trigger | What Shows | Options | Consequence |
|---|---|---|---|
| Account creation | Onboarding form | Degree, branch, start year, end year | Computes `current_academic_year`; no Google login |
| Year 1 | Communication & Career-Interest module | — | Signal collection begins; no Arena yet |
| Year 2 start | Stream challenges unlock | — | Broad branch-level Arena tasks begin |
| Year 3, Sem 1 start | Domain-role explore/taster prompt | 2–3 candidate domain roles | Student picks/confirms a domain role → full rotation engine begins |
| `end_year − current_year ≤ 1` (3-2 onward) | Lighter assessment + Career-Direction reflection prompt | Entrepreneur / Higher Studies / Getting a Job / Not sure | Sets `goal_state`; skips full 7-section assessment; unlocks path-specific experience |
| Higher Studies students, periodic | "Still on this path?" check-in | Continue / Switch | If switch: retarget Arena domain, keep prior Portfolio evidence |
| Anytime | Goal-state setting | Change goal state | Fully reversible; updates experience immediately |

---

## 6. Curriculum & Roadmap Engine

### 6.1 What it is
A **gap analysis**, not a curriculum summary. Three inputs converge:

1. **Target skill profile** — what "ready" looks like for the student's goal (a domain role's skill-area taxonomy for Job track; relevant subject mastery for Higher Studies/GATE; foundational validation/business skills for Entrepreneur track)
2. **Demonstrated state** — what the Skill Graph/Evidence Engine already shows (from Arena sub-skill ELOs and GitHub Code DNA)
3. **Curriculum coverage** — what the student's college is already teaching this semester, so the roadmap doesn't tell a student to "learn X" when their curriculum already covers X. Instead: *"Your curriculum covers X this semester — here's how to actually engage with it and prove it,"* and only surfaces genuinely uncovered gaps as external asks (a project, a certification, a specific Arena focus).

### 6.2 Curriculum ingestion — phased, not AI-first

**This is the riskiest technical piece of the whole roadmap engine — not the skill-matching logic — because syllabus formats vary wildly across colleges and change over time.** Build it in phases; do not attempt general-purpose PDF parsing first.

**Phase 1 (build this first): structured upload, not PDF extraction.**
- TPO admin enters curriculum through a **structured template you control** — subjects mapped to semesters/branches, via a form or a defined CSV/Excel template — not free-text PDF upload.
- This turns "curriculum extraction" into simple data entry against your schema. No parsing risk, no format variance to handle.
- Prove the roadmap engine is valuable on clean data before investing in extraction automation.

**Phase 2 (later, once real syllabus samples exist from several colleges): AI-assisted PDF extraction.**
- **Text extraction:** use `pdfplumber` (Python) or `pdf-parse` (Node) to pull raw text/tables from a digitally-generated syllabus PDF.
- **Scanned/image-based PDFs:** run OCR first (Tesseract) before text extraction, since many older or scanned syllabus documents won't have a text layer.
- **Structuring:** feed the extracted text to the existing Groq AI provider abstraction with a **strict JSON schema output** (subject name, semester, branch, credits, topics) — reuse the AI-provider abstraction already in the stack, do not add a second AI integration.
- **Mandatory human-in-the-loop confirmation:** AI-extracted curriculum data is never committed directly. The TPO admin must review and confirm the extracted structure before it's saved — consistent with the system-wide rule that AI output is never trusted as final authority (see §9). Malformed or low-confidence extractions are flagged for manual correction, not silently accepted.
- Do not build Phase 2 until Phase 1 has real usage and you have actual messy syllabus documents from multiple colleges to design the parser against — building it generically upfront means solving problems you haven't seen yet.

### 6.3 Output
A per-student roadmap: prioritized subjects to focus on, skills to build (mapped to Arena skill areas), suggested projects, and relevant certifications — regenerated as curriculum, Arena evidence, or goal-state changes.

---

## 7. Arena — Domain Roles, Skill Areas, and Rotation

*(Full production spec for this already exists as a separate engineering document; summarized here for context.)*

- **Config-driven taxonomy:** each domain role (e.g. Data Analyst) has a set of skill areas (SQL, Python, Excel, BI/Dashboarding, Statistics, Data Cleaning), each mapped to a tool type and a Skill Graph sub-skill node. Adding a skill area or role is a config change, not new code.
- **Rotation engine:** server-authoritative bag-shuffle per candidate+domain role — every skill area is served once before any repeat, no immediate cross-cycle repeat, concurrency-safe, and a failed AI generation never consumes a rotation slot.
- **Live generation only:** every new attempt generates challenge content through the AI provider per attempt — no static question bank for new attempts (historical attempts remain persisted for evidence/audit).
- **Deterministic grading:** each skill area has its own server-side grading contract (SQL result comparison, Python test cases, spreadsheet formula/output checks, dashboard config checks). AI never decides pass/fail or the resulting skill delta.
- **Sub-skill ELO:** the existing ELO formula (reused, not reinvented) updates the specific sub-skill node (e.g. `Data Analyst → SQL`), idempotently per attempt.
- **Python execution is the highest security priority** in this system — must run in a genuinely isolated sandbox (container/WASM, no network, no filesystem beyond ephemeral scratch, hard resource limits). Treat it as executing arbitrary code from the public internet.

---

## 8. Organisation / TPO Path — Step by Step

### 8.1 Organisation onboarding
- Organisation admin creates the org identity, adds staff/admins, and can generate **invitations** scoped to branch/stream.
- Invitations use a secure, server-validated token (`?invite=<token>`) — the client never supplies authoritative organisation_id/branch_id/stream_id/role. The server resolves all of that from the token.

### 8.2 Curriculum upload
- Structured template upload per §6.2 Phase 1, mapped to branch and semester/year.

### 8.3 What data flows to the TPO dashboard
The dashboard is **aggregate and evidence-based**, not a raw feed of individual private data.

- **Career-intent distribution** by branch/year: counts of students in each `goal_state` (Job / Higher Studies / Entrepreneur / Not sure), sourced from the same reversible setting described in §5.4 — always reflecting current state, not a point-in-time snapshot.
- **Curriculum-vs-demonstrated-skill gap insights** in aggregate: e.g. "students are consistently weak in [subject/skill] relative to what their declared goal requires" — this is a curriculum feedback signal for the college's own syllabus planning, not just a student-facing feature.
- **Placement-readiness cohort sizing**: e.g. "310 job-track, 12 entrepreneurship-track, 40 likely GATE aspirants, 38 undecided" — lets the TPO cell allocate placement-drive effort and incubator/coaching partnerships proportionally instead of pushing every student toward placements uniformly.
- Roster/invitation status (who has joined, who is active).

### 8.4 What the TPO does *not* see
- Individual students' private evidence, submissions, or Portfolio detail beyond what that student has explicitly shared (same recruiter-facing sharing/authorization model used elsewhere in the system — see §9).
- Raw Arena attempt content or grading detail for individual students.
- Anything the student hasn't consented to surface at the aggregate/cohort level.

---

## 9. System-Wide Hard Rules (apply to every module above)

1. **Reuse before building.** Extend existing identity, Arena, evidence, Skill Graph, ELO, and design-system infrastructure. No duplicate systems per module or per path.
2. **Server is the only authority.** The client never supplies authoritative IDs, scores, goal-state, verification status, or curriculum data as trusted input. Authorization is enforced server-side, not by hiding UI.
3. **No fabrication, anywhere.** No invented evidence, skill deltas, curriculum data, coverage numbers, or aggregate stats. If evidence is insufficient, say so plainly.
4. **AI generates content; it never decides outcomes.** AI may generate challenge scenarios, curriculum-extraction candidates, and explanatory text. It never determines pass/fail, ELO, goal-state, or curriculum data without a deterministic check or a human confirmation step.
5. **Idempotency everywhere completion matters.** Skill/ELO updates, evidence creation, and curriculum commits happen exactly once per verified event, safe against retries.
6. **Reversibility over lock-in.** Career direction, domain-role selection, and any student-declared intent are editable settings, not one-time forms — this reflects how real students actually behave, especially under family or peer influence.
7. **Evidence traceability.** Every claim shown to a student, recruiter, or TPO must be traceable back to its source (an Arena attempt, a GitHub commit, a curriculum record).

---

## 10. Recommended Build Sequence

Do not build the full vision at once. Sequence it so each phase is independently valuable and provable before the next:

1. **Prove the Job-track loop first**: 3-2 trigger, reflection-first prompt with the "Not sure" default, Portfolio/Arena/interview push, Launchpad. Fully reuses existing infrastructure; sellable on its own.
2. **Structured-curriculum roadmap for Job track only**, one college, one domain role. Prove students actually act on the roadmap before generalizing.
3. **Organisation aggregate dashboard**, once there's real signal to aggregate — a thin/empty dashboard undersells the TPO pitch.
4. **Higher Studies and Entrepreneur tracks.** Entrepreneur stays an informational resource page until a real partnership exists.
5. **AI-assisted curriculum PDF extraction**, last — only after real syllabus variety has been seen from onboarding several colleges manually.
6. **Year 1/2 stream-challenge and taster-phase build-out** can happen in parallel with the above, since it's lighter-weight than the full domain-role rotation system and doesn't block the Job-track loop.

---

## 11. Open Decisions to Confirm Before Building

These are product calls, not engineering defaults — confirm before an engineer or Claude Code builds against them:

- Exact list of skill areas per domain role beyond Data Analyst (each new domain role needs its own taxonomy defined and sanity-checked).
- Which skill areas share a workstation tool type vs. need a dedicated one (e.g. does Statistics reuse the Python workstation, or need its own).
- Difficulty-progression algorithm within a skill area (tied to sub-skill ELO? fixed at cycle start? random within a band?).
- Abandoned-attempt handling: timeout duration, whether it's resumable, whether it counts as "served" for rotation purposes.
- Rate limit on live AI generation per student (cost and abuse control).
- Content-safety constraints on AI-generated scenarios (generic/fictional business names only, no real-person data).
- How much curriculum data a TPO can see about their own students vs. what stays aggregate-only.

---

## 12. Glossary

- **Domain role** — a career target (e.g. Data Analyst, Backend Engineer) with its own skill-area taxonomy.
- **Skill area** — a distinct, gradeable competency within a domain role (e.g. SQL, Python, Excel).
- **Rotation engine** — server-side system ensuring a candidate cycles through every skill area in their domain role before any repeats.
- **Goal state** — the student's current (reversible) post-graduation intent: Entrepreneur / Higher Studies / Getting a Job / Not sure.
- **Evidence Engine** — the unified layer turning verified Arena and GitHub activity into demonstrated capabilities.
- **Roadmap Engine** — the gap-analysis system combining target skill profile, demonstrated state, and curriculum coverage into a personalized to-do list.
- **TPO** — Training & Placement Officer / cell, the primary admin user of the Organisation path.
