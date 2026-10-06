"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native <dialog>: focus is trapped, Escape cancels, and it works with a keyboard and screen reader without extra code. */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, confirmDisabled, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }} aria-labelledby="cd-title" className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-app-border bg-[#14120e] p-0 text-app-charcoal backdrop:bg-black/60">
      <div className="p-6">
        <h2 id="cd-title" className="font-lp-display text-[17px] font-semibold">{title}</h2>
        <div className="mt-2 font-lp-body text-[13px] leading-relaxed text-app-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="o-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={danger ? "o-btn-danger" : "o-btn"} onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
