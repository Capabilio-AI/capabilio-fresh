# Curriculum PDF extraction — progress

**Current phase:** 3 (pipeline) — resume from here.

## Decisions
- Async = Next `after()` + a private staging table `curriculum_extractions` (046); client polls; stale `processing` (>10 min) shown as failed.
- The PDF itself is not stored; only validated candidates are staged. Nothing writes to `curriculum_subjects` until the admin confirms; confirm reuses `POST /subjects` and the existing mapping write.
- Chunks: one per semester table (structure) + one AI mapping call per semester (batched course sections). Never the whole document.
- Anti-hallucination: every AI-extracted title must be grounded in the chunk text; ungrounded/low-confidence rows are kept but flagged "needs review".

## Done
- Phase 1 audit, Phase 2 design (this file + audit doc).

## Remaining
- Phases 3–6 (pipeline, review UI, tests, verify).
