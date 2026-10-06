import Link from "next/link";
import type { VersionSummary } from "@/lib/roadmap-engine/read";
import { Section } from "./ui";

const WHY: Record<string, string> = { CAREER_CHANGE: "New career choice", CURRICULUM_PUBLISHED: "Your college updated its curriculum", PROGRESS_UPDATE: "Your progress changed", MANUAL: "You refreshed it" };

export function VersionHistory({ versions, viewing }: { versions: VersionSummary[]; viewing: string }) {
  return (
    <Section id="history" title="Version history" blurb="Every earlier version is kept, so you can see how your roadmap and readiness have changed.">
      <ul className="flex flex-col gap-1.5">
        {versions.map((v) => (
          <li key={v.versionId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[12.5px]">
            <span><strong className="text-app-charcoal">{v.careerName}</strong> · v{v.versionNo} · {new Date(v.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {v.readiness}% ready · <span className="text-app-muted">{WHY[v.trigger] ?? v.trigger}</span></span>
            {v.versionId === viewing ? <span className="font-lp-mono text-[11px] text-app-muted" aria-current="true">Viewing</span> : <Link href={`/dashboard/roadmap?version=${v.versionId}`} className="text-app-blue hover:underline">View</Link>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
