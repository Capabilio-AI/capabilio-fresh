"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

type SectionKey =
  | "technical_fundamentals"
  | "aptitude_reasoning"
  | "communication"
  | "problem_solving"
  | "digital_ai_literacy"
  | "career_interests";

const SECTION_LABEL: Record<SectionKey, string> = {
  technical_fundamentals: "Technical Fundamentals",
  aptitude_reasoning: "Aptitude / Reasoning",
  communication: "Communication",
  problem_solving: "Problem-Solving",
  digital_ai_literacy: "Digital / AI Literacy",
  career_interests: "Career Interests",
};
const SECTION_ORDER: SectionKey[] = [
  "technical_fundamentals",
  "aptitude_reasoning",
  "communication",
  "problem_solving",
  "digital_ai_literacy",
  "career_interests",
];

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
}

const CARD = "w-full max-w-2xl rounded-xl border border-lp-border-hairline bg-lp-surface-card p-8 shadow-sm";
const BUTTON_PRIMARY =
  "flex items-center justify-center gap-2 rounded bg-lp-text-ink px-5 py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface disabled:cursor-not-allowed disabled:opacity-60";

type ViewState =
  | { kind: "loading" }
  | { kind: "overview"; progress: AttemptProgress }
  | { kind: "needs-target-role"; progress: AttemptProgress }
  | { kind: "generating-career-questions"; progress: AttemptProgress }
  | { kind: "section"; progress: AttemptProgress; section: SectionKey; questions: SectionQuestion[] }
  | { kind: "complete" }
  | { kind: "error"; message: string };

export function AssessmentRunner() {
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
    // Optimistic: the radio button must react instantly on click, not
    // after a round trip. The POST persists in the background; a failure
    // reverts just that one question rather than blocking the whole UI.
    const updated = questions.map((q) => (q.index === questionIndex ? { ...q, answeredOption: selectedOption } : q));
    setState({ kind: "section", progress, section, questions: updated });

    fetch(`/api/assessment/${section}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIndex, selectedOption }),
    }).then((res) => {
      if (res.ok) return;
      setState((prev) => {
        if (prev.kind !== "section" || prev.section !== section) return prev;
        const reverted = prev.questions.map((q) =>
          q.index === questionIndex ? { ...q, answeredOption: null } : q
        );
        return { ...prev, questions: reverted };
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
    await startOrLoad();
  }

  if (state.kind === "loading") {
    return (
      <Shell>
        <div className={`${CARD} flex flex-col items-center gap-3 py-16 text-center`}>
          <Loader2 size={22} className="animate-spin text-lp-accent-indigo" />
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">Loading…</p>
        </div>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div className={`${CARD} text-center`}>
          <p className="font-lp-body text-lp-body-sm text-lp-text-ink">{state.message}</p>
          <button className={`${BUTTON_PRIMARY} mt-5`} onClick={startOrLoad}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (state.kind === "complete") {
    return (
      <Shell>
        <div className={`${CARD} text-center`}>
          <CheckCircle2 size={28} className="mx-auto text-lp-accent-indigo" />
          <h1 className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
            Assessment complete
          </h1>
          <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-muted">
            Your capability profile and Guide Path are being generated. The full dashboard is coming soon.
          </p>
        </div>
      </Shell>
    );
  }

  if (state.kind === "needs-target-role") {
    return (
      <Shell>
        <TargetRoleForm
          onSubmit={(role) => submitTargetRole(role, state.progress)}
        />
      </Shell>
    );
  }

  if (state.kind === "generating-career-questions") {
    return (
      <Shell>
        <div className={`${CARD} flex flex-col items-center gap-3 py-16 text-center`}>
          <Loader2 size={22} className="animate-spin text-lp-accent-indigo" />
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
            Generating your Career Interests questions — this can take up to a minute.
          </p>
        </div>
      </Shell>
    );
  }

  if (state.kind === "section") {
    return (
      <Shell>
        <SectionView
          state={state}
          onAnswer={(questionIndex, selectedOption) =>
            answerQuestion(state.section, questionIndex, selectedOption, state.progress, state.questions)
          }
          onSubmit={() => submitSection(state.section)}
          onExit={startOrLoad}
        />
      </Shell>
    );
  }

  // overview
  const { progress } = state;
  return (
    <Shell>
      <div className={CARD}>
        <h1 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
          Your assessment
        </h1>
        <p className="mt-1.5 font-lp-body text-lp-body-sm text-lp-text-muted">
          {progress.completedCount} of {SECTION_ORDER.length} sections complete.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {progress.sections.map((s) => {
            const isCurrent = s.section === progress.currentSection;
            return (
              <div
                key={s.section}
                className="flex items-center justify-between rounded border border-lp-border-hairline px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  {s.status === "completed" ? (
                    <CheckCircle2 size={16} className="text-lp-accent-indigo" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border border-lp-border-strong" />
                  )}
                  <span className="font-lp-body text-lp-body-sm text-lp-text-ink">
                    {SECTION_LABEL[s.section]}
                  </span>
                </div>
                {isCurrent && (
                  <button
                    className="font-lp-mono text-lp-label-sm font-medium text-lp-accent-indigo hover:underline"
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
    </Shell>
  );
}

function TargetRoleForm({ onSubmit }: { onSubmit: (role: string) => void }) {
  const [role, setRole] = useState("");
  return (
    <div className={CARD}>
      <h1 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
        Career Interests
      </h1>
      <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-muted">
        Which career role do you want to pursue after graduation? We&apos;ll generate 25 questions
        calibrated to it.
      </p>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="e.g. Data Analyst, Software Engineer"
        className="mt-4 w-full rounded border border-lp-border-hairline bg-lp-surface-card px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
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

  const q = questions[Math.min(pos, total - 1)];
  const answeredCount = questions.filter((q) => q.answeredOption).length;
  const allAnswered = total > 0 && answeredCount === total;
  const isLast = pos === total - 1;

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-lp-border-hairline bg-lp-surface-card shadow-sm">
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
        </div>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
          <div
            className="h-full rounded-full bg-lp-accent-indigo transition-[width] duration-300 ease-out"
            style={{ width: `${((pos + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-8 py-8">
        <p className="font-lp-body text-lp-body-lg font-medium leading-relaxed text-lp-text-ink">
          {q.questionText}
        </p>
        <div className="mt-7 flex flex-col gap-3">
          {q.options.map((opt, i) => {
            const isSelected = q.answeredOption === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onAnswer(q.index, opt.key)}
                className={`flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left font-lp-body text-lp-body-sm transition-colors ${
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
        <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">{answeredCount} of {total} answered</p>
        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!allAnswered}
            className={`${BUTTON_PRIMARY} px-5 py-2.5`}
          >
            Submit section
            <ArrowRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPos((p) => Math.min(total - 1, p + 1))}
            className="flex items-center gap-1.5 rounded px-3 py-2 font-lp-body text-lp-body-sm font-medium text-lp-text-ink transition-colors hover:text-lp-accent-indigo"
          >
            Next
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-lp-surface px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: "url(/logo-mark.jpg)",
          backgroundRepeat: "repeat",
          backgroundSize: "140px 140px",
        }}
      />
      <div className="relative z-10 flex w-full items-center justify-center">{children}</div>
    </main>
  );
}
