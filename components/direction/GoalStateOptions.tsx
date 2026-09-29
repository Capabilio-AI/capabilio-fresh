"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { GoalState } from "@/lib/career/direction";
import { GOAL_OPTIONS } from "@/lib/career/goal-copy";

/** Four goal-state choices; saving goes through the server, which owns the value. Used by the prompt and the settings page. */
export function GoalStateOptions({ current, onSaved }: { current: GoalState | null; onSaved?: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState<GoalState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(goalState: GoalState) {
    setSaving(goalState);
    setError(null);
    const res = await fetch("/api/direction/goal-state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalState }),
    });
    setSaving(null);
    if (!res.ok) {
      setError("Could not save — try again.");
      return;
    }
    router.refresh();
    onSaved?.();
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Career direction">
        {GOAL_OPTIONS.map((o) => {
          const selected = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving !== null}
              onClick={() => choose(o.value)}
              className={clsx(
                "flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-colors disabled:opacity-70",
                selected ? "border-app-orange bg-app-orange-container" : "border-app-border bg-white hover:border-app-charcoal"
              )}
            >
              <span className="flex items-center justify-between font-lp-body text-[13.5px] font-semibold text-app-charcoal">
                {o.label}
                {saving === o.value ? <Loader2 size={14} className="animate-spin" /> : selected ? <Check size={14} className="text-app-orange" /> : null}
              </span>
              <span className="font-lp-body text-[12px] text-app-muted">{o.description}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 font-lp-body text-[12px] text-app-orange" role="alert">{error}</p>}
    </div>
  );
}
