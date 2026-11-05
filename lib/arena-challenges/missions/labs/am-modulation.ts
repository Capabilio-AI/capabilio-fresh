import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Analog Communications: amplitude modulation. s(t) = Ac(1 + m·cos(2πfm t))·cos(2πfc t); bandwidth 2·fm; efficiency m²/(2 + m²).
interface S { fm: number; bandLow: number; bandHigh: number; sidebandMinW: number; totalMaxW: number; etaMin: number }

const FCS = [100, 200, 300, 450, 550, 640, 720, 810, 900, 1000, 1100, 1250, 1400, 1500];
const PCS = [10, 20, 30, 40, 50, 60, 80, 100];
const MS = Array.from({ length: 15 }, (_, i) => Number(((i + 1) / 10).toFixed(1)));

function analyse(s: S, st: Settings) {
  const fc = Number(st.fc);
  const m = Number(st.m);
  const pc = Number(st.pc);
  const sideband = (pc * m * m) / 2;
  return { fc, m, pc, sideband, total: pc + sideband, eta: (m * m) / (2 + m * m), bw: 2 * s.fm, inBand: fc - s.fm >= s.bandLow && fc + s.fm <= s.bandHigh };
}

const lab: Lab<S> = {
  key: "am-modulation",
  family: "ece",
  format: "simulation",
  name: "Modulator bench",
  topic: "Analog Communications · Amplitude modulation",
  keywords: ["analog communications", "communication", "modulation", "radio", "broadcast"],
  tools: ["AM modulator", "Carrier oscillator", "Oscilloscope", "Power meter"],
  skillTags: ["Modulation index", "AM bandwidth", "Power efficiency"],
  makeScenario(rng, d) {
    const fm = rng.pick([3, 4.5, 5, 8, 10]);
    const bandLow = rng.pick([300, 450, 540, 640]);
    const base: S = { fm, bandLow, bandHigh: bandLow + rng.pick([200, 300, 400]), sidebandMinW: 0, totalMaxW: Infinity, etaMin: d === "easy" ? 0.2 : d === "medium" ? 0.28 : 0.3 };
    let cheapest = Infinity;
    let maxSb = 0;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.inBand && a.m <= 1 && a.eta >= base.etaMin) {
        cheapest = Math.min(cheapest, a.total);
        maxSb = Math.max(maxSb, a.sideband);
      }
    }
    if (!Number.isFinite(cheapest)) return { ...base, sidebandMinW: 5, totalMaxW: 100 };
    return { ...base, sidebandMinW: Math.max(1, Math.round(cheapest * 0.1)), totalMaxW: Math.ceil(cheapest * (d === "easy" ? 2 : d === "medium" ? 1.4 : 1.05)) };
  },
  given: (s) => [
    { label: "Message", value: `speech up to ${s.fm} kHz` },
    { label: "Licensed band", value: `${s.bandLow}–${s.bandHigh} kHz` },
    { label: "Transmitter", value: `total power at most ${s.totalMaxW} W` },
  ],
  mission: (s) => `Set the carrier, modulation index and carrier power so the whole AM signal sits in ${s.bandLow}–${s.bandHigh} kHz, carries at least ${s.sidebandMinW} W in the sidebands, wastes no more than ${Math.round((1 - s.etaMin) * 100)}% on the carrier, and stays under ${s.totalMaxW} W.`,
  controls: () => [
    { kind: "choice", id: "fc", label: "Carrier frequency", options: choices(FCS, (v) => `${v} kHz`), default: "100" },
    { kind: "choice", id: "m", label: "Modulation index m", options: choices(MS), default: "0.1" },
    { kind: "choice", id: "pc", label: "Carrier power", options: choices(PCS, (v) => `${v} W`), default: "10" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("band", `Signal inside ${s.bandLow}–${s.bandHigh} kHz`, a.inBand, `${fmt(a.fc - s.fm, 1)}–${fmt(a.fc + s.fm, 1)} kHz`, "AM puts a sideband fm above and below the carrier. Both must fit in the licence."),
      objective("over", "No over-modulation (m ≤ 1)", a.m <= 1, `m = ${a.m}`, "Above m = 1 the envelope crosses zero and an envelope detector distorts the message."),
      objective("sb", `Sideband power ≥ ${s.sidebandMinW} W`, a.sideband >= s.sidebandMinW, `${fmt(a.sideband, 2)} W`, "The message lives in the sidebands: Pc·m²/2. A small m or weak carrier leaves little to receive."),
      objective("eta", `Efficiency ≥ ${Math.round(s.etaMin * 100)}%`, a.eta >= s.etaMin, `${fmt(a.eta * 100, 1)}%`, "Efficiency is m²/(2 + m²): the carrier carries no message."),
      objective("tot", `Total power ≤ ${s.totalMaxW} W`, a.total <= s.totalMaxW, `${fmt(a.total, 1)} W`, "Total power is Pc(1 + m²/2)."),
    ];
    const pts: [number, number][] = Array.from({ length: 241 }, (_, i) => {
      const t = i / 240;
      return [Number((t * 3).toFixed(3)), (1 + a.m * Math.cos(2 * Math.PI * t * 3)) * Math.cos(2 * Math.PI * t * 3 * 14)];
    });
    const env = (sign: number): [number, number][] => Array.from({ length: 121 }, (_, i) => [Number(((i / 120) * 3).toFixed(3)), sign * (1 + a.m * Math.cos(2 * Math.PI * (i / 120) * 3))]);
    return {
      readings: [
        gauge("eta", "Efficiency", a.eta * 100, `${fmt(a.eta * 100, 1)}%`, { min: 0, max: 40, low: s.etaMin * 100 }),
        gauge("tot", "Total power", a.total, `${fmt(a.total, 1)} W`, { min: 0, max: s.totalMaxW * 1.5, high: s.totalMaxW }),
        info("bw", "Bandwidth", `${fmt(a.bw, 1)} kHz`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "AM waveform (carrier drawn slower than real)",
        xLabel: "message cycles",
        yLabel: "amplitude",
        lines: [{ name: "s(t)", pts, style: "main" }, { name: "Envelope", pts: env(1), style: "ref" }, { name: "Envelope", pts: env(-1), style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `With m = ${a.m} the envelope swings between ${fmt(1 - a.m, 2)} and ${fmt(1 + a.m, 2)} of the carrier. The signal occupies ${fmt(a.bw, 1)} kHz around ${a.fc} kHz, the sidebands carry ${fmt(a.sideband, 2)} W of the ${fmt(a.total, 1)} W transmitted, so only ${fmt(a.eta * 100, 1)}% of the power carries the message. Pushing m up improves efficiency but past 1 the envelope distorts.`;
  },
  fallback: (s) => ({
    title: `Start a ${s.bandLow} kHz community radio`,
    story: `A village radio club has been given the ${s.bandLow}–${s.bandHigh} kHz slot for speech up to ${s.fm} kHz. Their transmitter can deliver at most ${s.totalMaxW} W and the listeners use cheap envelope-detector receivers.`,
  }),
};
export default defineLab(lab);
