import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { BestFitRole } from "@/lib/graduate/home";

/** Real open listings ranked by how well your measured skills cover them. A role we cannot compare is said to be uncomparable, never given a number. */
export function BestFitRoles({ roles }: { roles: BestFitRole[] }) {
  return (
    <section aria-labelledby="fit-h" className="rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="fit-h" className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Roles that fit you today</h2>
        <Link href="/launchpad" className="inline-flex items-center gap-1 font-lp-body text-[13px] font-bold text-[var(--m-ink)] hover:underline">All on Launchpad <ArrowRight size={14} aria-hidden /></Link>
      </div>
      {roles.length === 0 ? (
        <p className="mt-4 max-w-[58ch] font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">No roles are open right now. Jobs and internships appear here when employers or your college post them, ranked by how well you fit.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--m-rule)]!">
          {roles.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1 py-4">
              <div className="min-w-0">
                <p className="truncate font-lp-body text-[15px] font-bold text-[var(--m-ink)]">{r.role}</p>
                <p className="flex items-center gap-1.5 font-lp-body text-[12.5px] text-[var(--m-muted)]"><span className="truncate">{r.company}</span>{r.location && <><span aria-hidden>·</span><MapPin size={11} aria-hidden /><span className="truncate">{r.location}</span></>}</p>
              </div>
              <div className="text-right">
                {r.percent === null ? <p className="font-lp-body text-[12.5px] text-[var(--m-muted)]">Not comparable yet</p> : <p className="font-lp-display text-[24px] font-bold leading-none text-[var(--m-ink)]">{r.percent}<span className="text-[14px] font-semibold text-[var(--m-muted)]">% fit</span></p>}
                {r.percent !== null && <p className="mt-1 font-lp-body text-[11.5px] text-[var(--m-muted)]">{r.measured} of {r.counted} skills measured</p>}
              </div>
              {r.gaps.length > 0 && (
                <p className="col-span-2 font-lp-body text-[12.5px] text-[var(--m-muted)]">
                  To close: <span className="font-semibold text-[var(--m-ink)]">{r.gaps.join(", ")}</span>{" "}
                  <Link href={`/arena/prepare?job=${r.id}`} className="font-bold text-[var(--m-accent-ink)] hover:underline">Prepare for this role</Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
