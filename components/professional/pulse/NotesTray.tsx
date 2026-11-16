"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Loader2, Plus, X } from "lucide-react";
import { MAX_NOTE, NOTE_HOURS, agoLabel, validateNote } from "@/lib/professional/pulse";
import type { Note } from "@/lib/professional/pulse-server";
import { ProAvatar } from "./ProAvatar";

/** Short notes that stay up for 24 hours. Yours comes first with a plus to write or replace it; tap anyone's avatar to read their note. */
export function NotesTray({ me, notes, now }: { me: { name: string; avatarUrl: string | null }; notes: Note[]; now: string }) {
  const router = useRouter();
  const mine = notes.find((n) => n.mine) ?? null;
  const others = notes.filter((n) => !n.mine);
  const [reading, setReading] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const shown = notes.find((n) => n.id === reading) ?? null;

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateNote(text);
    if (!v.ok) return setMsg(v.error);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/professional/pulse/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That did not post. Try again.");
      setText("");
      setWriting(false);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That did not post. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!mine) return;
    await fetch(`/api/professional/pulse/notes/${mine.id}`, { method: "DELETE" }).catch(() => undefined);
    setReading(null);
    router.refresh();
  };

  return (
    <section aria-label="Notes" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5">
      <ul className="flex items-start gap-4 overflow-x-auto pb-1">
        <li className="shrink-0 text-center">
          <button type="button" onClick={() => { setWriting((v) => !v); setReading(null); setMsg(null); }} aria-expanded={writing} aria-label={mine ? "Edit your note" : "Write a note"} className="relative block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-accent)]">
            <span className={clsx("block rounded-full p-[3px]", mine ? "bg-[var(--m-accent)]" : "bg-[var(--m-rule)]")}><span className="block rounded-full border-2 border-white"><ProAvatar name={me.name} url={me.avatarUrl} size={56} /></span></span>
            <span aria-hidden className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-white bg-[var(--m-ink)] text-white"><Plus size={13} /></span>
          </button>
          <span className="mt-1.5 block max-w-[72px] truncate text-[12px] font-bold text-[var(--m-ink)]">Your note</span>
        </li>
        {others.map((n) => (
          <li key={n.id} className="shrink-0 text-center">
            <button type="button" onClick={() => { setReading(reading === n.id ? null : n.id); setWriting(false); }} aria-pressed={reading === n.id} aria-label={`Read ${n.author.name}'s note`} className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-accent)]">
              <span className="block rounded-full bg-[var(--m-accent)] p-[3px]"><span className="block rounded-full border-2 border-white"><ProAvatar name={n.author.name} url={n.author.avatarUrl} size={56} /></span></span>
            </button>
            <span className="mt-1.5 block max-w-[72px] truncate text-[12px] font-bold text-[var(--m-ink)]">{n.author.name.split(" ")[0]}</span>
          </li>
        ))}
        {others.length === 0 && !mine && <li className="self-center text-[13px] text-[var(--m-muted)]">Notes from people you follow show up here for {NOTE_HOURS} hours.</li>}
      </ul>

      {writing && (
        <form onSubmit={post} className="mt-4 flex flex-wrap items-center gap-2" aria-label="Write a note">
          <label htmlFor="note-text" className="sr-only">Your note</label>
          <input id="note-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_NOTE} placeholder={mine ? "Replace your note" : "What is on your mind? Up to 160 characters"} className="min-w-0 flex-1 rounded-full border border-[var(--m-soft)] bg-white px-4 py-2 text-[14px] focus:border-[var(--m-ink)] focus:outline-none" />
          <button type="submit" disabled={busy || !text.trim()} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2 text-[13px] font-bold text-white disabled:opacity-45">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />}Share</button>
          {mine && <button type="button" onClick={remove} className="text-[13px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]">Remove mine</button>}
          <p role="alert" className="w-full text-[12.5px] font-bold text-[var(--m-ink)]">{msg}</p>
        </form>
      )}
      {(shown || (mine && !writing && reading === null)) && (
        <p role="status" className="mt-4 flex items-start justify-between gap-3 rounded-2xl bg-[var(--m-accent-soft)] px-4 py-3 text-[14px] text-[var(--m-ink)]">
          <span><span className="font-bold">{(shown ?? mine)!.mine ? "You" : (shown ?? mine)!.author.name}: </span>{(shown ?? mine)!.body}<span className="ml-2 text-[12px] text-[var(--m-muted)]">{agoLabel((shown ?? mine)!.createdAt, new Date(now))}</span></span>
          {shown && <button type="button" onClick={() => setReading(null)} aria-label="Close note" className="shrink-0 text-[var(--m-muted)] hover:text-[var(--m-ink)]"><X size={15} aria-hidden /></button>}
        </p>
      )}
    </section>
  );
}
