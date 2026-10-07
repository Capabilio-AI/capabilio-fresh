"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Check, Compass, GraduationCap, Lightbulb, Shuffle, type LucideIcon } from "lucide-react";
import { send } from "@/components/roadmap/v2/api";
import type { PlanBKind } from "@/lib/careers/plan-b-rules";

interface Career { id: string; name: string }
interface Option { kind: PlanBKind; title: string; icon: LucideIcon; span: string; needsMain?: boolean }

const OPTIONS: Option[] = [
  { kind: "same_role", title: "Continue with the same career role", icon: Briefcase, span: "sm:col-span-2", needsMain: true },
  { kind: "higher_studies", title: "Higher studies", icon: GraduationCap, span: "sm:col-span-2" },
  { kind: "entrepreneur", title: "Entrepreneur", icon: Lightbulb, span: "sm:col-span-2" },
  { kind: "change_role", title: "Change career role", icon: Shuffle, span: "sm:col-span-3", needsMain: true },
  { kind: "undecided", title: "Not yet decided", icon: Compass, span: "sm:col-span-3" },
];

/** Where each answer leads next. "undecided" stays put. */
const NEXT_STEP: Record<PlanBKind, string | null> = {
  same_role: "/dashboard/roadmap",
  higher_studies: "/dashboard/skills",
  entrepreneur: "/entrepreneur",
  change_role: "/dashboard/roadmap?career=plan-b",
  undecided: null,
};

const PROMPTED_KEY = "capabilio:plan-b-prompted";

function describe(kind: PlanBKind, mainCareer: string | null): string {
  switch (kind) {
    case "same_role": return mainCareer ? `Stay on ${mainCareer}. Your roadmap and skill plan keep pointing at it.` : "Stay on your main career.";
    case "higher_studies": return "Prepare for a master's, an MBA or a research path.";
    case "entrepreneur": return "Build your own product or company, with startup resources.";
    case "change_role": return "Move to a different career and get a roadmap for it.";
    case "undecided": return "Keep your options open. You can decide any time during 3rd year, 1st semester.";
  }
}

/** The one-time Plan B question: a button that opens five option cards. The server enforces 3-1 and "asked once". */
export function PlanBDialog({ mainCareer, careers, triggerLabel = "Choose Plan B", triggerClassName, autoOpen = false }: { mainCareer: string | null; careers: Career[]; triggerLabel?: string; triggerClassName?: string; autoOpen?: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const groupId = useId();
  const [kind, setKind] = useState<PlanBKind | null>(null);
  const [careerId, setCareerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opens by itself once per browser session so a student in 3-1 sees the question without hunting for it.
  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (sessionStorage.getItem(PROMPTED_KEY)) return;
      sessionStorage.setItem(PROMPTED_KEY, "1");
    } catch {
      return;
    }
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [autoOpen]);

  const ready = kind !== null && (kind !== "change_role" || careerId !== "");
  const close = () => dialog.current?.close();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !kind) return;
    setBusy(true);
    setError(null);
    const r = await send("PUT", "/api/career-intent/plan-b", kind === "change_role" ? { kind, careerId } : { kind });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong. Please try again.");
    close();
    const next = NEXT_STEP[kind];
    if (next) router.push(next);
    else router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={triggerClassName ?? "min-h-10 rounded-lg bg-app-charcoal px-4 font-lp-body text-[13px] font-medium text-white transition-transform active:scale-[0.98]"}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${groupId}-title`}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(46rem,calc(100vw-2rem))] rounded-2xl border border-app-border bg-white p-0 text-app-charcoal shadow-xl backdrop:bg-black/40"
      >
        <form onSubmit={save} className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="overflow-y-auto px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
            <h2 id={`${groupId}-title`} className="font-lp-display text-[20px] font-semibold">What is your Plan B?</h2>
            <p className="mt-1 max-w-[60ch] font-lp-body text-[13px] text-app-muted">Pick the path you would take if your main plan changes. You choose once, and it shapes the guidance you see next.</p>

            <fieldset className="mt-5">
              <legend className="sr-only">Plan B options</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                {OPTIONS.map(({ kind: value, title, icon: Icon, span, needsMain }) => {
                  const locked = needsMain && !mainCareer;
                  return (
                    <label
                      key={value}
                      className={`group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-app-border bg-white p-4 transition-colors hover:border-app-charcoal/40 has-[:checked]:border-app-orange has-[:checked]:bg-app-orange-container/30 has-[:checked]:ring-1 has-[:checked]:ring-app-orange has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-app-charcoal has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 has-[:disabled]:hover:border-app-border ${span}`}
                    >
                      <input type="radio" name={groupId} value={value} checked={kind === value} disabled={locked} onChange={() => setKind(value)} className="peer sr-only" />
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-background text-app-charcoal transition-colors group-has-[:checked]:bg-app-orange-container group-has-[:checked]:text-app-orange">
                          <Icon size={18} aria-hidden />
                        </span>
                        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-app-border text-white transition-colors group-has-[:checked]:border-app-orange group-has-[:checked]:bg-app-orange">
                          <Check size={12} strokeWidth={3} className="opacity-0 group-has-[:checked]:opacity-100" />
                        </span>
                      </span>
                      <span>
                        <span className="block font-lp-body text-[14px] font-semibold leading-snug">{title}</span>
                        <span className="mt-1 block font-lp-body text-[12.5px] leading-relaxed text-app-muted">{locked ? "Choose your main career first." : describe(value, mainCareer)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {kind === "change_role" && (
              <div className="mt-4 rounded-xl border border-app-border bg-app-background p-4">
                <label htmlFor={`${groupId}-career`} className="block font-lp-body text-[13px] font-medium">Which career would you move to?</label>
                <select id={`${groupId}-career`} value={careerId} onChange={(e) => setCareerId(e.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-app-border bg-white px-3 font-lp-body text-[13px] sm:max-w-sm">
                  <option value="">Select a career</option>
                  {careers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border px-5 py-4 sm:px-7">
            <p role="status" aria-live="polite" className="min-h-5 font-lp-body text-[12.5px] text-app-rose">{error}</p>
            <div className="flex gap-2">
              <button type="button" onClick={close} className="min-h-10 rounded-lg border border-app-border bg-white px-4 font-lp-body text-[13px] font-medium">Cancel</button>
              <button type="submit" disabled={!ready || busy} className="min-h-10 rounded-lg bg-app-charcoal px-4 font-lp-body text-[13px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50">{busy ? "Saving" : "Save Plan B"}</button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
