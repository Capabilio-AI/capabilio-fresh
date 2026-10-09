"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CloudOff, Crosshair, Loader2, RefreshCw } from "lucide-react";
import { QUESTION_SECONDS } from "@/lib/assess/config";
import type { AssessmentResult, Feedback, HistoryItem, QuestionPayload, SessionState } from "@/lib/assess/types";
import { ApiError, NetworkError, assessApi, sleep } from "../api";
import { Button } from "../ui/Button";
import { RichText } from "../ui/CodeText";
import { DifficultyMeter } from "../ui/DifficultyMeter";
import { ActionBar, type Phase } from "./ActionBar";
import { FeedbackPanel } from "./FeedbackPanel";
import { MissionRail } from "./MissionRail";
import { QuestionTimer } from "./QuestionTimer";
import { OptionTile, optionState } from "./OptionTile";
import { SegmentedProgress } from "./SegmentedProgress";
import { Sparks } from "./Sparks";

const SAVE_RETRY_MS = [800, 1600, 3200, 6400];

interface RunnerState {
  question: QuestionPayload | null;
  feedback: Feedback | null;
  selected: number | null;
  phase: Phase;
  offline: boolean;
  message: string | null;
  history: HistoryItem[];
  elo: { start: number; now: number } | null;
}
type Action =
  | { t: "show"; question: QuestionPayload }
  | { t: "pick"; index: number }
  | { t: "saved"; feedback: Feedback; item: HistoryItem }
  | { t: "offline"; value: boolean }
  | { t: "loading" }
  | { t: "submitting" }
  | { t: "fail"; message: string }
  | { t: "backToFeedback" }
  | { t: "ended" };

function reduce(s: RunnerState, a: Action): RunnerState {
  switch (a.t) {
    case "show": return { ...s, question: a.question, feedback: null, selected: null, phase: "answering", message: null };
    case "pick": return { ...s, selected: a.index, phase: "saving" }; // locked at once, before the network answers
    case "saved": return {
      ...s, feedback: a.feedback, selected: a.feedback.chosenIndex, phase: "feedback", offline: false,
      history: s.history.some((h) => h.position === a.item.position) ? s.history : [...s.history, a.item],
      elo: a.feedback.elo && s.elo ? { start: s.elo.start, now: a.feedback.elo.newRating } : s.elo,
    };
    case "offline": return { ...s, offline: a.value };
    case "loading": return { ...s, phase: "loading-next", message: null };
    case "submitting": return { ...s, phase: "submitting", message: null };
    case "fail": return { ...s, phase: "retry", message: a.message };
    case "backToFeedback": return { ...s, phase: "feedback" };
    // the assessment finished early (the question pool ran dry after most of it was answered): this answer was the last one
    case "ended": return { ...s, phase: "feedback", feedback: s.feedback ? { ...s.feedback, isLast: true } : s.feedback };
  }
}

/** "Grammar (error spotting, tenses, ...)" -> "Grammar": the full name stays in the tooltip. */
const shortSkill = (name: string) => name.split("(")[0].trim() || name;

const friendly = (e: unknown) => (e instanceof NetworkError ? "We couldn't reach the server. Check your connection and try again." : e instanceof ApiError ? e.message : "Something went wrong. Your progress is saved.");

/**
 * One question at a time. The first selection is final: tiles lock the instant one is picked (before the network answers), the same
 * attempt id is retried until the server confirms, and the server (not this component) decides what was correct. Refreshing resumes
 * from the server's state: an answered question comes back with its locked feedback.
 */
