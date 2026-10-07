"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { send } from "@/components/roadmap/v2/api";

interface Career { id: string; name: string }

/** Picks the student's main career. The list loads when the dialog opens; saving uses the student's own career-intent API. */
export function ChooseCareerDialog({ label = "Choose a career", triggerClassName }: { label?: string; triggerClassName?: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const groupId = useId();
  const [careers, setCareers] = useState<Career[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    dialog.current?.showModal();
    if (careers) return;
    try {
      const res = await fetch("/api/career-intent");
      const data = (await res.json()) as { careers?: Career[] };
      if (!res.ok || !data.careers) throw new Error();
      setCareers(data.careers);
    } catch {
      setError("Couldn't load the careers. Close this and try again.");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choice) return;
    setBusy(true);
    setError(null);
    const r = await send("PUT", "/api/career-intent", { primaryCareerId: choice, isExploring: false });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong. Please try again.");
    dialog.current?.close();
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={open} className={triggerClassName ?? "rounded-md bg-app-charcoal px-4 py-2 font-lp-body text-[13px] text-white transition-transform active:scale-[0.98]"}>{label}</button>
      <dialog
        ref={dialog}
        aria-labelledby={`${groupId}-title`}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-app-border bg-white p-0 text-left text-app-charcoal shadow-xl backdrop:bg-black/40"
      >
        <form onSubmit={save} className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="overflow-y-auto px-5 pb-2 pt-5 sm:px-7 sm:pt-6">
            <h2 id={`${groupId}-title`} className="font-lp-display text-[20px] font-semibold">Which career are you aiming for?</h2>
            <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your roadmap is built around it. You can change it later.</p>
            <fieldset className="mt-5">
              <legend className="sr-only">Careers</legend>
              {!careers && !error && <p className="font-lp-body text-[13px] text-app-muted">Loading careers</p>}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(careers ?? []).map((c) => (
                  <label key={c.id} className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-app-border bg-white px-4 py-3 font-lp-body text-[13.5px] font-medium transition-colors hover:border-app-charcoal/40 has-[:checked]:border-app-orange has-[:checked]:bg-app-orange-container/30 has-[:checked]:ring-1 has-[:checked]:ring-app-orange has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-app-charcoal">
                    <input type="radio" name={groupId} value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} className="sr-only" />
                    {c.name}
                    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-app-border text-white group-has-[:checked]:border-app-orange group-has-[:checked]:bg-app-orange">
                      <Check size={12} strokeWidth={3} className="opacity-0 group-has-[:checked]:opacity-100" />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border px-5 py-4 sm:px-7">
            <p role="status" aria-live="polite" className="min-h-5 font-lp-body text-[12.5px] text-app-rose">{error}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => dialog.current?.close()} className="min-h-10 rounded-lg border border-app-border bg-white px-4 font-lp-body text-[13px] font-medium">Cancel</button>
              <button type="submit" disabled={!choice || busy} className="min-h-10 rounded-lg bg-app-charcoal px-4 font-lp-body text-[13px] font-medium text-white disabled:opacity-50">{busy ? "Saving" : "Save career"}</button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
