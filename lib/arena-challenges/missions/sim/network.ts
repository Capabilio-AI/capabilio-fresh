// A branched (tree) water supply network from one reservoir, by the Hazen-Williams head-loss equation. Pure and deterministic.
// Node 0 is the reservoir; node i (i >= 1) is fed by pipe i - 1 from node parent[i]. Flows are the sum of the demands downstream.

export interface NetworkInput {
  /** reservoir water level above datum, metres */
  head: number;
  /** ground level of nodes 1..n, metres */
  elev: number[];
  /** demand at nodes 1..n, litres per second */
  demandLps: number[];
  /** parent[i - 1] is the node that feeds node i (0 = the reservoir) */
  parent: number[];
  /** length of the pipe that feeds node i, metres */
  length: number[];
  /** chosen inside diameter of that pipe, millimetres */
  diameterMm: number[];
  /** Hazen-Williams roughness coefficient */
  c: number;
}
export interface NetworkResult {
  flowLps: number[];
  velocity: number[];
  lossM: number[];
  /** residual pressure head at nodes 1..n: hydraulic grade line minus ground level, metres */
  pressureM: number[];
}

export const SIZES_MM = [100, 150, 200, 250, 300];
export const COST_PER_M: Record<number, number> = { 100: 900, 150: 1400, 200: 2000, 250: 2800, 300: 3800 };

/** Hazen-Williams head loss for one pipe, metres. */
export const headLoss = (lengthM: number, flowLps: number, diameterMm: number, c: number): number => {
  const q = flowLps / 1000;
  const d = diameterMm / 1000;
  return (10.67 * lengthM * q ** 1.852) / (c ** 1.852 * d ** 4.87);
};

export function analyseNetwork(n: NetworkInput): NetworkResult {
  const count = n.parent.length;
  const flowLps = new Array<number>(count).fill(0);
  for (let i = 0; i < count; i++) flowLps[i] = n.demandLps[i];
  // children always have a higher index than their parent, so one backwards pass accumulates the downstream demand
  for (let i = count - 1; i >= 0; i--) if (n.parent[i] > 0) flowLps[n.parent[i] - 1] += flowLps[i];
  const lossM = flowLps.map((q, i) => headLoss(n.length[i], q, n.diameterMm[i], n.c));
  const velocity = flowLps.map((q, i) => q / 1000 / (Math.PI * (n.diameterMm[i] / 2000) ** 2));
  const grade = new Array<number>(count).fill(0);
  for (let i = 0; i < count; i++) grade[i] = (n.parent[i] === 0 ? n.head : grade[n.parent[i] - 1]) - lossM[i];
  return { flowLps, velocity, lossM, pressureM: grade.map((g, i) => g - n.elev[i]) };
}

export const pipeCost = (n: Pick<NetworkInput, "length" | "diameterMm">): number => n.diameterMm.reduce((sum, d, i) => sum + COST_PER_M[d] * n.length[i], 0);
