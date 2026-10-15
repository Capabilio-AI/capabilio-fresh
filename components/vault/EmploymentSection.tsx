import { Briefcase, Trash2 } from "lucide-react";
import { listEmployment } from "@/lib/stage/server";
import { removeEmployment } from "@/app/(app)/dashboard/vault/actions";
import { EmploymentForm } from "./EmploymentForm";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : null);

/** Where the person has worked, current job first. For recently graduated and professional profiles. */
export async function EmploymentSection({ userId, movesPath }: { userId: string; movesPath: boolean }) {
  const jobs = await listEmployment(userId);
  return (
    <section id="employment" aria-labelledby="employment-heading" className="scroll-mt-24">
      <h2 id="employment-heading" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Employment history</h2>
      <p className="mb-4 mt-1 font-lp-body text-[13.5px] text-app-muted">
        Where you have worked, most recent first.{movesPath ? " Adding the job you have now moves your profile to the professional path." : ""}
      </p>
      {jobs.length === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed border-[var(--m-off)] bg-white px-5 py-6 text-[13.5px] text-app-muted">No jobs added yet.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--m-rule)] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--m-ground)] text-[var(--m-ink)]"><Briefcase size={16} aria-hidden /></span>
                <div>
                  <p className="font-lp-body text-[14.5px] font-bold text-[var(--m-ink)]">{j.jobTitle}</p>
                  <p className="text-[13px] text-app-muted">{j.employerName}</p>
                  <p className="mt-0.5 text-[12.5px] text-app-muted">
                    {[fmt(j.startDate), j.endDate ? fmt(j.endDate) : "Present"].filter(Boolean).join(" – ")}
                  </p>
                </div>
              </div>
              <form action={removeEmployment.bind(null, j.id)}>
                <button type="submit" aria-label={`Remove ${j.jobTitle} at ${j.employerName}`} className="rounded-lg p-2 text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-red-600"><Trash2 size={15} aria-hidden /></button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <EmploymentForm movesPath={movesPath} />
    </section>
  );
}
