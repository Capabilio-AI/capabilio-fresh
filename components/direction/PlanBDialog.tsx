"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, Check, Compass, GraduationCap, Lightbulb, Shuffle, X, Zap, type LucideIcon } from "lucide-react";
import { send } from "@/components/roadmap/v2/api";
import type { PlanBKind } from "@/lib/careers/plan-b-rules";
import { PlanBRouteMap } from "./PlanBRouteMap";
import "./plan-b.css";

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

/** Each route keeps its own colour so the tiles read as different places to go, not five identical rows. */
const TONE: Record<PlanBKind, string> = {
  same_role: "bg-app-orange-container text-app-orange",
  change_role: "bg-app-blue-container text-app-blue",
  higher_studies: "bg-app-purple-container text-app-purple",
  entrepreneur: "bg-app-success-container text-app-success",
  undecided: "bg-app-attention-container text-app-attention",
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

  const chosen = GROUPS.flatMap((g) => g.options).find((o) => o.kind === kind) ?? null;
  let tileIndex = 0;

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={triggerClassName ?? "min-h-10 rounded-lg bg-app-charcoal px-4 font-lp-body text-[13px] font-medium text-white transition-transform active:scale-[0.98]"}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${groupId}-title`}
        onClick={(e) => e.target === dialog.current && close()}
        className="pb-dialog m-auto w-[min(44rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.75rem] border border-app-border bg-app-card p-0 text-app-charcoal shadow-[0_40px_90px_-30px_rgb(18_14_24/0.6)]"
      >
        <form onSubmit={save} className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <div className="overflow-y-auto">
            <div className="relative bg-app-card px-5 pb-5 pt-6 sm:px-8">
              <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-app-muted transition-colors hover:bg-app-background hover:text-app-charcoal">
                <X size={18} aria-hidden />
              </button>
              <h2 id={`${groupId}-title`} className="max-w-[24ch] pr-8 font-lp-display text-[28px] font-semibold leading-[1.05] tracking-tight text-balance sm:text-[32px]">Where do you see yourself after your degree?</h2>
              <p className="mt-2.5 max-w-[56ch] font-lp-body text-[13.5px] leading-relaxed text-app-muted">Pick the path you would take if your main plan changes. There is no wrong answer, and it shapes the guidance you see next.</p>
              <div className="mt-4 [@media(max-height:760px)]:hidden"><PlanBRouteMap kind={kind} /></div>
            </div>

            <fieldset className="border-t border-app-border bg-app-background px-5 pb-6 pt-5 sm:px-8">
              <legend className="sr-only">Plan B options</legend>
              <div className="space-y-5">
                {GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 font-lp-body text-[12px] font-semibold text-app-muted">{group.label}</p>
                    <div className={group.options.length > 1 ? "grid gap-3 sm:grid-cols-2" : "grid"}>
                      {group.options.map(({ kind: value, title, icon: Icon, needsMain }) => {
                        const locked = needsMain && !mainCareer;
                        const slim = group.options.length === 1;
                        const i = tileIndex++;
                        return (
                          <div key={value} className={`pb-tile ${value === "change_role" && kind === "change_role" ? "sm:col-span-2" : ""}`} style={{ ["--i" as string]: i }}>
                            <label className={`group relative flex h-full cursor-pointer gap-3.5 rounded-2xl border border-app-border bg-app-card p-4 transition-[transform,box-shadow,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-app-charcoal/30 hover:shadow-[0_14px_30px_-18px_rgb(18_14_24/0.35)] has-[:checked]:translate-y-0 has-[:checked]:border-app-charcoal has-[:checked]:bg-app-charcoal has-[:checked]:text-white has-[:checked]:shadow-[0_18px_36px_-16px_rgb(18_14_24/0.6)] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-app-orange has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 has-[:disabled]:hover:translate-y-0 has-[:disabled]:hover:shadow-none ${slim ? "items-center" : "flex-col"}`}>
                              <input type="radio" name={groupId} value={value} checked={kind === value} disabled={locked} onChange={() => setKind(value)} className="sr-only" />
                              <span className="flex items-start justify-between gap-3">
                                <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${TONE[value]} group-has-[:checked]:bg-white/15 group-has-[:checked]:text-white`}>
                                  <Icon size={19} strokeWidth={1.9} />
                                </span>
                                {!slim && (
                                  <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-app-border transition-colors group-has-[:checked]:border-app-orange group-has-[:checked]:bg-app-orange">
                                    <Check size={12} strokeWidth={3.5} className="text-white opacity-0 transition-opacity duration-150 group-has-[:checked]:opacity-100" />
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-lp-display text-[17px] font-semibold leading-snug">{title}</span>
                                <span className="mt-1 block font-lp-body text-[13px] leading-relaxed text-app-muted group-has-[:checked]:text-white/75">{locked ? "Choose your main career first." : describe(value, mainCareer)}</span>
                                {!locked && !slim && (
                                  <span className="mt-3 inline-flex items-start gap-1.5 rounded-lg bg-app-background px-2.5 py-1.5 font-lp-body text-[12px] font-medium leading-snug text-app-charcoal/80 transition-colors group-has-[:checked]:bg-white/10 group-has-[:checked]:text-white/90">
                                    <Zap size={13} aria-hidden className="mt-px shrink-0 text-app-orange" />
                                    {EFFECT[value]}
                                  </span>
                                )}
                              </span>
                              {slim && (
                                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-app-border transition-colors group-has-[:checked]:border-app-orange group-has-[:checked]:bg-app-orange">
                                  <Check size={12} strokeWidth={3.5} className="text-white opacity-0 transition-opacity duration-150 group-has-[:checked]:opacity-100" />
                                </span>
                              )}
                            </label>
                            {value === "change_role" && kind === "change_role" && (
                              <div className="mt-2 rounded-2xl border border-app-border bg-app-background p-4">
                                <label htmlFor={`${groupId}-career`} className="block font-lp-body text-[13px] font-semibold">Which career would you move to?</label>
                                <select id={`${groupId}-career`} value={careerId} onChange={(e) => setCareerId(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-app-border bg-app-card px-3 font-lp-body text-[14px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-app-orange">
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border bg-app-card px-5 py-4 sm:px-8">
            <p role="status" aria-live="polite" className={`min-h-5 max-w-[32ch] font-lp-body text-[13px] leading-snug ${error ? "text-app-rose" : "text-app-muted"}`}>
              {error ?? (chosen ? <>Your pick: <span className="font-semibold text-app-charcoal">{chosen.title}</span></> : "Pick a route to continue.")}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={close} className="min-h-11 rounded-full border border-app-border bg-app-card px-5 font-lp-body text-[14px] font-medium transition-colors hover:bg-app-background">Cancel</button>
              <button type="submit" disabled={!ready || busy} className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-app-orange px-5 font-lp-body text-[14px] font-semibold text-white shadow-[0_12px_24px_-12px_rgb(255_87_1/0.8)] transition-[transform,filter] duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-45 disabled:shadow-none">
                {busy ? "Saving" : "Save Plan B"}
                {!busy && <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
