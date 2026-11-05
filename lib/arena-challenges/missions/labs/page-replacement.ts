import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Operating Systems: page replacement on a reference string. FIFO, LRU, Clock (second chance) and the unrealisable optimal (OPT).
interface S { refs: number[]; faultsMax: number; framesMax: number }

const ALGO = ["FIFO", "LRU", "Clock", "OPT"];
const FRAMES = [2, 3, 4, 5, 6, 7, 8, 10];

function faults(refs: number[], frames: number, algo: string): number {
  const mem: number[] = [];
  const ref = new Map<number, number>();
  let hand = 0;
  let f = 0;
  refs.forEach((p, t) => {
    if (mem.includes(p)) {
      if (algo === "LRU") { mem.splice(mem.indexOf(p), 1); mem.push(p); }
      if (algo === "Clock") ref.set(p, 1);
      return;
    }
    f++;
    if (mem.length < frames) { mem.push(p); ref.set(p, 1); return; }
    if (algo === "FIFO" || algo === "LRU") mem.shift();
    if (algo === "FIFO" || algo === "LRU") mem.push(p);
    else if (algo === "Clock") {
      while (ref.get(mem[hand]) === 1) { ref.set(mem[hand], 0); hand = (hand + 1) % frames; }
      mem[hand] = p; ref.set(p, 1); hand = (hand + 1) % frames;
    } else {
      let victim = 0;
      let far = -1;
      mem.forEach((m, i) => { const nx = refs.indexOf(m, t + 1); const d = nx < 0 ? Infinity : nx; if (d > far) { far = d; victim = i; } });
      mem[victim] = p;
    }
  });
  return f;
}
const analyse = (s: S, st: Settings) => ({ faults: faults(s.refs, Number(st.frames), String(st.algo)), frames: Number(st.frames), algo: String(st.algo) });

const lab: Lab<S> = {
  key: "page-replacement",
  family: "it",
  format: "puzzle",
  name: "Virtual memory lab",
  topic: "Operating Systems · Virtual memory and page replacement",
  keywords: ["operating systems", "virtual memory", "paging", "memory management", "computer architecture"],
  tools: ["Frame allocator", "Replacement policy", "Reference string", "Fault counter"],
  skillTags: ["Page faults", "LRU", "Belady's anomaly"],
  makeScenario(rng, d) {
    const pages = rng.int(5, 9);
    const refs: number[] = [];
    let cur = rng.int(0, pages - 1);
    for (let i = 0; i < rng.int(30, 50); i++) { cur = rng.chance(0.55) ? cur : rng.int(0, pages - 1); refs.push(cur); if (rng.chance(0.3)) refs.push(rng.int(0, pages - 1)); }
    const base: S = { refs, faultsMax: 0, framesMax: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => String(st.algo) !== "OPT"));
    const a = analyse(base, ref);
    return { refs, faultsMax: Math.ceil(a.faults * (d === "easy" ? 1.1 : 1)), framesMax: Math.min(10, a.frames + (d === "easy" ? 1 : 0)) };
  },
  given: (s) => [{ label: "Page references", value: s.refs.join(" ") }, { label: "Memory", value: `at most ${s.framesMax} frames` }, { label: "OS", value: "must decide online: it cannot know future references" }],
  mission: (s) => `Choose a realisable page-replacement policy and frame count that keep page faults at or below ${s.faultsMax} using no more than ${s.framesMax} frames.`,
  controls: () => [
    { kind: "choice", id: "algo", label: "Replacement policy", options: choices(ALGO, (v) => (v === "OPT" ? "OPT (needs the future)" : v)), default: "FIFO" },
    { kind: "choice", id: "frames", label: "Frames", options: choices(FRAMES), default: "2" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("f", `Page faults ≤ ${s.faultsMax}`, a.faults <= s.faultsMax, `${a.faults} faults of ${s.refs.length} references`, "More frames help, but not always for FIFO. Which policy exploits recent history?"),
      objective("m", `Frames ≤ ${s.framesMax}`, a.frames <= s.framesMax, `${a.frames} frames`, "RAM is shared with every other process."),
      objective("real", "Policy can run in a real OS", a.algo !== "OPT", a.algo === "OPT" ? "OPT is only a benchmark" : "online policy", "The optimal policy replaces the page used furthest in the future, which no OS can know."),
    ];
    const pts: [number, number][] = FRAMES.map((fr) => [fr, faults(s.refs, fr, a.algo)]);
    return {
      readings: [gauge("f", "Page faults", a.faults, String(a.faults), { min: 0, max: s.refs.length, high: s.faultsMax }), info("r", "Fault rate", `${fmt((a.faults / s.refs.length) * 100, 0)}%`)],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: `Faults against frames (${a.algo})`, xLabel: "frames", yLabel: "page faults", lines: [{ name: "Faults", pts, style: "main" }, { name: "Limit", pts: [[FRAMES[0], s.faultsMax], [FRAMES[FRAMES.length - 1], s.faultsMax]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `${a.algo} with ${a.frames} frames caused ${a.faults} faults on this ${s.refs.length}-reference string. LRU approximates the optimal policy by assuming recent pages will be used again; Clock approximates LRU cheaply with a reference bit; FIFO ignores usage and can even fault more when given more frames (Belady's anomaly). OPT is the lower bound used to judge the others.`;
  },
  fallback: (s) => ({ title: `Stop the thrashing on a ${s.framesMax}-frame device`, story: `A cheap kiosk has memory for only ${s.framesMax} pages and is crawling because it keeps reloading pages from flash. The OS engineer can choose the replacement policy and give the app a few frames.` }),
};
export default defineLab(lab);
