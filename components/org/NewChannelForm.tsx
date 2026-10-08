"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

/** Create a channel, open to the whole team or private to chosen people. */
export function NewChannelForm({ people }: { people: { userId: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(description.trim() ? { description } : {}), isPrivate, memberUserIds: isPrivate ? picked : [] }),
      });
      const json = (await res.json().catch(() => null)) as { channelId?: string; error?: string } | null;
      if (!res.ok || !json?.channelId) return setError(json?.error ?? "Something went wrong.");
      setOpen(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
      setPicked([]);
      router.push(`/org/chat?channel=${json.channelId}`);
    } catch {
      setError("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="o-btn-ghost w-full" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" /> New channel
      </button>
      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="New channel">
          <form onSubmit={submit} className="o-card my-8 w-full max-w-md !bg-[var(--o-pop,#14110c)] p-5" noValidate>
            <h3 className="text-[15px] font-extrabold text-app-charcoal">New channel</h3>
            <label className="mt-4 block text-[11.5px] font-bold text-app-muted">
              Name *
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="placement-cell" className="o-input mt-1.5" />
            </label>
            <label className="mt-3 block text-[11.5px] font-bold text-app-muted">
              What is it for?
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="o-input mt-1.5" />
            </label>
            <label className="mt-4 flex items-start gap-2.5 text-[12.5px] text-app-charcoal">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--app-orange)]" />
              <span>
                <span className="block font-semibold">Private channel</span>
                <span className="block text-[11.5px] text-app-muted">Only the people you pick can see it.</span>
              </span>
            </label>
            {isPrivate && (
              <fieldset className="mt-3">
                <legend className="mb-1.5 text-[11.5px] font-bold text-app-muted">Add people</legend>
                {people.length === 0 ? (
                  <p className="text-[12px] text-app-muted">No one else has chat access yet.</p>
                ) : (
                  <ul className="max-h-44 overflow-y-auto rounded-xl border border-app-border">
                    {people.map((p) => (
                      <li key={p.userId}>
                        <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[12.5px] hover:bg-white/[0.04]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--app-orange)]"
                            checked={picked.includes(p.userId)}
                            onChange={(e) => setPicked(e.target.checked ? [...picked, p.userId] : picked.filter((x) => x !== p.userId))}
                          />
                          {p.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            )}
            {error && (
              <p role="alert" className="mt-3 text-[12.5px] text-app-rose">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="o-btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="o-btn" disabled={busy || !name.trim()}>
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Create channel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
