"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Swords, Trophy } from "lucide-react";
import { SECTION_LABEL, SECTION_ORDER, type AssessmentSection } from "@/lib/assessment/sections";
import { SECTION_ICON } from "@/components/section-icons";
import type { LeaderboardEntry } from "@/lib/arena/data";

const ARENA_SECTIONS = SECTION_ORDER.filter((s) => s !== "career_interests");
const QUESTIONS_PER_CHALLENGE = 10;
const SECONDS_PER_QUESTION = 20;
const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

interface Question {
  index: number;
  id: string;
  questionText: string;
  options: { key: string; text: string }[];
}
interface FinishResult {
  score: number;
  total: number;
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "home"; leaderboard: LeaderboardEntry[] }
  | { kind: "challenge"; attemptId: string; section: AssessmentSection; questions: Question[] }
  | { kind: "finishing" }
  | { kind: "result"; result: FinishResult }
  | { kind: "error"; message: string };

const CARD =
  "w-full max-w-2xl rounded-2xl border border-lp-border-hairline bg-lp-surface-card p-8 shadow-lg shadow-black/[0.03]";
const BUTTON_PRIMARY =
  "flex items-center justify-center gap-2 rounded-lg bg-lp-text-ink px-5 py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60";

export function ArenaView() {
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    loadHome();
  }, []);

  async function loadHome() {
    setState({ kind: "loading" });
    const res = await fetch("/api/arena/leaderboard");
    const data = await res.json();
    setState({ kind: "home", leaderboard: data.entries ?? [] });
  }

  async function startChallenge(section: AssessmentSection) {
    setState({ kind: "loading" });
    const res = await fetch("/api/arena/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section }),
    });
    if (!res.ok) {
      setState({ kind: "error", message: "Could not start a challenge. Try again." });
      return;
    }
    const data = await res.json();
    setState({ kind: "challenge", attemptId: data.attemptId, section, questions: data.questions });
  }

  async function finishChallenge(attemptId: string) {
    setState({ kind: "finishing" });
    const res = await fetch(`/api/arena/${attemptId}/finish`, { method: "POST" });
    if (!res.ok) {
      setState({ kind: "error", message: "Could not finish the challenge." });
      return;
    }
    const result = await res.json();
    setState({ kind: "result", result });
  }

  if (state.kind === "loading") {
    return (
      <div className={`${CARD} flex flex-col items-center gap-3 py-16 text-center`}>
        <Loader2 size={22} className="animate-spin text-lp-accent-indigo" />
        <p className="font-lp-body text-lp-body-sm text-lp-text-muted">Loading…</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className={`${CARD} text-center`}>
        <p className="font-lp-body text-lp-body-sm text-lp-text-ink">{state.message}</p>
        <button className={`${BUTTON_PRIMARY} mt-5`} onClick={loadHome}>
          Back to Arena
        </button>
      </div>
    );
  }

  if (state.kind === "finishing") {
    return (
      <div className={`${CARD} flex flex-col items-center gap-3 py-16 text-center`}>
        <Loader2 size={22} className="animate-spin text-lp-accent-indigo" />
        <p className="font-lp-body text-lp-body-sm text-lp-text-muted">Calculating your rating…</p>
      </div>
    );
  }

  if (state.kind === "result") {
    const { result } = state;
    const gained = result.ratingDelta >= 0;
    return (
      <div className={`${CARD} text-center`}>
        <Trophy size={28} className="mx-auto text-lp-accent-ochre" />
        <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
          {result.score} / {result.total} correct
        </h1>
        <p className={`mt-2 font-lp-display text-lp-headline-md font-semibold ${gained ? "text-lp-success" : "text-lp-error"}`}>
          {gained ? "+" : ""}
          {result.ratingDelta} rating
        </p>
        <p className="mt-1 font-lp-mono text-lp-label-sm text-lp-text-muted">
          {result.ratingBefore} → {result.ratingAfter}
        </p>
        <button className={`${BUTTON_PRIMARY} mt-6 w-full`} onClick={loadHome}>
          Back to Arena
        </button>
      </div>
    );
  }

  if (state.kind === "challenge") {
    return (
      <ChallengeView
        attemptId={state.attemptId}
        section={state.section}
        questions={state.questions}
        onFinish={() => finishChallenge(state.attemptId)}
      />
    );
  }

  // home: section picker + leaderboard
  return (
    <div className="flex w-full max-w-4xl flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex-1 rounded-2xl border border-lp-border-hairline bg-lp-surface-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Swords size={18} className="text-lp-accent-indigo" />
          <h1 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Start a challenge</h1>
        </div>
        <p className="mb-5 font-lp-body text-lp-body-sm text-lp-text-muted">
          10 questions, 20 seconds each. Your score updates your Arena rating.
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {ARENA_SECTIONS.map((section) => {
            const Icon = SECTION_ICON[section];
            return (
              <button
                key={section}
                type="button"
                onClick={() => startChallenge(section)}
                className="flex items-center gap-3 rounded-xl border border-lp-border-hairline px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-lp-accent-indigo/40 hover:shadow-md"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-lp-surface-subtle text-lp-text-muted">
                  <Icon size={17} />
                </span>
                <span className="font-lp-body text-lp-body-sm font-medium text-lp-text-ink">
                  {SECTION_LABEL[section]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full rounded-2xl border border-lp-border-hairline bg-lp-surface-card p-6 shadow-sm lg:w-80">
        <div className="mb-4 flex items-center gap-2">
          <Trophy size={18} className="text-lp-accent-ochre" />
          <h2 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Leaderboard</h2>
        </div>
        {state.leaderboard.length === 0 ? (
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
            No ratings yet — be the first to complete a challenge.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {state.leaderboard.map((entry) => (
              <div
                key={entry.userId}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  entry.isViewer ? "bg-lp-accent-indigo/10" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 font-lp-mono text-lp-label-sm text-lp-text-muted">{entry.rank}</span>
                  <span className="font-lp-body text-lp-body-sm text-lp-text-ink">
                    {entry.name ?? "Student"}
                    {entry.isViewer && " (you)"}
                  </span>
                </div>
                <span className="font-lp-mono text-lp-label-sm font-semibold text-lp-text-ink">{entry.rating}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const CODE_FENCE = /```[a-zA-Z]*\n([\s\S]*?)```/;

function QuestionText({ text }: { text: string }) {
  const match = text.match(CODE_FENCE);
  if (!match || match.index === undefined) {
    return <p className="font-lp-body text-lp-body-lg font-medium leading-relaxed text-lp-text-ink">{text}</p>;
  }
  const before = text.slice(0, match.index).trim();
  return (
    <>
      {before && <p className="font-lp-body text-lp-body-lg font-medium leading-relaxed text-lp-text-ink">{before}</p>}
      <pre className="mt-3 overflow-x-auto rounded-lg border border-lp-border-hairline bg-lp-text-ink px-5 py-4 font-lp-mono text-lp-body-sm leading-relaxed text-lp-surface-card">
        <code>{match[1]}</code>
      </pre>
    </>
  );
}

function ChallengeView({
  attemptId,
  section,
  questions,
  onFinish,
}: {
  attemptId: string;
  section: AssessmentSection;
  questions: Question[];
  onFinish: () => void;
}) {
  const total = questions.length;
  const [pos, setPos] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const q = questions[pos];
  const isAnswered = selected[q.index] !== undefined;
  const isLast = pos === total - 1;

  function advance() {
    if (isLast) onFinish();
    else setPos((p) => Math.min(total - 1, p + 1));
  }

  function answer(optionKey: string) {
    if (isAnswered) return;
    setSelected((prev) => ({ ...prev, [q.index]: optionKey }));
    fetch(`/api/arena/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIndex: q.index, selectedOption: optionKey }),
    });
    setTimeout(advance, 500);
  }

  useEffect(() => {
    if (isAnswered) return;
    setTimeLeft(SECONDS_PER_QUESTION);
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          advance();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance() closes over isLast/onFinish, which don't need to restart the timer themselves
  }, [pos, isAnswered]);

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-lp-border-hairline bg-lp-surface-card shadow-lg shadow-black/[0.04]">
      <div className="h-1 w-full bg-gradient-to-r from-lp-accent-indigo to-lp-accent-ochre" />
      <div className="border-b border-lp-border-hairline px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
              Question {pos + 1} <span className="text-lp-text-muted">of {total}</span>
            </p>
            <p className="mt-0.5 font-lp-mono text-lp-label-sm font-semibold uppercase tracking-wide text-lp-accent-indigo">
              {SECTION_LABEL[section]}
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-lp-mono text-lp-label-sm font-bold ${
              timeLeft <= 5
                ? "border-lp-error-container bg-lp-error-container text-lp-error"
                : "border-lp-border-hairline bg-lp-surface-subtle text-lp-text-muted"
            }`}
          >
            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
          </div>
        </div>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
          <div
            className="h-full rounded-full bg-lp-accent-indigo transition-[width] duration-300 ease-out"
            style={{ width: `${((pos + 1) / total) * 100}%` }}
          />
        </div>
      </div>
      <div className="h-[360px] overflow-y-auto px-8 py-8">
        <QuestionText text={q.questionText} />
        <div className="mt-7 flex flex-col gap-3">
          {q.options.map((opt, i) => {
            const isSelected = selected[q.index] === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => answer(opt.key)}
                disabled={isAnswered}
                className={`flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left font-lp-body text-lp-body-sm transition-all ${
                  isSelected
                    ? "border-lp-accent-indigo bg-lp-accent-indigo/10 font-semibold text-lp-text-ink"
                    : "border-lp-border-hairline text-lp-text-ink hover:border-lp-border-strong hover:bg-lp-surface-subtle"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-lp-mono text-lp-label-sm font-bold ${
                    isSelected ? "bg-lp-accent-indigo text-lp-surface-card" : "bg-lp-surface-subtle text-lp-text-muted"
                  }`}
                >
                  {OPTION_LABELS[i] ?? "?"}
                </span>
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-lp-border-hairline px-8 py-4">
        <ArrowRight size={15} className="text-lp-text-muted" />
      </div>
    </div>
  );
}
