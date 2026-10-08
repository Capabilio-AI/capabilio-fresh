# Visual career roadmap — Phase 0 audit

Inspect-only. Facts come from reading the repo and read-only queries on the live Supabase project (2026-10-07). "Exists" means I read it in code or the database.
Much of the **data and engine** layer already exists (built in the curriculum→roadmap v2 work, `docs/curriculum-roadmap-v2-progress.md`). What is missing is the **topic tree, the per-topic honesty model, the visual canvas/panel, the career-specific baseline assessment, and live updates**.

## 1. Signup, onboarding and where career interest is captured today
- `/get-started` (four paths) → `/signup` (`SignupForm`, optional college join link that pre-fills college/branch/year). Signup collects account + college + branch + years. **It does not ask for a career.**
- Career is captured in two places, both after signup:
  - **Roadmap tab** (`GoalPicker`): choose primary career, Plan B, "I am exploring", or type a goal. The goal goes to `POST /api/career-intent/suggest`, which stores a PENDING `career_suggestions` row; nothing changes until the student accepts one. Intent lives in `student_career_intent` (primary, secondary, `is_exploring`, goal text). **This already meets the "AI suggests, student confirms" rule.**
  - The legacy assessment section `career_interests` (free text → `career_interest_target.stated_role`), used by the old Domain Arena role matching.
- There is no guided journey signup → career → baseline → roadmap. A new student lands on the dashboard; the roadmap tab shows a "missing state" until a career is set.
- Live data: 1 `student_career_intent` row, 1 roadmap, 6 roadmap versions (test/dev scale).

## 2. Assessment and diagnostic infrastructure
- **Onboarding assessment** (`/assessment`, `lib/assessment/*`, tables `assessment_*`): seven fixed sections (aptitude, reasoning, verbal, programming fundamentals, engineering maths, basic sciences, career interests), 15–25 questions each, 45 s per question (150 s for coding), server-graded via RPCs. Questions come from `question_bank` (**141 rows**, 6 generic sections, columns `skill`, `capability`, `domain`, `branches`, `difficulty`, kinds MCQ/coding). The `career_interests` section is AI-generated per student.
  - It is **not career-specific**, **not topic-tagged** (`skill` is free text, not a canonical `skill_id`), **not adaptive**, has **no draft/review status** (only `active`), and is **not resumable per topic**.
- **Arena**: Stream challenges and Domain challenges (my recent work): ticket-style, deterministic checks, workstations, evidence into `evidence` + `arena_skill_elo` + `arena_skill_ratings`, challenges tagged to canonical skills via `arena_challenge_skills`. 22 authored seed challenges exist as drafts. Arena is the natural source of **auto-graded practice evidence**; it is not a diagnostic.
- **SkillStudio** (`/skillstudio/{foundations,courses,certifications}`) and **Pulse** (feed) exist; neither is an assessment.
- Capability evidence today: `capabilities` (score by free-text skill, from the assessment), `capability_history`, `evidence` (arena/github), Arena ratings. `loadStudentCapabilities` (`lib/capability/read-model.ts`) folds them into one level per canonical skill.

## 3. Roadmap service, tables, API, components; capability; taxonomy; careers

**Tables (migration 056):** `roadmaps` (one per student+career), `roadmap_versions` (immutable; trigger, mode, `input_hash`, readiness, next best action, notes), `roadmap_skill_gaps` (per version: current/target/gap/coverage/gap_type/stage/blocked_by), `roadmap_courses`, `roadmap_learning_items`, `roadmap_certifications`, `roadmap_projects`, `roadmap_arena_challenges`, `roadmap_milestones`, `roadmap_goals`.
**Engine (`lib/roadmap-engine/*`, ~2.3k lines, pure + tested):** `gaps` (gap = max(0, target − level), coverage), `subjects` (priority), `readiness` (documented importance-weighted formula; self-declared capped at 40 and halved), `milestones` (semester-aware, prerequisite-aware), `generate` (next best action), `load`/`prepare`/`service` (`ensureRoadmap`: **hash-on-read**, unchanged inputs write nothing), `regenerate` (bounded background job after a curriculum publish), `explain` (AI sentences, accepted only if grounded).
**API:** `GET /api/roadmap`, `POST /api/roadmap/refresh` (10/h), `GET /api/roadmap/versions[/id]`, `PUT /api/roadmap/regulation`; `PUT/GET /api/career-intent*`.
**UI:** `/dashboard/roadmap` renders **text cards** (`components/roadmap/v2/*`, 401 lines): header, next best step, gaps, subjects, learning, certs, projects, Arena, timeline, version history, goal picker. No canvas, no node concept, no panel, no per-node state, no live updates.

