"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";

const FIELD = "w-full rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3 font-lp-body text-[15px] text-[var(--m-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]";

/** Change your own password. The current one is asked for, and the rules are stated before the server has to refuse. */
export function PasswordForm({ forced }: { forced: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const mismatch = again.length > 0 && next !== again;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/account/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current, next }) });
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) { setError(out.error ?? "Could not change the password."); return; }
    setDone(true);
    if (forced) window.location.assign("/admin");
  }

  if (done) return <p role="status" className="rounded-xl bg-[#dff5ea] px-4 py-3 font-lp-body text-[14px] font-semibold text-[#0b5d3f]">Password changed. Use it the next time you sign in.</p>;
  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-ink)]">{forced ? "The password you were given" : "Current password"}
        <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-ink)]">New password
        <input type="password" autoComplete="new-password" required minLength={12} value={next} onChange={(e) => setNext(e.target.value)} className={FIELD} />
        <span className="font-normal text-[12px] text-[var(--m-muted)]">At least 12 characters, with letters and a number. A few words with a number works well.</span>
      </label>
      <label className="flex flex-col gap-1.5 font-lp-body text-[13px] font-bold text-[var(--m-ink)]">New password again
        <input type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} className={FIELD} aria-invalid={mismatch} />
        {mismatch && <span className="font-normal text-[12px] text-[#8e1228]">These do not match.</span>}
      </label>
      {error && <p role="alert" className="font-lp-body text-[13px] font-semibold text-[#8e1228]">{error}</p>}
      <button type="submit" disabled={busy || !current || !next || mismatch || !again} className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-[var(--m-ink)] px-6 py-3 font-lp-body text-[14px] font-bold text-white disabled:opacity-40">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Change password</button>
    </form>
  );
}
