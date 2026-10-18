import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Jib crane: a horizontal boom pinned to a wall at its root, held by a cable from the boom tip to a wall anchor h metres above the pin.
// Moment about the pin: T·sinθ·L = W·a, with tanθ = h / L. Pin reaction from the force balance. Rope ultimate 450 MPa, pin shear allowable 90 MPa (double shear).
interface S { l: number; a: number; w: number; sfMin: number; hMax: number; budget: number }

const ROPE_ULT = 450;
const PIN_TAU = 90;
const ROPE_PRICE_PER_M = (d: number) => 18 * d; // ₹ per metre
const PIN_PRICE = (d: number) => 60 * d;

function analyse(s: S, st: Settings) {
  const h = Number(st.h);
  const d = Number(st.rope);
  const pin = Number(st.pin);
  const theta = Math.atan2(h, s.l);
  const t = (s.w * s.a) / (s.l * Math.sin(theta)); // kN
  const rx = t * Math.cos(theta);
  const ry = s.w - t * Math.sin(theta);
  const r = Math.hypot(rx, ry);
  const sf = (ROPE_ULT * ((Math.PI * d * d) / 4)) / (t * 1000); // MPa × mm² = N
  const tau = (r * 1000) / (2 * ((Math.PI * pin * pin) / 4));
  const length = Math.hypot(s.l, h);
  const cost = length * ROPE_PRICE_PER_M(d) + PIN_PRICE(pin) + h * 450;
  return { h, theta, t, r, sf, tau, cost, length };
}

const lab: Lab<S> = {
  key: "crane",
  family: "mech",
  format: "simulation",
  name: "Crane workshop",
  topic: "Engineering Mechanics · Equilibrium and reactions",
  keywords: ["engineering mechanics", "statics", "mechanics", "machine design", "design of machine", "applied mechanics"],
  tools: ["Anchor height", "Rope selector", "Pin selector", "Force meter"],
  skillTags: ["Equilibrium", "Cable tension", "Pin shear"],
  makeScenario(rng, d) {
    const l = rng.pick([2.5, 3, 3.5, 4]);
    return {
      l, a: l * rng.pick([0.8, 0.9, 1]), w: rng.pick([8, 10, 12, 15]), sfMin: d === "easy" ? 3 : d === "medium" ? 4 : 4.5,
      hMax: rng.pick([2.5, 3, 3.5]), budget: d === "easy" ? 9000 : d === "medium" ? 8000 : 7500,
    };
  },
  given: (s) => [
    { label: "Boom", value: `${s.l} m horizontal, pinned at the wall` },
    { label: "Load", value: `${s.w} kN hanging ${fmt(s.a, 1)} m from the pin` },
    { label: "Materials", value: `rope ultimate strength ${ROPE_ULT} MPa; pin shear allowable ${PIN_TAU} MPa (double shear)` },
  ],
  mission: (s) => `Hold the load with a rope safety factor of at least ${s.sfMin}, a pin that stays within its shear limit, an anchor no higher than ${s.hMax} m and a total cost of at most ${rupees(s.budget)}.`,
  controls: () => [
    { kind: "number", id: "h", label: "Anchor height above the pin", min: 0.5, max: 4, step: 0.25, unit: "m", default: 0.5 },
    { kind: "choice", id: "rope", label: "Rope diameter", options: choices([6, 8, 10, 12, 14, 16], (v) => `${v} mm`), default: "6" },
    { kind: "choice", id: "pin", label: "Pin diameter", options: choices([10, 12, 16, 20, 25], (v) => `${v} mm`), default: "10" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("rope", `Rope safety factor ≥ ${s.sfMin}`, a.sf >= s.sfMin, `${fmt(a.sf, 1)} with ${fmt(a.t, 1)} kN in the rope`, "A rope pulling at a shallow angle must carry far more than the load itself. What does a steeper rope do to the tension?"),
      objective("pin", `Pin shear ≤ ${PIN_TAU} MPa`, a.tau <= PIN_TAU, `${fmt(a.tau, 0)} MPa under ${fmt(a.r, 1)} kN`, "The pin carries the resultant of the rope's horizontal pull and the vertical balance. A bigger section lowers the stress."),
      objective("height", `Anchor ≤ ${s.hMax} m above the pin`, a.h <= s.hMax, `${fmt(a.h, 2)} m`, "The wall only allows an anchor so high, so you cannot use height alone."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "A steeper rope is shorter in tension but longer to buy; thicker rope and pins cost more. Find the balance."),
    ];
    const pts = Array.from({ length: 15 }, (_, i): [number, number] => {
      const h = 0.5 + i * 0.25;
      return [h, (s.w * s.a) / (s.l * Math.sin(Math.atan2(h, s.l)))];
    });
    return {
      readings: [
        gauge("sf", "Rope safety factor", a.sf, fmt(a.sf, 1), { min: 0, max: s.sfMin * 3, low: s.sfMin }),
        gauge("pin", "Pin shear stress", a.tau, `${fmt(a.tau, 0)} MPa`, { min: 0, max: PIN_TAU * 2, high: PIN_TAU }),
        gauge("cost", "Cost", a.cost, rupees(a.cost), { min: 0, max: s.budget * 1.6, high: s.budget }),
        info("t", "Rope tension", `${fmt(a.t, 1)} kN at ${fmt((a.theta * 180) / Math.PI, 0)}° to the boom`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Rope tension against anchor height",
        xLabel: "anchor height (m)",
        yLabel: "rope tension (kN)",
        lines: [{ name: "Tension", pts, style: "main" }, { name: "Your anchor", pts: [[a.h, 0], [a.h, Math.max(...pts.map((p) => p[1]))]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Taking moments about the pin, the vertical part of the rope tension must balance the load's moment: T·sinθ·L = W·a. With the anchor ${fmt(a.h, 2)} m up, the rope is at ${fmt((a.theta * 180) / Math.PI, 0)}° and carries ${fmt(a.t, 1)} kN, much more than the ${s.w} kN load because most of its pull is horizontal. That horizontal pull is resisted by the pin, so the pin takes ${fmt(a.r, 1)} kN in double shear, ${fmt(a.tau, 0)} MPa. Raising the anchor lowers the tension but needs a longer rope and a taller wall fixing, which is the trade-off the budget and the wall limit enforce. These are teaching calculations, not a substitute for a lifting-equipment design check.`;
  },
  fallback: (s) => ({
    title: `Rig a ${s.w} kN jib crane`,
    story: "A small workshop wants a wall-mounted jib crane for lifting engine blocks. You choose where to anchor the rope, and the rope and pin sizes.",
  }),
};
export default defineLab(lab);
