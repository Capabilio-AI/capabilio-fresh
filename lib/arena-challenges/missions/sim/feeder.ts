// A radial distribution feeder of four buses on a 1 MVA base, by the simplified DistFlow equations. Pure and deterministic.
// Segment i feeds bus i + 1; capacitors at a bus cancel part of its reactive load, so less reactive power flows (and drops voltage) upstream.

export const BASE_KVA = 1000;
export const CAP_OPTIONS_KVAR = [0, 200, 400, 600, 800];

export interface FeederInput {
  /** segment resistance and reactance, per unit */
  r: number[];
  x: number[];
  /** load at buses 1..n */
  pKw: number[];
  qKvar: number[];
  /** capacitor bank at buses 1..n */
  capKvar: number[];
}
export interface FeederResult {
  /** voltage at buses 1..n, per unit */
  voltage: number[];
  lossKw: number;
  /** power factor at the substation, and its reactive power (negative = leading) */
  pf: number;
  qNetKvar: number;
}

export function analyseFeeder(f: FeederInput): FeederResult {
  const n = f.pKw.length;
  const flowP = new Array<number>(n).fill(0);
  const flowQ = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    flowP[i] = f.pKw[i] / BASE_KVA + (i + 1 < n ? flowP[i + 1] : 0);
    flowQ[i] = (f.qKvar[i] - f.capKvar[i]) / BASE_KVA + (i + 1 < n ? flowQ[i + 1] : 0);
  }
  const voltage: number[] = [];
  let v = 1;
  let loss = 0;
  for (let i = 0; i < n; i++) {
    loss += (f.r[i] * (flowP[i] ** 2 + flowQ[i] ** 2)) / v ** 2;
    v -= (f.r[i] * flowP[i] + f.x[i] * flowQ[i]) / v;
    voltage.push(v);
  }
  const p = flowP[0] * BASE_KVA + loss * BASE_KVA;
  const q = flowQ[0] * BASE_KVA;
  return { voltage, lossKw: loss * BASE_KVA, pf: p / Math.hypot(p, q), qNetKvar: q };
}
