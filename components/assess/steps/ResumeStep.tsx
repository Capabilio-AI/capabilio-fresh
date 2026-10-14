"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, Award, Briefcase, CheckCircle2, FileText, FolderGit2, GraduationCap, UploadCloud } from "lucide-react";
import type { ResumeSummary } from "@/lib/graduate/summary";
import { ApiError, NetworkError, assessApi } from "../api";
import { Button } from "../ui/Button";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/uploads/limits";

const MAX_BYTES = MAX_UPLOAD_BYTES;
const READING = ["Reading your resume", "Finding your education, projects and skills", "Filling in your profile"];

type View =
  | { kind: "idle"; error?: string }
  | { kind: "reading"; fileName: string }
  | { kind: "done"; summary: ResumeSummary };

/**
 * Recently graduated, step 1. The resume is read once on the server; what it says goes into the sections Capabilio already has, and the
 * skills it names decide which skills the role assessment asks about a little more. The file itself is not kept.
 */
export function ResumeStep({ onContinue }: { onContinue: () => void }) {
  const reduce = useReducedMotion();
  const [view, setView] = useState<View>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const [tick, setTick] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view.kind !== "reading" || reduce) return;
    const t = setInterval(() => setTick((n) => Math.min(n + 1, READING.length - 1)), 2600);
    return () => clearInterval(t);
  }, [view.kind, reduce]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setView({ kind: "idle", error: "Upload your resume as a PDF." });
    if (file.size > MAX_BYTES) return setView({ kind: "idle", error: `Keep the resume under ${MAX_UPLOAD_MB} MB.` });
    setTick(0);
    setView({ kind: "reading", fileName: file.name });
    try {
      const { summary } = await assessApi.uploadResume(file);
      setView({ kind: "done", summary });
    } catch (e) {
      setView({ kind: "idle", error: e instanceof NetworkError ? "We couldn't reach the server. Check your connection and try again." : e instanceof ApiError ? e.message : "Something went wrong. Please try again." });
    }
  };

  const skip = async () => {
    try {
      await assessApi.skipResume();
      onContinue();
    } catch {
      setView({ kind: "idle", error: "We couldn't save that. Please try again." });
    }
  };

  if (view.kind === "done") return <ResumeDone summary={view.summary} onContinue={onContinue} />;

  const reading = view.kind === "reading";
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:pt-12" aria-labelledby="resume-title">
      <div className="a-rise text-center">
        <span className="a-glass-soft mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-[var(--m-ink)]"><FileText className="h-4 w-4 text-[var(--m-accent)]" aria-hidden /> Start with your resume</span>
        <h1 id="resume-title" className="mx-auto mt-5 max-w-2xl text-balance font-lp-display text-[40px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[56px]">Upload your most recent resume</h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-[var(--m-muted)]">We read it to fill in your profile, then test the skills it claims. We keep what we read, not the file.</p>
      </div>

      <div className="a-rise mt-8" style={{ animationDelay: "100ms" }}>
        <label
          htmlFor="resume-file"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files[0]); }}
          className={`a-glass flex cursor-pointer flex-col items-center gap-3 rounded-[2rem] border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${over ? "scale-[1.01] border-[var(--m-accent)]" : "border-[var(--m-soft)]"} ${reading ? "pointer-events-none" : "hover:-translate-y-0.5"}`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--m-ink)] text-white"><UploadCloud className="h-7 w-7" aria-hidden /></span>
          {reading ? (
            <div aria-live="polite">
              <p className="text-[17px] font-bold text-[var(--m-ink)]">{READING[tick]}…</p>
              <p className="mt-1 text-[14px] text-[var(--m-muted)]">{(view as { fileName: string }).fileName}</p>
              <div className="mx-auto mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-[var(--m-ink)]/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--m-accent)]" /></div>
            </div>
          ) : (
            <>
              <p className="text-[18px] font-bold text-[var(--m-ink)]">Drop your resume here, or choose a file</p>
              <p className="text-[14px] text-[var(--m-muted)]">PDF with selectable text, up to {MAX_UPLOAD_MB} MB</p>
            </>
          )}
          <input ref={input} id="resume-file" type="file" accept="application/pdf,.pdf" className="sr-only" disabled={reading} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {view.kind === "idle" && view.error && <div role="alert" className="a-glass a-rise mx-auto mt-5 max-w-xl rounded-2xl p-4 text-center"><p className="text-[15px] font-bold text-[var(--m-ink)]">{view.error}</p></div>}
        {!reading && (
          <div className="mt-5 flex justify-center">
            <Button variant="ghost" onClick={() => void skip()}>I don&apos;t have a resume yet</Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function ResumeDone({ summary, onContinue }: { summary: ResumeSummary; onContinue: () => void }) {
  const tiles = [
    { icon: GraduationCap, label: "Education", n: summary.counts.education },
    { icon: FolderGit2, label: "Projects", n: summary.counts.projects },
    { icon: Briefcase, label: "Experience", n: summary.counts.experience },
    { icon: Award, label: "Certificates", n: summary.counts.certifications },
  ];
  const nothing = tiles.every((t) => t.n === 0) && summary.counts.skills === 0;
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:pt-12" aria-labelledby="resume-done-title">
      <div className="a-glass a-rise rounded-[2rem] p-7 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ok)] text-white shadow-[0_16px_28px_-14px_var(--ok)]"><CheckCircle2 className="h-7 w-7" aria-hidden /></span>
        <h1 id="resume-done-title" className="mt-4 font-lp-display text-[34px] font-bold leading-tight text-[var(--m-ink)]">{nothing ? "Got it" : "Here is what we found"}</h1>
        {summary.headline && <p className="mx-auto mt-2 max-w-md text-[15px] text-[var(--m-muted)]">{summary.headline}</p>}
        {!nothing && (
          <>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map(({ icon: Icon, label, n }) => (
                <li key={label} className="a-glass-soft rounded-2xl px-3 py-4">
                  <Icon className="mx-auto h-5 w-5 text-[var(--m-accent)]" aria-hidden />
                  <div className="mt-1 text-[26px] font-bold tabular-nums text-[var(--m-ink)]">{n}</div>
                  <div className="text-[12.5px] font-bold text-[var(--m-muted)]">{label}</div>
                </li>
              ))}
            </ul>
            {summary.skills.length > 0 && (
              <div className="mt-6">
                <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--m-muted)]">{summary.counts.skills} skills named</p>
                <ul className="mt-2 flex flex-wrap justify-center gap-2">
                  {summary.skills.map((s) => <li key={s} className="a-glass-soft rounded-full px-3 py-1 text-[13px] font-bold text-[var(--m-ink)]">{s}</li>)}
                </ul>
              </div>
            )}
            {summary.applied && (
              <p className="mx-auto mt-6 max-w-md text-[14px] leading-relaxed text-[var(--m-muted)]">
                We added these to your profile, education history and vault, marked as from your resume. You can edit or remove any of it later.
              </p>
            )}
          </>
        )}
        <Button variant="accent" size="lg" onClick={onContinue} iconAfter={<ArrowRight className="h-4 w-4" aria-hidden />} className="mt-8">Choose your target role</Button>
      </div>
    </section>
  );
}
