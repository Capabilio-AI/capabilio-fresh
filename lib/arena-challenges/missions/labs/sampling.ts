import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Signals and Systems / DSP: anti-alias filter (4th-order Butterworth), sampling rate and ADC resolution. SNR(dB) = 6.02·N + 1.76.
interface S { fmax: number; fn: number; attenDb: number; snrMin: number; rateMax: number }

const FC = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80];
const FS = [4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 48, 60, 80, 100, 120, 160, 200];
const BITS = [6, 8, 10, 12, 14, 16];
const gainDb = (f: number, fc: number) => -10 * Math.log10(1 + (f / fc) ** 8);

function analyse(s: S, st: Settings) {
  const fc = Number(st.fc);
  const fs = Number(st.fs);
  const n = Number(st.bits);
  const alias = Math.abs(s.fn - Math.round(s.fn / fs) * fs);
  const cut = -gainDb(s.fn, fc);
  return { fc, fs, n, alias, cut, passLoss: -gainDb(s.fmax, fc), snr: 6.02 * n + 1.76, rate: fs * n, intoBand: alias <= s.fmax };
}

const lab: Lab<S> = {
  key: "sampling",
  family: "ece",
  format: "lab",
  name: "Sampling bench",
  topic: "Signals and Systems · Sampling, aliasing and quantisation",
  keywords: ["signals and systems", "digital signal processing", "dsp", "sampling", "signal", "communication"],
  tools: ["Anti-alias filter", "ADC", "Spectrum plot", "Data-rate meter"],
  skillTags: ["Nyquist rate", "Aliasing", "Quantisation SNR"],
  makeScenario(rng, d) {
    const fmax = rng.pick([2, 3, 4, 5, 6, 8, 10, 15, 20]);
    const base: S = { fmax, fn: Math.round(fmax * rng.pick([2.2, 2.6, 3, 3.5, 4, 5])), attenDb: d === "easy" ? 30 : d === "medium" ? 40 : 50, snrMin: d === "easy" ? 50 : d === "medium" ? 62 : 74, rateMax: Infinity };
    let best = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.passLoss <= 1 && a.fs >= 2 * base.fmax && (!a.intoBand || a.cut >= base.attenDb) && a.snr >= base.snrMin) best = Math.min(best, a.rate);
    }
    return { ...base, rateMax: Number.isFinite(best) ? Math.ceil(best * (d === "easy" ? 1.5 : d === "medium" ? 1.2 : 1.03)) : 5000 };
  },
  given: (s) => [
    { label: "Wanted signal", value: `0 to ${s.fmax} kHz` },
    { label: "Interference", value: `${s.fn} kHz tone from a switching supply` },
    { label: "Data link", value: `at most ${s.rateMax} kbit/s` },
  ],
  mission: (s) => `Digitise the 0–${s.fmax} kHz signal with at least ${s.snrMin} dB SNR in under ${s.rateMax} kbit/s, without the ${s.fn} kHz interference aliasing into your band.`,
  controls: () => [
    { kind: "choice", id: "fc", label: "Anti-alias filter cutoff", options: choices(FC, (v) => `${v} kHz`), default: "2" },
    { kind: "choice", id: "fs", label: "Sampling rate", options: choices(FS, (v) => `${v} kHz`), default: "4" },
    { kind: "choice", id: "bits", label: "ADC resolution", options: choices(BITS, (v) => `${v} bit`), default: "6" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("pass", "Wanted band loses ≤ 1 dB", a.passLoss <= 1, `${fmt(a.passLoss)} dB at ${s.fmax} kHz`, "The filter must leave the top of the wanted band almost untouched. Where must the cutoff sit?"),
      objective("nyq", `Sampling rate ≥ ${2 * s.fmax} kHz (Nyquist)`, a.fs >= 2 * s.fmax, `${a.fs} kHz`, "Sampling slower than twice the highest wanted frequency folds the band onto itself."),
      objective("alias", a.intoBand ? `Interference cut ≥ ${s.attenDb} dB before sampling` : "Interference aliases outside the band", !a.intoBand || a.cut >= s.attenDb, a.intoBand ? `aliases to ${fmt(a.alias)} kHz, cut ${fmt(a.cut)} dB` : `aliases to ${fmt(a.alias)} kHz`, "A tone above fs/2 folds back to |f − k·fs|. Either move that image out of the band or filter the tone before the ADC."),
      objective("snr", `SNR ≥ ${s.snrMin} dB`, a.snr >= s.snrMin, `${fmt(a.snr, 1)} dB`, "Each ADC bit adds about 6 dB of signal-to-quantisation-noise ratio."),
      objective("rate", `Data rate ≤ ${s.rateMax} kbit/s`, a.rate <= s.rateMax, `${a.rate} kbit/s`, "Data rate is sampling rate × bits. More of either costs bandwidth."),
    ];
    const pts: [number, number][] = Array.from({ length: 71 }, (_, i) => {
      const f = (i / 70) * Math.max(s.fn * 1.4, a.fs);
      return [Number(f.toFixed(2)), Math.max(-80, gainDb(f, a.fc))];
    });
    return {
      readings: [
        info("alias", "Interference appears at", `${fmt(a.alias)} kHz`),
        gauge("snr", "Quantisation SNR", a.snr, `${fmt(a.snr, 1)} dB`, { min: 0, max: 110, low: s.snrMin }),
        gauge("rate", "Data rate", a.rate, `${a.rate} kbit/s`, { min: 0, max: s.rateMax * 1.6, high: s.rateMax }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Filter response and sampling",
        xLabel: "frequency (kHz)",
        yLabel: "gain (dB)",
        lines: [
          { name: "Anti-alias filter", pts, style: "main" },
          { name: "Nyquist (fs/2)", pts: [[a.fs / 2, -80], [a.fs / 2, 0]], style: "ref" },
          { name: "Interference", pts: [[s.fn, -80], [s.fn, 0]], style: "limit" },
        ],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Sampling at ${a.fs} kHz folds a ${s.fn} kHz tone to ${fmt(a.alias)} kHz. ${a.intoBand ? `That lands inside the ${s.fmax} kHz band, so it can only be removed before the ADC: the filter cuts it by ${fmt(a.cut)} dB.` : "That is outside the wanted band, so it can be ignored."} The ADC adds 6.02 dB per bit, giving ${fmt(a.snr, 1)} dB, and the link carries ${a.rate} kbit/s. Higher sampling rate and more bits cost data rate, so a good design is the cheapest one that meets every limit.`;
  },
  fallback: (s) => ({
    title: `Digitise the ${s.fmax} kHz sensor signal`,
    story: `A vibration sensor outputs a signal up to ${s.fmax} kHz, but a switching power supply nearby adds a ${s.fn} kHz tone. The data logger must sample cleanly and still fit its ${s.rateMax} kbit/s radio link.`,
  }),
};
export default defineLab(lab);
