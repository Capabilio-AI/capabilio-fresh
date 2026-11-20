// A simply supported reinforced-concrete beam by the limit state method of IS 456 (M25 concrete, Fe500 steel), simplified for teaching.
// Loads are characteristic and factored by 1.5. Pure and deterministic. Lengths in mm unless named otherwise.

export const FCK = 25;
export const FY = 500;
const COVER = 40;
const SIDE_COVER = 33; // clear cover plus a stirrup
const TAU_C_MAX = 3.1; // N/mm2, M25
const LD_LIMIT = 26; // basic 20 with a modification factor for the steel stress
const BAR_GAP = 25;
const CONCRETE_PER_M3 = 7500;
const STEEL_PER_KG = 75;
const FORMWORK_PER_M2 = 600;
export const BAR_DIAMETERS = [12, 16, 20, 25];

export interface BeamInput { spanM: number; udlKnm: number; pointKn: number; b: number; D: number; dia: number; n: number }
export interface BeamResult {
  muKnm: number;
  muCapKnm: number;
  xuOverD: number;
  xuMaxOverD: number;
  astMm2: number;
  astMinMm2: number;
  tauV: number;
  tauMax: number;
  ld: number;
  ldLimit: number;
  barsFit: boolean;
  cost: number;
  d: number;
  /** moment at 21 points along the span, kN·m, for the diagram */
  moments: number[];
}

export function analyseBeam(i: BeamInput): BeamResult {
  const L = i.spanM;
  const d = i.D - COVER - i.dia / 2;
  const ast = (i.n * Math.PI * i.dia ** 2) / 4;
  const mmax = (i.udlKnm * L ** 2) / 8 + (i.pointKn * L) / 4;
  const vu = 1.5 * ((i.udlKnm * L) / 2 + i.pointKn / 2);
  const xu = (0.87 * FY * ast) / (0.36 * FCK * i.b);
  const muCap = (0.87 * FY * ast * d * (1 - (ast * FY) / (i.b * d * FCK))) / 1e6;
  const concreteM3 = (i.b / 1000) * (i.D / 1000) * L;
  const steelKg = ast * L * 7.85e-3 * 1.15; // 15% extra for stirrups and laps
  const formworkM2 = ((2 * i.D + i.b) / 1000) * L;
  const moments = Array.from({ length: 21 }, (_, k) => {
    const x = (L * k) / 20;
    const m = (i.udlKnm * x * (L - x)) / 2 + (i.pointKn * (x <= L / 2 ? x : L - x)) / 2;
    return 1.5 * m;
  });
  return {
    muKnm: 1.5 * mmax,
    muCapKnm: muCap,
    xuOverD: xu / d,
    xuMaxOverD: 0.46,
    astMm2: ast,
    astMinMm2: (0.85 * i.b * d) / FY,
    tauV: (vu * 1000) / (i.b * d),
    tauMax: TAU_C_MAX,
    ld: (L * 1000) / d,
    ldLimit: LD_LIMIT,
    barsFit: i.b - 2 * SIDE_COVER >= i.n * i.dia + (i.n - 1) * Math.max(BAR_GAP, i.dia),
    cost: concreteM3 * CONCRETE_PER_M3 + steelKg * STEEL_PER_KG + formworkM2 * FORMWORK_PER_M2,
    d,
    moments,
  };
}
