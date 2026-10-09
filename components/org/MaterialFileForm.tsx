"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const FIELD = "w-full rounded-lg border border-app-border bg-white px-3 py-2 text-[13.5px]";
const MAX_MB = 10;

/** Staff upload a PDF, Word, Excel, PowerPoint file or an image for a subject (or a branch and year). Students open it in SkillStudio. */
export function MaterialFileForm({ subjects, scoped }: { subjects: { value: string; label: string }[]; scoped: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = new FormData(form).get("file");
    if (!(file instanceof File) || file.size === 0) return setMessage({ ok: false, text: "Choose a file to upload." });
    if (file.size > MAX_MB * 1024 * 1024) return setMessage({ ok: false, text: `Files must be under ${MAX_MB} MB.` });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/org/materials/upload", { method: "POST", body: new FormData(form) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setMessage({ ok: false, text: body.error ?? "Could not upload the file." });
      form.reset();
      setMessage({ ok: true, text: "Published. Students see it in SkillStudio." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Network problem. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
      <label className="sm:col-span-2 text-[12.5px] font-bold text-app-charcoal">File (PDF, Word, Excel, PowerPoint or image, up to {MAX_MB} MB)
        <input name="file" type="file" required accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp" className={`${FIELD} mt-1`} />
      </label>
      <label className="sm:col-span-2 text-[12.5px] font-bold text-app-charcoal">Title
        <input name="title" required maxLength={200} className={`${FIELD} mt-1`} />
      </label>
      <label className="sm:col-span-2 text-[12.5px] font-bold text-app-charcoal">Short description (optional)
        <input name="description" maxLength={2000} className={`${FIELD} mt-1`} />
      </label>
      <label className="text-[12.5px] font-bold text-app-charcoal">Subject
        <select name="subjectId" className={`${FIELD} mt-1`} defaultValue=""><option value="">Choose a subject, or enter a year below</option>{subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        {!scoped && <label className="text-[12.5px] font-bold text-app-charcoal">Branch (if no subject)<input name="branch" maxLength={200} className={`${FIELD} mt-1`} /></label>}
        <label className="text-[12.5px] font-bold text-app-charcoal">Year (if no subject)<input name="year" type="number" min={1} max={6} className={`${FIELD} mt-1`} /></label>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={busy} className="o-btn disabled:opacity-60">{busy ? "Uploading…" : "Upload and publish"}</button>
        {message && <p role="status" className={`text-[13px] ${message.ok ? "text-[#0d6b3a]" : "text-[#9b1c1c]"}`}>{message.text}</p>}
      </div>
    </form>
  );
}
