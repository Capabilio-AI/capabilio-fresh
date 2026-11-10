"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lightbulb, Loader2, X } from "lucide-react";
import { Drawer } from "@/components/metro/Drawer";
import { MODULE_LABEL, type CrtModule } from "@/lib/crt/model";
import type { Block } from "@/lib/crt/content/sessions";
import { crtPost } from "./api";

interface Loaded {
  session: { id: string; module: CrtModule; title: string; minutes: number; content: Block[]; done: boolean };
}

function Practice({ block }: { block: Extract<Block, { type: "practice" }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <fieldset className="rounded-xl border border-app-border bg-white p-4">
      <legend className="px-1 font-lp-body text-[11px] font-bold uppercase tracking-wide text-app-muted">Try it</legend>
      <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{block.prompt}</p>
      <div className="mt-3 flex flex-col gap-2">
        {block.options.map((o, i) => {
          const chosen = picked === i;
          const right = picked !== null && i === block.answer;
          return (
            <button
              key={o}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(i)}
              className={`rounded-lg border px-3 py-2 text-left font-lp-body text-[13.5px] transition-colors motion-reduce:transition-none ${right ? "border-app-success bg-app-success/10 text-app-charcoal" : chosen ? "border-app-orange bg-app-orange/10 text-app-charcoal" : "border-app-border bg-white text-app-charcoal hover:bg-[var(--m-accent-soft)]"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p role="status" className="mt-3 font-lp-body text-[13px] text-app-muted">
          <strong className="text-app-charcoal">{picked === block.answer ? "Correct. " : "Not quite. "}</strong>
          {block.why}
        </p>
      )}
    </fieldset>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return <p className="font-lp-body text-[14.5px] leading-relaxed text-app-charcoal">{block.body}</p>;
    case "example":
      return (
        <div className="rounded-xl bg-[var(--m-accent-soft)] p-4">
          <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{block.title}</p>
          <p className="mt-1 font-lp-body text-[14px] leading-relaxed text-[var(--m-ink)]">{block.body}</p>
        </div>
      );
    case "tip":
      return (
        <p className="flex gap-2 rounded-xl border border-app-border bg-white p-4 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">
          <Lightbulb size={16} aria-hidden className="mt-0.5 shrink-0 text-app-orange" />
          <span>{block.body}</span>
        </p>
      );
    case "practice":
      return <Practice block={block} />;
  }
}

/** A training session in a side panel: read the lesson, try the practice questions, mark it done. */
export function SessionDrawer({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<Loaded["session"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    crtPost<Loaded>({ action: "session", sessionId })
      .then((r) => live && setData(r.session))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [sessionId]);

  async function markDone() {
    setBusy(true);
    try {
      await crtPost({ action: "complete", sessionId });
      setData((d) => (d ? { ...d, done: true } : d));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your progress.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer onClose={onClose} label={data?.title ?? "Training session"}>
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-app-border p-5">
          <div className="min-w-0">
            <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">{data ? `${MODULE_LABEL[data.module]} · ${data.minutes} min` : "Training session"}</p>
            <h2 className="mt-1 font-lp-display text-[22px] font-bold leading-tight text-app-charcoal">{data?.title ?? "Loading…"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close session" className="rounded-lg p-2 text-app-muted hover:bg-[var(--m-accent-soft)]">
            <X size={18} />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-lg border border-app-orange/40 bg-app-orange/10 p-3 font-lp-body text-[13px] text-app-charcoal">{error}</p>}
          {!data && !error && <Loader2 aria-label="Loading" className="animate-spin text-app-muted" />}
          {data?.content.map((b, i) => <BlockView key={i} block={b} />)}
        </div>
        {data && (
          <footer className="border-t border-app-border p-4">
            {data.done ? (
              <p className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold text-app-success"><CheckCircle2 size={16} aria-hidden /> You have completed this session.</p>
            ) : (
              <button type="button" onClick={markDone} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-60">
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Mark as done
              </button>
            )}
          </footer>
        )}
      </div>
    </Drawer>
  );
}
