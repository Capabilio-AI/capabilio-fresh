# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Engineering students mid-degree, mostly on a laptop, choosing a target career and deciding what to learn next. Faculty and mentors also read the same roadmap to advise students (staff access is governed by the RBAC model; self-access is implicit).

## Product Purpose
Capabilio AI turns a student's academic record, assessments, projects and GitHub activity into a structured, verifiable picture of career readiness. The visual roadmap is the surface where that picture becomes a path: a career tree whose every topic shows the student's measured state and next step. Success: a student knows exactly where they stand and what to do next; an advisor can read the same map and trust it.

## Positioning
Not a generic roadmap chart. Each topic carries personal state computed from real evidence (level is "Not assessed" when nothing is measured, never a fake 0 or "verified"), prerequisite locking, and a "check this score" consistency flag. The map is AI-generated per career, refreshes on a schedule, and shows what changed.

## Operating Context
Visual roadmap under `components/roadmap/visual/`: canvas (@xyflow/react), accessible list view, topic panel, syllabus map, "building roadmap" generation progress screen, empty states, what-changed view, diagnostics, learn-with-AI. Roadmap versions are immutable; student node state is Learning/Done/Skipped (skip needs a reason).

## Capabilities and Constraints
- Node statuses: Not assessed / Not started / Learning / Done / Skipped / Target met / Needs check / Locked.
- Templates move DRAFT → REVIEWED → PUBLISHED; trees have a spine of stages with groups on both sides.
- AI provider is Bedrock with Groq fallback; generation is asynchronous and polled.
- Existing canvas engine and list alternative are in place.

## Brand Commitments
The user is free to replace the current brand look on this surface (existing lp- tokens: indigo/ochre, Geist/Inter are evidence, not binding).

## Evidence on Hand
Real stored assessments, evidence records, templates with provenance; docs in `docs/roadmap-visual-audit.md` and `docs/roadmap-visual-progress.md`. No fabricated testimonials or metrics.

## Product Principles
1. Evidence over decoration: never display a state the data does not support.
2. Honest absence: "Not assessed" is a first-class state.
3. One map for student and advisor: same truth, readable by both.
4. The next step is always visible.

## Accessibility & Inclusion
Canvas must have an equivalent keyboard/screen-reader list view; status never conveyed by color alone.
