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

---

# Phase 2 — Design (with reasoning)

**Pipeline.** PDF bytes → `checkPdfBytes` (magic bytes, ≤15 MB) → `pdf-parse` per-page text (running page header/number stripped) → `chunkSyllabus`
→ (a) one **table chunk** per semester, trimmed at its `Total` row so Minor/Honors/MOOC pools after it are excluded, and (b) one **course section**
per course (title + parsed Course Outcomes) → per table chunk one AI call (`extractSubjectsFromTable`, strict zod schema, JSON mode, retry-with-error) →
each name **grounded** against the chunk text (≥90 % of its words must appear; otherwise flagged) → `mergeRows` joins table rows to course sections
(table authoritative; sections with no table row are added *flagged*) → per semester, batches of ≤10 subjects **that have Course Outcomes** go to
`suggestAreasForOutcomes` (keys filtered to the role's real skill areas; empty list is a valid answer) → one `ExtractionResult`.
Why chunk this way: the document has clear per-semester tables; one call per semester keeps prompts under ~3 k tokens (cost + quality) and lets a
failed semester degrade to a visible warning instead of failing the whole file.

**Schema.** `CandidateRow` = the CSV row's fields (`year`, `semester`, `name`, `code`; branch is chosen once at upload) plus `category`, `kind`
(course/lab/elective_option/project/audit), `confidence`, `needsReview` + `reason`, `outcomesCount`, `suggestedAreaKeys`, `mappingNote`.
Extending the CSV shape means the confirm step is literally the CSV import's own request (`POST /subjects` grouped by year/semester).

**Boundary detection.** Confirmed on the real file: table = line matching `B.Tech.[–-] <I–IV> Year <I|II> Semester`; course section = line matching
`<I–IV> Year <I|II> Semester` without `B.Tech`; a heading that repeats (page-break fragment) is merged. Roman numerals only — other colleges'
formats are the known limitation (they yield an honest `unrecognised_format`).

**Job shape.** `POST /api/admin/curriculum/extractions` validates, inserts a `processing` row (`curriculum_extractions`, migration 046), returns **202**,
and runs the job in `after()` (`maxDuration` 300; real file ≈ 90–115 s). The page polls `GET …/extractions/[id]` every 2.5 s; the server page also loads
the admin's latest extraction, so navigating away and back resumes. A `processing` row idle > 10 min is reported `failed` (instance died). One active job
per institution; 5 uploads/hour/admin. The PDF is never stored — only the validated candidates.

**Confidence UI.** Rows the reader wasn't sure of (`needsReview`) start **unticked** with a visible reason; the header says "N need your review". A row
with no confident skill match shows "No confident skill match — map by hand or skip"; one with no Course Outcomes text shows "No course outcomes in the
PDF — use Suggest after import" (mapping is only ever suggested from outcomes text, never from a title alone).

**Validation.** Non-PDF (415), empty (400), > 15 MB (413) rejected before parsing; the real syllabus is 2.2 MB, so 15 MB leaves ~7× headroom for
image-heavy syllabi. No text layer (< 80 chars/page) → `no_text_layer`; > 400 pages or damaged → `unreadable`.

# Phases 3–6 — Build and verification record
Real-fixture result (JNTUK R23 CSE, live model): **61 subjects** — II-I 9, II-II 9, III-I 12, III-II 16, IV-I 14, IV-II 1 — all attributed to the right
semester; 0 unmatched; 28 course sections carry parsed Course Outcomes; 6 subjects got a suggested mapping (e.g. DBMS → SQL, Probability & Statistics →
Statistics, Data Mining Lab → Data cleaning + Statistics), 22 had outcomes but no confident match, 33 had no outcomes text. ~90–115 s end to end.
Bugs found by running the real file and fixed: pool lists after the semester `Total` row were extracted as subjects; `1` vs `I` and "/ SWAYAM …" suffixes
broke table↔section matching; three Course-Outcome formats; `pdf-parse` detaches the buffer it is given.
