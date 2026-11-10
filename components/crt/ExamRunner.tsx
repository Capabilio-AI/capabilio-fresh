"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Info, Loader2, X } from "lucide-react";
import { SECONDS_PER_QUESTION } from "@/lib/crt/cycle";
import { formatClock } from "./api";

export interface ExamQuestion {
  id: string;
  section: string;
  topic: string;
  prompt: string;
  options: { key: string; text: string }[];
}

interface Props {
  title: string;
  questions: ExamQuestion[];
  initialAnswers?: Record<string, string>;
  /** a hard end set by the server (the assessment); the clock never runs past it */
  deadlineAt?: string;
  /** keeps the time already spent on each question across a refresh; leave out for a test that starts fresh each time */
  storageKey?: string;
  onAnswersChange?: (answers: Record<string, string>) => void;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  onExit?: () => void;
  /** shown when a submit failed */
  error?: string | null;
}

type Status = "notVisited" | "answered" | "notAnswered" | "marked" | "markedAnswered";

const TILE: Record<Status, string> = {
  notVisited: "border border-app-border bg-[var(--m-ground)] text-app-charcoal",
  answered: "bg-app-success text-white",
  notAnswered: "bg-app-warning text-white",
  marked: "rounded-full bg-[var(--m-ink)] text-white",
  markedAnswered: "rounded-full bg-[var(--m-ink)] text-white ring-2 ring-app-success ring-offset-1",
};
const LEGEND: { status: Status; label: string }[] = [
  { status: "answered", label: "Answered" },
  { status: "notAnswered", label: "Not answered" },
  { status: "marked", label: "Marked for review" },
  { status: "notVisited", label: "Not visited" },
];

const readSpent = (key?: string): Record<string, number> => {
  if (!key) return {};
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
};

