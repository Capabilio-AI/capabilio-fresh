// A four-stage receiver chain: low-noise amplifier, band filter, gain stage, ADC driver. Cascaded noise figure by the Friis formula; levels in dBm.
// Pure and deterministic. Shared by the grader and the screen's live level diagram.

export interface Part { name: string; gainDb: number; nfDb: number; mA: number; cost: number; rejectionDb: number }
export interface Stage { id: string; label: string; parts: Part[] }

export const STAGES: Stage[] = [
  { id: "lna", label: "Low-noise amplifier", parts: [
    { name: "Basic BJT amplifier", gainDb: 12, nfDb: 3, mA: 8, cost: 120, rejectionDb: 0 },
    { name: "GaAs pHEMT LNA", gainDb: 18, nfDb: 0.8, mA: 25, cost: 900, rejectionDb: 0 },
    { name: "CMOS LNA", gainDb: 15, nfDb: 1.8, mA: 10, cost: 350, rejectionDb: 0 },
    { name: "Op-amp stage", gainDb: 20, nfDb: 6, mA: 4, cost: 60, rejectionDb: 0 },
  ] },
  { id: "filter", label: "Band filter", parts: [
    { name: "No filter (bypass)", gainDb: 0, nfDb: 0, mA: 0, cost: 0, rejectionDb: 0 },
    { name: "LC filter", gainDb: -2, nfDb: 2, mA: 0, cost: 40, rejectionDb: 18 },
    { name: "Ceramic filter", gainDb: -3, nfDb: 3, mA: 0, cost: 80, rejectionDb: 28 },
    { name: "SAW filter", gainDb: -6, nfDb: 6, mA: 0, cost: 300, rejectionDb: 48 },
  ] },
  { id: "gain", label: "Gain stage", parts: [
    { name: "Single MMIC amplifier", gainDb: 14, nfDb: 4, mA: 30, cost: 150, rejectionDb: 0 },
    { name: "Two-stage cascade", gainDb: 28, nfDb: 4.5, mA: 55, cost: 300, rejectionDb: 0 },
    { name: "Variable-gain amplifier", gainDb: 20, nfDb: 5, mA: 40, cost: 450, rejectionDb: 0 },
    { name: "Low-power amplifier", gainDb: 10, nfDb: 3.5, mA: 12, cost: 90, rejectionDb: 0 },
  ] },
  { id: "driver", label: "ADC driver", parts: [
    { name: "Resistive pad", gainDb: -6, nfDb: 6, mA: 0, cost: 10, rejectionDb: 0 },
    { name: "Differential driver", gainDb: 8, nfDb: 5, mA: 35, cost: 380, rejectionDb: 0 },
    { name: "Unity buffer", gainDb: 0, nfDb: 3, mA: 6, cost: 70, rejectionDb: 0 },
    { name: "Transformer", gainDb: -1, nfDb: 1, mA: 0, cost: 160, rejectionDb: 0 },
  ] },
];
export const SUPPLY_V = 5;

export interface ChainResult {
  totalGainDb: number;
  nfDb: number;
  rejectionDb: number;
  powerMw: number;
  cost: number;
  /** signal and noise level after each stage, dBm, for the level diagram: index 0 is the antenna */
  signal: number[];
  noise: number[];
}

const db10 = (x: number) => 10 * Math.log10(x);
const lin = (d: number) => 10 ** (d / 10);

/** `choice[i]` is the index of the part picked for stage i. */
export function analyseChain(choice: number[], inputDbm: number, bandwidthKhz: number): ChainResult {
  const parts = STAGES.map((s, i) => s.parts[choice[i]] ?? s.parts[0]);
  let gainLin = 1;
  let f = 1;
  parts.forEach((p, i) => {
    f += i === 0 ? lin(p.nfDb) - 1 : (lin(p.nfDb) - 1) / gainLin;
    gainLin *= lin(p.gainDb);
  });
  const floorIn = -174 + db10(bandwidthKhz * 1000); // thermal noise at the input, dBm
  const signal = [inputDbm];
  const noise = [floorIn];
  let g = 0;
  let fCum = 1;
  let gCum = 1;
  parts.forEach((p, i) => {
    g += p.gainDb;
    fCum += i === 0 ? lin(p.nfDb) - 1 : (lin(p.nfDb) - 1) / gCum;
    gCum *= lin(p.gainDb);
    signal.push(inputDbm + g);
    noise.push(floorIn + db10(fCum) + g);
  });
  return {
    totalGainDb: g,
    nfDb: db10(f),
    rejectionDb: parts.reduce((a, p) => a + p.rejectionDb, 0),
    powerMw: parts.reduce((a, p) => a + p.mA * SUPPLY_V, 0),
    cost: parts.reduce((a, p) => a + p.cost, 0),
    signal,
    noise,
  };
}

/** The ADC's own in-band noise at its input, dBm. Referred back to the antenna it shrinks as the chain's gain grows, so more gain helps the SNR. */
export const ADC_NOISE_DBM = -55;

/** Output signal-to-noise ratio, dB: the signal against the chain's thermal noise plus the ADC's noise, both referred to the antenna. */
export function snrDb(inputDbm: number, bandwidthKhz: number, nfDb: number, totalGainDb: number): number {
  const chain = -174 + db10(bandwidthKhz * 1000) + nfDb;
  const adc = ADC_NOISE_DBM - totalGainDb;
  return inputDbm - db10(lin(chain) + lin(adc));
}
