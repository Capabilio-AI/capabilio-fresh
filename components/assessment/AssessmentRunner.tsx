"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Timer, X } from "lucide-react";
import { SECONDS_PER_QUESTION, SECTION_LABEL, SECTION_ORDER } from "@/lib/assessment/sections";
import type { AssessmentSection } from "@/lib/assessment/sections";
import { BrandBackdrop } from "@/components/BrandBackdrop";
import { SECTION_ICON } from "@/components/section-icons";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

type SectionKey = AssessmentSection;

interface SectionStatus {
  section: SectionKey;
  status: "not_started" | "in_progress" | "completed";
}
interface AttemptProgress {
  attemptId: string;
  attemptStatus: "in_progress" | "completed";
  sections: SectionStatus[];
  currentSection: SectionKey | null;
  completedCount: number;
}
interface QuestionOption {
  key: string;
  text: string;
}
interface SectionQuestion {
  index: number;
  questionText: string;
  options: QuestionOption[];
  answeredOption: string | null;
  correctOption: string | null;
}

const CARD =
  "w-full max-w-2xl rounded-2xl border border-lp-border-hairline bg-lp-surface-card p-8 shadow-lg shadow-black/[0.03]";
const BUTTON_PRIMARY =
  "flex items-center justify-center gap-2 rounded-lg bg-lp-text-ink px-5 py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card shadow-sm transition-all hover:-translate-y-0.5 hover:bg-lp-inverse-surface hover:shadow-md disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none";

type ViewState =
  | { kind: "loading" }
  | { kind: "overview"; progress: AttemptProgress }
  | { kind: "needs-target-role"; progress: AttemptProgress }
  | { kind: "generating-career-questions"; progress: AttemptProgress }
  | { kind: "section"; progress: AttemptProgress; section: SectionKey; questions: SectionQuestion[] }
  | { kind: "complete" }
  | { kind: "error"; message: string };

