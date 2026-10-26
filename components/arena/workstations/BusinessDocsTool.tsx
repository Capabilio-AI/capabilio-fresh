"use client";

import type { ReactNode } from "react";
import { Loader2, Plus, Send, X } from "lucide-react";
import type { BusinessDocsContent, BusinessDocsSubmission } from "@/lib/workplace/business-docs/types";
import { useDraft, type ToolProps } from "./useDraft";

const inputClass = "w-full rounded-lg border border-app-border bg-white px-2.5 py-1.5 font-lp-body text-[12.5px] text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15 disabled:bg-app-background";
const labelClass = "flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted";

/** The draft keeps lists as the text the student typed; it becomes the structured submission on submit. */
interface Draft {
  stories: { id: string; text: string; covers: string; criteria: string }[];
  issues: { kind: "contradiction" | "duplicate"; a: string; b: string }[];
  tests: { id: string; title: string; covers: string }[];
  process: { id: string; type: "start" | "task" | "decision" | "end"; label: string; owner: string; next: string }[];
  raci: Record<string, Record<string, "R" | "A" | "C" | "I" | "">>;
  gaps: { note: string; current: string; target: string; action: string; owner: string }[];
}
const EMPTY: Draft = { stories: [], issues: [], tests: [], process: [], raci: {}, gaps: [] };
/** Next free id with this prefix, so removing a row never makes a new row reuse an id still in use. */
const nextId = (prefix: string, used: string[]): string => `${prefix}${Math.max(0, ...used.map((id) => (id.startsWith(prefix) ? Number(id.slice(prefix.length)) || 0 : 0))) + 1}`;
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** "pay:Yes, tell:No" or "close" -> links */
const links = (s: string) => list(s).map((part) => {
  const [to, ...label] = part.split(":");
  return { to: to.trim(), label: label.join(":").trim() };
});

function toSubmission(d: Draft): BusinessDocsSubmission {
  return {
    stories: d.stories.map((s) => ({ id: s.id.trim(), text: s.text, covers: list(s.covers), criteria: s.criteria.split("\n").map((c) => c.trim()).filter(Boolean) })),
    issues: d.issues.filter((i) => i.a && i.b).map((i) => ({ kind: i.kind, refs: [i.a, i.b] as [string, string] })),
    tests: d.tests.map((t) => ({ id: t.id.trim(), title: t.title, covers: list(t.covers) })),
    process: d.process.map((p) => ({ id: p.id.trim(), type: p.type, label: p.label, owner: p.owner, next: links(p.next) })),
    raci: d.raci,
    gaps: d.gaps,
  };
}

function Section({ title, hint, children, onAdd, closed }: { title: string; hint: string; children: ReactNode; onAdd?: () => void; closed: boolean }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-app-border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-lp-body text-[13px] font-semibold text-app-charcoal">{title}</h3>
        {onAdd && !closed && (
          <button type="button" aria-label={`Add to ${title}`} onClick={onAdd} className="flex items-center gap-1 font-lp-mono text-[11px] font-semibold text-app-blue">
            <Plus size={12} /> Add
          </button>
        )}
      </div>
      <p className="font-lp-body text-[11.5px] text-app-muted">{hint}</p>
      {children}
    </section>
  );
}

function RemoveButton({ onClick, closed }: { onClick: () => void; closed: boolean }) {
  return closed ? null : (
    <button type="button" aria-label="Remove row" onClick={onClick} className="self-start text-app-rose">
      <X size={14} />
    </button>
  );
}

