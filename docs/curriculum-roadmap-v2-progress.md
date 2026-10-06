# Curriculum → Student Roadmap (v2) — Progress

Audit: `docs/curriculum-roadmap-audit.md` (Phase 0). Earlier job-track work: `docs/curriculum-roadmap-progress.md`.

## Decisions (approved 2026-10-06)
1. Canonical skills: **extend the existing `skills` table in place**; the 146 old free-text rows become `candidate` (never resolved, never mapped to).
2. Careers: new normalized `careers` / `career_skill_requirements`; legacy `career_requirements` kept until Career Path / Skill Gap migrate.
3. Hierarchy: keep `institutions` + branch text; regulation lives on the import. No University/Program/Branch tables.
4. Capabilio admin: operator-only (SQL/seed scripts) for taxonomy, careers, catalogs, skill-suggestion review. No platform-admin UI.
5. Roadmap shows for **all tracks that have a career goal** (lifts the job-track-only gate).
6. Capability level: `capabilities.capability_score` is the source of truth where present; Arena-only skills get a documented, explicit count→level formula (to be written in Phase 5).

## Phase 1 — Canonical skills + resolver: DONE
- **Migration 047** (applied): `skills` + key/category/parent/description/level_definition/status/updated_at; `skill_aliases`; `skill_suggestions` (private review queue); `arena_skill_areas.skill_id`. Seeded 53 active skills (editable starter set, product-team review) and 144 aliases; all 6 Data Analyst Arena areas linked; 136 old rows stay `candidate`.
- **Code:** `lib/skills/normalize.ts`, `resolve.ts` (pure `resolveSkill`: exact alias → conservative fuzzy → null; active skills only; never creates), `store.ts` (`loadSkillIndex`, `recordUnresolved`, `resolveSkills`).
- **Tests:** 8 resolver unit tests, 4 static migration tests, 4 live tests (spelling variants → one skill; candidates not resolved; Arena areas linked; unresolved queued not created; anon cannot write skills/aliases or read suggestions). Fixtures cleaned (0 leftover rows).
- **Gates:** `tsc` clean, eslint clean on touched paths, 458 unit tests pass, live skills tests pass; Supabase security advisors show only the intended INFO for `skill_suggestions` (private, no policies).
- `lib/supabase/types.ts`: patched with anchored edits (not regenerated), diff reviewed.

## Phase 2 — Curriculum model: DONE
- **Migrations 048, 049, 050** (applied). 048: `curriculum_imports`, `curriculum_versions`, `courses`, `course_outcomes`, `course_units`, `unit_topics`, `lab_experiments`, `program_outcomes`, `other_curriculum_items`, `course_skill_mappings`, `course_outcome_skill_mappings`; all service-role-only. 049: fixes a flaw found by the live test (a published curriculum blocked deleting its institution; the delete guards now stand down only for an institution cascade). 050: pins `search_path` on the new functions (advisor WARN I introduced).
- **A version is a frozen import**, not a row copy: `publish_curriculum_import(import, user)` (service-role only, atomic) writes the immutable `curriculum_versions` row, flips CONFIRMED→PUBLISHED, and archives the previous PUBLISHED import of the same institution + branch + **regulation**. Triggers then refuse any edit to that import's courses, outcomes, units, topics, labs, POs and mappings; versions cannot be updated/deleted; published imports cannot be deleted or modified. A different regulation coexists (its students are a different cohort); matching students to a regulation is Phase 5.
- **DB invariants:** an `AI_SUGGESTED` mapping can never be `CONFIRMED`; a `CONFIRMED` mapping must have `approved_at`; unit topics / outcome mappings must belong to the same course as their parent (composite FKs); status lifecycle DRAFT→EXTRACTED→UNDER_REVIEW→CONFIRMED→PUBLISHED→ARCHIVED enforced by trigger.
- **Backfill (in 048, exact):** 61 legacy subjects → 61 courses, 9 legacy mappings → 9 CONFIRMED mappings (2 `MANUAL` from `admin`, 7 `COLLEGE_CONFIRMED` from `ai_suggestion_confirmed`), in one PUBLISHED v1 import. `importance` and `confidence` are NULL (the legacy data never recorded them; roadmap math treats null importance as SUPPORTING). Legacy tables are **unmodified**; safety copies `curriculum_subjects_pre048` and `curriculum_subject_skill_map_pre048` (drop after the Phase 4 cutover). No paid Supabase branch was created: the migration only adds.
- **Code:** `lib/curriculum/mapping-rules.ts` (pure: `proposeAiMapping`, `confirmMapping`, `rejectMapping`, `isOfficial`, `officialOnly`, `canTransitionImport`).
- **Tests:** 24 rule unit tests; static migration tests for 047–050; 8 live tests on a throwaway institution (whole tree, AI/approval CHECKs, lifecycle, empty-import refusal, freeze on every table, supersede/archive, regulation coexistence, no client access, institution cascade). Existing admin/roadmap/skills live tests still pass (13).
- **Gates:** `tsc` clean, eslint clean on touched paths, 507 unit tests pass. `lib/supabase/types.ts` regenerated from the live schema (additions only; also types `curriculum_extractions`).
- **Live-test flakiness:** across 7 full runs, 5 were green; the 2 others failed with `TypeError: fetch failed` (dev machine → Supabase transport) on different steps, never on a logic assertion. Fixtures are cleaned even then (verified 0 leftovers). Not retried automatically on purpose (retrying writes could mask bugs).

## Known drift until Phase 4
The admin UI and student roadmap still read/write the legacy tables. Anything added there after migration 048 is NOT in the new model. Phase 4 switches the writers; before that cutover, reconcile (new version from the legacy rows) and then drop the `*_pre048` copies.

## Not yet wired
`resolveSkill` and the new curriculum tables/rules are not called by app code yet — Phase 3 (extraction) and Phase 4 (college UI) consume them; Phase 5 consumes the resolver for the career-requirement backfill.

## Open questions
- Starter taxonomy review: category names and the aliases that map broad words (e.g. "communication" → Technical Communication, "devops" → CI/CD) are product choices; flag any you want changed.
