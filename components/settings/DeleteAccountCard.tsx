"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { deleteAccount, type DeleteAccountState } from "@/app/(app)/settings/actions";
import { DELETE_PHRASE, isDeleteConfirmed } from "@/lib/settings/deletion";
import { SettingsCard } from "./SettingsCard";
import { BTN_DANGER, BTN_QUIET, INPUT } from "./ui";

const INITIAL: DeleteAccountState = { status: "idle" };

/** Permanent deletion. Asks for the password and a typed phrase; the server re-checks both. */
export function DeleteAccountCard({ allowed }: { allowed: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(deleteAccount, INITIAL);

  return (
    <SettingsCard
      id="del-h"
      danger
      title="Delete account"
      description="Permanently removes your profile, assessments, Vault, roadmap and everything else tied to this account. This cannot be undone."
    >
      {!allowed ? (
        <p className="font-lp-body text-[13.5px] text-[var(--m-muted)]">Organisation accounts can&apos;t be deleted from here. Contact your platform administrator.</p>
      ) : !open ? (
        <button type="button" className={BTN_QUIET} onClick={() => setOpen(true)}>Delete my account…</button>
      ) : (
        <form action={action} className="flex max-w-md flex-col gap-4">
          <div>
            <label htmlFor="del-pw" className="mb-1.5 block font-lp-body text-[13px] font-bold text-[var(--m-ink)]">Your password</label>
            <input id="del-pw" name="password" type="password" autoComplete="current-password" required className={INPUT} />
          </div>
          <div>
            <label htmlFor="del-confirm" className="mb-1.5 block font-lp-body text-[13px] font-bold text-[var(--m-ink)]">
              Type <span className="font-lp-mono">{DELETE_PHRASE}</span> to confirm
            </label>
            <input id="del-confirm" name="confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
          </div>
          {state.status === "error" && <p role="alert" className="font-lp-body text-[13px] font-bold text-[#b42318]">{state.message}</p>}
          <div className="flex gap-2">
            <button type="submit" className={BTN_DANGER} disabled={pending || !isDeleteConfirmed(confirm)}>
              {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
              Delete everything
            </button>
            <button type="button" className={BTN_QUIET} onClick={() => { setOpen(false); setConfirm(""); }} disabled={pending}>Cancel</button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
