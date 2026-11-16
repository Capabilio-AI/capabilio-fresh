"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { DOC_KINDS, DOC_KIND_LABEL, MAX_BYTES, SHARES, SHARE_LABEL, type DocKind, type Share } from "@/lib/professional/documents";
import type { DocRow } from "@/lib/professional/workspace-server";

const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] focus:border-[var(--m-ink)] focus:outline-none";
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function send(url: string, init: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, init);
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}

/** The vault: resume, certifications, letters and other documents, private until you share them. Files are checked and stored on the server. */
export function Vault({ docs }: { docs: DocRow[] }) {
  const id = useId();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocKind>("certificate");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return setMsg("That file is over 10 MB.");
    setBusy(true);
    setMsg(null);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    const err = await send("/api/professional/documents", { method: "POST", body: form });
    setBusy(false);
    if (input.current) input.current.value = "";
    if (err) return setMsg(err);
    setMsg(`${file.name} is in your vault. Only you can see it.`);
    router.refresh();
  };
  const share = async (docId: string, value: Share) => {
    const err = await send(`/api/professional/documents/${docId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ share: value }) });
    if (err) setMsg(err);
    router.refresh();
  };
  const remove = async (docId: string) => {
    const err = await send(`/api/professional/documents/${docId}`, { method: "DELETE" });
    if (err) setMsg(err);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7" aria-labelledby={`${id}-add`}>
        <h2 id={`${id}-add`} className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Add a document</h2>
        <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">PDF, PNG, JPG, DOC or DOCX, up to 10 MB. Everything is private until you choose to share it. A new resume replaces the old one.</p>
        <div className="mt-4 grid items-end gap-3 sm:grid-cols-[240px_auto]">
          <div><label htmlFor={`${id}-k`} className="mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]">What is it?</label><select id={`${id}-k`} className={FIELD} value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>{DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>)}</select></div>
          <div>
            <input ref={input} id={`${id}-f`} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} className="sr-only" />
            <label htmlFor={`${id}-f`} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] focus-within:outline-2">{busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}{busy ? "Uploading" : "Choose a file"}</label>
          </div>
        </div>
        <p role="status" className="mt-3 min-h-[1.25rem] text-[13.5px] text-[var(--m-muted)]">{msg}</p>
      </section>

      {DOC_KINDS.map((k) => {
        const list = docs.filter((d) => d.kind === k);
        if (!list.length && k !== "resume") return null;
        return (
          <section key={k} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7" aria-labelledby={`${id}-${k}`}>
            <h2 id={`${id}-${k}`} className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">{DOC_KIND_LABEL[k]}</h2>
            {list.length === 0 ? <p className="mt-2 text-[14px] text-[var(--m-muted)]">No resume yet. Add one above and it becomes your current resume.</p> : (
              <ul className="mt-3 divide-y divide-[var(--m-rule)]">
                {list.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0">
                    <FileText size={20} aria-hidden className="shrink-0 text-[var(--m-muted)]" />
                    <div className="min-w-0 flex-1 basis-56">
                      <a href={`/api/professional/documents/${d.id}`} className="block truncate text-[15px] font-bold text-[var(--m-ink)] hover:underline">{d.title}</a>
                      <p className="text-[13px] tabular-nums text-[var(--m-muted)]">{d.fileName} · {kb(d.sizeBytes)} · added {DAY.format(new Date(d.createdAt))}</p>
                    </div>
                    <label className="sr-only" htmlFor={`${id}-s-${d.id}`}>Who can see {d.title}</label>
                    <select id={`${id}-s-${d.id}`} className={`${FIELD} !w-auto`} value={d.share} onChange={(e) => share(d.id, e.target.value as Share)}>{SHARES.map((s) => <option key={s} value={s}>{SHARE_LABEL[s]}</option>)}</select>
                    <button type="button" onClick={() => remove(d.id)} aria-label={`Remove ${d.title}`} className="grid size-9 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)] focus-visible:outline-2 focus-visible:outline-[var(--m-accent)]"><Trash2 size={17} aria-hidden /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