**Capability model (`read-model.ts`):** one level per canonical skill = **max** of verified items (else self-declared capped at 40); Arena = 25 points per verified task. Confidence from item count. **Gaps vs §4:** no recency decay or difficulty weighting; no per-item weights; no evidence *list* payload (only per-kind counts); no "score history across versions"; null is treated as 0 inside `effectiveLevel` and shown as 0 in gaps (`hasData` exists on challenge reasons only). There is a `lib/career/skill-decay.ts` helper worth checking in Phase 1.

**Taxonomy and careers:** `skills` — **53 active skills, CS-centric**, with `parent_skill_id`, category and aliases; `careers` — 10 careers, 81 `career_skill_requirements` (importance, `target_level`, `required_by_stage` FOUNDATION/INTERMEDIATE/JOB_READY). The resolver (`resolveSkill`) never creates skills. Platform admin: `platform_admins` + `/admin/arena-challenges` (new, from the Arena work) is the pattern to reuse; legacy org admin handles curriculum.

**Important mismatch:** roadmap nodes in the brief are *topics* (e.g. "Joins", "Indexes", "Normalization"), but there are only 53 skills (e.g. one "SQL"). A topic tree with real per-topic scores needs finer canonical skills (see risk R1).

## 4. Curriculum ingestion
- Pipeline (`lib/roadmap/extract/*`, Phase 3 of the earlier work): PDF text → deterministic section parser (`section.ts`) → optional AI structurer for sections the parser cannot read (every item must be found word-for-word) → draft `curriculum_imports` (invisible to students) → admin review UI at `/org/curriculum` → **publish freezes a `curriculum_versions` row**. Verified on JNTUK R23 CSE: 61 courses, 143 outcomes, 249 units, ~2.9k topics, 203 experiments, POs/PSOs, regulation.
- Stored per course (`courses`, `course_outcomes`, `course_units`, `unit_topics`, `lab_experiments`, `program_outcomes`): code, title, year, semester (1–2 within a year), L-T-P-C, objectives, prerequisites, textbooks, outcomes (code, text, Bloom level), units, topics, labs, and a `provenance` snippet per field.
- Skill mapping: `course_skill_mappings` and `course_outcome_skill_mappings` with `mapping_source` (AI_SUGGESTED | COLLEGE_CONFIRMED | MANUAL | SYSTEM), confidence, importance, evidence snippet, status; a DB rule makes an AI mapping unable to be CONFIRMED; the student roadmap reads **official mappings only**. Unresolved skill names go to `skill_suggestions` (review queue), never into `skills`.
- **Live data is thin:** the single published curriculum is the backfill (61 course rows, **0 outcomes, 0 topics**, 9 confirmed mappings). The extraction code is proven on the real PDF in tests, but no student currently has topic-level data.
- **Gaps vs §3:**
  - No **INFERRED outcomes** when the PDF has none (extraction copies; "nothing is inferred" is a design rule). `course_outcomes` has no `source` column (EXTRACTED / INFERRED / COLLEGE_CONFIRMED) and the snippet has **no page number** (`pdf.ts` keeps `pages[]`, but provenance stores only the text).
  - Mappings are course- and outcome-level, **not topic/unit-level**; AI mappings are never shown to the student (official only), so with zero confirmed mappings coverage is empty for everyone.
  - Coverage today is STRONG / PARTIAL / NONE; missing mapping data yields **NONE, not UNKNOWN** (`classifyCoverage`). The brief requires UNKNOWN.
  - Per-node completion status of the course ("completed / taking / will take") is derivable from year + estimated semester only; the semester is an **estimate** from the calendar (`position.ts`), not student-editable.

