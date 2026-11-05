import { choices, fmt, gauge, info, objective } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";
import { gridSettings } from "../grid";

// Digital Communications: modulation, transmit power and coding on a noisy link. BER from the Q-function, as in MATLAB's berawgn.
interface S { distKm: number; rbKbps: number; bwKhz: number; berMax: number; powerMaxDbm: number }

const MODS = { BPSK: 1, QPSK: 2, "8-PSK": 3, "16-QAM": 4 } as const;
const CODES = { none: { rate: 1, gain: 0 }, "3/4": { rate: 0.75, gain: 2 }, "1/2": { rate: 0.5, gain: 3.2 } } as const;
const POWERS = [0, 4, 8, 12, 16, 20, 24, 28, 30];
const Q = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const p = (1 / Math.sqrt(2 * Math.PI)) * Math.exp((-x * x) / 2) * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? p : 1 - p;
};
const ber = (mod: string, ebn0: number) => {
  const k = MODS[mod as keyof typeof MODS];
  const M = 2 ** k;
  if (mod === "BPSK" || mod === "QPSK") return Q(Math.sqrt(2 * ebn0));
  if (mod === "8-PSK") return Math.min(0.5, (2 / k) * Q(Math.sqrt(2 * k * Math.sin(Math.PI / M) ** 2 * ebn0)));
  return Math.min(0.5, ((4 / k) * (1 - 1 / Math.sqrt(M))) * Q(Math.sqrt(((3 * k) / (M - 1)) * ebn0)));
};

function analyse(s: S, st: Settings) {
  const mod = String(st.mod);
  const code = CODES[String(st.code) as keyof typeof CODES];
  const k = MODS[mod as keyof typeof MODS];
  const pathLoss = 92.45 + 20 * Math.log10(2.4) + 20 * Math.log10(s.distKm); // 2.4 GHz free space
  const noiseDbm = -174 + 5 + 10 * Math.log10(s.rbKbps * 1000 / code.rate); // 5 dB noise figure, noise over the coded bit rate
  const ebn0Db = Number(st.power) - pathLoss - noiseDbm + code.gain;
  const ebn0Of = (db: number) => 10 ** (db / 10);
  return { mod, k, code: String(st.code), pathLoss, ebn0Db, ber: ber(mod, ebn0Of(ebn0Db)), bw: s.rbKbps / code.rate / k, ebn0Of, power: Number(st.power) };
}

