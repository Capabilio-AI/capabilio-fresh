# Visual career roadmap — progress

Audit: `docs/roadmap-visual-audit.md`. Decisions approved 2026-10-07 (child skills for three careers only, new `diagnostic_items`, inferred mappings behind a confidence threshold with a separate display tier, @xyflow/react, polling-first live updates, student-editable semester, three careers of seed content). Order: Phase 1, 2, then a thin read-only canvas slice, then 3, 4, and the full canvas (5).

## Phase 1 — Foundations and honest scoring: DONE

**Migration 066 (applied)** — additive only; existing roadmap versions are untouched and stay immutable.
- `roadmap_templates` (DRAFT/REVIEWED/PUBLISHED/RETIRED, source, required `provenance`, one PUBLISHED per career, reviewer required to leave DRAFT), `roadmap_nodes` (SPINE/GROUP/TOPIC, canonical skill, importance, target, stage, side; a TOPIC must name a skill and target; a trigger refuses any skill that is not active), `roadmap_edges`, `node_resources`.
- `roadmap_node_state` (student's Learning/Done/Skipped; a skip needs a reason), `roadmap_version_nodes` (per-version node snapshot for diffs; level NULL when unassessed).
- `roadmap_versions.formula_version` (existing rows = `capability.v1`), `roadmap_skill_gaps.assessed` (new rows say whether anything was measured), `save_roadmap_version` now records both.
- `institution_memberships.current_semester` / `semester_confirmed_at` (student-editable; the app shows "estimated" until confirmed). Not wired to any UI or API yet (Phase 3).
- `roadmap_settings` (`inferred_min_confidence` = 0.8), `ai_call_log` (feature, model, tokens, latency, cost estimate, status; no prompt/response text), `diagnostic_items` (DRAFT/REVIEWED/PUBLISHED, source, canonical skill, kind, difficulty, answer key, explanation; PUBLISHED needs a reviewer). `question_bank` and `/assessment` are untouched.
- RLS: students read only PUBLISHED templates/nodes/edges/resources and their own node state and version snapshots; diagnostic items, settings and the AI log are service-role only.

**Honest scoring (`capability.v2`, `lib/roadmap-visual/capability.ts`, wired into the live product)**
- No evidence → level `null` (never 0, never "verified"); a measured 0 stays 0. The roadmap shows "Not assessed yet".
- Weight = verification × recency × difficulty (half-lives per evidence kind, floor 0.25, undated = 0.5 and flagged; easy 0.8 / medium 1 / hard 1.2; self-declared 0.25 and capped at 40). Assessments are weight-averaged; Arena passes accumulate (25 each when fresh and medium); level = the higher; confidence from weight and the number of distinct verified kinds.
- Every skill keeps an evidence list (kind, label, date, raw score, link, weight components, verified); Arena passes now come one-by-one from the `evidence` table with the challenge's difficulty, plus any older rating records without matching evidence (counted once).
- Pure modules with tests: node roll-up (importance-weighted, shows evidence coverage), consistency check ("Check this score" for a high score over an unassessed/low prerequisite), node status (Not assessed / Not started / Learning / Done / Skipped / Target met / Needs check / Locked, with the prerequisite rule and skip warnings), template graph validator (rejects missing/inactive skills, cycles, orphans, stage-order violations, duplicate topic skills), score explanation builder.
- Effect on the live product: new roadmap versions use v2 (a one-off new version per student as inputs hash differently); older versions are unchanged. Readiness counts an unassessed skill as 0 internally (as before) but the UI and next-best-action text now say "not assessed".

**AI call log** — `completeJsonDetailed` (tokens and latency from the provider, null when unreported), `loggedCompleteJson` and `logAiCall` (`lib/ai/log.ts`); cost is `null` unless `AI_COST_INPUT_CENTS_PER_MTOK` and `AI_COST_OUTPUT_CENTS_PER_MTOK` are set. The existing `completeJson` is unchanged for current callers. Use `loggedCompleteJson` for all new AI calls.

**Child skills for the first three trees** — `content/skills/roadmap-child-skills.json` (81 skills under 27 existing parents, original descriptions). `npm run roadmap:content -- skills validate|import|activate|pending`. The validator rejects an unknown or inactive parent and any name that equals or is "too close to" an existing skill or alias (it caught three of mine: "Linked Lists", "Design Patterns", "Unit Testing"; renamed). **They were imported as inactive candidates** (nothing can use them) and await your review: `skills pending` lists them, `skills activate --all-from-file` activates them after you approve.

**Tests** — 866 unit tests pass. Live (real database): 7 new foundation tests (review gates, one published per career, canonical-skill guard, RLS, node state, diagnostic gating, settings/log service-only, v2 score and evidence list) and the existing roadmap/careers live tests (36) updated for the new formula and passing. `tsc` clean; eslint: only the old `notifications/page.tsx` error.

**Not done in this phase (by design):** no UI changed except "Not assessed yet" on the existing skills list; no templates or trees yet (Phase 2); no INFERRED outcomes, page provenance, `course_outcomes.source` or UNKNOWN coverage (Phase 3); `@xyflow/react` not installed yet, so no notice file yet (added with the canvas slice).

**Verification:** server-side logic, database constraints and live queries are tested; **nothing was clicked in a browser** (the Chrome extension was not connected). The only UI change is the text on the existing Roadmap skills list.

## Phase 2 — Template authoring pipeline and three original trees: DONE (trees authored and validated; NOT yet imported — waiting for the child-skills review)

- **Spec format** (`lib/roadmap-visual/template-spec.ts`): a tree is JSON — career, version, title, **required provenance**, nodes (SPINE / GROUP / TOPIC with title, description, canonical skill *name*, importance, target, stage, side, order) and edges (PREREQUISITE / CONNECTOR / OPTIONAL_PATH). The hash ignores the order of nodes and edges.
- **Validator** (pure, tested): schema, career exists, skills exist **and are active** (a candidate is an error; `--allow-pending` downgrades it to a warning for dry runs), no parent or prerequisite cycles, spine/group/topic structure, a prerequisite never in a later stage than what depends on it, one topic per skill, every topic described.
- **Store** (`template-store.ts`): `importTemplate` (DRAFT; replaces the same career+version while unpublished; a PUBLISHED or retired version is never rewritten, a change is a new version), `exportTemplate` (rebuilds the spec from the rows for editing), `reviewTemplate` (needs a platform admin, records the reviewer, re-validates and refuses if the stored tree no longer matches what was imported), `publishTemplate` (only REVIEWED; retires the career's previous published version), `retireTemplate`, `listTemplates`.
- **CLI** (`npm run roadmap:content -- templates validate|import|review|publish|retire|export|list`) and a **platform-admin editor** at `/admin/roadmap-templates` (paste or edit JSON, validate-and-save, mark reviewed, publish, retire). Its API is `/api/roadmap-admin/templates*`; a guard test checks every route calls `requirePlatformAdmin` first and the page 404s for non-admins.
- **Three original trees** in `content/roadmaps/` (provenance: designed by Capabilio from first principles and the canonical taxonomy, not derived from any third-party roadmap):
  | Career | Topics | Spine stages | Edges |
  |---|---|---|---|
  | Software Engineer | 55 | 8 | 44 |
  | Data Analyst | 35 | 8 | 28 |
  | AI/ML Engineer | 40 | 8 | 35 |
  Targets for skills a career already requires come from that career's requirement rows (shown as "career requirement" in the panel); the others are Capabilio's design targets.
- **Tests:** 69 unit tests across the new modules (including that all three trees validate, record provenance, use only starter or review-file skills and have 8 spine stages with groups on both sides); 7 live tests against the real database (draft → no-op → export round-trip, review gating and recorded reviewer, publish visible to students, a new version retires the old one, a published version is immutable, edits clear review and a change behind the pipeline's back is caught, missing/pending skills and cycles stop the import). One real bug found and fixed by the live test: the hash depended on node order, so review wrongly refused an untouched tree.
- **Blocked on you:** the trees use 81 child skills that are inactive candidates, so `templates import` correctly refuses them today ("is candidate, not active"). Review `content/skills/roadmap-child-skills.json`, then run `npm run roadmap:content -- skills activate --all-from-file` and I (or you) run `templates import content/roadmaps`.
- **Verification:** logic and database behaviour are tested; the admin page and its buttons have **not** been clicked in a browser (Chrome extension not connected).
