"use client";

import { useEffect, useState } from "react";
import { ARENA_CHANGED } from "@/lib/arena-workstations/refresh";
import { CheckCircle2, CircleX, Clock } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { EvidenceModal } from "@/components/portfolio/EvidenceModal";

interface Completion {
  id: string;
  ratingDelta: number;
  ratingAfter: number | null;
  completedAt: string;
  areaName: string;
  /** set on a ticket that closed without a pass: wrong final answer, or time ran out */
  outcome?: "wrong" | "timed_out";
  challenge: { title: string; company: string | null } | null;
}

/** Domain-only history: verified passes, and tickets that closed without one (wrong final answer, or time ran out), which show what they cost. */
export function DomainHistory() {
  const [completions, setCompletions] = useState<Completion[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/arena/domain/history", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => setCompletions(data.completions ?? []))
        .catch(() => setCompletions((prev) => prev ?? []));
    load();
    window.addEventListener(ARENA_CHANGED, load);
    return () => window.removeEventListener(ARENA_CHANGED, load);
  }, []);

  return (
    <div>
      <div className="text-center">
        <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Domain History</h2>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">Every work ticket you have closed, most recent first.</p>
      </div>

      {!completions ? (
        <div className="mt-10 flex justify-center">
          <ThinkingOrb state="searching" size={64} theme="light" />
        </div>
      ) : completions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[var(--m-rule)] bg-white px-6 py-16 text-center">
          <Clock size={28} className="mx-auto text-app-attention" />
          <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">No tickets closed yet — finish a Domain ticket to see it here.</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {completions.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-[var(--m-rule)] bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                {c.outcome ? <CircleX size={18} className="shrink-0 text-app-rose" /> : <CheckCircle2 size={18} className="shrink-0 text-app-success" />}
                <div>
                  <p className="font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)]">{c.challenge?.title ?? "Deleted ticket"}</p>
                  <p className="mt-0.5 font-lp-mono text-[11px] text-app-muted">
                    {[c.challenge?.company, c.areaName, c.outcome === "timed_out" ? "Time ran out" : c.outcome === "wrong" ? "Not solved" : null, new Date(c.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-app-background px-3 py-1 font-lp-mono text-[11px] font-semibold text-[var(--m-ink)]">{c.ratingDelta > 0 ? "+" : ""}{c.ratingDelta} ELO{c.ratingAfter !== null ? ` · ${c.ratingAfter}` : ""}</span>
                {!c.outcome && <button type="button" onClick={() => setOpenId(c.id)} className="font-lp-body text-[12.5px] font-bold text-app-orange hover:underline">View details</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {openId && <EvidenceModal fetchUrl={`/api/arena/attempts/${openId}`} onClose={() => setOpenId(null)} />}
    </div>
  );
}
