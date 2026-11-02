"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, interviewToLines, linesToList, parseInterviewLines } from "@/lib/hiring/format";
import { EMPLOYMENT_TYPES, OPENING_STATUSES, WORK_MODES, type Opening } from "@/lib/hiring/types";

const INPUT = "w-full rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13px] text-[var(--m-ink)]";
const LABEL = "mb-1 block font-lp-body text-[12px] font-semibold text-[var(--m-ink)]";
const HINT = "mt-1 font-lp-body text-[11.5px] text-app-muted";
const TEAMS = ["Engineering", "Design", "Product", "Growth", "Operations", "Content", "Partnerships"];

const STATUS_HINT = { draft: "Draft: only you can see it.", open: "Open: live on /careers now.", soon: "Opening soon: listed on /careers, no applications yet.", closed: "Closed: off the list; its link says it closed." } as const;

/** Create a role, or edit one. Lists are typed one per line. */
export function OpeningForm({ opening, onDone }: { opening?: Opening; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const body = {
      title: text("title"),
      ...(opening ? {} : { slug: text("slug") || undefined }),
      team: text("team"),
      location: text("location"),
      workMode: text("workMode"),
      employmentType: text("employmentType"),
      summary: text("summary"),
      about: text("about"),
      responsibilities: linesToList(text("responsibilities")),
      requirements: linesToList(text("requirements")),
      niceToHave: linesToList(text("niceToHave")),
      proofBrief: text("proofBrief") || null,
      dayToDay: text("dayToDay") || null,
      firstMonths: linesToList(text("firstMonths")),
      interview: parseInterviewLines(text("interview")),
      compensation: text("compensation") || null,
      status: text("status"),
      closesOn: text("closesOn") || null,
    };
    setBusy(true);
    setError(null);
    const res = await fetch(opening ? `/api/careers-admin/openings/${opening.id}` : "/api/careers-admin/openings", {
      method: opening ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{opening ? `Edit: ${opening.title}` : "New opening"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="title">Role title</label>
          <input id="title" name="title" required defaultValue={opening?.title} className={INPUT} />
        </div>
        {!opening && (
          <div>
            <label className={LABEL} htmlFor="slug">Link name (optional)</label>
            <input id="slug" name="slug" placeholder="made from the title" pattern="[a-z0-9]+(-[a-z0-9]+)*" className={INPUT} />
            <p className={HINT}>Lowercase and hyphens. It cannot change after posting, so shared links keep working.</p>
          </div>
        )}
        <div>
          <label className={LABEL} htmlFor="team">Team</label>
          <input id="team" name="team" list="team-options" required defaultValue={opening?.team} className={INPUT} />
          <datalist id="team-options">{TEAMS.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div>
          <label className={LABEL} htmlFor="location">Location</label>
          <input id="location" name="location" required defaultValue={opening?.location} placeholder="Hyderabad, India" className={INPUT} />
        </div>
        <div>
          <label className={LABEL} htmlFor="workMode">Work mode</label>
          <select id="workMode" name="workMode" defaultValue={opening?.workMode ?? "hybrid"} className={INPUT}>
            {WORK_MODES.map((m) => <option key={m} value={m}>{WORK_MODE_LABEL[m]}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="employmentType">Type</label>
          <select id="employmentType" name="employmentType" defaultValue={opening?.employmentType ?? "full_time"} className={INPUT}>
            {EMPLOYMENT_TYPES.map((m) => <option key={m} value={m}>{EMPLOYMENT_LABEL[m]}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="compensation">Compensation (optional)</label>
          <input id="compensation" name="compensation" defaultValue={opening?.compensation ?? ""} placeholder="e.g. 6 to 9 LPA" className={INPUT} />
        </div>
        <div>
          <label className={LABEL} htmlFor="closesOn">Last day to apply (optional)</label>
          <input id="closesOn" name="closesOn" type="date" defaultValue={opening?.closesOn ?? ""} className={INPUT} />
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="summary">One-line summary</label>
        <textarea id="summary" name="summary" required rows={2} maxLength={280} defaultValue={opening?.summary} className={INPUT} />
        <p className={HINT}>Shown on the list and in search. Under 280 characters.</p>
      </div>
      <div>
        <label className={LABEL} htmlFor="about">About the role</label>
        <textarea id="about" name="about" required rows={6} defaultValue={opening?.about} className={INPUT} />
        <p className={HINT}>Plain text. A blank line starts a new paragraph.</p>
      </div>
      <div>
        <label className={LABEL} htmlFor="dayToDay">What the work looks like (optional)</label>
        <textarea id="dayToDay" name="dayToDay" rows={6} maxLength={3000} defaultValue={opening?.dayToDay ?? ""} className={INPUT} />
        <p className={HINT}>Plain text, a blank line starts a new paragraph. Describe a normal week.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {([["responsibilities", "What you will do", opening?.responsibilities], ["requirements", "What you bring", opening?.requirements], ["niceToHave", "Nice to have", opening?.niceToHave]] as const).map(([name, label, value]) => (
          <div key={name}>
            <label className={LABEL} htmlFor={name}>{label}</label>
            <textarea id={name} name={name} rows={6} defaultValue={value?.join("\n")} className={INPUT} />
            <p className={HINT}>One per line, up to 12.</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="firstMonths">Your first months (optional)</label>
          <textarea id="firstMonths" name="firstMonths" rows={6} defaultValue={opening?.firstMonths.join("\n")} className={INPUT} />
          <p className={HINT}>One per line, up to 8.</p>
        </div>
        <div>
          <label className={LABEL} htmlFor="interview">Interview steps (optional)</label>
          <textarea id="interview" name="interview" rows={6} defaultValue={interviewToLines(opening?.interview ?? [])} className={INPUT} />
          <p className={HINT}>One per line, written Title: what happens. Leave empty to show the general four steps.</p>
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="proofBrief">Your first proof (optional)</label>
        <textarea id="proofBrief" name="proofBrief" rows={4} maxLength={1500} defaultValue={opening?.proofBrief ?? ""} className={INPUT} />
        <p className={HINT}>The small, real problem a candidate would work on. Candidates see it on the role page, so write it as you would give it to them.</p>
      </div>
      <div>
        <label className={LABEL} htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={opening?.status ?? "draft"} className={`${INPUT} sm:max-w-xs`}>
          {OPENING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_HINT[s]}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="font-lp-body text-[12.5px] text-app-rose">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-full bg-app-charcoal px-5 py-2 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : opening ? "Save changes" : "Save opening"}</button>
        <button type="button" onClick={onDone} className="rounded-full border border-[var(--m-rule)] bg-white px-5 py-2 font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">Cancel</button>
      </div>
    </form>
  );
}
