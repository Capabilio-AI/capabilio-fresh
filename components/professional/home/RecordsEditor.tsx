"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { validateCert, validateEdu, validateLink, validateProject } from "@/lib/professional/records";
import type { Kind } from "@/lib/professional/records-server";

export interface Item { id: string; primary: string; secondary: string; fromResume: boolean }
interface Field { name: string; label: string; placeholder?: string; type?: "text" | "number" | "textarea"; wide?: boolean }

const CONFIG: Record<Kind, { noun: string; fields: Field[]; check: (v: unknown) => { ok: boolean; error?: string } }> = {
  certification: { noun: "certification", check: validateCert, fields: [{ name: "name", label: "Certification", placeholder: "e.g. AWS Solutions Architect Associate", wide: true }, { name: "issuer", label: "Issued by" }, { name: "year", label: "Year", type: "number" }] },
  education: { noun: "education entry", check: validateEdu, fields: [{ name: "institution", label: "Institution", wide: true }, { name: "degree", label: "Degree" }, { name: "fieldOfStudy", label: "Field of study" }, { name: "startYear", label: "From", type: "number" }, { name: "endYear", label: "To", type: "number" }] },
  project: { noun: "project", check: validateProject, fields: [{ name: "name", label: "Project", wide: true }, { name: "description", label: "What it is and what you did", type: "textarea", wide: true }, { name: "url", label: "Link (optional)", placeholder: "https://" }, { name: "skills", label: "Skills used", placeholder: "Go, PostgreSQL, Kafka" }] },
  link: { noun: "link", check: validateLink, fields: [{ name: "label", label: "Label", placeholder: "e.g. GitHub" }, { name: "url", label: "Address", placeholder: "https://" }] },
};
const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}

/** A list the professional can add to and remove from. Entries read from a resume say so and are replaced if a newer resume is uploaded. */
export function RecordsEditor({ kind, items, ready }: { kind: Kind; items: Item[]; ready: boolean }) {
  const id = useId();
  const router = useRouter();
  const cfg = CONFIG[kind];
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = cfg.check(v);
    if (!check.ok) return setMsg(check.error ?? "Check the details.");
    setBusy(true);
    const err = await send(`/api/professional/records/${kind}`, "POST", v);
    setBusy(false);
    if (err) return setMsg(err);
    setV({});
    setMsg(null);
    router.refresh();
  };
  const remove = async (itemId: string) => {
    const err = await send(`/api/professional/records/${kind}/${itemId}`, "DELETE");
    if (err) setMsg(err);
    router.refresh();
  };

  return (
    <div>
      {items.length === 0 ? <p className="text-[14px] text-[var(--m-muted)]">None yet. Upload your resume on the Overview page and this fills in, or add one below.</p> : (
        <ul className="divide-y divide-[var(--m-rule)]">
          {items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0"><p className="text-[15px] font-bold text-[var(--m-ink)]">{it.primary}</p>{it.secondary && <p className="text-[13.5px] text-[var(--m-muted)]">{it.secondary}</p>}{it.fromResume && <p className="mt-0.5 text-[12px] text-[var(--m-muted)]">From your resume</p>}</div>
              {ready && <button type="button" onClick={() => remove(it.id)} aria-label={`Remove ${it.primary}`} className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)] focus-visible:outline-2 focus-visible:outline-[var(--m-accent)]"><Trash2 size={16} aria-hidden /></button>}
            </li>
          ))}
        </ul>
      )}
      {ready ? (
        <form onSubmit={add} className="mt-5 grid gap-4 border-t border-[var(--m-rule)] pt-5">
          <p className="text-[14px] font-bold text-[var(--m-ink)]">Add a {cfg.noun}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {cfg.fields.map((f) => (
              <div key={f.name} className={f.wide ? "sm:col-span-2" : undefined}>
                <label htmlFor={`${id}-${f.name}`} className={LABEL}>{f.label}</label>
                {f.type === "textarea" ? <textarea id={`${id}-${f.name}`} rows={3} className={`${FIELD} resize-y`} value={v[f.name] ?? ""} maxLength={600} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} /> : <input id={`${id}-${f.name}`} type={f.type === "number" ? "number" : "text"} inputMode={f.type === "number" ? "numeric" : undefined} min={f.type === "number" ? 1950 : undefined} max={f.type === "number" ? 2100 : undefined} className={FIELD} value={v[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Add</button>
            <p role="status" className="text-[13.5px] text-[var(--m-muted)]">{msg}</p>
          </div>
        </form>
      ) : <p className="mt-4 text-[13px] text-[var(--m-muted)]">Editing opens as soon as your record tables are set up. What your resume said is shown above.</p>}
    </div>
  );
}