export function AssessmentRunner() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    startOrLoad();
  }, []);

  async function startOrLoad() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/assessment/start", { method: "POST" });
      if (!res.ok) throw new Error("Could not start assessment");
      const progress: AttemptProgress = await res.json();
      if (progress.attemptStatus === "completed") {
        setState({ kind: "complete" });
        return;
      }
      setState({ kind: "overview", progress });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Something went wrong" });
    }
  }

  async function enterSection(section: SectionKey, progress: AttemptProgress) {
    setState({ kind: "loading" });
    const res = await fetch(`/api/assessment/${section}/questions`);
    const data = await res.json();
    if (section === "career_interests" && data.status === "needs_target_role") {
      setState({ kind: "needs-target-role", progress });
      return;
    }
    setState({ kind: "section", progress, section, questions: data.questions });
  }

  async function submitTargetRole(statedRole: string, progress: AttemptProgress) {
    setState({ kind: "generating-career-questions", progress });
    const res = await fetch("/api/assessment/career-interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statedRole }),
    });
    if (!res.ok) {
      setState({ kind: "error", message: "Could not generate your Career Interests questions. Try again." });
      return;
    }
    await enterSection("career_interests", progress);
  }

  function answerQuestion(
    section: SectionKey,
    questionIndex: number,
    selectedOption: string,
    progress: AttemptProgress,
    questions: SectionQuestion[]
  ) {
    // A question locks the moment it's answered (see SectionView) — this
    // only ever fires once per question, so there's nothing to guard here.
    // Optimistic: the option must react instantly on click, not after a
    // round trip. correctOption stays null until the grading response
    // comes back, which is what drives the brief "selected" → green/red
    // transition in the UI.
    const updated = questions.map((q) => (q.index === questionIndex ? { ...q, answeredOption: selectedOption } : q));
    setState({ kind: "section", progress, section, questions: updated });

    fetch(`/api/assessment/${section}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIndex, selectedOption }),
    }).then(async (res) => {
      if (!res.ok) {
        setState((prev) => {
          if (prev.kind !== "section" || prev.section !== section) return prev;
          const reverted = prev.questions.map((q) =>
            q.index === questionIndex ? { ...q, answeredOption: null } : q
          );
          return { ...prev, questions: reverted };
        });
        return;
      }
      const { correctOption } = await res.json();
      setState((prev) => {
        if (prev.kind !== "section" || prev.section !== section) return prev;
        const graded = prev.questions.map((q) => (q.index === questionIndex ? { ...q, correctOption } : q));
        return { ...prev, questions: graded };
      });
    });
  }

  async function submitSection(section: SectionKey) {
    setState({ kind: "loading" });
    const res = await fetch(`/api/assessment/${section}/submit`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setState((prev) =>
        prev.kind === "loading" ? { kind: "error", message: err.error ?? "Could not submit section" } : prev
      );
      return;
    }
    // Whether this was the last section or not, startOrLoad() re-fetches
    // attempt status and routes accordingly — attemptStatus === "completed"
    // lands on the "complete" card (Go to Dashboard button), otherwise the
    // section overview. No separate redirect branch needed here.
    await startOrLoad();
  }

  if (state.kind === "loading") {
    return (
      <BrandBackdrop>
        <div className={`${CARD} flex flex-col items-center gap-3 py-16 text-center`}>
          <Loader2 size={22} className="animate-spin text-lp-accent-indigo" />
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">Loading…</p>
        </div>
      </BrandBackdrop>
    );
  }

  if (state.kind === "error") {
    return (
      <BrandBackdrop>
        <div className={`${CARD} text-center`}>
          <p className="font-lp-body text-lp-body-sm text-lp-text-ink">{state.message}</p>
          <button className={`${BUTTON_PRIMARY} mt-5`} onClick={startOrLoad}>
            Try again
          </button>
        </div>
      </BrandBackdrop>
    );
  }

  if (state.kind === "complete") {
    return (
      <BrandBackdrop>
        <div className={`${CARD} text-center`}>
          <CheckCircle2 size={28} className="mx-auto text-lp-accent-indigo" />
          <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
            Assessment complete
          </h1>
          <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-muted">
            Your results are ready.
          </p>
          <button className={`${BUTTON_PRIMARY} mt-5`} onClick={() => router.push("/dashboard")}>
            Go to dashboard
            <ArrowRight size={16} />
          </button>
        </div>
      </BrandBackdrop>
    );
  }

  if (state.kind === "needs-target-role") {
    return (
      <BrandBackdrop>
        <TargetRoleForm onSubmit={(role) => submitTargetRole(role, state.progress)} />
      </BrandBackdrop>
    );
  }

  if (state.kind === "generating-career-questions") {
    return (
      <BrandBackdrop>
        <div className={`${CARD} flex flex-col items-center gap-3 py-16 text-center`}>
          <Loader2 size={22} className="animate-spin text-lp-accent-indigo" />
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
            Generating your Career Interests questions — this can take up to a minute.
          </p>
        </div>
      </BrandBackdrop>
    );
  }

  if (state.kind === "section") {
    return (
      <BrandBackdrop>
        <SectionView
          state={state}
          onAnswer={(questionIndex, selectedOption) =>
            answerQuestion(state.section, questionIndex, selectedOption, state.progress, state.questions)
          }
          onSubmit={() => submitSection(state.section)}
          onExit={startOrLoad}
        />
      </BrandBackdrop>
    );
  }

  // overview
  const { progress } = state;
  return (
    <BrandBackdrop>
      <div className={CARD}>
        <h1 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Your assessment</h1>
        <p className="mt-1.5 font-lp-body text-lp-body-sm text-lp-text-muted">
          {progress.completedCount} of {SECTION_ORDER.length} sections complete.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          {progress.sections.map((s) => {
            const isCurrent = s.section === progress.currentSection;
            const Icon = SECTION_ICON[s.section];
            return (
              <div
                key={s.section}
                className={`flex items-center justify-between rounded-xl border px-4 py-3.5 transition-all ${
                  s.status === "completed"
                    ? "border-lp-success-container bg-lp-success-container/30"
                    : isCurrent
                      ? "border-lp-accent-indigo/30 bg-lp-accent-indigo/[0.04] hover:-translate-y-0.5 hover:shadow-md"
                      : "border-lp-border-hairline"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      s.status === "completed"
                        ? "bg-lp-success text-lp-surface-card"
                        : "bg-lp-surface-subtle text-lp-text-muted"
                    }`}
                  >
                    {s.status === "completed" ? <CheckCircle2 size={18} /> : <Icon size={17} />}
                  </span>
                  <span className="font-lp-body text-lp-body-sm font-medium text-lp-text-ink">
                    {SECTION_LABEL[s.section]}
                  </span>
                </div>
                {isCurrent && (
                  <button
                    className="rounded-full bg-lp-accent-indigo px-3.5 py-1.5 font-lp-mono text-lp-label-sm font-semibold text-lp-surface-card shadow-sm transition-transform hover:scale-105"
                    onClick={() => enterSection(s.section, progress)}
                  >
                    {s.status === "in_progress" ? "Continue" : "Start"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BrandBackdrop>
  );
}

function TargetRoleForm({ onSubmit }: { onSubmit: (role: string) => void }) {
  const [role, setRole] = useState("");
  return (
    <div className={CARD}>
      <h1 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Career Interests</h1>
      <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-muted">
        Which career role do you want to pursue after graduation? We&apos;ll generate 25 questions
        calibrated to it.
      </p>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="e.g. Data Analyst, Software Engineer"
        className="mt-4 w-full rounded-lg border border-lp-border-hairline bg-lp-surface-card px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
      />
      <button
        className={`${BUTTON_PRIMARY} mt-5 w-full`}
        disabled={role.trim().length < 2}
        onClick={() => onSubmit(role.trim())}
      >
        Continue
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

const CODE_FENCE = /```[a-zA-Z]*\n([\s\S]*?)```/;

// Some question_bank content (e.g. programming_fundamentals) embeds a
// fenced code snippet in the question text — render it in a <pre> so
// whitespace/newlines survive instead of collapsing in a plain <p>.
function QuestionText({ text }: { text: string }) {
  const match = text.match(CODE_FENCE);
  if (!match || match.index === undefined) {
    return (
      <p className="font-lp-body text-lp-body-lg font-medium leading-relaxed text-lp-text-ink">{text}</p>
    );
  }
  const before = text.slice(0, match.index).trim();
  const after = text.slice(match.index + match[0].length).trim();
  return (
    <>
      {before && (
        <p className="font-lp-body text-lp-body-lg font-medium leading-relaxed text-lp-text-ink">{before}</p>
      )}
      <pre className="mt-3 overflow-x-auto rounded-lg border border-lp-border-hairline bg-lp-text-ink px-5 py-4 font-lp-mono text-lp-body-sm leading-relaxed text-lp-surface-card">
        <code>{match[1]}</code>
      </pre>
      {after && (
        <p className="mt-3 font-lp-body text-lp-body-lg font-medium leading-relaxed text-lp-text-ink">{after}</p>
      )}
    </>
  );
}

type OptionState = "correct" | "wrong-selected" | "pending-selected" | "dimmed" | "neutral";

function optionState(optionKey: string, q: SectionQuestion): OptionState {
  if (!q.answeredOption) return "neutral";
  if (!q.correctOption) return optionKey === q.answeredOption ? "pending-selected" : "dimmed";
  if (optionKey === q.correctOption) return "correct";
  if (optionKey === q.answeredOption) return "wrong-selected";
  return "dimmed";
}

const OPTION_CLASSES: Record<OptionState, string> = {
  correct: "border-lp-success bg-lp-success-container text-lp-on-success-container font-semibold",
  "wrong-selected": "border-lp-error bg-lp-error-container text-lp-on-error-container font-semibold",
  "pending-selected": "border-lp-accent-indigo bg-lp-accent-indigo/10 font-semibold text-lp-text-ink",
  dimmed: "border-lp-border-hairline text-lp-text-muted opacity-50",
  neutral:
    "border-lp-border-hairline text-lp-text-ink hover:border-lp-border-strong hover:bg-lp-surface-subtle hover:-translate-y-0.5",
};
const BADGE_CLASSES: Record<OptionState, string> = {
  correct: "bg-lp-success text-lp-surface-card",
  "wrong-selected": "bg-lp-error text-lp-surface-card",
  "pending-selected": "bg-lp-accent-indigo text-lp-surface-card",
  dimmed: "bg-lp-surface-subtle text-lp-text-muted",
  neutral: "bg-lp-surface-subtle text-lp-text-muted",
};

function SectionView({
  state,
  onAnswer,
  onSubmit,
  onExit,
}: {
  state: Extract<ViewState, { kind: "section" }>;
  onAnswer: (questionIndex: number, selectedOption: string) => void;
  onSubmit: () => void;
  onExit: () => void;
}) {
  const { section, questions } = state;
  const total = questions.length;
  const firstUnanswered = questions.findIndex((q) => !q.answeredOption);
  const [pos, setPos] = useState(() => (firstUnanswered === -1 ? 0 : firstUnanswered));
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);

  const q = questions[Math.min(pos, total - 1)];
  const isAnswered = q.answeredOption !== null;
  const isLast = pos === total - 1;

  function advance() {
    if (isLast) onSubmit();
    else setPos((p) => Math.min(total - 1, p + 1));
  }

  // Hard 45s-per-question timer: resets whenever the visible question
  // changes. On expiry it moves on regardless of whether the student
  // answered — an unanswered question just stays unanswered and the flow
  // keeps going (advance() submits instead of advancing past the last
  // question). Stops the moment the question is answered — see isAnswered.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance()/onSubmit closes over isLast/onSubmit, which don't need to restart the timer themselves
  }, [pos, total, isAnswered]);

  // Auto-advance shortly after a question is answered AND graded — the
  // brief window between answeredOption and correctOption both being set
  // is exactly the "selected -> green/red flash" the student sees before
  // moving on.
  useEffect(() => {
    if (!q.answeredOption || !q.correctOption) return;
    const timeout = setTimeout(advance, 900);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance() intentionally excluded, see above
  }, [q.answeredOption, q.correctOption]);

  const answeredCount = questions.filter((q) => q.answeredOption).length;
  const timeCritical = timeLeft <= 10;

  return (
    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-lp-border-hairline bg-lp-surface-card shadow-lg shadow-black/[0.04]">
      <div className="h-1 w-full bg-gradient-to-r from-lp-accent-indigo to-lp-accent-ochre" />
      <div className="border-b border-lp-border-hairline px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1.5 rounded-full border border-lp-border-hairline bg-lp-surface-subtle px-3 py-1.5 font-lp-body text-lp-label-sm font-medium text-lp-text-muted transition-colors hover:bg-lp-surface-container-high hover:text-lp-text-ink"
            >
              <X size={13} />
              Exit
            </button>
            <div>
              <p className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                Question {pos + 1} <span className="text-lp-text-muted">of {total}</span>
              </p>
              <p className="mt-0.5 font-lp-mono text-lp-label-sm font-semibold uppercase tracking-wide text-lp-accent-indigo">
                {SECTION_LABEL[section]}
              </p>
            </div>
          </div>
          {isAnswered ? (
            <div className="flex items-center gap-1.5 rounded-full border border-lp-success-container bg-lp-success-container/50 px-3.5 py-1.5 font-lp-mono text-lp-label-sm font-bold text-lp-on-success-container">
              <CheckCircle2 size={14} />
              Answered
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-lp-mono text-lp-label-sm font-bold transition-colors ${
                timeCritical
                  ? "border-lp-error-container bg-lp-error-container text-lp-error"
                  : "border-lp-border-hairline bg-lp-surface-subtle text-lp-text-muted"
              }`}
            >
              <Timer size={14} />
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </div>
          )}
        </div>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
          <div
            className="h-full rounded-full bg-lp-accent-indigo transition-[width] duration-300 ease-out"
            style={{ width: `${((pos + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Fixed height + internal scroll: a long question must never resize
          this box — the whole page would visibly jump between questions
          otherwise. Text wraps normally inside; overflow just scrolls. */}
      <div className="h-[440px] overflow-y-auto px-8 py-8">
        <QuestionText text={q.questionText} />
        <div className="mt-7 flex flex-col gap-3">
          {q.options.map((opt, i) => {
            const optState = optionState(opt.key, q);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onAnswer(q.index, opt.key)}
                disabled={isAnswered}
                className={`flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left font-lp-body text-lp-body-sm transition-all ${OPTION_CLASSES[optState]}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-lp-mono text-lp-label-sm font-bold ${BADGE_CLASSES[optState]}`}
                >
                  {OPTION_LABELS[i] ?? "?"}
                </span>
                {opt.text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Forward motion is automatic (answer -> flash -> next, or the 45s
          timer expires) — Previous is here only to review a question already
          behind you, not to change how the flow moves forward. */}
      <div className="flex items-center justify-between border-t border-lp-border-hairline px-8 py-5">
        <button
          type="button"
          onClick={() => setPos((p) => Math.max(0, p - 1))}
          disabled={pos === 0}
          className="flex items-center gap-1.5 rounded px-3 py-2 font-lp-body text-lp-body-sm font-medium text-lp-text-muted transition-colors hover:text-lp-text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={15} />
          Previous
        </button>
        <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">
          {answeredCount} of {total} answered
        </p>
        <span className="w-[71px]" aria-hidden="true" />
      </div>
    </div>
  );
}
