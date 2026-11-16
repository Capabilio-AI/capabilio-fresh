import type { Metadata } from "next";
import { Star } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { fmtExperience } from "@/lib/professional/experience";
import { MENTOR_MIN_MONTHS } from "@/lib/mentorship/rules";
import { getMentorState } from "@/lib/mentorship/server";
import { AcceptingToggle } from "@/components/professional/mentor/AcceptingToggle";
import { SlotCalendar } from "@/components/professional/mentor/SlotCalendar";
import { MentorProfileForm, type MentorFormInitial } from "@/components/professional/mentor/MentorProfileForm";
import { RequestsInbox } from "@/components/professional/mentor/RequestsInbox";

export const metadata: Metadata = { title: "Mentor — Capabilio AI" };

const CARD = "rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7";
const H2 = "font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]";

/** Mentoring for professionals with ten or more years of experience: opt in, set your hours, answer requests and run sessions. */
export default async function ProfessionalMentor() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const s = await getMentorState(user.id).catch((e: Error) => {
    console.error("[professional/mentor] load failed:", e.message);
    return null;
  });
  if (!s) return <p role="alert" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-ink)]">Mentoring could not load right now. Please try again in a moment.</p>;

  const header = (
    <header className="rounded-3xl bg-[var(--m-accent-soft)] p-6 sm:p-8">
      <h1 className="font-lp-display text-[32px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[44px]">Mentor</h1>
      <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-[var(--m-muted)]">Share what ten years of work has taught you. Students, recently graduated users and other professionals find approved mentors in their Mentors tab and ask for a session.</p>
    </header>
  );

  if (!s.profile && !s.eligibility.eligible) {
    const pct = Math.min(100, Math.round((s.eligibility.months / MENTOR_MIN_MONTHS) * 100));
    return (
      <div className="flex flex-col gap-5">
        {header}
        <section className={CARD} aria-labelledby="el-h">
          <h2 id="el-h" className={H2}>Mentoring opens at ten years of experience</h2>
          <p className="mt-2 text-[14.5px] text-[var(--m-muted)]">{s.eligibility.months > 0 ? `You have ${fmtExperience(s.eligibility.months)} on your profile, so ${fmtExperience(s.eligibility.monthsToGo)} to go.` : "We could not work out your experience yet."} It is counted from the jobs on your profile. Add every job, with its dates, on your Profile page.</p>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress to ten years" className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--m-ground)]"><div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${pct}%` }} /></div>
        </section>
      </div>
    );
  }

  const p = s.profile;
  const initial: MentorFormInitial = {
    headline: p?.headline ?? "",
    bio: p?.bio ?? "",
    topics: p?.expertise.join(", ") ?? "",
    audience: s.extras?.audience ?? ["students", "graduates"],
    sessionMinutes: s.extras?.sessionMinutes ?? 30,
    timezone: s.extras?.timezone ?? "Asia/Kolkata",
  };

  if (!p) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <section className={CARD} aria-labelledby="opt-h">
          <h2 id="opt-h" className={H2}>Become a mentor</h2>
          <p className="mt-1 mb-4 text-[14px] text-[var(--m-muted)]">You have {fmtExperience(s.eligibility.months)} of experience, so you can mentor. Capabilio reviews every mentor before anyone sees them. It is free, and you can pause or stop any time.</p>
          <MentorProfileForm initial={initial} submitLabel="Apply to mentor" />
        </section>
      </div>
    );
  }

  const tz = s.extras?.timezone ?? "Asia/Kolkata";
  return (
    <div className="flex flex-col gap-5">
      {header}
      {p.status === "pending" && <p role="status" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5 text-[14.5px] text-[var(--m-ink)]"><span className="font-bold">Under review.</span> Capabilio checks every mentor before students and graduates can see you. You can set your hours while you wait.</p>}
      {(p.status === "rejected" || p.status === "suspended") && <p role="alert" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5 text-[14.5px] text-[var(--m-ink)]"><span className="font-bold">{p.status === "rejected" ? "Your application was not approved." : "Your mentor profile is paused by Capabilio."}</span>{p.reviewNote ? ` ${p.reviewNote}` : ""} Contact support to talk it through.</p>}
      {p.status === "approved" && (
        <section className={`${CARD} flex flex-wrap items-center justify-between gap-5`} aria-label="Your mentoring at a glance">
          <AcceptingToggle accepting={p.isAccepting} />
          <p className="flex items-center gap-2 text-[14.5px] text-[var(--m-ink)]"><Star size={17} className="fill-current" aria-hidden />{s.rating.average !== null ? <><span className="font-bold">{s.rating.average}</span> from {s.rating.count} {s.rating.count === 1 ? "rating" : "ratings"}</> : "No ratings yet"}</p>
        </section>
      )}

      {p.status === "approved" && (
        <section className={CARD} aria-labelledby="req-h"><h2 id="req-h" className={`${H2} mb-4`}>Requests and sessions</h2><RequestsInbox requests={s.requests} timezone={tz} sessionMinutes={s.extras?.sessionMinutes ?? 30} /></section>
      )}
      {p.status === "approved" && s.rating.recent.some((r) => r.comment) && (
        <section className={CARD} aria-labelledby="rate-h"><h2 id="rate-h" className={`${H2} mb-3`}>Recent ratings</h2><ul className="divide-y divide-[var(--m-rule)]">{s.rating.recent.filter((r) => r.comment).map((r) => <li key={r.createdAt} className="py-3 first:pt-0 last:pb-0 text-[14px] text-[var(--m-ink)]"><span className="font-bold">{r.stars} of 5</span> · {r.comment}</li>)}</ul></section>
      )}

      {(p.status === "approved" || p.status === "pending") && <section className={CARD} aria-labelledby="hrs-h"><h2 id="hrs-h" className={`${H2} mb-1`}>Your slots</h2><p className="mb-4 text-[13.5px] text-[var(--m-muted)]">Pick a date and choose the times you are free, in {tz}. A mentee books one of your open slots and you approve it. You can change or remove open slots any time.</p><SlotCalendar slots={s.slots} timezone={tz} sessionMinutes={s.extras?.sessionMinutes ?? 30} /></section>}

      {(p.status === "approved" || p.status === "pending") && (
        <details className={CARD}>
          <summary className="cursor-pointer text-[16px] font-bold text-[var(--m-ink)]">Edit your mentor profile</summary>
          <p className="mt-2 mb-4 text-[13.5px] text-[var(--m-muted)]">Changing the headline, bio or topics sends an approved profile back for a quick review. Hours and the accepting switch never do.</p>
          <MentorProfileForm initial={initial} submitLabel="Save profile" />
        </details>
      )}
    </div>
  );
}
