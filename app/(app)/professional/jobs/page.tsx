import type { Metadata } from "next";
import { requireStage } from "@/lib/stage/guard";
import { createServiceClient } from "@/lib/supabase/service";
import { listCompanyOpenings } from "@/lib/hiring/openings";
import { JobsTabs } from "@/components/professional/jobs/JobsTabs";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, postedLabel } from "@/lib/hiring/format";

export const metadata: Metadata = { title: "Jobs — Capabilio AI" };

/** Roles companies have posted on Capabilio, for a professional's next move. */
export default async function ProfessionalJobs() {
  await requireStage(["professional"]);
  const openings = await listCompanyOpenings(createServiceClient());
  return (
    <div className="flex flex-col gap-5">
      <JobsTabs />
      <header className="rounded-3xl bg-[var(--m-accent-soft)] p-6 sm:p-8">
        <h1 className="font-lp-display text-[32px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[44px]">Jobs</h1>
        <p className="mt-2 max-w-[56ch] text-[15px] leading-relaxed text-[var(--m-muted)]">Roles companies have posted on Capabilio. Applying from here opens once EPFO verification does, so employers see a verified record. Until then, track the jobs you apply for elsewhere in the Application tracker.</p>
      </header>
      {openings.length === 0 ? (
        <p className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-muted)]">No roles are open right now. Check back soon.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {openings.map((o) => (
            <li key={o.id} className="rounded-3xl border border-[var(--m-rule)] bg-white p-6">
              <p className="text-[13px] font-bold text-[var(--m-accent-ink)]">{o.companyName}</p>
              <h2 className="mt-1 font-lp-display text-[20px] font-bold leading-snug text-[var(--m-ink)]">{o.title}</h2>
              <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">{[o.team, o.location, WORK_MODE_LABEL[o.workMode], EMPLOYMENT_LABEL[o.employmentType]].filter(Boolean).join(" · ")}</p>
              {o.compensation && <p className="mt-1 text-[14px] font-bold text-[var(--m-ink)]">{o.compensation}</p>}
              <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{o.summary}</p>
              {postedLabel(o.publishedAt) && <p className="mt-3 text-[12.5px] text-[var(--m-muted)]">{postedLabel(o.publishedAt)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
