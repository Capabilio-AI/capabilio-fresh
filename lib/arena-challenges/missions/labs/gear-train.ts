import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { analyseGears, MODULES, narrowest, speedOk, TEETH_MAX, TEETH_MIN, type GearInput } from "../sim/gears";

// Machine Design: choose the teeth on four gears and the module so a two-stage reducer turns the output at the right speed, every pinion is strong
// enough for the torque, nothing is undercut, and the whole train fits the housing.
interface S { inRpm: number; targetRpm: number; tolerance: number; outTorqueNm: number; maxWidthMm: number }

const inputOf = (s: S, st: Settings): GearInput => ({ teeth: [Number(st.z1), Number(st.z2), Number(st.z3), Number(st.z4)], module: Number(st.m), inRpm: s.inRpm, outTorqueNm: s.outTorqueNm });

const lab: Lab<S> = {
  key: "gear-train",
  family: "mech",
  format: "simulation",
  surface: "gears",
  name: "Gear train workshop",
  topic: "Machine Design · Spur gear train design",
  keywords: ["machine design", "design of machine", "kinematics", "theory of machines", "gear", "transmission", "mechanical design", "automobile"],
  tools: ["Teeth counter", "Module chart", "Lewis strength check", "Housing gauge"],
  skillTags: ["Gear ratio", "Lewis equation", "Undercutting"],
  makeScenario(rng, d) {
    const inRpm = rng.pick([960, 1440, 2880]);
    const targetRpm = rng.pick([60, 90, 120, 180, 240]);
    const outTorqueNm = rng.int(4, 24) * 5;
    const tolerance = 0.03;
    const best = narrowest(inRpm, targetRpm, tolerance, outTorqueNm);
    const room = d === "easy" ? 1.5 : d === "medium" ? 1.25 : 1.1;
    return { inRpm, targetRpm, tolerance, outTorqueNm, maxWidthMm: best ? Math.ceil(best.widthMm * room) : 0 };
  },
  given: (s) => [
    { label: "Motor speed", value: `${s.inRpm} rpm` },
    { label: "Output needed", value: `${s.targetRpm} rpm (±3%) at ${s.outTorqueNm} N·m` },
    { label: "Housing", value: `centre distances add up to at most ${s.maxWidthMm} mm` },
    { label: "Gears", value: `steel spur gears, ${TEETH_MIN} to ${TEETH_MAX} teeth, safety factor 1.5` },
  ],
  mission: (s) => `Set the teeth on gears 1 to 4 and the module so the output runs at ${s.targetRpm} rpm (±3%), no gear has fewer than ${TEETH_MIN} teeth, both pinions carry ${s.outTorqueNm} N·m with a 1.5 safety factor, and the two centre distances add up to no more than ${s.maxWidthMm} mm.`,
  controls: () => [
    ...(["z1", "z2", "z3", "z4"] as const).map((id, i) => ({ kind: "number" as const, id, label: `Gear ${i + 1} teeth`, min: TEETH_MIN - 5, max: TEETH_MAX, step: 1, unit: "teeth", default: 20 })),
    { kind: "choice" as const, id: "m", label: "Module", options: choices(MODULES, (v) => `${v} mm`), default: String(MODULES[0]) },
  ],
  surfaceData: (s) => ({ inRpm: s.inRpm, targetRpm: s.targetRpm, tolerance: s.tolerance, outTorqueNm: s.outTorqueNm, maxWidthMm: s.maxWidthMm, modules: MODULES, tMin: TEETH_MIN, tMax: TEETH_MAX }),
  reference(s) {
    const best = narrowest(s.inRpm, s.targetRpm, s.tolerance, s.outTorqueNm);
    return best && best.widthMm <= s.maxWidthMm ? { z1: best.teeth[0], z2: best.teeth[1], z3: best.teeth[2], z4: best.teeth[3], m: String(best.module) } : null;
  },
  evaluate(s, st): Outcome {
    const r = analyseGears(inputOf(s, st));
    const weak = [r.strongEnough[0] ? null : "stage 1 pinion", r.strongEnough[1] ? null : "stage 2 pinion"].filter(Boolean);
    const objectives = [
      objective("speed", `Output ${s.targetRpm} rpm ±3%`, speedOk(r.outRpm, s.targetRpm, s.tolerance), `${fmt(r.outRpm, 0)} rpm (ratio ${fmt(r.ratio, 2)})`, "The overall ratio is (teeth of gear 2 ÷ gear 1) × (teeth of gear 4 ÷ gear 3). Output speed is the motor speed divided by that ratio."),
      objective("undercut", `Every gear has ≥ ${TEETH_MIN} teeth`, !r.undercut, r.undercut ? "a gear has too few teeth" : "no undercutting", "A pinion with too few teeth is cut away at the root and weakens. Seventeen is the usual minimum for standard teeth."),
      objective("strength", "Both pinions are strong enough", weak.length === 0, weak.length ? `${weak.join(" and ")} too weak` : `stage 1 ${fmt(r.allow[0] / r.need[0], 1)}× , stage 2 ${fmt(r.allow[1] / r.need[1], 1)}× the force`, "Tooth strength grows with the square of the module and with the number of teeth. A bigger module or a bigger pinion carries more torque."),
      objective("fit", `Fits in ${s.maxWidthMm} mm`, r.widthMm <= s.maxWidthMm, `${fmt(r.widthMm, 0)} mm`, "Centre distance is module × (teeth of both gears) ÷ 2. A big module is strong but wide. Balance the two."),
    ];
    return {
      readings: [
        gauge("rpm", "Output speed", r.outRpm, `${fmt(r.outRpm, 0)} rpm`, { min: 0, max: s.targetRpm * 2, low: s.targetRpm * (1 - s.tolerance), high: s.targetRpm * (1 + s.tolerance) }),
        gauge("width", "Housing width", r.widthMm, `${fmt(r.widthMm, 0)} mm`, { min: 0, max: s.maxWidthMm * 2, high: s.maxWidthMm }),
        info("sf", "Pinion safety", `${fmt(Math.min(r.allow[0] / r.need[0], r.allow[1] / r.need[1]), 1)}× (needs 1.5×)`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
    };
  },
  explain(s, st) {
    const r = analyseGears(inputOf(s, st));
    return `Your train reduces ${s.inRpm} rpm to ${fmt(r.outRpm, 0)} rpm with a ratio of ${fmt(r.ratio, 2)}, spread over two stages so neither mesh needs an extreme ratio. The module you chose sets both the tooth strength and the width: ${fmt(r.widthMm, 0)} mm of housing for ${s.outTorqueNm} N·m. Compound trains reach big reductions in a small space because the ratios multiply.`;
  },
  fallback: (s) => ({ title: `Gear a ${s.inRpm} rpm motor down to ${s.targetRpm} rpm`, story: `A conveyor needs ${s.outTorqueNm} N·m at a slow, steady speed from a fast motor. The engineer must pick the teeth and module of a two-stage reducer that fits the housing.` }),
};
export default defineLab(lab);
