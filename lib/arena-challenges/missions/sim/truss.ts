// 2D pin-jointed truss by the direct stiffness method. Pure and deterministic, so the server can re-run exactly what the student built.
// Units: metres, kilonewtons for loads and forces, megapascals for stress. Forces are positive in tension.

export interface Joint { x: number; y: number }
export interface Support { joint: number; kind: "pin" | "roller" }
export interface Load { joint: number; fx: number; fy: number }
export interface Section { label: string; areaCm2: number; inertiaCm4: number }
export interface Material { name: string; eGpa: number; allowMpa: number; density: number }
export interface Member { a: number; b: number; size: number }

export const MATERIALS: Record<string, Material> = {
  steel: { name: "Mild steel", eGpa: 200, allowMpa: 150, density: 7850 },
  aluminium: { name: "Aluminium alloy", eGpa: 70, allowMpa: 90, density: 2700 },
};
/** three tube sizes per material family; larger sections carry more load and weigh more */
export const SECTIONS: Section[] = [
  { label: "Light", areaCm2: 3, inertiaCm4: 3 },
  { label: "Medium", areaCm2: 6, inertiaCm4: 12 },
  { label: "Heavy", areaCm2: 12, inertiaCm4: 40 },
];
const BUCKLING_FACTOR = 2;
const SINGULAR = 1e-9;

export interface TrussInput { joints: Joint[]; supports: Support[]; loads: Load[]; members: Member[]; material: Material }
export interface TrussResult {
  stable: boolean;
  reason: string | null;
  /** kN per member, in the order given; tension positive */
  forces: number[];
  /** utilisation per member: 1 = exactly at the allowable stress or buckling limit */
  utilisation: number[];
  lengths: number[];
  massKg: number;
  /** largest downward joint displacement, in millimetres */
  maxDeflectionMm: number;
}

export const memberLength = (j: Joint[], m: Member): number => Math.hypot(j[m.b].x - j[m.a].x, j[m.b].y - j[m.a].y);

/** Gaussian elimination with partial pivoting; null when the matrix is singular (the structure is a mechanism). */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  const scale = Math.max(1, ...a.flat().map(Math.abs));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < SINGULAR * scale) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < n; r++) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = m[r][n];
    for (let k = r + 1; k < n; k++) sum -= m[r][k] * x[k];
    x[r] = sum / m[r][r];
  }
  return x;
}

const unstable = (reason: string, members: Member[]): TrussResult => ({ stable: false, reason, forces: members.map(() => 0), utilisation: members.map(() => 0), lengths: members.map(() => 0), massKg: 0, maxDeflectionMm: 0 });

export function analyseTruss(t: TrussInput): TrussResult {
  const { joints, supports, loads, members, material } = t;
  if (members.length === 0) return unstable("There are no members yet.", members);
  const used = new Set(members.flatMap((m) => [m.a, m.b]));
  for (const l of loads) if (!used.has(l.joint)) return unstable("A loaded joint is not connected to any member.", members);
  for (const s of supports) if (!used.has(s.joint)) return unstable("A support is not connected to any member.", members);

  const dof = (j: number, axis: 0 | 1) => j * 2 + axis;
  const restrained = new Set<number>();
  for (const s of supports) {
    restrained.add(dof(s.joint, 1));
    if (s.kind === "pin") restrained.add(dof(s.joint, 0));
  }
  const n = joints.length * 2;
  const K: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const lengths = members.map((m) => memberLength(joints, m));
  members.forEach((m, i) => {
    const L = lengths[i];
    if (L < 1e-6) return;
    const c = (joints[m.b].x - joints[m.a].x) / L;
    const s = (joints[m.b].y - joints[m.a].y) / L;
    const k = (material.eGpa * 1e6 * SECTIONS[m.size].areaCm2 * 1e-4) / L; // kN/m (E in kPa)
    const idx = [dof(m.a, 0), dof(m.a, 1), dof(m.b, 0), dof(m.b, 1)];
    const g = [c, s, -c, -s];
    for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) K[idx[p]][idx[q]] += k * g[p] * g[q];
  });

  // only the joints that carry members take part; the rest have no stiffness and no meaning
  const free: number[] = [];
  for (const j of used) for (const axis of [0, 1] as const) if (!restrained.has(dof(j, axis))) free.push(dof(j, axis));
  free.sort((a, b) => a - b);
  const F = new Array<number>(n).fill(0);
  for (const l of loads) {
    F[dof(l.joint, 0)] += l.fx;
    F[dof(l.joint, 1)] += l.fy;
  }
  const u = new Array<number>(n).fill(0);
  if (free.length > 0) {
    const sol = solve(free.map((r) => free.map((c) => K[r][c])), free.map((r) => F[r]));
    if (!sol) return unstable("The structure is a mechanism: it would collapse. Add members to triangulate it.", members);
    free.forEach((d, i) => (u[d] = sol[i]));
  }

  const forces = members.map((m, i) => {
    const L = lengths[i];
    const c = (joints[m.b].x - joints[m.a].x) / L;
    const s = (joints[m.b].y - joints[m.a].y) / L;
    const elong = (u[dof(m.b, 0)] - u[dof(m.a, 0)]) * c + (u[dof(m.b, 1)] - u[dof(m.a, 1)]) * s;
    return ((material.eGpa * 1e6 * SECTIONS[m.size].areaCm2 * 1e-4) / L) * elong;
  });
  const utilisation = members.map((m, i) => {
    const sec = SECTIONS[m.size];
    const stress = Math.abs(forces[i]) / (sec.areaCm2 * 1e-4) / 1000; // MPa
    const byStress = stress / material.allowMpa;
    if (forces[i] >= 0) return byStress;
    const euler = (Math.PI ** 2 * material.eGpa * 1e6 * sec.inertiaCm4 * 1e-8) / (lengths[i] ** 2); // kN
    return Math.max(byStress, Math.abs(forces[i]) / (euler / BUCKLING_FACTOR));
  });
  const massKg = members.reduce((sum, m, i) => sum + lengths[i] * SECTIONS[m.size].areaCm2 * 1e-4 * material.density, 0);
  const maxDeflectionMm = Math.max(0, ...[...used].map((j) => -u[dof(j, 1)] * 1000));
  return { stable: true, reason: null, forces, utilisation, lengths, massKg, maxDeflectionMm };
}
