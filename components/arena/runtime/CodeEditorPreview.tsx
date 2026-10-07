"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assertionsFrom, buildPreviewDocument } from "@/lib/arena-runtime/client/preview";
import { asRecord, type RuntimeProps } from "./types";

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Browser editor for front-end challenges: file list, editor, and a live preview. The preview is a sandboxed iframe (scripts allowed, no
 * same-origin), so student code cannot reach the app, its cookies or its APIs. DOM assertions run inside it and are reported back; those
 * results are self-attested, so the server never treats them as verified.
 */
export function CodeEditorPreview({ view, draft, onDraft, disabled }: RuntimeProps) {
  const starter = useMemo(() => asRecord<string>(view.assets?.files), [view.assets]);
  const files = useMemo(() => (Object.keys(asRecord(draft.files)).length ? asRecord<string>(draft.files) : starter), [draft.files, starter]);
  const names = Object.keys(files);
  const [active, setActive] = useState(names[0] ?? "index.html");
  const [srcDoc, setSrcDoc] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const draftRef = useRef(draft);
  const assertions = useMemo(() => assertionsFrom(view.checks), [view.checks]);
  const showPreview = view.workstation?.config.showPreview !== false;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const t = setTimeout(() => setSrcDoc(buildPreviewDocument(files, assertions)), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [files, assertions]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.source !== "arena-preview") return;
      const raw = asRecord<unknown>(e.data.results);
      const results = Object.fromEntries(Object.entries(raw).map(([id, ok]) => [id, ok === true]));
      onDraft({ ...draftRef.current, results });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onDraft]);

  const update = (value: string) => onDraft({ ...draft, files: { ...files, [active]: value } });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col">
        <div role="tablist" aria-label="Files" className="flex flex-wrap gap-1">
          {names.map((n) => (
            <button key={n} type="button" role="tab" aria-selected={n === active} onClick={() => setActive(n)} className={`rounded-t-md border border-b-0 px-3 py-1.5 font-lp-mono text-[12px] ${n === active ? "border-app-border bg-white font-semibold text-app-charcoal" : "border-transparent text-app-muted"}`}>
              {n}
            </button>
          ))}
        </div>
        <textarea
          aria-label={`Editing ${active}`}
          value={files[active] ?? ""}
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Tab" || e.shiftKey) return;
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: end } = el;
            update(el.value.slice(0, s) + "  " + el.value.slice(end));
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }}
          spellCheck={false}
          disabled={disabled}
          className="h-[420px] w-full rounded-b-lg rounded-tr-lg border border-app-border bg-white p-3 font-lp-mono text-[12.5px] leading-relaxed"
        />
      </div>
      {showPreview && (
        <div className="flex min-w-0 flex-col">
          <p className="py-1.5 font-lp-body text-[12px] font-semibold text-app-charcoal">Live preview</p>
          <iframe ref={frame} title="Live preview" sandbox="allow-scripts" srcDoc={srcDoc} className="h-[420px] w-full rounded-lg border border-app-border bg-white" />
        </div>
      )}
    </div>
  );
}