## 5. Frontend stack, graph libraries, realtime, AI
- Next.js 16.3 (App Router, Turbopack), React 19.2 (React Compiler lint rules active), Tailwind 4, `framer-motion`, `recharts`, `lucide-react`. **No graph/diagram library** is installed. Light theme tokens (`app-*`, `lp-*`) and shared UI in `components/`.
- **Graph approach (recommendation):** `@xyflow/react` (React Flow, **MIT**, maintained) for pan/zoom/minimap/virtualization (`onlyRenderVisibleElements`), with **custom node components** and a **pure server-side layout function** (spine + left/right groups → x/y coordinates) so layout comes from data. Custom SVG would need pan/zoom/minimap/virtualization/keyboard focus rebuilt; xyflow's attribution banner can be hidden under MIT only with attribution kept in the repo notices. Fallback if you prefer zero dependencies: custom SVG + CSS transforms (more work, fewer features).
- **Realtime:** Supabase Realtime is available but the `supabase_realtime` publication is **empty** (no tables published). Options: (a) publish `roadmap_versions` for owner-only `postgres_changes` (needs RLS select policy, which exists: read-own), (b) SSE route (serverless long connections are costly on Vercel; 300 s cap), (c) short-interval revalidation + on-focus + after local actions. **Recommend (c) first with (a) as the upgrade**; the Arena `challenge_events` outbox is a ready trigger source.
- **AI:** Groq via `lib/ai/groq.ts` (`completeJson`, retries, one model `openai/gpt-oss-120b`); grounding checks exist for roadmap sentences; career-goal interpretation and Arena AI helper exist. **There is no AI call log** (cost/latency); rate limiting exists (`checkRateLimit`). The AI tutor/chat/quiz needs a new log table and streaming decision (Groq SDK supports streaming).

## 6. Gap list vs the brief (sections 1–9)
| § | Requirement | State |
|---|---|---|
| 1.1 | Career choice at signup, AI-suggested + confirmed | Confirm flow exists but lives on the roadmap tab, not in signup |
| 1.2 | Career-specific adaptive baseline (15–25 min, resumable, skippable) | **Missing.** Existing assessment is generic, fixed, not topic-tagged, no review status |
| 1.3 | Curriculum extraction in background | Exists, thin live data; no INFERRED outcomes, no page provenance |
| 1.4–1.5 | Roadmap generation overlay, live updates | Engine exists at skill level; no node overlay; no live push |
| 2 | Topic-tree templates as data (+admin editor, review, AI drafts) | **Missing entirely** (no `roadmap_templates/nodes/edges/node_resources`) |
| 3 | Per-node curriculum coverage with UNKNOWN, semester, provenance, snippets | Partially at skill level; UNKNOWN, topic-level, semester/status, snippets missing |
| 4 | Honest per-node capability (null ≠ 0, decay, difficulty, roll-up, consistency check) | Partial: per-skill level exists; null/decay/difficulty/roll-up/consistency/evidence list missing |
| 5 | Visual roadmap (canvas, minimap, filters, semester overlay, mobile accordion, list/timeline) | **Missing** (text cards only) |
| 6 | Topic panel: why-this-score, college coverage, prerequisites, resources, practice, AI learn | **Missing**; `GET /api/roadmap/explain` does not exist; no node state table |
| 7 | Event-driven recompute, version diffs, SSE, per-node user state | Hash-on-read versions exist; no diffs, no push, no node state |
| 8 | Honest states, own-data-only, AI logging, a11y | Partly (missing-state component exists); AI log + canvas a11y missing |
| 9 | Tests / e2e | Roadmap engine well covered; none for the new pieces |

