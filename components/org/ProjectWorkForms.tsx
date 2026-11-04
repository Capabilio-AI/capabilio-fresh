"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";
import { MAX_FILES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, type ProjectFile } from "@/lib/org/project-files";

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const LABEL = "block font-lp-body text-[13px] font-semibold text-[var(--m-ink)]";
const HELP = "mt-1 font-lp-body text-[12px] text-app-muted";
const FIELD = "mt-2 w-full rounded-xl border border-[var(--m-rule)]! bg-white px-4 py-3 font-lp-body text-[14px] leading-relaxed text-[var(--m-ink)] outline-none transition-colors placeholder:text-app-muted/70 focus:border-[var(--m-ink)]! focus:ring-2 focus:ring-[var(--m-ink)]/10";

async function apiError(res: Response, fallback: string): Promise<string> {
  return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? fallback;
}

/** Pick images or PDFs; each uploads straight away and shows as a removable chip. The parent holds the list that gets submitted. */
function FileAttach({ groupId, files, onChange }: { groupId: string; files: ProjectFile[]; onChange: (next: ProjectFile[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    let current = files;
    for (const file of Array.from(list)) {
      if (current.length >= MAX_FILES) { setError(`You can attach up to ${MAX_FILES} files.`); break; }
      if (file.size > MAX_UPLOAD_BYTES) { setError(`${file.name} is over ${MAX_UPLOAD_MB} MB.`); continue; }
      setBusy((n) => n + 1);
      try {
        const form = new FormData();
        form.set("groupId", groupId);
        form.set("file", file);
        const res = await fetch("/api/classroom/project-files", { method: "POST", body: form });
        if (!res.ok) throw new Error(await apiError(res, "Upload failed."));
        const { file: saved } = (await res.json()) as { file: ProjectFile };
        if (file.type.startsWith("image/")) setPreviews((p) => ({ ...p, [saved.path]: URL.createObjectURL(file) }));
        current = [...current, saved];
        onChange(current);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <span className={LABEL}>Images and documents <span className="font-normal text-app-muted">(optional)</span></span>
      <button type="button" onClick={() => input.current?.click()} disabled={busy > 0 || files.length >= MAX_FILES} className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-[var(--m-rule)]! px-4 py-5 font-lp-body text-[13px] font-semibold text-[var(--m-ink)] transition-colors hover:border-[var(--m-ink)]! hover:bg-app-background disabled:opacity-60">
        {busy > 0 ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <ImagePlus size={17} aria-hidden />}
        {busy > 0 ? "Uploading…" : "Add images or a PDF"}
      </button>
      <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files)} aria-label="Choose images or PDF files" />
      <p className={HELP}>PNG, JPG, WebP or PDF. Up to {MAX_FILES} files, {MAX_UPLOAD_MB} MB each. Your faculty can open them.</p>
      {error && <p role="alert" className="mt-1.5 font-lp-body text-[12.5px] font-medium text-app-rose">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {files.map((f) => (
            <li key={f.path} className="relative w-28">
              {previews[f.path] ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={previews[f.path]} alt={f.name} className="h-20 w-28 rounded-lg border border-[var(--m-rule)]! object-cover" />
              ) : (
                <span className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--m-rule)]! bg-app-background px-2">
                  <FileText size={20} aria-hidden className="text-app-muted" />
                  <span className="line-clamp-2 break-all text-center font-lp-body text-[11px] text-[var(--m-ink)]">{f.name}</span>
                </span>
              )}
              <button type="button" onClick={() => onChange(files.filter((x) => x.path !== f.path))} aria-label={`Remove ${f.name}`} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--m-ink)] text-[var(--m-paper,#fff)] shadow">
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useSubmit(action: string, done: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function send(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await apiError(res, "That didn't work. Please try again."));
      setMessage({ ok: true, text: success });
      done();
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "That didn't work." });
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, send };
}

const Status = ({ message }: { message: { ok: boolean; text: string } | null }) =>
  message ? <p role={message.ok ? "status" : "alert"} className={`font-lp-body text-[13px] font-medium ${message.ok ? "text-app-success" : "text-app-rose"}`}>{message.text}</p> : null;

const SAVE = "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--m-ink)] px-6 py-3 font-lp-body text-[14px] font-semibold text-[var(--m-paper,#fff)] transition-opacity hover:opacity-90 disabled:opacity-60";

/** The weekly progress note: a roomy text box, an optional link, and images or PDFs. */
export function ReportForm({ groupId, nextWeek }: { groupId: string; nextWeek: number }) {
  const [week, setWeek] = useState(String(nextWeek));
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const { busy, message, send } = useSubmit("/api/classroom/reports", () => { setContent(""); setLink(""); setFiles([]); setWeek(String(Number(week) + 1)); });

  function submit(e: FormEvent) {
    e.preventDefault();
    void send({ groupId, weekNumber: Number(week), content, attachmentUrl: link.trim() || undefined, attachments: files }, `Week ${week} saved.`);
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div>
        <label htmlFor="rep-week" className={LABEL}>Week</label>
        <input id="rep-week" type="number" min={1} max={52} required value={week} onChange={(e) => setWeek(e.target.value)} className={`${FIELD} !w-28`} />
        <p className={HELP}>Saving a week that already exists replaces its text.</p>
      </div>
      <div>
        <label htmlFor="rep-body" className={LABEL}>What did the group do this week? <span className="text-app-rose">*</span></label>
        <textarea id="rep-body" required rows={9} maxLength={5000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What you built or decided, who did what, what is blocking you, and what comes next." className={`${FIELD} min-h-[220px] resize-y`} />
        <p className={`${HELP} text-right tabular-nums`}>{content.length.toLocaleString("en-IN")} / 5,000</p>
      </div>
      <FileAttach groupId={groupId} files={files} onChange={setFiles} />
      <div>
        <label htmlFor="rep-link" className={LABEL}>Link <span className="font-normal text-app-muted">(optional)</span></label>
        <input id="rep-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={FIELD} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy || !content.trim()} className={SAVE}>{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}{busy ? "Saving…" : "Save report"}</button>
        <Status message={message} />
      </div>
    </form>
  );
}

/** The final submission: a link, images or PDFs, or all of them. Resubmitting replaces the earlier submission until it is graded. */
export function SubmissionForm({ groupId, resubmit, initialLink, initialFiles }: { groupId: string; resubmit: boolean; initialLink?: string; initialFiles?: ProjectFile[] }) {
  const [link, setLink] = useState(initialLink ?? "");
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles ?? []);
  const { busy, message, send } = useSubmit("/api/classroom/submissions", () => undefined);
  const ready = link.trim().length > 0 || files.length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    void send({ groupId, linkUrl: link.trim() || undefined, attachments: files }, resubmit ? "Resubmitted." : "Submitted. Your faculty has been told.");
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div>
        <label htmlFor="sub-link" className={LABEL}>Project link</label>
        <input id="sub-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://github.com/… or a shared drive link" className={FIELD} />
        <p className={HELP}>The repository, demo or document folder. Make sure your faculty can open it.</p>
      </div>
      <FileAttach groupId={groupId} files={files} onChange={setFiles} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy || !ready} className={SAVE}>{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}{busy ? "Submitting…" : resubmit ? "Resubmit" : "Submit project"}</button>
        {!ready && <span className={HELP}>Add a link or at least one file.</span>}
        <Status message={message} />
      </div>
    </form>
  );
}
