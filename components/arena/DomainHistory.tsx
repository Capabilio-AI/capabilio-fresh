"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

interface Completion {
  id: string;
  ratingDelta: number;
  ratingAfter: number;
  completedAt: string;
  areaName: string;
  challenge: { title: string; company: string | null } | null;
}

/** Domain-only history — every row here is a verified pass (a failed submission never reaches arena_attempt_completions). */
export function DomainHistory() {
  const [completions, setCompletions] = useState<Completion[] | null>(null);

  useEffect(() => {
    fetch("/api/arena/domain/history")
      .then((res) => res.json())
      .then((data) => setCompletions(data.completions ?? []))
      .catch(() => setCompletions([]));
  }, []);

  return (
    <div>
      <div className="text-center">
        <h2 className="font-lp-display text-[22px] font-bold text-app-charcoal">Domain History</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Every verified work ticket, most recent first.</p>
      </div>

      {!completions ? (
        <div className="mt-10 flex justify-center">
          <ThinkingOrb state="searching" size={64} theme="light" />
        </div>
      ) : completions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-app-border bg-white px-6 py-16 text-center">
          <Clock size={28} className="mx-auto text-app-attention" />
          <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">No tickets completed yet — finish a Domain ticket to see it here.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {completions.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-app-border bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="shrink-0 text-app-success" />
                <div>
                  <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{c.challenge?.title ?? "Deleted ticket"}</p>
                  <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">
                    {[c.challenge?.company, c.areaName, new Date(c.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-app-background px-3 py-1 font-lp-mono text-[11px] font-semibold text-app-charcoal">+{c.ratingDelta} ELO · {c.ratingAfter}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
