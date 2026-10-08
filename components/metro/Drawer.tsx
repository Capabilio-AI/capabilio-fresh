"use client";

import { useEffect } from "react";

/** A slide-in panel over the page: dims it, closes with Escape or a click outside. */
export function Drawer({ children, onClose, label = "Details" }: { children: React.ReactNode; onClose: () => void; label?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 cursor-default bg-[var(--m-ink)]/40 backdrop-blur-[2px]" />
      <div className="relative h-full w-full max-w-[560px] overflow-hidden bg-white shadow-2xl">{children}</div>
    </div>
  );
}