const lab: Lab<S> = {
  key: "digital-link",
  family: "ece",
  format: "simulation",
  name: "Link budget bench",
  topic: "Digital Communications · Modulation, BER and coding",
  keywords: ["digital communications", "communication", "satellite", "wireless", "cellular", "coding theory", "modulation"],
  tools: ["Modulator", "Power amplifier", "Channel coder", "BER curve"],
  skillTags: ["BER", "Eb/N0", "Modulation trade-offs"],
  makeScenario(rng, d) {
    const base: S = { distKm: rng.pick([0.5, 1, 2, 3, 5, 8, 12, 20]), rbKbps: rng.pick([64, 128, 256, 512, 1024, 2048]), bwKhz: Infinity, berMax: d === "easy" ? 1e-3 : d === "medium" ? 1e-4 : 1e-5, powerMaxDbm: 0 };
    // the cheapest design that meets the BER sets the power and bandwidth budgets, with slack by difficulty
    let power = Infinity;
    let bw = Infinity;
    for (const st of gridSettings(lab.controls(base))) {
      const a = analyse(base, st);
      if (a.ber > base.berMax) continue;
      if (a.power < power || (a.power === power && a.bw < bw)) {
        power = a.power;
        bw = a.bw;
      }
    }
    if (!Number.isFinite(power)) return { ...base, bwKhz: 4096, powerMaxDbm: 30 };
    return { ...base, bwKhz: Math.ceil(bw * (d === "easy" ? 2.2 : d === "medium" ? 1.5 : 1.05)), powerMaxDbm: Math.min(30, power + (d === "easy" ? 8 : d === "medium" ? 4 : 0)) };
  },
  given: (s) => [
    { label: "Link", value: `${s.distKm} km at 2.4 GHz, free space` },
    { label: "Data", value: `${s.rbKbps} kbit/s` },
    { label: "Channel", value: `${fmt(s.bwKhz, 0)} kHz available` },
    { label: "Transmitter", value: `up to ${s.powerMaxDbm} dBm` },
  ],
  mission: (s) => `Choose modulation, coding and power so the link reaches a bit error rate of ${s.berMax.toExponential(0)} or better inside ${fmt(s.bwKhz, 0)} kHz and ${s.powerMaxDbm} dBm.`,
  controls: () => [
    { kind: "choice", id: "mod", label: "Modulation", options: choices(Object.keys(MODS)), default: "BPSK" },
    { kind: "choice", id: "code", label: "Error-correcting code rate", options: choices(Object.keys(CODES)), default: "none" },
    { kind: "choice", id: "power", label: "Transmit power", options: choices(POWERS, (v) => `${v} dBm`), default: "0" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const objectives = [
      objective("ber", `BER ≤ ${s.berMax.toExponential(0)}`, a.ber <= s.berMax, `BER ${a.ber < 1e-12 ? "< 1e-12" : a.ber.toExponential(1)} at Eb/N0 ${fmt(a.ebn0Db, 1)} dB`, "Eb/N0 is what decides the error rate. Which of power, coding and modulation raise it, and which lower it?"),
      objective("bw", `Bandwidth ≤ ${fmt(s.bwKhz, 0)} kHz`, a.bw <= s.bwKhz, `${fmt(a.bw, 0)} kHz`, "Higher-order modulation packs more bits per symbol, but coding adds extra bits that need room."),
      objective("pwr", `Power ≤ ${s.powerMaxDbm} dBm`, a.power <= s.powerMaxDbm, `${a.power} dBm`, "Transmit power is limited by the radio licence and the battery."),
    ];
    const pts: [number, number][] = Array.from({ length: 41 }, (_, i) => {
      const db = -2 + i * 0.5;
      return [db, Math.log10(Math.max(1e-12, ber(a.mod, a.ebn0Of(db))))];
    });
    return {
      readings: [
        info("ebn0", "Eb/N0 at the receiver", `${fmt(a.ebn0Db, 1)} dB`),
        info("loss", "Path loss", `${fmt(a.pathLoss, 1)} dB`),
        gauge("bw", "Bandwidth used", a.bw, `${fmt(a.bw, 0)} kHz`, { min: 0, max: s.bwKhz * 1.6, high: s.bwKhz }),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: `${a.mod} bit error rate`,
        xLabel: "Eb/N0 (dB)",
        yLabel: "log10 BER",
        lines: [
          { name: "BER curve", pts, style: "main" },
          { name: "Target", pts: [[-2, Math.log10(s.berMax)], [18, Math.log10(s.berMax)]], style: "ref" },
          { name: "Operating point", pts: [[Math.max(-2, Math.min(18, a.ebn0Db)), -12], [Math.max(-2, Math.min(18, a.ebn0Db)), 0]], style: "limit" },
        ],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `Free-space loss over ${s.distKm} km at 2.4 GHz is ${fmt(a.pathLoss, 1)} dB, which with ${a.power} dBm transmitted and the receiver noise leaves Eb/N0 = ${fmt(a.ebn0Db, 1)} dB. ${a.mod} then gives BER ${a.ber.toExponential(1)}. Coding (${a.code}) buys coding gain but widens the signal; denser modulation saves bandwidth but needs more Eb/N0 for the same BER. The design is the trade-off between power, bandwidth and reliability.`;
  },
  fallback: (s) => ({
    title: `Telemetry across ${s.distKm} km`,
    story: `A river-monitoring station must send ${s.rbKbps} kbit/s to a base ${s.distKm} km away on the 2.4 GHz band. The licence allows ${fmt(s.bwKhz, 0)} kHz and the battery limits the radio to ${s.powerMaxDbm} dBm.`,
  }),
};
export default defineLab(lab);