## 7. Proposed phases (each: migrations, tests, typecheck, lint, UI verification, then wait for approval)
1. **Foundations — data model + honest scoring core.** Migrations: `roadmap_templates/nodes/edges/node_resources`, `roadmap_node_state` (student status + skip reason), `roadmap_version_nodes` (per-version node snapshot for diffs), `course_outcomes.source` + page columns, per-node explanation payload types, `ai_call_log`. Pure modules: node roll-up, capability v2 (null-aware, recency, difficulty, verification, consistency flags), coverage with UNKNOWN, prerequisite/locked logic, template validation (no cycles, canonical skills). Tests.
2. **Template authoring pipeline + original seed trees.** Spec format + validator + CLI (reusing the Arena content pipeline pattern) and a small platform-admin editor; AI-draft path as DRAFT; author original trees for the 8 starter careers (this is the biggest content task; see R2); review gate before PUBLISHED.
3. **Curriculum overlay.** INFERRED outcomes derivation (labelled "Derived by Capabilio from your syllabus"), page-level provenance, topic/unit-level skill mapping with confidence thresholds and a review queue, deterministic coverage per node (STRONG/PARTIAL/NONE/UNKNOWN), editable semester, subject priority.
4. **Roadmap API + explanation payloads.** `GET /api/roadmap/graph` (nodes, edges, layout, states) and `GET /api/roadmap/explain?type=&id=`; node state endpoints; version diff; recompute triggers wired to assessment/Arena/project/curriculum events.
5. **Visual roadmap UI.** xyflow canvas with spine/groups, node states and badges, minimap, zoom/fit, search, filters, semester overlay, mobile accordion, list and timeline views, header (career switcher, readiness, evidence coverage, version, what changed), live revalidation.
6. **Topic panel.** Right panel / bottom sheet (focus trap, Esc, `?node=`), tabs, why-this-score, college coverage with snippets, prerequisites/unlocks, resources (free/premium from catalog), practice (Arena/projects/certs), status buttons with skip reasons.
7. **Baseline assessment.** Career-topic question bank (additive: tags to canonical skills, DRAFT → reviewed → PUBLISHED, `source`), adaptive per-topic sampler (pure, tested), resumable career-specific diagnostic, auto-graded, results written as ASSESSMENT evidence per topic, skip = "Not assessed yet", signup/post-career-choice entry.
8. **Learn-with-AI and live polish.** Quick Explain / Teach Me / Quiz me / Ask (grounded in topic, level and syllabus snippets, never changing scores), AI log and rate limits, Realtime upgrade if wanted, end-to-end journey test, accessibility pass.

## 8. Risks and decisions needed before Phase 1
- **R1 — Taxonomy granularity (data model, blocks the template design).** 53 CS-centric skills cannot back ~60 topics per career. Options: (a) add a reviewed set of **child skills** (`skills.parent_skill_id` already exists) so each topic node has a canonical skill, (b) let several topics share one skill (scores per topic impossible). I recommend (a): ~200–300 child skills under existing parents, authored by us, reviewed by you, added through the same admin/CLI path. Also non-CS careers/streams have almost no skills today.
- **R2 — Content volume.** 8 original trees × ~50–80 nodes, plus career-specific diagnostic questions per topic (~3–5 each), is hundreds of items. I will author trees and a **small reviewed question set per career** to prove the system, ship them as DRAFT/REVIEWED per your rules, and document the rest as a roadmap; I will not claim full coverage.
- **R3 — Questions: no existing topic-tagged, reviewable bank.** Needs a new additive table (or extending `question_bank` with `skill_id`, `status`, `source`). Needs your call: extend `question_bank` (keeps the existing assessment working) or create `diagnostic_items`.
- **R4 — Thin live curriculum data.** The only published curriculum has no topics/outcomes; the overlay will show UNKNOWN until a real PDF is processed and mappings exist. AI mappings are not shown to students today; the brief wants **inferred** outcomes labelled as such and "low-confidence excluded". I need your decision: may *high-confidence AI/INFERRED* mappings appear on the roadmap as "Inferred by Capabilio" (clearly badged), or must they stay hidden until a college confirms? The brief implies the former.
- **R5 — Capability formula change affects existing readiness numbers** (weights, decay, null handling). Existing roadmap versions are immutable and stay as they were; new versions will use the new formula, documented and versioned (`formula_version` on version snapshots).
- **R6 — Semester is estimated, not stored.** The brief wants it student-editable: additive field on the membership (or per roadmap). Confirm it should live on `institution_memberships`.
- **R7 — Realtime choice** (see §5): confirm polling-first is acceptable.
- **R8 — Graph library:** confirm `@xyflow/react` (MIT) or ask for custom SVG.
- **R9 — Original content/legal:** trees must not be modelled on roadmap.sh. I will design from the canonical skills, the existing career requirement rows and first principles, and record provenance on every template.
- **R10 — Verification:** the Chrome extension was not connected in earlier work, so canvas interactions (pan/zoom, focus trap, bottom sheet) cannot be click-tested by me unless it is; I will rely on server-render checks, unit tests and HTTP e2e, and say plainly what is unclicked.
- **R11 — Scope realism:** this is ~8 phases of work comparable to the Arena effort. Phases 1–4 are backend/data; the visible roadmap arrives in Phase 5. I can reorder to show a thin visual slice earlier (e.g. render one career's tree after Phase 2) if you want visible progress sooner.
