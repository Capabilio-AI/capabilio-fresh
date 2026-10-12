"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Check, Compass, GraduationCap, Lightbulb, Shuffle, type LucideIcon } from "lucide-react";
import { send } from "@/components/roadmap/v2/api";
import type { PlanBKind } from "@/lib/careers/plan-b-rules";

interface Career { id: string; name: string }
interface Option { kind: PlanBKind; title: string; icon: LucideIcon; needsMain?: boolean }

/** Two groups so the choice reads as a decision: keep working in tech, or take another route. "Not yet decided" is a quiet third. */
const GROUPS: { label: string; options: Option[] }[] = [
  {
    label: "Stay on the career track",
    options: [
      { kind: "same_role", title: "Continue with the same career role", icon: Briefcase, needsMain: true },
      { kind: "change_role", title: "Change career role", icon: Shuffle, needsMain: true },
    ],
  },
  {
    label: "Take another route",
    options: [
      { kind: "higher_studies", title: "Higher studies", icon: GraduationCap },
      { kind: "entrepreneur", title: "Entrepreneur", icon: Lightbulb },
    ],
  },
  { label: "Not sure yet", options: [{ kind: "undecided", title: "Not yet decided", icon: Compass }] },
];

/** Where each answer leads next. "undecided" stays put. */
const NEXT_STEP: Record<PlanBKind, string | null> = {
  same_role: "/dashboard/roadmap",
  higher_studies: "/dashboard/skills",
  entrepreneur: "/entrepreneur",
  change_role: "/dashboard/roadmap?career=plan-b",
  undecided: null,
};

/** What the answer changes in Arena, stated plainly. Only the two career answers unlock Domain tickets. */
const EFFECT: Record<PlanBKind, string> = {
  same_role: "Unlocks one Domain ticket at a time for your main role.",
  change_role: "Unlocks one Domain ticket at a time for the new role.",
  higher_studies: "Stream challenges continue. Opens your skills plan.",
  entrepreneur: "Stream challenges continue. Opens startup resources.",
  undecided: "Stream challenges continue. You can answer later.",
};

const PROMPTED_KEY = "capabilio:plan-b-prompted";

function describe(kind: PlanBKind, mainCareer: string | null): string {
  switch (kind) {
    case "same_role": return mainCareer ? `Stay on ${mainCareer}. Your roadmap and skill plan keep pointing at it.` : "Stay on your main career.";
    case "higher_studies": return "Prepare for a master's, an MBA or a research path.";
    case "entrepreneur": return "Build your own product or company, with startup resources.";
    case "change_role": return "Move to a different career and get a roadmap for it.";
    case "undecided": return "Keep your options open. You can decide any time from 3rd year onward.";
  }
}

/** The one-time Plan B question: a button that opens five option cards. The server enforces 3rd year onward and "asked once". */
export function PlanBDialog({ mainCareer, careers, triggerLabel = "Choose Plan B", triggerClassName, autoOpen = false }: { mainCareer: string | null; careers: Career[]; triggerLabel?: string; triggerClassName?: string; autoOpen?: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const groupId = useId();
  const [kind, setKind] = useState<PlanBKind | null>(null);
  const [careerId, setCareerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Opens by itself once per browser session so a 3rd-year student sees the question without hunting for it.
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
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-app-border bg-white p-0 text-app-charcoal shadow-xl backdrop:bg-black/40"
      >
        <form onSubmit={save} className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="overflow-y-auto px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
            <h2 id={`${groupId}-title`} className="font-lp-display text-[22px] font-semibold leading-tight text-balance">Where do you see yourself after your degree?</h2>
            <p className="mt-1.5 max-w-[56ch] font-lp-body text-[13px] leading-relaxed text-app-muted">Pick the path you would take if your main plan changes. There is no wrong answer, and it shapes the guidance you see next.</p>

            <fieldset className="mt-6">
              <legend className="sr-only">Plan B options</legend>
              <div className="space-y-6">
                {GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 font-lp-body text-[12px] font-semibold text-app-muted">{group.label}</p>
                    <div className="divide-y divide-app-border overflow-hidden rounded-xl border border-app-border">
                      {group.options.map(({ kind: value, title, icon: Icon, needsMain }) => {
                        const locked = needsMain && !mainCareer;
                        return (
                          <div key={value} className="bg-white has-[:checked]:bg-app-orange-container/25">
                            <label className="group flex cursor-pointer items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-app-background has-[:checked]:hover:bg-transparent has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-app-charcoal has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 has-[:disabled]:hover:bg-white">
                              <input type="radio" name={groupId} value={value} checked={kind === value} disabled={locked} onChange={() => setKind(value)} className="sr-only" />
                              <span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-app-border bg-white transition-colors group-has-[:checked]:border-app-orange group-has-[:checked]:bg-app-orange">
                                <Check size={11} strokeWidth={3.5} className="text-white opacity-0 transition-opacity duration-150 group-has-[:checked]:opacity-100" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 font-lp-body text-[14.5px] font-semibold leading-snug">
                                  <Icon size={15} aria-hidden className="shrink-0 text-app-muted transition-colors group-has-[:checked]:text-app-orange" />
                                  {title}
                                </span>
                                <span className="mt-1 block max-w-[58ch] font-lp-body text-[13px] leading-relaxed text-app-muted">{locked ? "Choose your main career first." : describe(value, mainCareer)}</span>
                                {!locked && <span className="mt-1.5 block font-lp-body text-[12px] font-medium text-app-charcoal/80">{EFFECT[value]}</span>}
                              </span>
                            </label>
                            {value === "change_role" && kind === "change_role" && (
                              <div className="px-4 pb-4 pl-[2.9rem]">
                                <label htmlFor={`${groupId}-career`} className="block font-lp-body text-[13px] font-medium">Which career would you move to?</label>
                                <select id={`${groupId}-career`} value={careerId} onChange={(e) => setCareerId(e.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-app-border bg-white px-3 font-lp-body text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-charcoal sm:max-w-sm">
                                  <option value="">Select a career</option>
                                  {careers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
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
