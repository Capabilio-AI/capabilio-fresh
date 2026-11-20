"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Shuffle, X } from "lucide-react";
import { send } from "@/components/roadmap/v2/api";
import { RoleKeywordPicker, type PickedRole } from "@/components/direction/RoleKeywordPicker";
import { MIN_OTHER_DETAILS, ROLE_CHANGE_REASONS, type RoleChangeReason } from "@/lib/careers/role-change-rules";
import "@/components/direction/plan-b.css";

/** Where the student stands in their current role: what a change would leave behind. A figure is null when it does not exist yet. */
export interface Standing {
  roleName: string;
  elo: number | null;
  tier: string | null;
  proven: number | null;
  total: number | null;
  activity: number | null;
}
type Step = "standing" | "reason" | "role";

const BUTTON = "min-h-11 rounded-full px-5 font-lp-body text-[14px] font-semibold transition-[transform,filter,background-color] duration-200 active:scale-[0.98] disabled:opacity-45";
const PRIMARY = `${BUTTON} bg-app-orange text-white shadow-[0_12px_24px_-12px_rgb(255_87_1/0.8)] hover:brightness-105 disabled:shadow-none`;
const QUIET = `${BUTTON} border border-app-border bg-app-card hover:bg-app-background`;

/**
 * Dashboard only. A student who wants another main role first sees where they stand in the current one (closing the window keeps it), then gives
 * a reason, then names the new role in their own words. The server allows 3 changes in all and records each reason. Plan B has its own flow and is not counted.
 */
