import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Mechanical Vibrations: machine on isolators. fn = (1/2π)√(k/m), r = f/fn, transmissibility T = √((1+(2ζr)²)/((1−r²)²+(2ζr)²)).
interface S { mass: number; rpm: number; tMax: number; peakMax: number; deflMaxMm: number }

const K = [40, 80, 150, 300, 600, 1200, 2500, 5000, 10000, 20000]; // N/mm per set of mounts
const MOUNT = [{ v: 0.03, n: "steel spring" }, { v: 0.08, n: "natural rubber" }, { v: 0.15, n: "neoprene pad" }, { v: 0.3, n: "oil-damped mount" }];
const trans = (r: number, z: number) => Math.sqrt((1 + (2 * z * r) ** 2) / ((1 - r * r) ** 2 + (2 * z * r) ** 2));

function analyse(s: S, st: Settings) {
  const k = Number(st.k) * 1000;
  const z = Number(st.z);
  const fn = Math.sqrt(k / s.mass) / (2 * Math.PI);
  const f = s.rpm / 60;
  return { fn, z, r: f / fn, f, t: trans(f / fn, z), peak: trans(1, z), defl: ((s.mass * 9.81) / k) * 1000, fn_: fn, k };
}

const lab: Lab<S> = {
  key: "vibration-isolation",
  family: "mech",
  format: "simulation",
  name: "Vibration bench",
  topic: "Mechanical Vibrations · Isolation and transmissibility",
  keywords: ["mechanical vibrations", "vibration", "theory of machines", "machine design", "dynamics", "structural and modal analysis"],
  tools: ["Mount stiffness", "Damping type", "Shaker table", "Transmissibility plot"],
  skillTags: ["Natural frequency", "Transmissibility", "Resonance"],
  makeScenario(rng, d) {
    const base: S = { mass: rng.pick([50, 80, 120, 200, 350, 500, 800, 1200]), rpm: rng.pick([600, 900, 1200, 1500, 1800, 2400, 3000]), tMax: 0, peakMax: 0, deflMaxMm: 0 };
    const ref = rng.pick([...gridSettings(lab.controls(base))].filter((st) => analyse(base, st).r > 1.6));
    const a = analyse(base, ref);
    const k = d === "easy" ? 1.8 : d === "medium" ? 1.3 : 1.05;
    return { ...base, tMax: Number((a.t * k).toFixed(3)), peakMax: Number((a.peak * (d === "easy" ? 1.6 : d === "medium" ? 1.25 : 1.05)).toFixed(1)), deflMaxMm: Math.ceil(a.defl * (d === "easy" ? 2 : d === "medium" ? 1.4 : 1.1)) };
  },
  given: (s) => [
    { label: "Machine", value: `${s.mass} kg, running at ${s.rpm} rpm (${fmt(s.rpm / 60, 1)} Hz)` },
    { label: "Start-up", value: `passes through resonance; peak ≤ ${s.peakMax}×` },
    { label: "Mount sag", value: `static deflection ≤ ${s.deflMaxMm} mm` },
  ],
  mission: (s) => `Choose mounts so only ${fmt(s.tMax * 100, 1)}% of the ${fmt(s.rpm / 60, 1)} Hz force reaches the floor, the start-up peak stays under ${s.peakMax}× and the sag stays under ${s.deflMaxMm} mm.`,
  controls: () => [
    { kind: "choice", id: "k", label: "Total mount stiffness", options: choices(K, (v) => `${v} N/mm`), default: "10000" },
    { kind: "choice", id: "z", label: "Mount type", options: MOUNT.map((m) => ({ value: String(m.v), label: `${m.n} (ζ = ${m.v})` })), default: "0.03" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("iso", `Transmitted force ≤ ${fmt(s.tMax * 100, 1)}%`, a.t <= s.tMax, `${fmt(a.t * 100, 1)}% (r = ${fmt(a.r)})`, "Isolation only starts when the machine runs faster than √2 times the natural frequency. How soft must the mounts be?"),
      objective("peak", `Resonance peak ≤ ${s.peakMax}×`, a.peak <= s.peakMax, `${fmt(a.peak, 1)}×`, "Damping limits the peak while starting up, but too much damping reduces isolation at speed."),
      objective("sag", `Static sag ≤ ${s.deflMaxMm} mm`, a.defl <= s.deflMaxMm, `${fmt(a.defl, 1)} mm`, "Soft mounts sag under the machine's weight: δ = m·g/k."),
    ];
    const pts: [number, number][] = Array.from({ length: 81 }, (_, i) => {
      const f = 0.5 + (i / 80) * Math.max(a.f * 2, a.fn * 3);
      return [Number(f.toFixed(2)), trans(f / a.fn, a.z)];
    });
    return {
      readings: [info("fn", "Natural frequency", `${fmt(a.fn, 1)} Hz`), gauge("t", "Force transmitted", a.t * 100, `${fmt(a.t * 100, 1)}%`, { min: 0, max: Math.max(150, s.tMax * 400), high: s.tMax * 100 }), gauge("peak", "Resonance peak", a.peak, `${fmt(a.peak, 1)}×`, { min: 0, max: Math.max(s.peakMax * 2, a.peak * 1.1), high: s.peakMax })],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "Transmissibility against forcing frequency", xLabel: "frequency (Hz)", yLabel: "transmissibility", lines: [{ name: "T", pts, style: "main" }, { name: "Machine speed", pts: [[a.f, 0], [a.f, Math.min(10, a.peak)]], style: "limit" }, { name: "Isolation limit (T = 1)", pts: [[0.5, 1], [Math.max(a.f * 2, a.fn * 3), 1]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `These mounts give a natural frequency of ${fmt(a.fn, 1)} Hz, so the ${fmt(a.f, 1)} Hz machine runs at r = ${fmt(a.r)}. Only for r above about 1.41 does transmissibility drop below 1, and the further above it the better, but a softer mount sags more (${fmt(a.defl, 1)} mm). Damping helps the start-up peak (${fmt(a.peak, 1)}×) while slightly worsening isolation at speed.`;
  },
  fallback: (s) => ({ title: `Quiet the ${s.mass} kg compressor`, story: `A ${s.mass} kg compressor running at ${s.rpm} rpm is shaking the floor of the lab above it. Maintenance can replace its mounts with a different stiffness and material.` }),
};
export default defineLab(lab);
