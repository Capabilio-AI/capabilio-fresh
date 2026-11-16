import { windowFromDeadline } from "@/lib/stage/verification";
import { ResumeUpload } from "./ResumeUpload";

const DEADLINE_FMT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

/** The two things a professional does first: add a resume, and be verified through EPFO within seven days. */
export function FinishSetup({ resumeDone, epfoVerified, deadline }: { resumeDone: boolean; epfoVerified: boolean; deadline: string | null }) {
  const window = deadline ? windowFromDeadline(deadline) : null;
  return (
    <section aria-labelledby="setup-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 sm:p-7">
      <h2 id="setup-h" className="font-lp-display text-[22px] font-bold leading-tight text-[var(--m-ink)]">Finish setting up</h2>
      <ol className="mt-4 grid gap-4 md:grid-cols-2">
        <li className="rounded-2xl bg-[var(--m-ground)] p-4">
          <p className="text-[13px] font-bold text-[var(--m-muted)]">1. Resume</p>
          <p className="mt-1 text-[15px] font-bold text-[var(--m-ink)]">{resumeDone ? "Added. Your portfolio is filled in from it." : "Add your resume and your portfolio fills in from it."}</p>
          {!resumeDone && <div className="mt-3"><ResumeUpload /></div>}
        </li>
        <li className="rounded-2xl bg-[var(--m-ground)] p-4">
          <p className="text-[13px] font-bold text-[var(--m-muted)]">2. EPFO verification</p>
          <p className="mt-1 text-[15px] font-bold text-[var(--m-ink)]">{epfoVerified ? "Verified." : window ? `Verify within 7 days, by ${DEADLINE_FMT.format(new Date(window.deadline))} (${window.daysLeft} ${window.daysLeft === 1 ? "day" : "days"} left).` : "Verify within 7 days of signing up."}</p>
          {!epfoVerified && (
            <>
              <button type="button" disabled className="mt-3 inline-flex cursor-not-allowed items-center rounded-full border border-[var(--m-off)] px-5 py-2.5 text-[13.5px] font-bold text-[var(--m-muted)]">EPFO verification opens soon</button>
              <p className="mt-2 text-[13px] text-[var(--m-muted)]">Accounts not verified within 7 days will be deactivated once verification opens. Nothing is deactivated before then.</p>
            </>
          )}
        </li>
      </ol>
    </section>
  );
}
