import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";
import { makeRng } from "@/lib/workplace/rng";

// Cloud and Distributed Systems: discrete-time simulation of a load balancer in front of servers of mixed speed. Latency = queue wait + service.
interface S { seed: number; baseRps: number; spikeRps: number; p95MaxMs: number; dropMaxPct: number; budget: number }

const SERVERS = [2, 3, 4, 5, 6, 8, 10, 12];
const ALGO = ["round robin", "least connections", "random"];
const QUEUE = [10, 25, 50, 100, 200];
const SPEEDS = [120, 100, 100, 80, 80, 60, 60, 60, 50, 50, 50, 50]; // requests per second each server can serve
const PRICE = 9000;

function simulate(s: S, st: Settings) {
  const n = Number(st.servers);
  const algo = String(st.algo);
  const qmax = Number(st.queue);
  const rng = makeRng(s.seed);
  const speed = SPEEDS.slice(0, n);
  const queue = Array<number>(n).fill(0);
  let rr = 0;
  let sent = 0;
  let dropped = 0;
  const lat: [number, number][] = []; // [latency ms, number of requests it stands for]
  for (let t = 0; t < 120; t++) {
    const rps = t >= 40 && t < 70 ? s.spikeRps : s.baseRps;
    const arrivals = Math.max(0, Math.round(rps + rng.int(-10, 10) * rps * 0.01));
    // how many requests each server is offered this second
    const offered = Array<number>(n).fill(0);
    if (algo === "round robin") { for (let i = 0; i < n; i++) offered[i] = Math.floor(arrivals / n); for (let r = 0; r < arrivals % n; r++) offered[rr++ % n]++; }
    else if (algo === "random") for (let a = 0; a < arrivals; a++) offered[rng.int(0, n - 1)]++;
    else { for (let a = 0; a < arrivals; a += Math.max(1, Math.ceil(arrivals / 60))) { const i = queue.indexOf(Math.min(...queue.map((q, k) => q + offered[k]))); const step = Math.min(Math.max(1, Math.ceil(arrivals / 60)), arrivals - a); offered[i] += step; queue[i] += 0; } }
    sent += arrivals;
    for (let i = 0; i < n; i++) {
      const take = Math.max(0, Math.min(offered[i], qmax - queue[i]));
      dropped += offered[i] - take;
      if (take > 0) { const samples = Math.min(take, 12); for (let j = 1; j <= samples; j++) lat.push([((queue[i] + (j * take) / samples) / speed[i]) * 1000, take / samples]); }
      queue[i] = Math.max(0, queue[i] + take - speed[i]);
    }
  }
  lat.sort((a, b) => a[0] - b[0]);
  const total = lat.reduce((a, l) => a + l[1], 0);
  let acc = 0;
  let p95 = 0;
  for (const [ms, w] of lat) { acc += w; if (acc >= total * 0.95) { p95 = ms; break; } }
  return { p95, dropPct: sent ? (dropped / sent) * 100 : 0, cost: n * PRICE, capacity: speed.reduce((a, b) => a + b, 0), n };
}
const analyse = simulate;

