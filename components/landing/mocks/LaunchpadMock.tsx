import { StateGlyph, type NodeState } from "../StateGlyph";
import Window from "./Window";

const ROLES: { t: string; org: string; need: { s: string; st: NodeState }[]; fit: string }[] = [
  { t: "Junior Data Analyst", org: "Sample company A", need: [{ s: "Python", st: "met" }, { s: "SQL", st: "learning" }, { s: "Statistics", st: "none" }], fit: "Close" },
  { t: "Analytics Intern", org: "Sample company B", need: [{ s: "Python", st: "met" }, { s: "EDA", st: "met" }], fit: "Strong" },
  { t: "BI Developer", org: "Sample company C", need: [{ s: "SQL", st: "learning" }, { s: "Dashboards", st: "locked" }], fit: "Later" },
];

export default function LaunchpadMock() {
  return (
    <Window title="Launchpad">
      <div className="grid gap-2.5 p-4 sm:p-5">
        {ROLES.map((r) => (
          <div key={r.t} className="rounded-xl border border-cap-line! p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-cap-display text-lg font-semibold leading-tight">{r.t}</div>
                <div className="text-[13px] text-cap-muted">{r.org}</div>
              </div>
              <span className="rounded-full bg-cap-indigo-soft px-3 py-1 text-xs font-semibold text-cap-indigo">{r.fit}</span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
              {r.need.map((n) => (
                <li key={n.s} className="flex items-center gap-1.5">
                  <StateGlyph state={n.st} size={14} ink="#0c1020" />
                  {n.s}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[13px] text-cap-muted">Matches come from measured skills. A gap is shown as a gap.</p>
      </div>
    </Window>
  );
}
