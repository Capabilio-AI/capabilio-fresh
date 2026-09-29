"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ImagePlus, Loader2, X } from "lucide-react";
import { ImageUploadButton } from "./ImageUploadButton";
import { initialsOf } from "@/lib/org/format";

/** "Start a post" — text, an optional photo, or an event. Publishes immediately or saves a draft. */
export function PostComposer({ orgName, logoUrl }: { orgName: string; logoUrl: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isEvent, setIsEvent] = useState(false);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"members" | "public">("members");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOpen(false);
    setIsEvent(false);
    setBody("");
    setImage(null);
    setStartsAt("");
    setLocation("");
    setLink("");
    setError(null);
  };

  async function submit(e: FormEvent, publish: boolean) {
    e.preventDefault();
    if (!body.trim()) return setError("Write something to post.");
    if (isEvent && !startsAt) return setError("Add when the event starts.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isEvent ? "event" : "announcement",
          body: body.trim(),
          ...(image ? { coverImageUrl: image } : {}),
          ...(isEvent ? { eventStartsAt: new Date(startsAt).toISOString(), ...(location.trim() ? { eventLocation: location.trim() } : {}), ...(link.trim() ? { eventLink: link.trim() } : {}) } : {}),
          isPublic: audience === "public",
          publish,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(json?.error ?? "Something went wrong.");
      reset();
      router.refresh();
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="o-card p-4" aria-label="Create a post">
      <div className="flex items-start gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="o-logo-tile h-11 w-11 shrink-0 rounded-xl text-[14px]" aria-hidden="true">
            {initialsOf(orgName)}
          </span>
        )}
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className="flex-1 rounded-full border border-app-border px-4 py-3 text-left text-[13.5px] text-app-muted hover:bg-white/[0.04]">
            Start a post
          </button>
        ) : (
          <form className="flex-1" onSubmit={(e) => submit(e, true)}>
            <label className="sr-only" htmlFor="composer-body">
              What do you want to share?
            </label>
            <textarea
              id="composer-body"
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder={isEvent ? "Describe the event…" : "What do you want to share with students?"}
              className="o-input min-h-[110px] resize-y"
            />
            {image && (
              <div className="relative mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- our own storage URL */}
                <img src={image} alt="Attached" className="max-h-64 w-full rounded-xl border border-app-border object-cover" />
                <button type="button" onClick={() => setImage(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white" aria-label="Remove photo">
                  <X size={14} />
                </button>
              </div>
            )}
            {isEvent && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="block text-[11.5px] font-bold text-app-muted">
                  Starts *
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="o-input mt-1.5" required />
                </label>
                <label className="block text-[11.5px] font-bold text-app-muted">
                  Where
                  <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} placeholder="Seminar Hall A" className="o-input mt-1.5" />
                </label>
                <label className="block text-[11.5px] font-bold text-app-muted md:col-span-2">
                  Event link
                  <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="o-input mt-1.5" />
                </label>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-[12.5px] text-app-rose">
                {error}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ImageUploadButton kind="post" label="Add a photo" onUploaded={setImage} className="o-btn-ghost !px-3">
                <ImagePlus size={15} aria-hidden="true" /> Photo
              </ImageUploadButton>
              <button type="button" onClick={() => setIsEvent((v) => !v)} className={`o-btn-ghost !px-3 ${isEvent ? "!border-app-orange/50 !text-app-orange" : ""}`} aria-pressed={isEvent}>
                <CalendarPlus size={15} aria-hidden="true" /> Event
              </button>
              <label className="ml-auto flex items-center gap-2 text-[12px] text-app-muted">
                Visible to
                <select value={audience} onChange={(e) => setAudience(e.target.value as "members" | "public")} className="o-input !w-auto !py-1.5">
                  <option value="members">Members only</option>
                  <option value="public">Anyone</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 border-t border-app-border pt-3">
              <button type="button" onClick={reset} className="o-btn-ghost" disabled={busy}>
                Cancel
              </button>
              <button type="button" onClick={(e) => submit(e, false)} className="o-btn-ghost" disabled={busy}>
                Save draft
              </button>
              <button type="submit" className="o-btn" disabled={busy}>
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Post
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
