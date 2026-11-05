import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Operating Systems: CPU scheduling simulated tick by tick. FCFS, SJF (non-pre-emptive), SRTF, Round Robin, Priority (non-pre-emptive).
interface P { at: number; bt: number; pr: number }
interface S { procs: P[]; avgWaitMax: number; maxWaitMax: number; switchesMax: number }

const ALGO = ["FCFS", "SJF", "SRTF", "Round Robin", "Priority"];
const QUANTUM = [1, 2, 3, 4, 6, 8];

function simulate(procs: P[], algo: string, q: number) {
  const n = procs.length;
  const rem = procs.map((p) => p.bt);
  const done = Array<number>(n).fill(-1);
  const first = Array<number>(n).fill(-1);
  const queue: number[] = [];
  let t = 0;
  let cur = -1;
  let slice = 0;
  let switches = 0;
  let arrived = 0;
  const order = procs.map((_, i) => i).sort((a, b) => procs[a].at - procs[b].at);
  const enqueue = () => { while (arrived < n && procs[order[arrived]].at <= t) queue.push(order[arrived++]); };
  const pick = (): number => {
    if (!queue.length) return -1;
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[best];
      const better = algo === "SJF" ? rem[a] < rem[b] : algo === "SRTF" ? rem[a] < rem[b] : algo === "Priority" ? procs[a].pr < procs[b].pr : false;
      if (better) best = i;
    }
    return queue.splice(best, 1)[0];
  };
  let finished = 0;
  while (finished < n && t < 10_000) {
    enqueue();
    if (cur >= 0 && algo === "SRTF" && queue.some((i) => rem[i] < rem[cur])) { queue.push(cur); cur = -1; }
    if (cur < 0) { cur = pick(); slice = 0; if (cur >= 0) { switches++; if (first[cur] < 0) first[cur] = t; } }
    if (cur < 0) { t++; continue; }
    rem[cur]--; slice++; t++;
    enqueue();
    if (rem[cur] === 0) { done[cur] = t; finished++; cur = -1; }
    else if (algo === "Round Robin" && slice >= q) { queue.push(cur); cur = -1; }
  }
  const wait = procs.map((p, i) => done[i] - p.at - p.bt);
  return { wait, avg: wait.reduce((a, b) => a + b, 0) / n, max: Math.max(...wait), switches, response: procs.map((p, i) => first[i] - p.at) };
}
const analyse = (s: S, st: Settings) => simulate(s.procs, String(st.algo), Number(st.q));

const lab: Lab<S> = {
  key: "cpu-scheduler",
  family: "it",
  format: "simulation",
  name: "Scheduler lab",
  topic: "Operating Systems · CPU scheduling",
  keywords: ["operating systems", "process", "scheduling", "linux", "embedded", "real-time"],
  tools: ["Scheduling algorithm", "Time quantum", "Gantt chart", "Wait-time meter"],
  skillTags: ["Scheduling algorithms", "Waiting time", "Context switching"],
  makeScenario(rng, d) {
    const n = rng.int(5, 8);
    const procs: P[] = Array.from({ length: n }, () => ({ at: rng.int(0, 10), bt: rng.int(1, 12), pr: rng.int(1, 5) }));
    const base: S = { procs, avgWaitMax: 0, maxWaitMax: 0, switchesMax: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))]);
    const a = analyse(base, ref);
    const k = d === "easy" ? 1.12 : d === "medium" ? 1.03 : 1;
    return { procs, avgWaitMax: Number((a.avg * k + 0.1).toFixed(1)), maxWaitMax: Math.ceil(a.max * k) + 1, switchesMax: Math.ceil(a.switches * (d === "easy" ? 1.2 : d === "medium" ? 1.05 : 1)) };
  },
  given: (s) => [{ label: "Processes", value: s.procs.map((p, i) => `P${i + 1}(arr ${p.at}, burst ${p.bt}, prio ${p.pr})`).join("; ") }, { label: "Lower priority number", value: "means more important" }],
  mission: (s) => `Pick the scheduler so average waiting time ≤ ${s.avgWaitMax}, no process waits more than ${s.maxWaitMax} ticks, and there are at most ${s.switchesMax} context switches.`,
  controls: () => [
    { kind: "choice", id: "algo", label: "Algorithm", options: choices(ALGO), default: "FCFS" },
    { kind: "choice", id: "q", label: "Time quantum (Round Robin only)", options: choices(QUANTUM, (v) => `${v} ticks`), default: "1", when: { id: "algo", value: "Round Robin" } },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("avg", `Average wait ≤ ${s.avgWaitMax}`, a.avg <= s.avgWaitMax, fmt(a.avg, 2), "Running the shortest jobs first minimises average waiting time."),
      objective("max", `Longest wait ≤ ${s.maxWaitMax}`, a.max <= s.maxWaitMax, `${a.max} ticks`, "A scheduler that always favours short or urgent jobs can starve a long one."),
      objective("sw", `Context switches ≤ ${s.switchesMax}`, a.switches <= s.switchesMax, String(a.switches), "Every switch costs time. A short quantum multiplies them."),
    ];
    return {
      readings: [gauge("avg", "Average wait", a.avg, fmt(a.avg, 2), { min: 0, max: s.avgWaitMax * 2, high: s.avgWaitMax }), gauge("max", "Longest wait", a.max, String(a.max), { min: 0, max: s.maxWaitMax * 2, high: s.maxWaitMax }), info("resp", "Mean response time", fmt(a.response.reduce((x, y) => x + y, 0) / a.response.length, 1))],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Waiting time per process", xLabel: "process", yLabel: "waiting time (ticks)", lines: [{ name: "Wait", pts: a.wait.map((w, i): [number, number] => [i + 1, w]), style: "main" }, { name: "Limit", pts: [[1, s.maxWaitMax], [s.procs.length, s.maxWaitMax]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `${String(st.algo)} gave an average wait of ${fmt(a.avg, 2)} ticks, a worst wait of ${a.max} and ${a.switches} context switches. SJF/SRTF minimise the average but can starve long jobs; Round Robin is fair and gives quick responses but multiplies context switches when the quantum is small; Priority serves what matters most first but needs aging to avoid starvation. There is no best scheduler, only the one that fits the system's goal.`;
  },
  fallback: (s) => ({ title: `Schedule ${s.procs.length} jobs on one CPU`, story: `A small server must run ${s.procs.length} jobs of very different lengths on a single CPU core, and users complain when anything waits too long. The administrator picks the scheduling policy.` }),
};
export default defineLab(lab);
