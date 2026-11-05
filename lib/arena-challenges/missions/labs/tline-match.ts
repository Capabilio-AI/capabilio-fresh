import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Electromagnetic Waves and Transmission Lines: quarter-wave transformer matching a resistive load to a line, VSWR across a band.
interface S { z0: number; rl: number; f0: number; bandPct: number; vswrCentre: number; vswrEdge: number }

const ZT = Array.from({ length: 22 }, (_, i) => 20 + i * 6);
const LEN = [60, 70, 75, 80, 85, 90, 95, 100, 105, 110, 120];

function vswr(s: S, zt: number, lenDeg: number, f: number) {
  const bl = ((lenDeg * Math.PI) / 180) * (f / s.f0);
  const t = Math.tan(bl);
  // Zin = Zt (RL + j Zt t) / (Zt + j RL t)
  const nr = zt * s.rl;
  const ni = zt * zt * t;
  const dr = zt;
  const di = s.rl * t;
  const den = dr * dr + di * di;
  const zr = (nr * dr + ni * di) / den;
  const zi = (ni * dr - nr * di) / den;
  const gn = Math.hypot(zr - s.z0, zi);
  const gd = Math.hypot(zr + s.z0, zi);
  const g = Math.min(0.999, gn / gd);
  return (1 + g) / (1 - g);
}
function analyse(s: S, st: Settings) {
  const zt = Number(st.zt);
  const len = Number(st.len);
  let edge = 0;
  for (const k of [-1, 1]) edge = Math.max(edge, vswr(s, zt, len, s.f0 * (1 + (k * s.bandPct) / 100)));
  return { zt, len, centre: vswr(s, zt, len, s.f0), edge };
}

const lab: Lab<S> = {
  key: "tline-match",
  family: "ece",
  format: "simulation",
  name: "Smith chart bench",
  topic: "EM Waves and Transmission Lines · Impedance matching",
  keywords: ["electromagnetic waves", "transmission lines", "antennas", "microwave", "wave propagation", "radar"],
  tools: ["Transmission line", "Quarter-wave transformer", "VSWR meter", "Network analyser"],
  skillTags: ["Reflection coefficient", "VSWR", "Quarter-wave matching"],
  makeScenario(rng, d) {
    const z0 = rng.pick([50, 75]);
    const rl = rng.pick([20, 25, 30, 35, 100, 125, 150, 200, 250, 300]);
    return { z0, rl, f0: rng.pick([150, 400, 900, 1800, 2400, 5800]), bandPct: d === "easy" ? rng.pick([2, 3]) : d === "medium" ? rng.pick([4, 5]) : rng.pick([6, 8]), vswrCentre: d === "easy" ? 1.3 : d === "medium" ? 1.15 : 1.08, vswrEdge: d === "easy" ? 2 : d === "medium" ? 1.7 : 1.5 };
  },
  given: (s) => [
    { label: "Line", value: `${s.z0} Ω` },
    { label: "Antenna (load)", value: `${s.rl} Ω, resistive` },
    { label: "Centre frequency", value: `${s.f0} MHz, band ±${s.bandPct}%` },
  ],
  mission: (s) => `Match the ${s.rl} Ω antenna to the ${s.z0} Ω line: VSWR ≤ ${s.vswrCentre} at ${s.f0} MHz and ≤ ${s.vswrEdge} across the ±${s.bandPct}% band.`,
  controls: () => [
    { kind: "choice", id: "zt", label: "Transformer impedance", options: choices(ZT, (v) => `${v} Ω`), default: "20" },
    { kind: "choice", id: "len", label: "Transformer electrical length at centre", options: choices(LEN, (v) => `${v}°`), default: "60" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("centre", `VSWR ≤ ${s.vswrCentre} at ${s.f0} MHz`, a.centre <= s.vswrCentre, `VSWR ${fmt(a.centre)}`, "For a perfect match the transformer must be a quarter wavelength long and have the right impedance. What does that impedance depend on?"),
      objective("edge", `VSWR ≤ ${s.vswrEdge} across the band`, a.edge <= s.vswrEdge, `worst edge ${fmt(a.edge)}`, "Away from the centre frequency the line is no longer a quarter wave; a good centre match keeps the edges low."),
    ];
    const pts: [number, number][] = Array.from({ length: 61 }, (_, i) => {
      const f = s.f0 * (1 - 0.25 + (i / 60) * 0.5);
      return [Number(f.toFixed(1)), Math.min(8, vswr(s, a.zt, a.len, f))];
    });
    return {
      readings: [gauge("centre", "VSWR at centre", a.centre, fmt(a.centre), { min: 1, max: 6, high: s.vswrCentre }), gauge("edge", "Worst VSWR in band", a.edge, fmt(a.edge), { min: 1, max: 6, high: s.vswrEdge }), info("ref", "Return loss at centre", `${fmt(-20 * Math.log10((a.centre - 1) / (a.centre + 1) || 1e-6), 1)} dB`)],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: { title: "VSWR against frequency", xLabel: "frequency (MHz)", yLabel: "VSWR (clipped at 8)", lines: [{ name: "VSWR", pts, style: "main" }, { name: "Edge limit", pts: [[s.f0 * 0.75, s.vswrEdge], [s.f0 * 1.25, s.vswrEdge]], style: "ref" }] },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `A quarter-wave section of impedance √(Z0·RL) = ${fmt(Math.sqrt(s.z0 * s.rl), 1)} Ω turns ${s.rl} Ω into ${s.z0} Ω exactly at ${s.f0} MHz. Your ${a.zt} Ω, ${a.len}° section gives VSWR ${fmt(a.centre)} at the centre and ${fmt(a.edge)} at the worst band edge. It is only a perfect match at one frequency, which is why wider bands need more sections.`;
  },
  fallback: (s) => ({
    title: `Match the ${s.f0} MHz antenna`,
    story: `A ${s.f0} MHz antenna on a hill station presents ${s.rl} Ω to a ${s.z0} Ω feeder, and the reflected power is overheating the transmitter. A short transformer section must fix it across the whole channel.`,
  }),
};
export default defineLab(lab);
