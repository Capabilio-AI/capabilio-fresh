"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * A small code editor: line numbers, Tab to indent, Ctrl/Cmd+Enter to run. A plain textarea underneath, so it is light, works on phones and
 * keeps every browser's own text handling. Press Esc, then Tab, to leave it with the keyboard.
 */
export function CodeEditor({ value, onChange, onRun, label, minRows = 6, maxRows = 22 }: { value: string; onChange: (v: string) => void; onRun?: () => void; label: string; minRows?: number; maxRows?: number }) {
  const gutter = useRef<HTMLPreElement>(null);
  const escaped = useRef(false);
  const lines = value.split("\n").length;
  const rows = Math.min(maxRows, Math.max(minRows, lines + 1));

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") { escaped.current = true; return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); onRun?.(); return; }
    if (e.key === "Tab" && !e.shiftKey && !escaped.current) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = el;
      onChange(`${value.slice(0, a)}    ${value.slice(b)}`);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 4; });
      return;
    }
    escaped.current = false;
  }

  return (
    <div className="flex overflow-hidden rounded-lg bg-[var(--m-ink)] focus-within:ring-2 focus-within:ring-[var(--m-accent)]">
      <pre ref={gutter} aria-hidden className="m-0 select-none overflow-hidden bg-black/25 px-3 py-4 text-right font-lp-mono text-[13px] leading-[1.6] text-white/40">{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</pre>
      <textarea
        aria-label={label} value={value} rows={rows} wrap="off" spellCheck={false} autoCapitalize="off" autoCorrect="off"
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
        className="ss-scroll min-w-0 flex-1 resize-none overflow-auto bg-transparent px-3 py-4 font-lp-mono text-[13px] leading-[1.6] text-white outline-none"
      />
    </div>
  );
}
