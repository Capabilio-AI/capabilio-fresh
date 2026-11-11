"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Info, Loader2, X } from "lucide-react";
import { SECONDS_PER_QUESTION } from "@/lib/crt/cycle";
import { ExamLock, useExamLock } from "@/components/exam/ExamLock";
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
function ExamRunnerInner({ title, questions, initialAnswers = {}, deadlineAt, storageKey, onAnswersChange, onSubmit, onExit, error }: Props) {
  const lock = useExamLock();
  const lockRef = useRef(lock);
  useEffect(() => {
    lockRef.current = lock;
  });
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
      lockRef.current?.release(); // submitted: the student is let out of full screen
    } catch {
      submitted.current = false; // the parent shows the error; the student can try again
    } finally {
      setBusy(false);
      setPanel("none");
    }
  }, []);

  // the lock ended the test (too many fullscreen exits or tab switches): what is answered is submitted now
  const terminated = lock?.terminated ?? null;
  useEffect(() => {
    if (terminated) void finish();
  }, [terminated, finish]);

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

  const done = questions.filter((x) => answers[x.id]).length;
  const pct = Math.round((done / questions.length) * 100);
  const sectionNo = sections.indexOf(q.section) + 1;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#f4f2ee] lg:flex-row" role="dialog" aria-modal="true" aria-label={title}>
      {/* the question rail: where you are in this section, and what is done */}
      <aside className="flex shrink-0 flex-col bg-black text-white lg:w-[300px]" aria-label="Questions">
        <div className="px-5 pb-4 pt-5">
          <p className="font-lp-body text-[15px] text-white/80">{sections.length > 1 ? `Section ${sectionNo} of ${sections.length}` : "Questions"}</p>
          <h1 className="mt-0.5 font-lp-display text-[24px] font-bold leading-tight">{q.section}</h1>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Completed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1.5 font-lp-body text-[11.5px] text-white/70">{pct}% Completed</p>
        </div>
        {sections.length > 1 && (
          <nav aria-label="Sections" className="flex gap-1 overflow-x-auto border-t border-white/15 px-3 py-2">
            {sections.map((sec) => (
              <button key={sec} type="button" aria-current={sec === q.section ? "true" : undefined} onClick={() => goTo(questions.findIndex((x) => x.section === sec))} className={`shrink-0 rounded-md px-3 py-1.5 font-lp-body text-[12.5px] font-semibold ${sec === q.section ? "bg-white text-black" : "text-white/75 hover:bg-white/10"}`}>{sec}</button>
            ))}
          </nav>
        )}
        {/* small screens: a strip of numbered tiles */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">{inSection.map(({ x, i }) => <Tile key={x.id} n={i + 1} status={statusOf(x.id)} current={i === index} onClick={() => goTo(i)} />)}</div>
        <ol className="hidden min-h-0 flex-1 overflow-y-auto border-t border-white/15 lg:block">
          {inSection.map(({ x, i }) => {
            const st = statusOf(x.id);
            const on = i === index;
            return (
              <li key={x.id}>
                <button type="button" onClick={() => goTo(i)} aria-current={on ? "true" : undefined} aria-label={`Question ${i + 1}, ${st === "notVisited" ? "not visited" : st === "answered" ? "answered" : st.startsWith("marked") ? "marked for review" : "not answered"}`}
                  className={`flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left transition-colors motion-reduce:transition-none ${on ? "border-white bg-white/15" : "border-transparent hover:bg-white/10"}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-lp-body text-[14px] font-bold tabular-nums ${on ? "border-white bg-white text-black" : "border-white/60 text-white"}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-lp-body text-[14px] font-bold">{x.topic || "Question"}</span><span className="block font-lp-body text-[12px] text-white/60">{st === "answered" || st === "markedAnswered" ? "Answered" : st === "notVisited" ? "Not visited" : "Not answered"}</span></span>
                  <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${st === "answered" || st === "markedAnswered" ? "border-white bg-white text-black" : "border-white/50"} ${st.startsWith("marked") ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-black" : ""}`}>{st === "answered" || st === "markedAnswered" ? "✓" : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="hidden border-t border-white/15 px-5 py-3 font-lp-body text-[11.5px] text-white/60 lg:block">Pink ring: marked for review</p>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 bg-black px-4 py-3 text-white sm:px-6">
          <button type="button" onClick={() => setPanel("instructions")} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 font-lp-body text-[14px] font-semibold text-white/85 hover:bg-white/10"><Info size={17} aria-hidden /> Help &amp; Resources</button>
          <p role="timer" aria-label="Total time left" className={`inline-flex items-center gap-2 font-lp-body text-[22px] font-bold tabular-nums ${totalLeft <= 120 ? "text-amber-300" : "text-white"}`}><Clock size={20} aria-hidden /> {formatClock(totalLeft)}</p>
          <button type="button" onClick={() => setPanel("confirm")} className="rounded-full bg-white px-5 py-2 font-lp-body text-[14px] font-bold text-black hover:bg-white/90">End Test</button>
        </header>
        <div className="h-1 shrink-0 bg-white/20" aria-hidden><div className="h-full bg-black/60" style={{ width: `${(index + 1) / questions.length * 100}%` }} /></div>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col rounded-2xl bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-lp-body text-[15px] font-semibold text-app-muted">Question {index + 1}{q.topic ? <span className="ml-2 text-[12.5px] font-semibold uppercase tracking-wide">{q.topic}</span> : null}</p>
              <p role="timer" aria-label="Time for this question" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-lp-body text-[13px] font-bold tabular-nums ${qLeft <= 10 ? "bg-red-50 text-red-700" : "bg-[#f4f2ee] text-black"}`}><Clock size={13} aria-hidden /> {formatClock(qLeft)} for this question</p>
            </div>
            <p className="mt-5 whitespace-pre-line font-lp-body text-[18px] leading-relaxed text-black">{q.prompt}</p>
            {isLocked && <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 font-lp-body text-[13px] font-semibold text-amber-900">Your minute for this question is over. Your answer is saved as it stands.</p>}
            <div role="radiogroup" aria-label="Answer options" className="mt-6 flex flex-col gap-3">
              {q.options.map((o) => {
                const on = answers[q.id] === o.key;
                return (
                  <button key={o.key} type="button" role="radio" aria-checked={on} disabled={isLocked} onClick={() => setAnswer(o.key)}
                    className={`flex items-center gap-4 rounded-2xl border px-4 py-4 text-left font-lp-body text-[16px] text-black transition-colors motion-reduce:transition-none disabled:cursor-not-allowed ${on ? "border-black bg-[#f4f2ee]" : "border-black/20 bg-white hover:bg-[#faf9f6]"} ${isLocked && !on ? "opacity-60" : ""}`}>
                    <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-[15px] font-bold uppercase ${on ? "border-black bg-black text-white" : "border-black/50 text-black"}`}>{o.key}</span>
                    <span className="min-w-0 flex-1">{o.text}</span>
                    <span aria-hidden className={`h-6 w-6 shrink-0 rounded-full border-2 ${on ? "border-black bg-black ring-4 ring-inset ring-white" : "border-black/30"}`} />
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-black/10 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button type="button" onClick={() => goTo(Math.max(0, index - 1))} disabled={index === 0} className="inline-flex items-center gap-2 rounded-full border border-black/25 px-5 py-2.5 font-lp-body text-[14px] font-bold text-black hover:bg-[#f4f2ee] disabled:opacity-40">← Previous</button>
          <button type="button" onClick={mark} disabled={isLocked} className="rounded-full bg-[#f4f2ee] px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-black hover:brightness-95 disabled:opacity-50">Mark for Review &amp; Next</button>
          <button type="button" onClick={() => setAnswer(null)} disabled={isLocked || !answers[q.id]} className="rounded-full px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-app-muted hover:text-black disabled:opacity-40">Clear Response</button>
          {error && <p role="alert" className="font-lp-body text-[13px] text-red-700">{error}</p>}
          <button type="button" onClick={save} className="ml-auto inline-flex items-center gap-2 rounded-full bg-black px-7 py-2.5 font-lp-body text-[14px] font-bold text-white">{index === questions.length - 1 ? "Save & Review" : "Save & Next →"}</button>
        </footer>
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
                  <button type="button" onClick={() => { lockRef.current?.release(); onExit?.(); }} className="rounded-lg bg-app-warning px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">Leave</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The exam screen, locked: it opens in full screen after a rules screen, and leaving full screen or switching tabs is counted. */
export function ExamRunner(props: Props) {
  return (
    <ExamLock area="crt" title={props.title} storageKey={props.storageKey ?? `sim-${props.title}`} onCancel={props.onExit}>
      <ExamRunnerInner {...props} />
    </ExamLock>
  );
}
