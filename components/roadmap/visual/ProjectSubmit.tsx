"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { send } from "@/components/roadmap/v2/api";
import { FileAttach } from "@/components/org/ProjectWorkForms";
import type { ProjectFile } from "@/lib/org/project-files";
import type { SubmissionView } from "@/lib/roadmap-visual/project-submission-server";
import { MIN_NOTE_CHARS, MAX_NOTE_CHARS, parseGithubRepo } from "@/lib/roadmap-visual/project-submission";

const H = "text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]";
const FIELD = "mt-1.5 w-full rounded-lg border border-[var(--m-rule)]! bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-[var(--m-ink)] outline-none placeholder:text-app-muted/70 focus:border-[var(--m-ink)]!";
const BUTTON = "inline-flex items-center gap-2 rounded-md bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60";

/** The student's submission for this project: loaded on open, replaced by whatever the server last returned. */
function useSubmission(resourceId: string, career: "primary" | "plan-b") {
  const [view, setView] = useState<SubmissionView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/roadmap/project-submission?resourceId=${resourceId}&career=${career}`);
        const data = (await res.json().catch(() => ({}))) as { submission?: SubmissionView; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.submission) return setLoadError(data.error ?? "Couldn't load your submission.");
        setLoadError(null);
        setView(data.submission);
      } catch {
        if (!cancelled) setLoadError("Couldn't reach the server. Check your connection and try again.");
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [resourceId, career, round]);
  return { view, setView, loadError, reload: useCallback(() => setRound((n) => n + 1), []) };
}

function Countdown({ endsAt, onEnd }: { endsAt: string; onEnd: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(endsAt) - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, Date.parse(endsAt) - Date.now());
      setLeft(ms);
      if (ms === 0) { clearInterval(t); onEnd(); }
    }, 1000);
    return () => clearInterval(t);
  }, [endsAt, onEnd]);
  const s = Math.ceil(left / 1000);
  return <span className="tabular-nums">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>;
}

function Checklist({ items, view, resourceId, career, onView }: { items: string[]; view: SubmissionView; resourceId: string; career: "primary" | "plan-b"; onView: (v: SubmissionView) => void }) {
  const locked = view.status === "verified";
  async function toggle(item: string) {
    const checked = view.checklist.includes(item) ? view.checklist.filter((c) => c !== item) : [...view.checklist, item];
    onView({ ...view, checklist: checked }); // show the tick at once; the server's answer replaces it
    const r = await send("PUT", "/api/roadmap/project-submission", { resourceId, career, checked });
    if (r.ok && r.data?.submission) onView(r.data.submission as SubmissionView);
  }
  return (
    <section aria-labelledby="chk-h">
      <h3 id="chk-h" className={H}>You&apos;re done when</h3>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((c) => {
          const on = view.checklist.includes(c);
          return (
            <li key={c}>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={on} disabled={locked} onChange={() => void toggle(c)} className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--m-ink)]" />
                <span className={on ? "text-app-muted line-through" : ""}>{c}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Verified({ view }: { view: SubmissionView }) {
  const r = view.readiness;
  return (
    <div className="rounded-xl border border-[var(--m-ink)]! p-4" role="status">
      <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} aria-hidden /> Project verified{view.score !== null ? ` · explanation scored ${view.score}/100` : ""}</p>
      {view.skillsUpdated.length > 0 ? (
        <>
          <p className="mt-2 text-[13px] text-app-muted">It now counts as evidence for these skills in your career, and your skill graph, roadmap and next steps have been updated:</p>
          <ul className="mt-2 flex flex-wrap gap-2">{view.skillsUpdated.map((s) => <li key={s} className="rounded-full border border-[var(--m-rule)] px-3 py-1 text-[12.5px] font-semibold">{s}</li>)}</ul>
          {r && r.after !== null && <p className="mt-2 text-[13px]">Role readiness: <b>{r.before !== null ? `${r.before}% → ` : ""}{r.after}%</b></p>}
        </>
      ) : (
        <p className="mt-2 text-[13px] text-app-muted">It is saved as proof of work, but none of its skills are part of this career, so no skill scores changed.</p>
      )}
      {view.review?.strengths?.length ? <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px]">{view.review.strengths.map((s) => <li key={s}>{s}</li>)}</ul> : null}
      <a href="/dashboard/portfolio" className="mt-3 inline-block text-[13px] font-bold underline">See it in your portfolio</a>
    </div>
  );
}

function Questions({ view, resourceId, career, onView, onReload }: { view: SubmissionView; resourceId: string; career: "primary" | "plan-b"; onView: (v: SubmissionView) => void; onReload: () => void }) {
  const questions = view.questions ?? [];
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    const r = await send("POST", "/api/roadmap/project-submission/answer", { resourceId, career, answers });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "That didn't work.");
    onView(r.data?.submission as SubmissionView);
  }
  return (
    <div className="rounded-xl bg-[var(--m-ground)] p-4">
      <p className="font-bold">Explain your work</p>
      {view.repo && (
        <p className="mt-1 text-[13px]">Your questions come from your repository <b>{view.repo.fullName}</b>: its README and code.{view.repo.owner === "verified-owner" ? "" : view.repo.owner === "other-owner" ? " It is not under your verified GitHub account, so expect questions about what you personally did." : " Verify your GitHub account in Code DNA so we can confirm it's yours."}</p>
      )}
      <p className="mt-1 text-[13px] text-app-muted">Answer in your own words, a few specific sentences each. This is how Capabilio checks that you built it. Time left: {view.sessionEndsAt && <Countdown endsAt={view.sessionEndsAt} onEnd={onReload} />}</p>
      <ol className="mt-3 space-y-4">
        {questions.map((q, i) => (
          <li key={q}>
            <label htmlFor={`pq-${i}`} className="block text-[13.5px] font-semibold">{i + 1}. {q}</label>
            <textarea id={`pq-${i}`} rows={4} maxLength={1200} value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} className={FIELD} />
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-app-rose">{error}</p>}
      <button type="button" onClick={() => void submit()} disabled={busy} className={`${BUTTON} mt-3`}>{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}{busy ? "Checking…" : "Check my answers"}</button>
    </div>
  );
}

function ProofForm({ view, resourceId, career, onView }: { view: SubmissionView; resourceId: string; career: "primary" | "plan-b"; onView: (v: SubmissionView) => void }) {
  const [note, setNote] = useState(view.note ?? "");
  const [link, setLink] = useState(view.linkUrl ?? "");
  const [files, setFiles] = useState<ProjectFile[]>(view.files.map(({ url: _url, ...f }) => f));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const g = view.guidance;
  async function submit() {
    setBusy(true); setError(null);
    const r = await send("POST", "/api/roadmap/project-submission", { resourceId, career, note, linkUrl: link.trim() || undefined, files });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "That didn't work.");
    onView(r.data?.submission as SubmissionView);
  }
  return (
    <div className="rounded-xl bg-[var(--m-ground)] p-4">
      <p className="font-bold">Finished it? Submit your proof.</p>
      <p className="mt-1 text-[13px] text-app-muted">{g.headline}. Attach what fits your project, then explain it in a short check. If it holds up, it counts toward the skills it builds for your career.</p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px]">{g.attach.map((a) => <li key={a}>{a}</li>)}</ul>

      <label htmlFor="ps-note" className="mt-4 block text-[13px] font-semibold">What did you build, and how? <span className="font-normal text-app-muted">({note.trim().length}/{MIN_NOTE_CHARS} characters at least)</span></label>
      <textarea id="ps-note" rows={5} maxLength={MAX_NOTE_CHARS} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The steps you took, the tools or parts you used, the numbers you got, and what went wrong along the way." className={FIELD} />

      <label htmlFor="ps-link" className="mt-3 block text-[13px] font-semibold">Link <span className="font-normal text-app-muted">(optional if you add files)</span></label>
      <input id="ps-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={FIELD} />
      <p className="mt-1 text-[12px] text-app-muted">{g.linkHint}</p>
      {parseGithubRepo(link.trim()) && <p className="mt-1 text-[12px] font-medium">We&apos;ll read this public repository (its README and main source files) and ask you about your actual code. Forks and private repositories can&apos;t be used.</p>}

      <div className="mt-3">
        <FileAttach files={files} onChange={setFiles} upload={{ url: "/api/project-proof", fields: { resourceId, career } }} help="Only you can open them." />
      </div>
      <p className="mt-3 text-[12px] text-app-muted">Capabilio reads your written account, your answers and, for a GitHub link, the repository. Photos, PDFs and other links are kept as your proof but not read.</p>

      {error && <p role="alert" className="mt-2 text-[13px] font-medium text-app-rose">{error}</p>}
      {!view.canAttempt ? (
        <p className="mt-3 text-[13px] font-medium">You&apos;ve used both checks for now. Try again in 24 hours; your proof stays saved.</p>
      ) : (
        <button type="button" onClick={() => void submit()} disabled={busy || note.trim().length < MIN_NOTE_CHARS || (!link.trim() && files.length === 0)} className={`${BUTTON} mt-3`}>
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}{busy ? "Preparing your questions…" : view.status === "not_verified" ? "Submit again" : "Submit and start the check"}
        </button>
      )}
    </div>
  );
}

/** Everything after "I finished": tick the checklist, attach proof that fits the kind of project, explain it, and see what it updated. */
export function ProjectSubmit({ resourceId, career, checklist }: { resourceId: string; career: "primary" | "plan-b"; checklist: string[] }) {
  const { view, setView, loadError, reload } = useSubmission(resourceId, career);
  if (loadError) return <p role="alert" className="text-[13px] text-app-rose">{loadError}</p>;
  if (!view) return <p className="text-[13px] text-app-muted">Loading your submission…</p>;
  const open = view.status === "awaiting_answers" && view.questions;
  return (
    <div className="space-y-5">
      {checklist.length > 0 && <Checklist items={checklist} view={view} resourceId={resourceId} career={career} onView={setView} />}
      {view.status === "verified" ? <Verified view={view} /> : open ? <Questions key={view.sessionEndsAt} view={view} resourceId={resourceId} career={career} onView={setView} onReload={reload} /> : (
        <>
          {view.status === "not_verified" && (
            <div role="status" className="rounded-xl border border-[var(--m-rule)]! p-4 text-[13px]">
              <p className="font-bold">Not verified yet{view.score !== null ? ` (${view.score}/100)` : ""}</p>
              {view.review?.improvements?.length ? <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{view.review.improvements.map((s) => <li key={s}>{s}</li>)}</ul> : null}
              <p className="mt-1.5 text-app-muted">Your proof is saved. Add detail about what you actually did and submit again{view.attemptsLeft > 0 ? ` (${view.attemptsLeft} ${view.attemptsLeft === 1 ? "check" : "checks"} left)` : ""}.</p>
            </div>
          )}
          <ProofForm key={view.status + (view.note ?? "")} view={view} resourceId={resourceId} career={career} onView={setView} />
        </>
      )}
    </div>
  );
}