export function ChangeRoleDialog({ standing, currentRoleId, planBRoleId, left, limit }: { standing: Standing; currentRoleId: string; planBRoleId: string | null; left: number; limit: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<Step>("standing");
  const [reason, setReason] = useState<RoleChangeReason | null>(null);
  const [details, setDetails] = useState("");
  const [picked, setPicked] = useState<PickedRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setStep("standing"); setReason(null); setDetails(""); setPicked(null); setError(null); };
  const close = () => dialog.current?.close();
  const trimmed = details.trim();
  const reasonReady = reason !== null && (reason !== "other" || trimmed.length >= MIN_OTHER_DETAILS);
  const excluded: Record<string, string> = { [currentRoleId]: "This is your current role.", ...(planBRoleId ? { [planBRoleId]: "This is your Plan B role. Pick a different one." } : {}) };

  const submit = async () => {
    if (!reason || !picked) return;
    setBusy(true);
    setError(null);
    const r = await send("POST", "/api/career-intent/role-change", { careerId: picked.careerId, reason, details: trimmed || undefined, typed: picked.typed });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong. Please try again.");
    close();
    if (r.data?.assessNow) router.push("/assessment?retake=1");
    else router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-app-border bg-app-card px-3.5 font-lp-body text-[13px] font-semibold text-app-charcoal transition-colors hover:bg-app-background">
        <Shuffle size={14} aria-hidden /> Change role
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} onClose={reset} onClick={(e) => e.target === dialog.current && close()} className="pb-dialog m-auto w-[min(34rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.75rem] border border-app-border bg-app-card p-0 text-app-charcoal shadow-[0_40px_90px_-30px_rgb(18_14_24/0.6)]">
        <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <div className="overflow-y-auto px-5 pb-5 pt-6 sm:px-8">
            <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-app-muted transition-colors hover:bg-app-background hover:text-app-charcoal"><X size={18} aria-hidden /></button>
            <p className="font-lp-body text-[12px] font-semibold text-app-muted">Role change {step === "standing" ? "" : step === "reason" ? "· Step 1 of 2" : "· Step 2 of 2"}</p>

            {step === "standing" && (
              <>
                <h2 id={titleId} className="mt-1 pr-8 font-lp-display text-[26px] font-semibold leading-tight tracking-tight text-balance">You are here in {standing.roleName}</h2>
                <dl className="mt-4 grid grid-cols-3 gap-2.5">
                  <Stat label="Rating" value={standing.elo === null ? "Not rated yet" : String(standing.elo)} note={standing.tier} />
                  <Stat label="Skills proven" value={standing.proven === null || standing.total === null ? "None yet" : `${standing.proven} of ${standing.total}`} />
                  <Stat label="Rated activities" value={standing.activity === null ? "None yet" : String(standing.activity)} />
                </dl>
                <p className="mt-4 font-lp-body text-[13.5px] leading-relaxed text-app-muted">Everything you have learned and practised in {standing.roleName} stays saved. If you want to keep going with it, close this window and carry on. If you really want another role, you can change it, and we will assess you for the new one and rebuild your profile around it.</p>
                <p className="mt-3 rounded-xl bg-app-background px-3.5 py-2.5 font-lp-body text-[12.5px] text-app-charcoal/80">You have {left} of {limit} role changes left. Plan B does not use them.</p>
              </>
            )}

            {step === "reason" && (
              <>
                <h2 id={titleId} className="mt-1 pr-8 font-lp-display text-[26px] font-semibold leading-tight tracking-tight text-balance">Why do you want to change?</h2>
                <fieldset className="mt-4 grid gap-2">
                  <legend className="sr-only">Reason</legend>
                  {ROLE_CHANGE_REASONS.map((r) => (
                    <label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-app-border bg-app-card px-4 py-3 font-lp-body text-[14px] transition-colors hover:border-app-charcoal/40 has-[:checked]:border-app-orange has-[:checked]:bg-app-orange-container/30 has-[:checked]:ring-1 has-[:checked]:ring-app-orange has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-app-orange">
                      <input type="radio" name="role-change-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[var(--color-app-orange)]" />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <label htmlFor={`${titleId}-details`} className="mt-4 block font-lp-body text-[13px] font-semibold">{reason === "other" ? "Tell us why" : "Anything to add? (optional)"}</label>
                <textarea id={`${titleId}-details`} value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={400} className="mt-1.5 w-full rounded-xl border border-app-border bg-app-card px-3 py-2.5 font-lp-body text-[14px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-app-orange" />
              </>
            )}

            {step === "role" && (
              <>
                <h2 id={titleId} className="mt-1 pr-8 font-lp-display text-[26px] font-semibold leading-tight tracking-tight text-balance">Which role do you want now?</h2>
                <p className="mb-4 mt-2 font-lp-body text-[13.5px] leading-relaxed text-app-muted">Type it in your own words, the way you did at sign-up.</p>
                <RoleKeywordPicker picked={picked} onPick={setPicked} excluded={excluded} disabled={busy} />
                {picked && <p className="mt-4 rounded-xl bg-app-background px-3.5 py-2.5 font-lp-body text-[12.5px] text-app-charcoal/80">{standing.roleName} becomes {picked.name}. This uses 1 of your {left} remaining changes.</p>}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border bg-app-card px-5 py-4 sm:px-8">
            <p role="status" aria-live="polite" className="min-h-5 max-w-[26ch] font-lp-body text-[13px] leading-snug text-app-rose">{error}</p>
            <div className="flex gap-2">
              {step === "standing" && <><button type="button" onClick={close} className={PRIMARY}>Continue with {standing.roleName}</button><button type="button" onClick={() => setStep("reason")} className={QUIET}>I still want to change</button></>}
              {step === "reason" && <><button type="button" onClick={() => setStep("standing")} className={QUIET}>Back</button><button type="button" disabled={!reasonReady} onClick={() => setStep("role")} className={`${PRIMARY} inline-flex items-center gap-2`}>Next <ArrowRight size={16} aria-hidden /></button></>}
              {step === "role" && <><button type="button" onClick={() => setStep("reason")} disabled={busy} className={QUIET}>Back</button><button type="button" disabled={!picked || busy} onClick={submit} className={PRIMARY}>{busy ? "Changing" : "Change my role"}</button></>}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="rounded-xl bg-app-background px-3 py-3">
      <dt className="font-lp-body text-[11.5px] font-semibold text-app-muted">{label}</dt>
      <dd className="mt-1 font-lp-display text-[18px] font-semibold leading-tight">{value}</dd>
      {note && <dd className="font-lp-body text-[11.5px] text-app-muted">{note}</dd>}
    </div>
  );
}
