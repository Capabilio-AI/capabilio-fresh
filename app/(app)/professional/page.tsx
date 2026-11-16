import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { loadProfessional } from "@/lib/professional/data";
import { Badges } from "@/components/professional/home/Badges";
import { fmtExperience } from "@/lib/professional/experience";
import { CareerTimeline } from "@/components/professional/home/CareerTimeline";
import { FinishSetup } from "@/components/professional/home/FinishSetup";
import { ProTabs } from "@/components/professional/home/ProTabs";
import { ProAvatar } from "@/components/professional/pulse/ProAvatar";

export const metadata: Metadata = { title: "Overview — Capabilio AI" };

/** A professional's Overview: who they are, what is still to do, their career line and what their resume says they can do. */
export default async function ProfessionalOverview() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const d = await loadProfessional(user.id);
  const role = [d.jobTitle, d.employer].filter(Boolean).join(" at ");
  return (
    <div className="flex flex-col gap-5">
      <ProTabs />
      <section aria-labelledby="pro-h" className="relative overflow-hidden rounded-3xl bg-[var(--m-ink)] p-6 text-white sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- storage-hosted cover, arbitrary origin */}
        {d.coverUrl && <img src={d.coverUrl} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-25" />}
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[22rem] w-[22rem] rounded-full border-[36px] border-white/[0.06]" />
        <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 h-[12rem] w-[12rem] rounded-full border-[22px] border-[var(--m-accent)]/40" />
        <div className="relative flex items-center gap-4">
          <span className="shrink-0 overflow-hidden rounded-full border-4 border-white/20"><ProAvatar name={d.name ?? "You"} url={d.avatarUrl} size={72} /></span>
          <div className="min-w-0">
            <h1 id="pro-h" className="font-lp-display text-[30px] font-bold leading-[1.05] tracking-tight sm:text-[42px]">{d.name ?? "Your overview"}</h1>
            {role && <p className="mt-1.5 text-[16px] text-white/80">{role}</p>}
          </div>
        </div>
        <div className="relative mt-5"><Badges epfoVerified={d.epfoVerified} mentorApproved={d.mentorApproved} /></div>
        <dl className="relative mt-6 flex flex-wrap gap-x-10 gap-y-3 text-[14px]">
          <div><dt className="text-white/60">Resume</dt><dd className="font-bold">{d.resumeDone ? "Added" : "Not added yet"}</dd></div>
          <div><dt className="text-white/60">EPFO</dt><dd className="font-bold">{d.epfoVerified ? "Verified" : "Not verified yet"}</dd></div>
          <div><dt className="text-white/60">Experience</dt><dd className="font-bold">{d.experienceMonths > 0 ? fmtExperience(d.experienceMonths) : "Not dated yet"}</dd></div>
        </dl>
      </section>

      {(!d.resumeDone || !d.epfoVerified) && <FinishSetup resumeDone={d.resumeDone} epfoVerified={d.epfoVerified} deadline={d.verifyDeadline} />}

      <section aria-labelledby="line-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7">
        <h2 id="line-h" className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Your career timeline</h2>
        <div className="mt-3"><CareerTimeline work={d.work} months={d.experienceMonths} /></div>
      </section>

    </div>
  );
}