function Tile({ status, n, current, onClick }: { status: Status; n: number; current: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Question ${n}, ${LEGEND.find((l) => l.status === (status === "markedAnswered" ? "marked" : status))?.label.toLowerCase()}${status === "markedAnswered" ? ", answered" : ""}`} aria-current={current ? "true" : undefined}
      className={`flex h-10 w-10 items-center justify-center rounded-md font-lp-body text-[13px] font-bold tabular-nums transition-transform motion-reduce:transition-none ${TILE[status]} ${current ? "scale-110 outline outline-2 outline-offset-2 outline-[var(--m-ink)]" : ""}`}>
      {n}
    </button>
  );
}

/**
 * The exam screen, for the placement cell's assessment and for the simulator. One minute per question, never more: time spent on a
 * question counts against its own minute, and once it is used up the question locks and the exam moves on. The clock shows the total
 * time left across all questions. Navigation is free, so a question you skipped can still use its minute later.
 */
export function ExamRunner({ title, questions, initialAnswers = {}, deadlineAt, storageKey, onAnswersChange, onSubmit, onExit, error }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !initialAnswers[q.id])));
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [visited, setVisited] = useState<Set<string>>(() => new Set([questions[0]?.id].filter(Boolean)));
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [spent, setSpent] = useState<Record<string, number>>(() => readSpent(storageKey));
  const [now, setNow] = useState(() => Date.now());
  const [panel, setPanel] = useState<"none" | "confirm" | "instructions" | "exit">("instructions");
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const submitted = useRef(false);
  const latest = useRef({ answers, submit: onSubmit });

  useEffect(() => {
    latest.current = { answers, submit: onSubmit };
  });

  const q = questions[index];
  const used = (id: string) => spent[id] ?? 0;
  const locked = (id: string) => used(id) >= SECONDS_PER_QUESTION;
  const totalLeft = useMemo(() => {
    const byQuestions = questions.reduce((s, x) => s + Math.max(0, SECONDS_PER_QUESTION - used(x.id)), 0);
    return deadlineAt ? Math.max(0, Math.min(byQuestions, (Date.parse(deadlineAt) - now) / 1000)) : byQuestions;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- used() reads spent
  }, [questions, spent, deadlineAt, now]);

  const finish = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      await latest.current.submit(latest.current.answers);
    } catch {
      submitted.current = false; // the parent shows the error; the student can try again
    } finally {
      setBusy(false);
      setPanel("none");
    }
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    setVisited((v) => new Set(v).add(questions[i].id));
  }, [questions]);

  // the clock: it runs only while the exam is being sat, against the question on screen. A question whose minute is up moves the
  // exam on, and with nothing left to answer (or past the deadline) the exam submits.
  const live = useRef({ spent, index });
  useEffect(() => {
    live.current = { spent, index };
  });
  useEffect(() => {
    if (panel === "instructions") return;
    const id = setInterval(() => {
      if (submitted.current) return;
      const { spent: s0, index: i0 } = live.current;
      const cur = questions[i0];
      const s1 = cur && (s0[cur.id] ?? 0) < SECONDS_PER_QUESTION ? { ...s0, [cur.id]: (s0[cur.id] ?? 0) + 1 } : s0;
      live.current = { spent: s1, index: i0 };
      setSpent(s1);
      setNow(Date.now());
      const left = questions.reduce((n, x) => n + Math.max(0, SECONDS_PER_QUESTION - (s1[x.id] ?? 0)), 0);
      const pastDeadline = deadlineAt ? Date.now() >= Date.parse(deadlineAt) : false;
      if (left <= 0 || pastDeadline) {
        void finish();
      } else if (cur && (s1[cur.id] ?? 0) >= SECONDS_PER_QUESTION) {
        const open = (x: ExamQuestion) => (s1[x.id] ?? 0) < SECONDS_PER_QUESTION;
        const next = questions.findIndex((x, i) => i > i0 && open(x));
        goTo(next >= 0 ? next : questions.findIndex(open));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [panel, questions, deadlineAt, finish, goTo]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(spent));
    } catch {
      /* private mode: the clock simply restarts on a refresh */
    }
  }, [spent, storageKey]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function setAnswer(key: string | null) {
    if (!q || locked(q.id)) return;
    setAnswers((a) => {
      const next = { ...a };
      if (key === null) delete next[q.id];
      else next[q.id] = key;
      onAnswersChange?.(next);
      return next;
    });
  }
  const advance = () => {
    if (index < questions.length - 1) goTo(index + 1);
    else setPanel("confirm");
  };
  const mark = () => {
    setMarked((m) => new Set(m).add(q.id));
    advance();
  };
  const save = () => {
    setMarked((m) => {
      const next = new Set(m);
      next.delete(q.id);
      return next;
    });
    advance();
  };

  const statusOf = (id: string): Status => {
    const isMarked = marked.has(id);
    const isAnswered = Boolean(answers[id]);
    if (isMarked) return isAnswered ? "markedAnswered" : "marked";
    if (isAnswered) return "answered";
    return visited.has(id) ? "notAnswered" : "notVisited";
  };

  const sections = [...new Set(questions.map((x) => x.section))];
  const inSection = questions.map((x, i) => ({ x, i })).filter(({ x }) => x.section === q?.section);
  const counts = {
    answered: questions.filter((x) => answers[x.id]).length,
    marked: questions.filter((x) => marked.has(x.id)).length,
    notVisited: questions.filter((x) => !visited.has(x.id)).length,
  };
  if (!q) return null;
  const qLeft = SECONDS_PER_QUESTION - used(q.id);
  const isLocked = locked(q.id);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--m-ground)]" role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex shrink-0 items-center justify-between gap-3 bg-[var(--m-ink)] px-4 py-3 text-white sm:px-8">
        <div className="min-w-0">
          <p className="font-lp-body text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Capabilio CRT</p>
          <p className="truncate font-lp-display text-[18px] font-bold leading-tight">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPanel("instructions")} className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 font-lp-body text-[13px] font-semibold text-white/80 hover:bg-white/10 sm:inline-flex"><Info size={15} aria-hidden /> Instructions</button>
          <p role="timer" aria-label="Total time left" className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-lp-body text-[15px] font-bold tabular-nums ${totalLeft <= 120 ? "bg-app-warning text-white" : "bg-white/12 text-white"}`}><Clock size={15} aria-hidden /> {formatClock(totalLeft)}</p>
          {onExit && <button type="button" onClick={() => setPanel("exit")} aria-label="Leave the test" className="rounded-lg p-2 text-white/80 hover:bg-white/10"><X size={18} /></button>}
        </div>
      </header>

      <nav aria-label="Sections" className="shrink-0 overflow-x-auto border-b border-app-border bg-white px-4 sm:px-8">
        <div className="flex gap-1 py-2">
          {sections.map((s) => {
            const ids = questions.filter((x) => x.section === s);
            const done = ids.filter((x) => answers[x.id]).length;
            const on = s === q.section;
            return (
              <button key={s} type="button" aria-current={on ? "true" : undefined} onClick={() => goTo(questions.findIndex((x) => x.section === s))} className={`flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 font-lp-body text-[13px] font-semibold transition-colors motion-reduce:transition-none ${on ? "bg-[var(--m-ink)] text-white" : "bg-[var(--m-ground)] text-app-charcoal hover:bg-[var(--m-accent-soft)]"}`}>
                {s}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-white"}`}>{done}/{ids.length}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 lg:overflow-hidden">
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-app-border bg-white">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-border px-5 py-3.5">
              <h2 className="font-lp-display text-[19px] font-bold text-app-charcoal">Question No {index + 1}</h2>
              <p role="timer" aria-label="Time for this question" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-lp-body text-[13px] font-bold tabular-nums ${qLeft <= 10 ? "bg-app-warning/15 text-app-warning" : "bg-[var(--m-accent-soft)] text-[var(--m-ink)]"}`}><Clock size={13} aria-hidden /> {formatClock(qLeft)} for this question</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <p className="mb-1 font-lp-body text-[12px] font-semibold uppercase tracking-wide text-app-muted">{q.topic}</p>
              <p className="whitespace-pre-line font-lp-display text-[19px] font-semibold leading-snug text-app-charcoal">{q.prompt}</p>
              {isLocked && <p role="status" className="mt-4 rounded-lg bg-app-warning/10 px-3 py-2 font-lp-body text-[13px] font-semibold text-app-warning">Your minute for this question is over. Your answer is saved as it stands.</p>}
              <div role="radiogroup" aria-label="Answer options" className="mt-5 flex flex-col gap-2.5">
                {q.options.map((o) => {
                  const on = answers[q.id] === o.key;
                  return (
                    <button key={o.key} type="button" role="radio" aria-checked={on} disabled={isLocked} onClick={() => setAnswer(o.key)}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left font-lp-body text-[15px] leading-snug text-app-charcoal transition-colors motion-reduce:transition-none disabled:cursor-not-allowed ${on ? "border-[var(--m-ink)] bg-[var(--m-accent-soft)]" : "border-app-border bg-white hover:bg-[var(--m-ground)]"} ${isLocked && !on ? "opacity-60" : ""}`}>
                      <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold uppercase ${on ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-app-border text-app-muted"}`}>{o.key}</span>
                      <span>{o.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-app-border bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={mark} disabled={isLocked} className="rounded-lg bg-[var(--m-accent-soft)] px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)] hover:brightness-95 disabled:opacity-50">Mark for Review &amp; Next</button>
              <button type="button" onClick={() => setAnswer(null)} disabled={isLocked || !answers[q.id]} className="rounded-lg border border-app-border px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-app-charcoal hover:bg-[var(--m-ground)] disabled:opacity-50">Clear Response</button>
              <button type="button" onClick={save} className="ml-auto rounded-lg bg-[var(--m-ink)] px-6 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">{index === questions.length - 1 ? "Save & Review" : "Save & Next"}</button>
            </div>
          </section>
        </main>

        <aside className="shrink-0 border-t border-app-border bg-white p-4 sm:p-5 lg:w-[340px] lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Question palette">
          <p className="font-lp-body text-[12.5px] text-app-muted">You are viewing <strong className="text-app-charcoal">{q.section}</strong></p>
          <p className="mt-0.5 font-lp-body text-[11px] font-bold uppercase tracking-wide text-app-muted">Question palette</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {inSection.map(({ x, i }) => <Tile key={x.id} n={i + 1} status={statusOf(x.id)} current={i === index} onClick={() => goTo(i)} />)}
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2">
            {LEGEND.map((l) => (
              <li key={l.status} className="flex items-center gap-2 font-lp-body text-[12px] text-app-charcoal">
                <span aria-hidden className={`inline-block h-4 w-4 shrink-0 rounded-[4px] ${TILE[l.status]} ${l.status === "marked" ? "!rounded-full" : ""}`} />
                {l.label}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setPanel("confirm")} className="mt-6 w-full rounded-lg bg-[var(--m-ink)] px-4 py-3 font-lp-body text-[14px] font-semibold text-white">Submit</button>
          <button type="button" onClick={() => setPanel("instructions")} className="mt-2 w-full rounded-lg border border-app-border px-4 py-2.5 font-lp-body text-[13px] font-semibold text-app-charcoal hover:bg-[var(--m-ground)] sm:hidden">Instructions</button>
          {error && <p role="alert" className="mt-3 font-lp-body text-[13px] text-app-warning">{error}</p>}
        </aside>
      </div>

      {panel !== "none" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--m-ink)]/55 p-4" role="alertdialog" aria-modal="true" aria-label={panel === "instructions" ? "Instructions" : panel === "exit" ? "Leave the test" : "Submit the test"}>
          <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
            {panel === "instructions" && (
              <>
                <h3 className="font-lp-display text-[22px] font-bold text-app-charcoal">Before you begin</h3>
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 font-lp-body text-[14px] leading-relaxed text-app-charcoal">
                  <li><strong>One minute per question.</strong> Each question has its own minute. When it is used up, the question locks and the exam moves on.</li>
                  <li>The clock at the top is the total time left across all questions. It starts when you press Start.</li>
                  <li><strong>Save &amp; Next</strong> keeps your answer. <strong>Mark for Review</strong> flags a question to come back to. <strong>Clear Response</strong> removes your answer.</li>
                  <li>You can move between questions using the palette; a question you skipped can still use its minute.</li>
                  <li>No answers or hints are shown until you submit.</li>
                </ul>
                <button type="button" onClick={() => { setStarted(true); setPanel("none"); }} className="mt-5 w-full rounded-lg bg-[var(--m-ink)] px-4 py-3 font-lp-body text-[14px] font-semibold text-white">{started ? "Continue" : "Start"}</button>
              </>
            )}
            {panel === "confirm" && (
              <>
                <h3 className="font-lp-display text-[22px] font-bold text-app-charcoal">Submit your test?</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 font-lp-body text-[14px]">
                  {[["Answered", counts.answered], ["Not answered", questions.length - counts.answered], ["Marked for review", counts.marked], ["Not visited", counts.notVisited]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-[var(--m-ground)] px-3 py-2"><dt className="text-[12px] text-app-muted">{k}</dt><dd className="text-[20px] font-bold tabular-nums text-app-charcoal">{v}</dd></div>
                  ))}
                </dl>
                <p className="mt-3 font-lp-body text-[13px] text-app-muted">Unanswered questions score zero. You cannot change anything after you submit.</p>
                {error && <p role="alert" className="mt-2 font-lp-body text-[13px] text-app-warning">{error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setPanel("none")} disabled={busy} className="rounded-lg px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-app-charcoal hover:bg-[var(--m-ground)]">Keep working</button>
                  <button type="button" onClick={() => void finish()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />}Submit</button>
                </div>
              </>
            )}
            {panel === "exit" && (
              <>
                <h3 className="font-lp-display text-[22px] font-bold text-app-charcoal">Leave this test?</h3>
                <p className="mt-2 font-lp-body text-[14px] text-app-muted">Your answers will not be graded and this attempt will be lost.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setPanel("none")} className="rounded-lg px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-app-charcoal hover:bg-[var(--m-ground)]">Stay</button>
                  <button type="button" onClick={onExit} className="rounded-lg bg-app-warning px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">Leave</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
