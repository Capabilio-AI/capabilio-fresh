"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

interface Completion {
  id: string;
  isCorrect: boolean;
  pointsEarned: number;
  completedAt: string;
  challenge: { id: string; title: string; category: string; difficulty: string } | null;
}

export function ChallengeHistory() {
  const [completions, setCompletions] = useState<Completion[] | null>(null);

  useEffect(() => {
    fetch("/api/arena/challenges/history")
      .then((res) => res.json())
      .then((data) => setCompletions(data.completions ?? []))
      .catch(() => setCompletions([]));
  }, []);

  return (
    <div>
      <div className="text-center">
        <h2 className="font-lp-display text-[22px] font-bold text-app-charcoal">Challenge History</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Every challenge you&apos;ve submitted, most recent first.</p>
      </div>

      {!completions ? (
        <div className="mt-10 flex justify-center">
          <Loader2 size={20} className="animate-spin text-app-muted" />
        </div>
      ) : completions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-app-border bg-white px-6 py-16 text-center">
          <Clock size={28} className="mx-auto text-app-attention" />
          <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">No submissions yet — solve a challenge to see it here.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {completions.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-app-border bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                {c.isCorrect ? <CheckCircle2 size={18} className="shrink-0 text-app-success" /> : <XCircle size={18} className="shrink-0 text-app-attention" />}
                <div>
                  <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{c.challenge?.title ?? "Deleted challenge"}</p>
                  <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">
                    {new Date(c.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              {c.isCorrect && <span className="rounded-full bg-app-background px-3 py-1 font-lp-mono text-[11px] font-semibold text-app-charcoal">+{c.pointsEarned} pts</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
