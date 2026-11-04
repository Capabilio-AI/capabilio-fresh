"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";

const TOPICS = [
  ["student", "I'm a student"],
  ["college", "College or university"],
  ["company", "Company or recruiter"],
  ["other", "Something else"],
] as const;

const FIELD = "mt-1.5 w-full rounded-lg border border-cap-ink/25! bg-white px-3.5 py-2.5 text-[15px] text-cap-ink outline-none transition-colors placeholder:text-cap-muted/70 focus:border-cap-indigo! focus:ring-2 focus:ring-cap-indigo/20";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: f.get("fullName"), email: f.get("email"), topic: f.get("topic"), message: f.get("message"), website: f.get("website") ?? "" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="grid place-items-center rounded-2xl border border-cap-line! bg-white p-10 text-center">
        <CheckCircle2 size={36} className="text-cap-ok" aria-hidden />
        <h3 className="mt-4 font-cap-display text-xl font-semibold text-cap-ink">Message received</h3>
        <p className="mt-2 max-w-sm text-[15px] text-cap-muted">Thanks for writing to us. We&apos;ll reply to the email you gave.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-cap-line! bg-white p-6 md:p-8" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-cap-ink">Full name
          <input name="fullName" required minLength={2} maxLength={120} autoComplete="name" className={FIELD} />
        </label>
        <label className="text-sm font-medium text-cap-ink">Email
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={FIELD} />
        </label>
      </div>
      <label className="text-sm font-medium text-cap-ink">I am writing as
        <select name="topic" required defaultValue="student" className={FIELD}>
          {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-cap-ink">Your message
        <textarea name="message" required minLength={10} maxLength={2000} rows={5} className={`${FIELD} resize-y`} />
      </label>
      {/* honeypot: hidden from people and screen readers; bots fill it */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {error && <p role="alert" className="rounded-lg border border-cap-warn/40! bg-[#fff6ec] px-3.5 py-2.5 text-sm font-medium text-cap-warn">{error}</p>}
      <button type="submit" disabled={state === "sending"} className="justify-self-start rounded-full bg-cap-ink px-6 py-3 text-[15px] font-semibold text-cap-paper transition-opacity hover:opacity-90 disabled:opacity-60">
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
