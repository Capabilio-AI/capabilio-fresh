"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AUDIENCES, AUDIENCE_LABEL, SESSION_MINUTES, validateMentorProfile, type Audience } from "@/lib/mentorship/rules";

const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3.5 py-2.5 text-[14.5px] text-[var(--m-ink)] placeholder:text-[var(--m-off)] focus:border-[var(--m-ink)] focus:outline-none";
const LABEL = "mb-1.5 block text-[13px] font-bold text-[var(--m-ink)]";
const ZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export interface MentorFormInitial { headline: string; bio: string; topics: string; audience: Audience[]; sessionMinutes: 30 | 45 | 60; timezone: string }

/** Opt in to mentoring, or edit your profile. Changing the public text sends an approved profile back for a quick review. */
export function MentorProfileForm({ initial, submitLabel }: { initial: MentorFormInitial; submitLabel: string }) {
  const id = useId();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const body = () => ({ headline: v.headline, bio: v.bio, topics: v.topics.split(",").map((t) => t.trim()).filter(Boolean), audience: v.audience, sessionMinutes: v.sessionMinutes, timezone: v.timezone });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateMentorProfile(body());
    if (!check.ok) return setMsg(check.error);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/professional/mentor", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()) });
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
  const toggle = (a: Audience) => setV((p) => ({ ...p, audience: p.audience.includes(a) ? p.audience.filter((x) => x !== a) : [...p.audience, a] }));

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div><label htmlFor={`${id}-h`} className={LABEL}>Headline</label><input id={`${id}-h`} className={FIELD} value={v.headline} maxLength={120} onChange={(e) => setV({ ...v, headline: e.target.value })} placeholder="e.g. Engineering manager, payments. I help engineers grow into leads." /></div>
      <div><label htmlFor={`${id}-b`} className={LABEL}>About your mentoring</label><textarea id={`${id}-b`} rows={4} className={`${FIELD} resize-y`} value={v.bio} maxLength={800} onChange={(e) => setV({ ...v, bio: e.target.value })} placeholder="Your background, how you work with people, and what they can expect from a session." /><p className="mt-1 text-right text-[12px] tabular-nums text-[var(--m-muted)]">{v.bio.length}/800</p></div>
      <div><label htmlFor={`${id}-t`} className={LABEL}>Topics you can help with</label><input id={`${id}-t`} className={FIELD} value={v.topics} onChange={(e) => setV({ ...v, topics: e.target.value })} placeholder="System design, Career growth, Interview prep" /><p className="mt-1 text-[12px] text-[var(--m-muted)]">Separate with commas. Up to 8.</p></div>
      <fieldset><legend className={LABEL}>Who do you want to mentor?</legend><div className="flex flex-wrap gap-4">{AUDIENCES.map((a) => <label key={a} className="flex items-center gap-2 text-[14px] text-[var(--m-ink)]"><input type="checkbox" checked={v.audience.includes(a)} onChange={() => toggle(a)} className="size-4 accent-[var(--m-ink)]" />{AUDIENCE_LABEL[a]}</label>)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset><legend className={LABEL}>Session length</legend><div className="flex gap-4">{SESSION_MINUTES.map((m) => <label key={m} className="flex items-center gap-2 text-[14px] text-[var(--m-ink)]"><input type="radio" name={`${id}-m`} checked={v.sessionMinutes === m} onChange={() => setV({ ...v, sessionMinutes: m })} className="size-4 accent-[var(--m-ink)]" />{m} min</label>)}</div></fieldset>
        <div><label htmlFor={`${id}-z`} className={LABEL}>Your time zone</label><input id={`${id}-z`} list={`${id}-zones`} className={FIELD} value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} /><datalist id={`${id}-zones`}>{ZONES.map((z) => <option key={z} value={z} />)}</datalist></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}{submitLabel}</button>
        <p role="status" className="text-[13.5px] text-[var(--m-muted)]">{msg}</p>
      </div>
    </form>
  );
}
