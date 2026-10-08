import type { GraphNode } from "@/lib/roadmap-visual/graph-types";

type Status = GraphNode["status"];

/** Every status has a label AND a glyph, so meaning never depends on colour alone. */
export const STATUS_META: Record<Status, { label: string; glyph: string; box: string; chip: string }> = {
  NOT_ASSESSED: { label: "Not assessed yet", glyph: "?", box: "border-dashed border-app-border bg-white text-app-charcoal", chip: "bg-app-background text-app-muted" },
  NOT_STARTED: { label: "Below target", glyph: "○", box: "border-app-border bg-white text-app-charcoal", chip: "bg-app-attention-container text-app-attention" },
  LEARNING: { label: "Learning", glyph: "◐", box: "border-app-orange bg-app-orange-container text-app-charcoal", chip: "bg-app-orange-container text-app-orange" },
  SKIPPED: { label: "Skipped", glyph: "⤼", box: "border-app-border bg-app-background text-app-muted line-through", chip: "bg-app-background text-app-muted" },
  TARGET_MET: { label: "Proven", glyph: "✓", box: "border-app-success bg-app-success-container text-app-charcoal", chip: "bg-app-success-container text-app-success" },
  NEEDS_CHECK: { label: "Needs a check", glyph: "!", box: "border-app-warning bg-app-warning-container text-app-charcoal", chip: "bg-app-warning-container text-app-warning" },
  LOCKED: { label: "Do the prerequisite first", glyph: "🔒", box: "border-app-border bg-app-background text-app-muted", chip: "bg-app-background text-app-muted" },
};

export const COVERAGE_LABEL = { STRONG: "Strong in your syllabus", PARTIAL: "Partly in your syllabus", NONE: "Not in your syllabus", UNKNOWN: "Syllabus coverage unknown" } as const;
export const COVERAGE_GLYPH = { STRONG: "●●", PARTIAL: "●○", NONE: "○○", UNKNOWN: "··" } as const;

export const STAGE_LABEL = { FOUNDATION: "Foundation", CORE: "Core", SPECIALIZATION: "Specialization", JOB_READY: "Job-ready" } as const;
