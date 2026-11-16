"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { validateAbout } from "@/lib/professional/jobs";

const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";

/** Headline, location and about text. Saved to the professional's own profile. */
export function AboutForm({ initial }: { initial: { headline: string; location: string; about: string } }) {
  const id = useId();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateAbout(v);
    if (!check.ok) return setMsg(check.error);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/professional/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That did not save. Try again.");
      setMsg("Saved.");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor={`${id}-h`} className={LABEL}>Headline</label><input id={`${id}-h`} className={FIELD} value={v.headline} maxLength={160} onChange={(e) => setV({ ...v, headline: e.target.value })} placeholder="e.g. Backend engineer building payment systems" /></div>
        <div><label htmlFor={`${id}-l`} className={LABEL}>Location</label><input id={`${id}-l`} className={FIELD} value={v.location} maxLength={120} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="e.g. Pune, India" /></div>
      </div>
      <div><label htmlFor={`${id}-a`} className={LABEL}>About you</label><textarea id={`${id}-a`} rows={5} className={`${FIELD} resize-y`} value={v.about} maxLength={1200} onChange={(e) => setV({ ...v, about: e.target.value })} placeholder="What you do, what you care about, what you want next." /><p className="mt-1 text-right text-[12px] tabular-nums text-[var(--m-muted)]">{v.about.length}/1200</p></div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Save</button>
        <p role="status" className="text-[13.5px] text-[var(--m-muted)]">{msg}</p>
      </div>
    </form>
  );
}