export function QuestionRunner({ sessionId, initial, onSubmitted }: { sessionId: string; initial: SessionState; onSubmitted: (result: AssessmentResult) => void }) {
  const reducedMotion = !!useReducedMotion();
  const [s, dispatch] = useReducer(reduce, undefined, (): RunnerState => ({
    question: initial.current?.question ?? null,
    feedback: initial.current?.feedback ?? null,
    selected: initial.current?.feedback?.chosenIndex ?? null,
    phase: initial.current?.feedback ? "feedback" : initial.current ? "answering" : "loading-next",
    offline: false, message: null, history: initial.history, elo: initial.elo,
  }));
  const attemptIds = useRef(new Map<string, string>());
  const shownAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const needsFirst = !initial.current;

  useEffect(() => {
    if (!needsFirst) return;
    let cancelled = false;
    assessApi.next(sessionId).then(({ question }) => { if (!cancelled && question) dispatch({ t: "show", question }); }).catch((e) => { if (!cancelled) dispatch({ t: "fail", message: friendly(e) }); });
    return () => { cancelled = true; };
  }, [needsFirst, sessionId]);

  useEffect(() => {
    shownAt.current = Date.now(); // response time is measured from when this question was put on screen
    headingRef.current?.focus({ preventScroll: true });
  }, [s.question?.sessionQuestionId]);

  const loadNext = useCallback(async () => {
    dispatch({ t: "loading" });
    // A question that is not ready yet is retried quietly a few times; the student only sees a message if it stays unavailable.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { question, ended } = await assessApi.next(sessionId);
        if (!question) return dispatch({ t: ended ? "ended" : "backToFeedback" });
        await sleep(reducedMotion ? 0 : 120); // the short, subtle between-question moment; deliberately not a countdown
        return dispatch({ t: "show", question });
      } catch (e) {
        const transient = e instanceof NetworkError || (e instanceof ApiError && e.retryable);
        if (!transient || attempt === 3) return dispatch({ t: "fail", message: friendly(e) });
        await sleep(1200 * (attempt + 1));
      }
    }
  }, [sessionId, reducedMotion]);

  const choose = useCallback(async (index: number) => {
    const q = s.question;
    if (!q || s.phase !== "answering") return;
    dispatch({ t: "pick", index });
    const attemptId = attemptIds.current.get(q.sessionQuestionId) ?? crypto.randomUUID();
    attemptIds.current.set(q.sessionQuestionId, attemptId);
    const responseMs = Date.now() - shownAt.current;
    for (let tries = 0; ; tries++) {
      try {
        const feedback = await assessApi.answer({ sessionQuestionId: q.sessionQuestionId, attemptId, optionIndex: index, responseMs });
        dispatch({ t: "saved", feedback, item: { position: q.position, skillName: q.skillName, group: q.layer === "CAREER" ? q.skillName : q.category ?? q.skillName, difficulty: q.difficulty, correct: feedback.isCorrect } });
        return;
      } catch (e) {
        if (e instanceof ApiError && !e.retryable) return dispatch({ t: "fail", message: e.message });
        dispatch({ t: "offline", value: true }); // keep the selection, show "Saving…", retry with the SAME attempt id
        await sleep(SAVE_RETRY_MS[Math.min(tries, SAVE_RETRY_MS.length - 1)]);
      }
    }
  }, [s.phase, s.question]);

  const submit = useCallback(async () => {
    dispatch({ t: "submitting" });
    try {
      const { result } = await assessApi.submit(sessionId);
      onSubmitted(result);
    } catch (e) {
      dispatch({ t: "fail", message: friendly(e) });
    }
  }, [onSubmitted, sessionId]);

  // keyboard: A-F or 1-6 picks, Enter moves on
  const stateRef = useRef({ s, choose, loadNext, submit });
  useEffect(() => { stateRef.current = { s, choose, loadNext, submit }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest("dialog, input, textarea")) return;
      const { s: cur, choose: pick, loadNext: next, submit: send } = stateRef.current;
      const k = e.key.toLowerCase();
      const idx = /^[a-f]$/.test(k) ? k.charCodeAt(0) - 97 : /^[1-6]$/.test(k) ? Number(k) - 1 : -1;
      if (idx >= 0 && cur.phase === "answering" && cur.question && idx < cur.question.options.length) { e.preventDefault(); void pick(idx); }
      if (e.key === "Enter" && cur.phase === "feedback" && cur.feedback) { e.preventDefault(); void (cur.feedback.isLast ? send() : next()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = s.question;
  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div role="status" className="a-glass flex items-center gap-3 rounded-3xl p-8 text-[15px] font-bold text-[var(--m-muted)]">
          {s.phase === "retry" ? null : <Loader2 className="h-5 w-5 animate-spin" aria-hidden />} {s.phase === "retry" ? s.message : "Getting your first question"}
        </div>
        {s.phase === "retry" && <RetryPanel message={s.message} onRetry={() => window.location.reload()} />}
      </div>
    );
  }

  const isCareer = q.layer === "CAREER";
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-3 pb-20 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="a-glass rounded-[2rem] p-5 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-bold text-[var(--m-muted)]">
              <span className="mr-2 text-[var(--m-ink)]">{isCareer ? q.careerName : "Common assessment"}</span>
              <span aria-live="polite">Question {q.position} of {q.total}</span>
            </p>
            <div className="flex items-center gap-2">
              {!s.feedback && <QuestionTimer questionId={q.sessionQuestionId} secondsLeft={q.secondsLeft} total={QUESTION_SECONDS} running={s.phase === "answering"} onExpire={() => void choose(-1)} />}
              <DifficultyMeter difficulty={q.difficulty} />
            </div>
          </div>
          <SegmentedProgress total={q.total} history={s.history} current={q.position} answeredCurrent={!!s.feedback} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={q.sessionQuestionId}
              initial={reducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              aria-labelledby="q-text"
              className="mt-6"
            >
              <div className="inline-flex items-center gap-3 rounded-2xl bg-[var(--m-ink)] py-2 pl-2.5 pr-5 text-white shadow-[0_14px_24px_-14px_rgb(23_19_31/0.8)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15"><Crosshair className="h-4 w-4" aria-hidden /></span>
                <span className="leading-tight">
                  <span className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/65">{isCareer ? "Skill being assessed" : q.category ?? "Section"}</span>
                  <span className="block text-[16px] font-bold" title={q.skillName}>{shortSkill(q.skillName)}</span>
                </span>
              </div>

              <h2 id="q-text" ref={headingRef} tabIndex={-1} style={{ outline: "none" }} className="mt-5 font-lp-display text-[21px] font-semibold leading-snug text-[var(--m-ink)] sm:text-[25px]">
                <RichText text={q.text} />
              </h2>

              <ul className="mt-6 space-y-3" role="group" aria-label="Answer options">
                {q.options.map((text, i) => (
                  <li key={i} className="relative">
                    <OptionTile index={i} text={text} state={optionState(i, s.selected, s.feedback)} locked={s.phase !== "answering"} onPick={() => choose(i)} />
                    {s.feedback?.isCorrect && i === s.feedback.correctIndex && !reducedMotion && <Sparks />}
                  </li>
                ))}
              </ul>
            </motion.section>
          </AnimatePresence>

          {s.phase === "saving" && (
            <p role="status" className="mt-5 flex items-center gap-2 text-[14px] font-bold text-[var(--m-muted)]">
              {s.offline ? <CloudOff className="h-4 w-4" aria-hidden /> : <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {s.offline ? "Saving your answer… you seem to be offline. We'll keep trying, and your choice is kept." : "Saving your answer…"}
            </p>
          )}

          {s.feedback && <FeedbackPanel feedback={s.feedback} isCareer={isCareer} reduce={reducedMotion} />}

          <div className="mt-6 flex min-h-[3.25rem] flex-wrap items-center justify-end gap-3">
            <ActionBar phase={s.phase} feedback={s.feedback} onNext={loadNext} onSubmit={submit} />
            {(s.phase === "loading-next" || s.phase === "submitting") && (
              <span role="status" className="flex items-center gap-2 text-[14px] font-bold text-[var(--m-muted)]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{s.phase === "submitting" ? "Analysing your answers" : "Loading"}</span>
            )}
          </div>
          {s.phase === "retry" && <RetryPanel message={s.message} onRetry={s.feedback ? (s.feedback.isLast ? submit : loadNext) : loadNext} />}
        </div>
        <p className="mt-3 px-2 text-center text-[12.5px] text-[var(--m-muted)]">Each question has {QUESTION_SECONDS} seconds · A–D to answer · Enter for {s.feedback?.isLast ? "Submit" : "Next"}</p>
      </div>

      <MissionRail state={initial} history={s.history} elo={s.elo} isCareer={isCareer} currentSkill={isCareer ? q.skillName : q.category ?? ""} total={q.total} />
    </div>
  );
}

function RetryPanel({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div role="alert" className="a-glass-soft mt-5 rounded-2xl p-5">
      <p className="text-[15px] font-bold text-[var(--m-ink)]">{message ?? "Something went wrong."}</p>
      <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">Your progress and every answer so far are saved.</p>
      <Button variant="secondary" onClick={onRetry} icon={<RefreshCw className="h-4 w-4" aria-hidden />} className="mt-3">Try again</Button>
    </div>
  );
}
