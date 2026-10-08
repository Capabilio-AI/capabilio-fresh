"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Award, BookmarkPlus, Briefcase, FileText, HelpCircle, ImagePlus, Loader2, Send, X } from "lucide-react";
import clsx from "clsx";
import { Avatar, type AvatarPerson } from "./Avatar";
import { EMPTY_DRAFT, FIELD, Labelled, TagInput, draftBody, draftReady, type Draft, type Kind } from "./composer-fields";

const MAX_DOC = 10 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;

/** Projects are no longer a post kind in the composer; Pulse is for updates, opportunities, useful resources, questions and wins. */
type ComposerKind = Exclude<Kind, "project">;
const KINDS: Record<ComposerKind, { label: string; icon: typeof Send; heading: string; submit: string; chip: string; docHint: string }> = {
  post: { label: "Update", icon: Send, heading: "Share an update", submit: "Post", chip: "border-app-charcoal bg-app-charcoal text-white", docHint: "Attach a PDF" },
  opportunity: { label: "Opportunity", icon: Briefcase, heading: "Share a job, internship or referral", submit: "Share opportunity", chip: "border-app-blue bg-app-blue-container text-app-blue", docHint: "Attach the job description (PDF)" },
  resource: { label: "Resource", icon: BookmarkPlus, heading: "Share something useful you found", submit: "Share resource", chip: "border-app-success bg-app-success-container text-app-success", docHint: "Attach notes or a guide (PDF)" },
  question: { label: "Question", icon: HelpCircle, heading: "Ask the network", submit: "Ask question", chip: "border-app-warning bg-app-warning-container text-app-warning", docHint: "Attach a PDF for context" },
  achievement: { label: "Achievement", icon: Award, heading: "Share an achievement", submit: "Share achievement", chip: "border-app-success bg-app-success-container text-app-success", docHint: "Attach the certificate (PDF)" },
};

interface Picked {
  file: File;
  preview?: string;
}

/**
 * Create a post. Each kind has its own form, because an opportunity, a resource, a question and an achievement say different things:
 * an opportunity has a role, company and apply link, a resource a link and topics, a question a title and topics, an achievement an issuer, a date and proof.
 * Every kind can carry one photo and one PDF.
 */
