import type { RoadmapView } from "@/lib/roadmap-engine/read";
import { Bar } from "./ui";
import { RefreshButton } from "./RefreshButton";

const ordinal = (n: number) => ({ 1: "1st", 2: "2nd", 3: "3rd" })[n as 1 | 2 | 3] ?? `${n}th`;
const when = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function Header({ view, position, regulation, showRefresh }: { view: RoadmapView; position: { year: number; semester: number } | null; regulation: string | null; showRefresh: boolean }) {
  const exploring = view.mode === "EXPLORING";
  const others = view.goals.filter((g) => g.kind !== "PRIMARY");
  return (
    <div className="rounded-2xl border border-app-border bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-lp-mono text-[11px] uppercase text-app-muted">{exploring ? "Best match while you explore" : "Your target career"}</p>
          <h2 className="font-lp-display text-[22px] font-semibold text-app-charcoal">{view.career.name}</h2>
          {others.length > 0 && (
            <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
              {others.map((g) => (g.kind === "PLAN_B" ? "Plan B" : "Also a good match")).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}:{" "}
              {others.map((g, i) => <span key={`${g.careerName}-${i}`}>{i > 0 && ", "}<strong className="text-app-charcoal">{g.careerName}</strong>{g.readiness != null && ` (${g.readiness}% ready)`}</span>)}
            </p>
          )}
          <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">
            {position ? <>Year {ordinal(position.year)}, semester {position.semester} (estimated from the calendar)</> : null}
            {regulation ? <> · Regulation {regulation}</> : null} · Version {view.versionNo}, {when(view.generatedAt)}
          </p>
        </div>
        {showRefresh && <RefreshButton />}
      </div>
      <div className="mt-4">
        <div className="flex items-baseline justify-between"><p className="font-lp-body text-[13px] font-medium text-app-charcoal">Readiness for {view.career.name}</p><p className="font-lp-display text-[20px] font-semibold text-app-charcoal">{view.readiness}%</p></div>
        <Bar value={view.readiness} label={`Readiness for ${view.career.name}`} />
        <details className="mt-2"><summary className="cursor-pointer font-lp-body text-[12.5px] text-app-blue">How is this calculated?</summary>
          <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{String(view.notes.readinessExplanation ?? "")}</p></details>
      </div>
    </div>
  );
}
