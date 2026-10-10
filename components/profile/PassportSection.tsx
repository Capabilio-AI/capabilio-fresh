import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { PassportSkill } from "@/lib/passport/badges";
import { BadgeMark, NotEarnedMark } from "./Badge";
import { PassportShareToggle } from "./PassportShareToggle";
import { ReelDialog } from "@/components/passport/reel/ReelDialog";
import type { ReelInput } from "@/lib/passport/reel";

const CARD = "glass rounded-2xl p-5 sm:p-6";
const H2 = "font-lp-display text-[18px] font-bold text-[var(--m-ink)]";
const MUTED = "font-lp-body text-[14px] text-[var(--m-muted)]";
const LINK = "font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline";

export interface PassportSectionProps {
  holderName: string;
  college: string | null;
  passportNo: string;
  qrSvg: string;
  url: string;
  shared: boolean;
  unlocked: boolean;
  roleName: string | null;
  skills: PassportSkill[];
  reel: ReelInput;
}

export function SkillBadgeGrid({ skills }: { skills: PassportSkill[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {skills.map((s) => (
        <li key={s.skillId} className="flex items-center gap-3 rounded-xl bg-[var(--m-ground)] p-3">
          {s.badge ? <BadgeMark level={s.badge.level} /> : <NotEarnedMark />}
          <div className="min-w-0">
            <p className="truncate font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{s.name}</p>
            <p className="font-lp-body text-[12.5px] text-[var(--m-muted)]">
              {s.badge ? `${s.badge.level}${s.badge.provisional ? " · provisional" : ""} · ${s.badge.evidenceCount} evidence` : s.status === "building" ? "Still building" : "Not assessed yet"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PassportSection({ holderName, college, passportNo, qrSvg, url, shared, unlocked, roleName, skills, reel }: PassportSectionProps) {
  const earned = skills.filter((s) => s.badge).length;
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="flex min-w-0 flex-col gap-5">
      <section aria-labelledby="pp-h" className="overflow-hidden rounded-2xl bg-[var(--m-ink)] text-white">
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-lp-body text-[12px] font-bold uppercase tracking-wider text-white/60">
              <svg width="36" height="12" viewBox="0 0 44 14" aria-hidden><path d="M3 7h38" stroke="var(--m-accent)" strokeWidth="4" strokeLinecap="round" /><circle cx="3" cy="7" r="3" fill="var(--m-ink)" stroke="#fff" strokeWidth="2.5" /><circle cx="22" cy="7" r="3" fill="var(--m-ink)" stroke="#fff" strokeWidth="2.5" /><circle cx="41" cy="7" r="3" fill="var(--m-ink)" stroke="#fff" strokeWidth="2.5" /></svg>
              Capabilio digital skill passport
            </p>
            <h2 id="pp-h" className="mt-3 break-words font-lp-display text-[26px] font-bold leading-tight sm:text-[30px]">{holderName}</h2>
            {college && <p className="mt-1 font-lp-body text-[14px] text-white/70">{college}</p>}
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              <div><dt className="font-lp-body text-[11.5px] font-bold uppercase tracking-wider text-white/50">Passport no.</dt><dd className="mt-0.5 font-lp-display text-[18px] font-bold tabular-nums">{passportNo}</dd></div>
              <div><dt className="font-lp-body text-[11.5px] font-bold uppercase tracking-wider text-white/50">Badges earned</dt><dd className="mt-0.5 font-lp-display text-[18px] font-bold tabular-nums">{earned}</dd></div>
              {roleName && <div><dt className="font-lp-body text-[11.5px] font-bold uppercase tracking-wider text-white/50">Measured for</dt><dd className="mt-0.5 font-lp-display text-[18px] font-bold">{roleName}</dd></div>}
            </dl>
          </div>
          <div className="shrink-0 self-start rounded-xl bg-white p-2.5 sm:self-center">
            {/* An <img> with explicit pixel size: an inline SVG with only a viewBox collapsed to zero width in production. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`} width={160} height={160} alt="QR code for your public skill passport"
              className={`block h-40 w-40 ${shared ? "" : "opacity-40"}`} />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-white/15! bg-white px-5 py-4 text-[var(--m-ink)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <PassportShareToggle initial={shared} />
          {shared && <Link href={url} target="_blank" className={`${LINK} inline-flex items-center gap-1`}>Open public passport <ExternalLink size={12} aria-hidden /></Link>}
        </div>
      </section>

      <section className={CARD} aria-labelledby="badges-h">
        <h2 id="badges-h" className={H2}>Skill badges</h2>
        <p className={`mt-1 mb-4 ${MUTED} text-[13.5px]`}>A badge is earned from measured assessments and challenges, never from a claim. Foundation starts at 40, Proficient at 60 and Advanced at 80.</p>
        {unlocked ? <SkillBadgeGrid skills={skills} /> : (
          <p className={MUTED}>Your badges appear once your career assessment is analysed. <Link href="/assessment" className={`${LINK} inline-flex items-center gap-1`}>Go to assessment <ArrowRight size={13} aria-hidden /></Link></p>
        )}
      </section>
    </div>
    <aside aria-labelledby="reel-h" className="xl:sticky xl:top-4 xl:self-start">
      <h2 id="reel-h" className={H2}>Your proof reel</h2>
      <p className={`mt-1 mb-3 ${MUTED} text-[13.5px]`}>What people see first when they scan your QR: a short film made only from your verified evidence. It updates itself as you earn more.</p>
      <ReelDialog input={reel} />
    </aside>
    </div>
  );
}
