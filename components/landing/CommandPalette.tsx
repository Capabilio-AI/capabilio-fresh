"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";

const ITEMS = [
  { label: "Why proof", kind: "Section", href: "#world" },
  { label: "The ecosystem", kind: "Section", href: "#ecosystem" },
  { label: "Capabilio OS apps", kind: "Section", href: "#platform" },
  { label: "Four paths", kind: "Section", href: "#paths" },
  { label: "Principles and the ledger", kind: "Section", href: "#principles" },
  { label: "Colleges, universities and companies", kind: "Section", href: "#institutions" },
  { label: "Get started", kind: "Go", href: "/get-started" },
  { label: "Student sign up", kind: "Go", href: "/signup" },
  { label: "Log in", kind: "Go", href: "/login" },
];

export const PALETTE_EVENT = "cap:palette";

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const list = useMemo(() => ITEMS.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())), [q]);

  useEffect(() => {
    const toggle = () => {
      setQ("");
      setSel(0);
      setOpen((o) => !o);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, toggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, toggle);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const run = (href: string) => {
    setOpen(false);
    if (href.startsWith("#")) document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    else router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-start justify-items-center bg-cap-ink/55 px-4 pt-[16vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="cap-win w-[min(34rem,100%)] overflow-hidden rounded-2xl bg-white text-cap-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-cap-line! px-4 py-3.5">
          <Search size={18} className="text-cap-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, list.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && list[sel]) run(list[sel].href);
            }}
            placeholder="Jump to a section or page"
            aria-controls="cap-palette-list"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-cap-muted"
          />
          <kbd className="rounded border border-cap-line! px-1.5 py-0.5 font-mono text-[11px] text-cap-muted">esc</kbd>
        </div>
        <ul id="cap-palette-list" role="listbox" className="max-h-[22rem] overflow-y-auto p-2">
          {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-cap-muted">Nothing matches that.</li>}
          {list.map((it, n) => (
            <li key={it.href + it.label} role="option" aria-selected={n === sel}>
              <button
                onClick={() => run(it.href)}
                onPointerEnter={() => setSel(n)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[15px] ${n === sel ? "bg-cap-mist" : ""}`}
              >
                <span className="font-medium">{it.label}</span>
                <span className="flex items-center gap-2 text-xs text-cap-muted">
                  {it.kind}
                  {n === sel && <CornerDownLeft size={13} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
