# Curriculum PDF extraction — progress

**Current phase:** COMPLETE (Phases 1–6), except a click-through in a real browser (see "Not done").

## Decisions
- Async = Next `after()` + private staging table `curriculum_extractions` (046, applied); client polls; idle `processing` > 10 min shows as failed.
- The PDF itself is never stored; only validated candidates are staged. Nothing writes to `curriculum_subjects` until the admin confirms; confirm reuses `POST /subjects` + `PUT /subjects/[id]/mapping`.
- Chunks: one AI call per semester table + one per ≤10 course sections with Course Outcomes. Never the whole document.
- Anti-hallucination: AI names must be grounded in the chunk text; ungrounded/low-confidence rows are kept, flagged, and start unticked.
- Mapping is suggested only from Course-Outcome text; no outcomes → "no outcomes", no confident match → "none confident". Sole AI gateway stays `lib/roadmap/suggest.ts` (guard test kept).

## Done / verified
- Audit + design: `docs/curriculum-pdf-extraction-audit.md`.
- Pipeline (`lib/roadmap/extract/*`), API (`app/api/admin/curriculum/extractions*`), UI (`SyllabusExtraction`, `ExtractionReview`), migration 046.
- Real fixture, live model: 61 subjects, 6 semesters correct, 0 unmatched (see audit doc).
- Tests: `extract.test.ts` (real PDF, validation, matching, pipeline with stubbed AI), `extraction.live.test.ts` (authority, scoping, no premature writes, no-text-layer), `extraction.e2e.live.test.ts` (real HTTP + real session + real PDF + real AI: 202 promptly → processing → ready → confirm via existing routes → discard; page renders; cross-institution 404), guard test (extraction code never touches curriculum tables).
- Existing `admin.live.test.ts` still passes (assertions loosened for the additive `subjects` field).

## Not done
- Click-through in a real browser: the Claude-in-Chrome extension is not connected. Everything the UI calls was exercised over HTTP; the React components were type-checked, linted, built and server-rendered but not clicked.
- Amrita Sai specifically: not run against that institution's real admin (no such admin account exists yet — see curriculum-roadmap-progress.md item 4).
