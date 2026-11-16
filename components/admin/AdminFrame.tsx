"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import clsx from "clsx";

const KEY = "capabilio-admin-sidebar";

/** The console's frame: sidebar and page. The sidebar can be folded away so tables and charts get the full width; the choice is remembered on this device. */
export function AdminFrame({ sidebar, header, children }: { sidebar: ReactNode; header: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { if (window.localStorage.getItem(KEY) === "closed") setOpen(false); } catch { /* storage blocked: it just starts open each time */ }
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try { window.localStorage.setItem(KEY, o ? "closed" : "open"); } catch { /* not remembered */ }
      return !o;
    });
  };
  return (
    <div className={clsx("min-h-screen bg-[var(--m-ground)] lg:grid", open ? "lg:grid-cols-[256px_minmax(0,1fr)]" : "lg:grid-cols-1")}>
      <div className={clsx(!open && "lg:hidden")}>{sidebar}</div>
      <div className="min-w-0">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--m-rule)] bg-[var(--m-ground)]/90 px-4 py-3 backdrop-blur sm:px-8">
          <button type="button" onClick={toggle} aria-label={open ? "Hide the sidebar" : "Show the sidebar"} aria-expanded={open} className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--m-rule)] bg-white text-[var(--m-ink)] transition-colors hover:border-[var(--m-ink)] lg:grid">
            {open ? <PanelLeftClose size={18} aria-hidden /> : <PanelLeftOpen size={18} aria-hidden />}
          </button>
          {header}
        </div>
        <main className={clsx("mx-auto px-4 py-8 sm:px-8", open ? "max-w-[1180px]" : "max-w-[1480px]")}>{children}</main>
      </div>
    </div>
  );
}
