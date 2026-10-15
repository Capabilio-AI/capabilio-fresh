import Link from "next/link";
import { ArrowRight, Briefcase, FileText, MapPin, MessagesSquare, Rocket, Sparkles } from "lucide-react";
import type { Opportunity } from "@/lib/launchpad/opportunities";
import type { OverviewSkill } from "@/lib/dashboard/overview";
import { JobForm } from "@/components/stage/JobForm";

const CARD = "rounded-2xl border border-[var(--m-rule)] bg-white p-5";
const H = "font-lp-display text-[18px] font-bold text-[var(--m-ink)]";

/** Real open listings from Launchpad; an honest empty state when there are none. */
export function LaunchpadStrip({ items }: { items: Opportunity[] }) {
  return (
    <section className={CARD} aria-labelledby="lp-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="lp-h" className={`${H} flex items-center gap-2`}><Rocket size={17} aria-hidden />Open on Launchpad</h2>
        <Link href="/launchpad" className="inline-flex items-center gap-1 text-[13px] font-bold text-[var(--m-ink)] hover:underline">See all <ArrowRight size={14} aria-hidden /></Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-app-muted">No listings are open right now. Roles and internships appear here when employers or your college post them.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {items.map((o) => (
            <li key={o.id}>
              <Link href="/launchpad" className="flex h-full flex-col gap-1.5 rounded-xl border border-[var(--m-rule)] p-4 transition-colors hover:border-[var(--m-ink)]">
                <span className="font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{o.role}</span>
                <span className="flex items-center gap-1.5 text-[12.5px] text-app-muted"><Briefcase size={12} aria-hidden />{o.company}</span>
                {o.location && <span className="flex items-center gap-1.5 text-[12.5px] text-app-muted"><MapPin size={12} aria-hidden />{o.location}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InterviewCard({ unlocked, count }: { unlocked: boolean; count: number }) {
  return (
    <section className={`${CARD} flex flex-col`} aria-labelledby="iv-h">
      <h2 id="iv-h" className={`${H} flex items-center gap-2`}><MessagesSquare size={17} aria-hidden />AI Interview</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-app-muted">
        {unlocked ? (count > 0 ? `${count} mock ${count === 1 ? "round" : "rounds"} done. Another round makes the real one feel familiar.` : "Practise a technical, behavioural or HR round and get feedback before it counts.") : "Practise technical, behavioural and HR rounds. Included in the Accelerate plan."}
      </p>
      <Link href={unlocked ? "/dashboard/interview" : "/plans"} className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-[13px] font-bold text-[var(--m-ink)] hover:underline">
        {unlocked ? "Start a round" : "See plans"} <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}

export function ResumeCard({ resume }: { resume: { skillCount: number; applied: boolean } | null }) {
  return (
    <section className={`${CARD} flex flex-col`} aria-labelledby="rs-h">
      <h2 id="rs-h" className={`${H} flex items-center gap-2`}><FileText size={17} aria-hidden />Your resume</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-app-muted">
        {resume ? `We read ${resume.skillCount} skills from it${resume.applied ? " and added them to your profile" : ""}. Your assessment tests the ones you claim a little harder.` : "Add your resume and we pre-fill your profile and test the skills you claim."}
      </p>
      <Link href="/assessment" className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-[13px] font-bold text-[var(--m-ink)] hover:underline">
        {resume ? "Review in assessment" : "Add your resume"} <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}

export function SkillsToClose({ skills, roleName }: { skills: OverviewSkill[]; roleName: string }) {
  return (
    <section className={CARD} aria-labelledby="gap-h">
      <h2 id="gap-h" className={`${H} flex items-center gap-2`}><Sparkles size={17} aria-hidden />Skills to close for {roleName}</h2>
      {skills.length === 0 ? (
        <p className="mt-4 text-[13.5px] text-app-muted">No measured skill is below its target. Measure more skills in Arena to see what to improve.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3.5">
          {skills.map((s) => (
            <li key={s.name}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="font-bold text-[var(--m-ink)]">{s.name}</span>
                <span className="text-app-muted">{s.score}% of {s.target}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[var(--m-ground)]" role="img" aria-label={`${s.name}: ${s.score} of ${s.target} percent`}>
                <div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${Math.min(100, ((s.score ?? 0) / s.target) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href="/dashboard/skills?view=gaps" className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--m-ink)] hover:underline">Full gap analysis <ArrowRight size={14} aria-hidden /></Link>
    </section>
  );
}

/** The graduate's way out of the path: report a job and the profile moves to the professional path. */
export function GotAJob() {
  return (
    <details className="group rounded-2xl border border-dashed border-[var(--m-off)] bg-white p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-lp-display text-[17px] font-bold text-[var(--m-ink)] [&::-webkit-details-marker]:hidden">
        Got a job?
        <span className="text-[13px] font-bold text-[var(--m-accent-ink)] group-open:hidden">Update my profile →</span>
      </summary>
      <p className="mb-4 mt-2 text-[13.5px] text-app-muted">Congratulations. Tell us where, and your profile moves to the professional path with all your evidence.</p>
      <JobForm />
    </details>
  );
}
