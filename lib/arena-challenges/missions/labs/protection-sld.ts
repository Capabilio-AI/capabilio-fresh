import { choices, fmt, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { opTime, PICKUP_A, TMS_VALUES } from "../sim/tcc";

// Switchgear and Protection: three overcurrent relays in series on a radial feeder. The student sets each relay's pickup and time multiplier so the
// relay nearest the fault clears it, the one behind it waits, and nothing trips on normal load. Worked on a single-line diagram with live curves.
interface S {
  /** normal load current seen by relay 1 (feeder), 2 (bus) and 3 (incomer), amps */
  load: [number, number, number];
  /** fault current at the end of zone 1, 2 and 3, amps */
  fault: [number, number, number];
  tMax: [number, number, number];
  margin: number;
}

const LOAD_MARGIN = 1.2;
const SENSITIVITY = 1.5;

const key = (k: number, part: "p" | "t") => `${part}${k}`;
const relayOf = (st: Settings, k: number) => ({ pickup: Number(st[key(k, "p")]), tms: Number(st[key(k, "t")]) });
const timeAt = (st: Settings, relay: number, currentA: number) => {
  const r = relayOf(st, relay);
  return opTime(currentA, r.pickup, r.tms);
};

function analyse(s: S, st: Settings) {
  const r1 = timeAt(st, 1, s.fault[0]);
  const t = {
    t1: r1,
    t2At1: timeAt(st, 2, s.fault[0]),
    t2: timeAt(st, 2, s.fault[1]),
    t3At2: timeAt(st, 3, s.fault[1]),
    t3: timeAt(st, 3, s.fault[2]),
  };
  const loadTrips = [1, 2, 3].filter((k) => Number.isFinite(timeAt(st, k, s.load[k - 1])));
  const blind = [1, 2, 3].filter((k) => !Number.isFinite(timeAt(st, k, s.fault[k - 1] / SENSITIVITY)));
  return { ...t, loadTrips, blind, d12: t.t2At1 - t.t1, d23: t.t3At2 - t.t2 };
}

/** The standard hand method: pickup just above load, then time multipliers set from the load end upstream. Null when the numbers leave no room. */
function reference(s: S): Settings | null {
  const st: Settings = {};
  for (let k = 1; k <= 3; k++) {
    const pick = PICKUP_A.find((p) => p >= s.load[k - 1] * LOAD_MARGIN);
    if (pick === undefined || pick > s.fault[k - 1] / SENSITIVITY) return null;
    st[key(k, "p")] = pick;
    st[key(k, "t")] = TMS_VALUES[0];
  }
  const raise = (k: number, ok: () => boolean) => {
    for (const tms of TMS_VALUES) {
      st[key(k, "t")] = tms;
      if (ok()) return true;
    }
    return false;
  };
  if (!raise(1, () => timeAt(st, 1, s.fault[0]) <= s.tMax[0])) return null;
  if (!raise(2, () => timeAt(st, 2, s.fault[0]) - timeAt(st, 1, s.fault[0]) >= s.margin)) return null;
  if (!raise(3, () => timeAt(st, 3, s.fault[1]) - timeAt(st, 2, s.fault[1]) >= s.margin)) return null;
  return st;
}

const lab: Lab<S> = {
  key: "protection-sld",
  family: "eee",
  format: "puzzle",
  surface: "sld",
  name: "Substation protection diagram",
  topic: "Switchgear and Protection · Overcurrent relay grading",
  keywords: ["switchgear", "protection", "power systems", "distribution", "relay", "high voltage", "power system"],
  tools: ["Single-line diagram", "Relay settings", "Time–current curves", "Fault simulator"],
  skillTags: ["IDMT relays", "Discrimination", "Time–current curves"],
  makeScenario(rng, d) {
    const l1 = rng.int(4, 16) * 5;
    const l2 = l1 + rng.int(2, 12) * 5;
    const l3 = l2 + rng.int(2, 12) * 5;
    const f1 = l1 * rng.int(9, 22);
    const f2 = Math.round(f1 * rng.pick([1.4, 1.7, 2]));
    const f3 = Math.round(f2 * rng.pick([1.3, 1.6, 2]));
    return { load: [l1, l2, l3], fault: [f1, f2, f3], tMax: d === "easy" ? [0.5, 1.2, 2.5] : d === "medium" ? [0.4, 1, 2] : [0.3, 0.8, 1.6], margin: d === "easy" ? 0.25 : d === "medium" ? 0.3 : 0.35 };
  },
  given: (s) => [
    { label: "Normal load at relays 1, 2, 3", value: `${s.load.join(", ")} A` },
    { label: "Fault current at the end of each zone", value: `${s.fault.join(", ")} A` },
    { label: "Time allowed to clear", value: `${s.tMax.join(", ")} s` },
    { label: "Grading margin between relays", value: `${s.margin} s` },
  ],
  mission: (s) => `Set the three relays so each picks up above its normal load, each sees its own zone's fault, relay 1 clears the ${s.fault[0]} A fault in ≤ ${s.tMax[0]} s, and each upstream relay waits at least ${s.margin} s longer than the one in front of it.`,
  controls: () => [1, 2, 3].flatMap((k) => [
    { kind: "choice" as const, id: key(k, "p"), label: `Relay ${k} pickup`, options: choices(PICKUP_A, (v) => `${v} A`), default: String(PICKUP_A[0]) },
    { kind: "choice" as const, id: key(k, "t"), label: `Relay ${k} time multiplier`, options: choices(TMS_VALUES), default: String(TMS_VALUES[TMS_VALUES.length - 1]) },
  ]),
  surfaceData: (s) => ({ load: s.load, fault: s.fault, tMax: s.tMax, margin: s.margin, pickups: PICKUP_A, tms: TMS_VALUES }),
  reference,
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const sec = (v: number) => (Number.isFinite(v) ? `${fmt(v, 2)} s` : "no trip");
    const objectives = [
      objective("load", "No relay trips on normal load", a.loadTrips.length === 0, a.loadTrips.length ? `relay ${a.loadTrips.join(", ")} would trip on load` : "all pickups are above their load", "A relay picks up when the current exceeds its pickup. Put the pickup above the largest current that flows every day, with room for a surge."),
      objective("sense", "Each relay sees its own zone's fault", a.blind.length === 0, a.blind.length ? `relay ${a.blind.join(", ")} would miss the fault at the end of its zone` : "all zones are covered", "A pickup set too high leaves the end of the feeder unprotected. The fault current must be comfortably above the pickup."),
      objective("fast", `Relay 1 clears ≤ ${s.tMax[0]} s, relay 3 ≤ ${s.tMax[2]} s`, a.t1 <= s.tMax[0] && a.t3 <= s.tMax[2], `relay 1 ${sec(a.t1)}, relay 3 ${sec(a.t3)}`, "A larger time multiplier slows a relay. The relay closest to the fault must be quick, but never so quick that the one behind it cannot be slower."),
      objective("disc12", `Relay 2 waits ≥ ${s.margin} s behind relay 1`, a.d12 >= s.margin, Number.isFinite(a.d12) ? `${fmt(a.d12, 2)} s margin` : "relay 2 does not operate", "For the same fault, the upstream relay must be slower than the downstream one by a safety margin, or both trip and the whole bus goes dark."),
      objective("disc23", `Relay 3 waits ≥ ${s.margin} s behind relay 2`, a.d23 >= s.margin, Number.isFinite(a.d23) ? `${fmt(a.d23, 2)} s margin` : "relay 3 does not operate", "Work upstream: grade relay 2 behind relay 1, then relay 3 behind relay 2."),
    ];
    return {
      readings: [info("t1", "Relay 1 clears its fault in", sec(a.t1)), info("t2", "Relay 2 on the same fault", sec(a.t2At1)), info("t3", "Relay 3 on zone 2's fault", sec(a.t3At2))],
      objectives,
      passed: objectives.every((o) => o.ok),
      overlay: { r1: Number.isFinite(a.t1) ? a.t1 : null, r2At1: Number.isFinite(a.t2At1) ? a.t2At1 : null, r3At2: Number.isFinite(a.t3At2) ? a.t3At2 : null },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `For the ${s.fault[0]} A fault, relay 1 clears it in ${fmt(a.t1, 2)} s while relay 2 would take ${fmt(a.t2At1, 2)} s, a margin of ${fmt(a.d12, 2)} s; relay 3 stays ${fmt(a.d23, 2)} s behind relay 2 for the zone-2 fault. That ladder of time margins is protection grading: only the breaker nearest the fault opens, and the others act as back-up if it fails.`;
  },
  fallback: (s) => ({ title: `Stop the ${s.fault[0]} A fault from blacking out the town`, story: `A short circuit on one feeder keeps tripping the whole substation. The protection engineer must grade three relays so only the one nearest the fault opens.` }),
};
export default defineLab(lab);
