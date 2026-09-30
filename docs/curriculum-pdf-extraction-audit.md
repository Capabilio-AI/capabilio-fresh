# Curriculum PDF extraction — Phase 1 audit

Fixture: `docs/fixtures/jntuk-r23-btech-cse.pdf` (158 pages, 2.2 MB, real text layer). It was the only 158-page PDF on the
machine (`~/Downloads/8529641773304296341.pdf`); confirmed by extraction to be "JNTUK R23 B.Tech CSE COURSE STRUCTURE & SYLLABUS,
From II Year to IV Year".

## Current `/org/curriculum` (read from code, not from the brief)
- Page: `app/org/curriculum/page.tsx` — guard `orgPageContext("manageCurriculum")`, first enabled role from `listEnabledRoles`,
  `listSubjectsForAdmin`, renders `components/admin/CurriculumManager.tsx`.
- Manual entry: branch + year + lines "name, code" → `POST /api/admin/curriculum/subjects` (`SubjectsBodySchema`, `.strict()`,
  no institution in body) → `addSubjects` (service role; duplicates skipped via unique-index `23505`).
- CSV import: `lib/roadmap/csv.ts` `parseCurriculumCsv` → `CsvSubjectRow {branch, year, semester|null, name, code|null}` → preview text
  line + "Import N" button → groups by branch/year/semester → the SAME `POST /subjects` per group. Preview is a one-line summary,
  not an editable table.
- Skill mapping: `SubjectMappingRow` — "Suggest" → `POST /api/admin/curriculum/suggest-mapping` (propose-only, rate-limited 30/min,
  `suggestAreasForSubject`) → checkboxes → "Confirm mapping" → mapping write via `setMapping` (`source` = `ai_suggestion_confirmed`
  or `admin`, `confirmed_by`). Only skill areas that exist for the role are accepted.
- Gate: `requireOrgAdmin` → `getOrgAdmin` (institution derived from the caller's own ACTIVE membership + `curriculum` permission or
  `can(organisation, admin)`); never from the request.

## AI abstraction
`lib/ai/groq.ts` `completeJson(prompt, systemPrompt, zodSchema)` — Groq `openai/gpt-oss-120b`, JSON mode, validation error fed back,
up to 4 attempts, 15 s backoff on 429. Existing pattern to reuse: `suggest.ts` (keys filtered to the valid set, empty list valid).
`GROQ_API_KEY` is present in `.env.local`.

## Background jobs
None exist (no queue, cron, Inngest; no `after()` usage). Next 16 provides `after()` (`next/server`) — runs after the response for
the route's `maxDuration`. Reused as the mechanism; job state lives in a table so the admin can navigate away and come back.

## Authority / RLS
Migration 033: RLS enabled with no policies and `revoke all … from anon, authenticated` on `curriculum_subjects` and
`curriculum_subject_skill_map`; `admin.live.test.ts` asserts a signed-in admin cannot read/write them. The new staging table follows
the identical pattern and the live test is extended to it (Phase 5).

## Upload conventions
`app/api/org/offers/letter/route.ts`: `request.formData()`, `MAX_MEDIA_BYTES` 5 MB, magic-byte sniff (`sniffDocument` checks `%PDF-`),
never trusts the browser Content-Type; institution from `authorizeOrg`. The syllabus route reuses the sniff and raises the cap.

## Fixture structure (verified against the real text)
- Semester course-structure tables begin with `B.Tech.– II Year I Semester` (also `B.Tech. III Year II Semester`,
  `B.Tech. – III Year I Semester`; dash/spacing vary). One per semester, II-year I → IV-year II; **no Year I** (starts "From II Year").
  Rows: `S.No. Category Title L T P Credits`; titles wrap across lines; electives are numbered lists (`1. Object Oriented Analysis and
  Design` …) with generic placeholders ("Open Elective-I OR …", "12 week MOOC …", Minor/Honors pool rows).
- **No course codes anywhere** in the document → `code` stays null.
- Per-course sections start `II Year I Semester` (no `B.Tech`), title either on the same line (`III Year I Semester DATA WAREHOUSING &
  DATA` + wrapped `MINING`) or the next line(s), then `L T P C`. 58 such sections. 29 contain "Course Outcomes"; statements are
  `CO1: … (K3)` lines (235 `CO\d` lines, but the `CO1 H M L …` PO-matrix rows have no colon and must be excluded).
- So a subject exists in two places: the semester table (authoritative list) and its course section (Course Outcomes).
