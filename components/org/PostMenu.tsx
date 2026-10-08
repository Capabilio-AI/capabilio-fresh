"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

type Status = "draft" | "published";

/** Edit / publish / delete for a post the viewer manages. Every action is re-checked by the server. */
export function PostMenu({ postId, status, body }: { postId: string; status: Status; body: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, payload: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) return setError(json?.error ?? "Something went wrong.");
      setOpen(false);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Connection problem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full p-1.5 text-app-muted hover:bg-white/10 hover:text-app-charcoal" aria-label="Post options" aria-expanded={open}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-10 w-44 rounded-xl border border-app-border bg-[var(--o-pop,#17140f)] p-1 shadow-xl" role="menu">
          <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] hover:bg-white/10" onClick={() => { setEditing(true); setOpen(false); }}>
            Edit text
          </button>
          <button role="menuitem" disabled={busy} className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] hover:bg-white/10" onClick={() => call("/api/org/posts/action", { postId, action: status === "published" ? "unpublish" : "publish" })}>
            {status === "published" ? "Unpublish (back to draft)" : "Publish"}
          </button>
          <button role="menuitem" disabled={busy} className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] text-app-rose hover:bg-app-rose-container" onClick={() => call("/api/org/posts/action", { postId, action: "delete" }, "Delete this post? This can't be undone.")}>
            Delete post
          </button>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Edit post">
          <div className="o-card w-full max-w-lg !bg-[var(--o-pop,#14110c)] p-5">
            <h3 className="text-[14px] font-extrabold text-app-charcoal">Edit post</h3>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={5000} className="o-input mt-3" />
            {error && (
              <p role="alert" className="mt-2 text-[12.5px] text-app-rose">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button className="o-btn-ghost" onClick={() => { setEditing(false); setText(body); }}>
                Cancel
              </button>
              <button className="o-btn" disabled={busy || !text.trim()} onClick={() => call("/api/org/posts/edit", { postId, body: text.trim() })}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !editing && (
        <p role="alert" className="absolute right-0 top-9 z-10 w-56 rounded-lg bg-[var(--o-pop,#17140f)] p-2 text-[11.5px] text-app-rose">
          {error}
        </p>
      )}
    </div>
  );
}
