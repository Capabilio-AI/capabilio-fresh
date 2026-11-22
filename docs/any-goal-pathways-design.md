# Any-goal Pathways: a complete roadmap for any career goal (UPSC, fashion design, and the rest)

Status: design, 2026-11-22. Nothing here is built. Written after reading the current code: `lib/careers/intent.ts`, `lib/roadmap-generate/generate.ts`,
`lib/market/job-pack.ts`, tables `careers`, `career_aliases`, `career_suggestions`, `student_career_intent`, `roadmap_templates`, `path_waitlist`.

## 1. The problem, stated precisely

Today a goal typed by a student is matched to one of ~39 rows in `careers` (`suggestCareersForGoal`). Every roadmap is built from a **skills taxonomy**
(`career_skill_requirements`, `skills`), then enriched with job postings (Adzuna) and verified certifications. That fits "Backend Developer". It does not
fit "UPSC", "Fashion Designer" or "CA", because those are not skill lists:

| Goal type | What the person actually needs | Why the current model fails |
|---|---|---|
| **Exam-gated** (UPSC, SSC, banking, GATE, CAT, NDA, CLAT, state PSC) | eligibility, stages of the exam, syllabus, attempts and age limits, notification calendar, a prep plan, mocks | no exam entity, no calendar, no official-source tracking |
| **Portfolio-gated** (fashion, film, music, graphic design, writing) | training routes (degree, entrance, courses), a portfolio, internships, how people really get hired | skills are not the gate; the portfolio and the entry route are |
| **Licence/credential** (CA, law, teaching, medicine) | the qualification ladder and its bodies | multi-year, fixed sequence, regulated |
| **Own venture** | idea to first customer | no employer, no postings |
| **Job-skill** (IT and most engineering) | what exists today | works |

Rule for the design: **never force a goal into the job-skill shape.** A goal gets the shape it really has.

## 2. The one rule that makes it trustworthy

Exam dates, eligibility, fees, age limits and notification pages **change and cost people years when wrong.** So:

1. **Facts come from official sources, with the source attached.** A fact row is `claim + official URL + date retrieved + who verified it`. No source, no fact.
2. **The model writes structure and explanation only.** It never produces a date, a fee, an age limit or a vacancy count. Those are either cited rows or absent.
3. **Everything shows how fresh it is.** "Verified 14 Nov 2026 against upsc.gov.in" or, when stale, a plain "Check the official site; this was last verified N days ago."
4. **A pathway is DRAFT, REVIEWED or PUBLISHED**, the same states `roadmap_templates` already has. A model-drafted pathway for a goal nobody has reviewed is shown, but labelled
   "AI-drafted, not yet reviewed by an expert", with its sources, and queued for review. It is never presented as authoritative.

## 3. What a student sees (the "complete roadmap")

For any goal, one page, in this order. This directly answers what was asked: what the role is, how to achieve it, what to learn, where and how to start, which exams, where to watch notifications, how to prepare.

1. **The goal in plain words**: what the work is, who employs people in it, honest realities (competition, timelines, typical entry age). No salary numbers without a source.
2. **Ways in**: the entry routes, each with a clear card (exam, degree, entrance, portfolio-and-apply, apprenticeship, direct hire). Shows eligibility, the official body and its link.
3. **Is this for me**: eligibility checked against the student's own profile (degree, year, age if given), with the rule and its source. "You are eligible / not yet / check the notification."
4. **Stages**: Foundation, Entry, Preparation, Attempt, After. For UPSC: stages of the exam; for fashion: foundation skills, portfolio, entrance or internships, first role.
5. **What to learn**: topics with an official syllabus link where one exists, and free and paid resources (only ones we have checked), grouped by stage.
6. **Start this week**: a 7-day starter plan, then a weekly plan. Small, concrete, dated.
7. **Exam Watch**: where notifications appear (official page, gazette, news bulletin), the next verified date, and "tell me when something changes".
8. **Prove it**: what Capabilio can honestly verify for this goal (section 6).
9. **If it does not work out**: adjacent routes that use the same preparation (for example, state services, banking and teaching after a civil services attempt). Alternatives are a feature, not an apology.

## 4. Architecture

### 4.1 Goal intake and classification
- Free text from the student (and an "I'm not sure" option). Resolve in this order: `career_aliases` / `careers` (job-skill), then the pathway catalogue (new), then **ask**, never guess.
- A clarifying step is part of the flow: "UPSC" splits into the civil services exam, forest service, engineering services and so on; "fashion designer" splits into apparel, textiles, accessories and styling. Ask one question, then proceed.
- Output: `goal_kind` (exam / portfolio / credential / venture / job-skill), confidence, and the pathway or career it resolved to. Unresolved goals go to a queue that tells us what to build next. That queue is the demand signal.

