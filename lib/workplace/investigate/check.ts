import type { Checked } from "../office/pick";
import type { InvestigationDraft } from "./types";

/** An investigation is only served if its answers fit its form: every field has an expected answer of the right kind, and numbers have a tolerance. */
export function checkInvestigation(draft: InvestigationDraft): Checked<null> {
  const keys = draft.fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) return { ok: false, reason: "duplicate field keys" };
  if (Object.keys(draft.answers).sort().join() !== [...keys].sort().join()) return { ok: false, reason: "answers do not match the fields" };
  if (draft.tables.length === 0 || draft.tables.some((t) => t.rows.length === 0 && t.name !== "order_audit")) return { ok: false, reason: "a table is empty" };
  for (const f of draft.fields) {
    const answer = draft.answers[f.key];
    if (f.type === "choice" && !f.options.includes(String(answer))) return { ok: false, reason: `${f.key}: the answer is not one of the options` };
    if (f.type === "text" && String(answer).trim() === "") return { ok: false, reason: `${f.key}: empty answer` };
    if (f.type === "number") {
      if (typeof answer !== "number" || !Number.isFinite(answer) || answer <= 0) return { ok: false, reason: `${f.key}: the number must be positive` };
      if (draft.tolerance[f.key] === undefined) return { ok: false, reason: `${f.key}: no tolerance` };
    }
  }
  return { ok: true, value: null };
}
