import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { BadgeArt } from "@/components/passport/badge/BadgeArt";
import type { GraduateHomeData } from "@/lib/graduate/home";

const H = "font-lp-display text-[18px] font-bold text-[var(--m-ink)]";

/** What someone who opens the passport would see, as plain facts: only things that were done, each with a count. */
export function RecruiterView({ proof, passport, vaultCount, interviewCount }: { proof: GraduateHomeData["proof"]; passport: GraduateHomeData["passport"]; vaultCount: number; interviewCount: number }) {
  const shown = proof.skills.filter((s) => s.badge).slice(0, 4);
  const rows: [string, string][] = [
    ["Skills proven", `${proof.earned} of ${proof.total}`],
    ["Arena tickets passed", String(proof.arenaPasses)],
    ["Arena rating", proof.rating === null ? "Starts with your first ticket" : String(proof.rating)],
    ["Interviews practised", String(interviewCount)],
    ["Items in your vault", String(vaultCount)],
  ];
  return (
    <section aria-labelledby="rv-h" className="flex flex-col rounded-3xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <h2 id="rv-h" className={H}>What a recruiter sees</h2>
      <div className="mt-4 flex h-[72px] items-center" aria-label={shown.length ? "Your top badges" : undefined}>
        {shown.length > 0 ? (
          <ul className="flex -space-x-3">{shown.map((s) => <li key={s.skillId} className="drop-shadow-[0_4px_4px_rgb(20_20_20/0.25)]"><BadgeArt skillId={s.skillId} name={s.name} level={s.badge!.level} size={64} /></li>)}</ul>
        ) : (
          <p className="max-w-[34ch] font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">Nothing yet, and that is what they would see too. Your first verified ticket puts a badge here.</p>
        )}
      </div>
      <dl className="mt-4 divide-y divide-[var(--m-rule)]!">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="font-lp-body text-[13.5px] text-[var(--m-muted)]">{k}</dt>
            <dd className="text-right font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 font-lp-body text-[12.5px] leading-relaxed text-[var(--m-muted)]">{passport.shared ? "Your public link is on, so anyone with it can open this." : "Your public link is off. Switch it on when you are ready to share."}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-4">
        <Link href="/dashboard/passport" className="inline-flex items-center gap-1.5 font-lp-body text-[13.5px] font-bold text-[var(--m-ink)] hover:underline">{passport.shared ? "Open and share" : "Open your passport"} <ArrowRight size={14} aria-hidden /></Link>
        {passport.shared && <span className="inline-flex items-center gap-1 font-lp-body text-[12.5px] text-[var(--m-muted)]">Public <ExternalLink size={11} aria-hidden /></span>}
      </div>
    </section>
  );
}
