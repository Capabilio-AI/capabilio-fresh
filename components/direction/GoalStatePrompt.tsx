"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoalStateOptions } from "./GoalStateOptions";
import type { GoalState } from "@/lib/career/direction";

export interface PromptReflection {
  roleLabel: string;
  verifiedCount: number;
}

/**
 * Reflection-first when — and only when — there is real Arena engagement
 * (verified attempt counts). Otherwise the plain variant: no engagement claim.
 */
export function GoalStatePrompt({ reflection, current }: { reflection: PromptReflection | null; current: GoalState | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  async function decideLater() {
    setOpen(false);
    await fetch("/api/direction/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "goal" }),
    });
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-charcoal/50 px-4" role="dialog" aria-modal="true" aria-labelledby="goal-prompt-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="goal-prompt-title" className="font-lp-display text-[19px] font-semibold text-app-charcoal">
          {reflection ? "Where are you headed after college?" : "What are you planning after college?"}
        </h2>
        {reflection && (
          <p className="mt-2 font-lp-body text-[13.5px] text-app-muted">
            You&apos;ve completed <strong className="text-app-charcoal">{reflection.verifiedCount} verified {reflection.roleLabel} {reflection.verifiedCount === 1 ? "task" : "tasks"}</strong> on
            Capabilio. Does that still feel right, or do you want to explore something else?
          </p>
        )}
        <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">You can change this any time in Settings.</p>
        <div className="mt-4">
          <GoalStateOptions current={current} />
        </div>
        <button type="button" onClick={decideLater} className="mt-4 font-lp-mono text-[11.5px] text-app-muted underline-offset-2 hover:underline">
          Decide later
        </button>
      </div>
    </div>
  );
}