export function Composer({ me, onPosted, endpoint = "/api/pulse/posts", placeholder }: { me: AvatarPerson; onPosted: () => void; endpoint?: string; placeholder?: string }) {
  const [kind, setKind] = useState<ComposerKind>("post");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [image, setImage] = useState<Picked | null>(null);
  const [doc, setDoc] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const k = KINDS[kind];
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function pickImage(file: File | null) {
    if (image?.preview) URL.revokeObjectURL(image.preview);
    if (file && file.size > MAX_IMAGE) return setError("Photos must be under 5 MB.");
    setError(null);
    setImage(file ? { file, preview: URL.createObjectURL(file) } : null);
  }
  function pickDoc(file: File | null) {
    if (file && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return setError("Attach a PDF document.");
    if (file && file.size > MAX_DOC) return setError("Documents must be under 10 MB.");
    setError(null);
    setDoc(file ? { file } : null);
  }

  async function upload(file: File, purpose: "post" | "doc") {
    const form = new FormData();
    form.set("file", file);
    form.set("purpose", purpose);
    const res = await fetch("/api/pulse/media", { method: "POST", body: form });
    const json = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
    if (!res.ok || !json?.path) throw new Error(json?.error ?? "Couldn't upload the file.");
    return json.path;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const imagePath = image ? await upload(image.file, "post") : undefined;
      const attachment = doc ? { path: await upload(doc.file, "doc"), name: doc.file.name.slice(0, 200), size: doc.file.size } : undefined;
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draftBody(kind, draft), imagePath, attachment }) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(json?.error ?? "Couldn't post.");
      setDraft(EMPTY_DRAFT);
      pickImage(null);
      setDoc(null);
      setKind("post");
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Create a post" className="rounded-3xl border border-[var(--m-rule)] bg-white p-4 sm:p-5">
      <div className="flex gap-3">
        <Avatar person={me} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="What are you sharing?">
            {(Object.keys(KINDS) as ComposerKind[]).map((key) => {
              const Icon = KINDS[key].icon;
              return (
                <button key={key} type="button" onClick={() => setKind(key)} aria-pressed={kind === key} className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-lp-body text-[12px] font-semibold transition-colors", kind === key ? KINDS[key].chip : "border-[var(--m-rule)] text-app-muted hover:text-[var(--m-ink)]")}>
                  <Icon size={12} aria-hidden="true" /> {KINDS[key].label}
                </button>
              );
            })}
          </div>
          <h2 className="mt-3 font-lp-display text-[15px] font-bold text-[var(--m-ink)]">{k.heading}</h2>

          <div className="mt-3 flex flex-col gap-3">
            {kind === "post" && (
              <textarea value={draft.content} onChange={(e) => set("content", e.target.value.slice(0, 3000))} placeholder={placeholder ?? "What's on your mind? Use #tags so people can find it."} aria-label="Post text" rows={3} className={clsx(FIELD, "resize-none")} />
            )}

            {kind === "opportunity" && (
              <>
                <Labelled id="op-title" label="Role or opportunity"><input id="op-title" value={draft.title} onChange={(e) => set("title", e.target.value.slice(0, 120))} placeholder="e.g. Frontend intern, 3 months" className={FIELD} /></Labelled>
                <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1"><legend className="sr-only">Type</legend>
                  {([["job", "Job"], ["internship", "Internship"], ["referral", "Referral"], ["freelance", "Freelance"]] as const).map(([v, label]) => <label key={v} className="flex items-center gap-1.5 font-lp-body text-[13px] text-[var(--m-ink)]"><input type="radio" name="op-type" checked={draft.opportunityType === v} onChange={() => set("opportunityType", v)} /> {label}</label>)}
                </fieldset>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Labelled id="op-company" label="Company"><input id="op-company" value={draft.company} onChange={(e) => set("company", e.target.value.slice(0, 100))} placeholder="Acme Technologies" className={FIELD} /></Labelled>
                  <Labelled id="op-loc" label="Location"><input id="op-loc" value={draft.location} onChange={(e) => set("location", e.target.value.slice(0, 100))} placeholder="Remote, Bengaluru…" className={FIELD} /></Labelled>
                </div>
                <Labelled id="op-desc" label="Details" hint="who it suits, how to reach you"><textarea id="op-desc" value={draft.content} onChange={(e) => set("content", e.target.value.slice(0, 3000))} rows={3} className={clsx(FIELD, "resize-none")} /></Labelled>
                <Labelled id="op-skills" label="Skills" hint="up to 6, press Enter after each"><TagInput id="op-skills" value={draft.skills} onChange={(v) => set("skills", v)} max={6} placeholder="react, sql, communication…" /></Labelled>
                <Labelled id="op-apply" label="Apply link" hint="optional"><input id="op-apply" type="url" value={draft.applyUrl} onChange={(e) => set("applyUrl", e.target.value)} placeholder="https://" className={FIELD} /></Labelled>
              </>
            )}

            {kind === "resource" && (
              <>
                <Labelled id="rs-title" label="What is it?"><input id="rs-title" value={draft.title} onChange={(e) => set("title", e.target.value.slice(0, 120))} placeholder="e.g. A clear guide to SQL joins" className={FIELD} /></Labelled>
                <Labelled id="rs-url" label="Link"><input id="rs-url" type="url" value={draft.resourceUrl} onChange={(e) => set("resourceUrl", e.target.value)} placeholder="https://" className={FIELD} /></Labelled>
                <Labelled id="rs-note" label="Why is it worth reading?" hint="optional"><textarea id="rs-note" value={draft.content} onChange={(e) => set("content", e.target.value.slice(0, 1000))} rows={2} className={clsx(FIELD, "resize-none")} /></Labelled>
                <Labelled id="rs-tags" label="Topics" hint="up to 5"><TagInput id="rs-tags" value={draft.tags} onChange={(v) => set("tags", v)} max={5} placeholder="sql, databases…" /></Labelled>
              </>
            )}

            {kind === "question" && (
              <>
                <Labelled id="q-title" label="Your question" hint="be specific"><input id="q-title" value={draft.title} onChange={(e) => set("title", e.target.value.slice(0, 150))} placeholder="e.g. How do I speed up a slow join in PostgreSQL?" className={FIELD} /></Labelled>
                <Labelled id="q-body" label="Details" hint="what you tried, what happened"><textarea id="q-body" value={draft.content} onChange={(e) => set("content", e.target.value.slice(0, 3000))} rows={3} className={clsx(FIELD, "resize-none")} /></Labelled>
                <Labelled id="q-tags" label="Topics" hint="up to 5"><TagInput id="q-tags" value={draft.tags} onChange={(v) => set("tags", v)} max={5} placeholder="sql, postgres, indexing…" /></Labelled>
              </>
            )}

            {kind === "achievement" && (
              <>
                <Labelled id="a-title" label="What did you achieve?"><input id="a-title" value={draft.title} onChange={(e) => set("title", e.target.value.slice(0, 120))} placeholder="e.g. AWS Certified Cloud Practitioner" className={FIELD} /></Labelled>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Labelled id="a-issuer" label="Issued by"><input id="a-issuer" value={draft.issuer} onChange={(e) => set("issuer", e.target.value.slice(0, 100))} placeholder="Amazon Web Services" className={FIELD} /></Labelled>
                  <Labelled id="a-date" label="Date"><input id="a-date" type="date" value={draft.achievedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("achievedOn", e.target.value)} className={FIELD} /></Labelled>
                </div>
                <Labelled id="a-proof" label="Proof link" hint="credential or result page"><input id="a-proof" type="url" value={draft.proofUrl} onChange={(e) => set("proofUrl", e.target.value)} placeholder="https://" className={FIELD} /></Labelled>
                <Labelled id="a-note" label="Anything to add?" hint="optional"><textarea id="a-note" value={draft.content} onChange={(e) => set("content", e.target.value.slice(0, 1000))} rows={2} className={clsx(FIELD, "resize-none")} /></Labelled>
                <p className="font-lp-body text-[12px] text-app-muted">Want it counted as evidence? <Link href="/dashboard/vault" className="text-app-blue hover:underline">Add it to your Vault</Link> too.</p>
              </>
            )}
          </div>

          {(image || doc) && (
            <div className="mt-3 flex flex-wrap items-start gap-3">
              {image?.preview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={image.preview} alt="Attached photo" className="max-h-32 rounded-xl border border-[var(--m-rule)]" />
                  <button type="button" onClick={() => pickImage(null)} aria-label="Remove photo" className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white"><X size={12} /></button>
                </div>
              )}
              {doc && (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--m-rule)] bg-app-background px-3 py-2">
                  <FileText size={16} className="text-app-rose" aria-hidden="true" />
                  <span className="max-w-[14rem] truncate font-lp-body text-[12.5px] text-[var(--m-ink)]">{doc.file.name}</span>
                  <button type="button" onClick={() => setDoc(null)} aria-label="Remove document" className="text-app-muted hover:text-[var(--m-ink)]"><X size={13} /></button>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--m-rule)] pt-3">
            <button type="button" onClick={() => imageInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-[var(--m-rule)] px-3 py-1.5 font-lp-body text-[12px] font-medium text-app-muted hover:text-[var(--m-ink)]"><ImagePlus size={13} aria-hidden="true" /> Photo</button>
            <button type="button" onClick={() => docInput.current?.click()} className="flex items-center gap-1.5 rounded-full border border-[var(--m-rule)] px-3 py-1.5 font-lp-body text-[12px] font-medium text-app-muted hover:text-[var(--m-ink)]"><FileText size={13} aria-hidden="true" /> {k.docHint}</button>
            <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Photo" onChange={(e) => { pickImage(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <input ref={docInput} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="PDF document" onChange={(e) => { pickDoc(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <button type="button" onClick={submit} disabled={busy || !draftReady(kind, draft)} className="ml-auto flex items-center gap-2 rounded-full bg-app-charcoal px-5 py-2 font-lp-body text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />} {k.submit}
            </button>
          </div>
          {error && <p role="alert" className="mt-2 font-lp-body text-[12px] text-app-rose">{error}</p>}
        </div>
      </div>
    </section>
  );
}
