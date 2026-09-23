"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SidebarContent } from "@/components/shell/Sidebar";

export function MobileDrawer({
  open,
  onClose,
  year,
}: {
  open: boolean;
  onClose: () => void;
  year: string | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggeredByRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggeredByRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      triggeredByRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 w-[280px] max-w-[82vw] bg-app-charcoal shadow-2xl outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
        <SidebarContent year={year} onNavigate={onClose} />
      </div>
    </div>
  );
}
