"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, X } from "lucide-react";

type InterviewMode = "practice" | "technical" | "behavioral" | "hr";

interface InterviewResult {
  overallScore: number;
  skillScores: Record<string, number>;
  strengths: string[];
  improvements: string[];
}

type Phase = "starting" | "answering" | "scoring" | "done" | "error";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("request failed");
  return res.json();
}

/** A live AI interview round — the real flow behind the "Start practice session" button. */
export function InterviewSession({ mode, onClose }: { mode: InterviewMode; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<InterviewResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    postJson<{ sessionId: string; questions: string[] }>("/api/interview/start", { mode })
      .then((data) => {
        if (cancelled) return;
        setSessionId(data.sessionId);
        setQuestions(data.questions);
        setAnswers(Array(data.questions.length).fill(""));
        setPhase("answering");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start a session once per mount, not on every `mode` identity check
  }, []);

  async function handleNext() {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      return;
    }
    setPhase("scoring");
    try {
      const data = await postJson<InterviewResult>(`/api/interview/${sessionId}/finish`, { answers });
      setResult(data);
      setPhase("done");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "starting") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--m-rule)] bg-white p-6 font-lp-body text-[13px] text-app-muted">
        <Loader2 size={16} className="animate-spin" />
        Preparing your interview…
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-[var(--m-rule)] bg-white p-6">
        <p className="font-lp-body text-[13px] text-app-rose">Something went wrong. Try again.</p>
        <button type="button" onClick={onClose} className="rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white">
          Close
        </button>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="rounded-xl border border-[var(--m-rule)] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-app-success" />
            <p className="font-lp-body text-[15px] font-semibold text-[var(--m-ink)]">Session complete — {result.overallScore}/100</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-app-muted hover:bg-app-background">
            <X size={16} />
          </button>
        </div>

        {Object.keys(result.skillScores).length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(result.skillScores).map(([skill, score]) => (
              <div key={skill} className="rounded-lg bg-app-background px-3 py-2">
                <p className="font-lp-mono text-[10.5px] text-app-muted">{skill}</p>
                <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{score}/100</p>
              </div>
            ))}
          </div>
        )}

        {result.strengths.length > 0 && (
          <div className="mt-4">
            <p className="font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">Strengths</p>
            <ul className="mt-1 flex flex-col gap-1">
              {result.strengths.map((s, i) => (
                <li key={i} className="font-lp-body text-[13px] text-[var(--m-ink)]">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.improvements.length > 0 && (
          <div className="mt-4">
            <p className="font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">To improve</p>
            <ul className="mt-1 flex flex-col gap-1">
              {result.improvements.map((s, i) => (
                <li key={i} className="font-lp-body text-[13px] text-[var(--m-ink)]">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--m-rule)] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="font-lp-mono text-[11px] text-app-muted">
          Question {index + 1} of {questions.length}
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-app-muted hover:bg-app-background">
          <X size={16} />
        </button>
      </div>
      <p className="mt-2 font-lp-body text-[15px] font-semibold text-[var(--m-ink)]">{questions[index]}</p>
      <textarea
        value={answers[index] ?? ""}
        onChange={(e) => setAnswers((a) => a.map((x, i) => (i === index ? e.target.value : x)))}
        rows={5}
        placeholder="Type your answer…"
        disabled={phase === "scoring"}
        className="mt-3 w-full rounded-lg border border-[var(--m-rule)] p-3 font-lp-body text-[13.5px] text-[var(--m-ink)] disabled:opacity-60"
      />
      <button
        type="button"
        onClick={handleNext}
        disabled={phase === "scoring" || !answers[index]?.trim()}
        className="mt-3 flex items-center gap-1.5 rounded-lg bg-app-orange px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {phase === "scoring" ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Scoring…
          </>
        ) : index < questions.length - 1 ? (
          <>
            Next <ArrowRight size={14} />
          </>
        ) : (
          "Finish session"
        )}
      </button>
    </div>
  );
}
