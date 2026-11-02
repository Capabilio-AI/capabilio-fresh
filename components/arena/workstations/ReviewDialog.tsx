"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { ReviewSection } from "@/lib/arena-workstations/review";

/**
 * The last look before the one final submission. It shows everything that will be graded, says what a submission means, and makes sending it a separate,
 * deliberate step from going back to edit.
 */
export function ReviewDialog({ sections, gain, loss, busy, onBack, onConfirm }: { sections: ReviewSection[]; gain: number; loss: number; busy: boolean; onBack: () => void; onConfirm: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    back.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onBack]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="review-h">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="border-b border-app-border px-6 py-4">
          <h2 id="review-h" className="font-lp-display text-[20px] font-bold text-app-charcoal">Review your answer</h2>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">
            This is exactly what will be graded. <span className="font-semibold text-app-charcoal">Once you submit it, it is final</span>: you cannot change it or try again. A correct answer earns up to +{gain} ELO after your interview. A wrong one lowers your ELO by how wrong it is, up to −{loss}. If the time runs out before you submit, the ticket closes unanswered and costs the full −{loss}.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sections.length === 0 ? (
            <p className="font-lp-body text-[13px] text-app-muted">You have not written anything to submit yet.</p>
          ) : (
            sections.map((s) => (
              <section key={s.title} className="mb-4 last:mb-0">
                <h3 className="font-lp-body text-[12px] font-semibold uppercase tracking-wide text-app-muted">{s.title}</h3>
                {s.kind === "code" ? (
                  <pre className="mt-1.5 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-app-background p-3 font-lp-mono text-[12.5px] text-app-charcoal">{s.lines.join("\n")}</pre>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1 font-lp-body text-[13.5px] text-app-charcoal">
                    {s.lines.map((l, i) => (
                      <li key={i} className="whitespace-pre-wrap">{l}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-app-border px-6 py-4">
          <button ref={back} type="button" onClick={onBack} disabled={busy} className="rounded-lg border border-app-border px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal disabled:opacity-50">Go back and edit</button>
          <button type="button" onClick={onConfirm} disabled={busy || sections.length === 0} className="flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
            Submit final answer
          </button>
        </div>
      </div>
    </div>
  );
}
