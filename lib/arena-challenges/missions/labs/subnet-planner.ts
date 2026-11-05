import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Computer Networks: VLSM subnetting. A /p subnet holds 2^(32−p) − 2 hosts.
interface S { hosts: number[]; names: string[]; blockPrefix: number; wasteMaxPct: number }

const PREFIX = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const NAMES = ["Engineering", "Sales", "Servers", "Guest Wi-Fi", "Labs", "Finance", "Cameras", "Management"];
const cap = (p: number) => 2 ** (32 - p) - 2;

function analyse(s: S, st: Settings) {
  const prefixes = s.hosts.map((_, i) => Number(st[`p${i}`]));
  const fits = prefixes.map((p, i) => cap(p) >= s.hosts[i]);
  const total = prefixes.reduce((a, p) => a + 2 ** (32 - p), 0);
  const need = s.hosts.reduce((a, h) => a + h, 0);
  return { prefixes, fits, total, blockSize: 2 ** (32 - s.blockPrefix), wastePct: (1 - need / total) * 100, used: prefixes.map((p) => 2 ** (32 - p)) };
}

const lab: Lab<S> = {
  key: "subnet-planner",
  family: "it",
  format: "puzzle",
  name: "Network planner",
  topic: "Computer Networks · IP addressing and VLSM",
  keywords: ["computer networks", "networks", "networking", "internet", "ip", "cyber security", "iot"],
  tools: ["Subnet mask selector", "Address space map", "Host counter"],
  skillTags: ["Subnetting", "VLSM", "Address planning"],
  makeScenario(rng, d) {
    const n = d === "easy" ? 3 : 4;
    const names = rng.shuffle(NAMES).slice(0, n);
    const hosts = Array.from({ length: n }, () => rng.pick([2, 5, 10, 25, 50, 60, 100, 120, 200, 250, 400, 500]));
    const blockPrefix = d === "easy" ? 20 : d === "medium" ? 21 : 22;
    const minTotal = hosts.reduce((a, h) => a + 2 ** Math.ceil(Math.log2(h + 2)), 0);
    const block = 2 ** (32 - blockPrefix);
    if (minTotal > block) return { hosts: hosts.map((h) => Math.min(h, 50)), names, blockPrefix: 20, wasteMaxPct: 60 };
    return { hosts, names, blockPrefix, wasteMaxPct: Math.min(75, Math.ceil(((1 - hosts.reduce((a, h) => a + h, 0) / minTotal) * 100) + (d === "easy" ? 8 : d === "medium" ? 3 : 0))) };
  },
  given: (s) => [{ label: "Address block", value: `one /${s.blockPrefix} (${2 ** (32 - s.blockPrefix)} addresses)` }, ...s.names.map((n, i) => ({ label: n, value: `${s.hosts[i]} hosts` })), { label: "Waste limit", value: `at most ${s.wasteMaxPct}% of allocated addresses unused` }],
  mission: (s) => `Give each department the right subnet size from the /${s.blockPrefix} block with at most ${s.wasteMaxPct}% of the allocated addresses wasted.`,
  controls: (s) => ((s as S | undefined)?.names ?? NAMES.slice(0, 3)).map((n, i) => ({ kind: "choice" as const, id: `p${i}`, label: `${n} subnet`, options: choices(PREFIX, (v) => `/${v} (${cap(Number(v))} hosts)`), default: "20" })),
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      ...s.hosts.map((h, i) => objective(`h${i}`, `${s.names[i]} fits ${h} hosts`, a.fits[i], `/${a.prefixes[i]} holds ${cap(a.prefixes[i])}`, "Usable hosts = 2^(32 − prefix) − 2: the network and broadcast addresses are not usable.")),
      objective("block", `Everything fits in the /${s.blockPrefix}`, a.total <= a.blockSize, `${a.total} of ${a.blockSize} addresses`, "The subnets must all be carved out of the one block you were given."),
      objective("waste", `Waste ≤ ${s.wasteMaxPct}%`, a.wastePct <= s.wasteMaxPct, `${fmt(a.wastePct, 0)}% unused`, "Too big a subnet strands addresses. Pick the smallest prefix that still fits."),
    ];
    return {
      readings: [gauge("use", "Address block used", a.total, `${a.total} / ${a.blockSize}`, { min: 0, max: a.blockSize * 1.5, high: a.blockSize }), gauge("w", "Wasted addresses", a.wastePct, `${fmt(a.wastePct, 0)}%`, { min: 0, max: 100, high: s.wasteMaxPct }), info("n", "Subnets", String(s.hosts.length))],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Addresses allocated per subnet", xLabel: "subnet", yLabel: "addresses", lines: [{ name: "Allocated", pts: a.used.map((u, i): [number, number] => [i + 1, u]), style: "main" }, { name: "Needed", pts: s.hosts.map((h, i): [number, number] => [i + 1, h + 2]), style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Variable-length subnet masks let each department get a subnet near its real size instead of one fixed size for all. Your choice allocates ${a.total} of the ${a.blockSize} addresses and leaves ${fmt(a.wastePct, 0)}% of them unused. The smallest prefix that fits h hosts has 2^k ≥ h + 2, where k = 32 − prefix; allocating the largest subnets first keeps them aligned in the address space.`;
  },
  fallback: (s) => ({ title: `Plan the office network for ${s.names.length} departments`, story: `A growing company has been given one address block and must split it among ${s.names.join(", ")}. Wasting addresses now means renumbering the whole building later.` }),
};
export default defineLab(lab);
