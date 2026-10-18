import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// First-order RC low-pass: |H| = 1/sqrt(1 + (f/fc)^2), fc = 1/(2πRC).
interface S { fs: number; fn: number; attenDb: number; lossDb: number; rMin: number }

const RS = [100, 220, 470, 1000, 2200, 4700, 10000, 22000, 47000, 100000];
const CS = [1, 2.2, 4.7, 10, 22, 47, 100, 220, 470, 1000]; // nF
const gainDb = (f: number, fc: number) => -10 * Math.log10(1 + (f / fc) ** 2);
const fmtHz = (f: number) => (f >= 1000 ? `${fmt(f / 1000, 2)} kHz` : `${fmt(f, 0)} Hz`);

function analyse(s: S, st: Settings) {
  const r = Number(st.r);
  const c = Number(st.c) * 1e-9;
  const fc = 1 / (2 * Math.PI * r * c);
  return { r, fc, gSig: gainDb(s.fs, fc), gNoise: gainDb(s.fn, fc) };
}

const lab: Lab<S> = {
  key: "rc-filter",
  family: "ece",
  format: "lab",
  name: "Filter bench",
  topic: "Communication · Filters and noise",
  keywords: ["communication", "signal", "filter", "analog", "noise", "modulation"],
  tools: ["Resistors", "Capacitors", "Signal generator", "Spectrum plot"],
  skillTags: ["RC filters", "Cutoff frequency", "Noise rejection"],
  makeScenario(rng, d) {
    const fs = rng.pick([500, 1000, 2000, 3400, 5000]);
    // a first-order filter only falls 20 dB a decade, so the interference must sit far enough above the signal for one cutoff to fit between them
    const ratio = d === "easy" ? rng.int(25, 60) : d === "medium" ? rng.int(30, 50) : rng.int(45, 80);
    return { fs, fn: fs * ratio, attenDb: d === "hard" ? 26 : 20, lossDb: d === "easy" ? 1.5 : 1, rMin: 1000 };
  },
  given: (s) => [
    { label: "Wanted signal", value: fmtHz(s.fs) },
    { label: "Interference", value: fmtHz(s.fn) },
    { label: "Source", value: `cannot drive less than ${s.rMin / 1000} kΩ` },
  ],
  mission: (s) => `Pass the ${fmtHz(s.fs)} signal with at most ${s.lossDb} dB loss and cut the ${fmtHz(s.fn)} interference by at least ${s.attenDb} dB.`,
  controls: () => [
    { kind: "choice", id: "r", label: "Resistor", options: choices(RS, (v) => (Number(v) >= 1000 ? `${Number(v) / 1000} kΩ` : `${v} Ω`)), default: "100" },
    { kind: "choice", id: "c", label: "Capacitor", options: choices(CS, (v) => (Number(v) >= 1000 ? `${Number(v) / 1000} µF` : `${v} nF`)), default: "1" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("sig", `Signal loss ≤ ${s.lossDb} dB`, -a.gSig <= s.lossDb, `${fmt(-a.gSig)} dB lost`, "A low-pass filter starts cutting well below its cutoff. Where must the cutoff sit relative to the signal?"),
      objective("noise", `Interference cut ≥ ${s.attenDb} dB`, -a.gNoise >= s.attenDb, `${fmt(-a.gNoise)} dB cut`, "A first-order filter falls 20 dB for every tenfold rise in frequency above its cutoff. How far above the cutoff is the interference?"),
      objective("source", `Resistor ≥ ${s.rMin / 1000} kΩ`, a.r >= s.rMin, `${a.r >= 1000 ? a.r / 1000 + " kΩ" : a.r + " Ω"}`, "The source is weak: a small resistor loads it down. Keep R large and choose C to set the cutoff."),
    ];
    const pts: [number, number][] = Array.from({ length: 61 }, (_, i) => {
      const lf = 1 + (i * 5) / 60; // 10 Hz .. 1 MHz
      return [lf, gainDb(10 ** lf, a.fc)];
    });
    return {
      readings: [
        info("fc", "Cutoff frequency", fmtHz(a.fc)),
        gauge("sig", "Loss at the signal", -a.gSig, `${fmt(-a.gSig)} dB`, { min: 0, max: Math.max(s.lossDb * 4, -a.gSig * 1.1), high: s.lossDb }),
        gauge("noise", "Cut at the interference", -a.gNoise, `${fmt(-a.gNoise)} dB`, { min: 0, max: Math.max(s.attenDb * 2, -a.gNoise * 1.1), low: s.attenDb }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Filter response",
        xLabel: "log10 frequency (Hz)",
        yLabel: "gain (dB)",
        lines: [
          { name: "Gain", pts, style: "main" },
          { name: "Signal", pts: [[Math.log10(s.fs), -60], [Math.log10(s.fs), 0]], style: "ref" },
          { name: "Interference", pts: [[Math.log10(s.fn), -60], [Math.log10(s.fn), 0]], style: "limit" },
        ],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `The cutoff is fc = 1/(2πRC) = ${fmtHz(a.fc)}. At the signal the gain is ${fmt(a.gSig)} dB and at the interference ${fmt(a.gNoise)} dB. Because a first-order RC filter only falls 20 dB per decade, the signal and the noise must be far enough apart for one cutoff to sit between them: below the cutoff you keep the signal, above it you cut the noise. A sharper cut needs a higher-order filter.`;
  },
  fallback: (s) => ({
    title: `Clean the ${fmtHz(s.fs)} radio signal`,
    story: `A field radio receiver picks up a ${fmtHz(s.fn)} buzz from a nearby motor that drowns the wanted ${fmtHz(s.fs)} signal. The technician can add one passive filter between the receiver and the speaker.`,
  }),
};
export default defineLab(lab);