const lab: Lab<S> = {
  key: "load-balancer",
  family: "it",
  format: "simulation",
  name: "Traffic simulator",
  topic: "Cloud Computing and Distributed Systems · Load balancing and capacity",
  keywords: ["cloud computing", "distributed systems", "web", "devops", "computer networks", "operating systems", "microservices"],
  tools: ["Server count", "Balancing algorithm", "Queue limit", "Latency percentile meter"],
  skillTags: ["Load balancing", "Tail latency", "Capacity planning"],
  makeScenario(rng, d) {
    const base: S = { seed: rng.int(1, 1_000_000), baseRps: rng.pick([60, 100, 150, 200, 300]), spikeRps: 0, p95MaxMs: 0, dropMaxPct: 0, budget: 0 };
    const withSpike = { ...base, spikeRps: Math.round(base.baseRps * rng.pick([1.5, 2, 2.5])) };
    const ref = rng.pick([...gridSettings(lab.controls(withSpike))].filter((st) => simulate(withSpike, st).dropPct < 5));
    const a = analyse(withSpike, ref);
    return { ...withSpike, p95MaxMs: Math.ceil(a.p95 * (d === "easy" ? 1.6 : d === "medium" ? 1.25 : 1.05) + 10), dropMaxPct: Number((a.dropPct * (d === "easy" ? 2 : d === "medium" ? 1.4 : 1.1) + (d === "easy" ? 2 : 0.3)).toFixed(1)), budget: Math.ceil((a.cost * (d === "easy" ? 1.5 : d === "medium" ? 1.2 : 1.04)) / 1000) * 1000 };
  },
  given: (s) => [{ label: "Traffic", value: `${s.baseRps} requests/s, spiking to ${s.spikeRps}/s for 30 s` }, { label: "Servers", value: "mixed speeds, 50–120 requests/s each, " + rupees(PRICE) + " per month" }, { label: "Budget", value: rupees(s.budget) + " per month" }],
  mission: (s) => `Size the cluster so the 95th-percentile latency stays ≤ ${s.p95MaxMs} ms and at most ${s.dropMaxPct}% of requests are dropped through the spike, within ${rupees(s.budget)} a month.`,
  controls: () => [
    { kind: "choice", id: "servers", label: "Servers", options: choices(SERVERS), default: "2" },
    { kind: "choice", id: "algo", label: "Balancing algorithm", options: choices(ALGO), default: "round robin" },
    { kind: "choice", id: "queue", label: "Queue limit per server", options: choices(QUEUE), default: "10" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("p95", `p95 latency ≤ ${s.p95MaxMs} ms`, a.p95 <= s.p95MaxMs, `${fmt(a.p95, 0)} ms`, "Tail latency is set by queues. A long queue on one slow server hurts the worst 5%."),
      objective("drop", `Dropped ≤ ${s.dropMaxPct}%`, a.dropPct <= s.dropMaxPct, `${fmt(a.dropPct, 1)}%`, "Requests are dropped when a queue is full. Capacity must cover the spike, not the average."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Every server is paid for whether it is busy or not."),
    ];
    const pts: [number, number][] = SERVERS.map((n) => [n, simulate(s, { ...st, servers: n }).p95]);
    return {
      readings: [info("cap", "Total capacity", `${a.capacity} req/s`), gauge("p95", "p95 latency", a.p95, `${fmt(a.p95, 0)} ms`, { min: 0, max: s.p95MaxMs * 2, high: s.p95MaxMs }), gauge("drop", "Dropped", a.dropPct, `${fmt(a.dropPct, 1)}%`, { min: 0, max: Math.max(10, s.dropMaxPct * 2), high: s.dropMaxPct })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "p95 latency against server count (your algorithm and queue)", xLabel: "servers", yLabel: "p95 latency (ms)", lines: [{ name: "p95", pts, style: "main" }, { name: "Limit", pts: [[SERVERS[0], s.p95MaxMs], [SERVERS[SERVERS.length - 1], s.p95MaxMs]], style: "limit" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The cluster can serve ${a.capacity} requests/s in total against a ${s.spikeRps}/s spike. Round robin ignores server speed, so slow servers build long queues; least-connections steers load to whichever server is free; random is cheap but uneven. Latency explodes as utilisation approaches 100%, which is why you plan capacity for the peak and keep queues short enough to fail fast instead of making everyone wait.`;
  },
  fallback: (s) => ({ title: `Survive the ${s.spikeRps} requests/s sale`, story: `An online store's traffic doubles for half a minute whenever a flash sale opens. The platform engineer must choose how many servers to run and how the balancer spreads the load, without blowing the monthly bill.` }),
};
export default defineLab(lab);
