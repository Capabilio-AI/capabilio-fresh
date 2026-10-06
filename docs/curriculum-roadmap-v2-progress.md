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

## Not yet wired
`resolveSkill` is not called by anything yet — Phase 2/3 (mappings, extraction) and Phase 5 (career requirement backfill) consume it.

## Open questions
- Starter taxonomy review: category names and the aliases that map broad words (e.g. "communication" → Technical Communication, "devops" → CI/CD) are product choices; flag any you want changed.
