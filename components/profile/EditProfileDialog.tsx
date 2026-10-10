"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateProfileDetails, type ProfileFormState } from "@/app/(app)/profile/actions";

export interface EditableProfile {
  fullName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
}

const INITIAL: ProfileFormState = { ok: false, message: null, fieldErrors: {} };
const INPUT = "mt-1 w-full rounded-lg border border-[var(--m-rule)]! bg-white px-3 py-2 font-lp-body text-[14px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--m-accent-ink)]";

function Field({ id, label, error, children, hint }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="font-lp-body text-[13px] font-bold text-[var(--m-ink)]">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 font-lp-body text-[12px] text-[var(--m-muted)]">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 font-lp-body text-[12px] text-[var(--m-accent-ink)]">{error}</p>}
    </div>
  );
}

export function EditProfileDialog({ profile }: { profile: EditableProfile }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [state, action, pending] = useActionState(updateProfileDetails, INITIAL);

  useEffect(() => {
    if (state.ok) {
      dialog.current?.close();
      router.refresh();
    }
  }, [state, router]);

  const err = state.fieldErrors;
  const f = (name: string) => `${uid}-${name}`;
  const aria = (name: string) => ({ "aria-invalid": err[name] ? true : undefined, "aria-describedby": err[name] ? `${f(name)}-err` : undefined });

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13px] font-bold text-white hover:opacity-90">
        <Pencil size={14} aria-hidden /> Edit profile
      </button>
      <dialog ref={dialog} aria-labelledby={`${uid}-title`} className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-[var(--m-rule)]! bg-white p-0 text-[var(--m-ink)] backdrop:bg-black/40">
        <form action={action} className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-[var(--m-rule)]! px-5 py-4">
            <h2 id={`${uid}-title`} className="font-lp-display text-[20px] font-bold">Edit profile</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded-md p-1 text-[var(--m-muted)] hover:bg-[var(--m-ground)]"><X size={18} aria-hidden /></button>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            <Field id={f("fullName")} label="Full name" error={err.fullName}>
              <input id={f("fullName")} name="fullName" defaultValue={profile.fullName} required maxLength={100} autoComplete="name" className={INPUT} {...aria("fullName")} />
            </Field>
            <Field id={f("headline")} label="Headline" error={err.headline} hint="One line, e.g. “Final-year CSE · aspiring data analyst”.">
              <input id={f("headline")} name="headline" defaultValue={profile.headline ?? ""} maxLength={120} className={INPUT} {...aria("headline")} />
            </Field>
            <Field id={f("location")} label="Location" error={err.location}>
              <input id={f("location")} name="location" defaultValue={profile.location ?? ""} maxLength={80} autoComplete="address-level2" placeholder="City, State" className={INPUT} {...aria("location")} />
            </Field>
            <Field id={f("bio")} label="About" error={err.bio} hint="Up to 600 characters: what you study, build and want next.">
              <textarea id={f("bio")} name="bio" defaultValue={profile.bio ?? ""} maxLength={600} rows={4} className={INPUT} {...aria("bio")} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--m-rule)]! px-5 py-3">
            <p role="status" className={`font-lp-body text-[12.5px] ${state.message && !state.ok ? "text-[var(--m-accent-ink)]" : "text-[var(--m-muted)]"}`}>{state.message}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => dialog.current?.close()} className="rounded-lg px-3.5 py-2 font-lp-body text-[13px] font-bold text-[var(--m-muted)] hover:bg-[var(--m-ground)]">Cancel</button>
              <button type="submit" disabled={pending} className="rounded-lg bg-[var(--m-accent)] px-4 py-2 font-lp-body text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
