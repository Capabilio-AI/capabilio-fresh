"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Type, X } from "lucide-react";
import clsx from "clsx";
import { STORY_THEMES, themeBackground, themeInk } from "@/lib/pulse/themes";

const MAX = 280;

/** Share a 24-hour story: a coloured text card, or a photo with an optional caption. */
export function StoryComposer({ onClose, onShared }: { onClose: () => void; onShared: () => void }) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [theme, setTheme] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function share() {
    setBusy(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (mode === "text") body = { kind: "text", body: text.trim(), theme };
      else {
        if (!file) return setError("Choose a photo first.");
        const form = new FormData();
        form.set("file", file);
        form.set("purpose", "story");
        const up = await fetch("/api/pulse/media", { method: "POST", body: form });
        const upJson = (await up.json().catch(() => null)) as { path?: string; error?: string } | null;
        if (!up.ok || !upJson?.path) return setError(upJson?.error ?? "Couldn't upload the photo.");
        body = { kind: "image", imagePath: upJson.path, body: text.trim() || undefined };
      }
      const res = await fetch("/api/pulse/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(json?.error ?? "Couldn't share your story.");
      onShared();
      onClose();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const canShare = mode === "text" ? text.trim().length > 0 : Boolean(file);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Create a story">
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--m-rule)] px-4 py-3">
          <h2 className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">Your story</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-app-muted hover:bg-app-background"><X size={16} /></button>
        </div>
        <div className="flex gap-2 px-4 pt-3">
          {([["text", "Text", Type], ["image", "Photo", ImagePlus]] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key} className={clsx("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-lp-body text-[12.5px] font-medium", mode === key ? "bg-app-charcoal text-white" : "border border-[var(--m-rule)] text-app-muted hover:text-[var(--m-ink)]")}>
              <Icon size={13} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4">
          <div className="relative mx-auto flex aspect-[9/12] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl" style={{ background: mode === "text" ? themeBackground(theme) : "#111" }}>
            {mode === "text" ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX))}
                placeholder="What are you working on today?"
                aria-label="Story text"
                className="h-full w-full resize-none bg-transparent p-6 text-center font-lp-display text-[22px] font-bold leading-snug placeholder:opacity-60 focus:outline-none"
                style={{ color: themeInk(theme) }}
              />
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={preview} alt="Story preview" className="h-full w-full object-cover" />
            ) : (
              <button type="button" onClick={() => input.current?.click()} className="flex flex-col items-center gap-2 text-white/80 hover:text-white">
                <ImagePlus size={28} aria-hidden="true" />
                <span className="font-lp-body text-[13px]">Choose a photo</span>
              </button>
            )}
          </div>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Photo" onChange={(e) => pick(e.target.files?.[0] ?? null)} />

          {mode === "text" ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Background">
              {STORY_THEMES.map((_, i) => (
                <button key={i} type="button" role="radio" aria-checked={theme === i} aria-label={`Background ${i + 1}`} onClick={() => setTheme(i)} className={clsx("h-7 w-7 rounded-full border-2", theme === i ? "border-app-charcoal" : "border-white shadow ring-1 ring-app-border")} style={{ background: themeBackground(i) }} />
              ))}
            </div>
          ) : (
            <>
              {preview && <button type="button" onClick={() => input.current?.click()} className="mt-3 block w-full text-center font-lp-body text-[12px] text-app-blue hover:underline">Change photo</button>}
              <input value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} placeholder="Add a caption (optional)" aria-label="Caption" className="mt-3 w-full rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13px] focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20" />
            </>
          )}
          <p className="mt-3 text-center font-lp-body text-[11.5px] text-app-muted">Visible to your followers for 24 hours, then it disappears.</p>
          {error && <p role="alert" className="mt-2 text-center font-lp-body text-[12px] text-app-rose">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--m-rule)] px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 font-lp-body text-[13px] text-app-muted hover:bg-app-background">Cancel</button>
          <button type="button" onClick={share} disabled={busy || !canShare} className="flex items-center gap-2 rounded-lg bg-app-orange px-5 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Share story
          </button>
        </div>
      </div>
    </div>
  );
}
