"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";

const FIELD = "crit-field";
const LABEL = "crit-label mb-1 block";
const HINT = "crit-soft mt-2 text-[13px] leading-snug";
const MIN_NOTE = 40;

interface Props {
  /** null sends an open introduction rather than an application to one role. */
  openingId: string | null;
  roleTitle?: string;
  /** Set when the form sits on a night or dawn ground. */
  onDark?: boolean;
}

/** The one application form. Work first, resume optional, because that is how Capabilio hires. */
export default function ApplyForm({ openingId, roleTitle }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [noteLength, setNoteLength] = useState(0);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/careers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingId,
          fullName: text("fullName"),
          email: text("email"),
          workUrl: text("workUrl"),
          proofNote: text("proofNote"),
          resumeUrl: text("resumeUrl"),
          profileUrl: text("profileUrl"),
          website: text("website"),
        }),
      });
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="py-4">
        <span className="grid h-11 w-11 place-items-center bg-[var(--crit-pencil)] text-white">
          <Check size={22} aria-hidden="true" />
        </span>
        <h3 className="crit-head mt-5 text-3xl">We have your proof.</h3>
        <p className="crit-body crit-soft mt-3 text-lg leading-relaxed">
          {roleTitle ? `Thanks for applying for ${roleTitle}.` : "Thanks for introducing yourself."} A person on the team will open your work and read it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-7">
      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className={LABEL}>Your name</label>
          <input id="fullName" name="fullName" required minLength={2} maxLength={120} autoComplete="name" className={FIELD} />
        </div>
        <div>
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="workUrl" className={LABEL}>Something you built, solved or shipped</label>
        <input id="workUrl" name="workUrl" type="url" required maxLength={500} placeholder="https://" className={FIELD} aria-describedby="workUrl-hint" />
        <p id="workUrl-hint" className={HINT}>A GitHub repo, a live site, a document, a video, a Skill Passport link. Anything we can open.</p>
      </div>

      <div>
        <label htmlFor="proofNote" className={LABEL}>What did you do, and what would you change?</label>
        <textarea
          id="proofNote"
          name="proofNote"
          required
          minLength={MIN_NOTE}
          maxLength={2000}
          rows={5}
          onChange={(e) => setNoteLength(e.target.value.trim().length)}
          className={FIELD}
          aria-describedby="proofNote-hint"
        />
        <p id="proofNote-hint" className={HINT}>
          A few honest sentences. {noteLength < MIN_NOTE ? `${MIN_NOTE - noteLength} more characters to go.` : "That is enough."}
        </p>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="resumeUrl" className={LABEL}>Resume link <span className="font-medium normal-case tracking-normal opacity-60">(optional)</span></label>
          <input id="resumeUrl" name="resumeUrl" type="url" maxLength={500} placeholder="https://" className={FIELD} />
        </div>
        <div>
          <label htmlFor="profileUrl" className={LABEL}>LinkedIn or other profile <span className="font-medium normal-case tracking-normal opacity-60">(optional)</span></label>
          <input id="profileUrl" name="profileUrl" type="url" maxLength={500} placeholder="https://" className={FIELD} />
        </div>
      </div>

      {/* Honeypot: people never see it, bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error && (
        <p role="alert" className="border-2 border-[var(--crit-pencil)]! px-4 py-3 text-sm font-bold text-[var(--crit-pencil)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === "sending"}
          className="crit-btn crit-btn-red disabled:cursor-wait disabled:opacity-70"
        >
          {state === "sending" ? "Sending…" : "Send my proof"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        <p className="crit-soft max-w-[16rem] text-[13px] leading-snug">We use these details only to consider your application.</p>
      </div>
    </form>
  );
}
