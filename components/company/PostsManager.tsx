"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageUploadButton } from "@/components/org/ImageUploadButton";
import { POST_TYPE_LABEL } from "@/lib/company/present";

const INPUT = "w-full rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13px] text-[var(--m-ink)]";
const LABEL = "mb-1 block font-lp-body text-[12px] font-semibold text-[var(--m-ink)]";
const BTN = "rounded-full px-4 py-1.5 font-lp-body text-[12.5px] font-semibold disabled:opacity-50";
const TYPES = ["update", "hiring", "milestone", "event"] as const;

export interface ManagedPost {
  id: string;
  type: string;
  title: string;
  body: string;
  status: "draft" | "published";
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
  likeCount: number;
}

async function call(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.";
  } catch {
    return "Connection problem. Please try again.";
  }
}

/** Write and manage a company's posts. Publishing notifies followers (when the post is public); drafts stay private. */
export function PostsManager({ posts }: { posts: ManagedPost[] }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>("update");
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function create(publish: boolean) {
    const form = formRef.current;
    if (!form) return;
    const f = new FormData(form);
    const text = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    const body = String(f.get("body") ?? "").trim();
    const startsAt = text("eventStartsAt");
    if (!body) return setError("Write something to share.");
    if (type === "event" && !startsAt) return setError("Events need a start date and time.");
    setBusy(publish ? "publish" : "draft");
    setError(null);
    const err = await call("/api/org/posts", {
      type,
      title: text("title"),
      body,
      coverImageUrl: cover ?? undefined,
      eventStartsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      eventLocation: text("eventLocation"),
      eventLink: text("eventLink"),
      isPublic: f.get("isPublic") === "on",
      publish,
    });
    setBusy(null);
    if (err) return setError(err);
    form.reset();
    setCover(null);
    setType("update");
    router.refresh();
  }

  async function act(key: string, url: string, body: unknown) {
    setBusy(key);
    setError(null);
    const err = await call(url, body);
    setBusy(null);
    if (err) return setError(err);
    setEditing(null);
    setConfirmDelete(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-10">
      <form ref={formRef} onSubmit={(e: FormEvent) => e.preventDefault()} className="grid gap-4 rounded-2xl border border-[var(--m-rule)] bg-[#fff] p-5" aria-label="New post">
        <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">New post</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="type">Kind</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])} className={INPUT}>
              {TYPES.map((t) => <option key={t} value={t}>{POST_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div><label className={LABEL} htmlFor="title">Headline (optional)</label><input id="title" name="title" maxLength={200} className={INPUT} /></div>
        </div>
        <div><label className={LABEL} htmlFor="body">What do you want to share?</label><textarea id="body" name="body" rows={5} maxLength={5000} className={INPUT} /></div>
        {type === "event" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={LABEL} htmlFor="eventStartsAt">Starts</label><input id="eventStartsAt" name="eventStartsAt" type="datetime-local" className={INPUT} /></div>
            <div><label className={LABEL} htmlFor="eventLocation">Where</label><input id="eventLocation" name="eventLocation" maxLength={300} className={INPUT} /></div>
            <div><label className={LABEL} htmlFor="eventLink">Link</label><input id="eventLink" name="eventLink" type="url" placeholder="https://" className={INPUT} /></div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ImageUploadButton kind="post" label="Add a photo" onUploaded={setCover} className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] text-[var(--m-ink)]`}>{cover ? "Replace photo" : "Add a photo"}</ImageUploadButton>
          {cover && <><Image src={cover} alt="" width={64} height={64} className="h-12 w-12 rounded-lg object-cover" unoptimized /><button type="button" onClick={() => setCover(null)} className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)]`}>Remove</button></>}
        </div>
        <label className="flex items-start gap-2 font-lp-body text-[13px] text-[var(--m-ink)]">
          <input type="checkbox" name="isPublic" defaultChecked className="mt-0.5 h-4 w-4" />
          <span>Show on my public page and notify followers<span className="block text-[11.5px] text-app-muted">Untick to keep it private. Your page itself must also be public.</span></span>
        </label>
        {error && <p role="alert" className="font-lp-body text-[12.5px] text-app-rose">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy !== null} onClick={() => create(true)} className={`${BTN} bg-app-charcoal text-[#fff]`}>{busy === "publish" ? "Publishing…" : "Publish"}</button>
          <button type="button" disabled={busy !== null} onClick={() => create(false)} className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] text-[var(--m-ink)]`}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
        </div>
      </form>

      <section aria-label="Your posts">
        <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Your posts ({posts.length})</h2>
        {posts.length === 0 ? <p className="mt-3 font-lp-body text-[13px] text-app-muted">Nothing yet. Your first post shows on your public page and goes to your followers.</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {posts.map((p) => (
              <li key={p.id} className="rounded-2xl border border-[var(--m-rule)] bg-[#fff] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{p.title}</p>
                    <p className="font-lp-body text-[12px] text-app-muted">{POST_TYPE_LABEL[p.type] ?? "Update"} · {p.status === "published" ? `Published ${new Date(p.publishedAt ?? p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Draft"}{p.status === "published" && !p.isPublic ? " · Private" : ""} · {p.likeCount} likes</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy !== null} onClick={() => setEditing(editing === p.id ? null : p.id)} className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] text-[var(--m-ink)]`}>Edit</button>
                    <button type="button" disabled={busy !== null} onClick={() => act(p.id, "/api/org/posts/action", { postId: p.id, action: p.status === "published" ? "unpublish" : "publish" })} className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] text-[var(--m-ink)]`}>{p.status === "published" ? "Unpublish" : "Publish"}</button>
                    {confirmDelete === p.id ? (
                      <button type="button" disabled={busy !== null} onClick={() => act(p.id, "/api/org/posts/action", { postId: p.id, action: "delete" })} className={`${BTN} bg-app-rose text-[#fff]`}>Confirm delete</button>
                    ) : (
                      <button type="button" disabled={busy !== null} onClick={() => setConfirmDelete(p.id)} className={`${BTN} border border-[var(--m-soft)] bg-[var(--m-ground)] hover:bg-[var(--m-accent-soft)] text-app-rose`}>Delete</button>
                    )}
                  </div>
                </div>
                {editing === p.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); const body = String(new FormData(e.currentTarget).get("body") ?? "").trim(); if (body) act(`edit-${p.id}`, "/api/org/posts/edit", { postId: p.id, body }); }} className="mt-3 grid gap-2">
                    <label className="sr-only" htmlFor={`edit-${p.id}`}>Edit post text</label>
                    <textarea id={`edit-${p.id}`} name="body" defaultValue={p.body} rows={4} maxLength={5000} className={INPUT} />
                    <div><button type="submit" disabled={busy !== null} className={`${BTN} bg-app-charcoal text-[#fff]`}>Save changes</button></div>
                  </form>
                ) : <p className="mt-2 line-clamp-3 whitespace-pre-wrap font-lp-body text-[13px] text-app-muted">{p.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
