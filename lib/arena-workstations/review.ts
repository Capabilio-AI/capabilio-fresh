/**
 * Pure. The answer a student is about to submit, laid out for a last look: every part of it, in the words of the task where the task has words for them, so
 * nothing is hidden behind a button. Used by the review step that comes before the one final submission. Never reads an answer key.
 */
export interface ReviewSection {
  title: string;
  /** monospace blocks (code, formulas) are shown as written; lines are shown as a list */
  kind: "code" | "lines";
  lines: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown) => (v === null || v === undefined || v === "" ? "(blank)" : typeof v === "string" ? v : JSON.stringify(v));

/** The label a task gives each answer field, by key, from the task's own content. */
function labelsOf(content: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const c = isObj(content) ? content : {};
  for (const f of Array.isArray(c.fields) ? c.fields : []) if (isObj(f) && typeof f.key === "string" && typeof f.label === "string") out[f.key] = f.label;
  for (const q of Array.isArray(c.questions) ? c.questions : []) {
    if (!isObj(q) || !Array.isArray(q.fields)) continue;
    for (const f of q.fields) if (isObj(f) && typeof f.key === "string" && typeof f.label === "string") out[f.key] = `${typeof q.id === "string" ? q.id.toUpperCase() + ": " : ""}${f.label}`;
  }
  return out;
}

const answers = (title: string, raw: unknown, labels: Record<string, string>): ReviewSection[] =>
  isObj(raw) && Object.keys(raw).length > 0 ? [{ title, kind: "lines", lines: Object.entries(raw).map(([k, v]) => `${labels[k] ?? k}: ${text(v)}`) }] : [];

const note = (title: string, v: unknown): ReviewSection[] => (typeof v === "string" && v.trim() ? [{ title, kind: "lines", lines: [v.trim()] }] : []);

export function reviewSubmission(toolType: string, submission: unknown, content?: unknown): ReviewSection[] {
  if (!isObj(submission)) return [];
  const s = submission;
  const labels = labelsOf(content);
  switch (toolType) {
    case "sql_workspace":
      return [{ title: "Your query", kind: "code", lines: [text(s.query)] }, ...note("Your note to the requester", s.note)];
    case "spreadsheet_workspace": {
      const cells = isObj(s.cells) ? Object.entries(s.cells).filter(([, v]) => typeof v === "string" && v !== "") : [];
      const pivots = isObj(s.pivots) ? Object.entries(s.pivots).map(([k, p]) => (isObj(p) ? `PivotTable ${Number(k) + 1}: rows ${text(p.rows)}, ${text(p.fn)} of ${p.values === null ? "rows" : text(p.values)}` : "")) : [];
      return [
        { title: `Your formulas (${cells.length})`, kind: "code", lines: cells.length ? cells.map(([a, f]) => `${a}: ${f}`) : ["(no formulas written)"] },
        ...(pivots.length ? [{ title: "Your PivotTables", kind: "lines" as const, lines: pivots }] : []),
      ];
    }
    case "dashboard_workspace": {
      const spec = isObj(s.spec) ? s.spec : {};
      const filters = Array.isArray(spec.filters) ? spec.filters.filter(isObj).map((f) => `${text(f.column)} ${text(f.operator)} ${text(f.value)}`) : [];
      const value = typeof spec.dax === "string" && spec.dax ? `DAX measure: ${spec.dax}` : `${text(spec.aggregation)} of ${spec.measure === null ? "rows" : text(spec.measure)}${spec.quick && spec.quick !== "none" ? ` (${text(spec.quick).replace(/_/g, " ")}${spec.measure2 ? ` / ${text(spec.measure2)}` : ""})` : ""}`;
      return [
        { title: "Your chart", kind: "lines", lines: [`Type: ${text(spec.chart_type)}`, `By: ${text(spec.dimension)}${spec.dimension_grain === "month" ? " (by month)" : ""}`, `Value: ${value}`, `Filters: ${filters.length ? filters.join("; ") : "none"}`, `Sort: ${text(spec.sort).replace(/_/g, " ")}${spec.limit ? `, top ${text(spec.limit)}` : ""}`] },
        ...note("Your takeaway", s.note),
      ];
    }
    case "cleaning_workspace": {
      const steps = Array.isArray(s.steps) ? s.steps.filter(isObj) : [];
      return [{ title: `Your cleaning steps (${steps.length})`, kind: "lines", lines: steps.length ? steps.map((st, i) => `${i + 1}. ${text(st.op).replace(/_/g, " ")}${st.column ? ` on ${text(st.column)}` : Array.isArray(st.columns) ? ` on ${st.columns.join(" + ")}` : ""}${st.from !== undefined ? ` "${text(st.from)}" to "${text(st.to)}"` : ""}${st.format ? ` from ${text(st.format)}` : ""}${st.operator ? ` ${text(st.operator)} ${text(st.value)}` : ""}`) : ["(no steps applied)"] }];
    }
    case "statistics_workspace":
      return [...answers("Your answers", s.answers, labels), ...note("Your working", s.working)];
    case "investigation_workspace":
      return [...answers("Your findings", s.answers, labels), ...note("Your note to the requester", s.note)];
    case "ml_workspace":
      return [...answers("The numbers you report", s.answers, labels), ...(Array.isArray(s.predictions) ? [{ title: "Your predictions", kind: "lines" as const, lines: [`${s.predictions.length} predictions`] }] : []), ...(typeof s.code === "string" && s.code.trim() ? [{ title: "Your notebook", kind: "code" as const, lines: [s.code] }] : [])];
    case "code_workspace":
      return [{ title: "Your code", kind: "code", lines: [text(s.code)] }];
    case "devops_workspace":
    case "frontend_workspace":
      return [{ title: "Your files", kind: "code", lines: Array.isArray(s.files) ? s.files.filter(isObj).map((f) => `// ${text(f.name)}\n${text(f.content)}`) : ["(no files)"] }];
    default:
      return [{ title: "Your answer", kind: "code", lines: [JSON.stringify(s, null, 2)] }];
  }
}
