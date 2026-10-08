"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { ImageUploadButton } from "./ImageUploadButton";
import { initialsOf } from "@/lib/org/format";
import { POST_KINDS, type PostKindId } from "./post-kinds";

/** The one place a college posts: pick what you're sharing, fill what that kind needs, post now or save a draft. */
export function PostComposer({ orgName, logoUrl }: { orgName: string; logoUrl: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kindId, setKindId] = useState<PostKindId>("announcement");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"members" | "public">("members");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = POST_KINDS.find((k) => k.id === kindId) ?? POST_KINDS[0];

  const reset = () => {
    setOpen(false);
    setKindId("announcement");
    setHeadline("");
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
    if (kind.dated && !startsAt) return setError("Add when it starts.");
    if (kind.needsImage && !image) return setError("A poster launch needs the poster image.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind.dated ? "event" : "announcement",
          category: kind.id,
          body: body.trim(),
          ...(kind.headline && headline.trim() ? { title: headline.trim() } : {}),
          ...(image ? { coverImageUrl: image } : {}),
          ...(kind.dated ? { eventStartsAt: new Date(startsAt).toISOString(), ...(location.trim() ? { eventLocation: location.trim() } : {}) } : {}),
          ...(link.trim() ? { eventLink: link.trim() } : {}),
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

  const avatar = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
    <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="o-logo-tile h-11 w-11 shrink-0 rounded-full text-[14px]" aria-hidden="true">
      {initialsOf(orgName)}
    </span>
  );

  return (
    <section className="o-card p-4" aria-label="Create a post">
      {!open ? (
        <div className="flex items-center gap-3">
          {avatar}
          <button type="button" onClick={() => setOpen(true)} className="flex-1 rounded-full border border-app-border px-4 py-3 text-left text-[13.5px] text-app-muted hover:bg-white/[0.04]">
            Share an update, event, poster or achievement…
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => submit(e, true)}>
          <div className="flex items-center gap-3">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-app-charcoal">{orgName}</p>
              <p className="text-[12px] text-app-muted">{kind.heading}</p>
            </div>
          </div>

          <div role="radiogroup" aria-label="What are you sharing?" className="mt-3 flex flex-wrap gap-1.5">
            {POST_KINDS.map((k) => {
              const Icon = k.icon;
              const on = k.id === kindId;
              return (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKindId(k.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${on ? `border-transparent ${k.chip}` : "border-app-border text-app-muted hover:bg-white/[0.05]"}`}
                >
                  <Icon size={13} aria-hidden="true" /> {k.label}
                </button>
              );
            })}
          </div>

          {kind.headline && (
            <label className="mt-3 block text-[11.5px] font-bold text-app-muted">
              Headline
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={200} placeholder={kind.id === "fest" ? "Techfest 2026" : kind.id === "poster" ? "Hackathon season is here" : "A short headline"} className="o-input mt-1.5" />
            </label>
          )}

          <label className="sr-only" htmlFor="composer-body">
            What do you want to share?
          </label>
          <textarea id="composer-body" autoFocus value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={5000} placeholder={kind.placeholder} className="o-input mt-3 min-h-[110px] resize-y" />

          {image && (
            <div className="relative mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own storage URL */}
              <img src={image} alt="Attached" className="max-h-72 w-full rounded-2xl border border-app-border object-cover" />
              <button type="button" onClick={() => setImage(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-[#fff]" aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          )}

          {kind.dated && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-[11.5px] font-bold text-app-muted">
                Starts *
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="o-input mt-1.5" required />
              </label>
              <label className="block text-[11.5px] font-bold text-app-muted">
                Where
                <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} placeholder="Seminar Hall A" className="o-input mt-1.5" />
              </label>
            </div>
          )}
          <label className="mt-3 block text-[11.5px] font-bold text-app-muted">
            {kind.linkLabel}
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="o-input mt-1.5" />
          </label>

          {error && (
            <p role="alert" className="mt-2 text-[12.5px] text-app-rose">
              {error}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ImageUploadButton kind="post" label={kind.needsImage ? "Add the poster" : "Add a photo"} onUploaded={setImage} className="o-btn-ghost !px-3">
              <ImagePlus size={15} aria-hidden="true" /> {kind.needsImage ? "Poster image" : "Photo"}
            </ImageUploadButton>
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
    </section>
  );
}
