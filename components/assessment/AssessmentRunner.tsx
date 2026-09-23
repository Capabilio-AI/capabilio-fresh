"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

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

  async function answerQuestion(
    section: SectionKey,
    questionIndex: number,
    selectedOption: string,
    progress: AttemptProgress,
    questions: SectionQuestion[]
  ) {
    await fetch(`/api/assessment/${section}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIndex, selectedOption }),
    });
    const updated = questions.map((q) => (q.index === questionIndex ? { ...q, answeredOption: selectedOption } : q));
    setState({ kind: "section", progress, section, questions: updated });
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
    const { progress, section, questions } = state;
    const answeredCount = questions.filter((q) => q.answeredOption).length;
    const allAnswered = questions.length > 0 && answeredCount === questions.length;
    return (
      <Shell>
        <div className={CARD}>
          <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">
            {SECTION_LABEL[section]} — {answeredCount} of {questions.length} answered
          </p>
          <div className="mt-6 flex flex-col gap-6">
            {questions.map((q) => (
              <div key={q.index} className="border-b border-lp-border-hairline pb-6 last:border-0 last:pb-0">
                <p className="font-lp-body text-lp-body-sm font-medium text-lp-text-ink">
                  {q.index + 1}. {q.questionText}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {q.options.map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex cursor-pointer items-center gap-3 rounded border px-4 py-2.5 font-lp-body text-lp-body-sm transition-colors ${
                        q.answeredOption === opt.key
                          ? "border-lp-accent-indigo bg-lp-surface-subtle"
                          : "border-lp-border-hairline hover:bg-lp-surface-subtle"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.index}`}
                        checked={q.answeredOption === opt.key}
                        onChange={() => answerQuestion(section, q.index, opt.key, progress, questions)}
                        className="accent-[var(--lp-accent-indigo)]"
                      />
                      <span className="text-lp-text-ink">{opt.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            className={`${BUTTON_PRIMARY} mt-8 w-full`}
            disabled={!allAnswered}
            onClick={() => submitSection(section)}
          >
            Submit section
            <ArrowRight size={16} />
          </button>
        </div>
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-lp-surface px-4 py-16">
      {children}
    </main>
  );
}
