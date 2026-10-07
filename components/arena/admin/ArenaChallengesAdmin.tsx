"use client";

import { useState } from "react";
import type { ChallengeListItem } from "@/lib/arena-content/store";

interface Report {
  ok: boolean;
  errors: string[];
  warnings: string[];
  evidenceStatus: string | null;
}

const STATUS_CLASS: Record<string, string> = { DRAFT: "bg-app-attention-container text-app-attention", PUBLISHED: "bg-app-success-container text-app-success", RETIRED: "bg-app-border/60 text-app-muted" };

export function ArenaChallengesAdmin({ initial }: { initial: ChallengeListItem[] }) {
  const [items, setItems] = useState(initial);
  const [spec, setSpec] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<{ title: string; report: Report } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/arena-admin/challenges");
    if (res.ok) setItems((await res.json()).challenges);
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
    const body = await call("save", "/api/arena-admin/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec: parsed }) });
    if (body) {
      setMessage(body.changed ? "Saved as a draft. Validate it before publishing." : "No changes.");
      await refresh();
    }
  }

  async function edit(item: ChallengeListItem) {
    const body = await call("edit", `/api/arena-admin/challenges/${item.id}`);
    if (body) setSpec(JSON.stringify(body.spec, null, 2));
  }

  async function validate(item: ChallengeListItem) {
    const body = await call(`v${item.id}`, `/api/arena-admin/challenges/${item.id}/validate`, { method: "POST" });
    if (body) setReport({ title: item.title, report: body });
    await refresh();
  }

  async function act(item: ChallengeListItem, action: "publish" | "retire" | "approve-legacy") {
    if (action === "publish" && !window.confirm(`Publish "${item.title}" to students?`)) return;
    if (await call(`${action}${item.id}`, `/api/arena-admin/challenges/${item.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })) await refresh();
  }

  const btn = "font-lp-body text-[12px] font-semibold text-app-blue hover:underline disabled:opacity-50";

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Spec editor">
        <h2 className="font-lp-body text-[14px] font-semibold text-app-charcoal">Create or edit a challenge (JSON spec)</h2>
        <textarea value={spec} onChange={(e) => setSpec(e.target.value)} rows={12} spellCheck={false} placeholder='{ "key": "stream-civil-example", "track": "stream", ... }' className="mt-2 w-full rounded-lg border border-app-border bg-white p-3 font-lp-mono text-[12px]" />
        <div className="mt-2 flex items-center gap-4">
          <button type="button" onClick={save} disabled={!spec.trim() || busy === "save"} className="rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">Save as draft</button>
          {message && <p role="status" className="font-lp-body text-[13px] text-app-charcoal">{message}</p>}
        </div>
      </section>

      {report && (
        <section aria-label="Validation report" className={`rounded-lg border p-4 ${report.report.ok ? "border-app-success/40 bg-app-success-container" : "border-app-rose/40 bg-app-rose-container"}`}>
          <h2 className="font-lp-body text-[14px] font-semibold text-app-charcoal">{report.report.ok ? "Valid" : "Not valid"} — {report.title}</h2>
          {report.report.ok && <p className="font-lp-body text-[12.5px]">A pass is {report.report.evidenceStatus}.</p>}
          <ul className="mt-2 list-disc pl-5 font-lp-body text-[12.5px]">
            {report.report.errors.map((e) => <li key={e} className="text-app-rose">{e}</li>)}
            {report.report.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
      )}

      <section aria-label="Challenges" className="overflow-x-auto rounded-xl border border-app-border bg-white">
        <table className="w-full border-collapse font-lp-body text-[13px]">
          <thead>
            <tr className="border-b border-app-border text-left text-app-muted">
              <th className="px-3 py-2">Challenge</th><th className="px-3 py-2">Track</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-app-border last:border-0">
                <td className="px-3 py-2"><p className="font-semibold text-app-charcoal">{c.title}</p><p className="text-[11.5px] text-app-muted">{c.specKey ?? "AI-generated, no spec"} · {c.difficulty} · {c.source}{c.isSeed ? " · seed" : ""}{c.grandfathered ? " · legacy live" : ""}</p></td>
                <td className="px-3 py-2">{c.track}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${STATUS_CLASS[c.status]}`}>{c.status}</span>{c.hasSpec && c.status === "DRAFT" && <span className="ml-2 text-[11.5px] text-app-muted">{c.validated ? "validated" : "needs validation"}</span>}</td>
                <td className="flex flex-wrap gap-3 px-3 py-2">
                  {c.hasSpec && <button type="button" className={btn} onClick={() => edit(c)}>Edit</button>}
                  {c.hasSpec && c.status !== "RETIRED" && <button type="button" className={btn} onClick={() => validate(c)} disabled={busy === `v${c.id}`}>Validate</button>}
                  {c.status === "DRAFT" && c.hasSpec && c.validated && <button type="button" className={btn} onClick={() => act(c, "publish")}>Publish</button>}
                  {c.status === "DRAFT" && !c.hasSpec && <button type="button" className={btn} onClick={() => act(c, "approve-legacy")}>Approve (reviewed)</button>}
                  {c.status !== "RETIRED" && <button type="button" className="font-lp-body text-[12px] font-semibold text-app-rose hover:underline" onClick={() => act(c, "retire")}>Retire</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