export function BusinessDocsTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<BusinessDocsContent>) {
  const [draft, setDraft] = useDraft<Draft>(attemptId, "doc", EMPTY);
  const has = (s: BusinessDocsContent["sections"][number]) => content.sections.includes(s);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });
  const edit = <K extends "stories" | "issues" | "tests" | "process" | "gaps">(key: K, i: number, patch: Partial<Draft[K][number]>) =>
    set(key, draft[key].map((row, j) => (j === i ? { ...row, ...patch } : row)) as Draft[K]);
  const remove = <K extends "stories" | "issues" | "tests" | "process" | "gaps">(key: K, i: number) => set(key, draft[key].filter((_, j) => j !== i) as Draft[K]);
  const noteIds = content.notes.map((n) => n.id);
  const ownerSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select aria-label={label} value={value} disabled={closed} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">Owner…</option>
      {content.roles.map((r) => (
        <option key={r}>{r}</option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-app-border bg-app-background/60 p-4">
        <h3 className="mb-2 font-lp-body text-[13px] font-semibold text-app-charcoal">Stakeholder notes · {content.company}</h3>
        <ol className="flex flex-col gap-1.5">
          {content.notes.map((n) => (
            <li key={n.id} className="font-lp-body text-[12.5px] text-app-charcoal">
              <span className="mr-2 font-lp-mono text-[11px] font-semibold text-app-blue">{n.id}</span>
              {n.text} <span className="text-app-muted">({n.from})</span>
            </li>
          ))}
        </ol>
        {content.asIs && (
          <>
            <h4 className="mb-1 mt-3 font-lp-body text-[12px] font-semibold text-app-charcoal">How it works today</h4>
            <ol className="list-decimal pl-5 font-lp-body text-[12.5px] text-app-charcoal">
              {content.asIs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </>
        )}
      </section>

      {has("stories") && (
        <Section title="User stories" hint="As a …, I want …, so that …. Cite the note IDs each story covers (comma separated). One Given / When / Then criterion per line." closed={closed} onAdd={() => set("stories", [...draft.stories, { id: nextId("S", draft.stories.map((x) => x.id)), text: "", covers: "", criteria: "" }])}>
          {draft.stories.map((s, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-app-border p-2 sm:grid-cols-[70px_1fr_auto]">
              <input aria-label="Story ID" value={s.id} disabled={closed} onChange={(e) => edit("stories", i, { id: e.target.value })} className={inputClass} />
              <div className="flex flex-col gap-2">
                <textarea aria-label="Story" rows={2} value={s.text} disabled={closed} placeholder="As a …, I want …, so that …" onChange={(e) => edit("stories", i, { text: e.target.value })} className={inputClass} />
                <input aria-label="Notes covered" value={s.covers} disabled={closed} placeholder="Covers notes, e.g. N1, N3" onChange={(e) => edit("stories", i, { covers: e.target.value })} className={inputClass} />
                <textarea aria-label="Acceptance criteria" rows={3} value={s.criteria} disabled={closed} placeholder="Given …, when …, then …" onChange={(e) => edit("stories", i, { criteria: e.target.value })} className={inputClass} />
              </div>
              <RemoveButton closed={closed} onClick={() => remove("stories", i)} />
            </div>
          ))}
        </Section>
      )}

      {has("issues") && (
        <Section title="Issues to settle" hint="Flag two notes that say the same thing (duplicate) or cannot both be true (contradiction)." closed={closed} onAdd={() => set("issues", [...draft.issues, { kind: "contradiction", a: "", b: "" }])}>
          {draft.issues.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <select aria-label="Issue kind" value={row.kind} disabled={closed} onChange={(e) => edit("issues", i, { kind: e.target.value as Draft["issues"][number]["kind"] })} className={inputClass}>
                <option value="contradiction">Contradiction</option>
                <option value="duplicate">Duplicate</option>
              </select>
              {(["a", "b"] as const).map((side) => (
                <select key={side} aria-label={`Note ${side.toUpperCase()}`} value={row[side]} disabled={closed} onChange={(e) => edit("issues", i, { [side]: e.target.value })} className={inputClass}>
                  <option value="">Note…</option>
                  {noteIds.map((id) => (
                    <option key={id}>{id}</option>
                  ))}
                </select>
              ))}
              <RemoveButton closed={closed} onClick={() => remove("issues", i)} />
            </div>
          ))}
        </Section>
      )}

      {has("tests") && (
        <Section title="Test cases (traceability)" hint="Each test lists the story IDs it verifies." closed={closed} onAdd={() => set("tests", [...draft.tests, { id: nextId("T", draft.tests.map((x) => x.id)), title: "", covers: "" }])}>
          {draft.tests.map((t, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[70px_1fr_140px_auto]">
              <input aria-label="Test ID" value={t.id} disabled={closed} onChange={(e) => edit("tests", i, { id: e.target.value })} className={inputClass} />
              <input aria-label="Test title" value={t.title} disabled={closed} placeholder="What the test checks" onChange={(e) => edit("tests", i, { title: e.target.value })} className={inputClass} />
              <input aria-label="Stories covered" value={t.covers} disabled={closed} placeholder="S1, S2" onChange={(e) => edit("tests", i, { covers: e.target.value })} className={inputClass} />
              <RemoveButton closed={closed} onClick={() => remove("tests", i)} />
            </div>
          ))}
        </Section>
      )}

      {has("process") && (
        <Section title="Process map" hint='One row per step. "Next" lists the step IDs that follow; label decision branches like "pay:Yes, tell:No". Ends have no next.' closed={closed} onAdd={() => set("process", [...draft.process, { id: nextId("s", draft.process.map((x) => x.id)), type: draft.process.length ? "task" : "start", label: "", owner: "", next: "" }])}>
          {draft.process.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[80px_110px_1fr_150px_150px_auto]">
              <input aria-label="Step ID" value={p.id} disabled={closed} onChange={(e) => edit("process", i, { id: e.target.value })} className={inputClass} />
              <select aria-label="Step type" value={p.type} disabled={closed} onChange={(e) => edit("process", i, { type: e.target.value as Draft["process"][number]["type"] })} className={inputClass}>
                {["start", "task", "decision", "end"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input aria-label="Step label" value={p.label} disabled={closed} placeholder="What happens" onChange={(e) => edit("process", i, { label: e.target.value })} className={inputClass} />
              {ownerSelect(p.owner, (v) => edit("process", i, { owner: v }), "Step owner")}
              <input aria-label="Next steps" value={p.next} disabled={closed || p.type === "end"} placeholder="next step IDs" onChange={(e) => edit("process", i, { next: e.target.value })} className={inputClass} />
              <RemoveButton closed={closed} onClick={() => remove("process", i)} />
            </div>
          ))}
        </Section>
      )}

      {has("raci") && content.raciTasks && (
        <Section title="RACI matrix" hint="R = Responsible, A = Accountable, C = Consulted, I = Informed." closed={closed}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-lp-body text-[12px]">
              <thead>
                <tr>
                  <th className="border border-app-border px-2 py-1 text-left">Task</th>
                  {content.roles.map((r) => (
                    <th key={r} className="border border-app-border px-2 py-1">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.raciTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="border border-app-border px-2 py-1">{t.label}</td>
                    {content.roles.map((r) => (
                      <td key={r} className="border border-app-border p-1">
                        <select aria-label={`${t.label}: ${r}`} value={draft.raci[t.id]?.[r] ?? ""} disabled={closed} onChange={(e) => set("raci", { ...draft.raci, [t.id]: { ...draft.raci[t.id], [r]: e.target.value as Draft["raci"][string][string] } })} className={inputClass}>
                          {["", "R", "A", "C", "I"].map((l) => (
                            <option key={l} value={l}>{l || "–"}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {has("gaps") && (
        <Section title="Gap analysis" hint="One row per requirement the current process does not meet." closed={closed} onAdd={() => set("gaps", [...draft.gaps, { note: "", current: "", target: "", action: "", owner: "" }])}>
          {draft.gaps.map((g, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-app-border p-2 sm:grid-cols-[90px_1fr_auto]">
              <select aria-label="Note" value={g.note} disabled={closed} onChange={(e) => edit("gaps", i, { note: e.target.value })} className={inputClass}>
                <option value="">Note…</option>
                {noteIds.map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={labelClass}>Current state<input value={g.current} disabled={closed} onChange={(e) => edit("gaps", i, { current: e.target.value })} className={inputClass} /></label>
                <label className={labelClass}>Target state<input value={g.target} disabled={closed} onChange={(e) => edit("gaps", i, { target: e.target.value })} className={inputClass} /></label>
                <label className={labelClass}>Action<input value={g.action} disabled={closed} onChange={(e) => edit("gaps", i, { action: e.target.value })} className={inputClass} /></label>
                <label className={labelClass}>Owner{ownerSelect(g.owner, (v) => edit("gaps", i, { owner: v }), "Gap owner")}</label>
              </div>
              <RemoveButton closed={closed} onClick={() => remove("gaps", i)} />
            </div>
          ))}
        </Section>
      )}

      {!closed && (
        <button type="button" onClick={() => onSubmit(toSubmission(draft))} disabled={submitting} className="flex w-fit items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Submit document
        </button>
      )}
    </div>
  );
}
