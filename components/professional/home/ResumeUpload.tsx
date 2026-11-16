"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

const MAX_BYTES = 4 * 1024 * 1024;

/** Upload a resume PDF from the professional home. The server reads it and fills the profile; the file itself is not kept. */
export function ResumeUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return setMessage("Choose your resume as a PDF.");
    if (file.size > MAX_BYTES) return setMessage("Keep the resume under 4 MB.");
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("resume", file);
      const res = await fetch("/api/professional/resume", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { error?: string; stored?: boolean };
      if (!res.ok) throw new Error(json.error ?? "We could not read that resume. Try again.");
      setMessage(json.stored === false ? "Your profile is filled in from the resume. We could not save a copy to your Vault, so add it there yourself." : "Done. Your timeline, skills, certifications, education and projects are filled in, and the resume is in your Vault.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "We could not read that resume. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <input ref={input} id="pro-resume" type="file" accept="application/pdf" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} className="sr-only" />
      <label htmlFor="pro-resume" className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white focus-within:outline-2 hover:bg-[var(--m-accent-ink)]">
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} aria-hidden />}{busy ? "Reading your resume" : "Upload resume (PDF)"}
      </label>
      <p role="status" className="mt-2 text-[13px] text-[var(--m-muted)]">{message ?? "PDF with selectable text, up to 4 MB. We read it to fill in your profile and keep a copy in your Vault."}</p>
    </div>
  );
}
