import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Digital Signal Processing: windowed-sinc FIR low-pass. The response is computed from the real coefficients, like freqz in MATLAB.
interface S { fsamp: number; fpass: number; fstop: number; attenDb: number; rippleDb: number; maxTaps: number }

const WINDOWS = ["rectangular", "hann", "hamming", "blackman"] as const;
const TAPS = [11, 15, 19, 23, 27, 31, 35, 41, 47, 55, 63, 71, 79, 87, 95, 103];
const win = (name: string, n: number, N: number) =>
  name === "rectangular" ? 1 : name === "hann" ? 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) : name === "hamming" ? 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1)) : 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (N - 1));

function response(s: S, window: string, N: number) {
  const fc = (s.fpass + s.fstop) / 2 / s.fsamp; // cycles per sample
  const h = Array.from({ length: N }, (_, n) => {
    const m = n - (N - 1) / 2;
    return (m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m)) * win(window, n, N);
  });
  const dc = h.reduce((a, b) => a + b, 0);
  const mag = (f: number) => {
    let re = 0;
    let im = 0;
    h.forEach((v, n) => {
      const w = (2 * Math.PI * f * n) / s.fsamp;
      re += v * Math.cos(w);
      im -= v * Math.sin(w);
    });
    return Math.hypot(re, im) / dc;
  };
  return mag;
}

function analyse(s: S, st: Settings) {
  const N = Number(st.taps);
  const mag = response(s, String(st.window), N);
  let stopMax = 0;
  let ripple = 0;
  for (let i = 0; i <= 40; i++) ripple = Math.max(ripple, Math.abs(20 * Math.log10(Math.max(1e-9, mag((s.fpass * i) / 40)))));
  for (let i = 0; i <= 60; i++) stopMax = Math.max(stopMax, mag(s.fstop + ((s.fsamp / 2 - s.fstop) * i) / 60));
  return { N, mag, stopDb: -20 * Math.log10(Math.max(1e-9, stopMax)), ripple };
}

const lab: Lab<S> = {
  key: "fir-filter",
  family: "ece",
  format: "simulation",
  name: "DSP workbench",
  topic: "Digital Signal Processing · FIR filter design",
  keywords: ["digital signal processing", "dsp", "signals and systems", "filter", "image processing", "speech"],
  tools: ["Window library", "Tap count", "freqz plot", "Coefficient view"],
  skillTags: ["FIR filters", "Window method", "Stopband attenuation"],
  makeScenario(rng, d) {
    const fsamp = rng.pick([8000, 10000, 16000, 22050, 32000, 44100, 48000]);
    const fpass = Math.round((fsamp * rng.int(8, 16)) / 100 / 50) * 50;
    const fstop = fpass + Math.round((fsamp * rng.int(4, 9)) / 100 / 50) * 50;
    const base: S = { fsamp, fpass, fstop, attenDb: d === "easy" ? 30 : d === "medium" ? 45 : 58, rippleDb: d === "easy" ? 1 : d === "medium" ? 0.5 : 0.25, maxTaps: Infinity };
    let fewest = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.stopDb >= base.attenDb && a.ripple <= base.rippleDb) fewest = Math.min(fewest, a.N);
    }
    const next = TAPS.find((t) => t >= fewest * (d === "easy" ? 1.6 : d === "medium" ? 1.2 : 1));
    return { ...base, maxTaps: Number.isFinite(fewest) ? next ?? 103 : 103 };
  },
  given: (s) => [
    { label: "Sampling rate", value: `${fmt(s.fsamp / 1000, 2)} kHz` },
    { label: "Keep", value: `up to ${fmt(s.fpass / 1000, 2)} kHz` },
    { label: "Reject", value: `from ${fmt(s.fstop / 1000, 2)} kHz` },
    { label: "Processor", value: `at most ${s.maxTaps} taps` },
  ],
  mission: (s) => `Design a low-pass FIR that rejects everything above ${fmt(s.fstop / 1000, 2)} kHz by ${s.attenDb} dB while passing up to ${fmt(s.fpass / 1000, 2)} kHz within ±${s.rippleDb} dB, using at most ${s.maxTaps} taps.`,
  controls: () => [
    { kind: "choice", id: "window", label: "Window", options: choices(WINDOWS), default: "rectangular" },
    { kind: "choice", id: "taps", label: "Number of taps", options: choices(TAPS), default: "11" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("stop", `Stopband attenuation ≥ ${s.attenDb} dB`, a.stopDb >= s.attenDb, `${fmt(a.stopDb, 1)} dB`, "Each window has a fixed sidelobe floor, however many taps you use. Which windows can even reach this attenuation?"),
      objective("pass", `Passband ripple ≤ ${s.rippleDb} dB`, a.ripple <= s.rippleDb, `${fmt(a.ripple)} dB`, "Too few taps cannot make the transition between pass and stop band in the space you gave it."),
      objective("taps", `Taps ≤ ${s.maxTaps}`, a.N <= s.maxTaps, `${a.N} taps`, "More taps give a sharper transition but cost processing time and delay."),
    ];
    const pts: [number, number][] = Array.from({ length: 121 }, (_, i) => {
      const f = (i / 120) * (s.fsamp / 2);
      return [Number((f / 1000).toFixed(3)), Math.max(-100, 20 * Math.log10(Math.max(1e-6, a.mag(f))))];
    });
    return {
      readings: [
        gauge("stop", "Stopband attenuation", a.stopDb, `${fmt(a.stopDb, 1)} dB`, { min: 0, max: 100, low: s.attenDb }),
        gauge("ripple", "Passband ripple", a.ripple, `${fmt(a.ripple)} dB`, { min: 0, max: Math.max(s.rippleDb * 4, a.ripple * 1.1), high: s.rippleDb }),
        info("delay", "Group delay", `${fmt(((a.N - 1) / 2 / s.fsamp) * 1000, 2)} ms`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Magnitude response (freqz)",
        xLabel: "frequency (kHz)",
        yLabel: "magnitude (dB)",
        lines: [
          { name: "|H(f)|", pts, style: "main" },
          { name: "Stop edge", pts: [[s.fstop / 1000, -100], [s.fstop / 1000, 0]], style: "limit" },
          { name: "Attenuation target", pts: [[0, -s.attenDb], [s.fsamp / 2000, -s.attenDb]], style: "ref" },
        ],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `A windowed-sinc FIR with ${a.N} taps and a ${String(st.window)} window reaches ${fmt(a.stopDb, 1)} dB in the stopband with ${fmt(a.ripple)} dB of passband ripple. The window sets how deep the stopband can go (rectangular about 21 dB, Hann 44, Hamming 53, Blackman 74), while the number of taps sets how narrow the transition can be. The cheapest filter picks the gentlest window that still meets the attenuation and then only as many taps as the transition needs.`;
  },
  fallback: (s) => ({
    title: `Keep the voice below ${fmt(s.fpass / 1000, 2)} kHz`,
    story: `A hearing-aid chip samples at ${fmt(s.fsamp / 1000, 2)} kHz and must remove hiss above ${fmt(s.fstop / 1000, 2)} kHz. Its tiny processor can run only ${s.maxTaps} filter taps.`,
  }),
};
export default defineLab(lab);
