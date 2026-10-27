import type { CSSProperties } from "react";
import type { LogSource } from "@/lib/workplace/soc/types";

/**
 * Dark-console tokens, defined once here and scoped to the console root (the surrounding app stays light). Text colours are chosen for >= 4.5:1
 * on --soc-panel and --soc-bg. The look is SIEM/EDR-inspired in general terms only.
 */
export const SOC_VARS = {
  "--soc-bg": "#0a101c",
  "--soc-panel": "#111a2b",
  "--soc-raised": "#182337",
  "--soc-line": "#2a3853",
  "--soc-text": "#e6edf7",
  "--soc-muted": "#9fb0c9",
  "--soc-focus": "#7cb8ff",
  "--soc-accent": "#4cc2ff",
  "--soc-crit": "#ff8590",
  "--soc-high": "#ffa860",
  "--soc-med": "#f6d24c",
  "--soc-low": "#62dba5",
  "--soc-info": "#85bcff",
  "--soc-ok": "#62dba5",
} as CSSProperties;

export const FOCUS = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--soc-focus)]";
export const PANEL = "rounded-lg border border-[var(--soc-line)] bg-[var(--soc-panel)]";
export const H = "font-lp-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--soc-muted)]";
export const INPUT = `w-full rounded-md border border-[var(--soc-line)] bg-[var(--soc-bg)] px-2.5 py-1.5 font-lp-mono text-[12px] text-[var(--soc-text)] placeholder:text-[var(--soc-muted)] ${FOCUS}`;
export const BTN = `rounded-md border border-[var(--soc-line)] bg-[var(--soc-raised)] px-2.5 py-1.5 font-lp-body text-[12px] font-semibold text-[var(--soc-text)] hover:border-[var(--soc-muted)] disabled:opacity-50 motion-safe:transition-colors ${FOCUS}`;

/** colour + glyph + word per severity: colour is never the only signal */
export const SEVERITY_STYLE: Record<string, { color: string; glyph: string }> = {
  critical: { color: "var(--soc-crit)", glyph: "▲▲" },
  high: { color: "var(--soc-high)", glyph: "▲" },
  medium: { color: "var(--soc-med)", glyph: "◆" },
  low: { color: "var(--soc-low)", glyph: "▼" },
  info: { color: "var(--soc-info)", glyph: "●" },
};

export const SOURCE_COLOR: Record<LogSource, string> = {
  auth: "#b9a1ff",
  proxy: "#5fd3ea",
  dns: "#7fe3a2",
  endpoint: "#ff9fc6",
  firewall: "#ffbb70",
  email: "#8fb9ff",
};
