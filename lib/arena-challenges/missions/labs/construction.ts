import { fmt, gauge, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Critical path: A → B → (C ‖ D) → E. A crew of n works at n^0.85 worker-days per day (crowding); overtime adds 15% output at 1.5× wages.
interface S { scale: number; deadline: number; budget: number; siteLimit: number }

const ACTIVITIES = [
  { id: "a", name: "Excavation", work: 240 },
  { id: "b", name: "Foundations", work: 480 },
  { id: "c", name: "Structure", work: 900 },
  { id: "d", name: "Services (MEP)", work: 360 },
  { id: "e", name: "Finishing", work: 540 },
];
const WAGE = 800;
const OVERHEAD = 15000;

function plan(s: S, st: Settings) {
  const ot = st.shift === "overtime";
  const crew = (id: string) => Number(st[`crew_${id}`]);
  const days = ACTIVITIES.map((x) => Math.ceil((x.work * s.scale) / (crew(x.id) ** 0.85 * (ot ? 1.15 : 1))));
  const [da, db, dc, dd, de] = days;
  const startB = da;
  const startC = da + db;
  const startE = startC + Math.max(dc, dd);
  const starts = [0, startB, startC, startC, startE];
  const finish = startE + de;
  const wage = ot ? WAGE * 1.5 : WAGE;
  const cost = ACTIVITIES.reduce((sum, x, i) => sum + crew(x.id) * days[i] * wage, 0) + finish * OVERHEAD;
  const peak = Math.max(crew("a"), crew("b"), crew("c") + crew("d"), crew("e"));
  return { days, starts, finish, cost, peak, crew };
}

const lab: Lab<S> = {
  key: "construction-plan",
  family: "civil",
  format: "decision",
  name: "Site planning office",
  topic: "Construction Management · Scheduling and resources",
  keywords: ["construction", "estimating", "planning", "management", "project", "scheduling"],
  tools: ["Crew allocation", "Overtime shift", "Schedule table", "Budget tracker"],
  skillTags: ["Critical path", "Resource planning", "Cost control"],
  makeScenario(rng, d) {
    const scale = rng.pick([0.7, 0.85, 1, 1.15]);
    const ref = (n: number): Settings => ({ shift: "normal", crew_a: n, crew_b: n, crew_c: n, crew_d: n, crew_e: n });
    const base: S = { scale, deadline: 0, budget: 0, siteLimit: 0 };
    const mid = plan(base, ref(rng.pick([12, 16])));
    const slack = d === "easy" ? 1.25 : d === "medium" ? 1.1 : 1.02;
    return { scale, deadline: Math.ceil(mid.finish * slack), budget: Math.ceil((mid.cost * (d === "easy" ? 1.3 : d === "medium" ? 1.12 : 1.04)) / 10000) * 10000, siteLimit: d === "easy" ? 40 : d === "medium" ? 36 : 32 };
  },
  given: (s) => [
    { label: "Work", value: "excavation, foundations, then structure and services together, then finishing" },
    { label: "Deadline", value: `${s.deadline} working days` },
    { label: "Budget", value: `${rupees(s.budget)} for labour and site overhead (${rupees(OVERHEAD)} a day)` },
    { label: "Site limit", value: `no more than ${s.siteLimit} workers at once` },
  ],
  mission: (s) => `Plan the crews so the building finishes within ${s.deadline} days and ${rupees(s.budget)} without putting more than ${s.siteLimit} workers on site at once.`,
  controls: () => [
    ...ACTIVITIES.map((x) => ({ kind: "number" as const, id: `crew_${x.id}`, label: `${x.name} crew`, min: 4, max: 24, step: 4, unit: "workers", default: 4 })),
    { kind: "choice", id: "shift", label: "Working hours", options: [{ value: "normal", label: "Normal shift" }, { value: "overtime", label: "Overtime (+15% output, 1.5× wages)" }], default: "normal" },
  ],
  evaluate(s, st): Outcome {
    const p = plan(s, st);
    const objectives = [
      objective("time", `Finish within ${s.deadline} days`, p.finish <= s.deadline, `${p.finish} days`, "The finish date is set by the longest chain of activities. Which activity is slowing that chain?"),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, p.cost <= s.budget, rupees(p.cost), "Labour cost is crew × days × wage, and every extra day also adds site overhead. Is a bigger crew really saving money?"),
      objective("site", `At most ${s.siteLimit} workers on site`, p.peak <= s.siteLimit, `${p.peak} at the busiest time`, "Structure and services run side by side, so their crews add up. Can one of them be smaller without delaying the project?"),
    ];
    return {
      readings: [
        gauge("time", "Finish", p.finish, `day ${p.finish}`, { min: 0, max: Math.max(s.deadline * 1.5, p.finish * 1.1), high: s.deadline }),
        gauge("cost", "Total cost", p.cost, rupees(p.cost), { min: 0, max: Math.max(s.budget * 1.5, p.cost * 1.1), high: s.budget }),
        gauge("site", "Peak workers", p.peak, `${p.peak}`, { min: 0, max: Math.max(s.siteLimit * 1.5, p.peak * 1.1), high: s.siteLimit }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      table: {
        title: "Schedule",
        columns: ["Activity", "Crew", "Starts", "Ends", "Days"],
        rows: ACTIVITIES.map((x, i) => [x.name, String(p.crew(x.id)), `day ${p.starts[i] + 1}`, `day ${p.starts[i] + p.days[i]}`, String(p.days[i])]),
        bad: [],
      },
    };
  },
  explain(s, st) {
    const p = plan(s, st);
    const slower = p.days[2] >= p.days[3] ? "structure" : "services";
    return `Only the longest chain sets the finish date: excavation, foundations, then whichever of structure and services takes longer (${slower} here), then finishing, giving ${p.finish} days. Adding workers has diminishing returns because crowded crews get in each other's way, so doubling a crew does not halve its time, and every day saved also saves ${rupees(OVERHEAD)} of overhead. The cheapest plan puts extra people only on the activities that control the critical path, which cost ${rupees(p.cost)} in total here.`;
  },
  fallback: (s) => ({
    title: "Save the delayed project",
    story: `A three-storey office block is running late and the client is threatening penalties. The contractor has a fixed budget and a site that can only hold ${s.siteLimit} workers at a time, and must decide where to put the crews.`,
  }),
};
export default defineLab(lab);
