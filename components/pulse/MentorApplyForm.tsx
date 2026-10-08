"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { MyMentorProfile } from "@/lib/pulse/mentors";

const FIELD = "mt-1 w-full rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13.5px] focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20";

/** Apply to be a mentor, or edit your profile. Changes to the public text go back to Capabilio for review. */
export function MentorApplyForm({ mine, onSaved }: { mine: MyMentorProfile | null; onSaved: () => void }) {
  const router = useRouter();
  const [headline, setHeadline] = useState(mine?.headline ?? "");
  const [bio, setBio] = useState(mine?.bio ?? "");
  const [expertise, setExpertise] = useState((mine?.expertise ?? []).join(", "));
  const [company, setCompany] = useState(mine?.company ?? "");
  const [roleTitle, setRoleTitle] = useState(mine?.roleTitle ?? "");
  const [years, setYears] = useState(mine?.yearsExperience != null ? String(mine.yearsExperience) : "");
  const [availability, setAvailability] = useState(mine?.availability ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pulse/mentors/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, bio, expertise: expertise.split(",").map((t) => t.trim()).filter(Boolean), company, roleTitle, yearsExperience: years === "" ? undefined : Number(years), availability }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; status?: string } | null;
      if (!res.ok) return setMessage({ ok: false, text: json?.error ?? "Couldn't save." });
      setMessage({ ok: true, text: json?.status === "approved" ? "Saved." : "Sent for review. We'll list you once it's approved." });
      onSaved();
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="m-headline" className="font-lp-body text-[12px] font-medium text-[var(--m-ink)]">Headline</label>
        <input id="m-headline" className={FIELD} value={headline} onChange={(e) => setHeadline(e.target.value.slice(0, 120))} placeholder="e.g. SDE II at a product company, ex-startup" />
      </div>
      <div>
        <label htmlFor="m-bio" className="font-lp-body text-[12px] font-medium text-[var(--m-ink)]">How can you help students?</label>
        <textarea id="m-bio" rows={4} className={`${FIELD} resize-none`} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 800))} placeholder="What you've done, what you can advise on, what you'd like to see from the people who reach out." />
        <p className="mt-0.5 text-right font-lp-mono text-[10.5px] text-app-muted">{bio.length}/800</p>
      </div>
      <div>
        <label htmlFor="m-expertise" className="font-lp-body text-[12px] font-medium text-[var(--m-ink)]">Expertise (up to 8, separated by commas)</label>
        <input id="m-expertise" className={FIELD} value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="System Design, Java, Interview Prep" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><label htmlFor="m-company" className="font-lp-body text-[12px] font-medium text-[var(--m-ink)]">Company</label><input id="m-company" className={FIELD} value={company} onChange={(e) => setCompany(e.target.value.slice(0, 120))} /></div>
        <div><label htmlFor="m-role" className="font-lp-body text-[12px] font-medium text-[var(--m-ink)]">Role</label><input id="m-role" className={FIELD} value={roleTitle} onChange={(e) => setRoleTitle(e.target.value.slice(0, 120))} /></div>
        <div><label htmlFor="m-years" className="font-lp-body text-[12px] font-medium text-[var(--m-ink)]">Years of experience</label><input id="m-years" type="number" min={0} max={60} className={FIELD} value={years} onChange={(e) => setYears(e.target.value)} /></div>
      </div>
      <div>
        <label htmlFor="m-avail" className="font-lp-body text-[12px] font-medium text-[var(--m-ink)]">Availability (optional)</label>
        <input id="m-avail" className={FIELD} value={availability} onChange={(e) => setAvailability(e.target.value.slice(0, 200))} placeholder="e.g. Weekends, a few hours a month" />
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`font-lp-body text-[12.5px] ${message.ok ? "text-app-success" : "text-app-rose"}`}>{message.text}</p>}
      <div><button type="button" onClick={submit} disabled={busy} className="flex items-center gap-2 rounded-full bg-app-charcoal px-5 py-2.5 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} {mine ? "Save changes" : "Apply to be a mentor"}</button></div>
    </div>
  );
}
