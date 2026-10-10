"use client";

import { useRef, useState } from "react";
import { Play, X } from "lucide-react";
import type { ReelInput } from "@/lib/passport/reel";
import { ReelPlayer } from "./ReelPlayer";

/** A button that opens the proof reel in a modal. The player mounts only while open, so nothing renders or plays until asked. */
export function ReelDialog({ input }: { input: ReelInput }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => { setOpen(true); ref.current?.showModal(); };
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" onClick={show}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--m-ink)] px-4 py-3 font-lp-body text-[14px] font-bold text-white hover:opacity-90">
        <Play size={16} aria-hidden fill="currentColor" /> Play proof reel
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) close(); }} aria-label="Proof reel"
        className="m-auto w-[min(92vw,420px)] max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--m-ground)] p-4 backdrop:bg-black/70">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">Your proof reel</p>
          <button type="button" onClick={close} aria-label="Close" className="rounded-full p-1.5 text-[var(--m-ink)] hover:bg-[var(--m-soft)]"><X size={18} aria-hidden /></button>
        </div>
        {open && <ReelPlayer input={input} />}
      </dialog>
    </>
  );
}
