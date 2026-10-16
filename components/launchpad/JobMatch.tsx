import Link from "next/link";
import { ArrowRight, Check, CircleDashed, HelpCircle, Hourglass } from "lucide-react";
import type { JobMatch as Match, SkillMatch } from "@/lib/launchpad/match";
import { JOB_READY_LEVEL } from "@/lib/launchpad/match";
import type { PractiseArea } from "@/lib/arena/skill-context";

function detail(s: SkillMatch): string {
  if (s.state === "met") return `Ready · level ${Math.round(s.level!)}`;
  if (s.state === "building") return `Building · level ${Math.round(s.level!)} of ${JOB_READY_LEVEL}`;
  if (s.state === "unmeasured") return "Not assessed yet";
  return "Not in the skill catalog yet";
}

function Icon({ state }: { state: SkillMatch["state"] }) {
  const cls = "mt-0.5 shrink-0";
  if (state === "met") return <Check size={13} className={`${cls} text-app-success`} aria-hidden />;
  if (state === "building") return <Hourglass size={13} className={`${cls} text-app-orange`} aria-hidden />;
  if (state === "unmeasured") return <CircleDashed size={13} className={`${cls} text-app-muted`} aria-hidden />;
  return <HelpCircle size={13} className={`${cls} text-app-muted`} aria-hidden />;
}

/**
 * How well the user's measured skills cover a job: one number plus the reason behind it, skill by skill. A skill nobody has measured is shown as
 * "not assessed", and a job skill we cannot place in the catalog is left out of the number and said so, so the percentage never pretends to know more.
 */
export function JobMatch({ match, practise }: { match: Match; practise: ReadonlyMap<string, PractiseArea> }) {
  if (match.total === 0) return null;
  const headline = match.percent === null ? "No match yet" : match.measured === 0 ? "No evidence yet" : `${match.percent}% match`;
  const basis =
    match.percent === null
      ? "None of the listed skills are in our catalog yet."
      : match.measured === 0
        ? "You have not been measured on these skills. Complete an Arena ticket to start."
        : `Based on ${match.measured} of ${match.counted} skill${match.counted === 1 ? "" : "s"} you have been measured on.`;
  const next = match.gaps.filter((g) => g.skillId).slice(0, 2);

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="flex items-baseline gap-2">
          <span className="font-lp-display text-[22px] font-bold leading-none text-app-charcoal">{headline}</span>
        </p>
        {match.percent !== null && match.measured > 0 && (
          <div role="img" aria-label={`${match.percent} percent match`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-border">
            <div className="h-full rounded-full bg-app-orange" style={{ width: `${match.percent}%` }} />
          </div>
        )}
        <p className="mt-1.5 font-lp-body text-[12px] text-app-muted">{basis}</p>
      </div>

      <ul className="flex flex-col gap-1">
        {match.skills.map((s) => (
          <li key={s.text} className="flex items-start gap-2 font-lp-body text-[12.5px]">
            <Icon state={s.state} />
            <span className="min-w-0">
              <span className="font-semibold text-app-charcoal">{s.text}</span>
              <span className="text-app-muted"> · {detail(s)}</span>
            </span>
          </li>
        ))}
      </ul>

      {next.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-app-border pt-2.5">
          {next.map((g) => {
            const area = practise.get(g.skillId!);
            return area ? (
              <Link key={g.text} href={`/arena/challenges/domain?focus=${area.areaKey}`} className="inline-flex w-fit items-center gap-1.5 font-lp-body text-[12.5px] font-semibold text-app-orange hover:underline">
                Strengthen {g.text}: practise {area.areaName} in Arena <ArrowRight size={12} aria-hidden />
              </Link>
            ) : (
              <Link key={g.text} href="/skillstudio" className="inline-flex w-fit items-center gap-1.5 font-lp-body text-[12.5px] font-semibold text-app-orange hover:underline">
                Strengthen {g.text}: learn it in SkillStudio <ArrowRight size={12} aria-hidden />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
