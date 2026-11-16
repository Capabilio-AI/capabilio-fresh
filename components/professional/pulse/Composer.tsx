"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Loader2, Send } from "lucide-react";
import { KINDS, KIND_LABEL, MAX_BODY, MAX_TITLE, validatePost, type PostKind } from "@/lib/professional/pulse";
import { ProAvatar } from "./ProAvatar";

const HINT: Record<PostKind, string> = {
  update: "What are you working on? Use #tags so people can find it.",
  project: "What are you building? Say what it does and what you learned.",
  resource: "What should other professionals read or use, and why?",
  ask: "What do you need help with? Be specific.",
  win: "What did you achieve? Say what changed and how.",
};

/** Write a post as an update, a project, a resource, a question or an achievement. The same checks run again on the server. */
export function Composer({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const id = useId();
  const router = useRouter();
  const [kind, setKind] = useState<PostKind>("update");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLink = link.trim() === "https://" ? "" : link; // the "Add a link" starter left untouched means no link
    const check = validatePost({ kind, title, body, link: cleanLink });
    if (!check.ok) return setError(check.error);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/professional/pulse/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, title, body, link: cleanLink }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That did not post. Try again.");
      setTitle("");
      setBody("");
      setLink("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not post. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
  return (
    <form onSubmit={submit} className="rounded-3xl border border-[var(--m-rule)] bg-white p-5" aria-label="Write a post">
      <div className="flex items-start gap-3">
        <ProAvatar name={name} url={avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <div role="radiogroup" aria-label="Kind of post" className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setError(null); }} className={clsx("rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-accent)]", kind === k ? "bg-[var(--m-ink)] text-white" : "bg-[var(--m-ground)] text-[var(--m-muted)] hover:text-[var(--m-ink)]")}>{KIND_LABEL[k]}</button>
            ))}
          </div>
          {kind !== "update" && (
            <div className="mt-3">
              <label htmlFor={`${id}-t`} className="sr-only">Title</label>
              <input id={`${id}-t`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_TITLE} placeholder="Title" className={field} />
            </div>
          )}
          <div className="mt-3">
            <label htmlFor={`${id}-b`} className="sr-only">Post</label>
            <textarea id={`${id}-b`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_BODY} rows={4} placeholder={HINT[kind]} className={clsx(field, "resize-y")} />
          </div>
          {(kind === "resource" || link) && (
            <div className="mt-3">
              <label htmlFor={`${id}-l`} className="sr-only">Link</label>
              <input id={`${id}-l`} type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={field} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[12.5px] text-[var(--m-muted)]">
              {kind !== "resource" && !link && <button type="button" onClick={() => setLink("https://")} className="font-bold text-[var(--m-accent-ink)] hover:underline">Add a link</button>}
              <span className="tabular-nums" aria-live="polite">{body.length}/{MAX_BODY}</span>
            </div>
            <button type="submit" disabled={busy || !body.trim()} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-[var(--m-accent-ink)] disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}Post
            </button>
          </div>
          <p role="alert" className="mt-2 min-h-[1.25rem] text-[13px] font-bold text-[var(--m-ink)]">{error}</p>
        </div>
      </div>
    </form>
  );
}
