"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, Send } from "lucide-react";
import type { FileContent } from "@/lib/workplace/file-tasks/types";
import { buildPreviewDoc } from "@/lib/workplace/frontend/preview";
import { useDraft, type ToolProps } from "./useDraft";

/**
 * Edit the files and submit them. Nothing is executed: the server checks the text of each file against the requirements listed here. When the task has
 * a web page, a live preview of it is shown in a sandboxed frame so the learner can see what they are building (the preview is not graded).
 */
export function ConfigTool({ attemptId, content, closed, submitting, onSubmit, lastChecks }: ToolProps<FileContent>) {
  const [files, setFiles] = useDraft<Record<string, string>>(attemptId, "files", Object.fromEntries(content.files.map((f) => [f.name, f.content])));
  const [active, setActive] = useState(content.files[0]?.name ?? "");
  const text = files[active] ?? "";
  const status = new Map((lastChecks ?? []).map((c) => [c.label, c.passed]));
  const hasPage = content.files.some((f) => f.language === "html");
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!hasPage) return;
    const timer = setTimeout(() => setPreview(buildPreviewDoc(content.files.map((f) => ({ name: f.name, content: files[f.name] ?? f.content })))), 500);
    return () => clearTimeout(timer);
  }, [files, content.files, hasPage]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="shrink-0 lg:w-[300px]">
        <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Your files must meet these requirements</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {content.requirements.map((r) => {
            const known = status.get(r);
            return (
              <li key={r} className="flex items-start gap-2 font-lp-body text-[12.5px] text-app-charcoal">
                {known === true ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-app-green" aria-label="met" /> : <Circle size={14} className={`mt-0.5 shrink-0 ${known === false ? "text-app-rose" : "text-app-muted"}`} aria-label={known === false ? "not met" : "not checked yet"} />}
                <span>{r}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 font-lp-body text-[12px] text-app-muted">You have {content.maxSubmissions} tries. After each try, the requirements show what is still missing.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Files">
          {content.files.map((f) => (
            <button key={f.name} type="button" role="tab" aria-selected={active === f.name} onClick={() => setActive(f.name)} className={`rounded-lg border px-3 py-1.5 font-lp-mono text-[12px] ${active === f.name ? "border-app-charcoal bg-app-charcoal text-white" : "border-app-border bg-white text-app-charcoal"}`}>{f.name}</button>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]">
          <div className="border-b border-[#2a2a2a] px-4 py-2 font-lp-mono text-[11px] text-white/50">{active}</div>
          <textarea value={text} onChange={(e) => setFiles({ ...files, [active]: e.target.value })} spellCheck={false} wrap="off" aria-label={`Editor for ${active}`} disabled={closed} className="block h-[360px] w-full resize-y overflow-auto bg-transparent px-4 py-3 font-lp-mono text-[13px] leading-[1.6] text-[#e8e8e8] caret-app-orange outline-none disabled:opacity-60" />
        </div>
        {hasPage && (
          <section aria-label="Preview of your page" className="overflow-hidden rounded-xl border border-app-border bg-white">
            <div className="border-b border-app-border px-4 py-2 font-lp-mono text-[11px] text-app-muted">Preview (what your page looks like; it is not graded)</div>
            {/* no allow-same-origin: the page runs isolated from this app */}
            <iframe title="Preview of your page" sandbox="allow-scripts" srcDoc={preview} className="block h-[320px] w-full bg-white" />
          </section>
        )}
        {!closed && (
          <button type="button" disabled={submitting} onClick={() => onSubmit({ files: content.files.map((f) => ({ name: f.name, content: files[f.name] ?? "" })) })} className="flex w-fit items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Submit
          </button>
        )}
      </div>
    </div>
  );
}