### 4.2 Data model (new, alongside the existing tables)
- `pathways`: key, name, kind, summary, status (DRAFT / REVIEWED / PUBLISHED), reviewed_by, reviewed_at, last_verified_at, provenance (curated or ai_drafted).
- `pathway_routes`: pathway, route kind, title, body, eligibility (structured), official body name, official URL, typical cadence (text, not a date).
- `pathway_stages` and `pathway_steps`: ordered, each step has what to do, why, effort estimate, and linked resources. These render with the existing visual roadmap, so no second roadmap UI.
- `pathway_facts`: claim, value, **source_url, retrieved_at, verified_by, valid_until**. Every date, limit and fee lives here and only here.
- `pathway_calendar`: event (notification, application window, exam date, result), date, source_url, verified_at, status (announced / tentative / changed).
- `pathway_follows`: student, pathway, channels. Powers Exam Watch.
- `student_career_intent` gains a nullable `pathway_id` and `goal_kind`; `primary_career_id` stays for job-skill goals. No existing behaviour changes.

### 4.3 Content pipeline (this is the real work)
1. **Collect.** A fetch step limited to an allow-list of official domains (government and recognised institution sites). It stores page snapshots and extracts facts as rows with citations. Respect each site's terms and robots rules; link out rather than copy documents.
2. **Draft.** The model writes the pathway **only from collected facts**, using the same draft, review, publish loop as `generateCareerRoadmap`. The prompt forbids inventing facts; a validator rejects any number or date in the output that is not in `pathway_facts`.
3. **Review.** A person with domain knowledge approves (mentors, `pro_mentor_profiles`, or hired subject reviewers). Nothing authoritative without a reviewer.
4. **Keep fresh.** A scheduled job re-fetches each official page and compares a content hash. A change **flags the pathway for review and shows the stale banner**; it never silently rewrites a fact.

### 4.3.1 Exam Watch
- Calendar rows are entered or confirmed by a reviewer from the official notification. A change in an official page raises an admin task, then a reviewed calendar update, then notifications to followers (the `notifications` table and email already exist).
- No one is alerted on a model's guess. If a date is not on an official page, the app says "not announced yet" and shows where it will appear.

### 4.4 Preparation and proof
- **Exams:** Capabilio hosts only practice it authored and verified itself (the same verified-bank discipline as Arena). Previous papers are linked to their official source, not re-hosted, unless the rights are clear. Mock scores, consistency and weak topics are tracked.
- **Portfolio goals:** briefs with a rubric, uploads, and review by a mentor or a labelled AI first pass. The portfolio is the proof.
- What Capabilio can and cannot certify must be on the page: *we verify work you did here; we cannot certify an official exam result. You can add your official result, shown as self-reported.* This keeps the "proof over claims" principle honest.

### 4.5 Where it plugs into what exists
- `/explore` and onboarding: a single "Type any goal" box. Job-skill goals take the current route unchanged.
- Visual roadmap: pathway stages and steps render as roadmap nodes; `node_resources` carries resources.
- Plan B and role change: a pathway can be a Plan B. Arena stays for job-skill roles; non-job goals get a practice space instead of forcing Arena tickets.
- Mentors: Professional Path mentors can be attached to a pathway as reviewers and guides.

## 5. Build order

| Phase | Deliver | Done when |
|---|---|---|
| 0 | Schema, the fact and citation model, the review states, the fact-checking validator, an admin review screen | a hand-written pathway passes review and renders |
| 1 | Goal intake with clarifying questions and the unresolved-goal queue; 8 to 10 reviewed pathways chosen from the queue and real demand (suggested start: UPSC civil services, SSC, a banking exam, GATE, a design-entrance route, CA, teaching, entrepreneurship, plus one creative portfolio route such as fashion) | a student types a goal and gets a complete page with sources |
| 2 | Provisional AI-drafted pathways with sources and the review queue | any goal gets an honest, labelled answer within a minute |
| 3 | Exam Watch: official-page monitoring, reviewed calendar, follow and alerts | a changed official page produces a reviewed alert |
| 4 | Preparation engine: weekly plan, verified practice, mock tracking, portfolio briefs and review | a student can follow a plan for a month |
| 5 | Coverage audit extended: each pathway scored for sources, freshness, reviewer and starter plan | the number is on the admin dashboard |

## 6. Risks and how each is handled

- **Wrong facts harm people.** Mitigation: sources, reviewer, freshness banner, no model-written facts (section 2). This is the main risk and the main cost: reviewer time.
- **Staleness.** Exams change yearly. Mitigation: scheduled re-verification and visible age. Accept that coverage will be smaller but trusted.
- **Scraping and rights.** Use official pages that allow it, link out, store snapshots only as needed for verification, keep the allow-list explicit.
- **Selling coaching.** No paid placement of coaching institutes inside a pathway; any partner is disclosed.
- **High-stakes pressure.** Show realistic odds honestly and the alternatives (section 3, point 9). No guarantees, no countdown pressure.
- **Scope.** There are hundreds of goals. Reviewed pathways are the scarce thing, so the unresolved-goal queue decides the order, not guesses.

## 7. What I did not do and what is open

- I did not check how many students have typed non-IT goals: the live data is mostly test and demo accounts, so it would mislead. Prioritise with the real queue once students use it.
- The exact eligibility rules, dates and bodies for any exam are deliberately **not stated here**. They must come from the official source at build time and be re-verified, which is the point of section 2.
- Open decisions: who the reviewers are (mentors, hired subject experts, partner institutions), whether premium plans include Exam Watch, and the rights position on hosting previous papers.
