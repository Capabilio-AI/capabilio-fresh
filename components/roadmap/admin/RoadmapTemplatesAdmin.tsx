"use client";

import { useState } from "react";
import type { TemplateListItem } from "@/lib/roadmap-visual/template-store";

const STATUS_CLASS: Record<string, string> = { DRAFT: "bg-app-attention-container text-app-attention", REVIEWED: "bg-app-blue-container text-app-blue", PUBLISHED: "bg-app-success-container text-app-success", RETIRED: "bg-app-border/60 text-app-muted" };

export function RoadmapTemplatesAdmin({ initial }: { initial: TemplateListItem[] }) {
  const [items, setItems] = useState(initial);
  const [spec, setSpec] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/roadmap-admin/templates");
    if (res.ok) setItems((await res.json()).templates);
  }
  async function call(label: string, url: string, init?: RequestInit) {
    setBusy(label);
    setMessage(null);
    const res = await fetch(url, init).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) setMessage(body.error ?? "Request failed.");
    return res?.ok ? body : null;
  }
  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(spec);
    } catch {
      return setMessage("That is not valid JSON.");
    }
    const body = await call("save", "/api/roadmap-admin/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec: parsed }) });
    if (body) {
      setMessage(body.changed ? "Saved as a draft. It has to be reviewed before it can be published." : "No changes.");
      await refresh();
    }
  }
  async function edit(id: string) {
    const body = await call("edit", `/api/roadmap-admin/templates/${id}/export`);
    if (body) setSpec(JSON.stringify(body.spec, null, 2));
  }
  async function act(t: TemplateListItem, action: "review" | "publish" | "retire") {
    if (action === "publish" && !window.confirm(`Publish "${t.title}" (version ${t.version}) to students? The current published version, if any, is retired.`)) return;
    if (await call(`${action}${t.id}`, `/api/roadmap-admin/templates/${t.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })) await refresh();
  }
  const btn = "font-lp-body text-[12px] font-semibold text-app-blue hover:underline disabled:opacity-50";

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Template editor">
        <h2 className="font-lp-body text-[14px] font-semibold text-app-charcoal">Create or edit a tree (JSON)</h2>
        <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={12} spellCheck={false} placeholder='{ "career": "data-analyst", "version": 1, "nodes": [ ... ] }' className="mt-2 w-full rounded-lg border border-app-border bg-white p-3 font-lp-mono text-[12px]" />
        <div className="mt-2 flex items-center gap-4">
          <button type="button" onClick={save} disabled={!spec.trim() || busy === "save"} className="rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">Validate and save as draft</button>
          {message && <p role="status" className="font-lp-body text-[13px] text-app-charcoal">{message}</p>}
        </div>
      </section>
      <section aria-label="Templates" className="overflow-x-auto rounded-xl border border-app-border bg-white">
        <table className="w-full border-collapse font-lp-body text-[13px]">
          <thead><tr className="border-b border-app-border text-left text-app-muted"><th className="px-3 py-2">Tree</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-app-muted">No templates yet.</td></tr>}
            {items.map((t) => (
              <tr key={t.id} className="border-b border-app-border last:border-0">
                <td className="px-3 py-2"><p className="font-semibold text-app-charcoal">{t.title}</p><p className="text-[11.5px] text-app-muted">{t.career} · version {t.version} · {t.topics} topics</p></td>
                <td className="px-3 py-2"><span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${STATUS_CLASS[t.status]}`}>{t.status}</span></td>
                <td className="flex flex-wrap gap-3 px-3 py-2">
                  <button type="button" className={btn} onClick={() => edit(t.id)}>Edit</button>
                  {t.status === "DRAFT" && <button type="button" className={btn} onClick={() => act(t, "review")}>Mark reviewed</button>}
                  {t.status === "REVIEWED" && <button type="button" className={btn} onClick={() => act(t, "publish")}>Publish</button>}
                  {t.status !== "RETIRED" && <button type="button" className="font-lp-body text-[12px] font-semibold text-app-rose hover:underline" onClick={() => act(t, "retire")}>Retire</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
