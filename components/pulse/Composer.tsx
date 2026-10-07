"use client";

import { useRef, useState } from "react";
import { Award, HelpCircle, ImagePlus, Loader2, Send, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import type { PostKind } from "@/lib/pulse/format";
import { Avatar, type AvatarPerson } from "./Avatar";

const KINDS = [
  { key: "post", label: "Post", icon: Send, hint: "Share an update, an idea or a win. Use #tags so people can find it." },
  { key: "project", label: "Project", icon: Sparkles, hint: "Show what you're building: what it does, the stack, what you learned." },
  { key: "question", label: "Question", icon: HelpCircle, hint: "Ask the network. Say what you tried and where you're stuck." },
  { key: "achievement", label: "Achievement", icon: Award, hint: "A certificate, a ranking, an offer. Add the proof to your Vault too." },
] as const;
const MAX = 3000;

export function Composer({ me, onPosted }: { me: AvatarPerson; onPosted: () => void }) {
  const [kind, setKind] = useState<PostKind>("post");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const active = KINDS.find((k) => k.key === kind) ?? KINDS[0];

  function pick(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let imagePath: string | undefined;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        form.set("purpose", "post");
        const up = await fetch("/api/pulse/media", { method: "POST", body: form });
        const upJson = (await up.json().catch(() => null)) as { path?: string; error?: string } | null;
        if (!up.ok || !upJson?.path) return setError(upJson?.error ?? "Couldn't upload the photo.");
        imagePath = upJson.path;
      }
      const res = await fetch("/api/pulse/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text.trim(), kind, imagePath }) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(json?.error ?? "Couldn't post.");
      setText("");
      pick(null);
      setKind("post");
      onPosted();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Create a post" className="rounded-2xl border border-app-border bg-white p-4">
      <div className="flex gap-3">
        <Avatar person={me} size="md" />
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            placeholder={active.hint}
            aria-label="Post text"
            rows={3}
            className="w-full resize-none rounded-xl bg-app-background px-4 py-3 font-lp-body text-[14px] text-app-charcoal placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-app-orange/25"
          />
          {preview && (
            <div className="relative mt-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={preview} alt="Attached photo" className="max-h-48 rounded-xl border border-app-border" />
              <button type="button" onClick={() => pick(null)} aria-label="Remove photo" className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white"><X size={13} /></button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {KINDS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setKind(key)} aria-pressed={kind === key} className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-lp-body text-[12px] font-medium transition-colors", kind === key ? "border-app-orange bg-app-orange-container text-app-orange" : "border-app-border text-app-muted hover:text-app-charcoal")}>
                <Icon size={12} aria-hidden="true" /> {label}
              </button>
            ))}
            <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded-full border border-app-border px-3 py-1.5 font-lp-body text-[12px] font-medium text-app-muted hover:text-app-charcoal"><ImagePlus size={12} aria-hidden="true" /> Photo</button>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Photo" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <span className="ml-auto font-lp-mono text-[10.5px] text-app-muted" aria-live="polite">{text.length}/{MAX}</span>
            <button type="button" onClick={submit} disabled={busy || text.trim().length === 0} className="flex items-center gap-2 rounded-full bg-app-charcoal px-5 py-2 font-lp-body text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />} Post
            </button>
          </div>
          {error && <p role="alert" className="mt-2 font-lp-body text-[12px] text-app-rose">{error}</p>}
        </div>
      </div>
    </section>
  );
}
