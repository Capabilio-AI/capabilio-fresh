"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  /** replaces the default badge icon (a check for a normal action, a warning for a destructive one) */
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Native <dialog>: focus is trapped, Escape cancels, and it works with a keyboard and screen reader without extra code.
 * Painted on the workspace's champagne paper with the theme tokens (ink, muted, gold, rose), never a fixed dark colour:
 * the workspace is light, so a hard-coded dark panel made the ink-coloured title unreadable.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, confirmDisabled, icon, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      aria-labelledby={titleId}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-app-border bg-[#fff] p-0 text-app-charcoal shadow-[0_32px_80px_-24px_rgb(60_40_0/0.5)] backdrop:bg-[#1e1707]/45 backdrop:backdrop-blur-[3px]"
    >
      <div className="h-1" style={{ background: danger ? "var(--app-rose)" : "var(--o-gradient)" }} aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${danger ? "bg-app-rose-container text-app-rose" : "bg-app-orange-container text-app-orange"}`} aria-hidden="true">
            {icon ?? (danger ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />)}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="font-lp-display text-[18px] font-bold leading-snug">{title}</h2>
            <div className="mt-1.5 font-lp-body text-[13.5px] leading-relaxed text-app-muted">{children}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="o-btn-ghost justify-center" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={danger ? "inline-flex items-center justify-center gap-1.5 rounded-full bg-app-rose px-[18px] py-[9px] text-[13px] font-extrabold text-[#fff] hover:brightness-110 disabled:opacity-50" : "o-btn justify-center"}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
