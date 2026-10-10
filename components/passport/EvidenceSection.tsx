import { BadgeCheck, ExternalLink } from "lucide-react";
import type { PublicEvidence } from "@/lib/passport/reel-data";

const H3 = "font-lp-body text-[12px] font-bold uppercase tracking-wider text-[var(--m-muted)]";
const MUTED = "font-lp-body text-[13px] text-[var(--m-muted)]";
const date = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

/** The verified work behind the badges, for whoever scans the QR. Titles, sources and dates only: never files, email or anything private. */
export function EvidenceSection({ evidence }: { evidence: PublicEvidence }) {
  const { groups, arena, proofs, github, interviews } = evidence;
  const empty = groups.length === 0 && arena.length === 0 && proofs.length === 0 && !github && !interviews;
  return (
    <section aria-labelledby="evidence" className="rounded-2xl bg-white p-5 sm:p-6">
      <h2 id="evidence" className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">Evidence behind it</h2>
      <p className="mt-1 mb-5 font-lp-body text-[13.5px] text-[var(--m-muted)]">The verified work this student has built on Capabilio, newest first. Each item was checked by the platform, not typed in by the student.</p>
      {empty ? <p className={MUTED}>No verified work yet.</p> : (
        <div className="flex flex-col gap-6">
          {groups.length > 0 && (
            <div>
              <h3 className={H3}>Skills shown in practice</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {groups.flatMap((g) => g.capabilities).slice(0, 14).map((c) => (
                  <li key={c.skill} className="rounded-full bg-[var(--m-ground)] px-3 py-1 font-lp-body text-[13px] font-bold text-[var(--m-ink)]">
                    {c.skill} <span className="font-normal text-[var(--m-muted)]">· {c.evidenceCount} proof{c.evidenceCount === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {arena.length > 0 && (
            <div>
              <h3 className={H3}>Arena challenges passed ({arena.length})</h3>
              <ul className="mt-2 divide-y divide-[var(--m-rule)]!">
                {arena.slice(0, 8).map((a) => (
                  <li key={a.attemptId} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5">
                    <span className="min-w-0 font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{a.title}</span>
                    <span className={MUTED}>{[a.area, a.company, date(a.completedAt)].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {proofs.length > 0 && (
            <div>
              <h3 className={H3}>Verified proof of work</h3>
              <ul className="mt-2 divide-y divide-[var(--m-rule)]!">
                {proofs.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 py-2.5">
                    <span className="inline-flex min-w-0 items-center gap-2 font-lp-body text-[14px] font-bold text-[var(--m-ink)]">
                      <BadgeCheck size={16} aria-hidden className="shrink-0 text-[var(--m-accent-ink)]" />
                      {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">{p.title}<ExternalLink size={12} aria-hidden /></a> : p.title}
                    </span>
                    <span className={`${MUTED} capitalize`}>{p.kind} · {date(p.addedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(github || interviews) && (
            <div>
              <h3 className={H3}>Also on record</h3>
              <ul className="mt-2 flex flex-col gap-1.5 font-lp-body text-[14px] text-[var(--m-ink)]">
                {github && <li><span className="font-bold">GitHub verified:</span> <a href={github.profileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--m-accent-ink)] hover:underline">@{github.username}</a>{github.repositories ? `, ${github.repositories} repositories analysed` : ""}</li>}
                {interviews && <li><span className="font-bold">AI mock interviews:</span> {interviews.count} completed, best score {interviews.best}/100, average {interviews.average}</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
